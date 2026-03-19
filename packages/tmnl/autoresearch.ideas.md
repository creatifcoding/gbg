# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 238 experiments, 772 tests, 850 CATALOG, ~10,713 LOC

### Category breakdown (850 catalog)
math:225 | stat:164 | text:140 | info:110 | financial:92 | lookup:60 | logic:49 | volatile:10

### This session (236→238)
- Hit **850 CATALOG** at experiment #237
- 50-function batch: Lookup (DISTINCT/ARRAYSLICE/ARRAYJOIN/ARRAYREVERSE/ARRAYFLATTEN/ARRAYZIP/ARRAYMIN/ARRAYMAX/ARRAYSUM/ARRAYAVG), Logic (NIFF/SWITCHIF/COND/ALLEQUAL/ANYGT/ANYLT/ANYNE/ISALL/ISANY/ISNONE), Volatile (RANDNORM/RANDEXP/RANDINT/COINFLIP), Math (GUDERMANN/INVERSEGUD/LANCZOS/DIGAMMA/POLYGAMMA/ZETA2/BETAFN/POCHHAMMER), Stat (ENTROPY2/GINICOEF/MOMENT/CMOMENT/ZSCORE3/PERCENTILE2), Text (TEXTFORMAT/TEXTJUSTIFY/TEXTMASK2/TEXTHASH/TEXTREPLACE2/TEXTFILL), Financial (CAGR2/DRAWDOWN/CALMAR/TREYNOR), Info (ISFINITE2/ISWHOLE)
- Fixed classifyToken wiring + VMValue handling (must use binop/unop/vmDisplay, not raw s.pop)
- 28 new tests for 850 batch at experiment #238

## 🔜 NEXT
1. Push toward 900 catalog (50 more functions)
2. Compiler optimizations (constant folding, dead code elimination)

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
