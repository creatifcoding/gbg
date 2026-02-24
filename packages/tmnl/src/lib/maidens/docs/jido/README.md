# Maidens × Jido Surface Area

This document captures **which parts of Jido we are currently exploring** in Maidens, and which parts are explicitly out-of-scope for the current slice.

> This is a scoped vertical slice, not full Jido adoption.

## Current Exploration Slice (in-repo)

### 1) Agent schema contract alignment (explored)
- Jido agent state schema is mirrored by canonical Effect Schema and generated JSON Schema artifacts.
- Files:
  - `src/lib/maidens/domains/contracts/order/ts/order.contract.ts`
  - `src/lib/maidens/domains/contracts/order/schemas/order_agent_state.schema.json`
  - `src/lib/maidens/domains/contracts/order/elixir/lib/maiden/order_runtime/agent.ex`

### 2) cmd/2 boundary preflight (explored)
- External payloads are validated before they should be used to drive command execution.
- Files:
  - `src/lib/maidens/domains/contracts/order/elixir/lib/maiden/order_runtime/validators/order_validator.ex`
  - `src/lib/maidens/domains/contracts/order/elixir/lib/maiden/order_runtime/fsm.ex`

### 3) FSM transition legality (explored)
- Transition adjacency is enforced in code (`allowed?/2`) and aligned with strategy transitions.
- Files:
  - `src/lib/maidens/domains/contracts/order/ts/order.contract.ts`
  - `src/lib/maidens/domains/contracts/order/elixir/lib/maiden/order_runtime/fsm.ex`

### 4) Contract artifact generation (explored)
- Effect Schema → JSON Schema + Mermaid generation pipeline is wired.
- Files:
  - `src/lib/maidens/domains/contracts/order/scripts/gen-order-schemas.ts`
  - `src/lib/maidens/core/contracts/json-schema.codegen.ts`
  - `src/lib/maidens/core/contracts/fsm.ts`

### 5) Explicit transition actions + signal mapping (explored)
- Explicit Jido actions are defined for transition intents (confirm/ship/deliver/cancel).
- Agent-level signal mapping resolves signal type → action module.
- FSM strategy emits `RunInstruction` directives in pure `cmd/2`; runtime resolution path is now covered with helper + tests.
- Files:
  - `src/lib/maidens/domains/contracts/order/elixir/lib/maiden/order_runtime/actions/*.ex`
  - `src/lib/maidens/domains/contracts/order/elixir/lib/maiden/order_runtime/agent.ex`
  - `src/lib/maidens/domains/contracts/order/elixir/test/order_validator_test.exs`

### 6) Sensor ingress preflight lane (explored)
- Transition sensor converts external events into `order.transition.*` signals.
- Sensor runs preflight (`OrderValidator` + FSM adjacency) before emitting to runtime.
- Optional rejection envelope emits `order.transition.rejected` on preflight failure.
- AgentServer integration tests validate sensor -> signal -> action -> FSM instruction resolution loop across shipped/delivered/cancelled paths.
- Files:
  - `src/lib/maidens/domains/contracts/order/elixir/lib/maiden/order_runtime/sensors/transition_sensor.ex`
  - `src/lib/maidens/domains/contracts/order/elixir/test/order_validator_test.exs`

### 7) Snapshot persistence lane (explored)
- Runtime wrapper exposes `snapshot/2`, `thaw/2`, and `delete_snapshot/2` using `Jido.Persist`.
- Agent-level `checkpoint/2` and `restore/2` callbacks enforce explicit state serialization and preflight validation on restore.
- Persistence tests cover roundtrip, invalid checkpoint rejection, and deletion behavior.
- Files:
  - `src/lib/maidens/domains/contracts/order/elixir/lib/maiden/order_runtime.ex`
  - `src/lib/maidens/domains/contracts/order/elixir/lib/maiden/order_runtime/agent.ex`
  - `src/lib/maidens/domains/contracts/order/elixir/test/order_persistence_test.exs`

### 8) E2E gating harness (explored)
- One-command harness executes core approval gates in order:
  1. TS contract tests
  2. JSON schema generation + determinism fingerprint check
  3. Elixir runtime tests (signals/sensors/actions/persistence)
  4. Explicit persistence suite
- Files:
  - `src/lib/maidens/domains/contracts/order/scripts/contracts-e2e-order.sh`
  - `package.json` (`contracts:e2e:order`)
  - `project.json` (`contracts:e2e:order` target)

## Surface Area Map

| Jido Area | Status | Notes |
|---|---|---|
| `Jido.Agent` schema + `validate/2` semantics | Partial | Contract mirrored + preflighted, deeper state hook integration pending |
| `cmd/2` contract boundary | Partial | Preflight methods exist; full runtime ingress chain still being expanded |
| `Jido.Agent.Strategy.FSM` transitions | Partial | Transition map aligned; full runtime signal/sensor action loop still in progress |
| Signal routing | Partial | Agent-level signal type → action mapping implemented; runtime dispatch validation expanding with AgentServer loop tests |
| Sensors | Partial | `TransitionSensor` wired with preflight gating and AgentServer integration test; broader sensor fleet still pending |
| Directives execution patterns | Planned | Beyond basic strategy wiring |
| Plugins | Not started | No plugin bundle exploration yet |
| Persistence (`checkpoint`/`restore`, storage adapters) | Partial | `snapshot/thaw/delete_snapshot` wrappers + checkpoint/restore callbacks + roundtrip tests implemented (ETS default) |
| Multi-agent orchestration | Not started | Out-of-scope in current slice |
| Worker pools / scheduling depth | Not started | Out-of-scope in current slice |
| Observability / tracing depth | Partial | Runtime logs + telemetry correlation assertions (`signal.start` ↔ `directive.start`) present; full lifecycle trace assertions still pending |
| E2E harness / gates | Active | `contracts:e2e:order` enforces TS/schema/Elixir/persistence + negative-gate assertions, with JSON reports and CI summary annotations |

## Explicitly Out-of-Scope (for now)

- Full Jido ecosystem breadth (plugins, complex orchestration, custom strategies beyond current FSM lane)
- Full production hardening across all runtime features
- Non-order domains (until this lane is fully proven)

## Next Expansion Tracks

1. Signal + sensor ingress fully wired into explicit transition actions.
2. Persistence lane (snapshot + restore) for order agent runtime.
3. End-to-end harness proving legal/illegal transition behavior through runtime entry points.
4. Extend same pattern to additional domain contracts once stabilized.

## References (authoritative)

- Jido Agent API: https://hexdocs.pm/jido/Jido.Agent.html
- Jido Agents guide: https://hexdocs.pm/jido/agents.html
- Jido Strategies guide: https://hexdocs.pm/jido/strategies.html
- Jido Core Loop: https://hexdocs.pm/jido/core-loop.html
- Jido repo: https://github.com/agentjido/jido
