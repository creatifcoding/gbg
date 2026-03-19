# Autoresearch Ideas — Formula DSL Stack VM

## ✅ COMPLETE — 50 experiments, 298 tests, 46 opcodes

Production stack: stack-vm.ts (1497 LOC) + vm-cell-bridge.ts + dep-graph.ts + formula-engine-v2.ts = 2,455 LOC
Tests: 4,766 LOC across 6 files (298 tests)

Key milestones:
- Flat EXEC dispatch table (O(1))
- Infix shunting-yard: nested functions, operator precedence, ranges, booleans
- 46 opcodes: arithmetic, comparison (incl >=,<=,!=), logic, aggregate (_N and _DYN), string, conditional (IF/IFERROR), volatile (NOW/RAND), cell I/O, ranges
- FormulaEngineV2: register/validate/recalcDirty/recalcAll, named ranges, volatile
- Multi-char columns (AA-AZ+)

## 🔜 NEXT — Remaining high-value work

### Wire FormulaEngineV2 into production
- Replace FormulaConsistency's dependency on old FormulaEngine
- Wire registerInfix as primary formula input path
- Connect to CellCache atoms for reactive UI updates
- This is the #1 remaining task for production readiness

### Formula bar autocomplete metadata
- validate() already returns deps — add function name completions
- Return available function names + signatures for the formula bar
- Leverage FUNC_MAP keys

### Conditional formatting via formulas
- =IF(A1>100, "red", "green") style rules evaluated by FormulaEngineV2
- Cell renderer reads format from formula result
- Novel use of the VM outside traditional spreadsheet formulas

### Array formulas / ARRAYFORMULA
- =ARRAYFORMULA(A1:A10 * B1:B10)
- Element-wise operations on ranges
- Requires READ_RANGE to leave values on stack without count, or a new approach

## 📌 DEFERRED

- TxHashMap cell state (needs production wiring first)
- WASM sandbox (Domain B, deferred until core is production-ready)

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
