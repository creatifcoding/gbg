# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 132 experiments, 411 tests, 179 opcodes, 150 catalog entries

Production: ~4,500 LOC (stack-vm.ts ~3,600) | Tests: ~6,700 LOC
Benchmark: ~296ms median (~61% below 751ms baseline). Direct eval: 0.17µs/eval (71x faster)

### Function categories (150 catalog entries)
- **Math** (45): ABS, SQRT, SQRTPI, SIGN, LOG, LOG10, LOG2, LN, EXP, POWER, ROUND, ROUNDUP, ROUNDDOWN, CEILING.MATH, FLOOR.MATH, FLOOR, CEIL, MOD, PI, INT, TRUNC, EVEN, ODD, MROUND, COMBIN, PERMUT, FACT, FACTDOUBLE, QUOTIENT, GCD, LCM, SUMPRODUCT, BASE, DECIMAL, SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, RADIANS, DEGREES, SINH, COSH, TANH
- **Stat** (26): SUM, AVG, AVERAGE, MIN, MAX, COUNT, COUNTA, COUNTBLANK, PRODUCT, MEDIAN, STDEV, VAR, RANK, PERCENTILE, MODE, HARMEAN, GEOMEAN, AGGREGATE, COUNTIF, COUNTIFS, SUMIF, AVERAGEIF, MAXIFS, MINIFS, LARGE, SMALL
- **Text** (27): LEN, LEFT, RIGHT, MID, TRIM, UPPER, LOWER, PROPER, CLEAN, CHAR, CODE, T, TEXT, NUMBERVALUE, ROMAN, ARABIC, SUBSTITUTE, CONCAT, CONCATENATE, REPT, EXACT, FIND, SEARCH, REPLACE, TEXTJOIN, FIXED, DOLLAR
- **Logic** (8): IF, IFERROR, IFNA, AND, OR, NOT, IFS, SWITCH
- **Lookup** (3): CHOOSE, MATCH, INDEX
- **Info** (30): ISNUM, ISNUMBER, ISTEXT, ISERROR, ISBLANK, ISEVEN, ISODD, ISLOGICAL, ISNONTEXT, ERRORTYPE, VALUE, TYPE, N, DAYS, DATEVALUE, EDATE, EOMONTH, DATEDIF, WEEKDAY, WEEKNUM, YEAR, MONTH, DAY, HOUR, MINUTE, SECOND
- **Financial** (8): PMT, FV, PV, NPER, RATE, NPV, IRR, SLN, DB
- **Volatile** (4): NOW, RAND, TODAY, RANDBETWEEN

## 🔜 NEXT — Remaining work

### Wire FormulaEngineV2 into production
- **#1 priority** — connect to CellCache, replace FormulaConsistency

### Stretch: conditional formatting capstone
- Capstone test showing COUNTIFS+IF+TEXT for conditional data reporting

## 📌 DEFERRED
- VLOOKUP/HLOOKUP (needs true range semantics)
- Array formulas (MMULT, TRANSPOSE)
- TxHashMap cell state, WASM sandbox (Domain B)
