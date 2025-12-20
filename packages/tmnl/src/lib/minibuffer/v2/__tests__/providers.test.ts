/**
 * Minibuffer v2 Provider Registry Tests
 *
 * Tests the provider system:
 * - providerRegistry (singleton)
 * - createProviderId (branded type factory)
 * - getCompletions (provider lookup + completion fetch)
 * - executeSelection (provider onSelect handler)
 *
 * @module
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { Effect } from "effect"
import {
  providerRegistry,
  createProviderId,
  getCompletions,
  executeSelection,
  COMMAND_PROVIDER_ID,
  type CompletionProvider,
} from "../providers"
import type { Completion, ProviderId } from "../machine"

// ─────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────

const TEST_PROVIDER_ID = createProviderId("test-provider")

const createTestCompletion = (id: string): Completion => ({
  value: id,
  label: `Label for ${id}`,
  description: `Description for ${id}`,
})

const createTestProvider = (
  id: ProviderId,
  completions: Completion[] = [],
  options: {
    onSelect?: (c: Completion) => Effect.Effect<void>
    transformInput?: (input: string) => string
  } = {}
): CompletionProvider => ({
  id,
  label: `Test Provider ${id}`,
  complete: (_query: string) => Effect.succeed(completions),
  onSelect: options.onSelect,
  transformInput: options.transformInput,
})

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("minibuffer v2 providers", () => {
  beforeEach(() => {
    // Clean up any test providers (but preserve built-in ones)
    providerRegistry.unregister(TEST_PROVIDER_ID)
    providerRegistry.unregister(createProviderId("provider-a"))
    providerRegistry.unregister(createProviderId("provider-b"))
  })

  describe("createProviderId", () => {
    it("creates a branded ProviderId from string", () => {
      const id = createProviderId("my-provider")
      expect(id).toBe("my-provider")
      // Type-level: id is ProviderId, not just string
    })

    it("COMMAND_PROVIDER_ID is 'commands'", () => {
      expect(COMMAND_PROVIDER_ID).toBe("commands")
    })
  })

  describe("providerRegistry", () => {
    it("registers a provider", () => {
      const provider = createTestProvider(TEST_PROVIDER_ID)
      providerRegistry.register(provider)

      expect(providerRegistry.get(TEST_PROVIDER_ID)).toBe(provider)
    })

    it("unregisters a provider", () => {
      const provider = createTestProvider(TEST_PROVIDER_ID)
      providerRegistry.register(provider)
      expect(providerRegistry.get(TEST_PROVIDER_ID)).toBe(provider)

      providerRegistry.unregister(TEST_PROVIDER_ID)
      expect(providerRegistry.get(TEST_PROVIDER_ID)).toBeUndefined()
    })

    it("returns undefined for unregistered provider", () => {
      const unknownId = createProviderId("unknown-provider")
      expect(providerRegistry.get(unknownId)).toBeUndefined()
    })

    it("getAll returns all registered providers", () => {
      const providerA = createTestProvider(createProviderId("provider-a"))
      const providerB = createTestProvider(createProviderId("provider-b"))

      providerRegistry.register(providerA)
      providerRegistry.register(providerB)

      const all = providerRegistry.getAll()
      expect(all).toContain(providerA)
      expect(all).toContain(providerB)
    })

    it("overwrites provider with same ID", () => {
      const provider1 = createTestProvider(TEST_PROVIDER_ID, [createTestCompletion("v1")])
      const provider2 = createTestProvider(TEST_PROVIDER_ID, [createTestCompletion("v2")])

      providerRegistry.register(provider1)
      providerRegistry.register(provider2)

      expect(providerRegistry.get(TEST_PROVIDER_ID)).toBe(provider2)
    })
  })

  describe("getCompletions", () => {
    it("returns empty array for unknown provider", async () => {
      const unknownId = createProviderId("unknown")
      const result = await Effect.runPromise(getCompletions(unknownId, "query"))

      expect(result).toEqual([])
    })

    it("returns completions from provider", async () => {
      const completions = [
        createTestCompletion("cmd-1"),
        createTestCompletion("cmd-2"),
      ]
      const provider = createTestProvider(TEST_PROVIDER_ID, completions)
      providerRegistry.register(provider)

      const result = await Effect.runPromise(getCompletions(TEST_PROVIDER_ID, ""))

      expect(result).toEqual(completions)
    })

    it("applies transformInput before calling complete", async () => {
      const completeFn = vi.fn(() => Effect.succeed([]))
      const provider: CompletionProvider = {
        id: TEST_PROVIDER_ID,
        label: "Test",
        complete: completeFn,
        transformInput: (input) => input.toUpperCase().trim(),
      }
      providerRegistry.register(provider)

      await Effect.runPromise(getCompletions(TEST_PROVIDER_ID, "  hello  "))

      expect(completeFn).toHaveBeenCalledWith("HELLO")
    })

    it("handles provider errors gracefully", async () => {
      const provider: CompletionProvider = {
        id: TEST_PROVIDER_ID,
        label: "Test",
        complete: () => Effect.fail(new Error("Provider error")),
      }
      providerRegistry.register(provider)

      // Should not throw, returns empty array
      const result = await Effect.runPromise(getCompletions(TEST_PROVIDER_ID, "query"))

      expect(result).toEqual([])
    })
  })

  describe("executeSelection", () => {
    it("does nothing for unknown provider", async () => {
      const unknownId = createProviderId("unknown")
      const completion = createTestCompletion("test")

      // Should not throw
      await Effect.runPromise(executeSelection(unknownId, completion))
    })

    it("does nothing if provider has no onSelect", async () => {
      const provider = createTestProvider(TEST_PROVIDER_ID)
      providerRegistry.register(provider)

      const completion = createTestCompletion("test")

      // Should not throw
      await Effect.runPromise(executeSelection(TEST_PROVIDER_ID, completion))
    })

    it("calls provider onSelect with completion", async () => {
      const onSelectFn = vi.fn(() => Effect.void)
      const provider: CompletionProvider = {
        id: TEST_PROVIDER_ID,
        label: "Test",
        complete: () => Effect.succeed([]),
        onSelect: onSelectFn,
      }
      providerRegistry.register(provider)

      const completion = createTestCompletion("selected-cmd")
      await Effect.runPromise(executeSelection(TEST_PROVIDER_ID, completion))

      expect(onSelectFn).toHaveBeenCalledWith(completion)
    })

    it("handles onSelect errors gracefully", async () => {
      const provider: CompletionProvider = {
        id: TEST_PROVIDER_ID,
        label: "Test",
        complete: () => Effect.succeed([]),
        onSelect: () => Effect.fail(new Error("Selection error")),
      }
      providerRegistry.register(provider)

      const completion = createTestCompletion("test")

      // Should not throw
      await Effect.runPromise(executeSelection(TEST_PROVIDER_ID, completion))
    })
  })

  describe("CompletionProvider interface", () => {
    it("supports optional icon", () => {
      const provider: CompletionProvider = {
        id: TEST_PROVIDER_ID,
        label: "Test",
        complete: () => Effect.succeed([]),
        // icon is optional
      }

      providerRegistry.register(provider)
      expect(providerRegistry.get(TEST_PROVIDER_ID)?.icon).toBeUndefined()
    })

    it("supports optional placeholder", () => {
      const provider: CompletionProvider = {
        id: TEST_PROVIDER_ID,
        label: "Test",
        placeholder: "Search commands...",
        complete: () => Effect.succeed([]),
      }

      providerRegistry.register(provider)
      expect(providerRegistry.get(TEST_PROVIDER_ID)?.placeholder).toBe("Search commands...")
    })

    it("complete receives transformed query", async () => {
      const queries: string[] = []
      const provider: CompletionProvider = {
        id: TEST_PROVIDER_ID,
        label: "Test",
        complete: (query) => {
          queries.push(query)
          return Effect.succeed([])
        },
        transformInput: (input) => `M-x ${input}`,
      }
      providerRegistry.register(provider)

      await Effect.runPromise(getCompletions(TEST_PROVIDER_ID, "toggle"))

      expect(queries).toEqual(["M-x toggle"])
    })
  })
})
