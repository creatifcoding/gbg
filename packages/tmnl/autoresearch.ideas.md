# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 206 experiments, 554 tests, 535 opcodes, 542 CATALOG ENTRIES

Production: 7,821 LOC | Tests: ~3,200 LOC | Benchmark: ~289ms (~62% below 751ms)

### Category breakdown (542 catalog)
math:142 | stat:128 | text:80 | info:72 | financial:52 | lookup:38 | logic:24 | volatile:6

### Key milestones
- **542 FUNCTION CATALOG** — well past Excel 365 parity
- **554 TESTS** — comprehensive coverage
- **289ms benchmark** — 62% below baseline!
- ML activations (SIGMOID/RELU/ELU/SOFTPLUS)
- Case converters (camelCase/snake_case/kebab-case)
- Base64 encoding/decoding
- Date utilities (ISLEAPYEAR/QUARTER/DAYOFYEAR/DAYSINYEAR/DAYSINMONTH)

## 🔜 NEXT
1. **Wire FormulaEngineV2 into production** — connect to CellCache + AG-Grid
2. Compiler optimizations (constant folding)
3. Push toward 600 catalog

## 📌 DEFERRED
- MMULT/MINVERSE with true 2D matrix
- Full LAMBDA closure support  
- WASM compilation target
