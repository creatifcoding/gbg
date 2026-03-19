# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 176 experiments, 456 tests, 342 opcodes, 311 catalog entries

Production: 5,350 LOC (stack-vm.ts) | Tests: 2,428 LOC
Benchmark: ~365ms median (~51% below 751ms baseline)

### Milestones
- 🎉 300 opcodes (171), 300 catalog (174), 342 opcodes & 311 catalog (176)

### Category breakdown (311 catalog)
math:100 | stat:68 | text:42 | info:39 | financial:28 | logic:16 | lookup:13 | volatile:5

### Key suites
- Complex numbers: 17 functions | Base conversion: 9 | Bitwise: 5
- Dynamic arrays: SORT/UNIQUE/FILTER/TAKE/DROP/HSTACK/WRAPROWS/SEQUENCE/RANDARRAY
- Functional: LAMBDA/MAP/REDUCE/SCAN/BYROW/BYCOL
- Regex: MATCH/EXTRACT/REPLACE | Bessel: J/Y

## 🔜 NEXT
1. **Wire FormulaEngineV2 into production** — connect to CellCache + AG-Grid
2. Consolidate: deduplicate any remaining handler overlaps
3. Performance pass: profile large-formula compilation

## 📌 DEFERRED
- VLOOKUP/HLOOKUP/XLOOKUP with cell range semantics
- MMULT, TRANSPOSE (2D array support)
- Full LAMBDA closure support (needs VM extension)
