/**
 * ScreensaverOverlay Component Tests
 *
 * Tests overlay rendering:
 * - Show/hide based on isActive
 * - Fade transitions
 * - Suspense loading fallback
 * - DOM attributes
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"
import React, { Suspense } from "react"

// Mock the AsciiScene component (heavy 3D component)
vi.mock("@/components/splash/aberration", () => ({
  AsciiScene: () => <div data-testid="ascii-scene">ASCII Scene Mock</div>,
}))

// Import after mocks
import { ScreensaverOverlay } from "../components/ScreensaverOverlay"

// ─────────────────────────────────────────────────────────────
// Test Setup
// ─────────────────────────────────────────────────────────────

describe("ScreensaverOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe("visibility", () => {
    it("renders nothing when isActive is false", () => {
      const { container } = render(<ScreensaverOverlay isActive={false} />)

      expect(container.querySelector("[data-screensaver]")).toBeNull()
    })

    it("renders overlay when isActive is true", async () => {
      render(<ScreensaverOverlay isActive={true} />)

      // Allow for requestAnimationFrame calls
      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      const overlay = document.querySelector("[data-screensaver]")
      expect(overlay).not.toBeNull()
    })

    it("includes AsciiScene component when active", async () => {
      render(<ScreensaverOverlay isActive={true} />)

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(screen.getByTestId("ascii-scene")).toBeInTheDocument()
    })
  })

  describe("fade transitions", () => {
    it("applies fade-in duration", async () => {
      render(
        <ScreensaverOverlay isActive={true} fadeInDuration={500} />
      )

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      const overlay = document.querySelector("[data-screensaver]") as HTMLElement
      expect(overlay).not.toBeNull()
      expect(overlay.style.transition).toContain("500ms")
    })

    it("applies fade-out duration when deactivating", async () => {
      const { rerender } = render(
        <ScreensaverOverlay isActive={true} fadeOutDuration={300} />
      )

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Deactivate
      rerender(<ScreensaverOverlay isActive={false} fadeOutDuration={300} />)

      const overlay = document.querySelector("[data-screensaver]") as HTMLElement
      // Overlay should still be visible during fade-out
      expect(overlay).not.toBeNull()
      expect(overlay.style.transition).toContain("300ms")
    })

    it("removes overlay after fade-out completes", async () => {
      const onFadeOutComplete = vi.fn()

      const { rerender } = render(
        <ScreensaverOverlay isActive={true} fadeOutDuration={300} onFadeOutComplete={onFadeOutComplete} />
      )

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(document.querySelector("[data-screensaver]")).not.toBeNull()

      // Deactivate
      rerender(
        <ScreensaverOverlay isActive={false} fadeOutDuration={300} onFadeOutComplete={onFadeOutComplete} />
      )

      // Wait for fade-out
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(onFadeOutComplete).toHaveBeenCalledTimes(1)
      expect(document.querySelector("[data-screensaver]")).toBeNull()
    })
  })

  describe("opacity transitions", () => {
    it("starts with opacity 0 then transitions to 1", async () => {
      render(<ScreensaverOverlay isActive={true} />)

      // Initial render - should be 0
      const overlay = document.querySelector("[data-screensaver]") as HTMLElement
      expect(overlay?.style.opacity).toBe("0")

      // After requestAnimationFrame calls
      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      const updatedOverlay = document.querySelector("[data-screensaver]") as HTMLElement
      expect(updatedOverlay?.style.opacity).toBe("1")
    })

    it("sets opacity to 0 when deactivating", async () => {
      const { rerender } = render(<ScreensaverOverlay isActive={true} />)

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Verify active state
      let overlay = document.querySelector("[data-screensaver]") as HTMLElement
      expect(overlay?.style.opacity).toBe("1")

      // Deactivate
      rerender(<ScreensaverOverlay isActive={false} />)

      overlay = document.querySelector("[data-screensaver]") as HTMLElement
      expect(overlay?.style.opacity).toBe("0")
    })
  })

  describe("pointer events", () => {
    it("enables pointer events when active", async () => {
      render(<ScreensaverOverlay isActive={true} />)

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      const overlay = document.querySelector("[data-screensaver]") as HTMLElement
      expect(overlay?.style.pointerEvents).toBe("auto")
    })

    it("disables pointer events during fade-out", async () => {
      const { rerender } = render(<ScreensaverOverlay isActive={true} />)

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      rerender(<ScreensaverOverlay isActive={false} />)

      const overlay = document.querySelector("[data-screensaver]") as HTMLElement
      expect(overlay?.style.pointerEvents).toBe("none")
    })
  })

  describe("styling", () => {
    it("uses fixed positioning with full viewport coverage", async () => {
      render(<ScreensaverOverlay isActive={true} />)

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      const overlay = document.querySelector("[data-screensaver]") as HTMLElement
      expect(overlay?.style.position).toBe("fixed")
      expect(overlay?.style.inset).toBe("0px")
    })

    it("has high z-index for overlay priority", async () => {
      render(<ScreensaverOverlay isActive={true} />)

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      const overlay = document.querySelector("[data-screensaver]") as HTMLElement
      expect(parseInt(overlay?.style.zIndex)).toBeGreaterThan(9000)
    })

    it("hides cursor during screensaver", async () => {
      render(<ScreensaverOverlay isActive={true} />)

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      const overlay = document.querySelector("[data-screensaver]") as HTMLElement
      expect(overlay?.style.cursor).toBe("none")
    })
  })

  describe("accessibility", () => {
    it("has aria-hidden attribute", async () => {
      render(<ScreensaverOverlay isActive={true} />)

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      const overlay = document.querySelector("[data-screensaver]")
      expect(overlay?.getAttribute("aria-hidden")).toBe("true")
    })
  })

  describe("dismiss hint", () => {
    it("shows dismiss hint text", async () => {
      render(<ScreensaverOverlay isActive={true} />)

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(screen.getByText(/press any key to dismiss/i)).toBeInTheDocument()
    })
  })

  describe("default props", () => {
    it("uses default fadeInDuration of 500ms", async () => {
      render(<ScreensaverOverlay isActive={true} />)

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      const overlay = document.querySelector("[data-screensaver]") as HTMLElement
      expect(overlay?.style.transition).toContain("500ms")
    })

    it("uses default fadeOutDuration of 300ms", async () => {
      const { rerender } = render(<ScreensaverOverlay isActive={true} />)

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      rerender(<ScreensaverOverlay isActive={false} />)

      const overlay = document.querySelector("[data-screensaver]") as HTMLElement
      expect(overlay?.style.transition).toContain("300ms")
    })
  })
})
