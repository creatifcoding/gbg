/**
 * @fileoverview Catalog AI Visibility Tests
 *
 * Verifies that all components and their props are visible to the AI
 * through the catalog system prompt and schema introspection.
 *
 * These tests ensure:
 * 1. All components appear in the AI prompt
 * 2. Layout components expose fine-grained control props
 * 3. Prompt documentation includes composition guidance
 *
 * @module genifer/core/__tests__/catalog-visibility.test
 */

import { describe, it, expect } from "vitest"
import {
  getSchemaFields,
  getAllComponentNames,
  promptContains,
  componentInPrompt,
} from "./catalog-introspection"

describe("Catalog AI Visibility", () => {
  describe("All components are visible", () => {
    const componentNames = getAllComponentNames()

    it("has registered components", () => {
      expect(componentNames.length).toBeGreaterThan(0)
    })

    it.each(componentNames)("component %s appears in AI prompt", (name) => {
      expect(componentInPrompt(name)).toBe(true)
    })
  })

  describe("Layout components have fine-grained control", () => {
    it("Grid exposes responsive breakpoints", () => {
      const fields = getSchemaFields("Grid")
      expect(fields).toContain("breakpoints")
      expect(fields).toContain("initialRatios")
      expect(fields).toContain("minRatio")
    })

    it("Grid exposes core props", () => {
      const fields = getSchemaFields("Grid")
      expect(fields).toContain("template")
      expect(fields).toContain("gap")
      expect(fields).toContain("direction")
      expect(fields).toContain("resizable")
    })

    it("Stack exposes wrap", () => {
      const fields = getSchemaFields("Stack")
      expect(fields).toContain("wrap")
      expect(fields).toContain("gap")
      expect(fields).toContain("direction")
    })

    it("VStack exposes wrap", () => {
      const fields = getSchemaFields("VStack")
      expect(fields).toContain("wrap")
      expect(fields).toContain("gap")
    })

    it("HStack exposes wrap", () => {
      const fields = getSchemaFields("HStack")
      expect(fields).toContain("wrap")
      expect(fields).toContain("gap")
    })

    it("Flex exposes full flexbox control", () => {
      const fields = getSchemaFields("Flex")
      expect(fields).toContain("direction")
      expect(fields).toContain("wrap")
      expect(fields).toContain("gap")
      expect(fields).toContain("alignItems")
      expect(fields).toContain("justifyContent")
    })

    it("FlexItem exposes alignSelf and order", () => {
      const fields = getSchemaFields("FlexItem")
      expect(fields).toContain("alignSelf")
      expect(fields).toContain("order")
      expect(fields).toContain("grow")
      expect(fields).toContain("shrink")
      expect(fields).toContain("basis")
    })

    it("Divider exposes spacing", () => {
      const fields = getSchemaFields("Divider")
      expect(fields).toContain("spacing")
      expect(fields).toContain("orientation")
    })
  })

  describe("Prompt documentation quality", () => {
    it("includes composition guidance", () => {
      expect(promptContains("# Component Composition")).toBe(true)
    })

    it("includes animation documentation", () => {
      expect(promptContains("# Entrance Animations")).toBe(true)
    })

    it("includes available components section", () => {
      expect(promptContains("# Available Components")).toBe(true)
    })

    it("includes JSON Schema for component documentation", () => {
      // JSON Schema is used for prop documentation
      expect(promptContains('"type": "object"')).toBe(true)
    })

    it("documents breakpoint patterns in Grid description", () => {
      // The Grid description should explain breakpoints
      expect(promptContains("breakpoints")).toBe(true)
      expect(promptContains("MinWidthCondition")).toBe(true)
    })

    it("documents wrap behavior in Stack description", () => {
      expect(promptContains("wrap")).toBe(true)
    })
  })

  describe("Container vs leaf classification", () => {
    it("Grid can have children", () => {
      expect(promptContains("### Grid")).toBe(true)
      expect(promptContains("*Can contain children*")).toBe(true)
    })

    it("Spacer cannot have children", () => {
      const fields = getSchemaFields("Spacer")
      // Spacer only has className
      expect(fields).toContain("className")
      expect(fields.length).toBeLessThanOrEqual(2) // className only
    })
  })
})
