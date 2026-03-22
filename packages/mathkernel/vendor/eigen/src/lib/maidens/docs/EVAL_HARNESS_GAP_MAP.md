# Eval Harness — Gap Map & Dependency Architecture

> Codebase audit results: what Jido provides, what we build, what we bring in.

## Key Finding

Jido's ReAct strategy is **significantly more instrumented than expected**. The `request_traces` system stores up to 2,000 events per request. The strategy snapshot exposes `iteration`, `usage` (token counts), `tool_calls` (with arguments and results), `duration_ms`, and the full `conversation` history. Dynamic `register_tool`/`unregister_tool` signals allow runtime tool swapping.

**We don't need to build an instrumentation layer. Jido already is one.**

## What Jido Provides (Free)

| Capability | Source | What We Get |
|---|---|---|
| **Request traces** | `ReAct.Strategy` → `request_traces` | Up to 2,000 events per request. Kinds: `request_started`, `llm_completed`, `tool_started`, `tool_completed`, `request_completed`, etc. |
| **Token counting** | `Signal.Usage` (`ai.usage`) | `input_tokens`, `output_tokens`, `total_tokens`, `model`, `duration_ms`. Accumulated across iterations. |
| **Tool call capture** | `ReAct.Strategy` → `pending_tool_calls` | Each call: `id`, `name`, `arguments` (map), `result`. In snapshot `details.tool_calls`. |
| **Iteration count** | `ReAct.Strategy` → `state[:iteration]` | Monotonically increasing per request. Tracks Thought→Act→Observe cycles. |
| **Timing** | `ReAct.Strategy` → `started_at`, `duration_ms` | Monotonic ms. Per-event timestamps in trace. |
| **Dynamic tool reg** | `register_tool` / `unregister_tool` signals | Runtime tool swapping without recompilation. Rebuilds `reqllm_tools`. |
| **Strategy snapshot** | `AgentServer.status/1` | Full readout: status, result, iteration, usage, tool_calls, conversation, available_tools, trace_summary, model. |

### Observation extraction pattern

```elixir
# After ask_sync completes, before stopping the server:
{:ok, status} = Jido.AgentServer.status(pid)
snapshot = status.snapshot

# Direct access to everything we need:
snapshot.details.iteration        # → 2
snapshot.details.usage            # → %{input_tokens: 1893, output_tokens: 412, ...}
snapshot.details.tool_calls       # → [%{name: "semantic_search", arguments: %{...}, result: ...}]
snapshot.details.duration_ms      # → 3450
snapshot.details.available_tools  # → ["semantic_search", "summarize", "find_connections"]
snapshot.details.conversation     # → full message history
snapshot.details.trace_summary    # → %{"req_xxx" => %{events: 12, truncated?: false}}
```

## What We Build (8 components)

| # | Component | Path | Description |
|---|---|---|---|
| 1 | **ActionVariant macro** | `lib/eval/action_variant.ex` | `use ActionVariant, base: SemanticSearch, variant: :rich, description: "..."`. Delegates `schema/0` and `run/2` to base. Overrides `name/0` and `description/0`. |
| 2 | **Observation struct** | `lib/eval/observation.ex` | Maps snapshot data to eval schema via `from_snapshot/3`. |
| 3 | **Corpus loader** | `lib/eval/corpus.ex` | Reads `eval/corpus/*.json`, groups by stratum. Uses Jason. |
| 4 | **Matchers** | `lib/eval/matchers.ex` | `contains_keyword`, `any_integer`, `sequence_match`, `should_not_call`. |
| 5 | **Harness runner** | `lib/mix/tasks/eval.run.ex` | Mix task with Flow pipeline. Budget cap, dry-run, concurrency control. |
| 6 | **Budget calculator** | `lib/eval/budget.ex` | Pre-run cost estimator. Surfaces: calls, time, tokens, API cost, effective RPM. |
| 7 | **Judge module** | `lib/eval/judge.ex` | Post-processing: ReqLLM direct calls for quality scoring. |
| 8 | **Analysis module** | `lib/eval/analysis.ex` | Explorer DataFrame → conditional metrics, CSV export, VegaLite heatmaps. |

## External Dependencies

All scoped to `:dev` and `:test` — zero production overhead.

| Package | Version | Purpose |
|---|---|---|
| **Explorer** | `~> 0.10` | DataFrame analysis, NDJSON read/write, group-by, pivot. Rust-backed (Polars). |
| **Flow** | `~> 1.2` | GenStage-based parallel execution. Backpressure-aware. Budget via `max_demand`. |
| **VegaLite** | `~> 0.1` | Chart/heatmap generation from DataFrames. Precision×Variant heatmaps. Optional. |
| **NimbleCSV** | `~> 1.2` | Dashbitco CSV export. Compile-time parser, zero runtime deps. |

### Rejected

- **Broadway** — Overkill for batch eval. Flow provides parallelism + backpressure.
- **Statistex** — Not needed at v1. Visual heatmap inspection sufficient.
- **Benchee** — LLM calls have ~3s variance. `:timer.tc` + Jido's `duration_ms` is enough.

### mix.exs patch

```elixir
# In deps/0 — add after {:jason, "~> 1.4"}
{:explorer, "~> 0.10", only: [:dev, :test]},
{:flow, "~> 1.2", only: [:dev, :test]},
{:vega_lite, "~> 0.1", only: [:dev, :test]},
{:nimble_csv, "~> 1.2", only: [:dev, :test]}
```

## Architecture — Data Flow

```
mix eval.run
├── Corpus/*.json → Flow pipeline → NDJSON (observations)
│   Per query:
│   1. Boot AgentServer
│   2. register_tool(variant modules)
│   3. ask_sync(query)
│   4. status() → snapshot
│   5. Matcher → gold check
│   6. Build Observation
│   7. Write NDJSON line
│   8. Stop AgentServer

mix eval.judge (optional)
├── NDJSON → ReqLLM direct → NDJSON (quality scores backfilled)

mix eval.analyze
├── NDJSON → Explorer DataFrame → Conditional metrics
│                               → CSV export
│                               → VegaLite heatmaps
```

### AgentServer lifecycle per query

Each query gets its own AgentServer instance. This isolates conversation state. Flow manages concurrency — `max_demand` controls how many AgentServers are alive simultaneously.

## Budget Model

| Dimension | Full Matrix | Diagonal Slice |
|---|---|---|
| Total calls | 75 × 5 × 4 = 1,500 | 75 × 1 × 1 = 75 |
| Est. time (@5 concurrency) | ~15 min | ~45s |
| Input tokens | ~3.0M | ~150K |
| Output tokens | ~600K | ~30K |
| API cost (Sonnet 4) | ~$18 | ~$1 |
| Judge pass (20% subsample) | ~$3 | ~$0.15 |
| **Total** | **~$21** | **~$1.15** |

### Mix task CLI

```bash
# Dry run — compute budget without executing
mix eval.run --dry-run --variant all --composition all

# Budget-capped run
mix eval.run --max-cost 5.00 --variant lean,rich --composition core_3

# Diagonal slice — cheapest meaningful signal
mix eval.run --diagonal --concurrency 3

# Full matrix
mix eval.run --all --concurrency 5 --max-cost 25.00
```

### Rate limit safety

Anthropic Tier 2: ~4,000 RPM, 400K input TPM. At concurrency=5 with 3s avg latency, we sustain ~100 RPM — well under limits. Flow's `max_demand` caps in-flight requests naturally. No explicit rate limiter needed.

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Analysis format | Explorer (NDJSON native) + NimbleCSV | DataFrame analysis in Elixir. Self-contained. |
| Parallelism | Flow (GenStage) | Backpressure-aware. Budget parameterization via `max_demand`. |
| Tool variants | Parameterized macro | `use ActionVariant, base: ..., variant: ...`. 15 one-liner files, shared logic. |
| Deps scope | `:dev` + `:test` only | Zero production overhead. |

## References

- [Tool Effectivity Eval Harness — Instrument Design](TOOL_EVAL_HARNESS.md)
- [Gap Map Visual](~/.agents/diagrams/maidens/eval-harness-gap-map.html)
- [Tool Parameter Metrics Visual](~/.agents/diagrams/maidens/tool-parameter-metrics.html)
