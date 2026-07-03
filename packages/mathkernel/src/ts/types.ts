/**
 * @tmnl/mathkernel — Type Contracts
 *
 * All domain types defined as Effect Schemas per project convention.
 * These are the TS-side contracts for the WASM Embind interface.
 *
 * @module types
 */

import * as Schema from "effect/Schema"
import * as Data from "effect/Data"

// ═══════════════════════════════════════════════════════
// SHARED SCHEMA PRIMITIVES
// ═══════════════════════════════════════════════════════

/** Schema for Float64Array (typed array from WASM) */
const Float64ArraySchema = Schema.instanceOf(Float64Array)

// ═══════════════════════════════════════════════════════
// ERROR MODEL
// ═══════════════════════════════════════════════════════

/**
 * Machine-readable error codes from the WASM kernels.
 */
export const KernelErrorCode = Schema.Literals([
  "DimensionMismatch",
  "SingularMatrix",
  "CholeskyFailed",
  "InvalidParameter",
  "ConvergenceFailure",
  "OutOfMemory",
  "WasmNotReady",
  "Unknown",
] as const)
export type KernelErrorCode = typeof KernelErrorCode.Type

/**
 * KernelError — typed Effect E channel error for MathKernel operations.
 *
 * Two consumers:
 * 1. StackVM bridge: catches and converts to VMError on the value stack
 * 2. Codemode overlay: surfaces to the agent as structured error
 */
export class KernelError extends Data.TaggedError("KernelError")<{
  readonly code: KernelErrorCode
  readonly message: string
  readonly kernel: string   // which kernel function failed
}> {}

// ═══════════════════════════════════════════════════════
// RESULT SCHEMAS
// ═══════════════════════════════════════════════════════

/**
 * OLS / Ridge regression result.
 */
export const RegressionResult = Schema.Struct({
  coefficients: Float64ArraySchema,
  intercept: Schema.Number,
  residuals: Float64ArraySchema,
  fitted_values: Float64ArraySchema,
  r_squared: Schema.Number,
  mse: Schema.Number,
  n: Schema.Number,
  p: Schema.Number,
})
export type RegressionResult = typeof RegressionResult.Type

/**
 * Lasso / ElasticNet regression result.
 */
export const SparseRegressionResult = Schema.Struct({
  coefficients: Float64ArraySchema,
  intercept: Schema.Number,
  residuals: Float64ArraySchema,
  fitted_values: Float64ArraySchema,
  r_squared: Schema.Number,
  mse: Schema.Number,
  alpha: Schema.Number,
  l1_ratio: Schema.Number,
  n_iter: Schema.Number,
  n_nonzero: Schema.Number,
})
export type SparseRegressionResult = typeof SparseRegressionResult.Type

/**
 * SVD decomposition result.
 */
export const SVDResult = Schema.Struct({
  u: Float64ArraySchema,
  s: Float64ArraySchema,
  vt: Float64ArraySchema,
  m: Schema.Number,
  n: Schema.Number,
  k: Schema.Number,
})
export type SVDResult = typeof SVDResult.Type

/**
 * QR decomposition result.
 */
export const QRResult = Schema.Struct({
  q: Float64ArraySchema,
  r: Float64ArraySchema,
  m: Schema.Number,
  n: Schema.Number,
})
export type QRResult = typeof QRResult.Type

/**
 * Eigenvalue decomposition result.
 */
export const EigenResult = Schema.Struct({
  values_re: Float64ArraySchema,
  values_im: Float64ArraySchema,
  vectors: Float64ArraySchema,
  n: Schema.Number,
})
export type EigenResult = typeof EigenResult.Type

/**
 * PCA result.
 */
export const PCAResult = Schema.Struct({
  components: Float64ArraySchema,
  explained_variance: Float64ArraySchema,
  mean: Float64ArraySchema,
  transformed: Float64ArraySchema,
  n_components: Schema.Number,
})
export type PCAResult = typeof PCAResult.Type
