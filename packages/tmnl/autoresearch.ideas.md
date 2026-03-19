# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 119 experiments, 392 tests, 149 opcodes, 119 catalog entries

Production: ~3,800 LOC (stack-vm.ts ~3,000) | Tests: ~5,900 LOC
Benchmark: ~290ms median (~61% below 751ms baseline). Direct eval: 0.17µs/eval (71x faster)

### Function categories (119 catalog entries)
- **Math** (37): ABS, SQRT, SIGN, LOG, LOG10, LOG2, LN, EXP, POWER, ROUND, ROUNDUP, ROUNDDOWN, FLOOR, CEIL, MOD, PI, INT, TRUNC, EVEN, ODD, MROUND, COMBIN, FACT, QUOTIENT, GCD, LCM, SUMPRODUCT, SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, RADIANS, DEGREES, SINH, COSH, TANH
- **Stat** (20): SUM, AVG, MIN, MAX, COUNT, COUNTA, COUNTBLANK, PRODUCT, MEDIAN, STDEV, VAR, RANK, PERCENTILE, COUNTIF, SUMIF, AVERAGEIF, MAXIFS, MINIFS, LARGE, SMALL
- **Text** (23): LEN, LEFT, RIGHT, MID, TRIM, UPPER, LOWER, PROPER, CLEAN, CHAR, CODE, T, SUBSTITUTE, CONCAT, CONCATENATE, REPT, EXACT, FIND, SEARCH, REPLACE, TEXTJOIN, FIXED, DOLLAR
- **Logic** (7): IF, IFERROR, AND, OR, NOT, IFS, SWITCH
- **Lookup** (1): CHOOSE
- **Info** (23): ISNUM, ISNUMBER, ISTEXT, ISERROR, ISBLANK, ISEVEN, ISODD, ISLOGICAL, ISNONTEXT, ERRORTYPE, VALUE, TYPE, N, YEAR, MONTH, DAY, HOUR, MINUTE, SECOND
- **Financial** (5): PMT, FV, PV, NPER, NPV
- **Volatile** (4): NOW, RAND, TODAY, RANDBETWEEN

## 🔜 NEXT — High-value additions

### More financial: IRR, RATE, SLN, DB
- IRR needs Newton-Raphson iteration (interesting algo)
- RATE needs bisection/Newton (solving for rate given PMT/PV/FV/NPER)

### Database-style: DSUM, DCOUNT, DAVERAGE
- Operates on structured range data with field criteria

### VLOOKUP / HLOOKUP / INDEX+MATCH
- Needs range/array semantics — big architectural addition

### Wire FormulaEngineV2 into production
- Connect to CellCache, replace FormulaConsistency dependency

## 📌 DEFERRED
- TxHashMap cell state, WASM sandbox (Domain B)
