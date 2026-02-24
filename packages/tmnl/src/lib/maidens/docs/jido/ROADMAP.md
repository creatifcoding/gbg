# Maidens × Jido Roadmap

This roadmap maps the current Jido contract-runtime exploration to active feature tracks.

## Active Feature Tracks

## F674 — Order Contract Pipeline + Exonerate Compatibility Push
**Goal:** Stabilize TS canonical contract generation and maximize validator compatibility.

### Scope
- Effect Schema remains canonical (`order`, `transition`, `agent-state`).
- JSON Schema artifact generation remains deterministic.
- Push Exonerate compatibility; retain `ex_json_schema` fallback until proven.

### Progress snapshot
- ✅ Added canonical `OrderId` pattern (slug + UUIDv4) in TS contract schema.
- ✅ Added TS constructors: `makeOrderId`, `makeOrder`, `makeTransitionEvent`.
- ✅ Added Elixir constructors: `Maiden.OrderRuntime.OrderId.make/2`, `Maiden.OrderRuntime.OrderFactory.new_order/1`, `new_transition_event/1`.
- ✅ Updated validator/persistence tests to use generated OrderIds (no raw hardcoded IDs).
- ✅ Regenerated schemas now include `OrderId.pattern`; E2E gates pass with deterministic fingerprint update.
- ⏳ Remaining: Exonerate compatibility decision and reproducible proof matrix.

### Done when
- Contract artifacts generate deterministically.
- Validator behavior is evidence-backed (Exonerate restored or explicitly blocked with reproducible proof).
- TS + Elixir validator tests pass.

---

## F675 — Jido Runtime Wiring (Signals + Sensors) with Explicit Transition Actions
**Goal:** Wire true runtime ingress to explicit transition actions under FSM strategy.

### Scope
- Signal ingress wired through preflight to `cmd/2`.
- Sensor ingress wired to same preflight/action path.
- Explicit per-transition actions (confirm/ship/deliver/cancel).

### Progress snapshot
- ✅ Explicit per-transition actions implemented.
- ✅ Runtime `RunInstruction` resolution path tested (`apply_signal_sync/4`).
- ✅ Sensor ingress preflight lane implemented (`TransitionSensor`) and validated through AgentServer integration tests.
- ✅ Sensor-path coverage includes shipped/delivered/cancelled transitions plus rejection envelope.
- ✅ Rejection envelope routed to dedicated observer action channel (`order.transition.rejected`).
- ✅ Added signal-first strategy module (`Maiden.OrderRuntime.Strategies.SignalFsm`) delegating FSM execution while emitting boundary directives for persistence/job lanes.
- ✅ Added strategy-level routes (`order.runtime.strategy.tick`, `order.runtime.persist.flush`) with high priority for future heavy-signal orchestration.
- ✅ Trace-correlation assertions added at telemetry start-event level.
- ⏳ Remaining: deepen trace assertions across full directive stop/result lifecycle.

### Done when
- Signal/sensor events flow through preflight → action → FSM strategy.
- Illegal payloads and illegal adjacency transitions are blocked before mutation.
- Runtime tests verify full loop.

---

## F676 — Snapshot Persistence for Order Agent Runtime
**Goal:** Persist and restore order runtime state safely.

### Scope
- Research-backed persistence design (Jido + ecosystem).
- Snapshot + restore path for agent + strategy state.
- Recovery behavior tested across restart.

### Progress snapshot
- ✅ `Maiden.OrderRuntime.snapshot/2`, `thaw/2`, and `delete_snapshot/2` wrappers added over `Jido.Persist`.
- ✅ `Maiden.OrderRuntime.Agent.checkpoint/2` and `restore/2` implemented for explicit serialization/deserialization.
- ✅ Restore path validates contract state through `preflight_agent_state/2` before rehydration.
- ✅ Persistence tests cover roundtrip success, invalid checkpoint rejection, and delete semantics.
- ✅ Thread-backed persistence scenario added (`__thread__` pointer + rehydrate assertions).
- ✅ Restart continuity harness added (`snapshot -> thaw -> AgentServer -> sensor transition`).
- ⏳ Remaining: optional recovery chaos tests (duplicate thaw, partial checkpoint corruption matrix).

### Done when
- State survives restart with continuity guarantees.
- Failure modes are explicit and tested.

---

## F677 — E2E Harness, Approval Gates, and Skill Evolution
**Goal:** Prove full vertical slice and lock operational discipline.

### Scope
- Single-command E2E harness for generate → run → validate.
- Approval gates enforced from alignment questionnaire.
- Skill + learnings updated with evidence.

### Progress snapshot
- ✅ Added one-command harness: `bun run contracts:e2e:order`.
- ✅ Harness enforces deterministic schema generation via fingerprint stability check.
- ✅ Harness gates cover TS contracts, schema generation, Elixir runtime tests, strategy-boundary suite, and persistence suite.
- ✅ NX target added: `nx run tmnl:contracts:e2e:order`.
- ✅ Machine-readable JSON report artifact added (run-scoped + latest pointer + per-gate logs).
- ✅ Negative-gate assertions stage added (`--only negative_gate`).
- ✅ CI annotation summary format added (`[order-e2e][ci-summary]` + `::notice ...`).
- ⏳ Remaining: optional compact summary artifact for external dashboards.

### Done when
- E2E legal path passes.
- Schema-valid/FSM-illegal path fails correctly.
- Docs and skill are current and cited.

---

## IIOT Entity Expansion Seed

- Initial inventory captured in `IIOT_ENTITY_PORTING_INVENTORY.md`.
- Model-first source map captured in `IIOT_MODEL_SOURCE_MAP.md`.
- Source currently shows 14 entity modules (12 in `EntityHandlersLayer`); target "13" set requires explicit lock.

## Dependency Order

1. **F674** (contracts + validator compatibility baseline)
2. **F675** (runtime wiring on stable contracts)
3. **F676** (persistence on wired runtime)
4. **F677** (final harness + gates + documentation hardening)

---

## Global Acceptance Gates (from approval)

- TS contract tests pass.
- Schema generation is deterministic.
- Elixir unit/integration tests pass.
- Signal → `cmd/2` flow verified.
- Schema-valid but FSM-illegal transitions are rejected.
- Maidens `.pi` skill + learnings updated.

---

## Research Discipline (mandatory per feature)

Each feature must include:
- Context7 lookup notes.
- DeepWiki lookup notes.
- Hexdocs citations.
- Effect docs citations.
- Explicit assumption-challenge section before implementation.
