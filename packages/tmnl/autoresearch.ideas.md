# Autoresearch Ideas — Formula DSL Stack VM

## ✅ COMPLETE — 87 experiments, 353 tests, 90 opcodes

Production: 3,069 LOC (stack-vm.ts 2,198 + vm-cell-bridge 154 + dep-graph 314 + formula-engine-v2 338)
Tests: 5,236 LOC across 6 files (353 tests: 180 production + 80 spike + 93 engine/integration)

Architecture highlights:
- Flat EXEC dispatch table (86 entries, O(1))
- _OP singleton interning (57+ parameterless opcodes)
- VMValue interning (bool singletons, num(-1..100) cache)
- evalProgramDirect: zero-Effect eval (71x faster, 0.17µs/eval)
- evalProgramBulk: batch N in single transaction
- runIRBatched: single TxRef read/write per program
- Peephole optimizer: constant folding (binary + unary), dead code elimination
- decompileIR: IR → readable formula (roundtrip)
- analyzeIR: complexity metrics for optimization decisions
- Infix shunting-yard: nested functions, operator precedence, ranges, booleans, = equality
- FUNCTION_CATALOG: 58 entries with completeFunctions() autocomplete
- FormulaEngineV2: register/validate/recalcDirty/recalcAll, named ranges, volatile, direct eval

Function categories: math (11), stat (6), text (14), logic (5), lookup (1), info (10), volatile (3)

## 🔜 NEXT — Remaining high-value work

### Wire FormulaEngineV2 into production
- Replace FormulaConsistency's dependency on old FormulaEngine
- Wire registerInfix as primary formula input path
- Connect to CellCache atoms for reactive UI updates
- #1 remaining task for production readiness

### COUNTIF/SUMIF (conditional aggregation)
- Needs criteria parsing: ">5", "abc*", "<>0"
- Complex but high-value for production spreadsheets

### Array formulas / ARRAYFORMULA
- =ARRAYFORMULA(A1:A10 * B1:B10)
- Element-wise operations on ranges

### Conditional formatting via formulas
- =IF(A1>100, "red", "green") style rules evaluated by FormulaEngineV2
- Cell renderer reads format from formula result

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
