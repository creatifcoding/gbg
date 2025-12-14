/**
 * SidebarItem
 *
 * Icon button for sidebar navigation with tooltip and active state.
 *
 * @module sidebar/components
 */

import { memo, useCallback, useMemo } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import * as Option from "effect/Option"
import * as icons from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { SidebarItemConfig, SidebarItemId } from "../schemas"
import { sidebarActiveIdAtom, sidebarRegistry } from "../atoms"

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

/**
 * Resolve icon component from config.
 */
function resolveIcon(config: SidebarItemConfig["icon"]): LucideIcon | null {
  if (config.type === "lucide") {
    // Convert kebab-case to PascalCase for Lucide icons
    const pascalName = config.value
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("")

    const Icon = (icons as Record<string, LucideIcon>)[pascalName]
    return Icon ?? icons.HelpCircle
  }

  // TODO: Handle custom and url icon types
  return icons.HelpCircle
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * Individual sidebar item button.
 *
 * Displays an icon with tooltip on hover.
 * Shows active state when item is currently selected.
 */
export const SidebarItem = memo(function SidebarItem({
  item,
  onClick,
  isDragging = false,
  isCtrlHeld = false,
}: SidebarItemProps) {
  // Subscribe to active ID
  const activeIdOption = useAtomValue(sidebarActiveIdAtom, { registry: sidebarRegistry })
  const isActive = useMemo(
    () =>
      Option.isSome(activeIdOption) &&
      activeIdOption.value === item.id,
    [activeIdOption, item.id]
  )

  // Resolve icon
  const Icon = useMemo(() => resolveIcon(item.icon), [item.icon])
  const iconSize = item.icon.size ?? 20

  // Handle click
  const handleClick = useCallback(() => {
    if (item.disabled) return
    onClick?.(item)
  }, [item, onClick])

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleClick()
      }
    },
    [handleClick]
  )

  // Compute styles
  const baseClasses = [
    "relative flex items-center justify-center",
    "w-10 h-10 rounded-md",
    "transition-colors duration-150",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-tmnl-accent",
  ]

  const stateClasses = item.disabled
    ? ["opacity-40 cursor-not-allowed"]
    : isActive
      ? ["bg-tmnl-accent/20 text-tmnl-accent"]
      : ["text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"]

  const dragClasses = isDragging
    ? ["opacity-50 scale-95"]
    : isCtrlHeld && item.group === "plugin"
      ? ["cursor-grab"]
      : []

  return (
    <button
      type="button"
      className={[...baseClasses, ...stateClasses, ...dragClasses].join(" ")}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={item.disabled}
      aria-label={item.label}
      aria-pressed={isActive}
      title={item.label}
      data-sidebar-item-id={item.id}
      data-sidebar-group={item.group}
    >
      {/* Icon */}
      {Icon && <Icon size={iconSize} strokeWidth={1.5} />}

      {/* Active indicator */}
      {isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-tmnl-accent rounded-r"
          aria-hidden="true"
        />
      )}

      {/* Keyboard shortcut badge (if present) */}
      {item.shortcut && !isDragging && (
        <span
          className="absolute -bottom-0.5 -right-0.5 px-1 text-[10px] font-mono text-neutral-500 bg-neutral-900 rounded"
          aria-hidden="true"
        >
          {item.shortcut}
        </span>
      )}
    </button>
  )
})
