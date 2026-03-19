# Autoresearch Ideas — Formula DSL Stack VM

## ✅ COMPLETE — 107 experiments, 380 tests, 130 opcodes, 100 catalog entries

Production: 3,472 LOC | Tests: 5,487 LOC | 130 Schema opcodes | 100 FUNCTION_CATALOG entries
Benchmark: ~370ms median (~50.6% below 751ms baseline). Direct eval: 0.17µs/eval (71x faster)

### Architecture highlights
- Flat EXEC dispatch table (110+ entries, O(1))
- _OP singleton interning (85+ parameterless opcodes), VMValue interning
- evalProgramDirect (zero-Effect), evalProgramBulk (batched transaction)
- Peephole optimizer (constant folding, dead code), decompileIR, analyzeIR
- formatCellValue/formatVMError: Excel-style error display
- parseCriteria: Excel criteria parsing (>, >=, <, <=, <>, =, wildcard*)
- FormulaEngineV2: register/validate/recalcDirty/recalcAll, named ranges, volatile

### Function categories (100 catalog entries)
- **Math** (30): ABS, SQRT, SIGN, LOG, LOG10, LOG2, POWER, ROUND, FLOOR, CEIL, MOD, PI, INT, TRUNC, EVEN, ODD, COMBIN, FACT, QUOTIENT, GCD, LCM, EXP, LN, SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, RADIANS, DEGREES, SUMPRODUCT
- **Stat** (13): SUM, AVG, MIN, MAX, COUNT, PRODUCT, MEDIAN, STDEV, RANK, COUNTIF, SUMIF, AVERAGEIF, LARGE, SMALL
- **Text** (23): LEN, LEFT, RIGHT, MID, TRIM, UPPER, LOWER, PROPER, CLEAN, CHAR, CODE, T, SUBSTITUTE, CONCAT, CONCATENATE, REPT, EXACT, FIND, SEARCH, REPLACE, TEXTJOIN, FIXED, DOLLAR
- **Logic** (7): IF, IFERROR, AND, OR, NOT, IFS, SWITCH
- **Lookup** (1): CHOOSE
- **Info** (21): ISNUM, ISNUMBER, ISTEXT, ISERROR, ISBLANK, ISEVEN, ISODD, ERRORTYPE, VALUE, TYPE, N, YEAR, MONTH, DAY, HOUR, MINUTE, SECOND
- **Volatile** (4): NOW, RAND, TODAY, RANDBETWEEN

## 🔜 NEXT — Remaining high-value work

### Wire FormulaEngineV2 into production
- **#1 priority** — connect to CellCache, replace FormulaConsistency dependency

### Financial functions
- PMT, FV, PV, RATE, NPER for loan/investment calcs

### Array formulas
- Element-wise operations on ranges

## 📌 DEFERRED
- TxHashMap cell state, WASM sandbox (Domain B)
