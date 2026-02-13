# CLAUDE Handoff: Hypothesis Lab v1 Scaffold

## Architectural stance

- Atom-as-State is authoritative for runtime UI/application state.
- Effect services orchestrate hook execution, matrix drafting, audit persistence, replay evaluation.
- All domain payloads are Effect Schema-backed.

## Key files

- `v1/schemas.ts` — contracts + audit/replay event schemas
- `v1/errors.ts` — tagged errors
- `v1/runtime.ts` — Layer composition + runtime atom
- `v1/atoms/state.ts` — canonical atoms
- `v1/atoms/ops.ts` — vertical-slice operations
- `v1/services/*` — hook runtime, matrix, audit, replay services
- `v1/builder/*` — TypeScript hook plan builder + compiled schema validator
- `v1/persistence/*` — sqlite/json boundaries (scaffold)

## Current limitations (intentional)

1. SQLite adapter is in-memory scaffold (contract-first).
2. Parallel-safe merge semantics are spec’d but not fully executed in runtime.
3. Event hooks are represented in compiled plans but not yet executed.
4. Adaptive scoring policy is spec’d; matrix service currently uses deterministic static criteria.

## Next implementation steps

1. Implement real SQLite persistence adapter.
2. Add strict schema references and resolver-backed validation in registry.
3. Execute event hooks and parallel-safe groups with deterministic merge contract.
4. Integrate adaptive weight policy service into matrix drafting flow.
5. Add focused tests for ops path and replay strict/tolerant behavior.
