# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 186 experiments, 463 tests, 402 opcodes, 373 catalog entries

Production: ~6,200 LOC | Tests: ~2,550 LOC | Benchmark: ~380ms (~49% below 751ms)

### Category breakdown (373 catalog)
math:105 | stat:100 | text:47 | info:43 | financial:39 | lookup:18 | logic:16 | volatile:5

### Complete suites
- Distributions: 18+ (all major + inverses + PDF/CDF)
- Hypothesis tests: CHITEST/TTEST/FTEST/ZTEST  
- Regression: LINEST/LOGEST/SLOPE/INTERCEPT/RSQ/FORECAST/CORREL/GROWTH/TREND
- Financial: TVM(6) + depreciation(4) + bonds(5) + T-bills(3) + duration(2) + XIRR/YIELD + 10 more
- Gamma: GAMMA/GAMMALN/BETA.FN (Lanczos)
- Complex: 17 | Base: 11 | Bitwise: 5 | Bessel: 4

## 🔜 NEXT
1. **Wire FormulaEngineV2 into production** — THE priority
2. Push financial to 40+ (AMORLINC, PRICEMAT, YIELDMAT)
3. Push toward 400 catalog for Excel-grade parity

## 📌 DEFERRED
- VLOOKUP/HLOOKUP/XLOOKUP with cell range semantics
- MMULT, TRANSPOSE (true 2D array support)
- Full LAMBDA closure support
