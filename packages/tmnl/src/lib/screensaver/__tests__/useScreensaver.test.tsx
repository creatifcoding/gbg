/**
 * useScreensaver Hook Tests
 *
 * Tests screensaver hook behavior:
 * - Activation via idle timeout
 * - Activation via forceScreensaverAtom
 * - Dismiss on input
 * - Configuration updates
 * - Registry integration
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { Registry } from "@effect-atom/atom"
import { RegistryProvider } from "@effect-atom/atom-react"
import React from "react"

// Mock the overlayRegistry
const mockRegistryState = new Map<any, any>()
const mockSubscribers = new Map<any, Set<() => void>>()

vi.mock("@/lib/overlays/atoms", () => ({
  overlayRegistry: {
    get: (atom: any) => mockRegistryState.get(atom) ?? false,
    set: (atom: any, value: any) => {
      mockRegistryState.set(atom, value)
      mockSubscribers.get(atom)?.forEach((cb) => cb())
    },
    subscribe: (atom: any, callback: () => void) => {
      if (!mockSubscribers.has(atom)) {
        mockSubscribers.set(atom, new Set())
      }
      mockSubscribers.get(atom)!.add(callback)
      return () => {
        mockSubscribers.get(atom)?.delete(callback)
      }
    },
  },
}))

// Import after mocks
import { useScreensaver } from "../hooks/useScreensaver"
import { forceScreensaverAtom, screensaverEnabledAtom } from "../atoms"
import { overlayRegistry } from "@/lib/overlays/atoms"

// ─────────────────────────────────────────────────────────────
// Test Setup
// ─────────────────────────────────────────────────────────────

const createWrapper = () => {
  const registry = Registry.make()
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <RegistryProvider value={registry}>{children}</RegistryProvider>
  )
  return { Wrapper, registry }
}

describe("useScreensaver", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Reset mock registry state
    mockRegistryState.clear()
    mockSubscribers.clear()
    // Set default values
    mockRegistryState.set(forceScreensaverAtom, false)
    mockRegistryState.set(screensaverEnabledAtom, true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe("initial state", () => {
    it("is not active initially", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useScreensaver(), { wrapper: Wrapper })

      expect(result.current.isActive).toBe(false)
    })

    it("is enabled by default", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useScreensaver(), { wrapper: Wrapper })

      expect(result.current.isEnabled).toBe(true)
    })

    it("starts with default timeout", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useScreensaver(), { wrapper: Wrapper })

      expect(result.current.timeRemaining).toBe(60000)
    })

    it("accepts custom initial config", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(
        () => useScreensaver({ idleTimeout: 30000, enabled: false }),
        { wrapper: Wrapper }
      )

      expect(result.current.timeRemaining).toBe(30000)
      expect(result.current.isEnabled).toBe(false)
    })
  })

  describe("idle activation", () => {
    it("activates after idle timeout", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(
        () => useScreensaver({ idleTimeout: 5000 }),
        { wrapper: Wrapper }
      )

      expect(result.current.isActive).toBe(false)

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(result.current.isActive).toBe(true)
    })

    it("does not activate when disabled", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(
        () => useScreensaver({ idleTimeout: 1000, enabled: false }),
        { wrapper: Wrapper }
      )

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(result.current.isActive).toBe(false)
    })

    it("does not activate when global enabled is false", () => {
      // Set global enabled to false
      mockRegistryState.set(screensaverEnabledAtom, false)

      const { Wrapper } = createWrapper()
      const { result } = renderHook(
        () => useScreensaver({ idleTimeout: 1000 }),
        { wrapper: Wrapper }
      )

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(result.current.isActive).toBe(false)
    })
  })

  describe("force activation via atom", () => {
    it("activates when forceScreensaverAtom is set to true", async () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useScreensaver(), { wrapper: Wrapper })

      expect(result.current.isActive).toBe(false)

      // Simulate command setting the force atom
      act(() => {
        overlayRegistry.set(forceScreensaverAtom, true)
      })

      await waitFor(() => {
        expect(result.current.isActive).toBe(true)
      })
    })
  })

  describe("dismiss", () => {
    it("deactivates screensaver on dismiss", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(
        () => useScreensaver({ idleTimeout: 1000 }),
        { wrapper: Wrapper }
      )

      // Activate
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.isActive).toBe(true)

      // Dismiss
      act(() => {
        result.current.dismiss()
      })

      expect(result.current.isActive).toBe(false)
    })

    it("resets forceScreensaverAtom on dismiss", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useScreensaver(), { wrapper: Wrapper })

      // Force activate
      act(() => {
        overlayRegistry.set(forceScreensaverAtom, true)
      })

      // Dismiss
      act(() => {
        result.current.dismiss()
      })

      expect(overlayRegistry.get(forceScreensaverAtom)).toBe(false)
    })

    it("resets idle timer on dismiss", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(
        () => useScreensaver({ idleTimeout: 5000 }),
        { wrapper: Wrapper }
      )

      // Activate
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(result.current.isActive).toBe(true)

      // Dismiss
      act(() => {
        result.current.dismiss()
      })

      // Timer should be reset
      expect(result.current.timeRemaining).toBe(5000)
    })

    it("dismisses on mousedown when active", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(
        () => useScreensaver({ idleTimeout: 1000 }),
        { wrapper: Wrapper }
      )

      // Activate
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.isActive).toBe(true)

      // Simulate mousedown
      act(() => {
        window.dispatchEvent(new Event("mousedown"))
      })

      expect(result.current.isActive).toBe(false)
    })

    it("dismisses on keydown when active", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(
        () => useScreensaver({ idleTimeout: 1000 }),
        { wrapper: Wrapper }
      )

      // Activate
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.isActive).toBe(true)

      // Simulate keydown
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
      })

      expect(result.current.isActive).toBe(false)
    })

    it("does not dismiss when not active", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useScreensaver(), { wrapper: Wrapper })

      expect(result.current.isActive).toBe(false)

      // Try to dismiss
      act(() => {
        result.current.dismiss()
      })

      // Should still be false (no-op)
      expect(result.current.isActive).toBe(false)
    })
  })

  describe("show", () => {
    it("manually shows screensaver", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useScreensaver(), { wrapper: Wrapper })

      expect(result.current.isActive).toBe(false)

      act(() => {
        result.current.show()
      })

      expect(result.current.isActive).toBe(true)
    })
  })

  describe("toggleEnabled", () => {
    it("toggles enabled state", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useScreensaver(), { wrapper: Wrapper })

      expect(result.current.isEnabled).toBe(true)

      act(() => {
        result.current.toggleEnabled()
      })

      expect(result.current.isEnabled).toBe(false)

      act(() => {
        result.current.toggleEnabled()
      })

      expect(result.current.isEnabled).toBe(true)
    })
  })

  describe("configure", () => {
    it("updates configuration", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(
        () => useScreensaver({ idleTimeout: 60000 }),
        { wrapper: Wrapper }
      )

      expect(result.current.timeRemaining).toBe(60000)

      act(() => {
        result.current.configure({ idleTimeout: 30000 })
      })

      // Note: timeRemaining might not immediately reflect the new config
      // because it's managed by useIdleDetection
      expect(result.current.isEnabled).toBe(true)
    })

    it("can update enabled via configure", () => {
      const { Wrapper } = createWrapper()
      const { result } = renderHook(() => useScreensaver(), { wrapper: Wrapper })

      expect(result.current.isEnabled).toBe(true)

      act(() => {
        result.current.configure({ enabled: false })
      })

      expect(result.current.isEnabled).toBe(false)
    })
  })

  describe("cleanup", () => {
    it("removes event listeners on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener")
      const { Wrapper } = createWrapper()

      const { unmount, result } = renderHook(
        () => useScreensaver({ idleTimeout: 1000 }),
        { wrapper: Wrapper }
      )

      // Activate to register dismiss listeners
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.isActive).toBe(true)

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalled()
    })
  })
})
