# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 234 experiments, 714 tests, 750 CATALOG, ~9,953 LOC

### Category breakdown (750 catalog)
math:209 | stat:151 | text:126 | info:102 | financial:82 | lookup:42 | logic:32 | volatile:6

### This session (230→234)
- Hit **750 CATALOG** at experiment #233
- 60-function batch: Number theory (COPRIME/COLLATZ/PREVPRIME/FIBONACCI2/MOTZKIN/DERANGEMENT/TOTIENT2/HARMONIC2/ISFIBBISH), Conversions (TOROMAN/FROMROMAN/TOORDINAL), Text (TEXTHEX/TEXTFROMHEX/TEXTDEDUPE/TEXTLINES/TEXTPASCALCASE/TEXTOBFUSCATE/TEXTCOUNT2/TEXTSHUFFLE/TEXTPAD/TEXTMASK/WORDSCOUNT/TEXTISURL/TEXTISEMAIL), Stat (WMEAN/GINI2/AVEDEV2/COVAR2/CORREL2/COSSIM), Info (ISPOWEROFTWO/ISPRIMEFAST/ISLEAPYEAR/WEEKOFYEAR/ISWEEKEND/QUARTERNO/SEMESTERNO), Financial (SHARPE/SORTINO/EMAVG/SMAVG/EFFECTRATE/NOMRATE/NPER2/RATE2), Logic (ISCOPRIMEALL), Math (CHEBYSHEV/NEXTODD/NEXTEVEN)
- Fixed duplicate schema exports (CAGR_OP, COSH_OP, etc. already existed)

## 🔜 NEXT
1. Push toward 800 catalog
2. Compiler optimizations (constant folding, dead code elimination)

## 📌 DEFERRED
- MMULT/MINVERSE with true 2D matrix
- Full LAMBDA closure support
- WASM compilation target
- Worker thread offloading
- Wire FormulaEngineV2 into production (CellCache + AG-Grid)
