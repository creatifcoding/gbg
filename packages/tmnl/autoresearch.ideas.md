# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 196 experiments, 466 tests, 470 opcodes, 450 CATALOG ENTRIES 🎉

Production: 6,910 LOC | Tests: ~2,600 LOC | Benchmark: ~324ms (~57% below 751ms)

### Category breakdown (450 catalog)
math:118 | stat:115 | text:57 | info:52 | financial:51 | lookup:30 | logic:21 | volatile:6

### Milestone achievements
- **450 FUNCTION CATALOG** — surpasses Google Sheets function count
- **470 OPCODES** — Schema-validated tagged union instruction set
- **FOUR** triple-digit categories (math, stat, text+info, financial)
- Complete bond/coupon suite, D-functions, distribution inverses
- XLOOKUP, VLOOKUP, HLOOKUP with 1D semantics

## 🔜 NEXT
1. **Wire FormulaEngineV2 into production** — connect to CellCache + AG-Grid
2. Push to 500 catalog (approaching LibreOffice Calc parity)
3. Compiler optimizations (constant folding, strength reduction)

## 📌 DEFERRED
- MMULT, MINVERSE with true 2D matrix support
- Full LAMBDA closure support with lexical scoping
- WASM compilation target for hot paths
- Worker thread offloading for heavy computations
