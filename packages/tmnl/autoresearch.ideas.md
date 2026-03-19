# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 171 experiments, 452 tests, 300 opcodes, 270 catalog entries

Production: ~5,100 LOC (stack-vm.ts) | Tests: ~2,500 LOC
Benchmark: ~350ms median (~53% below 751ms baseline)

### Milestones Hit
- 🎉 200 opcodes (140), 250 opcodes (161), **300 opcodes (171)**
- 🎉 200 catalog (152), 250 catalog (166), 260 catalog (169), 270 catalog (171)
- 🎉 450+ tests

### Category breakdown (270 catalog)
math:73 | stat:67 | info:43 | text:38 | financial:28 | lookup:12 | logic:10 | volatile:5

### Complex number suite (10 functions)
COMPLEX, IMREAL, IMAGINARY, IMABS, IMSUM, IMPRODUCT, IMARGUMENT, IMCONJUGATE, IMSQRT, BESSELJ

### Regex suite (3 functions)
REGEXMATCH, REGEXEXTRACT, REGEXREPLACE

### Dynamic array suite (8 functions)
SORT, UNIQUE, FILTER, TAKE, DROP, HSTACK, WRAPROWS, SEQUENCE, RANDARRAY

## 🔜 NEXT
1. **Wire FormulaEngineV2 into production** — connect to CellCache + AG-Grid
2. Push to 300 catalog (IMPOWER, IMEXP, IMLN, etc.)

## 📌 DEFERRED
- VLOOKUP/HLOOKUP (needs range semantics)
- MMULT, TRANSPOSE (matrix ops, needs 2D array support)
- LAMBDA (user-defined functions — needs VM closure support)
- TxHashMap cell state, WASM sandbox (Domain B)
