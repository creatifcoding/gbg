# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 115 experiments, 388 tests, 142 opcodes, 112 catalog entries

Production: ~3,700 LOC (stack-vm.ts ~2,850) | Tests: ~5,700 LOC
Benchmark: ~380ms median (~49% below 751ms baseline). Direct eval: 0.17µs/eval (71x faster)

### Function categories (112 catalog entries)
- **Math** (35): ABS, SQRT, SIGN, LOG, LOG10, LOG2, LN, EXP, POWER, ROUND, FLOOR, CEIL, MOD, PI, INT, TRUNC, EVEN, ODD, MROUND, COMBIN, FACT, QUOTIENT, GCD, LCM, SUMPRODUCT, SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, RADIANS, DEGREES, SINH, COSH, TANH
- **Stat** (18): SUM, AVG, MIN, MAX, COUNT, COUNTA, COUNTBLANK, PRODUCT, MEDIAN, STDEV, VAR, RANK, PERCENTILE, COUNTIF, SUMIF, AVERAGEIF, LARGE, SMALL
- **Text** (23): LEN, LEFT, RIGHT, MID, TRIM, UPPER, LOWER, PROPER, CLEAN, CHAR, CODE, T, SUBSTITUTE, CONCAT, CONCATENATE, REPT, EXACT, FIND, SEARCH, REPLACE, TEXTJOIN, FIXED, DOLLAR
- **Logic** (7): IF, IFERROR, AND, OR, NOT, IFS, SWITCH
- **Lookup** (1): CHOOSE
- **Info** (21): ISNUM, ISNUMBER, ISTEXT, ISERROR, ISBLANK, ISEVEN, ISODD, ERRORTYPE, VALUE, TYPE, N, YEAR, MONTH, DAY, HOUR, MINUTE, SECOND
- **Financial** (4): PMT, FV, PV, NPER
- **Volatile** (4): NOW, RAND, TODAY, RANDBETWEEN

## 🔜 NEXT — Remaining high-value work

### Wire FormulaEngineV2 into production
- **#1 priority** — connect to CellCache, replace FormulaConsistency dependency

### More financial: NPV, IRR, RATE

### VLOOKUP / HLOOKUP / INDEX+MATCH
- Needs range/array semantics

## 📌 DEFERRED
- TxHashMap cell state, WASM sandbox (Domain B)
