/**
 * @tmnl/mathkernel — Kernel Numerical Accuracy Tests
 *
 * Validates WASM kernels against known mathematical results.
 * Tolerances: 1e-10 for exact operations, 1e-6 for iterative.
 */

import { describe, it, expect, beforeAll } from "vitest"

// Load WASM module directly (not via Effect service — we test kernels raw)
let mk: any

beforeAll(async () => {
  const mod = await import("../dist/mathkernel.js")
  mk = await mod.default()
})

// ═══════════════════════════════════════════════════════
// LINEAR ALGEBRA
// ═══════════════════════════════════════════════════════

describe("linalg", () => {
  it("mmult: identity multiplication", () => {
    const A = new Float64Array([3, 1, 2, 4])
    const I = new Float64Array([1, 0, 0, 1])
    const result = mk.mmult(A, 2, 2, I, 2, 2)
    expect(Array.from(result)).toEqual([3, 1, 2, 4])
  })

  it("mmult: 2x3 × 3x2", () => {
    const A = new Float64Array([1, 2, 3, 4, 5, 6])
    const B = new Float64Array([7, 8, 9, 10, 11, 12])
    const C = mk.mmult(A, 2, 3, B, 3, 2)
    // [1*7+2*9+3*11, 1*8+2*10+3*12, 4*7+5*9+6*11, 4*8+5*10+6*12]
    expect(Array.from(C)).toEqual([58, 64, 139, 154])
  })

  it("det: known determinant", () => {
    const A = new Float64Array([3, 1, 2, 4])
    expect(mk.det(A, 2)).toBeCloseTo(10, 10)
  })

  it("det: singular matrix = 0", () => {
    const A = new Float64Array([1, 2, 2, 4])
    expect(Math.abs(mk.det(A, 2))).toBeLessThan(1e-10)
  })

  it("solve: Ax=b", () => {
    const A = new Float64Array([3, 1, 2, 4])
    const b = new Float64Array([5, 6])
    const x = mk.solve(A, 2, b)
    expect(x[0]).toBeCloseTo(1.4, 10)
    expect(x[1]).toBeCloseTo(0.8, 10)
  })

  it("inverse: A * A⁻¹ = I", () => {
    const A = new Float64Array([3, 1, 2, 4])
    const Ainv = mk.inverse(A, 2)
    const I = mk.mmult(A, 2, 2, Ainv, 2, 2)
    expect(I[0]).toBeCloseTo(1, 10)
    expect(I[1]).toBeCloseTo(0, 10)
    expect(I[2]).toBeCloseTo(0, 10)
    expect(I[3]).toBeCloseTo(1, 10)
  })

  it("transpose: rows ↔ cols", () => {
    const A = new Float64Array([1, 2, 3, 4, 5, 6])
    const At = mk.transpose(A, 2, 3)
    expect(Array.from(At)).toEqual([1, 4, 2, 5, 3, 6])
  })

  it("trace: diagonal sum", () => {
    const A = new Float64Array([3, 1, 2, 4])
    expect(mk.trace(A, 2)).toBe(7)
  })

  it("norm: Frobenius", () => {
    const A = new Float64Array([3, 1, 2, 4])
    // sqrt(9 + 1 + 4 + 16) = sqrt(30) ≈ 5.477
    expect(mk.norm(A, 2, 2)).toBeCloseTo(Math.sqrt(30), 10)
  })

  it("rank: full rank", () => {
    expect(mk.rank(new Float64Array([3, 1, 2, 4]), 2, 2)).toBe(2)
  })

  it("rank: rank-deficient", () => {
    expect(mk.rank(new Float64Array([1, 2, 2, 4]), 2, 2)).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════
// DECOMPOSITIONS
// ═══════════════════════════════════════════════════════

describe("decompositions", () => {
  it("svd: singular values of 2x2", () => {
    const A = new Float64Array([3, 1, 2, 4])
    const s = mk.svd(A, 2, 2)
    // Singular values in descending order
    expect(s.s[0]).toBeGreaterThan(s.s[1])
    expect(s.k).toBe(2)
  })

  it("svd: U * diag(s) * Vt ≈ A", () => {
    const A = new Float64Array([1, 2, 3, 4])
    const { u, s, vt } = mk.svd(A, 2, 2)
    // Reconstruct: U * S * Vt
    const S = new Float64Array([s[0], 0, 0, s[1]])
    const US = mk.mmult(u, 2, 2, S, 2, 2)
    const reconstructed = mk.mmult(US, 2, 2, vt, 2, 2)
    for (let i = 0; i < 4; i++) {
      expect(reconstructed[i]).toBeCloseTo(A[i], 8)
    }
  })

  it("cholesky: L * Lᵀ = A", () => {
    const A = new Float64Array([4, 2, 2, 3])
    const L = mk.cholesky(A, 2)
    const Lt = mk.transpose(L, 2, 2)
    const reconstructed = mk.mmult(L, 2, 2, Lt, 2, 2)
    for (let i = 0; i < 4; i++) {
      expect(reconstructed[i]).toBeCloseTo(A[i], 10)
    }
  })

  it("eigen: known eigenvalues of symmetric 2x2", () => {
    const A = new Float64Array([2, 1, 1, 3])
    const eig = mk.eigen(A, 2)
    const vals = Array.from(eig.values_re as Float64Array).sort()
    // Eigenvalues of [2,1;1,3] are (5±√5)/2 ≈ 1.382, 3.618
    expect(vals[0]).toBeCloseTo((5 - Math.sqrt(5)) / 2, 8)
    expect(vals[1]).toBeCloseTo((5 + Math.sqrt(5)) / 2, 8)
    // All imaginary parts should be zero for real symmetric
    expect(eig.values_im[0]).toBeCloseTo(0, 10)
    expect(eig.values_im[1]).toBeCloseTo(0, 10)
  })

  it("pca: dimensionality reduction", () => {
    // 4 samples × 3 features, all colinear → 1 meaningful component
    const X = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    const pca = mk.pca(X, 4, 3, 2)
    expect(pca.n_components).toBe(2)
    // First component should explain ~all variance
    expect(pca.explained_variance[0]).toBeGreaterThan(40)
    // Second component should be near-zero
    expect(pca.explained_variance[1]).toBeLessThan(1e-10)
  })
})

// ═══════════════════════════════════════════════════════
// REGRESSION
// ═══════════════════════════════════════════════════════

describe("regression", () => {
  it("ols: perfect fit", () => {
    // y = 2*x + 1
    const X = new Float64Array([1, 2, 3, 4, 5])
    const y = new Float64Array([3, 5, 7, 9, 11])
    const res = mk.ols(X, 5, 1, y, true)
    expect(res.intercept).toBeCloseTo(1, 8)
    expect(res.coefficients[0]).toBeCloseTo(2, 8)
    expect(res.r_squared).toBeCloseTo(1, 8)
  })

  it("ols: multivariate", () => {
    // y = x1 + 2*x2 + 3
    const X = new Float64Array([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
    const y = new Float64Array([6, 9, 12, 15, 18])
    const res = mk.ols(X, 5, 2, y, true)
    expect(res.r_squared).toBeCloseTo(1, 6)
  })

  it("ridge: shrinks toward zero", () => {
    const X = new Float64Array([1, 2, 3, 4, 5])
    const y = new Float64Array([3, 5, 7, 9, 11])
    const ols = mk.ols(X, 5, 1, y, true)
    const ridge = mk.ridge(X, 5, 1, y, 100.0, true) // heavy penalty
    // Ridge coefficient should be closer to 0 than OLS
    expect(Math.abs(ridge.coefficients[0])).toBeLessThan(Math.abs(ols.coefficients[0]))
  })

  it("lasso: sparsity — zeros out noise features", () => {
    const n = 100
    const p = 5
    const X = new Float64Array(n * p)
    const y = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      X[i * p + 0] = i * 0.1                 // true signal
      X[i * p + 1] = Math.sin(i * 0.5)       // noise
      X[i * p + 2] = Math.cos(i * 0.3)       // noise
      X[i * p + 3] = (i % 7) * 0.01          // noise
      X[i * p + 4] = Math.random() * 0.001   // noise
      y[i] = 5.0 * (i * 0.1) + 2.0           // y = 5*x0 + 2
    }

    const res = mk.lasso(X, n, p, y, 1.0, 1.0, 1000, 1e-6, true)
    // First coefficient should be the dominant one
    const coefs = Array.from(res.coefficients as Float64Array)
    expect(Math.abs(coefs[0])).toBeGreaterThan(1.0) // signal preserved
    // At least some noise features should be zeroed
    const zeroed = coefs.filter((c: number) => Math.abs(c) < 1e-10).length
    expect(zeroed).toBeGreaterThanOrEqual(1)
    expect(res.r_squared).toBeGreaterThan(0.9)
  })

  it("elasticnet: l1_ratio=0 ≈ ridge", () => {
    const X = new Float64Array([1, 2, 3, 4, 5])
    const y = new Float64Array([3, 5, 7, 9, 11])
    const enet = mk.lasso(X, 5, 1, y, 0.1, 0.0, 1000, 1e-6, true) // l1_ratio=0 = ridge
    // Should not zero out the coefficient
    expect(Math.abs(enet.coefficients[0])).toBeGreaterThan(0.1)
  })
})

// ═══════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════

describe("error handling", () => {
  // C++ exceptions propagate as WebAssembly.Exception via -fwasm-exceptions.
  // The error message is in the WASM heap — the WasmBridge service classifies these.
  // Here we just verify the kernel rejects invalid input.

  it("solve: rejects singular matrix", () => {
    const A = new Float64Array([1, 2, 2, 4]) // singular
    const b = new Float64Array([1, 2])
    expect(() => mk.solve(A, 2, b)).toThrow()
  })

  it("inverse: rejects singular matrix", () => {
    const A = new Float64Array([1, 2, 2, 4])
    expect(() => mk.inverse(A, 2)).toThrow()
  })

  it("cholesky: rejects non-positive-definite", () => {
    const A = new Float64Array([1, 2, 2, 1]) // not positive-definite
    expect(() => mk.cholesky(A, 2)).toThrow()
  })

  it("mmult: rejects dimension mismatch", () => {
    const A = new Float64Array([1, 2, 3, 4])
    const B = new Float64Array([1, 2, 3, 4, 5, 6])
    expect(() => mk.mmult(A, 2, 2, B, 3, 2)).toThrow()
  })
})
