# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 160 experiments, 440 tests, 248 opcodes, 219 catalog entries

Production: ~6,200 LOC (stack-vm.ts ~5,200) | Tests: ~8,400 LOC
Benchmark: ~400ms median (~47% below 751ms baseline). Direct eval: 0.17µs/eval (71x faster)

### Milestones
- 🎉 200 opcodes (exp 140), 200 catalog (exp 152), 248 opcodes & 219 catalog (exp 160)

### Function categories (219 catalog entries)
- **Math** (53): complete trig/hyp, engineering, core
- **Stat** (59): descriptive, distributions (11: NORMDIST/NORMINV/EXPONDIST/POISSON/BINOMDIST/LOGNORMDIST/WEIBULL/GAMMADIST/HYPGEOMDIST/NEGBINOMDIST/BETADIST), regression (7), rank (6), advanced (KURT/SKEW/FISHER etc)
- **Text** (36): Unicode, URL, Roman, TEXTSPLIT/TEXTBEFORE/TEXTAFTER, VALUETOTEXT
- **Logic** (9): IF/IFERROR/IFNA/AND/OR/XOR/NOT/IFS/SWITCH
- **Lookup** (3): CHOOSE/MATCH/INDEX
- **Info** (37): date/time (15 incl DATESTRING/WORKDAY/NETWORKDAYS/ISOWEEKNUM), type checking, SHEET, ISNA
- **Financial** (16): TVM, depreciation (4), bonds (3), rates (3), NPV/IRR
- **Volatile** (4): NOW/RAND/TODAY/RANDBETWEEN

## 🔜 NEXT
- Wire FormulaEngineV2 into production (connect to CellCache)
- Push to 250 catalog with more practical functions

## 📌 DEFERRED
- VLOOKUP/HLOOKUP (needs range semantics)
- Array formulas, LAMBDA, LET
- TxHashMap cell state, WASM sandbox (Domain B)
