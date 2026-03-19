# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 201 experiments, 512 tests, 512 opcodes, 519 CATALOG ENTRIES

Production: 7,563 LOC | Tests: ~3,000 LOC | Benchmark: ~321ms (~57% below 751ms)

### Category breakdown (519 catalog)
math:135 | stat:124 | text:71 | info:70 | financial:52 | lookup:37 | logic:24 | volatile:6

### Key milestones
- **500+ CATALOG** at experiment #199
- **200 EXPERIMENTS** milestone
- **512 OPCODES** = 2^9 (coincidence but neat)
- **512 TESTS** — comprehensive coverage
- Date/time functions, interpolation (LERP/SMOOTHSTEP/CLAMP), REGEX suite

## 🔜 NEXT
1. **Wire FormulaEngineV2 into production** — connect to CellCache + AG-Grid
2. Compiler optimizations (constant folding, dead code elimination)
3. Push toward 550+ catalog

## 📌 DEFERRED
- MMULT/MINVERSE with true 2D matrix
- Full LAMBDA closure support  
- WASM compilation target
- Worker thread offloading
