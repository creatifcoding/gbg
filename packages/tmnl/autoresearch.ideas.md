# Autoresearch Ideas — WASM Math Kernel Accuracy

## 📊 STATUS — 1354.0 digits, 86 functions, 282 test points, 52 perfect at 16.0 (60%), avg 15.7/fn

### Strategy
Each new function adds ~15-16 digits. Focus on functions with:
1. Known closed-form or rapidly converging series
2. Stable recurrence relations  
3. Available verified reference values

### Session Progress: 89.9 → 1354.0 (+1406%)

## 🔜 NEXT BATCH — Easy Wins
1. **zernike_r** — Zernike radial polynomial, Jacobi-based
2. **log_rising_factorial** — log(a)_n via lgamma
3. **reciprocal_sqrt** — 1/√x wrapper
4. **sph_bessel_in / sph_bessel_kn** — Modified spherical Bessel functions
5. **debye2/3/4** — Higher Debye functions
6. **kelvin_ber/bei** — Re/Im of J₀(x·√i)  
7. **wright_omega** — Related to Lambert W
8. **dirichlet_eta** — η(s) = (1-2^{1-s})ζ(s)
9. **riemann_xi** — Entire form of zeta
10. **polylog** — Li_s(z) polylogarithm

## 📌 DEFERRED
- **betainc** — fix series for regularized incomplete beta  
- **clausen** — needs Fourier acceleration for digits
- **polygamma** — fix asymptotic sign convention
- **Kelvin functions** — moderate complexity
