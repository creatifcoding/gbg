/**
 * useSessionRestore Hook
 *
 * React hook for automatic scroll position persistence and restoration.
 * Integrates with TanStack Router for route-based session management.
 *
 * @module lib/session/hooks
 */

import { useEffect, useRef, useCallback } from "react"
import { useLocation } from "@tanstack/react-router"
import { useAtomValue } from "jotai"
import { Result } from "@effect-atom/atom"
import {
  currentRouteStateAtom,
  sessionOps,
  sessionInitializedAtom,
} from "../atoms"

// =============================================================================
// Configuration
// =============================================================================

interface UseSessionRestoreOptions {
  /** Debounce delay for scroll saves (ms) */
  debounceMs?: number
  /** Whether to restore scroll on mount */
  restoreOnMount?: boolean
  /** Whether to save scroll on change */
  saveOnScroll?: boolean
  /** Enable debug logging */
  debug?: boolean
}

const defaultOptions: Required<UseSessionRestoreOptions> = {
  debounceMs: 200,
  restoreOnMount: true,
  saveOnScroll: true,
  debug: false,
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * useSessionRestore - Automatic scroll position persistence
 *
 * Restores scroll position on route mount, saves on scroll.
 * Uses debouncing to prevent excessive writes.
 *
 * @example
 * ```tsx
 * function MyPage() {
 *   useSessionRestore({ debug: true })
 *   return <div>Page content...</div>
 * }
 * ```
 */
export function useSessionRestore(options: UseSessionRestoreOptions = {}) {
  const opts = { ...defaultOptions, ...options }
  const location = useLocation()
  const routeStateResult = useAtomValue(currentRouteStateAtom)
  const isInitialized = useAtomValue(sessionInitializedAtom)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasRestoredRef = useRef(false)

  // Extract route state from Result wrapper
  const routeState = Result.isSuccess(routeStateResult)
    ? routeStateResult.value
    : null

  const log = useCallback(
    (message: string, ...args: unknown[]) => {
      if (opts.debug) {
        console.log(`[useSessionRestore] ${message}`, ...args)
      }
    },
    [opts.debug]
  )

  // ==========================================================================
  // Initialize session on first mount
  // ==========================================================================

  useEffect(() => {
    if (!isInitialized) {
      log("Initializing session persistence...")
      sessionOps.initialize()
    }
  }, [isInitialized, log])

  // ==========================================================================
  // Load route state when path changes
  // ==========================================================================

  useEffect(() => {
    if (!isInitialized) return

    const path = location.pathname
    log("Loading route state for:", path)
    hasRestoredRef.current = false
    sessionOps.loadRoute(path)
  }, [location.pathname, isInitialized, log])

  // ==========================================================================
  // Restore scroll position
  // ==========================================================================

  useEffect(() => {
    if (!opts.restoreOnMount) return
    if (!routeState) return
    if (hasRestoredRef.current) return

    // Only restore if this is the matching route
    if (routeState.route_path !== location.pathname) return

    log("Restoring scroll position:", {
      x: routeState.scroll_x,
      y: routeState.scroll_y,
    })

    // Use requestAnimationFrame for smooth restoration
    requestAnimationFrame(() => {
      window.scrollTo(routeState.scroll_x, routeState.scroll_y)
      hasRestoredRef.current = true
    })
  }, [routeState, location.pathname, opts.restoreOnMount, log])

  // ==========================================================================
  // Save scroll position on scroll
  // ==========================================================================

  useEffect(() => {
    if (!opts.saveOnScroll) return
    if (!isInitialized) return

    const handleScroll = () => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Debounced save
      timeoutRef.current = setTimeout(() => {
        const path = location.pathname
        const scrollX = window.scrollX
        const scrollY = window.scrollY

        log("Saving scroll position:", { path, scrollX, scrollY })

        sessionOps.saveScroll({ path, scrollX, scrollY })
      }, opts.debounceMs)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [location.pathname, opts.saveOnScroll, opts.debounceMs, isInitialized, log])

  // ==========================================================================
  // Return state for consumers
  // ==========================================================================

  return {
    /** Current route state (if loaded) */
    routeState,
    /** Whether session persistence is initialized */
    isInitialized,
    /** Current pathname */
    pathname: location.pathname,
    /** Whether scroll has been restored for current route */
    hasRestored: hasRestoredRef.current,
    /** Manually save current scroll position */
    saveCurrentScroll: useCallback(() => {
      sessionOps.saveScroll({
        path: location.pathname,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      })
    }, [location.pathname]),
  }
}

// =============================================================================
// Convenience Hook: useAppState
// =============================================================================

/**
 * useAppState - Typed app state persistence hook
 *
 * @example
 * ```tsx
 * interface SliderState {
 *   value: number
 *   behavior: string
 * }
 *
 * function SliderTestbed() {
 *   const { state, setState, isLoaded } = useAppState<SliderState>(
 *     'testbed/slider',
 *     { value: 50, behavior: 'linear' }
 *   )
 *
 *   return <Slider value={state.value} onChange={(v) => setState({ ...state, value: v })} />
 * }
 * ```
 */
export function useAppState<T>(appKey: string, defaultState: T) {
  const isInitialized = useAtomValue(sessionInitializedAtom)
  const stateRef = useRef<T>(defaultState)
  const isLoadedRef = useRef(false)

  // Load state on mount
  useEffect(() => {
    if (!isInitialized) return

    sessionOps.loadApp(appKey).then((result) => {
      if (Result.isSuccess(result) && result.value) {
        const parsed = result.value.parse<T>()
        if (parsed !== null) {
          stateRef.current = parsed
          isLoadedRef.current = true
        }
      }
    })
  }, [appKey, isInitialized])

  const setState = useCallback(
    (newState: T) => {
      stateRef.current = newState
      sessionOps.saveTypedApp({ appKey, state: newState })
    },
    [appKey]
  )

  return {
    state: stateRef.current,
    setState,
    isLoaded: isLoadedRef.current,
  }
}
