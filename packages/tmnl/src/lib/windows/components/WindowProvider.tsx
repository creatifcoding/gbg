/**
 * WindowProvider - Emacs-Style Pane System Provider
 *
 * Wraps content with WindowManager and registers hotkeys.
 * Use as a wrapper around the router content area.
 *
 * @module lib/windows/components/WindowProvider
 */

import React, { useEffect, useRef, type ReactNode } from 'react'
import { WindowManager } from './WindowManager'
import { RoutePane } from './RoutePane'
import { registerWindowHotkeys, unregisterWindowHotkeys } from '../hotkeys'
import { windowActions } from '../atoms'
import type { ContentPane } from '../schemas'

// =============================================================================
// Types
// =============================================================================

interface WindowProviderProps {
  /**
   * When true, uses Emacs-style pane management.
   * When false, renders children directly (passthrough mode).
   *
   * @default true
   */
  enabled?: boolean
  /**
   * Custom render function for pane content.
   * Defaults to RoutePane which shows route navigation.
   */
  renderContent?: (pane: ContentPane, isFocused: boolean) => React.ReactNode
  /**
   * Children to render when enabled=false (passthrough mode).
   */
  children?: ReactNode
  /**
   * Optional class name for the WindowManager container.
   */
  className?: string
}

// =============================================================================
// Default Render Content
// =============================================================================

/**
 * Default render function that displays RoutePane with navigation.
 */
function defaultRenderContent(
  pane: ContentPane,
  isFocused: boolean
): React.ReactNode {
  return <RoutePane pane={pane} isFocused={isFocused} />
}

// =============================================================================
// Component
// =============================================================================

/**
 * WindowProvider enables Emacs-style pane management.
 *
 * Features:
 * - C-x 2: Split horizontal (below)
 * - C-x 3: Split vertical (right)
 * - C-x o: Other window (next pane)
 * - C-x O: Previous window
 * - C-x 0: Delete window (close pane)
 * - C-x 1: Delete other windows
 *
 * @example
 * ```tsx
 * // Enable window management around router
 * <WindowProvider enabled>
 *   <RouterProvider router={router} />
 * </WindowProvider>
 *
 * // Passthrough mode (no window management)
 * <WindowProvider enabled={false}>
 *   <RouterProvider router={router} />
 * </WindowProvider>
 * ```
 */
export function WindowProvider({
  enabled = true,
  renderContent = defaultRenderContent,
  children,
  className,
}: WindowProviderProps) {
  // Track if we've synced the initial route
  const hasSyncedRef = useRef(false)

  // Sync initial browser URL with pane route on mount
  // This ensures direct navigation (e.g., /testbed/geoint-dashboard) works
  useEffect(() => {
    if (enabled && !hasSyncedRef.current) {
      hasSyncedRef.current = true
      const currentPath = window.location.pathname
      // Only sync if not already on home route
      if (currentPath && currentPath !== '/') {
        windowActions.setFocusedRoute(currentPath)
      }
    }
  }, [enabled])

  // Register hotkeys on mount
  useEffect(() => {
    if (enabled) {
      registerWindowHotkeys()
    }

    return () => {
      if (enabled) {
        unregisterWindowHotkeys()
      }
    }
  }, [enabled])

  // Passthrough mode
  if (!enabled) {
    return <>{children}</>
  }

  // Window management mode
  return <WindowManager renderContent={renderContent} className={className} />
}

export default WindowProvider
