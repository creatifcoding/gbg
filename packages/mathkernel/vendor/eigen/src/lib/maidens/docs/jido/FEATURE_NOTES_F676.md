# F676 Notes — Snapshot Persistence for Order Agent Runtime

## Research grounding (before implementation)

- Jido persistence implementation (`Jido.Persist`) and invariants:
  - https://github.com/agentjido/jido/blob/main/lib/jido/persist.ex
- Jido agent callback surface (`checkpoint/2`, `restore/2`):
  - https://github.com/agentjido/jido/blob/main/lib/jido/agent.ex
- Jido storage adapters (`Jido.Storage.ETS`, `Jido.Storage.File`):
  - https://github.com/agentjido/jido/blob/main/lib/jido/storage/ets.ex
  - https://github.com/agentjido/jido/blob/main/lib/jido/storage/file.ex
- Effect JSON Schema generation contract (canonical TS -> JSON Schema):
  - https://effect.website/docs/schema/json-schema/

## Assumption challenge

### Initial assumption
"Default Jido persistence is enough; custom agent checkpoint/restore callbacks are unnecessary for this lane."

### What we observed
`Jido.Persist` correctly coordinates checkpoint/thaw, but custom callbacks are the right boundary to enforce domain-specific restore validation and state shaping before rehydration.

### Revised understanding
Use custom `checkpoint/2` + `restore/2` in `Maiden.OrderRuntime.Agent` to preserve strategy continuity while validating restored order-state contract pre-runtime.

## Current implementation outcome

- Added runtime persistence API in `Maiden.OrderRuntime`:
  - `snapshot/2`
  - `thaw/2`
  - `delete_snapshot/2`
  - `storage/1`
- Added custom checkpoint/restore callbacks in `Maiden.OrderRuntime.Agent`:
  - persists contract fields + `:__strategy__`
  - validates restored contract payload using `preflight_agent_state/2`
- Added persistence tests:
  - roundtrip restore keeps state continuity
  - invalid checkpoint is rejected
  - snapshot deletion returns `:not_found` on thaw

## Remaining expansion

- Optional chaos matrix:
  - duplicate thaw race
  - partial checkpoint corruption + deterministic failure classification
  - storage adapter parity checks (ETS vs file)
