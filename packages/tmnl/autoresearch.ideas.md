# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 180 experiments, 459 tests, 356 opcodes, 325 catalog entries

Production: 5,545 LOC | Tests: 2,460 LOC | Benchmark: ~370ms (~50% below 751ms)

### Category breakdown (325 catalog)
math:100 | stat:75 | text:42 | info:42 | financial:30 | logic:16 | lookup:15 | volatile:5

### Complete suites
- Complex numbers: 17 functions | Base conversion: 9 | Bitwise: 5 | Bessel: 2
- Dynamic arrays: SORT/UNIQUE/FILTER/TAKE/DROP/HSTACK/WRAPROWS/SEQUENCE/RANDARRAY
- Functional: LAMBDA/MAP/REDUCE/SCAN/BYROW/BYCOL
- Regex: MATCH/EXTRACT/REPLACE
- Time: HOUR/MINUTE/SECOND/TIME/TIMEVALUE
- Hypothesis testing: ZTEST/NORMDIST/NORMINV/CONFIDENCE

## 🔜 NEXT
1. **Wire FormulaEngineV2 into production** — connect to CellCache + AG-Grid
2. Push to 350 catalog if needed post-wiring

## 📌 DEFERRED
- VLOOKUP/HLOOKUP/XLOOKUP with cell range semantics
- MMULT, TRANSPOSE (2D array support)
- Full LAMBDA closure support
