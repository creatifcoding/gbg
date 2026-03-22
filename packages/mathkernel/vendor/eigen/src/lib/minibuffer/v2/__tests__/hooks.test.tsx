/**
 * Minibuffer v2 Hooks Tests
 *
 * Tests useMinibuffer hook behavior:
 * - State derivation from atoms
 * - Operation dispatch via ops
 * - Drawer lifecycle management
 * - Hotkey scope management
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { Registry } from "@effect-atom/atom"
import { RegistryProvider } from "@effect-atom/atom-react"
import { Effect } from "effect"
import React from "react"

// Mock the drawer hook
const mockDrawerOpen = vi.fn()
const mockDrawerClose = vi.fn()
vi.mock("@/lib/overlays", () => ({
  useDrawer: () => ({
    open: mockDrawerOpen,
    close: mockDrawerClose,
    isOpen: false,
    isDrawerOpen: () => false,
  }),
  overlayId: (id: string) => `overlay-${id}`,
}))

// Mock hotkey actions
const mockPushScope = vi.fn()
const mockPopScope = vi.fn()
const mockAddBinding = vi.fn()
const mockRemoveBinding = vi.fn()
vi.mock("@/lib/hotkeys", () => ({
  hotkeyActions: {
    pushScope: (registry: unknown, scope: string) => mockPushScope(scope),
    popScope: (registry: unknown) => mockPopScope(),
    addBinding: (registry: unknown, binding: unknown) => mockAddBinding(binding),
    removeBinding: (registry: unknown, keys: unknown, scope: string) => mockRemoveBinding(keys, scope),
  },
  Scopes: {
    MINIBUFFER: "minibuffer",
    GLOBAL: "global",
  },
  BindingSources: {
    DEFAULT: "default",
  },
}))

// Import after mocks
import { useMinibuffer } from "../hooks"
import { ops } from "../atoms"
import { providerRegistry, createProviderId, COMMAND_PROVIDER_ID } from "../providers"
import type { CompletionProvider, Completion } from "../providers"

// ─────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────

const createWrapper = () => {
  const registry = Registry.make()
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <RegistryProvider value={registry}>{children}</RegistryProvider>
  )
  return { Wrapper, registry }
}

const TEST_PROVIDER_ID = createProviderId("test-provider")

const createTestProvider = (completions: Completion[] = []): CompletionProvider => ({
  id: TEST_PROVIDER_ID,
  label: "Test Provider",
  complete: () => Effect.succeed(completions),
})

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("useMinibuffer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset machine state
    ops.cancel()
    ops.clearResult()
    // Register test provider
    providerRegistry.register(createTestProvider([
      { value: "cmd-1", label: "Command 1" },
      { value: "cmd-2", label: "Command 2" },
    ]))
  })

  afterEach(() => {
    providerRegistry.unregister(TEST_PROVIDER_ID)
  })

  describe("initial state", () => {
    it("returns idle state initially", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useMinibuffer(), { wrapper: Wrapper })

      expect(result.current.isActive).toBe(false)
      expect(result.current.mode).toBe("idle")
      expect(result.current.input).toBe("")
      expect(result.current.completions).toEqual([])
      expect(result.current.selectedIndex).toBe(0)
      expect(result.current.selectedCompletion).toBeNull()
    })
  })

  describe("executeCommand", () => {
    it("opens drawer and sets command mode", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useMinibuffer(), { wrapper: Wrapper })

      act(() => {
        result.current.executeCommand()
      })

      // Drawer should be opened
      expect(mockDrawerOpen).toHaveBeenCalled()

      // Mode should be command
      expect(result.current.mode).toBe("command")
      expect(result.current.isActive).toBe(true)
    })

    it("pushes minibuffer scope", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useMinibuffer(), { wrapper: Wrapper })

      act(() => {
        result.current.executeCommand()
      })

      expect(mockPushScope).toHaveBeenCalledWith("minibuffer")
      expect(mockAddBinding).toHaveBeenCalled()
    })
  })

  describe("openPrompt", () => {
    it("opens drawer in prompt mode", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useMinibuffer(), { wrapper: Wrapper })

      act(() => {
        result.current.openPrompt("Enter name: ", "default value")
      })

      expect(mockDrawerOpen).toHaveBeenCalled()
      expect(result.current.mode).toBe("prompt")
      expect(result.current.prompt).toBe("Enter name: ")
      expect(result.current.input).toBe("default value")
    })
  })

  describe("openCommand", () => {
    it("opens drawer in command mode with provider", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useMinibuffer(), { wrapper: Wrapper })

      act(() => {
        result.current.openCommand(TEST_PROVIDER_ID)
      })

      expect(mockDrawerOpen).toHaveBeenCalled()
      expect(result.current.mode).toBe("command")
    })
  })

  describe("yOrN", () => {
    it("opens drawer in yOrN mode", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useMinibuffer(), { wrapper: Wrapper })

      act(() => {
        result.current.yOrN("Delete file?")
      })

      expect(mockDrawerOpen).toHaveBeenCalled()
      expect(result.current.mode).toBe("yOrN")
      expect(result.current.prompt).toContain("Delete file?")
    })
  })

  describe("whichKey", () => {
    it("opens drawer in whichKey mode", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useMinibuffer(), { wrapper: Wrapper })

      const entries = [
        { key: "f", label: "Find file", isPrefix: false },
        { key: "b", label: "+Buffer", isPrefix: true },
      ]

      act(() => {
        result.current.whichKey("C-x ", entries)
      })

      expect(mockDrawerOpen).toHaveBeenCalled()
      expect(result.current.mode).toBe("whichKey")
    })
  })

  describe("cancel", () => {
    it("cancels active operation", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useMinibuffer(), { wrapper: Wrapper })

      act(() => {
        result.current.openPrompt("Test")
      })
      expect(result.current.isActive).toBe(true)

      act(() => {
        result.current.cancel()
      })
      expect(result.current.mode).toBe("idle")
    })
  })

  describe("submit", () => {
    it("submits prompt input", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useMinibuffer(), { wrapper: Wrapper })

      act(() => {
        result.current.openPrompt("Name: ")
        ops.updateInput("Alice")
      })

      act(() => {
        result.current.submit()
      })

      expect(result.current.mode).toBe("idle")
    })
  })

  describe("navigation", () => {
    it("navigateDown increments selectedIndex", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useMinibuffer(), { wrapper: Wrapper })

      act(() => {
        ops.openCommand(TEST_PROVIDER_ID)
        ops.loadCompletions([
          { value: "cmd-1", label: "Command 1" },
          { value: "cmd-2", label: "Command 2" },
          { value: "cmd-3", label: "Command 3" },
        ])
      })

      expect(result.current.selectedIndex).toBe(0)

      act(() => {
        result.current.navigateDown()
      })
      expect(result.current.selectedIndex).toBe(1)

      act(() => {
        result.current.navigateDown()
      })
      expect(result.current.selectedIndex).toBe(2)
    })

    it("navigateUp decrements selectedIndex", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useMinibuffer(), { wrapper: Wrapper })

      act(() => {
        ops.openCommand(TEST_PROVIDER_ID)
        ops.loadCompletions([
          { value: "cmd-1", label: "Command 1" },
          { value: "cmd-2", label: "Command 2" },
        ])
        ops.selectNext() // Index 1
      })

      expect(result.current.selectedIndex).toBe(1)

      act(() => {
        result.current.navigateUp()
      })
      expect(result.current.selectedIndex).toBe(0)
    })
  })

  describe("drawer auto-close on idle", () => {
    it("closes drawer when mode transitions to idle", async () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useMinibuffer(), { wrapper: Wrapper })

      act(() => {
        result.current.openPrompt("Test")
      })
      expect(mockDrawerOpen).toHaveBeenCalled()

      act(() => {
        result.current.cancel()
      })

      // Wait for the useEffect to run
      await waitFor(() => {
        expect(result.current.mode).toBe("idle")
      })

      expect(mockDrawerClose).toHaveBeenCalled()
    })

    it("pops minibuffer scope on close", async () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useMinibuffer(), { wrapper: Wrapper })

      act(() => {
        result.current.openPrompt("Test")
      })

      act(() => {
        result.current.cancel()
      })

      await waitFor(() => {
        expect(result.current.mode).toBe("idle")
      })

      expect(mockPopScope).toHaveBeenCalled()
      expect(mockRemoveBinding).toHaveBeenCalled()
    })
  })

  describe("selectedCompletion", () => {
    it("reflects currently selected completion", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useMinibuffer(), { wrapper: Wrapper })

      const completions = [
        { value: "cmd-1", label: "Command 1" },
        { value: "cmd-2", label: "Command 2" },
      ]

      act(() => {
        ops.openCommand(TEST_PROVIDER_ID)
        ops.loadCompletions(completions)
      })

      expect(result.current.selectedCompletion).toEqual(completions[0])

      act(() => {
        result.current.navigateDown()
      })

      expect(result.current.selectedCompletion).toEqual(completions[1])
    })

    it("is null when no completions", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useMinibuffer(), { wrapper: Wrapper })

      act(() => {
        ops.openCommand(TEST_PROVIDER_ID)
      })

      expect(result.current.selectedCompletion).toBeNull()
    })
  })
})
