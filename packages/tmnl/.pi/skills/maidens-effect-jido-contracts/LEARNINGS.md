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

## Update Protocol

When new issues appear, append:

- **symptom**
- **root cause**
- **library provenance** (Effect / JSON Schema / Elixir validator / Jido)
- **fix or mitigation**
- **whether core tooling should be updated**
