# Autoresearch Ideas — Formula DSL Stack VM

## ✅ PROVEN (in spike — 21 hypotheses, 72/72 tests)

### Core VM (H1–H7)
- H1: TxRef transactional stack — H2: Schema opcodes — H3: Match dispatch
- H4: Effect program eval — H5: String eval — H6: Concurrent TxRef — H7: Performance

### Trail & Observation (H8–H10, H20)
- H8: JSONL patches (Schema.toDifferJsonPatch) — H9: TaggedUnion.match()
- H10: PubSub + Stream trail observation
- H20: TxQueue append-only trail (TxQueue + TxRef in SAME transaction = atomic)

### Data & Access (H11–H13)
- H11: Optic stack access — H12: Graph for cell deps (topo+cycle+mutate)
- H13: Cache memoized formula eval

### Architecture (H14–H16)
- H14: ServiceMap.Service for VM — H15: Metric observability — H16: Scope/acquireRelease

### Concurrency & Resources (H17–H19)
- H17: Effect.timeout + Fiber.interrupt — H18: Semaphore throttling — H19: Pool instance reuse

### Integration (H21)
- H21: Graph topo → Semaphore throttle → Cell recalc pipeline

## 🔬 NEXT — Remaining Ideas

### H22: Fiber supervision tree for multi-cell recalc
- `Effect.forkChild` for supervised formula fibers
- Parent fiber cancels all children on timeout
- `Fiber.awaitAll([fiber1, fiber2])` — wait for batch
- Supervision tree mirrors dependency graph (H12)

### H23: Effect.withSpan for formula tracing
- `Effect.withSpan("eval", { attributes: { formula: "..." } })`
- Nested spans: compile → validate → execute → trail
- DevTools integration for formula debugging

### H24: TxHashMap for multi-cell transactional state
- `TxHashMap.make<CellAddress, CellValue>()`
- Multi-cell reads/writes in single transaction
- Conflict detection between concurrent formula evals

## 🧩 POST-SPIKE (Extract to Production)

### Extract VM to `packages/datagrid/src/services/stack-vm.ts`
- ServiceMap.Service interface: eval(ir), evalExpr(str), evalEffect(program)
- Layer with Cache + Graph + Metric + Semaphore baked in
- Tests move to `packages/datagrid/test/stack-vm.test.ts`

### @tmnl/jsonl-patch utility package
- JSONL streaming: append patch per line, compact on threshold
- Replay: fold patches to reconstruct any state

### EventLog for event-sourced formula audit
- Event.make({ tag: "FormulaEvaluated", payload: ... })
- Requires further research on effect-smol unstable/eventlog API

## 📊 v4 API Gotchas (Complete Reference)
- `Schema.Union([array])` not spread
- `Schema.Record(key, value)` positional
- `TxRef.make` inside `Effect.transaction()` only
- `Effect.yieldNow` is a value (no `()`)
- `Result.success` not `.value`; `Result.failure` not `.error`
- `Optic.at()` → Optional (`.getResult()` not `.get()`)
- **`Effect.catchAll` → `Effect.catch`** in v4
- **`Effect.catchAllCause` → `Effect.catchCause`**
- **`Effect.catchAllDefect` → `Effect.catchDefect`**
- **`Effect.fork` → `Effect.forkChild`** (no bare fork in v4)
- `Graph.topo()` = dependents-first; reverse for eval order
- `TxQueue.unbounded()` requires `Effect.Transaction` context
- `Pool.make()` requires `Scope` in context (use Effect.scoped)
- `Semaphore.make(n)` returns Effect<Semaphore> (yield* to unwrap)
