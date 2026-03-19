# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 229 experiments, 680 tests, 700 CATALOG, ~9,501 LOC

### Category breakdown (700 catalog)
math:198 | stat:145 | text:112 | info:92 | financial:74 | lookup:42 | logic:31 | volatile:6

### This session (217→229)
- Hit **650 CATALOG** at experiment #222
- Hit **700 CATALOG** at experiment #228
- Added 50+ new functions: waves (SAWTOOTH/SQUAREWAVE/TRIANGLEWAVE), ciphers (ROT13/CAESAR), combinatorics (BINOMCOEF/CATALAN/BELL), figurate numbers, number theory (ISPERFECT/ISHARSHAD/ABUNDANCY), geometry (CIRCLEAREA/SPHEREVOL/CYLINDERVOL/CONEVOL), text compression (RLE/RLD), text analysis (TEXTFREQ/TEXTDISTINCT/TEXTSIMILARITY), stat (KURTOSIS/SKEWNESS/RMS/IQR/MAPE), financial (WACC/ROI/BREAKEVEN/ANNUITY), constants (GOLDEN/TAU), etc.
- Fixed N_VARIANTS registration, asBool→inline truthy, gammaLn removal

## 🔜 NEXT
1. Push toward 750 catalog
2. Compiler optimizations (constant folding, dead code elimination)
3. Clean up accumulated duplicate _OP pool entries (Vite warnings)

## 📌 DEFERRED
- MMULT/MINVERSE with true 2D matrix
- Full LAMBDA closure support
- WASM compilation target
- Worker thread offloading
- Wire FormulaEngineV2 into production (CellCache + AG-Grid)
