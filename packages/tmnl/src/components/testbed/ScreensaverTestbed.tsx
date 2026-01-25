/**
 * Screensaver Testbed
 *
 * Smoke test for AsciiScene rendering.
 * Tests both direct AsciiScene and ScreensaverOverlay with debug.
 */

import { useState } from "react"
import { ScreensaverOverlay } from "@/lib/screensaver"
import { DebugScopeProvider } from "@/lib/debug"

export function ScreensaverTestbed() {
  const [isActive, setIsActive] = useState(true)

  return (
    <DebugScopeProvider debug={true} name="ScreensaverTestbed">
      <div style={{ width: "100vw", height: "100vh", background: "#111" }}>
        {/* Control panel */}
        <div
          style={{
            position: "fixed",
            top: 16,
            left: 16,
            zIndex: 10000,
            display: "flex",
            gap: 8,
            padding: 16,
            background: "rgba(0,0,0,0.8)",
            borderRadius: 4,
            fontFamily: "monospace",
            fontSize: 12,
            color: "#fff",
          }}
        >
          <button
            onClick={() => setIsActive(!isActive)}
            style={{
              padding: "8px 16px",
              background: isActive ? "#2a5" : "#555",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontFamily: "monospace",
            }}
          >
            {isActive ? "ACTIVE" : "INACTIVE"}
          </button>
          <span style={{ color: "#666" }}>
            Check console for DebugScope logs
          </span>
        </div>

        {/* Screensaver overlay with debug enabled */}
        <ScreensaverOverlay
          isActive={isActive}
          debug={true}
          fadeInDuration={500}
          fadeOutDuration={300}
        />
      </div>
    </DebugScopeProvider>
  )
}
