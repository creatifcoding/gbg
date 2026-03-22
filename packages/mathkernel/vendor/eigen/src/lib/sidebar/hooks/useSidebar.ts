/**
 * useSidebar
 *
 * Consumer hook for sidebar state and operations.
 *
 * @module sidebar/hooks
 */

import { useMemo, useCallback } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import * as Option from "effect/Option"

import type { SidebarItemId } from "../schemas"
import {
  sidebarCollapsedAtom,
  sidebarActiveIdAtom,
  sortedSidebarItemsAtom,
  setActiveId,
  clearActiveId,
  toggleCollapsed,
  setCollapsed,
} from "../atoms"

/**
 * Hook return type for useSidebar.
 */
export interface UseSidebarReturn {
  /** Whether sidebar is collapsed */
  isCollapsed: boolean
  /** Currently active item ID (or null) */
  activeId: SidebarItemId | null
  /** Core items (sorted) */
  coreItems: ReturnType<typeof useAtomValue<typeof sortedSidebarItemsAtom>>["core"]
  /** Plugin items (sorted by user order) */
  pluginItems: ReturnType<typeof useAtomValue<typeof sortedSidebarItemsAtom>>["plugins"]
  /** Set active item by ID */
  setActive: (id: SidebarItemId | null) => void
  /** Clear active item */
  clearActive: () => void
  /** Toggle collapsed state */
  toggle: () => void
  /** Set collapsed state */
  setCollapsed: (collapsed: boolean) => void
}

/**
 * Consumer hook for sidebar state and operations.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isCollapsed, activeId, toggle } = useSidebar()
 *
 *   return (
 *     <div>
 *       <p>Collapsed: {isCollapsed ? 'Yes' : 'No'}</p>
 *       <p>Active: {activeId ?? 'None'}</p>
 *       <button onClick={toggle}>Toggle</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useSidebar(): UseSidebarReturn {
  // Subscribe to state (registry provided via OverlayRegistryProvider context)
  const isCollapsed = useAtomValue(sidebarCollapsedAtom)
  const activeIdOption = useAtomValue(sidebarActiveIdAtom)
  const { core, plugins } = useAtomValue(sortedSidebarItemsAtom)

  // Derive active ID
  const activeId = useMemo(
    () => (Option.isSome(activeIdOption) ? activeIdOption.value : null),
    [activeIdOption]
  )

  // Memoized operations
  const setActive = useCallback((id: SidebarItemId | null) => {
    setActiveId(id)
  }, [])

  const clearActive = useCallback(() => {
    clearActiveId()
  }, [])

  const toggle = useCallback(() => {
    toggleCollapsed()
  }, [])

  const setCollapsedState = useCallback((collapsed: boolean) => {
    setCollapsed(collapsed)
  }, [])

  return {
    isCollapsed,
    activeId,
    coreItems: core,
    pluginItems: plugins,
    setActive,
    clearActive,
    toggle,
    setCollapsed: setCollapsedState,
  }
}
