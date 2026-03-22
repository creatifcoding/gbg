/**
 * Minibuffer v2 Command Execution — Effect Stream Tests
 *
 * Uses @effect/vitest for Effect-native testing.
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach } from "@effect/vitest"
import { Effect, Stream, Fiber, Chunk } from "effect"
import { Registry } from "@effect-atom/atom"
import * as AtomRegistry from "@effect-atom/atom/Registry"
import { ops, resultAtom } from "../atoms"
import {
  createExecutionStream,
  pollAndExecute,
  type CommandExecutionResult,
} from "../execution"
import type { Completion } from "../machine"

// ============================================================================
// HELPERS
// ============================================================================

const createCompletion = (value: string, label?: string): Completion => ({
  value,
  label: label ?? value,
})

const resetMinibuffer = () => {
  ops.cancel()
  ops.clearResult()
}

// ============================================================================
// EFFECT STREAM TESTS
// ============================================================================

describe("minibuffer v2 createExecutionStream", () => {
  beforeEach(() => {
    resetMinibuffer()
  })

  afterEach(() => {
    resetMinibuffer()
  })

  it.effect("emits execution results for selected commands", () =>
    Effect.gen(function* () {
      const registry = Registry.make()
      const executed: CommandExecutionResult[] = []

      // Create stream with mock handler
      const stream = createExecutionStream((_commandId, _completion) =>
        Effect.void
      )

      // Trigger command selection BEFORE starting stream
      // (so the atom has a value to emit immediately)
      ops.openCommand("test-provider" as any)
      ops.selectCompletion(createCompletion("test-cmd", "Test Command"))

      // Take first emission
      const result = yield* stream.pipe(
        Stream.take(1),
        Stream.runCollect
      )

      expect(Chunk.size(result)).toBe(1)
      const first = Chunk.get(result, 0)
      expect(first._tag).toBe("Some")
      if (first._tag === "Some") {
        expect(first.value.commandId).toBe("test-cmd")
        expect(first.value.success).toBe(true)
      }

      // Result should be cleared after execution
      expect(registry.get(resultAtom)).toBeNull()
    }).pipe(
      Effect.provideService(AtomRegistry.AtomRegistry, Registry.make())
    )
  )

  it.effect("handles command execution errors gracefully", () =>
    Effect.gen(function* () {
      const stream = createExecutionStream(() =>
        Effect.fail(new Error("Command failed"))
      )

      // Trigger command selection
      ops.openCommand("test-provider" as any)
      ops.selectCompletion(createCompletion("failing-cmd"))

      // Take first emission
      const result = yield* stream.pipe(
        Stream.take(1),
        Stream.runCollect
      )

      expect(Chunk.size(result)).toBe(1)
      const first = Chunk.get(result, 0)
      expect(first._tag).toBe("Some")
      if (first._tag === "Some") {
        expect(first.value.success).toBe(false)
        expect(first.value.error).toBeDefined()
      }
    }).pipe(
      Effect.provideService(AtomRegistry.AtomRegistry, Registry.make())
    )
  )

  it.effect("pollAndExecute returns false for non-selected results", () =>
    Effect.gen(function* () {
      const registry = Registry.make()
      let handlerCalled = false

      // Submit a prompt (not a command selection)
      ops.openPrompt("Test")
      ops.submit()

      // Verify result type is "submitted"
      const result = registry.get(resultAtom)
      expect(result).not.toBeNull()
      expect(result?.type).toBe("submitted")

      // pollAndExecute should return false (doesn't execute for non-selected)
      const executed = pollAndExecute(
        () => { handlerCalled = true },
        registry
      )

      expect(executed).toBe(false)
      expect(handlerCalled).toBe(false)

      // Result should still exist (not cleared)
      expect(registry.get(resultAtom)).not.toBeNull()
    })
  )
})
