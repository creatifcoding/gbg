# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 152 experiments, 432 tests, 229 opcodes, 200 catalog entries

Production: ~5,600 LOC (stack-vm.ts ~4,600) | Tests: ~7,800 LOC
Benchmark: ~294ms median (~61% below 751ms baseline). Direct eval: 0.17µs/eval (71x faster)

### Milestones Achieved
- 🎉 200 opcodes (experiment 140)
- 🎉 200 function catalog (experiment 152)
- 🎉 150 experiments (experiment 150)
- 🎉 430+ tests

### Function categories (200 catalog entries)
- **Math** (53): Complete trig/hyp suite (18 funcs), engineering (DELTA, GESTEP, MULTINOMIAL, SERIESSUM, CONVERT)
- **Stat** (53): Descriptive (mean, median, mode, stdev, var), Distributions (NORMDIST, EXPONDIST, POISSON, BINOMDIST, LOGNORMDIST, WEIBULL, GAMMADIST), Regression (SLOPE, INTERCEPT, RSQ, FORECAST, CORREL, COVAR, STEYX), Rank (PERCENTILE, PERCENTRANK, QUARTILE, RANK, LARGE, SMALL), Advanced (KURT, SKEW, FISHER, TRIMMEAN, AVEDEV, DEVSQ, SUMSQ)
- **Text** (30): Full Unicode support, URL encoding, Roman numerals
- **Logic** (9): IF, IFERROR, IFNA, AND, OR, XOR, NOT, IFS, SWITCH
- **Lookup** (3): CHOOSE, MATCH, INDEX
- **Info** (33): Date/time (12 funcs), type checking (9 funcs), error handling
- **Financial** (9): TVM (PMT, FV, PV, NPER, RATE), NPV, IRR, SLN, DB
- **Volatile** (4): NOW, RAND, TODAY, RANDBETWEEN

## 🔜 NEXT — Strategic priorities

### Wire FormulaEngineV2 into production
- **#1 priority** — connect to CellCache, replace FormulaConsistency
- This is the big payoff — all 200 functions available in the live grid

## 📌 DEFERRED
- VLOOKUP/HLOOKUP (needs true range semantics)
- Array formulas (MMULT, TRANSPOSE)
- TxHashMap cell state, WASM sandbox (Domain B)
- More distributions: CHIDIST, TDIST, FDIST
