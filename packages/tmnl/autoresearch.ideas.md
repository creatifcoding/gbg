# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 236 experiments, 744 tests, 800 CATALOG, ~10,360 LOC

### Category breakdown (800 catalog)
math:217 | stat:158 | text:134 | info:108 | financial:88 | lookup:50 | logic:39 | volatile:6

### This session (235→236)
- Hit **800 CATALOG** at experiment #235
- 50-function batch: Lookup (BINSEARCH/INDEXMATCH/LASTINDEXOF/FINDALL/COUNTUNIQ/ARRAYCONTAINS/ARRAYPOS/FLATTEN2), Logic (IFF/SWITCH2/XORALL/NANDALL/NORALL/COALESCE2/UNLESS), Math (SECANT/COSECANT/VERSINE/HAVERSINE/EXSECANT/LEMNISCATE/AGM2/POWMOD), Stat (MAD2/ZSCORE2/TSTAT/FSTAT/CHISQSTAT/SEM/POOLEDVAR), Text (TEXTCOUNTCHAR/TEXTZFILL/TEXTLPAD/TEXTRPAD/TEXTABBREV/TEXTWORDFREQ/TEXTSANITIZE/TEXTMIRROR), Info (TYPEOF3/ISBLANK2/ISTRUTHY/ISFALSY/ISFRACTION/ISDIVISIBLE), Financial (PVANNUITY/ANNUITYPMT/BONDPRICE/BONDYIELD/TBILL2/MACAULAY)
- Fixed N_VARIANTS wiring bug for new variadic functions

## 🔜 NEXT
1. Push toward 850 catalog
2. Compiler optimizations (constant folding, dead code elimination)

## 📌 DEFERRED
- MMULT/MINVERSE with true 2D matrix
- Full LAMBDA closure support
- WASM compilation target
- Worker thread offloading
- Wire FormulaEngineV2 into production (CellCache + AG-Grid)
