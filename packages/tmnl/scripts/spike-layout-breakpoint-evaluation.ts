#!/usr/bin/env bun
/**
 * Spike: Breakpoint Condition Evaluation with Match.exhaustive
 *
 * Author: Val
 * Date: 2026-01-16
 * Related Files:
 *   - src/lib/layout/services/BreakpointService.ts
 *   - src/lib/layout/schemas/breakpoint.ts
 *   - src/lib/layout/hooks/useBreakpoint.ts
 * Expected Outcome: Verify Match.exhaustive correctly handles all breakpoint condition types
 *
 * Hypotheses:
 * H1: MinWidthCondition matching - MinWidthCondition matches when containerWidth >= minWidth
 * H2: MaxWidthCondition matching - MaxWidthCondition matches when containerWidth <= maxWidth
 * H3: RangeWidthCondition matching - RangeWidthCondition matches when minWidth <= containerWidth <= maxWidth
 * H4: Breakpoint array evaluation order - First matching breakpoint wins, falls back to default
 */

import { Effect } from "effect"
import {
  evaluateBreakpoints,
  minWidth,
  maxWidth,
  range,
  type LayoutBreakpoints,
} from "../src/lib/layout"

const BANNER = "=".repeat(60)

// =============================================================================
// H1: MinWidthCondition matching
// =============================================================================
async function h1_minwidth_condition_matching() {
  console.log("\n" + BANNER)
  console.log("H1: MinWidthCondition matching")
  console.log("Hypothesis: MinWidthCondition matches when containerWidth >= minWidth")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    const breakpoints: LayoutBreakpoints = [minWidth(1024, "1fr 1fr 1fr")]

    // Test 1: 1200px container should match minWidth(1024)
    const result1 = evaluateBreakpoints(1200, breakpoints, "1fr")
    console.log(`Test 1: 1200px container with minWidth(1024)`)
    console.log(`  Expected: template="1fr 1fr 1fr", matchedIndex=0`)
    console.log(`  Actual: template="${result1.template}", matchedIndex=${result1.matchedIndex}`)
    const pass1 = result1.template === "1fr 1fr 1fr" && result1.matchedIndex === 0

    // Test 2: 800px container should NOT match minWidth(1024)
    const result2 = evaluateBreakpoints(800, breakpoints, "1fr")
    console.log(`\nTest 2: 800px container with minWidth(1024)`)
    console.log(`  Expected: template="1fr" (default), matchedIndex=-1`)
    console.log(`  Actual: template="${result2.template}", matchedIndex=${result2.matchedIndex}`)
    const pass2 = result2.template === "1fr" && result2.matchedIndex === -1

    // Test 3: Boundary - 1024px container should match minWidth(1024)
    const result3 = evaluateBreakpoints(1024, breakpoints, "1fr")
    console.log(`\nTest 3: 1024px container with minWidth(1024) (boundary)`)
    console.log(`  Expected: template="1fr 1fr 1fr", matchedIndex=0`)
    console.log(`  Actual: template="${result3.template}", matchedIndex=${result3.matchedIndex}`)
    const pass3 = result3.template === "1fr 1fr 1fr" && result3.matchedIndex === 0

    const allPassed = pass1 && pass2 && pass3
    console.log(`\nAll tests: ${allPassed ? "PASS" : "FAIL"}`)
    return allPassed ? "PASS" : "FAIL"
  })

  const result = await Effect.runPromise(program)
  console.log(`\n✓ H1 Result: ${result}`)
  return result === "PASS"
}

// =============================================================================
// H2: MaxWidthCondition matching
// =============================================================================
async function h2_maxwidth_condition_matching() {
  console.log("\n" + BANNER)
  console.log("H2: MaxWidthCondition matching")
  console.log("Hypothesis: MaxWidthCondition matches when containerWidth <= maxWidth")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    const breakpoints: LayoutBreakpoints = [maxWidth(768, "1fr")]

    // Test 1: 500px container should match maxWidth(768)
    const result1 = evaluateBreakpoints(500, breakpoints, "1fr 1fr 1fr")
    console.log(`Test 1: 500px container with maxWidth(768)`)
    console.log(`  Expected: template="1fr", matchedIndex=0`)
    console.log(`  Actual: template="${result1.template}", matchedIndex=${result1.matchedIndex}`)
    const pass1 = result1.template === "1fr" && result1.matchedIndex === 0

    // Test 2: 900px container should NOT match maxWidth(768)
    const result2 = evaluateBreakpoints(900, breakpoints, "1fr 1fr 1fr")
    console.log(`\nTest 2: 900px container with maxWidth(768)`)
    console.log(`  Expected: template="1fr 1fr 1fr" (default), matchedIndex=-1`)
    console.log(`  Actual: template="${result2.template}", matchedIndex=${result2.matchedIndex}`)
    const pass2 = result2.template === "1fr 1fr 1fr" && result2.matchedIndex === -1

    // Test 3: Boundary - 768px container should match maxWidth(768)
    const result3 = evaluateBreakpoints(768, breakpoints, "1fr 1fr 1fr")
    console.log(`\nTest 3: 768px container with maxWidth(768) (boundary)`)
    console.log(`  Expected: template="1fr", matchedIndex=0`)
    console.log(`  Actual: template="${result3.template}", matchedIndex=${result3.matchedIndex}`)
    const pass3 = result3.template === "1fr" && result3.matchedIndex === 0

    const allPassed = pass1 && pass2 && pass3
    console.log(`\nAll tests: ${allPassed ? "PASS" : "FAIL"}`)
    return allPassed ? "PASS" : "FAIL"
  })

  const result = await Effect.runPromise(program)
  console.log(`\n✓ H2 Result: ${result}`)
  return result === "PASS"
}

// =============================================================================
// H3: RangeWidthCondition matching
// =============================================================================
async function h3_range_condition_matching() {
  console.log("\n" + BANNER)
  console.log("H3: RangeWidthCondition matching")
  console.log("Hypothesis: RangeWidthCondition matches when minWidth <= containerWidth <= maxWidth")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    const breakpoints: LayoutBreakpoints = [range(768, 1024, "1fr 1fr")]

    // Test 1: 900px container should match range(768, 1024)
    const result1 = evaluateBreakpoints(900, breakpoints, "1fr")
    console.log(`Test 1: 900px container with range(768, 1024)`)
    console.log(`  Expected: template="1fr 1fr", matchedIndex=0`)
    console.log(`  Actual: template="${result1.template}", matchedIndex=${result1.matchedIndex}`)
    const pass1 = result1.template === "1fr 1fr" && result1.matchedIndex === 0

    // Test 2: 500px container should NOT match range(768, 1024)
    const result2 = evaluateBreakpoints(500, breakpoints, "1fr")
    console.log(`\nTest 2: 500px container with range(768, 1024)`)
    console.log(`  Expected: template="1fr" (default), matchedIndex=-1`)
    console.log(`  Actual: template="${result2.template}", matchedIndex=${result2.matchedIndex}`)
    const pass2 = result2.template === "1fr" && result2.matchedIndex === -1

    // Test 3: Boundary - 768px container should match range(768, 1024)
    const result3 = evaluateBreakpoints(768, breakpoints, "1fr")
    console.log(`\nTest 3: 768px container (lower boundary)`)
    console.log(`  Expected: template="1fr 1fr", matchedIndex=0`)
    console.log(`  Actual: template="${result3.template}", matchedIndex=${result3.matchedIndex}`)
    const pass3 = result3.template === "1fr 1fr" && result3.matchedIndex === 0

    // Test 4: Boundary - 1024px container should match range(768, 1024)
    const result4 = evaluateBreakpoints(1024, breakpoints, "1fr")
    console.log(`\nTest 4: 1024px container (upper boundary)`)
    console.log(`  Expected: template="1fr 1fr", matchedIndex=0`)
    console.log(`  Actual: template="${result4.template}", matchedIndex=${result4.matchedIndex}`)
    const pass4 = result4.template === "1fr 1fr" && result4.matchedIndex === 0

    // Test 5: 1200px container should NOT match range(768, 1024)
    const result5 = evaluateBreakpoints(1200, breakpoints, "1fr")
    console.log(`\nTest 5: 1200px container (above range)`)
    console.log(`  Expected: template="1fr" (default), matchedIndex=-1`)
    console.log(`  Actual: template="${result5.template}", matchedIndex=${result5.matchedIndex}`)
    const pass5 = result5.template === "1fr" && result5.matchedIndex === -1

    const allPassed = pass1 && pass2 && pass3 && pass4 && pass5
    console.log(`\nAll tests: ${allPassed ? "PASS" : "FAIL"}`)
    return allPassed ? "PASS" : "FAIL"
  })

  const result = await Effect.runPromise(program)
  console.log(`\n✓ H3 Result: ${result}`)
  return result === "PASS"
}

// =============================================================================
// H4: Breakpoint array evaluation order
// =============================================================================
async function h4_breakpoint_array_order() {
  console.log("\n" + BANNER)
  console.log("H4: Breakpoint array evaluation order")
  console.log("Hypothesis: First matching breakpoint wins, falls back to default")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    // Multiple breakpoints - mobile first ordering (largest first)
    const breakpoints: LayoutBreakpoints = [
      minWidth(1024, "1fr 1fr 1fr", 24),  // index 0: desktop
      minWidth(768, "1fr 1fr", 16),        // index 1: tablet
    ]

    // Test 1: 1200px should match first breakpoint (desktop)
    const result1 = evaluateBreakpoints(1200, breakpoints, "1fr", 8)
    console.log(`Test 1: 1200px container (desktop)`)
    console.log(`  Expected: template="1fr 1fr 1fr", gap=24, matchedIndex=0`)
    console.log(`  Actual: template="${result1.template}", gap=${result1.gap}, matchedIndex=${result1.matchedIndex}`)
    const pass1 = result1.template === "1fr 1fr 1fr" && result1.gap === 24 && result1.matchedIndex === 0

    // Test 2: 900px should match second breakpoint (tablet)
    const result2 = evaluateBreakpoints(900, breakpoints, "1fr", 8)
    console.log(`\nTest 2: 900px container (tablet)`)
    console.log(`  Expected: template="1fr 1fr", gap=16, matchedIndex=1`)
    console.log(`  Actual: template="${result2.template}", gap=${result2.gap}, matchedIndex=${result2.matchedIndex}`)
    const pass2 = result2.template === "1fr 1fr" && result2.gap === 16 && result2.matchedIndex === 1

    // Test 3: 500px should fall back to default (mobile)
    const result3 = evaluateBreakpoints(500, breakpoints, "1fr", 8)
    console.log(`\nTest 3: 500px container (mobile - no match)`)
    console.log(`  Expected: template="1fr" (default), gap=8 (default), matchedIndex=-1`)
    console.log(`  Actual: template="${result3.template}", gap=${result3.gap}, matchedIndex=${result3.matchedIndex}`)
    const pass3 = result3.template === "1fr" && result3.gap === 8 && result3.matchedIndex === -1

    // Test 4: Empty breakpoints array
    const result4 = evaluateBreakpoints(1000, [], "custom-template", 32)
    console.log(`\nTest 4: Empty breakpoints array`)
    console.log(`  Expected: template="custom-template", gap=32, matchedIndex=-1`)
    console.log(`  Actual: template="${result4.template}", gap=${result4.gap}, matchedIndex=${result4.matchedIndex}`)
    const pass4 = result4.template === "custom-template" && result4.gap === 32 && result4.matchedIndex === -1

    const allPassed = pass1 && pass2 && pass3 && pass4
    console.log(`\nAll tests: ${allPassed ? "PASS" : "FAIL"}`)
    return allPassed ? "PASS" : "FAIL"
  })

  const result = await Effect.runPromise(program)
  console.log(`\n✓ H4 Result: ${result}`)
  return result === "PASS"
}

// =============================================================================
// Main
// =============================================================================
async function main() {
  console.log("\n🧪 Spike: Breakpoint Condition Evaluation with Match.exhaustive")
  console.log("=".repeat(60))

  const results: Record<string, boolean> = {}

  results.H1 = await h1_minwidth_condition_matching()
  results.H2 = await h2_maxwidth_condition_matching()
  results.H3 = await h3_range_condition_matching()
  results.H4 = await h4_breakpoint_array_order()

  // Summary
  console.log("\n" + BANNER)
  console.log("SUMMARY")
  console.log(BANNER)
  for (const [h, passed] of Object.entries(results)) {
    console.log(`  ${passed ? "✅" : "❌"} ${h}`)
  }

  const allPassed = Object.values(results).every(Boolean)
  console.log(`\n${allPassed ? "✅ All hypotheses passed" : "❌ Some hypotheses failed"}`)

  process.exit(allPassed ? 0 : 1)
}

main().catch(console.error)
