# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 166 experiments, 446 tests, 279 opcodes, 250 catalog entries

Production: ~4,665 LOC (stack-vm.ts) | Tests: ~2,333 LOC
Benchmark: ~350ms median (~50% below 751ms baseline)

### Milestones Hit
- 🎉 200 opcodes (140), 250 opcodes (161), 279 opcodes (166)
- 🎉 200 catalog (152), 250 catalog (166)

### Category breakdown (250 catalog)
stat:67 | math:63 | info:37 | text:34 | financial:28 | logic:9 | lookup:7 | volatile:5

## 🔜 NEXT — Practical function gaps
- **REGEX**: REGEXEXTRACT, REGEXMATCH, REGEXREPLACE (text power tools)
- **LET_N**: named bindings for sub-expressions (reduces eval overhead)
- **LAMBDA**: user-defined functions (advanced, may need VM extension)

## Wire FormulaEngineV2 into production
- **Priority after REGEX batch** — connect to CellCache + AG-Grid

## 📌 DEFERRED
- VLOOKUP/HLOOKUP (needs range semantics — wait for cell grid integration)
- MMULT, TRANSPOSE (matrix ops, needs 2D array support)
- TxHashMap cell state, WASM sandbox (Domain B)
