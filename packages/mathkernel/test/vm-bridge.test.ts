/**
 * @tmnl/mathkernel — VM Bridge Tests
 *
 * Tests the Stack VM opcode handlers backed by real WASM kernels.
 */

import { describe, it, expect, beforeAll } from "vitest"
import { initVmBridge, mathKernelOps } from "../src/ts/vm-bridge.js"

let mk: any

beforeAll(async () => {
  const mod = await import("../dist/mathkernel.js")
  mk = await mod.default()
  initVmBridge(mk)
})

// Helper: push numbers onto a stack
const numVal = (v: number) => ({ _tag: "number" as const, value: v })
const makeStack = (...vals: number[]) => vals.map(numVal)

describe("LEASTSQ_N", () => {
  it("computes OLS slope for y = 2x + 1", () => {
    // X: [1,2,3,4,5], Y: [3,5,7,9,11]
    const stack = makeStack(1, 2, 3, 4, 5, 3, 5, 7, 9, 11)
    const result = mathKernelOps.LEASTSQ_N({ _tag: "LEASTSQ_N", n: 10 }, stack)
    expect(result.result?._tag).toBe("number")
    expect((result.result as any).value).toBeCloseTo(2, 6)
  })
})

describe("RIDGE_N", () => {
  it("computes ridge regression coefficient", () => {
    // X: [1,2,3,4,5], Y: [3,5,7,9,11], lambda=0.01
    const stack = makeStack(1, 2, 3, 4, 5, 3, 5, 7, 9, 11, 0.01)
    const result = mathKernelOps.RIDGE_N({ _tag: "RIDGE_N", n: 11 }, stack)
    expect(result.result?._tag).toBe("number")
    // Should be close to 2 (OLS slope) with small lambda
    expect((result.result as any).value).toBeCloseTo(2, 1)
  })

  it("shrinks coefficient with large lambda", () => {
    const stack = makeStack(1, 2, 3, 4, 5, 3, 5, 7, 9, 11, 100)
    const result = mathKernelOps.RIDGE_N({ _tag: "RIDGE_N", n: 11 }, stack)
    // Large lambda → coefficient closer to 0 than OLS
    const coef = (result.result as any).value
    expect(Math.abs(coef)).toBeLessThan(2)
  })
})

describe("LASSO_N", () => {
  it("computes lasso coefficient", () => {
    const stack = makeStack(1, 2, 3, 4, 5, 3, 5, 7, 9, 11, 0.01)
    const result = mathKernelOps.LASSO_N({ _tag: "LASSO_N", n: 11 }, stack)
    expect(result.result?._tag).toBe("number")
    expect((result.result as any).value).toBeCloseTo(2, 0)
  })
})

describe("ELASTICNET_N", () => {
  it("computes elastic net coefficient", () => {
    // X: [1,2,3,4,5], Y: [3,5,7,9,11], alpha=0.01, l1_ratio=0.5
    const stack = makeStack(1, 2, 3, 4, 5, 3, 5, 7, 9, 11, 0.01, 0.5)
    const result = mathKernelOps.ELASTICNET_N({ _tag: "ELASTICNET_N", n: 12 }, stack)
    expect(result.result?._tag).toBe("number")
    expect((result.result as any).value).toBeCloseTo(2, 0)
  })
})

describe("error handling", () => {
  it("returns VMError on stack underflow", () => {
    const stack = makeStack(1) // only 1 value, but need 10
    const result = mathKernelOps.LEASTSQ_N({ _tag: "LEASTSQ_N", n: 10 }, stack)
    expect(result.result?._tag).toBe("error")
  })
})
