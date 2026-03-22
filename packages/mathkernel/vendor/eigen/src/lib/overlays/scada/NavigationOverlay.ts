/**
 * Navigation Overlay
 *
 * Interactive overlay for HMI screen navigation and history.
 * Manages screen transitions, breadcrumbs, and navigation history.
 *
 * Port convention: nav:screen:current, nav:screen:history
 *
 * @example
 * ```tsx
 * const { currentScreen, history, navigate, goBack, canGoBack } = useNavigation({
 *   containerId,
 *   initialScreen: "overview" as ScreenId,
 * })
 *
 * return (
 *   <nav>
 *     <button onClick={goBack} disabled={!canGoBack}>← Back</button>
 *     <span>{currentScreen}</span>
 *     <button onClick={() => navigate("details" as ScreenId)}>Details →</button>
 *   </nav>
 * )
 * ```
 */

import * as Effect from "effect/Effect"
import { Overlay, createOverlay } from "../Overlay"
import type { OverlayId, ContainerId } from "../schemas"
import { type ScreenId, type NavigationState, navPort } from "./types"

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

/** Navigation overlay configuration */
export interface NavigationOverlayConfig {
  /** Initial screen */
  readonly initialScreen: ScreenId
  /** Maximum history entries (default: 50) */
  readonly maxHistory?: number
  /** Screen metadata registry */
  readonly screens?: ReadonlyMap<ScreenId, ScreenMetadata>
}

/** Metadata for a screen */
export interface ScreenMetadata {
  readonly id: ScreenId
  readonly title: string
  readonly icon?: string
  readonly parent?: ScreenId
  readonly tags?: readonly string[]
}

// ─────────────────────────────────────────────────────────────
// Navigation State Extensions
// ─────────────────────────────────────────────────────────────

/** Extended navigation state with history */
export interface NavigationStateExtended extends NavigationState {
  /** Breadcrumb trail */
  readonly breadcrumbs: readonly ScreenId[]
  /** Forward history (for redo) */
  readonly forwardHistory: readonly ScreenId[]
  /** Navigation timestamp */
  readonly timestamp: number
}

/** Screen transition event */
export interface ScreenTransition {
  readonly from: ScreenId
  readonly to: ScreenId
  readonly timestamp: number
  readonly trigger: "navigate" | "back" | "forward" | "replace"
}

// ─────────────────────────────────────────────────────────────
// Navigation Utilities
// ─────────────────────────────────────────────────────────────

/** Build breadcrumb trail from screen and metadata */
export const buildBreadcrumbs = (
  screen: ScreenId,
  screens: ReadonlyMap<ScreenId, ScreenMetadata>
): readonly ScreenId[] => {
  const breadcrumbs: ScreenId[] = []
  let current: ScreenId | undefined = screen

  while (current) {
    breadcrumbs.unshift(current)
    const meta = screens.get(current)
    current = meta?.parent
  }

  return breadcrumbs
}

/** Check if navigation to target is valid */
export const canNavigateTo = (
  _from: ScreenId,
  _to: ScreenId,
  _screens: ReadonlyMap<ScreenId, ScreenMetadata>
): boolean => {
  // Future: Add route guards, permissions, etc.
  return true
}

// ─────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────

/**
 * Create a Navigation overlay for screen management.
 *
 * @param config - Navigation configuration
 * @returns Overlay instance
 */
export const createNavigationOverlay = (config: NavigationOverlayConfig): Overlay => {
  const { initialScreen } = config
  const overlayId = "nav:screen" as OverlayId
  const currentPort = navPort.current()
  const historyPort = navPort.breadcrumb()

  return createOverlay({
    id: overlayId,
    name: "Screen Navigation",
    visualPriority: 100, // High priority — navigation is critical

    // Navigation is INTERACTIVE — responds to user events
    handlers: {
      // Could add keyboard shortcuts here (e.g., Alt+Left for back)
    },

    ports: {
      subscriptions: [currentPort, historyPort],
      publications: [currentPort, historyPort],
    },

    onEnable: (containerId: ContainerId) =>
      Effect.gen(function* () {
        yield* Effect.log(`[Navigation] Enabled in ${containerId}`)
        yield* Effect.log(`[Navigation] Initial screen: ${initialScreen}`)
      }),

    onDisable: (containerId: ContainerId) =>
      Effect.gen(function* () {
        yield* Effect.log(`[Navigation] Disabled in ${containerId}`)
      }),
  })
}

// ─────────────────────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────────────────────

import { useCallback, useMemo } from "react"
import { useOverlay, usePort, usePublish } from "../hooks"
import type { UseOverlayResult } from "../hooks/useOverlay"

/** Result of useNavigation hook */
export interface UseNavigationResult {
  /** Current screen ID */
  readonly currentScreen: ScreenId
  /** Previous screen ID */
  readonly previousScreen: ScreenId | undefined
  /** Navigation history (back stack) */
  readonly history: readonly ScreenId[]
  /** Forward history (for redo) */
  readonly forwardHistory: readonly ScreenId[]
  /** Breadcrumb trail */
  readonly breadcrumbs: readonly ScreenId[]
  /** Can go back */
  readonly canGoBack: boolean
  /** Can go forward */
  readonly canGoForward: boolean
  /** Navigate to a screen */
  readonly navigate: (screen: ScreenId, replace?: boolean) => void
  /** Go back in history */
  readonly goBack: () => void
  /** Go forward in history */
  readonly goForward: () => void
  /** Replace current screen (no history entry) */
  readonly replace: (screen: ScreenId) => void
  /** Clear history */
  readonly clearHistory: () => void
  /** Get screen metadata */
  readonly getScreenMeta: (screen: ScreenId) => ScreenMetadata | undefined
  /** Last navigation timestamp */
  readonly timestamp: number
  /** Overlay control */
  readonly overlay: UseOverlayResult
}

/** Options for useNavigation hook */
export interface UseNavigationOptions {
  /** Container ID */
  readonly containerId: ContainerId
  /** Initial screen */
  readonly initialScreen: ScreenId
  /** Maximum history entries (default: 50) */
  readonly maxHistory?: number
  /** Screen metadata registry */
  readonly screens?: ReadonlyMap<ScreenId, ScreenMetadata>
  /** Auto-enable on mount (default: true) */
  readonly autoEnable?: boolean
  /** Callback on navigation */
  readonly onNavigate?: (transition: ScreenTransition) => void
}

/**
 * Hook for screen navigation management.
 *
 * @param options - Navigation options
 * @returns Navigation state and control functions
 */
export function useNavigation(options: UseNavigationOptions): UseNavigationResult {
  const {
    containerId,
    initialScreen,
    maxHistory = 50,
    screens = new Map(),
    autoEnable = true,
    onNavigate,
  } = options

  // Create overlay instance
  const overlayInstance = useMemo(
    () =>
      createNavigationOverlay({
        initialScreen,
        maxHistory,
        screens,
      }),
    [initialScreen, maxHistory, screens]
  )

  // Register overlay
  const overlay = useOverlay({
    containerId,
    overlay: overlayInstance,
    autoRegister: true,
    autoEnable,
  })

  // Subscribe to navigation state
  const navState = usePort<NavigationStateExtended>({
    containerId,
    portId: navPort.current(),
    initialValue: {
      currentScreen: initialScreen,
      previousScreen: undefined,
      history: [],
      breadcrumbs: buildBreadcrumbs(initialScreen, screens),
      forwardHistory: [],
      timestamp: Date.now(),
    },
  })

  // Publisher
  const publish = usePublish<NavigationStateExtended>(containerId, navPort.current())

  // Actions
  const navigate = useCallback(
    (screen: ScreenId, replace = false) => {
      const current = navState.value
      if (!current) return
      if (current.currentScreen === screen) return // No-op if same screen

      const now = Date.now()

      if (replace) {
        // Replace without adding to history
        const newState: NavigationStateExtended = {
          ...current,
          currentScreen: screen,
          breadcrumbs: buildBreadcrumbs(screen, screens),
          forwardHistory: [], // Clear forward on new navigation
          timestamp: now,
        }
        publish(newState)
        onNavigate?.({
          from: current.currentScreen,
          to: screen,
          timestamp: now,
          trigger: "replace",
        })
      } else {
        // Add current to history
        const newHistory = [...current.history, current.currentScreen].slice(-maxHistory)

        const newState: NavigationStateExtended = {
          currentScreen: screen,
          previousScreen: current.currentScreen,
          history: newHistory,
          breadcrumbs: buildBreadcrumbs(screen, screens),
          forwardHistory: [], // Clear forward on new navigation
          timestamp: now,
        }
        publish(newState)
        onNavigate?.({
          from: current.currentScreen,
          to: screen,
          timestamp: now,
          trigger: "navigate",
        })
      }
    },
    [navState.value, screens, maxHistory, publish, onNavigate]
  )

  const goBack = useCallback(() => {
    const current = navState.value
    if (!current || current.history.length === 0) return

    const newHistory = [...current.history]
    const previousScreen = newHistory.pop()!
    const now = Date.now()

    const newState: NavigationStateExtended = {
      currentScreen: previousScreen,
      previousScreen: current.currentScreen,
      history: newHistory,
      breadcrumbs: buildBreadcrumbs(previousScreen, screens),
      forwardHistory: [current.currentScreen, ...current.forwardHistory],
      timestamp: now,
    }
    publish(newState)
    onNavigate?.({
      from: current.currentScreen,
      to: previousScreen,
      timestamp: now,
      trigger: "back",
    })
  }, [navState.value, screens, publish, onNavigate])

  const goForward = useCallback(() => {
    const current = navState.value
    if (!current || current.forwardHistory.length === 0) return

    const newForward = [...current.forwardHistory]
    const nextScreen = newForward.shift()!
    const now = Date.now()

    const newState: NavigationStateExtended = {
      currentScreen: nextScreen,
      previousScreen: current.currentScreen,
      history: [...current.history, current.currentScreen],
      breadcrumbs: buildBreadcrumbs(nextScreen, screens),
      forwardHistory: newForward,
      timestamp: now,
    }
    publish(newState)
    onNavigate?.({
      from: current.currentScreen,
      to: nextScreen,
      timestamp: now,
      trigger: "forward",
    })
  }, [navState.value, screens, publish, onNavigate])

  const replaceScreen = useCallback(
    (screen: ScreenId) => {
      navigate(screen, true)
    },
    [navigate]
  )

  const clearHistory = useCallback(() => {
    const current = navState.value
    if (!current) return

    publish({
      ...current,
      history: [],
      forwardHistory: [],
      timestamp: Date.now(),
    })
  }, [navState.value, publish])

  const getScreenMeta = useCallback(
    (screen: ScreenId) => screens.get(screen),
    [screens]
  )

  // Extract values
  const state = navState.value ?? {
    currentScreen: initialScreen,
    previousScreen: undefined,
    history: [],
    breadcrumbs: [initialScreen],
    forwardHistory: [],
    timestamp: Date.now(),
  }

  return {
    currentScreen: state.currentScreen,
    previousScreen: state.previousScreen,
    history: state.history,
    forwardHistory: state.forwardHistory,
    breadcrumbs: state.breadcrumbs,
    canGoBack: state.history.length > 0,
    canGoForward: state.forwardHistory.length > 0,
    navigate,
    goBack,
    goForward,
    replace: replaceScreen,
    clearHistory,
    getScreenMeta,
    timestamp: state.timestamp,
    overlay,
  }
}

// ─────────────────────────────────────────────────────────────
// Factory Helpers (for testing)
// ─────────────────────────────────────────────────────────────

/**
 * Create screen metadata for testing.
 */
export const createScreenMeta = (
  id: ScreenId,
  title: string,
  parent?: ScreenId
): ScreenMetadata => ({
  id,
  title,
  parent,
})

/**
 * Create a screen registry from array.
 */
export const createScreenRegistry = (
  screens: readonly ScreenMetadata[]
): ReadonlyMap<ScreenId, ScreenMetadata> =>
  new Map(screens.map((s) => [s.id, s]))
