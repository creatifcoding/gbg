# Autoresearch Ideas — Formula DSL Stack VM

## ✅ STATUS — 260 experiments, 920 tests (840+80), 1350 UNIQUE CATALOG, ~13,032 LOC

### This session (257→260)
- 1249 → 1350 unique catalog (+101 functions)
- 867 → 920 tests (+53 new)
- Key domains: combinatorics, info theory, figurate numbers, numerical methods, time-series forecasting, text hashing/soundex, number theory classification, financial risk metrics

## 🔜 NEXT
1. Push to 1400 unique catalog
2. More tests toward 1000
3. Compiler constant folding optimization

## 📌 DEFERRED
- MMULT/MINVERSE with true 2D matrix
- Full LAMBDA closure support
- WASM compilation target

## WASM Kernel Accuracy — Current State (188.4/208 digits, 9 experiments)

### Completed optimizations:
- ✅ Dawson: Cephes piecewise rational (0→13.4 digits)
- ✅ Fresnel S/C: Recurrence series (0→14.4/15.2 digits)
- ✅ Elliptic K/E: Cephes P-log(x)Q polynomial (1→16 digits)
- ✅ Erf: Taylor+Kahan for |x|<3.5 (6.6→13.5 digits)
- ✅ Erfc: Laplace CF 100 iterations (4.6→13.2 digits)
- ✅ Digamma: 7 Bernoulli terms, shift x>10 (8.3→15 digits)
- ✅ Bessel J0/J1: Cephes rational approx (11.7→12.1/11.5→14.1)

### Remaining improvement opportunities:
- **Bessel J0 at x=10**: Hankel branch gives 12.1 digits — Cephes claims 4.2e-16 peak, needs coefficient verification
- **Erf/Erfc (13.2-13.5)**: Boost-style piecewise rational would give ~15 digits — requires extracting all P/Q tables for 53-bit path
- **Dawson (13.4)**: Already at Cephes quality — diminishing returns
- **Bessel Jn**: Miller backward recurrence normalized by J0 — accuracy depends on J0 quality
- **Consider std::erf/std::erfc**: C++ standard library implementations on modern compilers may use hardware-optimized paths
