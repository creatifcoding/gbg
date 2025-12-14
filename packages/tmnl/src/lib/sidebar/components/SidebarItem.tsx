/**
 * SidebarItem
 *
 * Icon button with Apple-grade micro-interactions.
 *
 * Animation Philosophy (Apple HIG):
 * - Spring physics for organic feel
 * - Layered feedback: hover → press → release → active
 * - Haptic-visual sync: quick micro-movements that feel tactile
 * - Breathing pulse for active state attention
 *
 * @module sidebar/components
 */

import { memo, useCallback, useMemo, useRef, useEffect, useState } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { motion } from "framer-motion"
import { animate } from "animejs"
import * as Option from "effect/Option"
import * as icons from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { SidebarItemConfig } from "../schemas"
import { sidebarActiveIdAtom } from "../atoms"

// ─────────────────────────────────────────────────────────────
// Animation Constants (Apple-inspired spring physics)
// ─────────────────────────────────────────────────────────────

/** Spring-like easing for organic feel */
const SPRING_OUT = "spring(1, 80, 10, 0)" // mass, stiffness, damping, velocity

/** Quick snap for press feedback */
const PRESS_DURATION = 100
const PRESS_SCALE = 0.92

/** Release spring with overshoot */
const RELEASE_DURATION = 400

/** Hover lift */
const HOVER_DURATION = 200
const HOVER_LIFT = -2 // px

/** Active indicator */
const INDICATOR_DURATION = 300

/** Glow pulse for active state */
const GLOW_DURATION = 600

// ─────────────────────────────────────────────────────────────
// Light Ray Configuration (Apple-style hard-edge stepped shadows)
// ─────────────────────────────────────────────────────────────

/** Hard-edge shadow steps - intense at edge, fading outward (low-poly style) */
const SHADOW_STEPS = [
  { opacity: 0.7, offset: 0, delay: 0 },      // Core - brightest
  { opacity: 0.5, offset: 4, delay: 0.02 },   // Step 1
  { opacity: 0.35, offset: 8, delay: 0.04 },  // Step 2
  { opacity: 0.2, offset: 14, delay: 0.06 },  // Step 3
  { opacity: 0.1, offset: 22, delay: 0.08 },  // Step 4 - outer edge
] as const

/** Shadow animation config - snappy like old Apple */
const SHADOW_SPRING = { type: "spring", stiffness: 500, damping: 30 } as const

// ─────────────────────────────────────────────────────────────
// SVG Underline (sinusoidal wave, animate along path on hover)
// ─────────────────────────────────────────────────────────────

/** Sinusoidal wave path - 2 oscillations */
const PATH_WAVE = "M0,3 Q3,1 6,3 Q9,5 12,3 Q15,1 18,3 Q21,5 24,3"

/** Path length (approximate for dasharray) */
const PATH_LENGTH = 28

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SidebarItemProps {
  /** Item configuration */
  item: SidebarItemConfig
  /** Click handler (called after action execution) */
  onClick?: (item: SidebarItemConfig) => void
  /** Whether item is being dragged */
  isDragging?: boolean
  /** Whether Ctrl is held (for drag mode indication) */
  isCtrlHeld?: boolean
}

// ─────────────────────────────────────────────────────────────
// Icon Resolution
// ─────────────────────────────────────────────────────────────

function resolveIcon(config: SidebarItemConfig["icon"]): LucideIcon | null {
  if (config.type === "lucide") {
    const pascalName = config.value
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("")

    const Icon = (icons as Record<string, LucideIcon>)[pascalName]
    return Icon ?? icons.HelpCircle
  }

  return icons.HelpCircle
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export const SidebarItem = memo(function SidebarItem({
  item,
  onClick,
  isDragging = false,
  isCtrlHeld = false,
}: SidebarItemProps) {
  // State
  const activeIdOption = useAtomValue(sidebarActiveIdAtom)
  const isActive = useMemo(
    () => Option.isSome(activeIdOption) && activeIdOption.value === item.id,
    [activeIdOption, item.id]
  )

  // Refs for animation targets
  const buttonRef = useRef<HTMLButtonElement>(null)
  const iconRef = useRef<HTMLSpanElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const activeGlowRef = useRef<HTMLSpanElement>(null)
  const wasActive = useRef(isActive)
  const isPressed = useRef(false)

  // Hover state for underline visibility
  const [isHovered, setIsHovered] = useState(false)

  // Icon setup
  const Icon = useMemo(() => resolveIcon(item.icon), [item.icon])
  const iconSize = item.icon.size ?? 20

  // ─── Hover Animation ─────────────────────────────────────────
  const handleMouseEnter = useCallback(() => {
    if (item.disabled) return
    setIsHovered(true)

    if (!buttonRef.current || !iconRef.current) return

    // Lift button slightly
    animate(buttonRef.current, {
      translateY: HOVER_LIFT,
      duration: HOVER_DURATION,
      easing: "easeOutCubic",
    })

    // Brighten icon
    animate(iconRef.current, {
      scale: 1.08,
      duration: HOVER_DURATION,
      easing: "easeOutCubic",
    })
  }, [item.disabled])

  const handleMouseLeave = useCallback(() => {
    if (item.disabled) return
    setIsHovered(false)
    if (isPressed.current) return // Don't reset if still pressed

    if (!buttonRef.current || !iconRef.current) return

    // Return to rest
    animate(buttonRef.current, {
      translateY: 0,
      duration: HOVER_DURATION,
      easing: "easeOutCubic",
    })

    animate(iconRef.current, {
      scale: 1,
      duration: HOVER_DURATION,
      easing: "easeOutCubic",
    })
  }, [item.disabled])

  // ─── Press Animation ─────────────────────────────────────────
  const handleMouseDown = useCallback(() => {
    if (item.disabled || !buttonRef.current || !iconRef.current) return
    isPressed.current = true

    // Quick scale down (haptic feel)
    animate(buttonRef.current, {
      scale: PRESS_SCALE,
      translateY: 0, // Cancel hover lift
      duration: PRESS_DURATION,
      easing: "easeOutQuad",
    })

    // Icon squish
    animate(iconRef.current, {
      scale: 0.9,
      duration: PRESS_DURATION,
      easing: "easeOutQuad",
    })
  }, [item.disabled])

  const handleMouseUp = useCallback(() => {
    if (item.disabled || !buttonRef.current || !iconRef.current) return
    isPressed.current = false

    // Spring back with overshoot
    animate(buttonRef.current, {
      scale: [PRESS_SCALE, 1.02, 1], // overshoot then settle
      translateY: 0,
      duration: RELEASE_DURATION,
      easing: SPRING_OUT,
    })

    // Icon bounce back
    animate(iconRef.current, {
      scale: [0.9, 1.12, 1], // bounce overshoot
      duration: RELEASE_DURATION,
      easing: SPRING_OUT,
    })
  }, [item.disabled])

  // ─── Click Handler ───────────────────────────────────────────
  const handleClick = useCallback(() => {
    if (item.disabled) return
    onClick?.(item)
  }, [item, onClick])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleClick()
      }
    },
    [handleClick]
  )

  // ─── Active State Animation ──────────────────────────────────
  useEffect(() => {
    if (wasActive.current === isActive) return
    wasActive.current = isActive

    if (!indicatorRef.current || !activeGlowRef.current || !iconRef.current) return

    if (isActive) {
      // Indicator slides in from left with spring
      animate(indicatorRef.current, {
        scaleY: [0, 1.15, 1], // overshoot
        opacity: [0, 1],
        duration: INDICATOR_DURATION,
        easing: SPRING_OUT,
      })

      // Active glow pulse (Apple-style attention)
      animate(activeGlowRef.current, {
        opacity: [0, 0.5, 0.25],
        scaleX: [0.5, 1.2, 1],
        duration: GLOW_DURATION,
        easing: "easeOutQuad",
      })

      // Icon pop on activation
      animate(iconRef.current, {
        scale: [1, 1.15, 1],
        duration: 300,
        easing: SPRING_OUT,
      })
    } else {
      // Indicator slides out
      animate(indicatorRef.current, {
        scaleY: [1, 0],
        opacity: [1, 0],
        duration: 150,
        easing: "easeInQuad",
      })

      // Active glow fades
      animate(activeGlowRef.current, {
        opacity: 0,
        scaleX: 0.5,
        duration: 150,
        easing: "easeOutQuad",
      })
    }
  }, [isActive])

  // ─── Styles ──────────────────────────────────────────────────
  const baseClasses = [
    "relative flex items-center justify-center",
    "w-10 h-10 rounded-lg",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
    "will-change-transform", // GPU acceleration hint
  ]

  const stateClasses = item.disabled
    ? ["opacity-40 cursor-not-allowed"]
    : isActive
      ? ["text-white"]
      : ["text-neutral-500 hover:text-neutral-200"]

  const dragClasses = isDragging
    ? ["opacity-50"]
    : isCtrlHeld && item.group === "plugin"
      ? ["cursor-grab"]
      : []

  return (
    <div
      className="grid relative"
      style={{ gridTemplateColumns: "15% 85%" }}
      data-sidebar-item-id={item.id}
      data-sidebar-group={item.group}
    >
      {/* Light source edge - 15% column (Apple-style hard-edge shadows) */}
      <div className="flex items-center justify-start pointer-events-none h-10 relative overflow-visible">
        {/* Hard-edge shadow steps - no blur, stepped opacity */}
        {SHADOW_STEPS.map((step, i) => (
          <motion.div
            key={i}
            className="absolute h-5"
            style={{
              left: step.offset,
              width: 3,
              backgroundColor: `rgba(255,255,255,${step.opacity})`,
            }}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{
              scaleY: isHovered ? 1 : 0,
              opacity: isHovered ? 1 : 0,
            }}
            transition={{
              ...SHADOW_SPRING,
              delay: isHovered ? step.delay : (SHADOW_STEPS.length - 1 - i) * 0.015,
            }}
            aria-hidden="true"
          />
        ))}
        {/* Active state glow - persistent bar when item is active */}
        <span
          ref={activeGlowRef}
          className="absolute left-0 h-6 w-1"
          style={{
            backgroundColor: "rgba(255,255,255,0.6)",
            boxShadow: "0 0 8px 2px rgba(255,255,255,0.3)",
            opacity: 0,
            transform: "scaleY(0.5)",
            transformOrigin: "center",
          }}
          aria-hidden="true"
        />
      </div>

      {/* Content column - 85% (icon + underline stacked) */}
      <div className="flex flex-col items-center">
        {/* Button */}
        <button
        ref={buttonRef}
        type="button"
        className={[...baseClasses, ...stateClasses, ...dragClasses].join(" ")}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        disabled={item.disabled}
        aria-label={item.label}
        aria-pressed={isActive}
        title={item.label}
        style={{ transform: "translateY(0) scale(1)" }}
      >
        {/* Hover background */}
        <span
          className="absolute inset-0 rounded-lg bg-white/0 hover:bg-white/5 transition-colors duration-150 pointer-events-none"
          aria-hidden="true"
        />

        {/* Icon container */}
        <span
          ref={iconRef}
          className="relative z-10"
          style={{ transform: "scale(1)" }}
        >
          {Icon && <Icon size={iconSize} strokeWidth={1.5} />}
        </span>

        {/* Active indicator - white bar with glow */}
        <span
          ref={indicatorRef}
          className="absolute left-0 top-1/2 w-[3px] h-5 rounded-r-full pointer-events-none"
          style={{
            transform: "translateY(-50%) scaleY(0)",
            transformOrigin: "center",
            background: "linear-gradient(to bottom, rgba(255,255,255,0.9), rgba(255,255,255,1), rgba(255,255,255,0.9))",
            boxShadow: "0 0 8px 2px rgba(255,255,255,0.4), 0 0 20px 4px rgba(255,255,255,0.2)",
            opacity: 0,
          }}
          aria-hidden="true"
        />

        {/* Keyboard shortcut badge */}
        {item.shortcut && !isDragging && (
          <span
            className="absolute -bottom-0.5 -right-0.5 px-1 font-mono text-neutral-600 bg-neutral-900/90 rounded border border-neutral-800"
            style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
            aria-hidden="true"
          >
            {item.shortcut}
          </span>
        )}
      </button>

        {/* Underline - only visible on hover */}
        <div className="h-2 flex items-center justify-center px-2">
          <svg
            width="24"
            height="6"
            viewBox="0 0 24 6"
            fill="none"
            className="pointer-events-none"
            aria-hidden="true"
            style={{
              opacity: isHovered ? 0.6 : 0,
              transition: "opacity 150ms ease-out",
            }}
          >
            <path
              d={PATH_WAVE}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray={PATH_LENGTH}
              style={{
                strokeDashoffset: isHovered ? 0 : PATH_LENGTH,
                transition: "stroke-dashoffset 400ms ease-out",
              }}
            />
          </svg>
        </div>
      </div>
    </div>
  )
})
