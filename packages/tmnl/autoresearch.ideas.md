# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 110 experiments, 383 tests, 136 opcodes, 106 catalog entries

Production: ~3,500 LOC | Tests: ~5,500 LOC
Benchmark: ~380ms median (~49% below 751ms baseline). Direct eval: 0.17µs/eval (71x faster)

### Function categories (106 catalog entries)
- **Math** (33): ABS, SQRT, SIGN, LOG, LOG10, LOG2, LN, EXP, POWER, ROUND, FLOOR, CEIL, MOD, PI, INT, TRUNC, EVEN, ODD, MROUND, COMBIN, FACT, QUOTIENT, GCD, LCM, SUMPRODUCT, SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, RADIANS, DEGREES, SINH, COSH, TANH
- **Stat** (15): SUM, AVG, MIN, MAX, COUNT, COUNTA, COUNTBLANK, PRODUCT, MEDIAN, STDEV, RANK, COUNTIF, SUMIF, AVERAGEIF, LARGE, SMALL
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
