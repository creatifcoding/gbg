# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 240 experiments, 800 tests, 900 CATALOG, ~10,935 LOC

### Category breakdown (900 catalog)
math:233 | stat:170 | text:146 | info:114 | financial:98 | lookup:65 | logic:60 | volatile:14

### This session (236→240)
- Hit **850** at #237, **900** at #239
- Session total: 150 new functions + 84 new tests
- Wiring lessons codified: classifyToken, N_VARIANTS, ALWAYS_N_FNS, VMValue handling

## 🔜 NEXT
1. Push toward **950** catalog (50 more)
2. Push toward **1000** (another 50 after that — iconic milestone)
3. Consider compiler optimizations after 1000

## 📌 DEFERRED
- MMULT/MINVERSE with true 2D matrix
- Full LAMBDA closure support
- WASM compilation target
- Worker thread offloading
- Wire FormulaEngineV2 into production (CellCache + AG-Grid)

## ⚠ WIRING LESSONS LEARNED
- New _OP functions MUST have classifyToken case entries
- New _N functions MUST have N_VARIANTS + ALWAYS_N_FNS entries
- EXEC implementations MUST return { result: VMValue } (use binop/unop)
- VMValue is tagged ({_tag:"num",value:X}) — use asNum(), vmDisplay(), NOT raw Number()
- Always check for duplicate keys in object literals (esbuild warnings)
