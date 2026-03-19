# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 131 experiments, 410 tests, 173 opcodes, 144 catalog entries

Production: ~4,200 LOC (stack-vm.ts ~3,400) | Tests: ~6,500 LOC
Benchmark: ~310ms median (~59% below 751ms baseline). Direct eval: 0.17µs/eval (71x faster)

### Function categories (144 catalog entries)
- **Math** (43): ABS, SQRT, SQRTPI, SIGN, LOG, LOG10, LOG2, LN, EXP, POWER, ROUND, ROUNDUP, ROUNDDOWN, CEILING.MATH, FLOOR.MATH, FLOOR, CEIL, MOD, PI, INT, TRUNC, EVEN, ODD, MROUND, COMBIN, FACT, QUOTIENT, GCD, LCM, SUMPRODUCT, BASE, DECIMAL, SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, RADIANS, DEGREES, SINH, COSH, TANH
- **Stat** (26): SUM, AVG, AVERAGE, MIN, MAX, COUNT, COUNTA, COUNTBLANK, PRODUCT, MEDIAN, STDEV, VAR, RANK, PERCENTILE, MODE, HARMEAN, GEOMEAN, AGGREGATE, COUNTIF, COUNTIFS, SUMIF, AVERAGEIF, MAXIFS, MINIFS, LARGE, SMALL
- **Text** (27): LEN, LEFT, RIGHT, MID, TRIM, UPPER, LOWER, PROPER, CLEAN, CHAR, CODE, T, TEXT, NUMBERVALUE, ROMAN, ARABIC, SUBSTITUTE, CONCAT, CONCATENATE, REPT, EXACT, FIND, SEARCH, REPLACE, TEXTJOIN, FIXED, DOLLAR
- **Logic** (7): IF, IFERROR, AND, OR, NOT, IFS, SWITCH
- **Lookup** (3): CHOOSE, MATCH, INDEX
- **Info** (27): ISNUM, ISNUMBER, ISTEXT, ISERROR, ISBLANK, ISEVEN, ISODD, ISLOGICAL, ISNONTEXT, ERRORTYPE, VALUE, TYPE, N, DATEVALUE, EDATE, WEEKDAY, WEEKNUM, YEAR, MONTH, DAY, HOUR, MINUTE, SECOND
- **Financial** (8): PMT, FV, PV, NPER, RATE, NPV, IRR, SLN, DB
- **Volatile** (4): NOW, RAND, TODAY, RANDBETWEEN

## 🔜 NEXT — High-value additions

### Wire FormulaEngineV2 into production
- **#1 priority** — connect to CellCache, replace FormulaConsistency

### 150 catalog milestone
- 6 more functions to hit 150 catalog entries

### Remaining gaps for production
- IFNA (return alt when N/A error)
- EOMONTH (end of month + months)
- DATEDIF (date difference)
- PERMUT, FACT.DOUBLE

## 📌 DEFERRED
- VLOOKUP/HLOOKUP (needs range semantics)
- TxHashMap cell state, WASM sandbox (Domain B)
