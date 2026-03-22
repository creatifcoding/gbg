# JIDO_LANE_PROMOTION_PLAYBOOK

Operational playbook for promoting one lane from scaffold/partial runtime to full Jido runtime.

## 1) Required runtime modules per lane

Create or align the following under:
`src/lib/maidens/domains/contracts/<lane>/elixir/lib/maiden/<lane>_runtime/`

- `agent.ex` -> `use Jido.Agent`
- `sensors/transition_sensor.ex` -> `use Jido.Sensor`
- `actions/*.ex` -> `use Jido.Action` transition actions + rejected observer
- `strategies/signal_fsm.ex` -> `use Jido.Agent.Strategy`, delegate to FSM where applicable
- `directives/persist_transition.ex`
- `directives/enqueue_transition_job.ex`
- `directive_exec.ex` -> `defimpl Jido.AgentServer.DirectiveExec` for both directives
- `<lane>_runtime.ex` -> `snapshot/2`, `thaw/2`, `delete_snapshot/2` via `Jido.Persist`
- `fsm.ex` -> legal transition map parity with TS contract
- `validators/<lane>_validator.ex` -> schema + transition checks

## 2) Runtime wiring rules

- Preflight all transition payloads before mutation (`validator + FSM legality`).
- Keep strategy side-effect-free; strategy emits directives only.
- Execute persistence/queue through boundary adapters (no direct infra coupling).
- Preserve explicit rejection signal path (`<lane>.transition.rejected`).
- Keep checkpoint/restore contract keys explicit.

## 3) Test suite requirements

Under `.../<lane>/elixir/test/` ensure:

- `<lane>_validator_test.exs` (includes `@tag :negative_gate`)
- `<lane>_strategy_boundary_test.exs`
- `<lane>_persistence_test.exs`
- `test_helper.exs`

## 4) E2E gate script requirements

In `scripts/contracts-e2e-<lane>.sh` enforce full six-gate flow:

1. TS contract tests
2. Deterministic schema generation/fingerprint
3. Elixir runtime test suite
4. Strategy boundary test gate
5. Persistence gate
6. Negative gate assertions

Hard rules:
- No reduced gate profile
- No skipped-gate success path
- Report must include per-gate status and logs

## 5) Promotion sequence (per lane)

1. Align transitions with TS contract map.
2. Add/complete Jido runtime modules.
3. Add/complete lane tests.
4. Upgrade e2e script to strict 6 gates.
5. Run until lane is 6/6 with zero skipped.
6. Update lane `reports/latest.json` and evidence bundle.

## 6) Exit criteria per lane

- `mix test` passes in lane elixir dir
- `bun run contracts:e2e:<lane>` passes
- `reports/latest.json` has `status=passed`, `gatesPassed=6`, `gatesSkipped=0`
