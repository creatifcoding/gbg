# F677 Notes — E2E Harness, Approval Gates, and Skill Evolution

## Research grounding (before implementation)

- Jido persistence facade + invariants (`Jido.Persist`):
  - https://github.com/agentjido/jido/blob/main/lib/jido/persist.ex
- Jido agent callback contract (`checkpoint/2`, `restore/2`):
  - https://github.com/agentjido/jido/blob/main/lib/jido/agent.ex
- Effect Schema JSON Schema generation behavior:
  - https://effect.website/docs/schema/json-schema/

## Assumption challenge

### Initial assumption
"A single `bun run` command is enough proof without deterministic artifact checks."

### What we observed
A one-command runner is useful, but without artifact fingerprint checks, schema generation drift could pass unnoticed.

### Revised understanding
Harness must include deterministic schema fingerprint validation, not just command pass/fail.

## Current implementation outcome

- Added harness script:
  - `src/lib/maidens/domains/contracts/order/scripts/contracts-e2e-order.sh`
- Added package script:
  - `bun run contracts:e2e:order`
- Added NX target:
  - `nx run tmnl:contracts:e2e:order`
- Harness gates:
  1. TS contracts test
  2. Schema generation + deterministic fingerprint re-run check
  3. Elixir runtime tests
  4. Strategy-boundary suite (`SignalFsm` + boundary directives)
  5. Explicit persistence test suite
  6. Negative-gate assertions (`--only negative_gate`)
- Added machine-readable JSON report output:
  - `src/lib/maidens/domains/contracts/order/reports/order-e2e-<runId>.json`
  - `src/lib/maidens/domains/contracts/order/reports/latest.json`
  - per-gate logs under `src/lib/maidens/domains/contracts/order/reports/logs/<runId>/`
- Added explicit negative-gate stage:
  - `mix test test/order_validator_test.exs --only negative_gate`
  - confirms schema-valid/FSM-illegal rejection behaviors stay enforced
- Added CI annotation summary output:
  - `[order-e2e][ci-summary] ...`
  - `::notice title=order-e2e::...`

## Remaining expansion

- Optional: emit separate `summary.json` micro-artifact for external dashboards that cannot parse full run report.
