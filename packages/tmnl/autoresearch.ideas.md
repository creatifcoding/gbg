# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 193 experiments, 466 tests, 438 opcodes, 418 catalog entries

Production: 6,543 LOC | Tests: ~2,600 LOC | Benchmark: ~371ms (~51% below 751ms)

### Category breakdown (418 catalog)
math:115 | stat:100 | text:52 | info:50 | financial:44 | lookup:30 | logic:21 | volatile:6

### ALL categories at meaningful thresholds!

## 🔜 NEXT
1. **Wire FormulaEngineV2 into production** — connect to CellCache + AG-Grid
2. Push to 450+ catalog (approaching Google Sheets parity)
3. Compiler optimizations (constant folding, strength reduction)

## 📌 DEFERRED
- MMULT, MINVERSE (true 2D matrix)
- Full LAMBDA closure support with lexical scoping
- WASM compilation target for hot paths
- Worker thread offloading for heavy computations
