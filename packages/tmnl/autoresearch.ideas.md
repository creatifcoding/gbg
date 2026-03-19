# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 179 experiments, 459 tests, 351 opcodes, 320 catalog entries

Production: 5,496 LOC | Tests: 2,460 LOC | Benchmark: ~380ms (~49% below 751ms)

### Milestones
- 🎉 300+ opcodes (171→351), 300+ catalog (174→320)
- 🎉 math:100 | stat:75 — both at round milestones

### Category breakdown (320 catalog)
math:100 | stat:75 | text:42 | info:41 | financial:28 | logic:16 | lookup:13 | volatile:5

## 🔜 NEXT
1. **Wire FormulaEngineV2 into production** — connect to CellCache + AG-Grid
2. Push to 350 catalog with remaining Excel parity functions
3. Performance: profile compilation of complex formulas

## 📌 DEFERRED
- VLOOKUP/HLOOKUP/XLOOKUP with cell range semantics
- MMULT, TRANSPOSE (2D array support)
- Full LAMBDA closure support
