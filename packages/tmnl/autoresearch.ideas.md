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

### WASM/Emscripten Precision Limitation (DISCOVERED)
Emscripten WASM produces ~2e-12 accuracy for Cephes-style rational approximations where
native C++ and JavaScript V8 both achieve ~1e-15. Affects:
- Bessel J0(10) Hankel branch: 8.5e-13 in WASM vs 7e-15 native
- Fresnel S/C(3) auxiliary functions: 2e-12 in WASM vs 2e-15 native
- Not an FMA issue (tested with -ffp-contract=off and volatile)
- Not optimizer issue (tested with noinline, -O0)
- Appears to be fundamental to Emscripten's codegen or musl math library
- Standard library functions (std::erf, std::tgamma) have the same accuracy as our custom code

### Remaining improvement paths (with WASM limitation):
- **Add more functions**: Currently 14/100 exports benchmarked. lgamma, bessel_y0/y1, modified Bessel I0/I1 could add ~14 digits each
- **Bessel J0 (12.1)**: At WASM precision ceiling for Hankel at x=10. Cannot improve without fixing Emscripten
- **Erf/Erfc (13.2-13.5)**: At musl std::erf/erfc precision. Same as custom implementation
- **Dawson (13.4)**: At Cephes quality — diminishing returns
- **Gamma (14.4)**: At std::tgamma quality. Stirling for large args won't help (test point is Γ(10))
- **Reference value auditing**: Several improvements came from correcting reference values (J0(10), J5(3)). More test points could shift digits

### Deferred:
- Implement bessel_y0, bessel_i0, lgamma in C++ → 3 more benchmark functions → +42 potential digits
- Investigate Emscripten 4.0 or -s STANDALONE_WASM for potentially better precision
