# Autoresearch Ideas — WASM Math Kernel Accuracy

## 📊 STATUS — 1658.0 digits, 105 functions, 335 test points, 71 perfect at 16.0 (67.6%), avg 15.79/fn

### Session Progress: 89.9 → 1658.0 (+1744%)

## 🔜 NEXT BATCH — New Functions
1. **fibonacci** — F(n) via Binet's formula or recurrence
2. **lucas** — L(n) = F(n-1) + F(n+1)  
3. **riemann_xi** — ξ(s) = s(s-1)/2 · π^{-s/2} · Γ(s/2) · ζ(s)
4. **dilog** — alias for Li₂ but with different convention
5. **gudermannian** — gd(x) = 2·atan(tanh(x/2))
6. **inv_gudermannian** — gd⁻¹(x) = atanh(sin(x))
7. **softplus** — ln(1 + eˣ), smooth ReLU
8. **log1p_exp** — log(1+eˣ) = softplus, with numerically stable formula
9. **logaddexp** — log(eˣ + eʸ), numerically stable
10. **agm** — Arithmetic-geometric mean M(a,b)

## 📐 ACCURACY IMPROVEMENT TARGETS
- **chebyshev_u**: 14.7 → explicit formula for U_n(cos θ) = sin((n+1)θ)/sin(θ)
- **expint_e1/en**: 14.9 → more CF terms
- **chi2_cdf**: 15.1 → regressed from upper_gamma change

## 📌 DEFERRED
- **betainc** — regularized incomplete beta convergence
- **polygamma** — sign convention fix
