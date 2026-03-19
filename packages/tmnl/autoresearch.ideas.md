# Autoresearch Ideas — Formula DSL Stack VM

## ✅ COMPLETE — 103 experiments, 376 tests, 122 opcodes

Production: 3,407 LOC | Tests: 5,453 LOC | 122 Schema opcodes | 93 FUNCTION_CATALOG entries

### Architecture highlights
- Flat EXEC dispatch table (110+ entries, O(1))
- _OP singleton interning (80+ parameterless opcodes)
- VMValue interning (bool singletons, num(-1..100) cache)
- evalProgramDirect: zero-Effect eval (71x faster, 0.17µs/eval)
- evalProgramBulk: batch N in single transaction
- Peephole optimizer: constant folding (binary + unary), dead code elimination
- decompileIR/analyzeIR/formatCellValue/parseCriteria
- FormulaEngineV2: register/validate/recalcDirty/recalcAll, named ranges, volatile, direct eval

### Function categories (93 catalog entries)
- **Math** (26): ABS, SQRT, SIGN, LOG, LOG10, POWER, ROUND, FLOOR, CEIL, MOD, PI, INT, TRUNC, EVEN, ODD, COMBIN, FACT, QUOTIENT, GCD, LCM, SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, RADIANS, DEGREES
- **Stat** (13): SUM, AVG, MIN, MAX, COUNT, PRODUCT, MEDIAN, STDEV, RANK, COUNTIF, SUMIF, AVERAGEIF, LARGE, SMALL
- **Text** (21): LEN, LEFT, RIGHT, MID, TRIM, UPPER, LOWER, PROPER, CLEAN, CHAR, CODE, T, SUBSTITUTE, CONCAT, CONCATENATE, REPT, EXACT, FIND, SEARCH, REPLACE, TEXTJOIN
- **Logic** (7): IF, IFERROR, AND, OR, NOT, IFS, SWITCH
- **Lookup** (1): CHOOSE
- **Info** (19): ISNUM, ISNUMBER, ISTEXT, ISERROR, ISBLANK, ISEVEN, ISODD, VALUE, TYPE, N, YEAR, MONTH, DAY, HOUR, MINUTE, SECOND
- **Volatile** (3): NOW, RAND, TODAY

## 🔜 NEXT — Remaining high-value work

### Wire FormulaEngineV2 into production
- **#1 priority** — connect to CellCache, replace FormulaConsistency dependency

### Financial functions
- PMT, FV, PV, RATE, NPER for loan/investment calcs
- NPV, IRR for discounted cash flows

### EXP / LN (natural log/exponential)
- Simple additions to round out math library

### Array formulas / ARRAYFORMULA
- Element-wise operations on ranges

## 📌 DEFERRED
- TxHashMap cell state (needs production wiring first)
- WASM sandbox (Domain B)

## 📊 v4 API Gotchas (14 discoveries)
| Wrong | Correct |
|---|---|
| `Schema.Union(A, B, C)` | `Schema.Union([A, B, C])` |
| `Schema.Record({key, value})` | `Schema.Record(key, value)` |
| `TxRef.make()` outside tx | Inside `Effect.transaction()` only |
| `Effect.yieldNow()` | `Effect.yieldNow` (value) |
| `Result.value` | `Result.success` / `.failure` |
| `Effect.catchAll(f)` | **`Effect.catch(f)`** |
| `Effect.fork(e)` | **`Effect.forkChild(e)`** |
| `Graph.topo()` order | Dependents-first; **reverse** for eval |
| `TxHashMap.make([tuples])` | **`TxHashMap.make(...spread)`** |
| `Semaphore.make(n)` | Returns `Effect<Semaphore>` (yield*) |
