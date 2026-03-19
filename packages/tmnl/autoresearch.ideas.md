# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 216 experiments, 604 tests, 572 opcodes, 600 CATALOG ENTRIES

Production: 8,489 LOC | Tests: ~3,500 LOC | Benchmark: ~290-350ms (~53-61% below 751ms)

### Category breakdown (600 catalog)
math:158 | stat:137 | text:91 | info:79 | financial:61 | lookup:40 | logic:28 | volatile:6

### Session achievements (208→216)
- Hit **600 CATALOG** milestone at experiment #215
- Added number theory (ISPRIME/NEXTPRIME/PRIMECOUNT/TOTIENT/DIVISORS)
- Added string distance (TEXTHAMMING/TEXTLEV — Levenshtein!)
- Added financial depreciation (SLN/SYD/DDB) + rates (CAGR/EFFECT.RATE/NOMINAL)
- Added logic gates (NAND/NOR/XNOR)
- Added text utilities (TEXTPADSTART/TEXTPADEND/TEXTWRAP/CHARCODE/FROMCHARCODE)
- Added math (DIGSUM/DIGROOT/NTHROOT/FIBONACCI/COLLATZ)
- Added stat (ENTROPY/GINI/WINSORIZE/COEFVAR/ZSCORE/PERCENTRANK)
- Added info validators (ISALPHANUM/ISALPHA/CELLTYPE/CHECKSUM)

## 🔜 NEXT
1. **Wire FormulaEngineV2 into production** — connect to CellCache + AG-Grid
2. Compiler optimizations (constant folding, dead code elimination)
3. Clean up accumulated duplicate _OP pool entries from prior sessions
4. Push toward 650+ catalog

## 📌 DEFERRED
- MMULT/MINVERSE with true 2D matrix
- Full LAMBDA closure support  
- WASM compilation target
- Worker thread offloading
