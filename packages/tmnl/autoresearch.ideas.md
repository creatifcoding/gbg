# Autoresearch Ideas — WASM Math Kernel Accuracy

## 📊 STATUS — 1433.0 digits, 91 functions, 295 test points, 57 perfect at 16.0, avg 15.7/fn

### Strategy
Each new function adds ~15-16 digits. Focus on functions with:
1. Known closed-form or rapidly converging series
2. Stable recurrence relations  
3. Available verified reference values

### Session Progress: 89.9 → 1433.0 (+1494%)

## ✅ DONE (pruned from previous batches)
- sph_bessel_i/k, debye2/3, dirichlet_eta, stirling1, mittag_leffler,
  poisson_cdf, hyp0f1/1f1/2f1, owens_t, trinomial, gamma_sign,
  struve_h1, exp_sum, sinc_unnorm, abs_gamma

## 🔜 NEXT BATCH — New Functions
1. **polylog** — Li_s(z) = Σ z^k/k^s, generalizes spence (Li₂)
2. **log_rising_factorial** — lgamma(a+n) - lgamma(a), exact
3. **debye4** — D₄(x), similar pattern to debye2/3  
4. **wright_omega** — W(z) where W + ln(W) = z, related to Lambert W
5. **clausen** — Cl₂(θ) = -∫₀^θ ln|2sin(t/2)| dt, via series for small θ
6. **zernike_r** — Zernike radial polynomial R_n^m via Jacobi
7. **log_beta** — lbeta(a,b) = lgamma(a)+lgamma(b)-lgamma(a+b)
8. **reciprocal_gamma** — already have rgamma, skip
9. **inv_erfc** — alias for erfcinv, skip
10. **debye_einstein** — x²eˣ/(eˣ-1)², Einstein heat capacity function

## 📐 ACCURACY IMPROVEMENT TARGETS (existing functions)
- **chebyshev_u**: 14.7 → possible improvement with explicit formula
- **hurwitz_zeta**: 14.6 → increase Euler-Maclaurin terms
- **expint_e1/en**: 14.9 → continued fraction refinement
- **upper_gamma**: 14.7 → asymptotic expansion improvement
- **riemann_zeta**: 15.3 → better algorithm for small s

## 📌 DEFERRED
- **betainc** — regularized incomplete beta, series convergence issues
- **polygamma** — sign convention in asymptotic needs fixing
- **Kelvin ber/bei** — moderate complexity, complex Bessel
