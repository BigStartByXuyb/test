# laya-decisions

Local `jev_*` decision tools for Hermes, backed by the laya System One model on
`10.101.0.62:8095`. Zero cost, zero egress.

An Agent Plugins v1 portable package: one skill plus one stdio MCP server. Installs
disabled (the v1 contract); enable it after install.

```bash
hermes plugins install "BigStartByXuyb/test#hermes/laya-decisions"
hermes plugins enable laya-decisions
```

## Why the names here are short

Hermes folds a portable plugin's name into the MCP server key
(`agent-plugin-<plugin>-<sha8>__<mcp.json key>`), and OpenAI-compatible providers reject
function names longer than 64 characters. Past that limit hermes clamps the name to
`mcp__…_<hash8>`, and the tool stops being called `jev_check` on the wire — which defeats
the point of mirroring the community `jev_*` names.

The budget is `5 + len(namespace) + 2 + len(mcp key) + 2 + len(tool name) ≤ 64`, and the
namespace alone is `agent_plugin_<plugin>_<sha8>` (22 + len(plugin)). Hence the terse
plugin name `laya-decisions` and server key `laya`, which keeps the longest tool
(`jev_evaluate`) at 61 characters:

```
mcp__agent_plugin_laya_decisions_<sha8>__laya__jev_evaluate   61 chars, not clamped
```

Renaming the plugin or the server key longer will silently reintroduce the hashed names.
Check with `hermes mcp test laya` after any change.

## Why the tool names are `jev_*`

The catalog's `jev-typesafe` plugin already claims `jev_check` / `jev_route` / `jev_score` /
`jev_evaluate`. This package deliberately reuses those names so a call site can be moved
between a hosted Jev backend and this local one without rewriting anything.

It is **not** a reimplementation of `hermes-jev` or `jev-typesafe`, and it does not
replace them by being installed: those send your state and question to
`api.typesafe.ai` / OpenRouter on every call, and `hermes-jev` bills per turn. This one
talks to a container on this host and sends nothing anywhere. Install it *instead of*
them, not alongside — the tool names collide.

## Layout

| Path | What |
| --- | --- |
| `plugin.json` | Agent Plugins v1 manifest |
| `mcp.json` | declares the `laya` stdio server |
| `bin/laya-mcp` | launcher; picks an interpreter that can `import mcp.server.mcpserver` |
| `server/laya_decisions_server.py` | the MCP server |
| `prompts/frozen-questions.v1.json` | versioned, verbatim question wording |
| `skills/laya-decisions/SKILL.md` | how an agent should use the signal |

## Configuration

| Env | Default | Meaning |
| --- | --- | --- |
| `LAYA_BASE_URL` | `http://127.0.0.1:8095` | Decision service base URL. Set in `mcp.json`. |
| `LAYA_TIMEOUT_S` | `180` | Per-request timeout. Cold start needs ~60 s. |
| `LAYA_MCP_PYTHON` | auto-probed | Interpreter that has the `mcp` package. |
| `LAYA_QUESTION_REGISTRY` | `prompts/frozen-questions.v1.json` | Frozen wording file. |

## Operating notes

- **Calls are serialised behind one lock, on purpose.** The service keeps at most two of
  three checkpoints resident (~2 GB each) on a host with no swap. Concurrent calls that
  alternate languages evict and reload weights. `jev_evaluate` runs its tasks one at a
  time for the same reason — do not "optimise" it into a thread pool.
- **An unreachable service is an error, never an empty value.** Reading "no signal" as
  "no" is how a gate silently stops working when its dependency dies.
- **Question wording is part of the interface.** Identical calls are bit-identical;
  paraphrasing moves the probability by up to 0.32. Freeze and version the wording, and
  keep `wording.sha256` alongside any recorded decision.

## Verified behaviour

See the AI-43 comment thread for the measurements: identical-repeat spread, paraphrase
spread, cross-checkpoint spread, and the pilot comparison against the deciding LLM.
