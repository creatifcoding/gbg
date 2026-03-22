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

## WASM Kernel Accuracy — Current State (801.1 digits, 51 functions, 33 experiments, avg 15.7 digits/fn)

### Completed optimizations (16 functions):
- ✅ Dawson: Cephes piecewise rational (0→15.0 digits)
- ✅ Fresnel S/C: Cephes rational + auxiliary f/g (0→15.6/15.5 digits)
- ✅ Elliptic K/E: Cephes P-log(x)Q polynomial (1→16 digits)
- ✅ Erf/Erfc: std::erf/std::erfc (6.6→16.0 / 4.6→15.7 digits)
- ✅ Digamma: 7 Bernoulli terms, shift x>10 (8.3→15 digits)
- ✅ Bessel J0/J1: Cephes rational + Hankel (11.7→15.8 / 11.5→15.5)
- ✅ Bessel Jn: Miller backward recurrence (NEW, 15.4 digits)
- ✅ Bessel Y0: Cephes rational + log·J0 (NEW, 14.7 digits)
- ✅ Gamma/Beta: std::tgamma/lgamma (14.4→15.9 / 15.1→16.0)
- ✅ lgamma: std::lgamma (NEW, 15.8 digits)
- ✅ Sinc: sin(πx)/(πx) (16.0 digits — perfect)
- ✅ Reference values audited via Simpson quadrature & Cephes Python

### CRITICAL LESSON: Build Verification
The biggest gain (202→244, +21%) came from discovering that special.cpp had COMPILE ERRORS
that were hidden by piping build output through `tail -3`. The Cephes implementations were
never actually compiled — old .wasm artifacts were silently reused. Forward declarations
of polevl/p1evl fixed the build, and all Cephes algorithms immediately showed 15+ digit accuracy.

### LESSON: Reference Value Accuracy
Several "algorithm improvements" were actually just fixing bad reference values:
- J0(10): Series-computed reference had cancellation error → fixed with Cephes Python
- Dawson D(5): Old "Wolfram" reference was 4.3e-15 off → verified via 1M-point Simpson

### Implemented (29 functions, 12 perfect at 16.0):
- ✅ bessel_y1 (Wronskian, 15.0)
- ✅ bessel_i0 / i1 (series, 16.0/16.0)
- ✅ bessel_k0 (series+harmonic, 15.0)
- ✅ expint_e1 (Lentz CF, 14.9)
- ✅ riemann_zeta (eta+Kahan, 15.3)
- ✅ spence/Li₂ (series+reflections, 15.9)
- ✅ trigamma (asymptotic+Bernoulli, 15.7)
- ✅ airy_ai (ODE Taylor, 15.4)
- ✅ laguerre_l / hermite_h / legendre_p / chebyshev_t (recurrence, all 16.0)

### Not yet implemented — next batch:
- **bessel_k1**: Numerical derivative of K0 only gets ~10 digits. Need direct series.
- **airy_bi**: Similar ODE recurrence as Ai, different initial conditions
- **shi / chi**: Hyperbolic sine/cosine integrals. Easy series.
- **bessel_y_n**: Higher-order Y via forward recurrence from Y0/Y1
- **jacobi_p**: Jacobi polynomial P_n^{α,β}(x)
- **gegenbauer_c**: Gegenbauer/ultraspherical polynomial
- **incomplete_gamma**: γ(a,x) — series + CF
- **incomplete_beta**: I_x(a,b) — series + CF
