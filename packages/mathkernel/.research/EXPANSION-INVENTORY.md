# MathKernel Expansion — Full Inventory & Architecture Plan

## Executive Summary

- **2,300** FUNC_MAP entries across **20** domains in the StackVM
- **100** are WASM kernel candidates (compute-heavy, vectorized, or numerically sensitive)
- **17** already implemented (Phase 2A/2B)
- **83** remaining, prioritized into 4 tiers
- Shared C++ primitives duplicated 3× — needs extraction to `common.hpp`
- Elixir NIF path validated via existing `fine` (elixir-nx) + Rustler pattern

## Tier Classification

### Tier 1: DONE (17 functions)
Linear algebra + decompositions + regression. All WASM-backed and tested.

| Kernel | File | Status |
|--------|------|--------|
| mmult, solve, inverse, det, transpose, trace, norm, rank | linalg.cpp | ✅ |
| SVD, QR, Cholesky, eigen, PCA | decompositions.cpp | ✅ |
| OLS, Ridge, Lasso/ElasticNet | regression.cpp | ✅ |

### Tier 2: HIGH IMPACT (24 functions) — Fraudulent stubs
Currently returning averages or zeros. Must be replaced.

| Domain | Functions | Shared Primitives |
|--------|-----------|-------------------|
| Time Series | ARIMA, HOLT, WINTERS, EXPSMOOTH, DOUBLEEXP | Eigen solver, cumulative ops |
| Signal/DSP | DFT_MAG, HILBERT, CONVOLVE, BUTTERWORTH, CHEBYSHEVFILT | FFT via Eigen unsupported, filter coefficient computation |
| Regression Diagnostics | LOGITFIT, PROBITFIT, RESIDUALS, LEVERAGE2, COOKSD, DURBIN_WATSON | OLS internals (hat matrix, residuals) |
| Hypothesis Tests | BOOTSTRAP, JACKKNIFE, ANDERSON, SHAPIRO, KSTEST | Sorting, percentile, resampling |
| Correlation | AUTOCORR, CROSSCORR | Convolution, mean subtraction |
| Distance | MAHALANOBIS | Inverse, matrix ops |

### Tier 3: VECTORIZED (33 functions)
Would benefit from Eigen SIMD vectorization over large arrays.

| Domain | Functions |
|--------|-----------|
| Norms | L1NORM, L2NORM, LINFNORM, LPNORM |
| Similarity | COSINESIM, DOTPROD2, CROSSPROD |
| Info Theory | KLDIVERGE, JSDIVERGE, CROSSENTROPY, RELENTROPY, MUTUALINFO |
| Rolling/Cumulative | EWMA, CUMSUM, CUMPROD, ROLLMAX/MIN/AVG, MOVMEDIAN/STDEV/VAR/RANGE |
| Window Functions | WELCH, HAMMING, HANNING, BLACKMAN, KAISER, TUKEYWIN |
| Transforms | NORMALIZE2, DETREND, DIFFLAG, PCTCHANGE |

### Tier 4: NUMERICAL METHODS (12 functions)
Iterative algorithms with precision benefits from C++ doubles.

| Functions |
|-----------|
| NEWTON_METHOD, BISECT, TRAPEZOID, SIMPSON, ROMBERG |
| EULER_APPROX, GOLDEN_SECTION, REGULA_FALSI, SECANT_METHOD |
| TAYLOR_SIN, TAYLOR_COS, TAYLOR_EXP |

### Tier 5: SPECIAL FUNCTIONS (14 functions)
Mathematical special functions, complex series implementations.

| Functions |
|-----------|
| BESSEL_I0, BESSEL_J0, BESSEL_K0, AIRY, DAWSON |
| FRESNEL_S, FRESNEL_C, ELLIPK, ELLIPE, LAMBERTW |
| LAGUERRE, HERMITE, LEGENDRE, CHEBYSHEV2 |

## Shared Primitives Analysis

### Currently Duplicated (3× across files)
```
js_to_matrix(val, rows, cols) → MatrixXd
js_to_vector(val) → VectorXd
matrix_to_js(MatrixXd) → val
vector_to_js(VectorXd) → val
```

### Proposed common.hpp Extractions
```
// Data marshalling
js_to_matrix, js_to_vector, matrix_to_js, vector_to_js

// Error throwing
throw_dimension_mismatch(expected, got, context)
throw_singular_matrix(context)
throw_convergence_failure(iters, tol, context)

// Statistical primitives (shared by regression, stats, timeseries)
compute_mean(VectorXd) → double
compute_variance(VectorXd, mean) → double
compute_residuals(VectorXd y, MatrixXd X, VectorXd beta) → VectorXd
compute_hat_matrix(MatrixXd X) → MatrixXd
standardize_columns(MatrixXd X) → {MatrixXd, VectorXd means, VectorXd stds}

// Sorting/ranking (shared by stats, hypothesis tests)
sorted_copy(VectorXd) → VectorXd
rank_vector(VectorXd) → VectorXd

// Convolution primitive (shared by signal, correlation)
convolve_1d(VectorXd a, VectorXd b) → VectorXd
```

## Proposed Directory Structure

```
packages/mathkernel/
├── src/
│   ├── cpp/
│   │   ├── common.hpp              ← NEW: shared primitives
│   │   ├── linalg.cpp              ← EXISTING: refactored to use common.hpp
│   │   ├── decompositions.cpp      ← EXISTING: refactored
│   │   ├── regression.cpp          ← EXISTING: refactored
│   │   ├── regression_diag.cpp     ← NEW: logit, probit, Cook's D, DW, leverage
│   │   ├── timeseries.cpp          ← NEW: ARIMA, Holt-Winters, exp smoothing
│   │   ├── signal.cpp              ← NEW: DFT, convolution, filters
│   │   ├── robust_stats.cpp        ← NEW: bootstrap, jackknife, Shapiro-Wilk, KS
│   │   ├── vectorized.cpp          ← NEW: norms, rolling ops, window functions
│   │   ├── numerical.cpp           ← NEW: root-finding, integration, Taylor
│   │   └── special.cpp             ← NEW: Bessel, Airy, Fresnel, etc.
│   ├── ts/
│   │   ├── index.ts                ← barrel exports
│   │   ├── types.ts                ← Schema definitions
│   │   ├── bridge.ts               ← WasmBridge Effect service
│   │   ├── service.ts              ← MathKernel Effect service
│   │   └── vm-bridge.ts            ← StackVM opcode handlers
│   └── nif/                        ← NEW: Elixir NIF path
│       ├── README.md               ← Architecture doc
│       └── mathkernel_nif/         ← Rustler crate (PoC)
│           ├── Cargo.toml
│           └── src/lib.rs
├── test/
│   ├── kernels.test.ts             ← EXISTING: linalg + decomp + regression
│   ├── vm-bridge.test.ts           ← EXISTING: VM opcode handlers
│   ├── timeseries.test.ts          ← NEW
│   ├── signal.test.ts              ← NEW
│   ├── robust-stats.test.ts        ← NEW
│   ├── vectorized.test.ts          ← NEW
│   ├── numerical.test.ts           ← NEW
│   └── special.test.ts             ← NEW
└── dist/
    ├── mathkernel.wasm
    ├── mathkernel.js
    └── mathkernel.d.ts
```

## Implementation Algorithms (Tier 2 Research)

### ARIMA(p,d,q)
- **Algorithm**: Conditional sum of squares (CSS) for parameter estimation
- **Components**: Differencing (d), AR coefficients via Yule-Walker/OLS, MA via innovations
- **Eigen usage**: Matrix solve for Yule-Walker equations, polynomial root-finding for stationarity check
- **Emscripten concern**: No threading — single-threaded CSS optimization is fine
- **Reference test**: ARIMA(1,1,1) on airline passengers dataset → known parameters

### Holt-Winters
- **Algorithm**: Triple exponential smoothing with additive/multiplicative seasonality
- **Components**: Level (α), trend (β), seasonality (γ) equations
- **Eigen usage**: Minimal — mostly scalar recurrence relations
- **Optimization**: Grid search or L-BFGS for α,β,γ (Eigen solvers for L-BFGS Hessian)
- **Reference test**: Monthly data with known trend+season → forecast within tolerance

### DFT / FFT
- **Algorithm**: Cooley-Tukey radix-2 (power-of-2 lengths) with Bluestein for arbitrary
- **Eigen usage**: Eigen::FFT from unsupported modules, or manual Cooley-Tukey
- **Emscripten concern**: Eigen unsupported FFT may not compile — manual Cooley-Tukey is safer
- **Output**: Magnitude spectrum (|X[k]|) for DFT_MAG opcode
- **Reference test**: DFT of known sinusoid → spike at correct frequency bin

### Butterworth Filter
- **Algorithm**: Bilinear transform of analog prototype
- **Steps**: 1) Compute analog poles on unit circle, 2) Bilinear Z-transform, 3) Cascade second-order sections
- **Eigen usage**: Polynomial arithmetic via companion matrices
- **Output**: b,a coefficient arrays (transfer function numerator/denominator)
- **Reference test**: 4th order lowpass at 0.2 normalized freq → known coefficients

### Bootstrap / Jackknife
- **Algorithm**: Resampling with replacement (bootstrap) or leave-one-out (jackknife)
- **Components**: Random index generation, statistic computation per sample
- **Eigen usage**: Vectorized statistic computation over resampled arrays
- **Emscripten concern**: Need deterministic PRNG (not platform rand()) — use std::mt19937
- **Output**: Confidence interval [lower, upper], bias estimate, standard error

### Shapiro-Wilk Test
- **Algorithm**: W = (Σ aᵢ x₍ᵢ₎)² / Σ(xᵢ - x̄)²
- **Components**: Sorted sample, Shapiro-Wilk a-coefficients (tabulated or computed via expected normal order statistics)
- **Eigen usage**: Sorting, dot product, variance computation
- **Key reference**: Royston (1995) algorithm for n > 5000
- **Reference test**: Normal sample → W ≈ 1.0, Uniform sample → W << 1.0

### Kolmogorov-Smirnov Test
- **Algorithm**: D = max|F_n(x) - F(x)| where F_n is empirical CDF, F is reference CDF
- **Components**: Sorted sample, step function comparison
- **Eigen usage**: Sorting, vectorized max
- **Reference test**: Standard normal sample vs N(0,1) CDF → D < critical value

### Autocorrelation / Cross-correlation
- **Algorithm**: r(k) = Σ(x_t - μ)(x_{t+k} - μ) / Σ(x_t - μ)²
- **Eigen usage**: Mean-centered dot products, vectorized lag computation
- **Can share**: convolution primitive (correlation = convolution with time-reversed signal)
- **Reference test**: AR(1) process → exponentially decaying ACF

## Elixir NIF Strategy

### Architecture: Dual-Target Build
```
  Same C++ source (src/cpp/*.cpp)
         │
    ┌────┴────┐
    │         │
  emcc      g++/clang
    │         │
  .wasm     .a (static lib)
    │         │
  Embind    fine.hpp / Rustler
    │         │
  Browser   BEAM VM (Maiden NIF)
```

### Key Pattern (from existing ava_bridge)
- Use `#[rustler::nif(schedule = "DirtyCpu")]` for compute-heavy math
- Rustler calls into C++ static lib via `extern "C"` FFI
- Memory: Pass Elixir binaries as `&[f64]` slices, return Elixir lists/binaries
- `fine.hpp` (Nx team) provides automatic encoding/decoding for NIF args

### PoC Scope
- Compile `linalg.cpp` as native static library (remove Embind, add `extern "C"` wrappers)
- Wrap in Rustler NIF: `mmult(binary, m, k, binary, k2, n) → binary`
- Test from Elixir: `MathKernel.NIF.mmult(<<...>>, 2, 2, <<...>>, 2, 2)`

### Conditional Compilation Strategy
```cpp
#ifdef __EMSCRIPTEN__
  #include <emscripten/bind.h>
  // Embind bindings
#else
  extern "C" {
    // NIF-compatible C API
  }
#endif
```
