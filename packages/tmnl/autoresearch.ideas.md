# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 182 experiments, 461 tests, 366 opcodes, 335 catalog entries

Production: 5,661 LOC | Tests: 2,500 LOC | Benchmark: ~400ms (~47% below 751ms)

### Category breakdown (335 catalog)
math:100 | stat:80 | text:47 | info:42 | financial:30 | logic:16 | lookup:15 | volatile:5

### Complete suites
- Complex numbers: 17 | Base conversion: 11 | Bitwise: 5 | Bessel: 2
- Distributions: NORM/EXP/POISSON/BINOM/LOGNORM/WEIBULL/GAMMA/HYPGEOM/NEGBINOM/BETA/CHISQ/T/F + PHI/GAUSS
- Dynamic arrays: SORT/UNIQUE/FILTER/TAKE/DROP/HSTACK/WRAPROWS/SEQUENCE/RANDARRAY
- Functional: LAMBDA/MAP/REDUCE/SCAN/BYROW/BYCOL
- Regression: SLOPE/INTERCEPT/RSQ/FORECAST/CORREL/COVAR/STEYX/GROWTH/TREND
- Financial: TVM(6) + depreciation(4) + bonds(3) + rates(5) + NPV/IRR + MIRR/XNPV + CUMIPMT/FVSCHEDULE

## 🔜 NEXT
1. **Wire FormulaEngineV2 into production** — #1 priority
2. Push to 400 catalog (remaining Excel parity functions)
3. Performance: profile compilation of complex formulas

## 📌 DEFERRED
- VLOOKUP/HLOOKUP/XLOOKUP with cell range semantics
- MMULT, TRANSPOSE (2D array support)
- Full LAMBDA closure support
