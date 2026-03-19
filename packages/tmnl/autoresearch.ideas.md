# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 163 experiments, 443 tests, 258 opcodes, 229 catalog entries

Production: ~6,600 LOC (stack-vm.ts ~5,600) | Tests: ~8,800 LOC
Benchmark: ~350ms median (~53% below 751ms baseline)

### Milestones
- 🎉 200 opcodes (140), 250 opcodes (161), 200 catalog (152), 225 catalog (162)

## 🔜 NEXT — Push to 250 catalog
- Remaining gaps: XLOOKUP (simplified), FILTER_N, UNIQUE_N, SORT_N
- More text: REGEXEXTRACT, REGEXMATCH, REGEXREPLACE
- PPMT, IPMT (payment components)
- YEARFRAC, COUPDAYBS, ACCRINT (advanced financial)

## Wire FormulaEngineV2 into production
- **Priority after 250 catalog** — connect to CellCache

## 📌 DEFERRED
- VLOOKUP/HLOOKUP (needs range semantics)
- Array formulas (MMULT, TRANSPOSE), LAMBDA, LET
- TxHashMap cell state, WASM sandbox (Domain B)
