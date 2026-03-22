# Autoresearch Ideas — WASM Math Kernel Accuracy

## 📊 STATUS — 1833.2 digits, 116 functions, 362 test points, 81 perfect at 16.0 (69.8%), avg 15.80/fn

### Session Progress: 89.9 → 1833.2 (+1939%)

## 🔜 NEXT BATCH — New Functions (to push toward 2000)
1. **logaddexp** — log(eˣ + eʸ) = max(x,y) + log(1 + e^{-|x-y|}), numerically stable
2. **expm1** — e^x - 1, numerically stable for small x (std::expm1)
3. **log1p** — ln(1+x), numerically stable for small x (std::log1p)
4. **cbrt** — ∛x (std::cbrt)
5. **hypot** — √(x²+y²) (std::hypot)
6. **sec/csc/cot** — Reciprocal trig functions
7. **sech/csch/coth** — Reciprocal hyperbolic functions
8. **sinpi/cospi** — sin(πx), cos(πx) with exact values at half-integers
9. **ldexp** — x·2ⁿ (std::ldexp)
10. **comp_elliptic_d** — Complementary complete elliptic integral D(k)

## 📐 ACCURACY IMPROVEMENT TARGETS
- **chebyshev_u**: 14.7 → can use sin((n+1)arccos(x))/sin(arccos(x))
- **expint_e1/en**: 14.9 → better CF
- **chi2_cdf**: 15.1 → test point selection

## 📌 DEFERRED
- **betainc** — regularized incomplete beta convergence
- **polygamma** — sign convention fix
- **riemann_zeta at s=2** — fundamental accuracy limited to ~10 digits
