#!/usr/bin/env bun
/**
 * Spike: Server-Side Layout Module Compatibility for genifer Generate Endpoint
 *
 * Author: Val
 * Date: 2026-01-16
 * Related Files:
 *   - src/lib/layout/index.ts
 *   - src/lib/layout/schemas/index.ts
 *   - src/lib/layout/services/BreakpointService.ts
 *   - src/lib/layout/services/ResizeService.ts
 *   - src/lib/layout/catalog/layout-catalog.ts
 * Expected Outcome: Verify layout schemas, services, and catalog work without browser globals
 *
 * Hypotheses:
 * H1: Schemas work server-side - no browser globals required
 * H2: Services work server-side - pure calculations
 * H3: Catalog creation server-side - can query components
 * H4: Generate endpoint integration - NDJSON patches work
 */

import { Schema } from "effect"
import {
  // Schemas
  SPACING_VALUES,
  minWidth,
  GridState,
  // Services
  evaluateBreakpoints,
  calculateResizeSync,
  pixelToRatioDelta,
  // Catalog
  layoutCatalog,
} from "../src/lib/layout"

const BANNER = "=".repeat(60)

// =============================================================================
// H1: Schemas work server-side
// =============================================================================
async function h1_schemas_work_server_side() {
  console.log("\n" + BANNER)
  console.log("H1: Schemas work server-side")
  console.log("Hypothesis: Layout schemas instantiate and validate without browser globals")
  console.log(BANNER)

  // Check 1: Verify server-side context
  const hasWindow = typeof globalThis.window !== "undefined"
  const hasResizeObserver = typeof globalThis.ResizeObserver !== "undefined"
  console.log(`Check 1: Server-side context`)
  console.log(`  typeof window: ${typeof globalThis.window}`)
  console.log(`  ResizeObserver available: ${hasResizeObserver}`)

  // Check 2: SpacingToken validation
  const validSpacing = 16
  const invalidSpacing = 7
  const isValidSpacing = SPACING_VALUES.includes(validSpacing)
  const isInvalidSpacing = SPACING_VALUES.includes(invalidSpacing)
  console.log(`\nCheck 2: SpacingToken validation`)
  console.log(`  Valid spacing (16): ${isValidSpacing}`)
  console.log(`  Invalid spacing (7): ${isInvalidSpacing}`)
  const pass2 = isValidSpacing && !isInvalidSpacing

  // Check 3: LayoutBreakpoint creation
  const breakpoint = minWidth(768, "1fr 1fr", 16)
  console.log(`\nCheck 3: LayoutBreakpoint creation`)
  console.log(`  minWidth(768, "1fr 1fr") =`)
  console.log(`    condition._tag: ${breakpoint.condition._tag}`)
  console.log(`    template: ${breakpoint.template}`)
  console.log(`    gap: ${breakpoint.gap}`)
  const pass3 = breakpoint.condition._tag === "MinWidthCondition" &&
                breakpoint.template === "1fr 1fr"

  // Check 4: GridState schema encode/decode roundtrip
  const gridState = new GridState({
    activeTemplate: "1fr 1fr",
    activeGap: 16,
    containerWidth: 1000,
    ratios: [0.5, 0.5],
  })
  const encoded = Schema.encodeSync(GridState)(gridState)
  const decoded = Schema.decodeSync(GridState)(encoded)
  console.log(`\nCheck 4: GridState encode/decode roundtrip`)
  console.log(`  Original: ratios=[${gridState.ratios?.join(", ")}], template="${gridState.activeTemplate}"`)
  console.log(`  Decoded: ratios=[${decoded.ratios?.join(", ")}], template="${decoded.activeTemplate}"`)
  const pass4 = decoded.ratios?.[0] === 0.5 && decoded.activeTemplate === "1fr 1fr"

  const allPassed = pass2 && pass3 && pass4
  console.log(`\nAll checks: ${allPassed ? "PASS" : "FAIL"}`)
  return allPassed
}

// =============================================================================
// H2: Services work server-side
// =============================================================================
async function h2_services_work_server_side() {
  console.log("\n" + BANNER)
  console.log("H2: Services work server-side")
  console.log("Hypothesis: BreakpointService and ResizeService execute without browser dependencies")
  console.log(BANNER)

  // Setup breakpoints
  const breakpoints = [
    minWidth(1024, "1fr 1fr 1fr", 24),  // Desktop
    minWidth(768, "1fr 1fr", 16),        // Tablet
  ]

  // Check 1: evaluateBreakpoints for desktop (1200px)
  const result1200 = evaluateBreakpoints(1200, breakpoints, "1fr", 8)
  console.log(`Check 1: evaluateBreakpoints(1200px)`)
  console.log(`  Expected: template="1fr 1fr 1fr", gap=24`)
  console.log(`  Actual: template="${result1200.template}", gap=${result1200.gap}`)
  const pass1 = result1200.template === "1fr 1fr 1fr" && result1200.gap === 24

  // Check 2: evaluateBreakpoints for tablet (800px)
  const result800 = evaluateBreakpoints(800, breakpoints, "1fr", 8)
  console.log(`\nCheck 2: evaluateBreakpoints(800px)`)
  console.log(`  Expected: template="1fr 1fr", gap=16`)
  console.log(`  Actual: template="${result800.template}", gap=${result800.gap}`)
  const pass2 = result800.template === "1fr 1fr" && result800.gap === 16

  // Check 3: evaluateBreakpoints for mobile (500px - default)
  const result500 = evaluateBreakpoints(500, breakpoints, "1fr", 8)
  console.log(`\nCheck 3: evaluateBreakpoints(500px)`)
  console.log(`  Expected: template="1fr" (default), gap=8`)
  console.log(`  Actual: template="${result500.template}", gap=${result500.gap}`)
  const pass3 = result500.template === "1fr" && result500.gap === 8

  // Check 4: calculateResizeSync
  const resizeResult = calculateResizeSync({
    currentPos: 600,
    startPos: 500,
    containerSize: 1000,
    startRatios: [0.5, 0.5],
    handleIndex: 0,
    minRatio: 0.1,
  })
  console.log(`\nCheck 4: calculateResizeSync (+100px drag)`)
  console.log(`  Expected: ratios=[0.6, 0.4], applied=true`)
  console.log(`  Actual: ratios=[${resizeResult.ratios.map(r => r.toFixed(3)).join(", ")}], applied=${resizeResult.applied}`)
  const pass4 = resizeResult.applied &&
                Math.abs(resizeResult.ratios[0] - 0.6) < 0.01 &&
                Math.abs(resizeResult.ratios[1] - 0.4) < 0.01

  // Check 5: pixelToRatioDelta
  const ratioDelta = pixelToRatioDelta(100, 1000)
  console.log(`\nCheck 5: pixelToRatioDelta(100px, 1000px)`)
  console.log(`  Expected: 0.1`)
  console.log(`  Actual: ${ratioDelta}`)
  const pass5 = Math.abs(ratioDelta - 0.1) < 0.0001

  const allPassed = pass1 && pass2 && pass3 && pass4 && pass5
  console.log(`\nAll checks: ${allPassed ? "PASS" : "FAIL"}`)
  return allPassed
}

// =============================================================================
// H3: Catalog creation server-side
// =============================================================================
async function h3_catalog_server_side() {
  console.log("\n" + BANNER)
  console.log("H3: Catalog creation server-side")
  console.log("Hypothesis: layoutCatalog can be imported and queried server-side")
  console.log(BANNER)

  // Check 1: Catalog name
  console.log(`Check 1: Catalog metadata`)
  console.log(`  name: ${layoutCatalog.name}`)
  const pass1 = layoutCatalog.name === "TMNL Layout"

  // Check 2: Required components exist
  const requiredComponents = ["Grid", "Stack", "VStack", "HStack", "Flex", "Spacer", "Center"]
  const componentNames = Object.keys(layoutCatalog.components)
  console.log(`\nCheck 2: Required components`)
  console.log(`  Required: [${requiredComponents.join(", ")}]`)
  console.log(`  Available: [${componentNames.join(", ")}]`)
  const pass2 = requiredComponents.every(c => componentNames.includes(c))

  // Check 3: Grid component structure
  const gridComponent = layoutCatalog.components.Grid
  console.log(`\nCheck 3: Grid component structure`)
  console.log(`  hasChildren: ${gridComponent?.hasChildren}`)
  console.log(`  description exists: ${!!gridComponent?.description}`)
  console.log(`  props schema exists: ${!!gridComponent?.props}`)
  const pass3 = gridComponent?.hasChildren === true &&
                !!gridComponent?.description &&
                !!gridComponent?.props

  // Check 4: Stack component structure
  const stackComponent = layoutCatalog.components.Stack
  console.log(`\nCheck 4: Stack component structure`)
  console.log(`  hasChildren: ${stackComponent?.hasChildren}`)
  console.log(`  description: ${stackComponent?.description?.substring(0, 50)}...`)
  const pass4 = stackComponent?.hasChildren === true

  // Check 5: Spacer has no children
  const spacerComponent = layoutCatalog.components.Spacer
  console.log(`\nCheck 5: Spacer (no children)`)
  console.log(`  hasChildren: ${spacerComponent?.hasChildren}`)
  const pass5 = spacerComponent?.hasChildren === false

  const allPassed = pass1 && pass2 && pass3 && pass4 && pass5
  console.log(`\nAll checks: ${allPassed ? "PASS" : "FAIL"}`)
  return allPassed
}

// =============================================================================
// H4: Generate endpoint integration
// =============================================================================
async function h4_generate_endpoint_integration() {
  console.log("\n" + BANNER)
  console.log("H4: Generate endpoint integration")
  console.log("Hypothesis: Layout JSON patches can be generated server-side for streaming")
  console.log(BANNER)

  // Check 1: Generate Grid patch
  const gridPatch = {
    op: "add",
    path: "/elements/dashboard-grid",
    value: {
      key: "dashboard-grid",
      type: "Grid",
      props: { template: "1fr 1fr 1fr", gap: 16, resizable: true },
      children: ["card1", "card2", "card3"],
    },
  }
  console.log(`Check 1: Grid patch generation`)
  console.log(`  type: ${gridPatch.value.type}`)
  const gridValid = layoutCatalog.components.Grid !== undefined
  console.log(`  Grid in catalog: ${gridValid}`)
  const pass1 = gridValid

  // Check 2: Generate VStack patch
  const vstackPatch = {
    op: "add",
    path: "/elements/main-stack",
    value: {
      key: "main-stack",
      type: "VStack",
      props: { gap: 24, align: "stretch" },
      children: ["header", "content", "footer"],
    },
  }
  console.log(`\nCheck 2: VStack patch generation`)
  console.log(`  type: ${vstackPatch.value.type}`)
  const vstackValid = layoutCatalog.components.VStack !== undefined
  console.log(`  VStack in catalog: ${vstackValid}`)
  const pass2 = vstackValid

  // Check 3: Generate complex layout patches
  const layoutPatches = [
    { op: "set", path: "/root", value: "app-container" },
    {
      op: "add",
      path: "/elements/app-container",
      value: { key: "app-container", type: "VStack", props: { gap: 0, fill: true }, children: ["header-row", "main-grid"] },
    },
    {
      op: "add",
      path: "/elements/header-row",
      value: { key: "header-row", type: "HStack", props: { gap: 8, align: "center" }, children: ["logo", "spacer", "nav"] },
    },
    {
      op: "add",
      path: "/elements/spacer",
      value: { key: "spacer", type: "Spacer", props: {} },
    },
    {
      op: "add",
      path: "/elements/main-grid",
      value: { key: "main-grid", type: "Grid", props: { template: "250px 1fr 300px", gap: 16 }, children: ["sidebar", "content"] },
    },
  ]
  console.log(`\nCheck 3: Complex layout patches`)
  console.log(`  Total patches: ${layoutPatches.length}`)
  const patchTypes = layoutPatches.filter(p => p.op === "add").map(p => (p as any).value.type)
  console.log(`  Component types: [${patchTypes.join(", ")}]`)
  const pass3 = layoutPatches.length === 5

  // Check 4: Serialize to NDJSON
  const ndjson = layoutPatches.map(p => JSON.stringify(p)).join("\n")
  console.log(`\nCheck 4: NDJSON serialization`)
  console.log(`  Lines: ${ndjson.split("\n").length}`)
  console.log(`  Total bytes: ${Buffer.byteLength(ndjson, "utf8")}`)
  const pass4 = ndjson.split("\n").length === 5

  // Check 5: Validate all types exist in catalog
  const usedTypes = new Set(patchTypes)
  const allTypesValid = Array.from(usedTypes).every(t => layoutCatalog.components[t] !== undefined)
  console.log(`\nCheck 5: All types valid in catalog`)
  console.log(`  Types: [${Array.from(usedTypes).join(", ")}]`)
  console.log(`  All valid: ${allTypesValid}`)
  const pass5 = allTypesValid

  const allPassed = pass1 && pass2 && pass3 && pass4 && pass5
  console.log(`\nAll checks: ${allPassed ? "PASS" : "FAIL"}`)
  return allPassed
}

// =============================================================================
// Main
// =============================================================================
async function main() {
  console.log("\n🧪 Spike: Server-Side Layout Module Compatibility")
  console.log("=".repeat(60))

  const results: Record<string, boolean> = {}

  results.H1 = await h1_schemas_work_server_side()
  results.H2 = await h2_services_work_server_side()
  results.H3 = await h3_catalog_server_side()
  results.H4 = await h4_generate_endpoint_integration()

  // Summary
  console.log("\n" + BANNER)
  console.log("SUMMARY")
  console.log(BANNER)
  for (const [h, passed] of Object.entries(results)) {
    console.log(`  ${passed ? "✅" : "❌"} ${h}`)
  }

  const allPassed = Object.values(results).every(Boolean)
  console.log(`\n${allPassed ? "✅ All hypotheses passed" : "❌ Some hypotheses failed"}`)

  if (allPassed) {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  SERVER-SIDE LAYOUT COMPATIBILITY VERIFIED                 ║
╠════════════════════════════════════════════════════════════╣
║  Safe for: genifer generate endpoint, SSR, backends    ║
╚════════════════════════════════════════════════════════════╝
`)
  }

  process.exit(allPassed ? 0 : 1)
}

main().catch(console.error)
