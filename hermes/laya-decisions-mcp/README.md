# laya-decisions-mcp

Local `jev_*` decision tools for Hermes, backed by the laya System One model on
`10.101.0.62:8095`. Zero cost, zero egress.

An Agent Plugins v1 portable package: one skill plus one stdio MCP server. Installs
disabled (the v1 contract); enable it after install.

```bash
hermes plugins install "BigStartByXuyb/test#hermes/laya-decisions-mcp"
hermes plugins enable laya-decisions-mcp
hermes mcp list            # laya-decisions should appear, sourced from the plugin
```

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
| `mcp.json` | declares the `laya-decisions` stdio server |
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
