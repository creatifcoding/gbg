# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 204 experiments, 548 tests, 524 opcodes, 531 CATALOG ENTRIES

Production: 7,683 LOC | Tests: ~3,200 LOC | Benchmark: ~302-344ms (~54-60% below 751ms)

### Category breakdown (531 catalog)
math:141 | stat:126 | text:73 | info:72 | financial:52 | lookup:37 | logic:24 | volatile:6

### Key milestones
- **531 FUNCTION CATALOG** — surpasses Excel 365 (~500 functions)
- **548 TESTS** — comprehensive coverage
- **ML activation functions**: SIGMOID, RELU, SOFTPLUS, ELU
- **Interpolation**: LERP, SMOOTHSTEP, CLAMP, NORMALIZE, MAPRANGE
- **Date utilities**: ISLEAPYEAR, DAYSINYEAR, DAYSINMONTH, QUARTER, DAYOFYEAR

## 🔜 NEXT
1. **Wire FormulaEngineV2 into production** — connect to CellCache + AG-Grid
2. Compiler optimizations (constant folding, dead code elimination)
3. Push toward 550+ catalog

## 📌 DEFERRED
- MMULT/MINVERSE with true 2D matrix
- Full LAMBDA closure support  
- WASM compilation target
- Worker thread offloading
