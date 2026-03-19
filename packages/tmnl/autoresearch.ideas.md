# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 174 experiments, 455 tests, 331 opcodes, 300 catalog entries

Production: ~5,800 LOC (stack-vm.ts) | Tests: ~2,600 LOC
Benchmark: ~370ms median (~50% below 751ms baseline)

### Milestones Hit
- 🎉 200/250/300 opcodes | 200/250/300 catalog | 450+ tests

### Category breakdown (300 catalog)
math:92 | stat:68 | info:45 | text:38 | financial:28 | lookup:13 | logic:10 | volatile:6

### Suites
- Complex: 17 functions (COMPLEX → IMLOG10)
- Base conversion: 9 functions (BIN↔DEC↔HEX↔OCT)
- Bitwise: 5 functions (AND/OR/XOR/LSHIFT/RSHIFT)
- Bessel: 2 functions (J/Y)
- Regex: 3 functions (MATCH/EXTRACT/REPLACE)
- Dynamic arrays: 8+ functions (SORT/UNIQUE/FILTER/TAKE/DROP/HSTACK/WRAPROWS)

## 🔜 NEXT
1. **Wire FormulaEngineV2 into production** — the #1 priority now!
   - Connect to CellCache + AG-Grid
   - vm-cell-bridge already exists, needs wiring
2. More functions if needed post-wiring (aiming for Excel 365 parity)

## 📌 DEFERRED
- VLOOKUP/HLOOKUP (needs range semantics)
- MMULT, TRANSPOSE (matrix ops, needs 2D array support)
- LAMBDA (user-defined functions — needs VM closure support)
- TxHashMap cell state, WASM sandbox (Domain B)
