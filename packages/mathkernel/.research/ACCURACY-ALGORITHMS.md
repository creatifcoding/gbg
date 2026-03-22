# Special Function Accuracy: Algorithm Reference

## Status (current digits of accuracy)
| Function    | Digits | Target | Algorithm to use |
|-------------|--------|--------|------------------|
| sinc        | 16     | 16     | ✅ Done (sin(πx)/πx) |
| beta_fn     | 15.1   | 15+    | ✅ Done (via gamma) |
| gamma_fn    | 14.4   | 14+    | ✅ Done (Lanczos g=7) |
| fresnel_c   | 15.2   | 15+    | ✅ Done (recurrence series) |
| fresnel_s   | 14.4   | 14+    | ✅ Done (recurrence series) |
| bessel_j0   | 11.7   | 14+    | Consider more series terms |
| bessel_j1   | 11.5   | 14+    | Consider more series terms |
| digamma     | 8.3    | 12+    | More asymptotic terms |
| erf_fn      | 6.6    | 14+    | **Boost-style piecewise rational** |
| erfc_fn     | 4.6    | 12+    | **Boost-style piecewise rational** |
| elliptic_k  | 1.0    | 14+    | **Cephes P-log(x)Q polynomial** |
| elliptic_e  | 0.8    | 14+    | **Cephes P-xlog(x)Q polynomial** |
| dawson      | 0.0    | 14+    | **Cephes piecewise rational** |

## Dawson — Cephes Piecewise Rational (target: ~15 digits)

Three intervals with minimax rational approximations:

### Region 1: |x| < 3.25
- Compute x² = x*x
- y = x * P(x²) / Q(x²)  where P is degree-9, Q is degree-10

### Region 2: 3.25 ≤ |x| < 6.25
- Compute u = 1/(x*x)
- y = 1/x + u * P(u) / (Q1(u) * x)  where P degree-10, Q1 degree-10
- Return sign * 0.5 * y

### Region 3: |x| ≥ 6.25
- Compute u = 1/(x*x)
- y = 1/x + u * P(u) / (Q1(u) * x)  where P degree-4, Q1 degree-5
- Return sign * 0.5 * y

### Region 4: |x| > 1e9
- Return sign * 0.5 / x

Cephes accuracy: peak relative error 6.9e-16 on [0,10].

## Elliptic K — Cephes Polynomial-Log (target: ~15 digits)

Input: modulus k, compute m₁ = 1 - k²

K(k) = P(m₁) - log(m₁) * Q(m₁)

P and Q both degree-10. P[10] = ln(4) ≈ 1.386294361119891.

Cephes accuracy: peak relative error 2.5e-16.

### Coefficients P (degree 10):
```
1.379828646062732e-4, 2.280257240058756e-3, 7.974040132204152e-3,
9.858213790212260e-3, 6.874896874499499e-3, 6.189010336376876e-3,
8.790782739527438e-3, 1.493804489168053e-2, 3.088514652467120e-2,
9.657359028116901e-2, 1.386294361119891
```

### Coefficients Q (degree 10):
```
2.940789550485985e-5, 9.141847238659172e-4, 5.940583037531678e-3,
1.548505166497624e-2, 2.390896027159249e-2, 3.012047152276040e-2,
3.737743141738232e-2, 4.882803475709982e-2, 7.031249969639575e-2,
1.249999999998708e-1, 5.000000000000000e-1
```

## Elliptic E — Cephes Polynomial-Log (target: ~15 digits)

Input: modulus k, compute m = k², x = 1 - m

E(k) = P(x) - x*log(x) * Q(x)

P degree-10, Q degree-9.

Cephes accuracy: peak relative error 2.1e-16.

### Coefficients P (degree 10):
```
1.535525773010133e-4, 2.508884921636021e-3, 8.687868165658896e-3,
1.073509490560762e-2, 7.773954925167871e-3, 7.583952894135147e-3,
1.156884368105741e-2, 2.183179960155573e-2, 5.680519456178606e-2,
4.431471805609909e-1, 1.000000000000000
```

### Coefficients Q (degree 9):
```
3.279548985764859e-5, 1.009627926793567e-3, 6.506094899769275e-3,
1.688621639933113e-2, 2.617697424544937e-2, 3.348339048882249e-2,
4.271809265189315e-2, 5.859366344711011e-2, 9.374999971976443e-2,
2.499999999998883e-1
```

## Erf/Erfc — Boost.Math Piecewise Rational (target: ~15 digits)

### Strategy (53-bit / double):
1. z < 0.5: erf via z * (Y + P(z²)/Q(z²))
2. 0.5 ≤ z < 1.5: erfc via rational in (z - 0.5)
3. 1.5 ≤ z < 2.5: erfc via rational in (z - 1.5)
4. 2.5 ≤ z < 4.5: erfc via rational in (z - 3.5)
5. 4.5 ≤ z < 28: erfc via rational in (1/z)

All scaled by exp(-z²)/z for the erfc paths.

### Region 1 (z < 0.5) coefficients:
Y = 1.044948577880859375
P = [0.0834305892146531832907, -0.338165134459360935041,
     -0.0509990735146777432841, -0.00772758345802133288487,
     -0.000322780120964605683831]
Q = [1.0, 0.455004033050794024546, 0.0875222600142252549554,
     0.00858571925074406212772, 0.000370900071787748000569]
