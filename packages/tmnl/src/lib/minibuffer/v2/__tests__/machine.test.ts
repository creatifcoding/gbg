/**
 * Minibuffer v2 Machine Tests
 *
 * TDD tests for the XState minibuffer machine.
 *
 * @module
 */

import { describe, it, expect } from "vitest"
import { createActor } from "xstate"
import { minibufferMachine } from "../machine"
import type { ProviderId, Completion } from "../machine"

// Helper to create a typed provider ID
const createProviderId = (id: string): ProviderId => id as ProviderId

// Helper to create test completions
const createCompletions = (count: number): Completion[] =>
  Array.from({ length: count }, (_, i) => ({
    value: `cmd-${i}`,
    label: `Command ${i}`,
    description: `Description ${i}`,
  }))

describe("minibufferMachine", () => {
  describe("initial state", () => {
    it("starts in idle state", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      expect(actor.getSnapshot().value).toBe("idle")
      expect(actor.getSnapshot().context.result).toBeNull()

      actor.stop()
    })
  })

  describe("prompt mode", () => {
    it("transitions to prompt on OPEN_PROMPT", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({ type: "OPEN_PROMPT", prompt: "Enter name: " })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe("prompt")
      expect(snapshot.context.prompt).toBe("Enter name: ")
      expect(snapshot.context.input).toBe("")

      actor.stop()
    })

    it("sets default value if provided", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({
        type: "OPEN_PROMPT",
        prompt: "Enter name: ",
        defaultValue: "John",
      })

      expect(actor.getSnapshot().context.input).toBe("John")

      actor.stop()
    })

    it("updates input on INPUT_CHANGE", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({ type: "OPEN_PROMPT", prompt: "Enter name: " })
      actor.send({ type: "INPUT_CHANGE", value: "Alice" })

      expect(actor.getSnapshot().context.input).toBe("Alice")

      actor.stop()
    })

    it("sets submitted result on SUBMIT", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({ type: "OPEN_PROMPT", prompt: "Enter name: " })
      actor.send({ type: "INPUT_CHANGE", value: "Bob" })
      actor.send({ type: "SUBMIT" })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe("idle")
      expect(snapshot.context.result).toEqual({
        type: "submitted",
        value: "Bob",
      })

      actor.stop()
    })

    it("sets cancelled result on CANCEL", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({ type: "OPEN_PROMPT", prompt: "Enter name: " })
      actor.send({ type: "INPUT_CHANGE", value: "Bob" })
      actor.send({ type: "CANCEL" })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe("idle")
      expect(snapshot.context.result).toEqual({
        type: "cancelled",
        value: "",
      })

      actor.stop()
    })
  })

  describe("command mode", () => {
    it("transitions to command on OPEN_COMMAND", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({
        type: "OPEN_COMMAND",
        providerId: createProviderId("commands"),
        prompt: "M-x ",
      })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe("command")
      expect(snapshot.context.prompt).toBe("M-x ")
      expect(snapshot.context.providerId).toBe("commands")

      actor.stop()
    })

    it("uses default prompt if not provided", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({
        type: "OPEN_COMMAND",
        providerId: createProviderId("commands"),
      })

      expect(actor.getSnapshot().context.prompt).toBe("M-x ")

      actor.stop()
    })

    it("loads completions on COMPLETIONS_LOADED", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({
        type: "OPEN_COMMAND",
        providerId: createProviderId("commands"),
      })

      const completions = createCompletions(5)
      actor.send({ type: "COMPLETIONS_LOADED", completions })

      expect(actor.getSnapshot().context.completions).toEqual(completions)
      expect(actor.getSnapshot().context.selectedIndex).toBe(0)

      actor.stop()
    })

    it("navigates completions with SELECT_NEXT", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({
        type: "OPEN_COMMAND",
        providerId: createProviderId("commands"),
      })
      actor.send({ type: "COMPLETIONS_LOADED", completions: createCompletions(3) })

      expect(actor.getSnapshot().context.selectedIndex).toBe(0)

      actor.send({ type: "SELECT_NEXT" })
      expect(actor.getSnapshot().context.selectedIndex).toBe(1)

      actor.send({ type: "SELECT_NEXT" })
      expect(actor.getSnapshot().context.selectedIndex).toBe(2)

      // Wraps around
      actor.send({ type: "SELECT_NEXT" })
      expect(actor.getSnapshot().context.selectedIndex).toBe(0)

      actor.stop()
    })

    it("navigates completions with SELECT_PREV", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({
        type: "OPEN_COMMAND",
        providerId: createProviderId("commands"),
      })
      actor.send({ type: "COMPLETIONS_LOADED", completions: createCompletions(3) })

      // Wraps to end
      actor.send({ type: "SELECT_PREV" })
      expect(actor.getSnapshot().context.selectedIndex).toBe(2)

      actor.send({ type: "SELECT_PREV" })
      expect(actor.getSnapshot().context.selectedIndex).toBe(1)

      actor.stop()
    })

    it("sets selected result on SELECT_COMPLETION", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({
        type: "OPEN_COMMAND",
        providerId: createProviderId("commands"),
      })

      const completion: Completion = {
        value: "toggle-theme",
        label: "Toggle Theme",
      }
      actor.send({ type: "SELECT_COMPLETION", completion })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe("idle")
      expect(snapshot.context.result).toEqual({
        type: "selected",
        value: "toggle-theme",
        completion,
      })

      actor.stop()
    })

    it("submits currently selected completion on SUBMIT", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({
        type: "OPEN_COMMAND",
        providerId: createProviderId("commands"),
      })

      const completions = createCompletions(3)
      actor.send({ type: "COMPLETIONS_LOADED", completions })
      actor.send({ type: "SELECT_NEXT" }) // Select index 1

      actor.send({ type: "SUBMIT" })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe("idle")
      expect(snapshot.context.result).toEqual({
        type: "selected",
        value: "cmd-1",
        completion: completions[1],
      })

      actor.stop()
    })

    it("cancels if SUBMIT with no completions", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({
        type: "OPEN_COMMAND",
        providerId: createProviderId("commands"),
      })
      actor.send({ type: "SUBMIT" })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe("idle")
      expect(snapshot.context.result?.type).toBe("cancelled")

      actor.stop()
    })
  })

  describe("y-or-n mode", () => {
    it("transitions to yOrN on OPEN_Y_OR_N", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({ type: "OPEN_Y_OR_N", prompt: "Delete file?" })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe("yOrN")
      expect(snapshot.context.prompt).toBe("Delete file? (y or n) ")

      actor.stop()
    })

    it("sets confirmed result on CONFIRM", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({ type: "OPEN_Y_OR_N", prompt: "Delete file?" })
      actor.send({ type: "CONFIRM" })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe("idle")
      expect(snapshot.context.result).toEqual({
        type: "confirmed",
        value: "y",
      })

      actor.stop()
    })

    it("sets denied result on DENY", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({ type: "OPEN_Y_OR_N", prompt: "Delete file?" })
      actor.send({ type: "DENY" })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe("idle")
      expect(snapshot.context.result).toEqual({
        type: "denied",
        value: "n",
      })

      actor.stop()
    })
  })

  describe("which-key mode", () => {
    it("transitions to whichKey on OPEN_WHICH_KEY", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      const entries = [
        { key: "f", label: "Find file", isPrefix: false },
        { key: "b", label: "+Buffer", isPrefix: true },
      ]

      actor.send({
        type: "OPEN_WHICH_KEY",
        prefix: "C-x ",
        entries,
      })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe("whichKey")
      expect(snapshot.context.whichKeyPrefix).toBe("C-x ")
      expect(snapshot.context.whichKeyEntries).toEqual(entries)

      actor.stop()
    })

    it("sets selected result on WHICH_KEY_SELECT", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({
        type: "OPEN_WHICH_KEY",
        prefix: "C-x ",
        entries: [{ key: "f", label: "Find file", isPrefix: false }],
      })

      actor.send({ type: "WHICH_KEY_SELECT", key: "f" })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe("idle")
      expect(snapshot.context.result).toEqual({
        type: "selected",
        value: "f",
      })

      actor.stop()
    })
  })

  describe("result lifecycle", () => {
    it("clears result on CLEAR_RESULT", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      actor.send({ type: "OPEN_PROMPT", prompt: "Test" })
      actor.send({ type: "SUBMIT" })

      expect(actor.getSnapshot().context.result).not.toBeNull()

      actor.send({ type: "CLEAR_RESULT" })

      expect(actor.getSnapshot().context.result).toBeNull()

      actor.stop()
    })

    it("clears previous result when opening new mode", () => {
      const actor = createActor(minibufferMachine)
      actor.start()

      // First operation
      actor.send({ type: "OPEN_PROMPT", prompt: "First" })
      actor.send({ type: "SUBMIT" })

      expect(actor.getSnapshot().context.result?.type).toBe("submitted")

      // Second operation clears previous result
      actor.send({ type: "OPEN_PROMPT", prompt: "Second" })

      expect(actor.getSnapshot().context.result).toBeNull()

      actor.stop()
    })
  })
})
