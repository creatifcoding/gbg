/**
 * @tmnl/mathkernel — Stack VM Bridge
 *
 * Provides replacement opcode handlers for the StackVM dispatch table.
 * These replace the fraudulent averaging stubs with real WASM-backed
 * linear algebra and regression.
 *
 * The bridge operates SYNCHRONOUSLY because Embind calls are blocking.
 * The Effect service wrapper is for use in async contexts (codemode).
 * Here in the VM dispatch path, we call the WASM module directly.
 *
 * @module vm-bridge
 */

// ── Types matching StackVM conventions ──────────────────────────────────────

interface VMNumber {
  readonly _tag: "number"
  readonly value: number
}

interface VMErrorValue {
  readonly _tag: "error"
  readonly message: string
  readonly code: string
}

type VMValue = VMNumber | VMErrorValue | { readonly _tag: string; readonly value?: any }

interface ExecResult {
  result?: VMValue
  halted?: boolean
}

type VMStack = VMValue[]

// Helpers matching StackVM internal conventions
const num = (v: number): VMNumber => ({ _tag: "number", value: v })
const vmError = (code: string, msg: string): VMErrorValue => ({ _tag: "error", message: msg, code })
const asNum = (v: VMValue): number => (v._tag === "number" ? (v as VMNumber).value : NaN)

// ── WASM Module Handle ──────────────────────────────────────────────────────

interface WasmKernel {
  mmult(a: Float64Array, m: number, k: number, b: Float64Array, k2: number, n: number): Float64Array
  solve(a: Float64Array, n: number, b: Float64Array): Float64Array
  inverse(a: Float64Array, n: number): Float64Array
  det(a: Float64Array, n: number): number
  transpose(a: Float64Array, rows: number, cols: number): Float64Array
  trace(a: Float64Array, n: number): number
  norm(a: Float64Array, rows: number, cols: number): number
  rank(a: Float64Array, rows: number, cols: number): number
  svd(a: Float64Array, rows: number, cols: number): any
  qr(a: Float64Array, rows: number, cols: number): any
  cholesky(a: Float64Array, n: number): Float64Array
  eigen(a: Float64Array, n: number): any
  pca(x: Float64Array, n_samples: number, n_features: number, k: number): any
  ols(x: Float64Array, n: number, p: number, y: Float64Array, fit_intercept: boolean): any
  ridge(x: Float64Array, n: number, p: number, y: Float64Array, lambda: number, fit_intercept: boolean): any
  lasso(x: Float64Array, n: number, p: number, y: Float64Array, alpha: number, l1_ratio: number, max_iter: number, tol: number, fit_intercept: boolean): any
}

let _wasm: WasmKernel | null = null

/**
 * Initialize the VM bridge with a loaded WASM module.
 * Must be called once before any formula evaluation that uses WASM kernels.
 */
export function initVmBridge(wasmModule: WasmKernel): void {
  _wasm = wasmModule
}

function getWasm(): WasmKernel {
  if (!_wasm) throw new Error("MathKernel WASM not initialized — call initVmBridge() first")
  return _wasm
}

// ── Opcode Handlers ─────────────────────────────────────────────────────────

/**
 * Real WASM-backed opcode implementations.
 * These match the StackVM EXEC dispatch table signature:
 *   (op: { _tag: string, n: number }, stack: VMValue[], cellCtx: any) => ExecResult
 *
 * Import and spread into the StackVM EXEC table to replace stubs.
 */
export const mathKernelOps: Record<string, (op: any, s: VMStack, ctx?: any) => ExecResult> = {
  /**
   * =LEASTSQ(x1,x2,...,y1,y2,...) → slope (OLS coefficient)
   * Pops n args: first half = X, second half = y. Returns slope.
   */
  LEASTSQ_N: (op, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "LEASTSQ")); return { result: s[s.length - 1] } }
    const args = s.splice(s.length - n, n)
    try {
      const half = Math.floor(args.length / 2)
      const xVals = args.slice(0, half).map(asNum)
      const yVals = args.slice(half).map(asNum)
      const nSamples = Math.min(xVals.length, yVals.length)
      const X = new Float64Array(xVals.slice(0, nSamples))
      const y = new Float64Array(yVals.slice(0, nSamples))
      const wasm = getWasm()
      const res = wasm.ols(X, nSamples, 1, y, true)
      const r = num(res.coefficients[0])
      s.push(r)
      return { result: r }
    } catch (e) {
      const r = vmError("GENERAL", `LEASTSQ: ${e}`)
      s.push(r)
      return { result: r }
    }
  },

  /**
   * =RIDGE(x1,x2,...,y1,y2,...,lambda) → coefficient
   * Last arg is lambda. First half of remaining = X, second half = y.
   */
  RIDGE_N: (op, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "RIDGE")); return { result: s[s.length - 1] } }
    const args = s.splice(s.length - n, n)
    try {
      const lambda = asNum(args[args.length - 1])
      const dataArgs = args.slice(0, -1)
      const half = Math.floor(dataArgs.length / 2)
      const xVals = dataArgs.slice(0, half).map(asNum)
      const yVals = dataArgs.slice(half).map(asNum)
      const nSamples = Math.min(xVals.length, yVals.length)
      const X = new Float64Array(xVals.slice(0, nSamples))
      const y = new Float64Array(yVals.slice(0, nSamples))
      const wasm = getWasm()
      const res = wasm.ridge(X, nSamples, 1, y, lambda, true)
      const r = num(res.coefficients[0])
      s.push(r)
      return { result: r }
    } catch (e) {
      const r = vmError("GENERAL", `RIDGE: ${e}`)
      s.push(r)
      return { result: r }
    }
  },

  /**
   * =LASSO(x1,x2,...,y1,y2,...,alpha) → coefficient
   * Last arg is alpha. Pure L1 (l1_ratio=1.0).
   */
  LASSO_N: (op, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "LASSO")); return { result: s[s.length - 1] } }
    const args = s.splice(s.length - n, n)
    try {
      const alpha = asNum(args[args.length - 1])
      const dataArgs = args.slice(0, -1)
      const half = Math.floor(dataArgs.length / 2)
      const xVals = dataArgs.slice(0, half).map(asNum)
      const yVals = dataArgs.slice(half).map(asNum)
      const nSamples = Math.min(xVals.length, yVals.length)
      const X = new Float64Array(xVals.slice(0, nSamples))
      const y = new Float64Array(yVals.slice(0, nSamples))
      const wasm = getWasm()
      const res = wasm.lasso(X, nSamples, 1, y, alpha, 1.0, 1000, 1e-4, true)
      const r = num(res.coefficients[0])
      s.push(r)
      return { result: r }
    } catch (e) {
      const r = vmError("GENERAL", `LASSO: ${e}`)
      s.push(r)
      return { result: r }
    }
  },

  /**
   * =ELASTICNET(x1,x2,...,y1,y2,...,alpha,l1_ratio) → coefficient
   * Last two args: alpha, l1_ratio.
   */
  ELASTICNET_N: (op, s) => {
    const n = op.n as number
    if (s.length < n) { s.push(vmError("STACK_UNDERFLOW", "ELASTICNET")); return { result: s[s.length - 1] } }
    const args = s.splice(s.length - n, n)
    try {
      const l1_ratio = asNum(args[args.length - 1])
      const alpha = asNum(args[args.length - 2])
      const dataArgs = args.slice(0, -2)
      const half = Math.floor(dataArgs.length / 2)
      const xVals = dataArgs.slice(0, half).map(asNum)
      const yVals = dataArgs.slice(half).map(asNum)
      const nSamples = Math.min(xVals.length, yVals.length)
      const X = new Float64Array(xVals.slice(0, nSamples))
      const y = new Float64Array(yVals.slice(0, nSamples))
      const wasm = getWasm()
      const res = wasm.lasso(X, nSamples, 1, y, alpha, l1_ratio, 1000, 1e-4, true)
      const r = num(res.coefficients[0])
      s.push(r)
      return { result: r }
    } catch (e) {
      const r = vmError("GENERAL", `ELASTICNET: ${e}`)
      s.push(r)
      return { result: r }
    }
  },
}
