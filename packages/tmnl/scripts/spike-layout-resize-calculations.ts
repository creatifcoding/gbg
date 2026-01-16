#!/usr/bin/env bun
/**
 * Spike: ResizeService Ratio Calculations and Normalization
 *
 * Author: Val
 * Date: 2026-01-16
 * Related Files:
 *   - src/lib/layout/services/ResizeService.ts
 *   - src/lib/layout/schemas/resize.ts
 *   - src/lib/layout/components/ResizeHandle.tsx
 * Expected Outcome: Verify ratio calculations maintain invariants (sum=1, min constraints)
 *
 * Hypotheses:
 * H1: Pixel to ratio conversion - pixelToRatioDelta correctly converts pixel movement to ratio delta
 * H2: Ratio normalization - normalizeRatios ensures ratios always sum to 1.0
 * H3: Minimum ratio clamping - calculateResizeSync respects minRatio constraints
 * H4: Multi-column resize propagation - Resize only affects adjacent columns (index and index+1)
 */

import { Effect } from "effect"
import {
  pixelToRatioDelta,
  normalizeRatios,
  calculateResizeSync,
} from "../src/lib/layout"

const BANNER = "=".repeat(60)

// Helper to compare floats with tolerance
const approxEqual = (a: number, b: number, tolerance = 0.0001) =>
  Math.abs(a - b) < tolerance

// =============================================================================
// H1: Pixel to ratio conversion
// =============================================================================
async function h1_pixel_to_ratio_conversion() {
  console.log("\n" + BANNER)
  console.log("H1: Pixel to ratio conversion")
  console.log("Hypothesis: pixelToRatioDelta correctly converts pixel movement to ratio delta")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    // Test 1: 100px in 1000px container = 0.1 delta
    const delta1 = pixelToRatioDelta(100, 1000)
    console.log(`Test 1: pixelToRatioDelta(100, 1000)`)
    console.log(`  Expected: 0.1`)
    console.log(`  Actual: ${delta1}`)
    const pass1 = approxEqual(delta1, 0.1)

    // Test 2: -50px in 500px container = -0.1 delta
    const delta2 = pixelToRatioDelta(-50, 500)
    console.log(`\nTest 2: pixelToRatioDelta(-50, 500)`)
    console.log(`  Expected: -0.1`)
    console.log(`  Actual: ${delta2}`)
    const pass2 = approxEqual(delta2, -0.1)

    // Test 3: Zero container size returns 0 (no division by zero)
    const delta3 = pixelToRatioDelta(100, 0)
    console.log(`\nTest 3: pixelToRatioDelta(100, 0) - zero container`)
    console.log(`  Expected: 0`)
    console.log(`  Actual: ${delta3}`)
    const pass3 = delta3 === 0

    // Test 4: Zero pixel movement returns 0
    const delta4 = pixelToRatioDelta(0, 1000)
    console.log(`\nTest 4: pixelToRatioDelta(0, 1000) - no movement`)
    console.log(`  Expected: 0`)
    console.log(`  Actual: ${delta4}`)
    const pass4 = delta4 === 0

    const allPassed = pass1 && pass2 && pass3 && pass4
    console.log(`\nAll tests: ${allPassed ? "PASS" : "FAIL"}`)
    return allPassed ? "PASS" : "FAIL"
  })

  const result = await Effect.runPromise(program)
  console.log(`\n✓ H1 Result: ${result}`)
  return result === "PASS"
}

// =============================================================================
// H2: Ratio normalization
// =============================================================================
async function h2_ratio_normalization() {
  console.log("\n" + BANNER)
  console.log("H2: Ratio normalization")
  console.log("Hypothesis: normalizeRatios ensures ratios always sum to 1.0")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    // Test 1: [0.3, 0.3, 0.3] normalizes to sum = 1.0
    const ratios1 = normalizeRatios([0.3, 0.3, 0.3])
    const sum1 = ratios1.reduce((a, b) => a + b, 0)
    console.log(`Test 1: normalizeRatios([0.3, 0.3, 0.3])`)
    console.log(`  Expected sum: 1.0`)
    console.log(`  Actual: [${ratios1.map(r => r.toFixed(4)).join(", ")}], sum=${sum1.toFixed(6)}`)
    const pass1 = approxEqual(sum1, 1.0)

    // Test 2: [0.5, 0.5] stays [0.5, 0.5]
    const ratios2 = normalizeRatios([0.5, 0.5])
    const sum2 = ratios2.reduce((a, b) => a + b, 0)
    console.log(`\nTest 2: normalizeRatios([0.5, 0.5])`)
    console.log(`  Expected: [0.5, 0.5], sum=1.0`)
    console.log(`  Actual: [${ratios2.map(r => r.toFixed(4)).join(", ")}], sum=${sum2.toFixed(6)}`)
    const pass2 = approxEqual(sum2, 1.0) && approxEqual(ratios2[0], 0.5) && approxEqual(ratios2[1], 0.5)

    // Test 3: Floating point errors corrected
    const ratios3 = normalizeRatios([0.1 + 0.2, 0.3, 0.4]) // 0.1 + 0.2 has FP error
    const sum3 = ratios3.reduce((a, b) => a + b, 0)
    console.log(`\nTest 3: normalizeRatios([0.1+0.2, 0.3, 0.4]) - FP edge case`)
    console.log(`  0.1 + 0.2 = ${0.1 + 0.2} (FP issue)`)
    console.log(`  Actual: [${ratios3.map(r => r.toFixed(4)).join(", ")}], sum=${sum3.toFixed(6)}`)
    const pass3 = approxEqual(sum3, 1.0)

    // Test 4: Unbalanced ratios get normalized
    const ratios4 = normalizeRatios([1, 2, 3]) // sum = 6
    const sum4 = ratios4.reduce((a, b) => a + b, 0)
    console.log(`\nTest 4: normalizeRatios([1, 2, 3]) - unbalanced`)
    console.log(`  Expected: [~0.167, ~0.333, ~0.5], sum=1.0`)
    console.log(`  Actual: [${ratios4.map(r => r.toFixed(4)).join(", ")}], sum=${sum4.toFixed(6)}`)
    const pass4 = approxEqual(sum4, 1.0) && approxEqual(ratios4[0], 1/6) && approxEqual(ratios4[2], 0.5)

    const allPassed = pass1 && pass2 && pass3 && pass4
    console.log(`\nAll tests: ${allPassed ? "PASS" : "FAIL"}`)
    return allPassed ? "PASS" : "FAIL"
  })

  const result = await Effect.runPromise(program)
  console.log(`\n✓ H2 Result: ${result}`)
  return result === "PASS"
}

// =============================================================================
// H3: Minimum ratio clamping
// =============================================================================
async function h3_minimum_ratio_clamping() {
  console.log("\n" + BANNER)
  console.log("H3: Minimum ratio clamping")
  console.log("Hypothesis: calculateResizeSync respects minRatio constraints")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    // Test 1: Cannot shrink column below minRatio
    // Start: [0.5, 0.5], drag right by 450px in 1000px container (+0.45)
    // This would make left = 0.95, right = 0.05 - but minRatio is 0.1
    const result1 = calculateResizeSync({
      currentPos: 950,
      startPos: 500,
      containerSize: 1000,
      startRatios: [0.5, 0.5],
      handleIndex: 0,
      minRatio: 0.1,
    })
    console.log(`Test 1: Extreme drag (would exceed min)`)
    console.log(`  Input: drag +450px, start=[0.5, 0.5], min=0.1`)
    console.log(`  Expected: right col >= 0.1`)
    console.log(`  Actual: [${result1.ratios.map(r => r.toFixed(3)).join(", ")}], applied=${result1.applied}`)
    const pass1 = result1.ratios[1] >= 0.1

    // Test 2: Normal resize within bounds
    const result2 = calculateResizeSync({
      currentPos: 600,
      startPos: 500,
      containerSize: 1000,
      startRatios: [0.5, 0.5],
      handleIndex: 0,
      minRatio: 0.1,
    })
    console.log(`\nTest 2: Normal resize (+100px)`)
    console.log(`  Input: drag +100px, start=[0.5, 0.5], min=0.1`)
    console.log(`  Expected: left~0.6, right~0.4, applied=true`)
    console.log(`  Actual: [${result2.ratios.map(r => r.toFixed(3)).join(", ")}], applied=${result2.applied}`)
    const pass2 = result2.applied && approxEqual(result2.ratios[0], 0.6) && approxEqual(result2.ratios[1], 0.4)

    // Test 3: Total ratio sum preserved after clamping
    const result3 = calculateResizeSync({
      currentPos: 900,
      startPos: 500,
      containerSize: 1000,
      startRatios: [0.5, 0.5],
      handleIndex: 0,
      minRatio: 0.1,
    })
    const sum3 = result3.ratios.reduce((a, b) => a + b, 0)
    console.log(`\nTest 3: Sum preservation after clamping`)
    console.log(`  Actual ratios: [${result3.ratios.map(r => r.toFixed(3)).join(", ")}], sum=${sum3.toFixed(6)}`)
    const pass3 = approxEqual(sum3, 1.0)

    const allPassed = pass1 && pass2 && pass3
    console.log(`\nAll tests: ${allPassed ? "PASS" : "FAIL"}`)
    return allPassed ? "PASS" : "FAIL"
  })

  const result = await Effect.runPromise(program)
  console.log(`\n✓ H3 Result: ${result}`)
  return result === "PASS"
}

// =============================================================================
// H4: Multi-column resize propagation
// =============================================================================
async function h4_multicolumn_resize_propagation() {
  console.log("\n" + BANNER)
  console.log("H4: Multi-column resize propagation")
  console.log("Hypothesis: Resize only affects adjacent columns (index and index+1)")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    // Test 1: 3-column layout, drag handle 0 - only cols 0 and 1 should change
    const result1 = calculateResizeSync({
      currentPos: 400,  // moved right by 67px (0.333 * 1000 / 5)
      startPos: 333,
      containerSize: 1000,
      startRatios: [0.333, 0.333, 0.334],
      handleIndex: 0,
      minRatio: 0.1,
    })
    console.log(`Test 1: 3-col layout, drag handle 0`)
    console.log(`  Start: [0.333, 0.333, 0.334]`)
    console.log(`  Actual: [${result1.ratios.map(r => r.toFixed(3)).join(", ")}]`)
    console.log(`  Col 2 should be unchanged (~0.334)`)
    const pass1 = approxEqual(result1.ratios[2], 0.334, 0.001)

    // Test 2: Column 2 ratio unchanged after handle 0 drag
    const colTwoUnchanged = approxEqual(result1.ratios[2], 0.334, 0.001)
    console.log(`\nTest 2: Column 2 unchanged?`)
    console.log(`  Expected: ~0.334`)
    console.log(`  Actual: ${result1.ratios[2].toFixed(6)}`)
    const pass2 = colTwoUnchanged

    // Test 3: Total sum still equals 1.0
    const sum = result1.ratios.reduce((a, b) => a + b, 0)
    console.log(`\nTest 3: Sum preservation`)
    console.log(`  Expected: 1.0`)
    console.log(`  Actual: ${sum.toFixed(6)}`)
    const pass3 = approxEqual(sum, 1.0)

    // Test 4: Drag handle 1 (between cols 1 and 2) - col 0 should be unchanged
    const result4 = calculateResizeSync({
      currentPos: 700,
      startPos: 666,
      containerSize: 1000,
      startRatios: [0.333, 0.333, 0.334],
      handleIndex: 1,
      minRatio: 0.1,
    })
    console.log(`\nTest 4: 3-col layout, drag handle 1`)
    console.log(`  Start: [0.333, 0.333, 0.334]`)
    console.log(`  Actual: [${result4.ratios.map(r => r.toFixed(3)).join(", ")}]`)
    console.log(`  Col 0 should be unchanged (~0.333)`)
    const pass4 = approxEqual(result4.ratios[0], 0.333, 0.001)

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
  console.log("\n🧪 Spike: ResizeService Ratio Calculations and Normalization")
  console.log("=".repeat(60))

  const results: Record<string, boolean> = {}

  results.H1 = await h1_pixel_to_ratio_conversion()
  results.H2 = await h2_ratio_normalization()
  results.H3 = await h3_minimum_ratio_clamping()
  results.H4 = await h4_multicolumn_resize_propagation()

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
