/**
 * useDrawer Hook
 *
 * Imperative drawer control for opening, closing, and managing drawers.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const drawer = useDrawer()
 *
 *   const openSettings = () => {
 *     drawer.open({
 *       id: 'settings',
 *       slot: 'global',
 *       content: <SettingsPanel />,
 *     })
 *   }
 *
 *   return <button onClick={openSettings}>Settings</button>
 * }
 * ```
 *
 * @module
 */

import { useCallback, useMemo } from 'react'
import { useDrawerStack } from '../DrawerStackContext'
import type { DrawerConfig, DrawerInstance } from '../types'

// =============================================================================
// HOOK RETURN TYPE
// =============================================================================

export interface UseDrawerReturn {
  /** Open a new drawer */
  open: (config: DrawerConfig) => string
  /** Close a drawer by ID */
  close: (id: string) => void
  /** Close all drawers */
  closeAll: () => void
  /** Replace a drawer with a new one (animated switch) */
  replace: (id: string, config: DrawerConfig) => string
  /** Bring a drawer to front of stack */
  bringToFront: (id: string) => void
  /** Check if a specific drawer is open */
  isOpen: (id: string) => boolean
  /** Get drawer instance by ID */
  get: (id: string) => DrawerInstance | undefined
  /** Current drawer count */
  count: number
  /** Whether any drawer is open */
  hasOpen: boolean
  /** IDs of all open drawers */
  openIds: string[]
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for imperative drawer control.
 *
 * @returns Drawer control methods and state
 */
export function useDrawer(): UseDrawerReturn {
  const {
    state,
    push,
    pop,
    popAll,
    replace: stackReplace,
    bringToFront,
    getDrawer,
  } = useDrawerStack()

  // -------------------------------------------------------------------------
  // Open drawer
  // -------------------------------------------------------------------------
  const open = useCallback(
    (config: DrawerConfig): string => {
      return push(config)
    },
    [push]
  )

  // -------------------------------------------------------------------------
  // Close drawer
  // -------------------------------------------------------------------------
  const close = useCallback(
    (id: string): void => {
      pop(id)
    },
    [pop]
  )

  // -------------------------------------------------------------------------
  // Close all drawers
  // -------------------------------------------------------------------------
  const closeAll = useCallback((): void => {
    popAll()
  }, [popAll])

  // -------------------------------------------------------------------------
  // Replace drawer
  // -------------------------------------------------------------------------
  const replace = useCallback(
    (id: string, config: DrawerConfig): string => {
      return stackReplace(id, config)
    },
    [stackReplace]
  )

  // -------------------------------------------------------------------------
  // Check if drawer is open
  // -------------------------------------------------------------------------
  const isOpen = useCallback(
    (id: string): boolean => {
      return state.drawers.some(
        (d) => d.id === id && d.animationState !== 'exited'
      )
    },
    [state.drawers]
  )

  // -------------------------------------------------------------------------
  // Get drawer instance
  // -------------------------------------------------------------------------
  const get = useCallback(
    (id: string): DrawerInstance | undefined => {
      return getDrawer(id)
    },
    [getDrawer]
  )

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------
  const count = state.drawers.filter((d) => d.animationState !== 'exited').length
  const hasOpen = count > 0
  const openIds = state.drawers
    .filter((d) => d.animationState !== 'exited')
    .map((d) => d.id)

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------
  return useMemo(
    () => ({
      open,
      close,
      closeAll,
      replace,
      bringToFront,
      isOpen,
      get,
      count,
      hasOpen,
      openIds,
    }),
    [
      open,
      close,
      closeAll,
      replace,
      bringToFront,
      isOpen,
      get,
      count,
      hasOpen,
      openIds,
    ]
  )
}

// =============================================================================
// CONVENIENCE HOOKS
// =============================================================================

/**
 * Hook to control a specific drawer by ID.
 */
export function useDrawerInstance(id: string) {
  const drawer = useDrawer()

  return useMemo(
    () => ({
      isOpen: drawer.isOpen(id),
      instance: drawer.get(id),
      close: () => drawer.close(id),
      bringToFront: () => drawer.bringToFront(id),
    }),
    [drawer, id]
  )
}
