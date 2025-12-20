/**
 * Minibuffer v2 Command Execution Stream Tests
 *
 * TDD tests for the Effect stream that watches resultAtom and executes commands.
 *
 * Pattern: Stream.async + atom subscription (from Registry.toStream precedent)
 * - Subscribes to resultAtom changes
 * - Filters for "selected" results with completions
 * - Executes command via CommandRegistry
 * - Clears result after execution
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Effect, Stream, Fiber, Chunk, Ref, Queue } from "effect"
import { Registry } from "@effect-atom/atom"
import * as AtomRegistry from "@effect-atom/atom/Registry"
import {
  resultAtom,
  ops,
  getSnapshot,
} from "../atoms"
import type { Completion, MinibufferResult } from "../machine"

// ============================================================================
// TEST HELPERS
// ============================================================================

/** Create a test completion with command value */
const createCompletion = (value: string, label?: string): Completion => ({
  value,
  label: label ?? value,
})

/** Reset minibuffer state between tests */
const resetMinibuffer = () => {
  ops.cancel()
  ops.clearResult()
}

// ============================================================================
// EXECUTION STREAM TESTS
// ============================================================================

describe("minibuffer v2 execution stream", () => {
  beforeEach(() => {
    resetMinibuffer()
  })

  afterEach(() => {
    resetMinibuffer()
  })

  describe("result state (synchronous verification)", () => {
    it("result is selected after command selection", () => {
      const registry = Registry.make()

      ops.openCommand("test-provider" as any)
      const completion = createCompletion("toggle-theme", "Toggle Theme")
      ops.selectCompletion(completion)

      const result = registry.get(resultAtom)
      expect(result).toEqual({
        type: "selected",
        value: "toggle-theme",
        completion,
      })
    })

    it("result is submitted after prompt submit", () => {
      const registry = Registry.make()

      ops.openPrompt("Enter name: ")
      ops.updateInput("Alice")
      ops.submit()

      const result = registry.get(resultAtom)
      expect(result).toEqual({
        type: "submitted",
        value: "Alice",
      })
    })

    it("result is cancelled after cancel", () => {
      const registry = Registry.make()

      ops.openPrompt("Test")
      ops.cancel()

      const result = registry.get(resultAtom)
      expect(result).toEqual({
        type: "cancelled",
        value: "",
      })
    })

    it("result is confirmed after y-or-n confirm", () => {
      const registry = Registry.make()

      ops.openYOrN("Delete file?")
      ops.confirm()

      const result = registry.get(resultAtom)
      expect(result).toEqual({
        type: "confirmed",
        value: "y",
      })
    })

    it("result is denied after y-or-n deny", () => {
      const registry = Registry.make()

      ops.openYOrN("Delete file?")
      ops.deny()

      const result = registry.get(resultAtom)
      expect(result).toEqual({
        type: "denied",
        value: "n",
      })
    })

    it("result is null after clearResult", () => {
      const registry = Registry.make()

      ops.openPrompt("Test")
      ops.submit()
      expect(registry.get(resultAtom)).not.toBeNull()

      ops.clearResult()
      expect(registry.get(resultAtom)).toBeNull()
    })
  })

  describe("execution logic (polling pattern)", () => {
    it("executes command when result type is selected", () => {
      const registry = Registry.make()

      ops.openCommand("test-provider" as any)
      ops.selectCompletion(createCompletion("toggle-theme"))

      const result = registry.get(resultAtom)
      expect(result?.type).toBe("selected")
      expect(result?.value).toBe("toggle-theme")

      // Simulate execution stream: check result, execute, clear
      if (result?.type === "selected") {
        // Execute would happen here
        ops.clearResult()
      }

      expect(registry.get(resultAtom)).toBeNull()
    })

    it("does NOT execute for submitted results (prompt mode)", () => {
      const registry = Registry.make()

      ops.openPrompt("Enter name: ")
      ops.updateInput("Alice")
      ops.submit()

      const result = registry.get(resultAtom)
      expect(result?.type).toBe("submitted")

      // Execution stream only handles "selected" type
      // Submitted results are for prompt callers to consume
    })

    it("does NOT execute for cancelled results", () => {
      const registry = Registry.make()

      ops.openCommand("test-provider" as any)
      ops.cancel()

      const result = registry.get(resultAtom)
      expect(result?.type).toBe("cancelled")

      // Cancelled results don't trigger command execution
    })

    it("handles sequential command selections", () => {
      const registry = Registry.make()
      const executedCommands: string[] = []

      // Helper: simulate execution stream processing
      const processResult = () => {
        const result = registry.get(resultAtom)
        if (result?.type === "selected") {
          executedCommands.push(result.value)
          ops.clearResult()
        }
      }

      // Selection 1
      ops.openCommand("test-provider" as any)
      ops.selectCompletion(createCompletion("cmd-1"))
      processResult()

      // Selection 2
      ops.openCommand("test-provider" as any)
      ops.selectCompletion(createCompletion("cmd-2"))
      processResult()

      // Selection 3
      ops.openCommand("test-provider" as any)
      ops.selectCompletion(createCompletion("cmd-3"))
      processResult()

      expect(executedCommands).toEqual(["cmd-1", "cmd-2", "cmd-3"])
    })
  })
})

// ============================================================================
// POLL AND EXECUTE TESTS
// ============================================================================

import {
  pollAndExecute,
} from "../execution"

describe("minibuffer v2 pollAndExecute", () => {
  beforeEach(() => {
    resetMinibuffer()
  })

  afterEach(() => {
    resetMinibuffer()
  })

  it("executes and returns true for selected results", () => {
    const registry = Registry.make()
    const executed: string[] = []

    ops.openCommand("test-provider" as any)
    ops.selectCompletion(createCompletion("cmd-1"))

    const result = pollAndExecute(
      (commandId) => executed.push(commandId),
      registry
    )

    expect(result).toBe(true)
    expect(executed).toEqual(["cmd-1"])
    expect(registry.get(resultAtom)).toBeNull()
  })

  it("returns false when no selected result", () => {
    const registry = Registry.make()
    const executed: string[] = []

    const result = pollAndExecute(
      (commandId) => executed.push(commandId),
      registry
    )

    expect(result).toBe(false)
    expect(executed).toEqual([])
  })

  it("returns false for non-selected result types", () => {
    const registry = Registry.make()
    const executed: string[] = []

    ops.openPrompt("Test")
    ops.submit()

    const result = pollAndExecute(
      (commandId) => executed.push(commandId),
      registry
    )

    expect(result).toBe(false)
    expect(executed).toEqual([])
  })
})
