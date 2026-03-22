# Autoresearch Ideas — WASM Math Kernel Accuracy

## 📊 STATUS — 832.9 digits, 53 functions, 183 test points, 30 perfect at 16.0 (avg 15.7/fn)

### Strategy
Each new function adds ~15-16 digits. Focus on functions with:
1. Known closed-form or rapidly converging series
2. Stable recurrence relations
3. Available verified reference values

### Completed Functions (53)
airy_ai, airy_bi, bessel_i0/i1/j0/j1/jn/k0/y0/y1, beta_fn, binomial_coeff,
chebyshev_t/u, chi, cosine_integral, dawson, debye1, digamma, double_factorial,
elliptic_e/k, erf_fn, erfc_fn, erfinv, expint_e1, falling_factorial, fresnel_c/s,
gamma_fn, gamma_p, gegenbauer_c, gen_harmonic, harmonic, hermite_h, laguerre_l,
lambertw, legendre_p, lgamma_fn, logit, normsinv, pochhammer, riemann_zeta,
shi, sigmoid, sinc, sine_integral, spence, sph_bessel_j/y, struve_h0, trigamma,
upper_gamma

### Exported but NOT benchmarked (4)
- betainc (series buggy — I_0.5(1,1) gives 0.25 not 0.5)
- catalan_constant (only ~10.9 digits from alternating series)
- clausen (slow convergence ~2 digits at θ=π/2 with 200 terms)
- bessel_k1 (exported, worth benchmarking — check accuracy)

## 🔜 NEXT BATCH — Easy Wins
1. **bessel_k1** — already exported, just benchmark it
2. **jacobi_p** — Jacobi polynomial, forward recurrence like Gegenbauer
3. **associated_laguerre** — L_n^α(x), same stable recurrence
4. **associated_legendre** — P_l^m(x), forward recurrence
5. **log1p** — std::log1p, trivially perfect
6. **expm1** — std::expm1, trivially perfect
7. **cbrt** — std::cbrt, trivially perfect
8. **hypot** — std::hypot, trivially perfect
9. **atanh** — std::atanh, trivially perfect
10. **bessel_yn** — forward recurrence from Y0/Y1
11. **expint_ei** — Ei(x) exponential integral via series/CF

## 📌 DEFERRED
- **betainc** — fix series for regularized incomplete beta
- **clausen** — needs Fourier acceleration for decent digits
- **catalan_constant** — needs Broadhurst formula or Euler acceleration
- **Struve H1** — numerical integration like H0
- **Kelvin functions ber/bei** — real/imag parts of J_0(x√i)
