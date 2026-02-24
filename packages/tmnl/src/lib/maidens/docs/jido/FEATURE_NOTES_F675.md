# F675 Notes — Jido Runtime Wiring (Signals + Sensors) with Explicit Transition Actions

## Research grounding (before implementation)

- Jido Agent `cmd/2` contract and state schema/validate docs:
  - https://hexdocs.pm/jido/Jido.Agent.html
- Agents guide (`cmd/2`, hooks, schema formats):
  - https://hexdocs.pm/jido/agents.html
- Strategies guide (FSM emits runtime directives):
  - https://hexdocs.pm/jido/strategies.html
- Core loop (Signal -> Action -> cmd/2 -> directives):
  - https://hexdocs.pm/jido/core-loop.html

## Assumption challenge

### Initial assumption
"Calling `Agent.cmd/2` with FSM strategy directly executes transition actions and mutates domain state in-memory."

### What we observed
With `Jido.Agent.Strategy.FSM`, `cmd/2` returned `%Jido.Agent.Directive.RunInstruction{}` and moved strategy machine status to `"processing"`, but did **not** mutate `shipped_at`/`delivered_at` yet.

### Revised understanding
For FSM strategy, the action execution path is runtime-mediated:

1. `cmd/2` schedules instruction via directive (`RunInstruction`)
2. runtime executes instruction
3. result is fed back through strategy

So pure `cmd/2` unit tests should assert emitted directives + strategy machine state, not immediate domain field mutation.

## Sensor assumption challenge

### Initial assumption
"Sensor events can be forwarded to AgentServer directly; preflight at the action layer is enough."

### What we observed
AgentServer routes signal data directly to action params. Without explicit preflight at sensor ingress, invalid adjacency can still enter runtime queue and fail deeper in execution.

### Revised understanding
Sensor ingress should enforce preflight before emitting transition signals. This keeps illegal transitions out of runtime queues and preserves contract-first boundaries.

## Current implementation outcome

- Explicit transition actions added:
  - `ConfirmOrder`, `ShipOrder`, `DeliverOrder`, `CancelOrder`
- Signal-type to action mapping added in agent wrapper
- Preflight (`JSON Schema + FSM legality`) enforced before `cmd/2`
- Tests assert `RunInstruction` emission under FSM strategy
- Runtime-integrated helper implemented:
  - `apply_signal_sync/4`
  - `resolve_runtime_directives/2`
  - executes `%RunInstruction{}` via `Jido.Exec.run/1` and routes result back through `cmd/2`
- Runtime-level test verifies end-to-end state mutation (`shipped_at`) after directive resolution
- Sensor ingress implemented via `TransitionSensor`:
  - incoming event -> preflight -> signal emit
  - legal events emit `order.transition.*` signals
  - optional rejection envelope emits `order.transition.rejected` for preflight failures
  - rejection envelope now includes correlation metadata (`trace_id`, `attempted_signal`, `validator`, `observed_at`)
- Dedicated rejection observer action added:
  - `Maiden.OrderRuntime.Actions.ObserveRejectedTransition`
  - agent `signal_routes` now explicitly routes `order.transition.rejected`
- AgentServer-integrated tests verify sensor -> agent server -> explicit action -> FSM strategy loop for:
  - `confirmed -> shipped`
  - `shipped -> delivered`
  - `confirmed -> cancelled` (with reason)
  - rejection envelope routing with telemetry correlation assertions (`signal.start` ↔ `directive.start`)
- Introduced signal-first strategy wrapper:
  - `Maiden.OrderRuntime.Strategies.SignalFsm`
  - delegates execution semantics to `Jido.Agent.Strategy.FSM`
  - emits boundary directives on successful transition results:
    - `Maiden.OrderRuntime.Directives.PersistTransition`
    - `Maiden.OrderRuntime.Directives.EnqueueTransitionJob`
- Added boundary interfaces for Ash/Ecto + Oban integration:
  - `Maiden.OrderRuntime.Boundaries.OrderStore`
  - `Maiden.OrderRuntime.Boundaries.JobQueue`
  - no-op adapters as default wiring (`NoopOrderStore`, `NoopJobQueue`)
- Added AgentServer directive executors for new boundary directives.

## Pending expansion

- Expand rejection observer action from log-only behavior into pluggable domain event routing.
- Add richer trace assertions for full signal -> directive -> action -> result lifecycle (currently start-event correlation asserted).
