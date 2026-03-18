# Autoresearch Ideas — Formula DSL Stack VM

## ✅ PROVEN (24 hypotheses, 78/78 tests, 22 v4 modules)

### Core VM: H1–H7
### Trail: H8–H10, H20
### Data: H11–H13, H23
### Architecture: H14–H16
### Concurrency: H17–H19
### Observability: H15, H22
### Integration: H21, H24 (full FormulaEngine service)

## ✅ EXTRACTED — Production Services (4 modules, 98 tests)

### stack-vm.ts (32KB, 49 tests)
- ServiceMap.Service: eval(ir), evalExpr(str), evalEffect(program), compile(expr), invalidate(expr)
- 3 error channels: VMValue inline (6 codes), Effect E (CompileError/EvalError/ResourceError), defects
- Layer.effect: Cache + Metric + Semaphore + Span + Timeout
- Error utilities: catchToErrorState, failureToVMError, timeoutToVMError, vmDisplay, propagateError
- Step overflow guard (MAX_EVAL_STEPS), error propagation rule

### vm-cell-bridge.ts (5KB, 24 tests)
- Bidirectional CellValue ↔ VMValue conversion
- Empty→0 spreadsheet convention, Formula→cached, error code→display mapping
- Round-trip checks (isLosslessRoundTrip), batch ops, cellDisplayVM

### dep-graph.ts (9KB, 17 tests)
- Effect v4 Graph-backed topo sort for eval order
- Cycle detection (CircularDepError) before registration
- Diamond deps, BFS affected set, Graph.topo Walker [NodeIndex, N]

### vm-integration.test.ts (8 tests)
- Full pipeline: data change → topo sort → eval → bridge → write-back
- Chained formulas, diamond deps, error propagation, multi-dirty, unregister

## 🔜 NEXT — Production Wiring

### READ_CELL opcode (extends VM with cell context)
- New opcode: `READ_CELL { addr: string }` — reads cell value into stack
- Requires `CellContext` service (Effect DI) providing `getCell(addr) → VMValue`
- Enables formulas to reference cells at eval time, not just at compile time
- Test: `PUSH_STR "A1" READ_CELL` reads A1's value onto stack

### Replace formula-engine.ts
- Wire DepGraph into FormulaEngine or replace the service
- FormulaConsistency should use StackVM for recalc instead of raw compute callbacks
- Public barrel export from index.ts

### TxHashMap cell state (production)
- Replace Map<string, CellValue> with TxHashMap inside Effect.transaction
- Multi-cell atomic reads/writes for bulk paste, undo

### WASM sandbox (Domain B)
- Pool.make for QuickJS-WASM instances
- acquireRelease lifecycle, addFinalizer cleanup
- timeout for untrusted code safety

## 📊 v4 API Gotchas (Complete — 14 discoveries)
| Wrong | Correct |
|---|---|
| `Schema.Union(A, B, C)` | `Schema.Union([A, B, C])` |
| `Schema.Record({key, value})` | `Schema.Record(key, value)` |
| `TxRef.make()` outside tx | Inside `Effect.transaction()` only |
| `Effect.yieldNow()` | `Effect.yieldNow` (value) |
| `Result.value` | `Result.success` / `.failure` |
| `Optic.at().get()` | `Optic.at().getResult()` (Optional) |
| `Effect.catchAll(f)` | **`Effect.catch(f)`** |
| `Effect.catchAllCause` | `Effect.catchCause` |
| `Effect.fork(e)` | **`Effect.forkChild(e)`** |
| `Graph.topo()` order | Dependents-first; **reverse** for eval |
| `TxQueue.unbounded()` | Requires `Effect.Transaction` |
| `Pool.make()` | Requires `Scope` |
| `TxHashMap.make([tuples])` | **`TxHashMap.make(...spread)`** |
| `Semaphore.make(n)` | Returns `Effect<Semaphore>` (yield*) |
