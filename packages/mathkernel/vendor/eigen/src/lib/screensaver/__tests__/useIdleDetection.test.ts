/**
 * useIdleDetection Hook Tests
 *
 * Tests idle detection logic:
 * - Timeout behavior
 * - Activity reset
 * - Enable/disable
 * - Callbacks
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useIdleDetection } from "../hooks/useIdleDetection"

// ─────────────────────────────────────────────────────────────
// Test Setup
// ─────────────────────────────────────────────────────────────

describe("useIdleDetection", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe("initial state", () => {
    it("starts as not idle", () => {
      const { result } = renderHook(() =>
        useIdleDetection({ timeout: 1000 })
      )

      expect(result.current.isIdle).toBe(false)
    })

    it("has full time remaining at start", () => {
      const { result } = renderHook(() =>
        useIdleDetection({ timeout: 5000 })
      )

      expect(result.current.timeRemaining).toBe(5000)
    })

    it("tracks lastActivity timestamp", () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const { result } = renderHook(() =>
        useIdleDetection({ timeout: 1000 })
      )

      expect(result.current.lastActivity).toBe(now)
    })
  })

  describe("timeout behavior", () => {
    it("becomes idle after timeout", () => {
      const onIdle = vi.fn()
      const { result } = renderHook(() =>
        useIdleDetection({ timeout: 1000, onIdle })
      )

      expect(result.current.isIdle).toBe(false)

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.isIdle).toBe(true)
      expect(onIdle).toHaveBeenCalledTimes(1)
    })

    it("does not become idle before timeout", () => {
      const onIdle = vi.fn()
      const { result } = renderHook(() =>
        useIdleDetection({ timeout: 1000, onIdle })
      )

      act(() => {
        vi.advanceTimersByTime(999)
      })

      expect(result.current.isIdle).toBe(false)
      expect(onIdle).not.toHaveBeenCalled()
    })

    it("decrements timeRemaining as time passes", () => {
      const { result } = renderHook(() =>
        useIdleDetection({ timeout: 5000 })
      )

      expect(result.current.timeRemaining).toBe(5000)

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.timeRemaining).toBe(4000)

      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(result.current.timeRemaining).toBe(2000)
    })
  })

  describe("activity detection", () => {
    it("resets timeout on mousemove", () => {
      const onIdle = vi.fn()
      renderHook(() =>
        useIdleDetection({ timeout: 1000, onIdle })
      )

      act(() => {
        vi.advanceTimersByTime(500)
      })

      // Simulate mouse movement
      act(() => {
        window.dispatchEvent(new Event("mousemove"))
      })

      // Advance past original timeout
      act(() => {
        vi.advanceTimersByTime(600)
      })

      expect(onIdle).not.toHaveBeenCalled()

      // Now wait for full new timeout
      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(onIdle).toHaveBeenCalledTimes(1)
    })

    it("resets timeout on keydown", () => {
      const onIdle = vi.fn()
      renderHook(() =>
        useIdleDetection({ timeout: 1000, onIdle })
      )

      act(() => {
        vi.advanceTimersByTime(900)
      })

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }))
      })

      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(onIdle).not.toHaveBeenCalled()
    })

    it("calls onActive when activity detected while idle", () => {
      const onIdle = vi.fn()
      const onActive = vi.fn()
      renderHook(() =>
        useIdleDetection({ timeout: 1000, onIdle, onActive })
      )

      // Become idle
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(onIdle).toHaveBeenCalled()

      // Activity detected
      act(() => {
        window.dispatchEvent(new Event("mousedown"))
      })

      expect(onActive).toHaveBeenCalledTimes(1)
    })
  })

  describe("reset function", () => {
    it("resets to full timeout", () => {
      const { result } = renderHook(() =>
        useIdleDetection({ timeout: 5000 })
      )

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(result.current.timeRemaining).toBe(2000)

      act(() => {
        result.current.reset()
      })

      expect(result.current.timeRemaining).toBe(5000)
      expect(result.current.isIdle).toBe(false)
    })

    it("clears idle state", () => {
      const { result } = renderHook(() =>
        useIdleDetection({ timeout: 1000 })
      )

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.isIdle).toBe(true)

      act(() => {
        result.current.reset()
      })

      expect(result.current.isIdle).toBe(false)
    })
  })

  describe("enabled option", () => {
    it("does not track when disabled", () => {
      const onIdle = vi.fn()
      renderHook(() =>
        useIdleDetection({ timeout: 1000, enabled: false, onIdle })
      )

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(onIdle).not.toHaveBeenCalled()
    })

    it("starts tracking when enabled changes to true", () => {
      const onIdle = vi.fn()
      const { rerender } = renderHook(
        ({ enabled }) => useIdleDetection({ timeout: 1000, enabled, onIdle }),
        { initialProps: { enabled: false } }
      )

      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(onIdle).not.toHaveBeenCalled()

      // Enable detection
      rerender({ enabled: true })

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(onIdle).toHaveBeenCalledTimes(1)
    })

    it("stops tracking when enabled changes to false", () => {
      const onIdle = vi.fn()
      const { rerender } = renderHook(
        ({ enabled }) => useIdleDetection({ timeout: 1000, enabled, onIdle }),
        { initialProps: { enabled: true } }
      )

      act(() => {
        vi.advanceTimersByTime(500)
      })

      // Disable detection
      rerender({ enabled: false })

      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(onIdle).not.toHaveBeenCalled()
    })
  })

  describe("cleanup", () => {
    it("removes event listeners on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener")

      const { unmount } = renderHook(() =>
        useIdleDetection({ timeout: 1000 })
      )

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalled()
    })

    it("clears timers on unmount", () => {
      const { unmount } = renderHook(() =>
        useIdleDetection({ timeout: 1000 })
      )

      unmount()

      // No errors should occur when advancing timers after unmount
      act(() => {
        vi.advanceTimersByTime(5000)
      })
    })
  })

  describe("default timeout", () => {
    it("uses 60000ms as default timeout", () => {
      const { result } = renderHook(() => useIdleDetection({}))

      expect(result.current.timeRemaining).toBe(60000)
    })
  })
})
