# F319/F320 Lane B Evidence Index

Scope: Lane B closure artifacts for QueryDSL log filtering and structured row-detail compound integration.

## F319 — QueryDSL dork search over logs

### F319-C1 (DSL operators in one path)
- ✅ `src/lib/agents/tasks/atoms/surface.ts`
  - `applyLogSearchQuery()` wires `parseQuery` + `applyFilters`
  - supports field ops / exclusion / phrase / regex / case / limit / sort via shared QueryDSL parser+executor
- ✅ `src/lib/agents/tasks/atoms/__tests__/surface.querydsl.test.ts`
  - `supports plain text query and field operators in one path`
  - `handles operator-only query without free text`

### F319-C2 (invalid regex safety)
- ✅ `src/lib/agents/tasks/atoms/surface.ts`
  - invalid regex is deterministic no-op via `isValidRegex()` guard (no throw path)
- ✅ `src/lib/agents/tasks/atoms/__tests__/surface.querydsl.test.ts`
  - `invalid regex in query is deterministic no-op (no crash)`

### F319-C3 (operator-only query)
- ✅ `src/lib/agents/tasks/atoms/__tests__/surface.querydsl.test.ts`
  - `handles operator-only query without free text`

### F319-C4 (determinism)
- ✅ Deterministic assertions in unit tests over fixed fixtures
- ✅ Query path is pure over in-memory arrays (`applyLogSearchQuery`)

## F320 — Structured row details as compound component

### F320-D1 (row baseline + expandable detail)
- ✅ `src/lib/agents/tasks/views/log-entry-row.tsx`
  - row baseline ts/level/source/message retained
  - expansion renders `LogEntryDetail` compound
  - expandable when metadata/payload/correlation IDs present
- ✅ `src/lib/agents/tasks/views/log-entry-detail/*`
  - typed detail subcomponents: fields, payload/metadata JSON, flush containers, stack trace

### F320-D2 (copy actions + feedback)
- ✅ copy interactions with visual feedback in:
  - `log-entry-detail-fields.tsx`
  - `log-entry-json-block.tsx`
  - `log-entry-flush-containers.tsx`
  - `log-entry-stack-trace.tsx`

### F320-D3 (barrel/export + style safety)
- ✅ `src/lib/agents/tasks/views/index.ts`
  - detail compounds exported through views barrel
- ✅ style collision rollback completed
  - retained stable `at-log-entry__meta` expansion wrapper
  - avoided broad overrides on shared RVN classes

## Validation runs

```bash
bun run vitest --run \
  src/lib/agents/tasks/services/__tests__/MockTransportService.test.ts \
  src/lib/agents/tasks/views/__tests__/inline-task-log-view.tail.test.tsx \
  src/lib/agents/tasks/atoms/__tests__/surface.querydsl.test.ts
# 8/8 pass

bunx tsc --noEmit --pretty false
# pass
```
