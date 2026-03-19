# Autoresearch Ideas — Formula DSL Stack VM

## ✅ DONE — No longer actionable

- 25 hypotheses, 80 spike tests, 22 Effect v4 modules
- 4 production services: stack-vm.ts, vm-cell-bridge.ts, dep-graph.ts, formula-engine-v2.ts
- Flat EXEC dispatch table (O(1)), 44+ opcodes
- Infix shunting-yard: precedence, nested functions, ranges, boolean literals
- Comparison: < > >= <= != <>, unary minus, string literals, & concat, ^ power
- Aggregate: SUM/MIN/MAX/AVG/COUNT (both _N and _DYN), IFERROR
- Multi-char columns (AA-AZ+) in READ_RANGE and dep extraction
- IF_FN/IFERROR_FN for infix arg order
- colToIdx/idxToCol helpers

## 🔜 NEXT — High-value paths

### FormulaEngineV2 IFERROR integration
- Test: =IFERROR(A1/B1, 0) where B1=0 → should get 0 not #DIV/0!
- Validates full pipeline: register → recalc → error handling → fallback

### Volatile function support
- Functions like NOW(), RAND() that must recalc every cycle
- DepGraph needs "always-dirty" flag for volatile formulas
- FormulaEngineV2.recalcAll already exists — need volatile detection

### Named ranges / cell aliases
- "Revenue" instead of "A1:A100"
- Compiler resolves aliases to addresses before dep extraction
- Could use a simple Map<string, string> registry

### Wire FormulaEngineV2 into production
- Replace FormulaConsistency's dependency on old FormulaEngine
- Wire registerInfix as primary formula input path
- Connect to CellCache atoms for reactive UI updates

### Barrel exports audit
- Ensure all new opcodes/types exported from index.ts
- GTE, LTE, NEQ, IFERROR, ROUND, FLOOR_OP, CEIL_OP, POWER, COUNT_DYN
- colToIdx, idxToCol utility exports

## 📌 DEFERRED — Lower priority

### TxHashMap cell state (production)
- Replace Map with TxHashMap inside Effect.transaction
- Multi-cell atomic reads/writes for bulk paste, undo

### WASM sandbox (Domain B)
- Pool.make for QuickJS-WASM instances
- Deferred until core formula DSL is production-ready

## 📊 v4 API Gotchas (Reference — 14 discoveries)
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
