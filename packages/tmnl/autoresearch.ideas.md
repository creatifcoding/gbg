# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 156 experiments, 436 tests, 237 opcodes, 208 catalog entries

Production: ~5,900 LOC (stack-vm.ts ~4,900) | Tests: ~8,100 LOC
Benchmark: ~370ms median (~51% below 751ms baseline). Direct eval: 0.17µs/eval (71x faster)

### Milestones Achieved
- 🎉 200 opcodes (exp 140), 200 catalog (exp 152)
- 🎉 150 experiments (exp 150)
- 🎉 430+ tests, 237 opcodes, 208 catalog functions

### Function categories (208 catalog entries)
- **Math** (53): trig (18), engineering (5), core (30)
- **Stat** (55): descriptive (15), distributions (8: NORMDIST/NORMINV/EXPONDIST/POISSON/BINOMDIST/LOGNORMDIST/WEIBULL/GAMMADIST), regression (7: SLOPE/INTERCEPT/RSQ/FORECAST/CORREL/COVAR/STEYX), rank (6), advanced (KURT/SKEW/FISHER/TRIMMEAN/AVEDEV/DEVSQ/SUMSQ/STANDARDIZE/CONFIDENCE/PERCENTRANK/QUARTILE)
- **Text** (30): Unicode, URL, Roman numerals, formatting
- **Logic** (9): IF/IFERROR/IFNA/AND/OR/XOR/NOT/IFS/SWITCH
- **Lookup** (3): CHOOSE/MATCH/INDEX
- **Info** (33): date/time (12), type checking (9), error handling
- **Financial** (16): TVM (5), depreciation (4: SLN/DB/DDB/SYD), bonds (3: DISC/INTRATE/ISPMT), rates (3: EFFECT/NOMINAL/RATE), NPV/IRR
- **Volatile** (4): NOW/RAND/TODAY/RANDBETWEEN

## 🔜 NEXT — Strategic priorities

### Wire FormulaEngineV2 into production
- **#1 priority** — connect to CellCache, replace FormulaConsistency

## 📌 DEFERRED
- VLOOKUP/HLOOKUP (needs range semantics)
- Array formulas (MMULT, TRANSPOSE)
- More distributions: CHIDIST, TDIST, FDIST
- TxHashMap cell state, WASM sandbox (Domain B)
