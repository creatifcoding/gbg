/**
 * @tmnl/mathkernel — TypeScript ↔ WASM Data Bridge
 *
 * Manages WASM module lifecycle and provides typed wrappers
 * around the raw Embind interface.
 *
 * @module bridge
 */

import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as ServiceMap from "effect-v4/ServiceMap"
import { KernelError } from "./types.js"
import type { KernelErrorCode } from "./types.js"

// ── Raw WASM module type (from Embind .d.ts) ────────────────────────────────

interface WasmKernel {
  // linalg
  mmult(a: Float64Array, m: number, k: number, b: Float64Array, k2: number, n: number): Float64Array
  solve(a: Float64Array, n: number, b: Float64Array): Float64Array
  inverse(a: Float64Array, n: number): Float64Array
  det(a: Float64Array, n: number): number
  transpose(a: Float64Array, rows: number, cols: number): Float64Array
  trace(a: Float64Array, n: number): number
  norm(a: Float64Array, rows: number, cols: number): number
  rank(a: Float64Array, rows: number, cols: number): number
  // decompositions
  svd(a: Float64Array, rows: number, cols: number): any
  qr(a: Float64Array, rows: number, cols: number): any
  cholesky(a: Float64Array, n: number): Float64Array
  eigen(a: Float64Array, n: number): any
  pca(x: Float64Array, n_samples: number, n_features: number, k: number): any
  // regression
  ols(x: Float64Array, n: number, p: number, y: Float64Array, fit_intercept: boolean): any
  ridge(x: Float64Array, n: number, p: number, y: Float64Array, lambda: number, fit_intercept: boolean): any
  lasso(x: Float64Array, n: number, p: number, y: Float64Array, alpha: number, l1_ratio: number, max_iter: number, tol: number, fit_intercept: boolean): any
}

// ── Error classification ────────────────────────────────────────────────────

function classifyWasmError(err: unknown, kernel: string): KernelError {
  const msg = err instanceof Error ? err.message : String(err)
  let code: KernelErrorCode = "Unknown"

  if (msg.includes("DimensionMismatch")) code = "DimensionMismatch"
  else if (msg.includes("SingularMatrix")) code = "SingularMatrix"
  else if (msg.includes("CholeskyFailed")) code = "CholeskyFailed"
  else if (msg.includes("InvalidParameter")) code = "InvalidParameter"
  else if (msg.includes("memory")) code = "OutOfMemory"

  return new KernelError({ code, message: msg, kernel })
}

// ── WasmBridge Service ──────────────────────────────────────────────────────

/**
 * Low-level bridge to the WASM module.
 * Manages the module lifecycle (load, ready check).
 * Higher-level MathKernel service delegates here.
 */
export class WasmBridge extends ServiceMap.Service<WasmBridge, {
  /** Get the raw WASM module (loaded and ready) */
  readonly module: Effect.Effect<WasmKernel, KernelError>
  /** Call a kernel function with error classification */
  readonly call: <A>(kernel: string, fn: (wasm: WasmKernel) => A) => Effect.Effect<A, KernelError>
}>()("tmnl/mathkernel/WasmBridge") {}

/**
 * Create WasmBridge layer from a WASM module loader function.
 * The loader is called once (lazy) and cached.
 */
export const WasmBridgeLive = (
  loadModule: () => Promise<WasmKernel>,
): Layer.Layer<WasmBridge> =>
  Layer.effect(
    WasmBridge,
    Effect.gen(function* () {
      // Lazy-load WASM module — only instantiate on first use
      let cachedModule: WasmKernel | null = null

      const getModule = Effect.gen(function* () {
        if (cachedModule) return cachedModule
        const mod = yield* Effect.tryPromise({
          try: () => loadModule(),
          catch: (err) =>
            new KernelError({
              code: "WasmNotReady",
              message: `Failed to load WASM module: ${err}`,
              kernel: "init",
            }),
        })
        cachedModule = mod
        return mod
      })

      return WasmBridge.of({
        module: getModule,
        call: (kernel, fn) =>
          Effect.gen(function* () {
            const wasm = yield* getModule
            return yield* Effect.try({
              try: () => fn(wasm),
              catch: (err) => classifyWasmError(err, kernel),
            })
          }),
      })
    }),
  )
