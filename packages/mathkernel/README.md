# @tmnl/mathkernel

WASM compute substrate for `@tmnl/datagrid` — real linear algebra, regression, decomposition, time series, DSP, and statistics powered by **C++20 / Eigen / Emscripten**.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  @tmnl/datagrid StackVM   │  Codemode Overlay   │
│  =RIDGE(A1:A10,B1:B10,λ) │  ms.ridge(xs,ys,λ)  │
└──────────┬────────────────┴──────────┬──────────┘
           │     Effect.Service (DI)    │
           ▼                           ▼
┌─────────────────────────────────────────────────┐
│            MathKernel Service (TS)               │
│  Layer-scoped WASM lifecycle                     │
│  Dual-channel errors: VMError | Effect E         │
│  Float64Array ↔ WASM heap bridge                 │
└──────────────────────┬──────────────────────────┘
                       │ Embind
┌──────────────────────▼──────────────────────────┐
│            WASM Module (C++20)                   │
│  Eigen 3.4 · mmult · solve · inverse · det      │
│  OLS · Ridge · Lasso · ElasticNet · SVD · PCA    │
│  ARIMA · Holt-Winters · FFT · Bootstrap          │
└─────────────────────────────────────────────────┘
```

## Requirements

- Nix devshell (`nix develop`) — provides Emscripten, CMake, Eigen
- Or: Emscripten SDK 4.x, CMake 3.20+, Eigen 3.4+ installed manually

## Build

```bash
# In Nix devshell:
bun run build:wasm    # C++ → WASM via Emscripten
bun run build:ts      # TypeScript service layer
bun run build         # Both

# Or via NX:
nx run @tmnl/mathkernel:build
```

## Test

```bash
bun run test:run
# or
nx run @tmnl/mathkernel:test
```

## Phases

| Phase | Feature | Status |
|-------|---------|--------|
| 0 | Toolchain & scaffold | 🔨 In progress |
| 1 | MathKernel Effect.Service | ⏳ |
| 2A | Linear algebra (Eigen) | ⏳ |
| 2B | Regression (OLS, Ridge, Lasso) | ⏳ |
| 2C | Time series (ARIMA, Holt-Winters) | ⏳ |
| 2D | Signal processing (FFT, filters) | ⏳ |
| 2E | Robust statistics | ⏳ |
| 2F | JS↔WASM streaming foundation | ⏳ |
| 3 | Stack VM bridge | ⏳ |
| 4 | Codemode overlay | ⏳ |

## Vendored Dependencies

- **Eigen 3.4.x** — header-only, in `vendor/eigen/` (or system via Nix)
- **KissFFT** — Phase 2D, in `vendor/kissfft/` (when added)
