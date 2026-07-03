/**
 * @tmnl/mathkernel — MathKernel Effect Service
 *
 * Context.Service providing typed math operations backed by WASM.
 * Two integration surfaces:
 * 1. StackVM bridge (range-via-CellContext → Float64Array → result)
 * 2. Codemode overlay (plain JS arrays → result)
 *
 * @module service
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Context from "effect/Context"
import { WasmBridge } from "./bridge.js"
import { KernelError } from "./types.js"
import type {
  RegressionResult,
  SparseRegressionResult,
  SVDResult,
  QRResult,
  EigenResult,
  PCAResult,
} from "./types.js"

// ═══════════════════════════════════════════════════════
// MATHKERNEL SERVICE
// ═══════════════════════════════════════════════════════

export class MathKernel extends Context.Service<MathKernel, {
  // ── Linear Algebra ──────────────────────────────────
  readonly mmult: (a: Float64Array, m: number, k: number, b: Float64Array, k2: number, n: number) => Effect.Effect<Float64Array, KernelError>
  readonly solve: (a: Float64Array, n: number, b: Float64Array) => Effect.Effect<Float64Array, KernelError>
  readonly inverse: (a: Float64Array, n: number) => Effect.Effect<Float64Array, KernelError>
  readonly det: (a: Float64Array, n: number) => Effect.Effect<number, KernelError>
  readonly transpose: (a: Float64Array, rows: number, cols: number) => Effect.Effect<Float64Array, KernelError>
  readonly trace: (a: Float64Array, n: number) => Effect.Effect<number, KernelError>
  readonly norm: (a: Float64Array, rows: number, cols: number) => Effect.Effect<number, KernelError>
  readonly rank: (a: Float64Array, rows: number, cols: number) => Effect.Effect<number, KernelError>

  // ── Decompositions ──────────────────────────────────
  readonly svd: (a: Float64Array, rows: number, cols: number) => Effect.Effect<SVDResult, KernelError>
  readonly qr: (a: Float64Array, rows: number, cols: number) => Effect.Effect<QRResult, KernelError>
  readonly cholesky: (a: Float64Array, n: number) => Effect.Effect<Float64Array, KernelError>
  readonly eigen: (a: Float64Array, n: number) => Effect.Effect<EigenResult, KernelError>
  readonly pca: (x: Float64Array, n_samples: number, n_features: number, k: number) => Effect.Effect<PCAResult, KernelError>

  // ── Regression ──────────────────────────────────────
  readonly ols: (x: Float64Array, n: number, p: number, y: Float64Array, fit_intercept?: boolean) => Effect.Effect<RegressionResult, KernelError>
  readonly ridge: (x: Float64Array, n: number, p: number, y: Float64Array, lambda: number, fit_intercept?: boolean) => Effect.Effect<RegressionResult, KernelError>
  readonly lasso: (x: Float64Array, n: number, p: number, y: Float64Array, alpha: number, l1_ratio?: number, max_iter?: number, tol?: number, fit_intercept?: boolean) => Effect.Effect<SparseRegressionResult, KernelError>
}>()("tmnl/mathkernel/MathKernel") {}

// ═══════════════════════════════════════════════════════
// LAYER
// ═══════════════════════════════════════════════════════

export const MathKernelLive: Layer.Layer<MathKernel, never, WasmBridge> =
  Layer.effect(
    MathKernel,
    Effect.gen(function* () {
      const bridge = yield* WasmBridge

      return MathKernel.of({
        // ── Linear Algebra ──
        mmult: (a, m, k, b, k2, n) =>
          bridge.call("mmult", (w) => w.mmult(a, m, k, b, k2, n)),
        solve: (a, n, b) =>
          bridge.call("solve", (w) => w.solve(a, n, b)),
        inverse: (a, n) =>
          bridge.call("inverse", (w) => w.inverse(a, n)),
        det: (a, n) =>
          bridge.call("det", (w) => w.det(a, n)),
        transpose: (a, rows, cols) =>
          bridge.call("transpose", (w) => w.transpose(a, rows, cols)),
        trace: (a, n) =>
          bridge.call("trace", (w) => w.trace(a, n)),
        norm: (a, rows, cols) =>
          bridge.call("norm", (w) => w.norm(a, rows, cols)),
        rank: (a, rows, cols) =>
          bridge.call("rank", (w) => w.rank(a, rows, cols)),

        // ── Decompositions ──
        svd: (a, rows, cols) =>
          bridge.call("svd", (w) => w.svd(a, rows, cols)),
        qr: (a, rows, cols) =>
          bridge.call("qr", (w) => w.qr(a, rows, cols)),
        cholesky: (a, n) =>
          bridge.call("cholesky", (w) => w.cholesky(a, n)),
        eigen: (a, n) =>
          bridge.call("eigen", (w) => w.eigen(a, n)),
        pca: (x, n_samples, n_features, k) =>
          bridge.call("pca", (w) => w.pca(x, n_samples, n_features, k)),

        // ── Regression ──
        ols: (x, n, p, y, fit_intercept = true) =>
          bridge.call("ols", (w) => w.ols(x, n, p, y, fit_intercept)),
        ridge: (x, n, p, y, lambda, fit_intercept = true) =>
          bridge.call("ridge", (w) => w.ridge(x, n, p, y, lambda, fit_intercept)),
        lasso: (x, n, p, y, alpha, l1_ratio = 1.0, max_iter = 1000, tol = 1e-4, fit_intercept = true) =>
          bridge.call("lasso", (w) => w.lasso(x, n, p, y, alpha, l1_ratio, max_iter, tol, fit_intercept)),
      })
    }),
  )
