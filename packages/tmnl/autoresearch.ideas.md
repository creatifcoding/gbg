# Autoresearch Ideas — Formula DSL Stack VM

## ✅ COMPLETE — 90 experiments, 356 tests, 93 opcodes

Production: 3,119 LOC (stack-vm.ts ~2,250 + vm-cell-bridge 154 + dep-graph 314 + formula-engine-v2 338)
Tests: 5,257 LOC across 6 files (356 tests: 183 production + 80 spike + 93 engine/integration)

### Architecture highlights
- Flat EXEC dispatch table (90+ entries, O(1))
- _OP singleton interning (58+ parameterless opcodes)
- VMValue interning (bool singletons, num(-1..100) cache)
- evalProgramDirect: zero-Effect eval (71x faster, 0.17µs/eval)
- evalProgramBulk: batch N in single transaction
- runIRBatched: single TxRef read/write per program
- Peephole optimizer: constant folding (binary + unary), dead code elimination
- decompileIR: IR → readable formula (roundtrip)
- analyzeIR: complexity metrics for optimization decisions
- Infix shunting-yard: nested functions, operator precedence, ranges, booleans, = equality
- FUNCTION_CATALOG: 61 entries with completeFunctions() autocomplete
- FormulaEngineV2: register/validate/recalcDirty/recalcAll, named ranges, volatile, direct eval

### Function categories (61 functions)
- **Math** (11): ABS, SQRT, SIGN, LOG, LOG10, POWER, ROUND, FLOOR, CEIL, MOD, PI
- **Stat** (8): SUM, AVG, MIN, MAX, COUNT, PRODUCT, MEDIAN, STDEV, RANK
- **Text** (17): LEN, LEFT, RIGHT, MID, TRIM, UPPER, LOWER, SUBSTITUTE, CONCAT, CONCATENATE, REPT, EXACT, FIND, SEARCH, REPLACE, TEXTJOIN
- **Logic** (7): IF, IFERROR, AND, OR, NOT, IFS, SWITCH
- **Lookup** (1): CHOOSE
- **Info** (14): ISNUM, ISTEXT, ISERROR, ISBLANK, VALUE, TYPE, N, YEAR, MONTH, DAY, HOUR, MINUTE, SECOND
- **Volatile** (3): NOW, RAND, TODAY

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

## 📌 DEFERRED
- TxHashMap cell state (needs production wiring first)
- WASM sandbox (Domain B, deferred until core is production-ready)
- Conditional formatting via formulas

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
