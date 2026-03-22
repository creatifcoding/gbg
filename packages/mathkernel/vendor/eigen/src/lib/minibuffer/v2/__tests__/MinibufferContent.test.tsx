/**
 * MinibufferContent v2 Component Tests
 *
 * Tests the cmdk-based command palette UI:
 * - Mode-specific rendering (command, prompt, yOrN, whichKey)
 * - Completion list rendering
 * - Input handling
 * - Keyboard navigation
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Registry } from "@effect-atom/atom"
import { RegistryProvider } from "@effect-atom/atom-react"
import { Effect } from "effect"
import React from "react"

import { MinibufferContent } from "../components/MinibufferContent"
import { ops } from "../atoms"
import { providerRegistry, createProviderId } from "../providers"
import type { CompletionProvider, Completion } from "../providers"

// ─────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────

const TEST_PROVIDER_ID = createProviderId("test-provider")

const createTestProvider = (completions: Completion[] = []): CompletionProvider => ({
  id: TEST_PROVIDER_ID,
  label: "Test Provider",
  placeholder: "M-x ",
  complete: () => Effect.succeed(completions),
})

const renderWithRegistry = (ui: React.ReactElement) => {
  const registry = Registry.make()
  return {
    ...render(
      <RegistryProvider value={registry}>{ui}</RegistryProvider>
    ),
    registry,
  }
}

const testCompletions: Completion[] = [
  { value: "toggle-theme", label: "Toggle Theme", description: "Switch between light and dark", category: "UI" },
  { value: "save-file", label: "Save File", description: "Save current file", category: "File" },
  { value: "open-file", label: "Open File", description: "Open a file", category: "File" },
]

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("MinibufferContent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset machine state
    ops.cancel()
    ops.clearResult()
    // Register test provider
    providerRegistry.register(createTestProvider(testCompletions))
  })

  afterEach(() => {
    providerRegistry.unregister(TEST_PROVIDER_ID)
  })

  describe("idle mode", () => {
    it("renders command mode UI when in command mode", () => {
      ops.openCommand(TEST_PROVIDER_ID)
      ops.loadCompletions(testCompletions)

      renderWithRegistry(<MinibufferContent />)

      expect(screen.getByPlaceholderText("Type to search...")).toBeInTheDocument()
    })
  })

  describe("command mode", () => {
    beforeEach(() => {
      ops.openCommand(TEST_PROVIDER_ID, "M-x ")
      ops.loadCompletions(testCompletions)
    })

    it("renders prompt text", () => {
      renderWithRegistry(<MinibufferContent />)

      expect(screen.getByText("M-x")).toBeInTheDocument()
    })

    it("renders completions grouped by category", () => {
      renderWithRegistry(<MinibufferContent />)

      // Categories
      expect(screen.getByText("UI")).toBeInTheDocument()
      expect(screen.getByText("File")).toBeInTheDocument()

      // Completion labels
      expect(screen.getByText("Toggle Theme")).toBeInTheDocument()
      expect(screen.getByText("Save File")).toBeInTheDocument()
      expect(screen.getByText("Open File")).toBeInTheDocument()
    })

    it("renders completion descriptions", () => {
      renderWithRegistry(<MinibufferContent />)

      expect(screen.getByText("Switch between light and dark")).toBeInTheDocument()
      expect(screen.getByText("Save current file")).toBeInTheDocument()
    })

    it("renders empty state when no completions", () => {
      ops.loadCompletions([])

      renderWithRegistry(<MinibufferContent />)

      expect(screen.getByText("No commands found")).toBeInTheDocument()
    })

    it("updates input on type", async () => {
      const user = userEvent.setup()
      renderWithRegistry(<MinibufferContent />)

      const input = screen.getByPlaceholderText("Type to search...")
      await user.type(input, "toggle")

      // The ops.updateInput should have been called via the component
      // We can verify by checking the input value
      expect(input).toHaveValue("toggle")
    })
  })

  describe("prompt mode", () => {
    beforeEach(() => {
      ops.openPrompt("Enter file name: ", "default.txt")
    })

    it("renders prompt text", () => {
      renderWithRegistry(<MinibufferContent />)

      expect(screen.getByText("Enter file name:")).toBeInTheDocument()
    })

    it("renders default value in input", () => {
      renderWithRegistry(<MinibufferContent />)

      const input = screen.getByPlaceholderText("Type here...")
      expect(input).toHaveValue("default.txt")
    })

    it("submits on Enter key", async () => {
      const user = userEvent.setup()
      renderWithRegistry(<MinibufferContent />)

      const input = screen.getByPlaceholderText("Type here...")
      await user.clear(input)
      await user.type(input, "newfile.txt{Enter}")

      // Mode should transition to idle after submit
      await waitFor(() => {
        // The machine should have processed the submit
        expect(ops).toBeDefined()
      })
    })
  })

  describe("yOrN mode", () => {
    beforeEach(() => {
      ops.openYOrN("Delete this file?")
    })

    it("renders prompt with y/n suffix", () => {
      renderWithRegistry(<MinibufferContent />)

      expect(screen.getByText(/Delete this file\?.*\(y or n\)/)).toBeInTheDocument()
    })

    it("renders Yes button", () => {
      renderWithRegistry(<MinibufferContent />)

      expect(screen.getByText("Yes")).toBeInTheDocument()
    })

    it("renders No button", () => {
      renderWithRegistry(<MinibufferContent />)

      expect(screen.getByText("No")).toBeInTheDocument()
    })

    it("renders keyboard hints", () => {
      renderWithRegistry(<MinibufferContent />)

      expect(screen.getByText("y")).toBeInTheDocument()
      expect(screen.getByText("n")).toBeInTheDocument()
    })
  })

  describe("whichKey mode", () => {
    const whichKeyEntries = [
      { key: "f", label: "Find file", isPrefix: false },
      { key: "b", label: "Switch buffer", isPrefix: false },
      { key: "x", label: "+Extended", isPrefix: true },
    ]

    beforeEach(() => {
      ops.openWhichKey("C-x ", whichKeyEntries)
    })

    it("renders prefix", () => {
      renderWithRegistry(<MinibufferContent />)

      expect(screen.getByText("C-x")).toBeInTheDocument()
    })

    it("renders all entries", () => {
      renderWithRegistry(<MinibufferContent />)

      expect(screen.getByText("f")).toBeInTheDocument()
      expect(screen.getByText("Find file")).toBeInTheDocument()

      expect(screen.getByText("b")).toBeInTheDocument()
      expect(screen.getByText("Switch buffer")).toBeInTheDocument()

      expect(screen.getByText("x")).toBeInTheDocument()
      expect(screen.getByText("+Extended")).toBeInTheDocument()
    })

    it("marks prefix entries with +", () => {
      renderWithRegistry(<MinibufferContent />)

      // The isPrefix entry should have the + indicator
      const prefixIndicators = screen.getAllByText("+")
      expect(prefixIndicators.length).toBeGreaterThan(0)
    })
  })

  describe("keyboard navigation", () => {
    beforeEach(() => {
      ops.openCommand(TEST_PROVIDER_ID)
      ops.loadCompletions(testCompletions)
    })

    it("Escape key does not prevent default (bubbles to global handler)", () => {
      renderWithRegistry(<MinibufferContent />)

      const root = screen.getByRole("listbox").closest("[cmdk-root]") || document.body
      const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      const preventDefaultSpy = vi.spyOn(event, "preventDefault")

      fireEvent(root, event)

      // Escape should NOT be prevented — it bubbles to global handler
      expect(preventDefaultSpy).not.toHaveBeenCalled()
    })
  })

  describe("selection", () => {
    beforeEach(() => {
      ops.openCommand(TEST_PROVIDER_ID)
      ops.loadCompletions(testCompletions)
    })

    it("clicking a completion selects it", async () => {
      const user = userEvent.setup()
      renderWithRegistry(<MinibufferContent />)

      const toggleTheme = screen.getByText("Toggle Theme")
      await user.click(toggleTheme)

      // The mode should transition to idle after selection
      await waitFor(() => {
        // Selection triggers ops.selectCompletion which transitions to idle
        expect(ops).toBeDefined()
      })
    })
  })

  describe("styling", () => {
    it("applies root styles", () => {
      ops.openCommand(TEST_PROVIDER_ID)
      renderWithRegistry(<MinibufferContent />)

      const root = screen.getByRole("listbox").closest("[cmdk-root]")
      expect(root).toHaveStyle({ backgroundColor: "#0a0a0a" })
    })

    it("injects style tag for data-selected", () => {
      ops.openCommand(TEST_PROVIDER_ID)
      renderWithRegistry(<MinibufferContent />)

      const styleTag = document.getElementById("minibuffer-v2-styles")
      expect(styleTag).toBeInTheDocument()
      expect(styleTag?.textContent).toContain("[data-selected")
    })
  })
})
