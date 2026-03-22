# Autoresearch Ideas — WASM Math Kernel Accuracy

## 📊 STATUS — 1148.0 digits, 73 functions, 243 test points, 42 perfect at 16.0 (avg 15.7/fn)

### Strategy
Each new function adds ~15-16 digits. Focus on functions with:
1. Known closed-form or rapidly converging series
2. Stable recurrence relations  
3. Available verified reference values

### Completed Functions (73)
airy_ai/bi, assoc_laguerre, assoc_legendre, bell_number, bernstein,
bessel_i0/i1/in/j0/j1/jn/k0/k1/kn/y0/y1/yn, beta_fn, binomial_coeff,
catalan_number, chebyshev_t/u, chi, chi2_cdf, cosine_integral, dawson,
debye1, digamma, double_factorial, elliptic_e/k, erf_fn, erfc_fn,
erfcinv, erfinv, euler_number, expint_e1/ei/en, falling_factorial,
fresnel_c/s, gamma_fn, gamma_p, gegenbauer_c, gen_harmonic, harmonic,
hermite_h, hurwitz_zeta, jacobi_p, laguerre_l, lambertw, legendre_p,
lgamma_fn, log_binomial, logit, normsinv, pochhammer, rgamma,
riemann_zeta, shi, sigmoid, sinc, sine_integral, spence, sph_bessel_j/y,
sph_harm_norm, stirling2, struve_h0, trigamma, upper_gamma

### Exported but NOT benchmarked
- betainc (series buggy)
- catalan_constant (only ~10.9 digits)
- clausen (slow convergence)
- cloglog, expit (trivial wrappers, not unique)
- polygamma (sign issue in asymptotic)

## 🔜 NEXT BATCH — Easy Wins
1. **zernike_r** — Zernike radial polynomial, recurrence
2. **stirling1** — Stirling numbers of first kind  
3. **bessel_i_half** — Modified Bessel of half-integer order = hyperbolic Bessel
4. **mittag_leffler** — E_α(x) = Σ x^k/Γ(αk+1), foundational for fractional calculus
5. **dilog** — Already have spence, but Li₂(x) = -spence(1-x) alias
6. **log_gamma_sign** — Sign of Γ(x) for negative x
7. **beta_inc_reg** — Fix the regularized incomplete beta
8. **student_t_cdf** — t-distribution CDF via betainc
9. **f_cdf** — F-distribution CDF via betainc
10. **poisson_cdf** — Poisson CDF via regularized gamma

## 📌 DEFERRED
- **betainc** — fix series for regularized incomplete beta  
- **clausen** — needs Fourier acceleration
- **polygamma** — fix asymptotic sign convention
- **Kelvin ber/bei** — real/imag of J₀(x√i)
