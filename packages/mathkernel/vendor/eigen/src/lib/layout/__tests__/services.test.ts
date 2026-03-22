/**
 * @module layout/__tests__/services.test
 * @description Tests for layout services
 */

import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import {
  evaluateBreakpoints,
  createMobileFirstEvaluator,
  createDesktopFirstEvaluator,
  BreakpointService,
  BreakpointServiceLive,
} from "../services/BreakpointService"
import {
  calculateResizeSync,
  pixelToRatioDelta,
  ratioToPixel,
  getHandlePositions,
  snapToGrid,
  ResizeService,
  ResizeServiceLive,
} from "../services/ResizeService"
import {
  minWidth,
  maxWidth,
  range,
  type LayoutBreakpoints,
} from "../schemas"

describe("BreakpointService", () => {
  describe("evaluateBreakpoints", () => {
    const breakpoints: LayoutBreakpoints = [
      minWidth(1024, "1fr 1fr 1fr", 24),
      minWidth(768, "1fr 1fr", 16),
    ]

    it("returns first matching breakpoint", () => {
      const result = evaluateBreakpoints(1200, breakpoints, "1fr")
      expect(result.template).toBe("1fr 1fr 1fr")
      expect(result.gap).toBe(24)
      expect(result.matchedIndex).toBe(0)
    })

    it("returns second breakpoint when first doesnt match", () => {
      const result = evaluateBreakpoints(900, breakpoints, "1fr")
      expect(result.template).toBe("1fr 1fr")
      expect(result.gap).toBe(16)
      expect(result.matchedIndex).toBe(1)
    })

    it("returns default when no breakpoints match", () => {
      const result = evaluateBreakpoints(500, breakpoints, "1fr", 8)
      expect(result.template).toBe("1fr")
      expect(result.gap).toBe(8)
      expect(result.matchedIndex).toBe(-1)
    })

    it("handles empty breakpoints", () => {
      const result = evaluateBreakpoints(1000, [], "1fr 1fr")
      expect(result.template).toBe("1fr 1fr")
      expect(result.matchedIndex).toBe(-1)
    })
  })

  describe("MaxWidthCondition", () => {
    const breakpoints: LayoutBreakpoints = [
      maxWidth(768, "1fr"),
      maxWidth(1024, "1fr 1fr"),
    ]

    it("matches max width conditions", () => {
      expect(evaluateBreakpoints(500, breakpoints, "1fr 1fr 1fr").template).toBe("1fr")
      expect(evaluateBreakpoints(900, breakpoints, "1fr 1fr 1fr").template).toBe("1fr 1fr")
      expect(evaluateBreakpoints(1200, breakpoints, "1fr 1fr 1fr").template).toBe("1fr 1fr 1fr")
    })
  })

  describe("RangeWidthCondition", () => {
    const breakpoints: LayoutBreakpoints = [
      range(768, 1024, "1fr 1fr"),
    ]

    it("matches within range", () => {
      expect(evaluateBreakpoints(900, breakpoints, "1fr").template).toBe("1fr 1fr")
    })

    it("doesnt match outside range", () => {
      expect(evaluateBreakpoints(500, breakpoints, "1fr").template).toBe("1fr")
      expect(evaluateBreakpoints(1200, breakpoints, "1fr").template).toBe("1fr")
    })

    it("matches at boundaries", () => {
      expect(evaluateBreakpoints(768, breakpoints, "1fr").template).toBe("1fr 1fr")
      expect(evaluateBreakpoints(1024, breakpoints, "1fr").template).toBe("1fr 1fr")
    })
  })

  describe("createMobileFirstEvaluator", () => {
    const evaluate = createMobileFirstEvaluator([
      { minWidth: 768, template: "1fr 1fr" },
      { minWidth: 1024, template: "1fr 1fr 1fr" },
    ])

    it("returns larger breakpoint first", () => {
      expect(evaluate(1200, "1fr").template).toBe("1fr 1fr 1fr")
      expect(evaluate(900, "1fr").template).toBe("1fr 1fr")
      expect(evaluate(500, "1fr").template).toBe("1fr")
    })
  })

  describe("createDesktopFirstEvaluator", () => {
    const evaluate = createDesktopFirstEvaluator([
      { maxWidth: 1024, template: "1fr 1fr" },
      { maxWidth: 768, template: "1fr" },
    ])

    it("returns smaller breakpoint first", () => {
      expect(evaluate(500, "1fr 1fr 1fr").template).toBe("1fr")
      expect(evaluate(900, "1fr 1fr 1fr").template).toBe("1fr 1fr")
      expect(evaluate(1200, "1fr 1fr 1fr").template).toBe("1fr 1fr 1fr")
    })
  })

  describe("Effect-based service", () => {
    it("evaluates breakpoints via Effect", async () => {
      const breakpoints: LayoutBreakpoints = [minWidth(768, "1fr 1fr")]

      const program = Effect.gen(function* () {
        const service = yield* BreakpointService
        return yield* service.evaluate(1000, breakpoints, "1fr", 16)
      })

      const result = await Effect.runPromise(
        Effect.provide(program, BreakpointServiceLive)
      )

      expect(result.template).toBe("1fr 1fr")
    })
  })
})

describe("ResizeService", () => {
  describe("calculateResizeSync", () => {
    it("calculates new ratios on drag", () => {
      const result = calculateResizeSync({
        currentPos: 500,
        startPos: 400,
        containerSize: 1000,
        startRatios: [0.5, 0.5],
        handleIndex: 0,
        minRatio: 0.1,
      })

      // Moved 100px right in 1000px container = +0.1 ratio delta
      expect(result.applied).toBe(true)
      expect(result.ratios[0]).toBeGreaterThan(0.5)
      expect(result.ratios[1]).toBeLessThan(0.5)
    })

    it("respects minimum ratio", () => {
      const result = calculateResizeSync({
        currentPos: 900,
        startPos: 500,
        containerSize: 1000,
        startRatios: [0.5, 0.5],
        handleIndex: 0,
        minRatio: 0.1,
      })

      // Should clamp to prevent going below minRatio
      expect(result.ratios[0]).toBeLessThanOrEqual(0.9)
      expect(result.ratios[1]).toBeGreaterThanOrEqual(0.1)
    })

    it("handles invalid handle index", () => {
      const result = calculateResizeSync({
        currentPos: 500,
        startPos: 400,
        containerSize: 1000,
        startRatios: [0.5, 0.5],
        handleIndex: 5, // Out of bounds
        minRatio: 0.1,
      })

      expect(result.applied).toBe(false)
      expect(result.ratios).toEqual([0.5, 0.5])
    })

    it("normalizes ratios to sum to 1", () => {
      const result = calculateResizeSync({
        currentPos: 600,
        startPos: 500,
        containerSize: 1000,
        startRatios: [0.33, 0.33, 0.34],
        handleIndex: 1,
        minRatio: 0.1,
      })

      const sum = result.ratios.reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1, 5)
    })
  })

  describe("pixelToRatioDelta", () => {
    it("converts pixel delta to ratio delta", () => {
      expect(pixelToRatioDelta(100, 1000)).toBe(0.1)
      expect(pixelToRatioDelta(-50, 500)).toBe(-0.1)
      expect(pixelToRatioDelta(0, 1000)).toBe(0)
    })

    it("handles zero container size", () => {
      expect(pixelToRatioDelta(100, 0)).toBe(0)
    })
  })

  describe("ratioToPixel", () => {
    it("converts ratio to pixel position", () => {
      expect(ratioToPixel(0.5, 1000)).toBe(500)
      expect(ratioToPixel(0.25, 800)).toBe(200)
    })
  })

  describe("getHandlePositions", () => {
    it("calculates handle positions without gap", () => {
      const positions = getHandlePositions([0.5, 0.5], 1000, 0)
      expect(positions).toEqual([500])
    })

    it("calculates handle positions with gap", () => {
      const positions = getHandlePositions([0.5, 0.5], 1000, 20)
      // Available size = 1000 - 20 = 980
      // First cell = 0.5 * 980 = 490
      // Handle at 490 + 20/2 = 500 (centered on gap)
      expect(positions.length).toBe(1)
    })

    it("handles multiple handles", () => {
      const positions = getHandlePositions([0.33, 0.34, 0.33], 900, 0)
      expect(positions.length).toBe(2)
    })
  })

  describe("snapToGrid", () => {
    it("snaps to grid", () => {
      expect(snapToGrid(0.33, 0.05)).toBeCloseTo(0.35, 5)
      expect(snapToGrid(0.48, 0.1)).toBeCloseTo(0.5, 5)
      expect(snapToGrid(0.52, 0.1)).toBeCloseTo(0.5, 5)
    })
  })

  describe("Effect-based service", () => {
    it("calculates resize via Effect", async () => {
      const program = Effect.gen(function* () {
        const service = yield* ResizeService
        return yield* service.calculateResize({
          currentPos: 600,
          startPos: 500,
          containerSize: 1000,
          startRatios: [0.5, 0.5],
          handleIndex: 0,
        })
      })

      const result = await Effect.runPromise(
        Effect.provide(program, ResizeServiceLive)
      )

      expect(result.applied).toBe(true)
    })
  })
})
