# MathKernel Build Journal

## 2026-03-19: Nix + Emscripten Header Collision

### Problem
When building C++ with Emscripten inside a Nix shell, GCC host headers leak into the
Emscripten cross-compile via `C_INCLUDE_PATH`, `CPLUS_INCLUDE_PATH`, and `CPATH`.

**Symptom**: `math.h` from GCC 15.2.0 conflicts with Emscripten's libc++ `math.h`:
```
/nix/store/.../gcc-15.2.0/include/c++/15.2.0/math.h:38:12: error: no member named 'abs' in namespace 'std'
```

### Root Cause
`nix shell` / `mkShell` sets `C_INCLUDE_PATH`, `CPLUS_INCLUDE_PATH`, `CPATH`,
and `NIX_CFLAGS_COMPILE` to include host system headers. Emscripten's clang picks
these up and tries to use GCC's libstdc++ headers alongside its own libc++. Collision.

### Solution
Unset the Nix include-path env vars before running emcc/em++:
```bash
unset CPATH C_INCLUDE_PATH CPLUS_INCLUDE_PATH NIX_CFLAGS_COMPILE NIX_LDFLAGS
```

For the Nix module (`wasm.nix`), this goes in the shellHook. For CI/scripts, 
wrap emcmake/cmake calls with the unsets.

### Also: Emscripten Cache
Nix store is read-only. Emscripten needs a writable cache dir. Either:
- `export EM_CACHE=$HOME/.cache/emsdk` (what we do)
- Copy the store cache to a local `.emscripten_cache/` dir

### References
- https://github.com/emscripten-core/emscripten/issues/24404
- https://github.com/NixOS/nixpkgs/issues/15636
- https://discourse.nixos.org/t/improving-an-emscripten-yarn-dev-shell-flake/33045

### Assumptions Validated
- ✅ `pkgs.emscripten` provides emcc 4.0.22 with full toolchain
- ✅ `pkgs.eigen` provides Eigen 3.4.1 headers at `$EIGEN_STORE/include/eigen3/`
- ✅ CMake + emcmake cmake configures correctly
- ❌ `nix shell` env vars are safe for cross-compile (they aren't — must unset)
- ✅ Fix: unset C/C++ path vars before emcc invocation
- ✅ WASM builds: 89KB .wasm + 32KB .js glue + .d.ts type defs
- ✅ All 8 linalg kernels smoke-tested in Node: mmult, solve, inverse, det, transpose, trace, norm, rank
- ✅ Numerical accuracy confirmed (det=10, trace=7, rank=2, solve=[1.4, 0.8])

## Build Output Profile (Phase 2A linalg only)
- mathkernel.wasm: 89KB
- mathkernel.js:   32KB (ES6 module, MODULARIZE=1)
- mathkernel.d.ts: 670B (auto-generated Embind types)
- Build time: ~15s (first build incl. syslib cache), ~2s incremental
- Memory config: 16MB initial, 256MB max, 1MB stack, ALLOW_MEMORY_GROWTH=1

## 2026-03-19: Critical Path Complete

### Phases Done
- **Phase 0** (Toolchain): Nix module, NX package, CMake, Eigen via env var, verified build
- **Phase 1** (Effect Service): KernelError type contracts, WasmBridge service, MathKernel ServiceMap.Service
- **Phase 2A** (Linear Algebra): mmult, solve, inverse, det, transpose, trace, norm, rank
- **Phase 2A** (Decompositions): SVD, QR, Cholesky, eigenvalues, PCA
- **Phase 2B** (Regression): OLS, Ridge, Lasso, ElasticNet (coordinate descent)
- **Phase 3** (VM Bridge): LEASTSQ_N, RIDGE_N, LASSO_N, ELASTICNET_N opcode handlers

### Build Profile (all kernels)
- mathkernel.wasm: 175KB
- mathkernel.js:    29KB (ES6 module)
- mathkernel.d.ts:  1.2KB (auto-generated)
- Build: ~3s incremental, ~15s clean (first syslib cache ~25s)

### Test Suite
- 31 tests, 2 test files, 367ms total
- Numerical accuracy validated against known mathematical results
- Error handling validated (singular matrix, dimension mismatch, non-PD)

### Key Learnings
1. Nix `CPATH`/`CPLUS_INCLUDE_PATH` must be unset for Emscripten cross-compile
2. C++ exceptions need `-fwasm-exceptions` to propagate as WebAssembly.Exception
3. Embind functions are synchronous — VM dispatch table can call them directly
4. Effect v4 Schema: use `Schema.Literals([...] as const)` (array arg), `Schema.instanceOf(Float64Array)`
5. Eigen headers delivered via Nix env var, NOT vendored — saves 4MB in git

## 2026-03-19: 100 WASM Functions Milestone

### Achievement
Built and compiled **100 WASM-exported C++ functions** across 10 source files (3,226 LOC).
Output: 1.8MB .wasm (debug), 105KB .js glue, auto-generated .d.ts with 100 typed exports.

### Source Files (10)
| File | Functions | Domain |
|------|-----------|--------|
| `common.hpp` (278 LOC) | 0 (shared) | Data marshalling, stat primitives, error helpers |
| `linalg.cpp` (101 LOC) | 8 | mmult, solve, inverse, det, transpose, trace, norm, rank |
| `decompositions.cpp` (129 LOC) | 5 | svd, qr, cholesky, eigen, pca |
| `regression.cpp` (196 LOC) | 3 | ols, ridge, lasso/elasticnet |
| `regression_diag.cpp` (317 LOC) | 6 | logit_fit, probit_fit, leverage, cooks_distance, durbin_watson, standardized_residuals |
| `timeseries.cpp` (330 LOC) | 6 | exp_smooth, double_exp_smooth, holt_winters, seasonal_avg, detrend, arima_forecast |
| `signal.cpp` (297 LOC) | 5 | dft_magnitude, hilbert_envelope, convolve, butterworth, chebyshev_filter |
| `robust_stats.cpp` (381 LOC) | 8 | bootstrap, jackknife, shapiro_wilk, ks_test, anderson_darling, autocorrelation, crosscorrelation, mahalanobis |
| `vectorized.cpp` (456 LOC) | 33 | norms(4), similarity(3), info_theory(5), rolling_stats(10), windows(6), transforms(5) |
| `numerical.cpp` (411 LOC) | 12 | root_finding(4), integration(4), taylor(3), optimization(1) |
| `special.cpp` (330 LOC) | 14 | bessel(3), oscillatory(4), elliptic(2), other(5) |

### Build Issues Resolved
1. **Eigen Matrix/Array mixing**: Ternary operator can't mix Array and Matrix expressions.
   Fix: Explicit `.matrix()` or if/else instead of ternary.
2. **Probit IRLS working response**: Operator precedence bug in original code — `== 0 ?` applied
   to wrong subexpression. Fixed with explicit if/else and `norm_pdf` threshold check.

### Build Command
```bash
bash scripts/build-wasm.sh
```
