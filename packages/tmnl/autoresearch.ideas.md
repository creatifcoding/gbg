# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 184 experiments, 461 tests, 381 opcodes, 350 catalog entries

Production: 5,863 LOC | Tests: 2,500 LOC | Benchmark: ~400ms (~47% below 751ms)

### Category breakdown (350 catalog)
math:105 | stat:90 | text:47 | info:42 | financial:30 | logic:16 | lookup:15 | volatile:5

### Complete suites
- Complex numbers: 17 | Base conversion: 11 | Bitwise: 5 | Bessel: 4 (J/Y/I/K)
- Distributions: 18 (NORM/EXP/POISSON/BINOM/LOGNORM/WEIBULL/GAMMA/HYPGEOM/NEGBINOM/BETA/CHISQ/T/F + inverses)
- Dynamic arrays: SORT/UNIQUE/FILTER/TAKE/DROP/HSTACK/WRAPROWS/SEQUENCE/RANDARRAY
- Functional: LAMBDA/MAP/REDUCE/SCAN/BYROW/BYCOL/LET
- Gamma: GAMMA/GAMMALN/BETA.FN

## 🔜 NEXT
1. **Wire FormulaEngineV2 into production** — THE priority
2. Push to 400 catalog if needed

## 📌 DEFERRED
- VLOOKUP/HLOOKUP/XLOOKUP with cell range semantics
- MMULT, TRANSPOSE (2D array support)
- Full LAMBDA closure support
