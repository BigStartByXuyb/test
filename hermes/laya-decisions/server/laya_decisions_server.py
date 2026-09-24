"""laya-decisions-mcp — local ``jev_*`` decision tools backed by the laya decision service.

Why this exists
    Laya (Convai Innovations, Apache-2.0) is a System One decision model running on this
    host: it takes a state plus typed questions (choice / score / noul) and returns typed
    answers with calibrated probabilities in one forward pass. It never writes prose.

    This server exposes it under the tool names the community ``jev_*`` plugins use, so a
    caller can be repointed between this and a hosted Jev backend without rewriting call
    sites. It talks to ``http://127.0.0.1:8095/predict`` and nothing else: no egress, no
    API key, no per-call cost.

Design commitments that the measurements forced
    * The question text is part of the interface. Repeat an identical call and the
      probability moves by 0.000000; rewrite the wording and it moves by up to 0.32.
      So the phrasing is frozen in ``prompts/frozen-questions.v1.json`` and every
      response echoes the wording used plus its sha256.
    * Calls are serialised behind one lock. The service keeps at most
      ``LAYA_MAX_LOADED=2`` checkpoints resident (~2 GB each) on a box with no swap, so
      concurrent calls that alternate languages would evict and reload weights.
    * An unreachable service is an error, never an empty value. A gate that silently
      reads "no signal" as "no" is worse than a gate that fails loudly.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from mcp.server.mcpserver import MCPServer

# ── configuration ────────────────────────────────────────────────────────────────

PLUGIN_ROOT = Path(os.environ.get("PLUGIN_ROOT") or Path(__file__).resolve().parent.parent)
BASE_URL = os.environ.get("LAYA_BASE_URL", "http://127.0.0.1:8095").rstrip("/")
PREDICT_URL = f"{BASE_URL}/predict"
HEALTH_URL = f"{BASE_URL}/health"
TIMEOUT_S = float(os.environ.get("LAYA_TIMEOUT_S", "180"))
REGISTRY_PATH = Path(os.environ.get("LAYA_QUESTION_REGISTRY")
                     or PLUGIN_ROOT / "prompts" / "frozen-questions.v1.json")

# Mirrors laya.router._ALIASES so a bad name fails here with the accepted set, rather than
# as an opaque 500 from the service.
_MODEL_ALIASES = {
    "en": "english", "laya": "english", "default": "english",
    "multi": "multilingual", "ml": "multilingual", "laya-multilingual": "multilingual",
    "typed": "typed-decisions", "typed_decisions": "typed-decisions",
    "laya-typed-decisions": "typed-decisions", "decisions": "typed-decisions",
}
_MODELS = ("english", "multilingual", "typed-decisions")

# One request in flight at a time — see the module docstring.
_CALL_LOCK = threading.Lock()


# ── question registry ────────────────────────────────────────────────────────────


def _load_registry() -> Dict[str, Any]:
    try:
        with open(REGISTRY_PATH, encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return {"registry_version": "absent", "questions": {}}
    except (OSError, json.JSONDecodeError) as exc:
        raise LayaToolError(f"frozen question registry at {REGISTRY_PATH} is unreadable: {exc}") from exc


_REGISTRY = _load_registry()
REGISTRY_VERSION = _REGISTRY.get("registry_version", "unknown")


# ── errors ───────────────────────────────────────────────────────────────────────


class LayaToolError(RuntimeError):
    """A caller-facing failure: raised so the MCP layer returns isError, never empty data."""


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ── transport ────────────────────────────────────────────────────────────────────


def _post_predict(payload: Dict[str, Any]) -> Dict[str, Any]:
    """One POST to /predict. Every failure mode becomes a LayaToolError naming the cause."""
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(PREDICT_URL, data=body,
                                     headers={"Content-Type": "application/json"}, method="POST")
    started = time.perf_counter()
    try:
        with _CALL_LOCK:
            with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
                raw = response.read()
                latency_ms = round((time.perf_counter() - started) * 1000, 1)
                header_ms = response.headers.get("x-laya-latency-ms")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:800]
        raise LayaToolError(
            f"laya rejected the request: HTTP {exc.code} from {PREDICT_URL}. "
            f"Service said: {detail or '(no body)'}. "
            "A 500 here usually means the question definition is malformed — choice/score "
            "need 'criteria', noul does not.") from exc
    except urllib.error.URLError as exc:
        raise LayaToolError(
            f"laya decision service is unreachable at {PREDICT_URL} ({exc.reason}). "
            "Check the container with `docker ps --filter name=laya` and "
            f"`curl -s {HEALTH_URL}`. No answer was produced — this is not a negative result."
        ) from exc
    except TimeoutError as exc:
        raise LayaToolError(
            f"laya did not answer {PREDICT_URL} within {TIMEOUT_S:g}s. Cold start loads weights "
            "for about 60s; if the container just restarted, retry once."
        ) from exc
    except OSError as exc:
        raise LayaToolError(f"transport failure talking to {PREDICT_URL}: {exc!r}") from exc

    try:
        parsed = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise LayaToolError(f"laya returned a body that is not JSON: {raw[:300]!r}") from exc
    if not isinstance(parsed, dict) or "answers" not in parsed:
        raise LayaToolError(f"laya returned an unexpected shape (no 'answers' key): {str(parsed)[:300]}")
    parsed["_client_latency_ms"] = latency_ms
    if header_ms:
        try:
            parsed["_server_latency_ms"] = float(header_ms)
        except ValueError:
            pass
    return parsed


def _normalise_model(model: Optional[str]) -> Optional[str]:
    if model is None or str(model).strip() == "":
        return None
    key = _MODEL_ALIASES.get(str(model).strip().lower(), str(model).strip().lower())
    if key not in _MODELS:
        raise LayaToolError(
            f"unknown model {model!r}; use one of {list(_MODELS)}, an alias "
            f"({sorted(_MODEL_ALIASES)}), or omit it to let laya route on the state's language.")
    return key


# ── question construction ────────────────────────────────────────────────────────


def _resolve_wording(question: Optional[str], question_id: Optional[str], fallback_id: str) -> Dict[str, Any]:
    """Pick the instruction text and describe where it came from.

    Precedence: explicit ``question`` > ``question_id`` > the tool's frozen default. The
    wording block is echoed on every response so a rewrite is visible downstream.
    """
    if question is not None and str(question).strip():
        if question_id:
            raise LayaToolError("pass either 'question' or 'question_id', not both — "
                                "silently preferring one would hide which wording was scored.")
        text = str(question)
        return {"text": text, "sha256": _sha256(text), "source": "caller"}

    qid = question_id or fallback_id
    entry = (_REGISTRY.get("questions") or {}).get(qid)
    if entry is None:
        known = sorted((_REGISTRY.get("questions") or {}))
        raise LayaToolError(
            f"no frozen question {qid!r} in registry v{REGISTRY_VERSION} ({REGISTRY_PATH.name}); "
            f"known ids: {known}. Either pass 'question' verbatim, or use a known question_id.")
    text = entry["instructions"]
    return {"text": text, "sha256": _sha256(text), "source": f"frozen:{qid}",
            "registry_version": REGISTRY_VERSION}


def _envelope(tool: str, qid: str, answer: Dict[str, Any], wording: Dict[str, Any],
              model: Optional[str], raw: Dict[str, Any]) -> Dict[str, Any]:
    routing = raw.get("routing") or {}
    return {
        "tool": tool,
        # The key this answer is filed under inside laya's `answers` map. For single-question
        # tools it is a transport detail; jev_evaluate sets it from the task's 'id'.
        "laya_answer_key": qid,
        "answer": answer,
        "wording": wording,
        "checkpoint": {
            "requested": model,
            "used": routing.get("model"),
            "why": routing.get("reason"),
            "workflow": routing.get("workflow"),
        },
        "latency_ms": {"client": raw.get("_client_latency_ms"), "server": raw.get("_server_latency_ms")},
        "usage": raw.get("usage"),
        "service": {"base_url": BASE_URL, "endpoint": "/predict", "registry_version": REGISTRY_VERSION},
    }


def _extract(raw: Dict[str, Any], qid: str) -> Dict[str, Any]:
    answers = raw.get("answers") or {}
    if qid not in answers:
        raise LayaToolError(f"laya answered {sorted(answers)} but not {qid!r}")
    return answers[qid]


def _repeat(payload: Dict[str, Any], repeat: int) -> List[Dict[str, Any]]:
    """Run the identical payload *repeat* times and return every raw response.

    Identical input is expected to be bit-identical output; the spread this produces is
    the evidence that a threshold is not sitting on sampling noise.
    """
    if repeat < 1 or repeat > 5:
        raise LayaToolError(f"repeat must be between 1 and 5, got {repeat}")
    return [_post_predict(payload) for _ in range(repeat)]


def _spread(raws: List[Dict[str, Any]], qid: str, key: str) -> Dict[str, Any]:
    values = [(_extract(r, qid) or {}).get(key) for r in raws]
    numeric = [v for v in values if isinstance(v, (int, float))]
    return {"values": values,
            "range": round(max(numeric) - min(numeric), 10) if len(numeric) > 1 else 0.0,
            "runs": len(values)}


# ── MCP server ───────────────────────────────────────────────────────────────────

server = MCPServer(
    name="laya-decisions",
    version="1.0.0",
    instructions=(
        "Local, zero-cost System One decision tools (choice / score / noul) served by the "
        "laya model on this host. Every answer carries calibrated probabilities and the "
        "checkpoint that produced it. Confidence is typically 0.07-0.30, so treat these as "
        "advisory signals, not verdicts. Answers are deterministic for a fixed wording: "
        "question phrasing is part of the interface."),
)


@server.tool(description=(
    "Ask one yes/no question about a state. Returns P(true) with the model's confidence in "
    "its own answer. Mirrors the jev_check shape from the hosted Jev plugins, but runs "
    "locally against laya."))
def jev_check(state: Union[str, Dict[str, Any], List[Any]],
              question: Optional[str] = None,
              question_id: Optional[str] = None,
              model: Optional[str] = None,
              repeat: int = 1) -> Dict[str, Any]:
    """Args:
        state: Text or JSON describing the situation being judged.
        question: The yes/no question, verbatim. Omit to use a frozen question_id.
        question_id: Id in the frozen registry (e.g. 'review.architect_first') when you
            want wording that is version-controlled rather than typed at the call site.
        model: 'english' | 'multilingual' | 'typed-decisions'; omit to auto-route.
        repeat: Run the identical call N times (1-5) to measure run-to-run spread.
    """
    model = _normalise_model(model)
    qid = "check"
    wording = _resolve_wording(question, question_id, "review.architect_first")
    payload = {"state": state,
               "questions": {qid: {"type": "noul", "instructions": wording["text"]}}}
    if model:
        payload["model"] = model
    raws = _repeat(payload, repeat)
    answer = _extract(raws[0], qid)
    out = _envelope("jev_check", qid, answer, wording, model, raws[0])
    if repeat > 1:
        out["stability"] = {"noul": _spread(raws, qid, "noul"),
                            "confidence": _spread(raws, qid, "confidence")}
    return out


@server.tool(description=(
    "Route a state to one of the given options. Returns the probability of every option and "
    "the selected one. Option labels and their order are part of the question wording."))
def jev_route(state: Union[str, Dict[str, Any], List[Any]],
              options: List[str],
              question: Optional[str] = None,
              question_id: Optional[str] = None,
              model: Optional[str] = None,
              repeat: int = 1) -> Dict[str, Any]:
    """Args:
        state: Text or JSON describing the situation being routed.
        options: Candidate labels, most-preferred first is NOT assumed — order only fixes
            the label indices, not a prior.
        question: The routing question, verbatim. Omit to use a frozen question_id.
        question_id: Id in the frozen registry (e.g. 'triage.category').
        model: 'english' | 'multilingual' | 'typed-decisions'; omit to auto-route.
        repeat: Run the identical call N times (1-5) to measure run-to-run spread.
    """
    if not options or not all(isinstance(o, str) and o.strip() for o in options):
        raise LayaToolError("options must be a non-empty list of non-empty strings")
    if len(options) < 2:
        raise LayaToolError("options needs at least two labels; a single option has no decision in it")
    if len(options) > 24:
        raise LayaToolError(f"options has {len(options)} labels; laya renders every label into the "
                            "prompt head and truncates past its budget — use 24 or fewer.")
    model = _normalise_model(model)
    qid = "route"
    wording = _resolve_wording(question, question_id, "triage.category")
    payload = {"state": state,
               "questions": {qid: {"type": "choice", "instructions": wording["text"],
                                   "criteria": list(options)}}}
    if model:
        payload["model"] = model
    raws = _repeat(payload, repeat)
    answer = _extract(raws[0], qid)
    out = _envelope("jev_route", qid, answer, wording, model, raws[0])
    if repeat > 1:
        out["stability"] = {"choice": _spread(raws, qid, "choice"),
                            "confidence": _spread(raws, qid, "confidence")}
    return out


@server.tool(description=(
    "Score a state on an ordered rubric. Returns the expected level index, the probability "
    "of each level, and the model's confidence. Level order is semantic: level 0 is the "
    "lowest."))
def jev_score(state: Union[str, Dict[str, Any], List[Any]],
              levels: List[str],
              question: Optional[str] = None,
              question_id: Optional[str] = None,
              model: Optional[str] = None,
              repeat: int = 1) -> Dict[str, Any]:
    """Args:
        state: Text or JSON describing what is being scored.
        levels: Rubric levels in ascending order; index 0 is the lowest level.
        question: The scoring question, verbatim. Omit to use a frozen question_id.
        question_id: Id in the frozen registry (e.g. 'triage.urgency').
        model: 'english' | 'multilingual' | 'typed-decisions'; omit to auto-route.
        repeat: Run the identical call N times (1-5) to measure run-to-run spread.
    """
    if not levels or not all(isinstance(l, str) and l.strip() for l in levels):
        raise LayaToolError("levels must be a non-empty list of non-empty strings")
    if len(levels) < 2:
        raise LayaToolError("levels needs at least two levels; one level cannot be scored")
    model = _normalise_model(model)
    qid = "score"
    wording = _resolve_wording(question, question_id, "triage.urgency")
    payload = {"state": state,
               "questions": {qid: {"type": "score", "instructions": wording["text"],
                                   "criteria": list(levels)}}}
    if model:
        payload["model"] = model
    raws = _repeat(payload, repeat)
    answer = _extract(raws[0], qid)
    out = _envelope("jev_score", qid, answer, wording, model, raws[0])
    if repeat > 1:
        out["stability"] = {"score": _spread(raws, qid, "score"),
                            "confidence": _spread(raws, qid, "confidence")}
    return out


@server.tool(description=(
    "Ask several typed questions about one state in a single call. Tasks run strictly one "
    "after another on purpose: laya holds two of three checkpoints in memory on a box with "
    "no swap, so parallel calls would evict and reload weights."))
def jev_evaluate(tasks: List[Dict[str, Any]],
                 state: Optional[Union[str, Dict[str, Any], List[Any]]] = None,
                 model: Optional[str] = None) -> Dict[str, Any]:
    """Args:
        tasks: One dict per question. Each needs 'type' ('noul' | 'choice' | 'score') and
            either 'question' or 'question_id'. 'choice' tasks also need 'options',
            'score' tasks need 'levels'. An optional 'id' names the result.
        state: Default state for every task that does not carry its own 'state'.
        model: 'english' | 'multilingual' | 'typed-decisions'; omit to auto-route.
    """
    if not tasks:
        raise LayaToolError("tasks must be a non-empty list")
    model = _normalise_model(model)

    results: List[Dict[str, Any]] = []
    for index, task in enumerate(tasks):
        if not isinstance(task, dict):
            raise LayaToolError(f"task {index} is {type(task).__name__}, expected an object")
        qtype = str(task.get("type", "")).strip().lower()
        if qtype not in ("noul", "choice", "score"):
            raise LayaToolError(f"task {index} has type {task.get('type')!r}; use 'noul', 'choice' or 'score'")
        task_state = task.get("state", state)
        if task_state is None:
            raise LayaToolError(f"task {index} has no 'state' and no default 'state' was passed")
        qid = str(task.get("id") or f"q{index}")

        fallback = {"noul": "review.architect_first", "choice": "triage.category",
                    "score": "triage.urgency"}[qtype]
        wording = _resolve_wording(task.get("question"), task.get("question_id"), fallback)
        definition: Dict[str, Any] = {"type": qtype, "instructions": wording["text"]}
        if qtype == "choice":
            options = task.get("options")
            if not options or not isinstance(options, list) or len(options) < 2:
                raise LayaToolError(f"task {index} is a choice question and needs 'options' "
                                    "with at least two labels")
            definition["criteria"] = list(options)
        elif qtype == "score":
            levels = task.get("levels")
            if not levels or not isinstance(levels, list) or len(levels) < 2:
                raise LayaToolError(f"task {index} is a score question and needs 'levels' "
                                    "with at least two levels")
            definition["criteria"] = list(levels)

        payload: Dict[str, Any] = {"state": task_state, "questions": {qid: definition}}
        if model:
            payload["model"] = model
        # Serial by construction: one blocking call per task, in list order.
        raw = _post_predict(payload)
        results.append(_envelope("jev_evaluate", qid, _extract(raw, qid), wording, model, raw))

    return {"tool": "jev_evaluate", "count": len(results), "results": results,
            "service": {"base_url": BASE_URL, "endpoint": "/predict",
                        "registry_version": REGISTRY_VERSION,
                        "note": "tasks executed serially to keep the checkpoint set resident"}}


@server.tool(description=(
    "Check that the laya decision service is reachable and warm. Use before trusting a "
    "batch of decisions, and to distinguish 'no signal' from 'service down'."))
def jev_health() -> Dict[str, Any]:
    """No arguments. Returns readiness plus which checkpoints are resident."""
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise LayaToolError(
            f"laya decision service is unreachable at {HEALTH_URL} ({exc.reason}). "
            "Check `docker ps --filter name=laya`; a cold container needs about 60s of warmup."
        ) from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise LayaToolError(f"laya /health did not return usable JSON: {exc!r}") from exc
    return {"reachable": True, "status": payload.get("status"),
            "resident_checkpoints": payload.get("resident_checkpoints"),
            "default_model": payload.get("default_model"),
            "warmup_seconds": payload.get("warmup_seconds"),
            "requests_served": payload.get("requests"),
            "offline_mode": payload.get("offline_mode"),
            "registry_version": REGISTRY_VERSION,
            "base_url": BASE_URL}


def main() -> None:
    server.run(transport="stdio")


if __name__ == "__main__":
    main()
