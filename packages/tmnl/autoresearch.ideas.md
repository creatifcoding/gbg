# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 248 experiments, 881 tests, 1047 UNIQUE CATALOG, ~11,765 LOC

### Category breakdown (1047 unique catalog)
math:264 | stat:199 | text:168 | info:130 | financial:116 | logic:88 | lookup:80 | volatile:20

### This session
- Discovered 58 phantom duplicates from prior batches, deduped to honest 942
- Rebuilt to honest 1047 with collision-checked additions
- Added waveforms (HEAVISIDE/RAMP/GAUSSIAN2/BOXCAR/TRIANGLE2/SAWTOOTH2)
- Added windowing functions (WELCH/HAMMING/HANNING/BLACKMAN/KAISER/TUKEYWIN)
- Added ML metrics (GINIIMPURITY/INFOGAIN)
- Added number theory (ISCUBE/ISCOPRIME/ISTRIANGULAR/ISPENTAGONAL/ISHEXAGONAL/ISHARSHAD)

## ⚠️ LESSONS LEARNED
- ALWAYS check for existing names before adding — accumulated 58 duplicates across sessions
- Python add scripts MUST check both `name:` in catalog AND `_OP`/`_N` tags in schemas
- EXEC implementations from later batches SHADOW earlier ones (JS object last-key-wins)
- Never hardcode EXEC implementations for "skipped" names — the skip logic must be in the impl block too

## 🔜 NEXT
1. Push toward 1100 unique catalog with collision checking
2. More tests to increase coverage
3. Compiler optimizations: constant folding, dead code elimination

## 📌 DEFERRED
- MMULT/MINVERSE with true 2D matrix
- Full LAMBDA closure support
- WASM compilation target
- Worker thread offloading
