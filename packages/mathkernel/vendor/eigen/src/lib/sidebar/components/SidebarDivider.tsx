/**
 * SidebarDivider
 *
 * Visual separator between core and plugin sections.
 *
 * @module sidebar/components
 */

import { memo } from "react"

export interface SidebarDividerProps {
  /** Optional custom className */
  className?: string
}

/**
 * Horizontal divider between sidebar sections.
 * Matches the sidebar's brutalist aesthetic.
 */
export const SidebarDivider = memo(function SidebarDivider({
  className = "",
}: SidebarDividerProps) {
  return (
    <div
      className={`mx-2 my-1 h-px bg-neutral-700/50 ${className}`}
      role="separator"
      aria-orientation="horizontal"
    />
  )
})
