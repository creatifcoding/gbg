/**
 * SidebarTooltip
 *
 * Tooltip component for sidebar items.
 * Shows label and optional keyboard shortcut.
 *
 * @module sidebar/components
 */

import { memo, useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SidebarTooltipProps {
  /** Label text */
  label: string
  /** Optional keyboard shortcut */
  shortcut?: string
  /** Trigger element ref */
  triggerRef: React.RefObject<HTMLElement>
  /** Whether tooltip is visible */
  isVisible: boolean
  /** Position relative to trigger */
  position?: "right" | "bottom"
  /** Delay before showing (ms) */
  delay?: number
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * Tooltip for sidebar items.
 *
 * Positioned to the right of the trigger by default.
 * Uses portal to render at document root for proper z-index.
 */
export const SidebarTooltip = memo(function SidebarTooltip({
  label,
  shortcut,
  triggerRef,
  isVisible,
  position = "right",
  delay = 200,
}: SidebarTooltipProps) {
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const [shouldShow, setShouldShow] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Handle delayed show
  useEffect(() => {
    if (isVisible) {
      timeoutRef.current = setTimeout(() => {
        setShouldShow(true)
      }, delay)
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      setShouldShow(false)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isVisible, delay])

  // Calculate position
  useEffect(() => {
    if (!shouldShow || !triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()

    if (position === "right") {
      setCoords({
        top: rect.top + rect.height / 2,
        left: rect.right + 8,
      })
    } else {
      setCoords({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      })
    }
  }, [shouldShow, triggerRef, position])

  if (!shouldShow) return null

  const tooltipContent = (
    <div
      className={`
        fixed z-50
        px-2 py-1
        bg-neutral-800 border border-neutral-700
        rounded shadow-lg
        text-xs text-neutral-200
        whitespace-nowrap
        pointer-events-none
        animate-in fade-in-0 zoom-in-95
        duration-150
      `}
      style={{
        top: coords.top,
        left: coords.left,
        transform:
          position === "right"
            ? "translateY(-50%)"
            : "translateX(-50%)",
      }}
      role="tooltip"
    >
      <span>{label}</span>
      {shortcut && (
        <span className="ml-2 px-1 py-0.5 bg-neutral-900 rounded text-neutral-500 font-mono">
          {shortcut}
        </span>
      )}
    </div>
  )

  // Render in portal
  return createPortal(tooltipContent, document.body)
})

// ─────────────────────────────────────────────────────────────
// Hook for tooltip state
// ─────────────────────────────────────────────────────────────

/**
 * Hook for managing tooltip visibility.
 */
export function useTooltipState() {
  const [isVisible, setIsVisible] = useState(false)

  const show = () => setIsVisible(true)
  const hide = () => setIsVisible(false)

  return { isVisible, show, hide }
}
