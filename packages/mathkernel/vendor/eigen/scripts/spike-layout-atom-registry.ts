#!/usr/bin/env bun
/**
 * Spike: Layout Atom Registry Lifecycle and Instance Isolation
 *
 * Author: Val
 * Date: 2026-01-16
 * Related Files:
 *   - src/lib/layout/atoms/factory.ts
 *   - src/lib/layout/atoms/layout-state.ts
 *   - src/lib/layout/services/LayoutService.ts
 * Expected Outcome: Verify atom instances are properly isolated and cleaned up
 *
 * Hypotheses:
 * H1: Atom creation idempotency - createLayoutAtoms returns same instance for same instanceId
 * H2: Instance isolation - Different instanceIds have independent state
 * H3: Disposal cleanup - disposeLayoutAtoms removes instance from registry
 * H4: Drag state lifecycle - startDrag/updateDrag/endDrag properly manage drag state
 */

import { Effect } from "effect"
import { Registry } from "@effect-atom/atom"
import {
  createLayoutAtoms,
  disposeLayoutAtoms,
  getLayoutAtoms,
  startDrag,
  updateDrag,
  endDrag,
} from "../src/lib/layout"

const BANNER = "=".repeat(60)

// =============================================================================
// H1: Atom creation idempotency
// =============================================================================
async function h1_atom_creation_idempotency() {
  console.log("\n" + BANNER)
  console.log("H1: Atom creation idempotency")
  console.log("Hypothesis: createLayoutAtoms returns same instance for same instanceId")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    const instanceId = "test-idempotency"

    // Test 1: First call creates atoms
    const atoms1 = createLayoutAtoms(instanceId, 2)
    console.log(`Test 1: First call creates atoms`)
    console.log(`  Expected: atoms object with stateAtom`)
    console.log(`  Actual: atoms1 created = ${!!atoms1}, has stateAtom = ${!!atoms1?.stateAtom}`)
    const pass1 = !!atoms1 && !!atoms1.stateAtom

    // Test 2: Second call with same ID returns identical reference
    const atoms2 = createLayoutAtoms(instanceId, 2)
    console.log(`\nTest 2: Second call returns same instance`)
    console.log(`  Expected: atoms1 === atoms2`)
    console.log(`  Actual: same reference = ${atoms1 === atoms2}`)
    const pass2 = atoms1 === atoms2

    // Test 3: Different ID creates new instance
    const differentId = "test-different"
    const atoms3 = createLayoutAtoms(differentId, 3)
    console.log(`\nTest 3: Different ID creates new instance`)
    console.log(`  Expected: atoms1 !== atoms3`)
    console.log(`  Actual: different reference = ${atoms1 !== atoms3}`)
    const pass3 = atoms1 !== atoms3

    // Cleanup
    disposeLayoutAtoms(instanceId)
    disposeLayoutAtoms(differentId)

    const allPassed = pass1 && pass2 && pass3
    console.log(`\nAll tests: ${allPassed ? "PASS" : "FAIL"}`)
    return allPassed ? "PASS" : "FAIL"
  })

  const result = await Effect.runPromise(program)
  console.log(`\n✓ H1 Result: ${result}`)
  return result === "PASS"
}

// =============================================================================
// H2: Instance isolation
// =============================================================================
async function h2_instance_isolation() {
  console.log("\n" + BANNER)
  console.log("H2: Instance isolation")
  console.log("Hypothesis: Different instanceIds have independent state")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    const registry = Registry.make()
    const idA = "instance-A"
    const idB = "instance-B"

    // Create two instances with different cell counts
    const atomsA = createLayoutAtoms(idA, 2, [0.3, 0.7])
    const atomsB = createLayoutAtoms(idB, 3, [0.33, 0.33, 0.34])

    // Test 1: Each instance has own ratios array
    const stateA = registry.get(atomsA.stateAtom)
    const stateB = registry.get(atomsB.stateAtom)
    console.log(`Test 1: Instances have different ratios`)
    console.log(`  Instance A ratios: [${stateA.ratios.join(", ")}]`)
    console.log(`  Instance B ratios: [${stateB.ratios.join(", ")}]`)
    const pass1 = stateA.ratios.length === 2 && stateB.ratios.length === 3

    // Test 2: Modifying instance-A does not affect instance-B
    // startDrag expects { x, y } position object
    startDrag(registry, idA, 0, { x: 300, y: 0 })
    const stateA2 = registry.get(atomsA.stateAtom)
    const stateB2 = registry.get(atomsB.stateAtom)
    console.log(`\nTest 2: After startDrag on A, B is unaffected`)
    console.log(`  Instance A isDragging: ${stateA2.isDragging}`)
    console.log(`  Instance B isDragging: ${stateB2.isDragging}`)
    const pass2 = stateA2.isDragging === true && stateB2.isDragging === false

    // Test 3: Drag state is instance-scoped
    // updateDrag expects currentPosition: {x, y}, containerSize, direction, minRatio
    updateDrag(registry, idA, { x: 400, y: 0 }, 1000, "horizontal", 0.1)
    const stateA3 = registry.get(atomsA.stateAtom)
    const stateB3 = registry.get(atomsB.stateAtom)
    console.log(`\nTest 3: After updateDrag on A, B ratios unchanged`)
    console.log(`  Instance A ratios: [${stateA3.ratios.map(r => r.toFixed(3)).join(", ")}]`)
    console.log(`  Instance B ratios: [${stateB3.ratios.map(r => r.toFixed(3)).join(", ")}]`)
    const pass3 = stateB3.ratios[0] === 0.33 && stateB3.ratios[1] === 0.33

    // Cleanup
    endDrag(registry, idA)
    disposeLayoutAtoms(idA)
    disposeLayoutAtoms(idB)

    const allPassed = pass1 && pass2 && pass3
    console.log(`\nAll tests: ${allPassed ? "PASS" : "FAIL"}`)
    return allPassed ? "PASS" : "FAIL"
  })

  const result = await Effect.runPromise(program)
  console.log(`\n✓ H2 Result: ${result}`)
  return result === "PASS"
}

// =============================================================================
// H3: Disposal cleanup
// =============================================================================
async function h3_disposal_cleanup() {
  console.log("\n" + BANNER)
  console.log("H3: Disposal cleanup")
  console.log("Hypothesis: disposeLayoutAtoms removes instance from registry")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    const instanceId = "test-disposal"

    // Create atoms
    const atoms1 = createLayoutAtoms(instanceId, 2)
    console.log(`Created atoms for "${instanceId}"`)
    console.log(`  getLayoutAtoms returns: ${!!getLayoutAtoms(instanceId)}`)

    // Test 1: After dispose, getLayoutAtoms returns undefined
    disposeLayoutAtoms(instanceId)
    const afterDispose = getLayoutAtoms(instanceId)
    console.log(`\nTest 1: After dispose, getLayoutAtoms returns undefined`)
    console.log(`  Expected: undefined`)
    console.log(`  Actual: ${afterDispose}`)
    const pass1 = afterDispose === undefined

    // Test 2: Re-creating with same ID creates fresh instance
    const atoms2 = createLayoutAtoms(instanceId, 3, [0.2, 0.3, 0.5])
    console.log(`\nTest 2: Re-creating with same ID creates fresh instance`)
    console.log(`  Expected: new atoms !== old atoms`)
    console.log(`  Actual: different reference = ${atoms1 !== atoms2}`)
    const pass2 = atoms1 !== atoms2

    // Test 3: Fresh instance has new state
    const registry = Registry.make()
    const state = registry.get(atoms2.stateAtom)
    console.log(`\nTest 3: Fresh instance has new ratios`)
    console.log(`  Expected: 3 ratios [0.2, 0.3, 0.5]`)
    console.log(`  Actual: ${state.ratios.length} ratios [${state.ratios.join(", ")}]`)
    const pass3 = state.ratios.length === 3

    // Cleanup
    disposeLayoutAtoms(instanceId)

    const allPassed = pass1 && pass2 && pass3
    console.log(`\nAll tests: ${allPassed ? "PASS" : "FAIL"}`)
    return allPassed ? "PASS" : "FAIL"
  })

  const result = await Effect.runPromise(program)
  console.log(`\n✓ H3 Result: ${result}`)
  return result === "PASS"
}

// =============================================================================
// H4: Drag state lifecycle
// =============================================================================
async function h4_drag_state_lifecycle() {
  console.log("\n" + BANNER)
  console.log("H4: Drag state lifecycle")
  console.log("Hypothesis: startDrag/updateDrag/endDrag properly manage drag state")
  console.log(BANNER)

  const program = Effect.gen(function* () {
    const registry = Registry.make()
    const instanceId = "test-drag-lifecycle"

    // Create atoms
    const atoms = createLayoutAtoms(instanceId, 2, [0.5, 0.5])
    const initialState = registry.get(atoms.stateAtom)
    console.log(`Initial state:`)
    console.log(`  isDragging: ${initialState.isDragging}`)
    console.log(`  ratios: [${initialState.ratios.join(", ")}]`)

    // Test 1: startDrag sets isDragging=true and activeHandleIndex
    // startDrag expects { x, y } position object
    startDrag(registry, instanceId, 0, { x: 500, y: 0 })
    const afterStart = registry.get(atoms.stateAtom)
    console.log(`\nTest 1: After startDrag`)
    console.log(`  Expected: isDragging=true, activeHandleIndex=0, startPosition.x=500`)
    console.log(`  Actual: isDragging=${afterStart.isDragging}, activeHandleIndex=${afterStart.activeHandleIndex}, startPosition.x=${afterStart.startPosition?.x}`)
    const pass1 = afterStart.isDragging === true &&
                  afterStart.activeHandleIndex === 0 &&
                  afterStart.startPosition?.x === 500

    // Test 2: updateDrag modifies ratios while dragging
    // updateDrag expects currentPosition: {x, y}, containerSize, direction, minRatio
    updateDrag(registry, instanceId, { x: 600, y: 0 }, 1000, "horizontal", 0.1)
    const afterUpdate = registry.get(atoms.stateAtom)
    console.log(`\nTest 2: After updateDrag (moved +100px in 1000px container)`)
    console.log(`  Expected: ratios ~[0.6, 0.4], still dragging`)
    console.log(`  Actual: ratios=[${afterUpdate.ratios.map(r => r.toFixed(3)).join(", ")}], isDragging=${afterUpdate.isDragging}`)
    const pass2 = afterUpdate.isDragging === true &&
                  Math.abs(afterUpdate.ratios[0] - 0.6) < 0.01 &&
                  Math.abs(afterUpdate.ratios[1] - 0.4) < 0.01

    // Test 3: endDrag sets isDragging=false, preserves ratios
    endDrag(registry, instanceId)
    const afterEnd = registry.get(atoms.stateAtom)
    console.log(`\nTest 3: After endDrag`)
    console.log(`  Expected: isDragging=false, ratios preserved`)
    console.log(`  Actual: isDragging=${afterEnd.isDragging}, ratios=[${afterEnd.ratios.map(r => r.toFixed(3)).join(", ")}]`)
    const pass3 = afterEnd.isDragging === false &&
                  Math.abs(afterEnd.ratios[0] - 0.6) < 0.01 &&
                  Math.abs(afterEnd.ratios[1] - 0.4) < 0.01

    // Cleanup
    disposeLayoutAtoms(instanceId)

    const allPassed = pass1 && pass2 && pass3
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
  console.log("\n🧪 Spike: Layout Atom Registry Lifecycle and Instance Isolation")
  console.log("=".repeat(60))

  const results: Record<string, boolean> = {}

  results.H1 = await h1_atom_creation_idempotency()
  results.H2 = await h2_instance_isolation()
  results.H3 = await h3_disposal_cleanup()
  results.H4 = await h4_drag_state_lifecycle()

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
