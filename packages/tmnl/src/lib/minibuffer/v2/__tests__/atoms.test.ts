/**
 * Minibuffer v2 Bridge Atoms Tests
 *
 * Tests the Approach C (Hybrid) implementation:
 * - snapshotAtom bridges XState to effect-atom
 * - Selector atoms derive from snapshot
 * - ops send events to actor
 *
 * @module
 */

import { describe, it, expect, beforeEach } from "vitest"
import { Atom, Registry } from "@effect-atom/atom"
import {
  snapshotAtom,
  modeAtom,
  isActiveAtom,
  promptAtom,
  inputAtom,
  completionsAtom,
  selectedIndexAtom,
  selectedCompletionAtom,
  resultAtom,
  ops,
  getSnapshot,
} from "../atoms"
import type { ProviderId, Completion } from "../machine"

// Helper to create a typed provider ID
const createProviderId = (id: string): ProviderId => id as ProviderId

// Helper to create test completions
const createCompletions = (count: number): Completion[] =>
  Array.from({ length: count }, (_, i) => ({
    value: `cmd-${i}`,
    label: `Command ${i}`,
  }))

describe("minibuffer v2 atoms", () => {
  // Reset to idle before each test
  beforeEach(() => {
    // Cancel any active operation
    ops.cancel()
    ops.clearResult()
  })

  describe("snapshotAtom (bridge)", () => {
    it("provides current snapshot", () => {
      const registry = Registry.make()
      const snapshot = registry.get(snapshotAtom)

      expect(snapshot).toBeDefined()
      expect(snapshot.value).toBe("idle")
      expect(snapshot.context).toBeDefined()
    })

    it("updates when actor state changes", () => {
      const registry = Registry.make()

      // Initial state
      expect(registry.get(modeAtom)).toBe("idle")

      // Trigger state change
      ops.openPrompt("Test prompt")

      // Snapshot should update
      expect(registry.get(modeAtom)).toBe("prompt")
    })
  })

  describe("selector atoms", () => {
    it("modeAtom reflects current state", () => {
      const registry = Registry.make()

      expect(registry.get(modeAtom)).toBe("idle")

      ops.openCommand(createProviderId("test"))
      expect(registry.get(modeAtom)).toBe("command")

      ops.cancel()
      expect(registry.get(modeAtom)).toBe("idle")
    })

    it("isActiveAtom is true when not idle", () => {
      const registry = Registry.make()

      expect(registry.get(isActiveAtom)).toBe(false)

      ops.openPrompt("Test")
      expect(registry.get(isActiveAtom)).toBe(true)

      ops.cancel()
      expect(registry.get(isActiveAtom)).toBe(false)
    })

    it("promptAtom reflects prompt text", () => {
      const registry = Registry.make()

      ops.openPrompt("Enter name: ")
      expect(registry.get(promptAtom)).toBe("Enter name: ")

      ops.cancel()
      ops.openCommand(createProviderId("test"), "M-x ")
      expect(registry.get(promptAtom)).toBe("M-x ")
    })

    it("inputAtom reflects current input", () => {
      const registry = Registry.make()

      ops.openPrompt("Test")
      expect(registry.get(inputAtom)).toBe("")

      ops.updateInput("hello")
      expect(registry.get(inputAtom)).toBe("hello")

      ops.updateInput("hello world")
      expect(registry.get(inputAtom)).toBe("hello world")
    })

    it("completionsAtom reflects loaded completions", () => {
      const registry = Registry.make()

      ops.openCommand(createProviderId("test"))
      expect(registry.get(completionsAtom)).toEqual([])

      const completions = createCompletions(3)
      ops.loadCompletions(completions)
      expect(registry.get(completionsAtom)).toEqual(completions)
    })

    it("selectedIndexAtom tracks selection", () => {
      const registry = Registry.make()

      ops.openCommand(createProviderId("test"))
      ops.loadCompletions(createCompletions(5))

      expect(registry.get(selectedIndexAtom)).toBe(0)

      ops.selectNext()
      expect(registry.get(selectedIndexAtom)).toBe(1)

      ops.selectNext()
      expect(registry.get(selectedIndexAtom)).toBe(2)

      ops.selectPrev()
      expect(registry.get(selectedIndexAtom)).toBe(1)
    })

    it("selectedCompletionAtom derives from completions + index", () => {
      const registry = Registry.make()

      ops.openCommand(createProviderId("test"))

      // No completions yet
      expect(registry.get(selectedCompletionAtom)).toBeNull()

      const completions = createCompletions(3)
      ops.loadCompletions(completions)

      // First completion selected
      expect(registry.get(selectedCompletionAtom)).toEqual(completions[0])

      // Navigate to second
      ops.selectNext()
      expect(registry.get(selectedCompletionAtom)).toEqual(completions[1])
    })
  })

  describe("resultAtom", () => {
    it("is null initially", () => {
      const registry = Registry.make()
      expect(registry.get(resultAtom)).toBeNull()
    })

    it("contains submitted result after prompt submit", () => {
      const registry = Registry.make()

      ops.openPrompt("Name: ")
      ops.updateInput("Alice")
      ops.submit()

      const result = registry.get(resultAtom)
      expect(result).toEqual({
        type: "submitted",
        value: "Alice",
      })
    })

    it("contains selected result after command selection", () => {
      const registry = Registry.make()

      ops.openCommand(createProviderId("test"))
      const completion: Completion = { value: "toggle-theme", label: "Toggle Theme" }
      ops.selectCompletion(completion)

      const result = registry.get(resultAtom)
      expect(result).toEqual({
        type: "selected",
        value: "toggle-theme",
        completion,
      })
    })

    it("contains cancelled result after cancel", () => {
      const registry = Registry.make()

      ops.openPrompt("Test")
      ops.cancel()

      const result = registry.get(resultAtom)
      expect(result).toEqual({
        type: "cancelled",
        value: "",
      })
    })

    it("contains confirmed result after y-or-n confirm", () => {
      const registry = Registry.make()

      ops.openYOrN("Delete file?")
      ops.confirm()

      expect(registry.get(resultAtom)).toEqual({
        type: "confirmed",
        value: "y",
      })
    })

    it("contains denied result after y-or-n deny", () => {
      const registry = Registry.make()

      ops.openYOrN("Delete file?")
      ops.deny()

      expect(registry.get(resultAtom)).toEqual({
        type: "denied",
        value: "n",
      })
    })

    it("clears on clearResult", () => {
      const registry = Registry.make()

      ops.openPrompt("Test")
      ops.submit()
      expect(registry.get(resultAtom)).not.toBeNull()

      ops.clearResult()
      expect(registry.get(resultAtom)).toBeNull()
    })
  })

  describe("ops", () => {
    it("openPrompt sets up prompt mode", () => {
      ops.openPrompt("Enter value: ", "default")

      const snapshot = getSnapshot()
      expect(snapshot.value).toBe("prompt")
      expect(snapshot.context.prompt).toBe("Enter value: ")
      expect(snapshot.context.input).toBe("default")
    })

    it("openCommand sets up command mode", () => {
      ops.openCommand(createProviderId("commands"), "M-x ")

      const snapshot = getSnapshot()
      expect(snapshot.value).toBe("command")
      expect(snapshot.context.prompt).toBe("M-x ")
      expect(snapshot.context.providerId).toBe("commands")
    })

    it("openYOrN sets up y-or-n mode", () => {
      ops.openYOrN("Proceed?")

      const snapshot = getSnapshot()
      expect(snapshot.value).toBe("yOrN")
      expect(snapshot.context.prompt).toBe("Proceed? (y or n) ")
    })

    it("openWhichKey sets up which-key mode", () => {
      const entries = [
        { key: "f", label: "Find file", isPrefix: false },
        { key: "b", label: "+Buffer", isPrefix: true },
      ]
      ops.openWhichKey("C-x ", entries)

      const snapshot = getSnapshot()
      expect(snapshot.value).toBe("whichKey")
      expect(snapshot.context.whichKeyPrefix).toBe("C-x ")
      expect(snapshot.context.whichKeyEntries).toEqual(entries)
    })

    it("selectIndex clamps to valid range", () => {
      const registry = Registry.make()

      ops.openCommand(createProviderId("test"))
      ops.loadCompletions(createCompletions(3))

      ops.selectIndex(100) // Out of range
      expect(registry.get(selectedIndexAtom)).toBe(2) // Clamped to last

      ops.selectIndex(-5) // Negative
      expect(registry.get(selectedIndexAtom)).toBe(0) // Clamped to first
    })

    it("submit with selected completion returns that completion", () => {
      const registry = Registry.make()

      ops.openCommand(createProviderId("test"))
      const completions = createCompletions(3)
      ops.loadCompletions(completions)
      ops.selectNext() // Index 1

      ops.submit()

      const result = registry.get(resultAtom)
      expect(result?.type).toBe("selected")
      expect(result?.value).toBe("cmd-1")
    })
  })

  describe("getSnapshot", () => {
    it("returns current snapshot synchronously", () => {
      ops.openPrompt("Test")
      ops.updateInput("value")

      const snapshot = getSnapshot()
      expect(snapshot.value).toBe("prompt")
      expect(snapshot.context.input).toBe("value")
    })
  })
})
