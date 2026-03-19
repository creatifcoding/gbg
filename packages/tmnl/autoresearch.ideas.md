# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 125 experiments, 404 tests, 161 opcodes, 132 catalog entries

Production: ~4,000 LOC (stack-vm.ts ~3,200) | Tests: ~6,100 LOC
Benchmark: ~370ms median (~51% below 751ms baseline). Direct eval: 0.17µs/eval (71x faster)

### Function categories (132 catalog entries)
- **Math** (43): ABS, SQRT, SQRTPI, SIGN, LOG, LOG10, LOG2, LN, EXP, POWER, ROUND, ROUNDUP, ROUNDDOWN, CEILING.MATH, FLOOR.MATH, FLOOR, CEIL, MOD, PI, INT, TRUNC, EVEN, ODD, MROUND, COMBIN, FACT, QUOTIENT, GCD, LCM, SUMPRODUCT, BASE, DECIMAL, SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, RADIANS, DEGREES, SINH, COSH, TANH
- **Stat** (22): SUM, AVG, AVERAGE, MIN, MAX, COUNT, COUNTA, COUNTBLANK, PRODUCT, MEDIAN, STDEV, VAR, RANK, PERCENTILE, COUNTIF, COUNTIFS, SUMIF, AVERAGEIF, MAXIFS, MINIFS, LARGE, SMALL
- **Text** (25): LEN, LEFT, RIGHT, MID, TRIM, UPPER, LOWER, PROPER, CLEAN, CHAR, CODE, T, TEXT, NUMBERVALUE, SUBSTITUTE, CONCAT, CONCATENATE, REPT, EXACT, FIND, SEARCH, REPLACE, TEXTJOIN, FIXED, DOLLAR
- **Logic** (7): IF, IFERROR, AND, OR, NOT, IFS, SWITCH
- **Lookup** (1): CHOOSE
- **Info** (23): ISNUM, ISNUMBER, ISTEXT, ISERROR, ISBLANK, ISEVEN, ISODD, ISLOGICAL, ISNONTEXT, ERRORTYPE, VALUE, TYPE, N, YEAR, MONTH, DAY, HOUR, MINUTE, SECOND
- **Financial** (8): PMT, FV, PV, NPER, RATE, NPV, IRR, SLN, DB
- **Volatile** (4): NOW, RAND, TODAY, RANDBETWEEN

## 🔜 NEXT — High-value additions

### Wire FormulaEngineV2 into production
- **#1 priority** — connect to CellCache, replace FormulaConsistency

### VLOOKUP / HLOOKUP / INDEX+MATCH
- Needs range/array semantics — big architectural addition

### Array formula support
- MMULT, TRANSPOSE — matrix operations

## 📌 DEFERRED
- TxHashMap cell state, WASM sandbox (Domain B)
