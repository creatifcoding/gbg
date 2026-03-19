# Autoresearch Ideas — Formula DSL Stack VM

## ✅ COMPLETE — 100 experiments, 372 tests, 109 opcodes

Production: 3,315 LOC | Tests: 5,420 LOC | 109 Schema opcodes | 80 FUNCTION_CATALOG entries

### Architecture highlights
- Flat EXEC dispatch table (100+ entries, O(1))
- _OP singleton interning (70+ parameterless opcodes)
- VMValue interning (bool singletons, num(-1..100) cache)
- evalProgramDirect: zero-Effect eval (71x faster, 0.17µs/eval)
- evalProgramBulk: batch N in single transaction
- Peephole optimizer: constant folding (binary + unary), dead code elimination
- decompileIR: IR → readable formula roundtrip
- analyzeIR: complexity metrics for optimization decisions
- formatCellValue/formatVMError: Excel-style error display (#DIV/0!, #VALUE!, #REF!, #NAME?, #CALC!)
- parseCriteria: Excel criteria parsing (>, >=, <, <=, <>, =, wildcard*, exact match)
- Infix shunting-yard: nested functions, operator precedence, ranges, booleans, = equality
- FUNCTION_CATALOG: 80 entries with completeFunctions() autocomplete
- FormulaEngineV2: register/validate/recalcDirty/recalcAll, named ranges, volatile, direct eval

### Function categories (80 functions)
- **Math** (17): ABS, SQRT, SIGN, LOG, LOG10, POWER, ROUND, FLOOR, CEIL, MOD, PI, INT, TRUNC, EVEN, ODD, COMBIN
- **Stat** (13): SUM, AVG, MIN, MAX, COUNT, PRODUCT, MEDIAN, STDEV, RANK, COUNTIF, SUMIF, AVERAGEIF, LARGE, SMALL
- **Text** (21): LEN, LEFT, RIGHT, MID, TRIM, UPPER, LOWER, PROPER, CLEAN, CHAR, CODE, T, SUBSTITUTE, CONCAT, CONCATENATE, REPT, EXACT, FIND, SEARCH, REPLACE, TEXTJOIN
- **Logic** (7): IF, IFERROR, AND, OR, NOT, IFS, SWITCH
- **Lookup** (1): CHOOSE
- **Info** (18): ISNUM, ISNUMBER, ISTEXT, ISERROR, ISBLANK, ISEVEN, ISODD, VALUE, TYPE, N, YEAR, MONTH, DAY, HOUR, MINUTE, SECOND
- **Volatile** (3): NOW, RAND, TODAY

## 🔜 NEXT — Remaining high-value work

### Wire FormulaEngineV2 into production
- Replace FormulaConsistency's dependency on old FormulaEngine
- Wire registerInfix as primary formula input path
- Connect to CellCache atoms for reactive UI updates
- **#1 remaining task for production readiness**

### Array formulas / ARRAYFORMULA
- =ARRAYFORMULA(A1:A10 * B1:B10)
- Element-wise operations on ranges

### Financial functions
- PMT, FV, PV, RATE, NPER for loan/investment calcs
- NPV, IRR for discounted cash flows

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
