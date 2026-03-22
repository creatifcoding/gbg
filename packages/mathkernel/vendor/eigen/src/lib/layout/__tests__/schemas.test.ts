/**
 * @module layout/__tests__/schemas.test
 * @description Tests for layout schema definitions
 */

import { describe, expect, it } from "vitest"
import { Schema } from "effect"
import {
  SPACING_VALUES,
  SpacingToken,
  spacingToCss,
  spacingToVar,
  MinWidthCondition,
  MaxWidthCondition,
  RangeWidthCondition,
  minWidth,
  maxWidth,
  range,
  equalRatios,
  normalizeRatios,
  clampRatio,
  defaultResizeState,
  ratiosToTemplate,
  estimateColumnCount,
} from "../schemas"

describe("SpacingToken", () => {
  it("accepts valid VANTA spacing values", () => {
    for (const value of SPACING_VALUES) {
      const result = Schema.decodeUnknownSync(SpacingToken)(value)
      expect(result).toBe(value)
    }
  })

  it("rejects invalid spacing values", () => {
    const invalidValues = [7, 15, 20, 100, -4, 3.5]

    for (const value of invalidValues) {
      expect(() => Schema.decodeUnknownSync(SpacingToken)(value)).toThrow()
    }
  })

  it("converts to CSS value", () => {
    expect(spacingToCss(16 as SpacingToken)).toBe("16px")
    expect(spacingToCss(0 as SpacingToken)).toBe("0px")
  })

  it("converts to CSS variable", () => {
    expect(spacingToVar(16 as SpacingToken)).toBe("var(--tmnl-space-4)")
    expect(spacingToVar(0 as SpacingToken)).toBe("var(--tmnl-space-0)")
  })
})

describe("Breakpoint Conditions", () => {
  it("creates MinWidthCondition", () => {
    const condition = new MinWidthCondition({ minWidth: 768 })
    expect(condition._tag).toBe("MinWidthCondition")
    expect(condition.minWidth).toBe(768)
  })

  it("creates MaxWidthCondition", () => {
    const condition = new MaxWidthCondition({ maxWidth: 1024 })
    expect(condition._tag).toBe("MaxWidthCondition")
    expect(condition.maxWidth).toBe(1024)
  })

  it("creates RangeWidthCondition", () => {
    const condition = new RangeWidthCondition({ minWidth: 768, maxWidth: 1024 })
    expect(condition._tag).toBe("RangeWidthCondition")
    expect(condition.minWidth).toBe(768)
    expect(condition.maxWidth).toBe(1024)
  })

  it("rejects non-positive widths", () => {
    expect(() => new MinWidthCondition({ minWidth: 0 })).toThrow()
    expect(() => new MinWidthCondition({ minWidth: -100 })).toThrow()
    expect(() => new MaxWidthCondition({ maxWidth: 0 })).toThrow()
  })
})

describe("LayoutBreakpoint Helpers", () => {
  it("creates minWidth breakpoint", () => {
    const bp = minWidth(768, "1fr 1fr", 24)
    expect(bp.condition._tag).toBe("MinWidthCondition")
    expect(bp.template).toBe("1fr 1fr")
    expect(bp.gap).toBe(24)
  })

  it("creates maxWidth breakpoint", () => {
    const bp = maxWidth(768, "1fr")
    expect(bp.condition._tag).toBe("MaxWidthCondition")
    expect(bp.template).toBe("1fr")
    expect(bp.gap).toBeUndefined()
  })

  it("creates range breakpoint", () => {
    const bp = range(768, 1024, "1fr 1fr")
    expect(bp.condition._tag).toBe("RangeWidthCondition")
  })
})

describe("Resize Utilities", () => {
  describe("equalRatios", () => {
    it("generates equal ratios", () => {
      expect(equalRatios(2)).toEqual([0.5, 0.5])
      expect(equalRatios(3)).toEqual([1 / 3, 1 / 3, 1 / 3])
      expect(equalRatios(4)).toEqual([0.25, 0.25, 0.25, 0.25])
    })

    it("handles edge cases", () => {
      expect(equalRatios(1)).toEqual([1])
      expect(equalRatios(0)).toEqual([1])
    })
  })

  describe("normalizeRatios", () => {
    it("normalizes ratios to sum to 1", () => {
      const result = normalizeRatios([2, 2, 2])
      expect(result).toEqual([1 / 3, 1 / 3, 1 / 3])
    })

    it("handles already normalized ratios", () => {
      const result = normalizeRatios([0.5, 0.5])
      expect(result).toEqual([0.5, 0.5])
    })

    it("handles zero sum", () => {
      const result = normalizeRatios([0, 0, 0])
      expect(result).toEqual([1 / 3, 1 / 3, 1 / 3])
    })
  })

  describe("clampRatio", () => {
    it("clamps within bounds", () => {
      expect(clampRatio(0.5)).toBe(0.5)
      expect(clampRatio(0.01)).toBe(0.05)
      expect(clampRatio(0.99)).toBe(0.95)
    })

    it("respects custom bounds", () => {
      expect(clampRatio(0.05, 0.1, 0.9)).toBe(0.1)
      expect(clampRatio(0.95, 0.1, 0.9)).toBe(0.9)
    })
  })

  describe("defaultResizeState", () => {
    it("creates default state with equal ratios", () => {
      const state = defaultResizeState(3)
      expect(state.ratios).toEqual([1 / 3, 1 / 3, 1 / 3])
      expect(state.isDragging).toBe(false)
      expect(state.activeHandleIndex).toBeNull()
      expect(state.startPosition).toBeNull()
      expect(state.startRatios).toBeNull()
    })
  })
})

describe("Grid Utilities", () => {
  describe("ratiosToTemplate", () => {
    it("converts ratios to fr units", () => {
      expect(ratiosToTemplate([0.5, 0.5])).toBe("50fr 50fr")
      expect(ratiosToTemplate([0.33, 0.67])).toBe("33fr 67fr")
      expect(ratiosToTemplate([0.25, 0.25, 0.5])).toBe("25fr 25fr 50fr")
    })
  })

  describe("estimateColumnCount", () => {
    it("counts space-separated values", () => {
      expect(estimateColumnCount("1fr")).toBe(1)
      expect(estimateColumnCount("1fr 1fr")).toBe(2)
      expect(estimateColumnCount("1fr 2fr 1fr")).toBe(3)
    })

    it("handles repeat notation", () => {
      expect(estimateColumnCount("repeat(3, 1fr)")).toBe(3)
      expect(estimateColumnCount("repeat(5, minmax(200px, 1fr))")).toBe(5)
    })
  })
})
