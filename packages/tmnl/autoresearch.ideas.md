# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 223 experiments, 646 tests, 650 CATALOG, ~9,003 LOC

### Category breakdown (650 catalog)
math:179 | stat:141 | text:101 | info:84 | financial:67 | lookup:41 | logic:31 | volatile:6

### This session (217→223)
- Hit **650 CATALOG** milestone at experiment #222
- 22-fn batch: Geometry, Stat (KURTOSIS/SKEWNESS/GEOMEAN2/HARMEAN2), Financial (WACC/ROI/BREAKEVEN), Logic (ALL2/ANY2/NONE2)
- 18-fn batch: Trig (DEG2RAD/RAD2DEG/SINC), Combinatorics (BINOMCOEF/CATALAN/TRIANGLENUM), Text (TEXTMORSE/TEXTSTRIP), Financial (PROFITMARGIN/MARKUP)
- 10-fn batch: Figurate numbers (PENTAGONAL/HEXAGONAL/TETRAHEDRAL/PYRAMIDAL), Number theory (ISPERFECT/ISHARSHAD), Text compression (TEXTRLE/TEXTRLD)
- Fixed N_VARIANTS registration bug, asBool→inline truthy pattern

## 🔜 NEXT
1. Push toward 700 catalog
2. Compiler optimizations (constant folding, dead code elimination)  
3. Clean up accumulated duplicate _OP pool entries (Vite warnings)

## 📌 DEFERRED
- MMULT/MINVERSE with true 2D matrix
- Full LAMBDA closure support
- WASM compilation target
- Worker thread offloading
- Wire FormulaEngineV2 into production (CellCache + AG-Grid)
