# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 199 experiments, 466 tests, 495 opcodes, 502 CATALOG ENTRIES 🎉🎉🎉

Production: 7,411 LOC | Tests: ~2,600 LOC | Benchmark: ~313ms (~58% below 751ms)

### Category breakdown (502 catalog)
math:131 | stat:124 | text:68 | info:60 | financial:52 | lookup:37 | logic:24 | volatile:6

### Milestone achievements
- **502 FUNCTION CATALOG** — surpasses LibreOffice Calc (~500 functions)
- **495 OPCODES** — Schema-validated tagged union instruction set
- **SIX** categories with 24+ functions each
- Complete: distributions (13+), right-tailed variants, inverse distributions
- Complete: REGEX suite, dynamic arrays (FILTER/TAKE/DROP/CHOOSECOLS/CHOOSEROWS)
- Complete: bond/coupon suite (12 functions), D-functions (9 functions)
- Engineering: GESTEP, DELTA, ERF/ERFC, Bessel functions

## 🔜 NEXT — EXPERIMENT 200!
1. **Add test coverage** for new functions (push 466→480+ tests)
2. **Wire FormulaEngineV2 into production** — THE priority
3. Compiler optimizations (constant folding, strength reduction)

## 📌 DEFERRED
- MMULT, MINVERSE with true 2D matrix support
- Full LAMBDA closure support with lexical scoping
- WASM compilation target for hot paths
- Worker thread offloading for heavy computations
