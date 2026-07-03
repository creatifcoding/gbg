/**
 * @fileoverview Expected Props Contract Tests
 *
 * Contract tests that verify specific props MUST be visible to the AI.
 * If any expected prop is missing, the test fails - catching regressions.
 *
 * This is the canonical list of props the AI must be able to use.
 * Adding a prop here is a commitment to maintain its availability.
 *
 * @module genifer/core/__tests__/expected-props.test
 */

import { describe, it, expect } from "vitest"
import { getSchemaFields } from "./catalog-introspection"

/**
 * Contract: These props MUST be visible to the AI.
 * If any are missing, the test fails - catching regressions.
 *
 * Organized by component, listing all props that should be exposed.
 */
const EXPECTED_PROPS: Record<string, string[]> = {
  // ==========================================================================
  // Layout Components
  // ==========================================================================

  Grid: [
    "id",
    "template",
    "breakpoints", // Responsive breakpoints (HIGH priority gap fix)
    "gap",
    "direction",
    "alignItems",
    "justifyItems",
    "resizable",
    "initialRatios", // Initial resize proportions (MEDIUM priority gap fix)
    "minRatio", // Minimum resize ratio (LOW priority gap fix)
    "className",
  ],

  Stack: [
    "direction",
    "gap",
    "align",
    "justify",
    "fill",
    "wrap", // Wrap to next line (MEDIUM priority gap fix)
    "className",
  ],

  VStack: [
    "gap",
    "align",
    "justify",
    "fill",
    "wrap", // Inherited from Stack (MEDIUM priority gap fix)
    "className",
  ],

  HStack: [
    "gap",
    "align",
    "justify",
    "fill",
    "wrap", // Inherited from Stack (MEDIUM priority gap fix)
    "className",
  ],

  Flex: [
    "direction",
    "wrap",
    "gap",
    "rowGap",
    "columnGap",
    "alignItems",
    "alignContent",
    "justifyContent",
    "fill",
    "inline",
    "className",
  ],

  FlexItem: [
    "grow",
    "shrink",
    "basis",
    "alignSelf", // Override parent alignment (MEDIUM priority gap fix)
    "order", // Visual order (LOW priority gap fix)
    "className",
  ],

  Divider: [
    "orientation",
    "spacing", // Margin around divider (LOW priority gap fix)
    "className",
  ],

  Spacer: ["className"],

  Center: ["gap", "fill", "className"],

  AspectRatio: ["ratio", "className"],

  Wrap: ["gap", "alignItems", "justifyContent", "className"],

  // ==========================================================================
  // Content Components
  // ============================================================================

  Text: ["text", "content", "preset", "className"],

  Heading: ["text", "content", "level", "className"],

  Code: ["code", "content", "language", "inline", "className"],
}

describe("Expected Props Contract", () => {
  for (const [component, expectedProps] of Object.entries(EXPECTED_PROPS)) {
    describe(component, () => {
      const actualProps = getSchemaFields(component)

      it(`is registered in catalog`, () => {
        expect(actualProps.length).toBeGreaterThan(0)
      })

      it.each(expectedProps)("exposes %s prop", (prop) => {
        expect(actualProps).toContain(prop)
      })
    })
  }
})

describe("Regression Detection", () => {
  describe("Gap fixes are preserved", () => {
    it("Grid breakpoints are not removed", () => {
      expect(getSchemaFields("Grid")).toContain("breakpoints")
    })

    it("Grid initialRatios are not removed", () => {
      expect(getSchemaFields("Grid")).toContain("initialRatios")
    })

    it("Grid minRatio is not removed", () => {
      expect(getSchemaFields("Grid")).toContain("minRatio")
    })

    it("Stack wrap is not removed", () => {
      expect(getSchemaFields("Stack")).toContain("wrap")
    })

    it("VStack wrap is not removed", () => {
      expect(getSchemaFields("VStack")).toContain("wrap")
    })

    it("HStack wrap is not removed", () => {
      expect(getSchemaFields("HStack")).toContain("wrap")
    })

    it("FlexItem alignSelf is not removed", () => {
      expect(getSchemaFields("FlexItem")).toContain("alignSelf")
    })

    it("FlexItem order is not removed", () => {
      expect(getSchemaFields("FlexItem")).toContain("order")
    })

    it("Divider spacing is not removed", () => {
      expect(getSchemaFields("Divider")).toContain("spacing")
    })
  })
})
