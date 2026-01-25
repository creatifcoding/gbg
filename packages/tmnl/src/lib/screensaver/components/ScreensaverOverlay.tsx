/**
 * ScreensaverOverlay Component
 *
 * Fullscreen overlay that renders the ASCII art screensaver.
 * Handles fade-in/fade-out transitions.
 *
 * @module
 */

import { useEffect, useState, Suspense } from "react"
import { AsciiScene } from "@/components/splash/aberration"
import { DebugScope } from "@/lib/debug"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ScreensaverOverlayProps {
  /** Whether the screensaver is active */
  isActive: boolean
  /** Fade-in duration in ms */
  fadeInDuration?: number
  /** Fade-out duration in ms */
  fadeOutDuration?: number
  /** Called when fade-out completes */
  onFadeOutComplete?: () => void
  /** Enable debug logging via DebugScope */
  debug?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading Fallback
// ─────────────────────────────────────────────────────────────────────────────

function LoadingFallback() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0a0a0a",
        color: "#3a3a3a",
        fontFamily: "monospace",
        fontSize: "14px",
      }}
    >
      INITIALIZING...
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ScreensaverOverlay({
  isActive,
  fadeInDuration = 500,
  fadeOutDuration = 300,
  onFadeOutComplete,
  debug = false,
}: ScreensaverOverlayProps) {
  // Track whether we should render (for fade-out animation)
  const [shouldRender, setShouldRender] = useState(false)
  const [opacity, setOpacity] = useState(0)

  useEffect(() => {
    if (isActive) {
      // Start rendering, then fade in
      setShouldRender(true)
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOpacity(1)
        })
      })
    } else if (shouldRender) {
      // Fade out, then stop rendering
      setOpacity(0)
      const timer = setTimeout(() => {
        setShouldRender(false)
        onFadeOutComplete?.()
      }, fadeOutDuration)
      return () => clearTimeout(timer)
    }
  }, [isActive, shouldRender, fadeOutDuration, onFadeOutComplete])

  if (!shouldRender) return null

  return (
    <>
      <DebugScope
        debug={debug}
        name="ScreensaverOverlay"
        watch={{ isActive, opacity, shouldRender }}
      />
      <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        opacity,
        transition: `opacity ${isActive ? fadeInDuration : fadeOutDuration}ms ease-in-out`,
        pointerEvents: isActive ? "auto" : "none",
        cursor: "none", // Hide cursor during screensaver
      }}
      aria-hidden="true"
      data-screensaver
    >
      <Suspense fallback={<LoadingFallback />}>
        <AsciiScene />
      </Suspense>

      {/* Subtle hint to dismiss */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(255, 255, 255, 0.2)",
          fontFamily: "monospace",
          fontSize: "12px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        Press any key to dismiss
      </div>
    </div>
    </>
  )
}
