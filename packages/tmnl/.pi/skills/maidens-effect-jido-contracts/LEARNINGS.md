# Maidens Effect↔Jido Contract Learnings (Evolving)

## 2026-02-23

### 1) Effect JSON Schema output vs Elixir validator expectations

- Effect `JSONSchema.make` generation can emit `$defs` + top-level `$ref` root patterns.
- For our Elixir validation pipeline, draft-07-compatible normalization (`$defs` → `definitions`) and top-level ref inlining are currently applied in core tooling.

### 2) Exonerate compatibility posture

- Exonerate is preferred in principle (compile-time generation, performance), but generated schemas in this spike still hit compatibility edges.
- Current runtime validator path is `ex_json_schema` until Exonerate normalization is finalized.

### 3) JSON Schema defaults

- `default` remains annotation-only; never treat it as validation behavior.

### 4) Jido integration boundary

- External payloads should be preflighted (JSON Schema + FSM legality) before transition-driven command dispatch to `cmd/2`.
- FSM transitions in runtime contract must mirror Jido strategy transitions to avoid divergence.

### 5) Jido schema contract layering (from hexdocs)

- Jido Agent `schema` is a runtime state schema (NimbleOptions or Zoi), and `validate/2` validates agent state.
- `cmd/2` returns `{agent, directives}` and remains pure; directives are runtime effect descriptions.
- Contract pipeline should be:
  1. external payload preflight (`ex_json_schema` / Exonerate-ready)
  2. FSM legality preflight
  3. Jido `cmd/2` execution under configured strategy (`Jido.Agent.Strategy.FSM`)

### 6) FSM strategy execution nuance

- With `Jido.Agent.Strategy.FSM`, `cmd/2` commonly emits `%Directive.RunInstruction{}` and sets strategy status to `processing`; domain state mutation is finalized when runtime executes instruction + strategy result handling path completes.
- Unit tests at pure `cmd/2` layer should assert directives and strategy machine state; full mutation assertions belong to runtime-integrated tests.

### 7) Parameter-shape boundary at action execution

- Transition payloads may arrive with string keys (`%{"order_id" => ...}`), while Jido action input validation/schema expects atom-key params.
- Runtime-safe path: normalize transition payload keys before `cmd/2`, and keep action-side access tolerant to both atom/string keys.
- Added `apply_signal_sync/4` + `resolve_runtime_directives/2` helper for deterministic runtime-integrated tests of `%Directive.RunInstruction{}` pipelines.

### 8) Sensor preflight gate before runtime signal emission

- `Jido.Sensor.Runtime` can emit directly to agent servers (`agent_ref: pid`) via `{:emit, signal}` directives.
- To preserve contract-first safety, sensor should run transition preflight before emitting transition signal.
- In this lane, `TransitionSensor` enforces `OrderValidator + FSM` legality, preventing illegal transitions from entering runtime queue.
- Optional rejection envelope (`order.transition.rejected`) can be emitted for observability without mutating runtime state.

### 9) Jido instance boot requirement in tests

- `Jido.AgentServer` defaults to `jido: Jido` and expects corresponding registry/supervisors to exist.
- In tests/scripts, explicitly boot an instance (`Jido.start()`) and pass `jido: Jido.default_instance()` to avoid `unknown registry: Jido.Registry` failures.

### 10) Persistence boundary: custom restore should validate contract state

- `Jido.Persist` already enforces checkpoint/thread invariants, but domain modules should still validate restored payloads before rehydrating runtime state.
- For Maidens order runtime, custom `restore/2` validates contract fields with `preflight_agent_state/2` and only then merges strategy state.
- Wrapper module (`Maiden.OrderRuntime`) should expose explicit snapshot/thaw API so tests and harnesses can control storage adapter/table deterministically.

### 11) E2E harness must include deterministic artifact proof

- A passing command chain is insufficient for contract pipelines unless schema generation determinism is verified.
- Harness now computes a schema fingerprint across generated order artifacts and asserts stability on re-generation in the same run.
- Keep harness stage order fixed: TS contracts -> generation/determinism -> Elixir runtime -> explicit persistence tests.

### 12) CI usability: persist run-scoped logs + JSON report

- One-command harness should emit machine-readable JSON plus per-gate logs, not just terminal text.
- Current artifact shape: `reports/order-e2e-<runId>.json` + `reports/latest.json` + `reports/logs/<runId>/*`.
- Include gate duration, exit code, and failure signature to reduce triage latency.

### 13) Rejection envelopes should have explicit runtime consumers

- If sensors emit rejection envelopes, add explicit `signal_routes` consumer action (`order.transition.rejected`) to avoid no-route runtime ambiguity.
- Rejection payloads should include trace metadata (`trace_id`, `attempted_signal`, `validator`, `observed_at`) for downstream observability.
- Add telemetry-based correlation assertions (`signal.start` and `directive.start`) in integration tests.

### 14) Negative-gate checks should be first-class harness stages

- Keep schema-valid/FSM-illegal rejection checks as an explicit harness stage (`mix test ... --only negative_gate`).
- Emit CI-friendly summary annotations after harness completion to reduce triage friction.
- Machine-readable report should include negative-gate stage status as a top-level gate result.

### 15) ID contracts need constructors on both sides, not literals in tests

- Enforcing an ID regex without constructor helpers creates test churn and manual drift.
- Add canonical builders in both runtimes:
  - TS: `makeOrderId`, `makeOrder`, `makeTransitionEvent`
  - Elixir: `OrderId.make/2`, `OrderFactory.new_order/1`, `new_transition_event/1`
- Keep TS schema pattern as source of truth; generated JSON Schema propagates the same constraint to Elixir validators.

### 16) Heavy-signal strategy lanes need directive boundaries, not inline side effects

- For Jido-heavy runtime lanes, keep `cmd/2` and strategy execution pure by emitting directives.
- Wrap FSM in a strategy module (`SignalFsm`) that can append domain boundary directives after successful instruction results.
- Route side effects through ports:
  - persistence port (Ash/Ecto adapter)
  - queue port (Oban adapter)
- Default adapters should be no-op to keep unit/integration harness deterministic before infra wiring.

## 2026-02-26

### 17) jido_ai v2.0.0-rc.0 API diverges significantly from DeepWiki-indexed version

- **Symptom**: `Jido.AI.ReActAgent` module does not exist, compile errors
- **Root cause**: DeepWiki indexed an older version of agentjido/jido_ai. The v2.0.0-rc.0 (released on Hex) has a different API surface.
- **Library provenance**: jido_ai 2.0.0-rc.0 on Hex
- **Key divergences**:
  - Macro: `use Jido.AI.Agent` (NOT `use Jido.AI.ReActAgent`)
  - Start: `Jido.AgentServer.start(agent: Module)` (NOT `Jido.start_agent/2`)
  - Action schema: NimbleOptions keyword list in `use Jido.Action, schema: [...]` (NOT JSON Schema map in `schema/0`)
  - Request model: `ask/2,3` → `await/1,2` or `ask_sync/2,3` with `Jido.AI.Request` tracking
  - ReAct architecture: Delegated worker pattern (parent agent → spawned `:react_worker` child) not direct state machine execution
  - Tool adapter: `Jido.AI.ToolAdapter` auto-converts Action schemas to LLM-compatible tool definitions
- **Fix**: Always read vendored deps source code. Use `deps/jido_ai/lib/examples/` as the canonical reference. DeepWiki is useful for architectural overview but unreliable for exact API details.
- **Core tooling update**: SKILL.md and LEARNINGS.md updated with correct patterns.

### 18) Jido.AI.Agent macro provides full request lifecycle

- The `use Jido.AI.Agent` macro generates:
  - `ask/2,3` — async, returns `{:ok, %Request.Handle{}}`
  - `await/1,2` — blocks until request completes
  - `ask_sync/2,3` — convenience sync wrapper
  - `cancel/1,2` — advisory cancellation
  - `on_before_cmd/2` + `on_after_cmd/3` — lifecycle hooks for request state management
- Request tracking is concurrent-safe: multiple in-flight requests tracked by `request_id`
- Worker crash during active request → request marked failed automatically

### 19) Jido.Action schema uses NimbleOptions, NOT JSON Schema

- `use Jido.Action, schema: [field: [type: :string, required: true, doc: "..."]]`
- Supported types: `:string`, `:integer`, `:float`, `:boolean`, `:atom`, `{:list, :string}`, `{:in, [:a, :b]}`, etc.
- The ToolAdapter converts these to JSON Schema for LLM tool definitions automatically
- `run/2` receives `params` as a map with atom keys (validated by NimbleOptions)

### 20) ReAct strategy uses delegated worker pattern in v2.0

- Parent agent receives `"ai.react.query"` signal
- Lazily spawns internal `:react_worker` child (one per parent)
- Worker streams events back to parent via `"ai.react.worker.event"` signals
- Parent applies events to parent state and emits external lifecycle signals
- Single active run enforced (`:reject` busy policy)
- Request trace cap: 2000 events per request

### 21) Model aliases resolve via Jido.AI.resolve_model/1

- `:fast` → typically resolves to `anthropic:claude-haiku-4-5`
- `:capable` → typically resolves to `anthropic:claude-sonnet-4`
- `:planning` → typically resolves to `anthropic:claude-sonnet-4`
- Config via `config :jido_ai, :models, anthropic: [api_key: ...]`
- API key from env: `System.get_env("ANTHROPIC_API_KEY")`

### 22) ReqLLM Anthropic provider does NOT support OAuth tokens natively

- **Symptom**: `401 invalid x-api-key` when using Pi's OAuth token (`sk-ant-oat...`)
- **Root cause**: ReqLLM's `ReqLLM.Providers.Anthropic` hardcodes `x-api-key` header in:
  - `attach/3` (line 281, Req pipeline for non-streaming requests)
  - `build_request_headers/2` (line 352, used by `attach_stream/4` for Finch streaming)
- **OAuth tokens require different headers**:
  - `Authorization: Bearer <token>` (not `x-api-key: <token>`)
  - `anthropic-beta: oauth-2025-04-20` (additional beta header)
- **Fix**: Created `OAuthAnthropic` provider that:
  1. Implements `ReqLLM.Provider` behaviour with `id: :anthropic`
  2. Delegates ALL callbacks to upstream `ReqLLM.Providers.Anthropic`
  3. Post-processes `attach/3` result: transforms Req.Request headers
  4. Post-processes `attach_stream/4` result: transforms Finch.Request headers
  5. Registered via `ReqLLM.Providers.register/1` which overwrites `:anthropic` in the persistent_term registry
- **Location**: `lib/maiden/maiden_melanie/providers/oauth_anthropic.ex`
- **Provenance**: ReqLLM provider, Pi AuthStorage, Anthropic OAuth API

### 23) Pi AuthStorage credential resolution chain

- **Location**: `~/.pi/agent/auth.json`
- **Structure**: `{ "anthropic": { "type": "oauth", "access": "sk-ant-oat...", "refresh": "...", "expires": <ms_epoch> } }`
- **Token lifecycle**: OAuth tokens have TTL (~24h), stored as millisecond epoch in `expires` field
- **Resolution precedence in AuthBridge**:
  1. `ANTHROPIC_API_KEY` env var (non-empty)
  2. Pi AuthStorage (`~/.pi/agent/auth.json` → `anthropic.access`)
- **AuthBridge startup sequence**:
  1. Resolve key
  2. Validate expiry (warn if <5min, error if expired)
  3. Store in ReqLLM config (`Application.put_env(:req_llm, :anthropic_api_key, key)`)
  4. If OAuth token: register `OAuthAnthropic` provider
- **Location**: `lib/maiden/maiden_melanie/auth_bridge.ex`

### 24) ReqLLM provider registry is mutable via persistent_term

- `ReqLLM.Providers` stores provider_id → module mapping in `:persistent_term`
- `ReqLLM.Providers.register/1` validates the module implements `ReqLLM.Provider` behaviour, extracts `provider_id/0`, then overwrites the registry entry
- This is the sanctioned extension point — no monkeypatching required
- Provider modules must `use ReqLLM.Provider, id: :atom, default_base_url: "...", default_env_key: "..."`
- The `id:` field determines which registry slot the module occupies
- Two modules with same `id:` = last one registered wins

## Update Protocol

When new issues appear, append:

- **symptom**
- **root cause**
- **library provenance** (Effect / JSON Schema / Elixir validator / Jido)
- **fix or mitigation**
- **whether core tooling should be updated**
