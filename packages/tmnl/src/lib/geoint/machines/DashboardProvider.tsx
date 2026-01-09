/**
 * GEOINT Dashboard Provider
 *
 * Integrates XState dashboard machine with effect-atom for reactive state.
 * Uses the stx pattern: XState for transitions, atoms for reactive data.
 *
 * This module re-exports atoms from the existing geoint/atoms module
 * and provides XState machine integration.
 *
 * @module geoint/machines/DashboardProvider
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { useMachine } from '@xstate/react'
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react'
import {
  dashboardMachine,
  type DashboardContext,
  type DashboardEvent,
} from './dashboardMachine'
import type { SearchResultItem, IntelSource, BBox } from '../schemas'
import type { ViewportState } from '../workspace/schemas'

// Re-export atoms from the main atoms module
import {
  geointRegistry,
  resultsAtom,
  resultsBySourceAtom,
  sourceCountsAtom,
  selectedResultAtom,
  selectedResultsAtom,
  hoveredResultAtom,
  layerVisibilityAtom,
  setResults,
  selectResult,
  toggleLayer,
  type LayerVisibility,
} from '../atoms'

export {
  geointRegistry,
  resultsAtom,
  resultsBySourceAtom,
  sourceCountsAtom,
  selectedResultAtom,
  selectedResultsAtom,
  hoveredResultAtom,
  layerVisibilityAtom,
}

/**
 * Registry Provider for GEOINT dashboard.
 * Wrap dashboard components with this so useAtomValue reads from geointRegistry.
 */
export function GeointRegistryProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return React.createElement(
    RegistryContext.Provider,
    { value: geointRegistry as unknown as typeof geointRegistry },
    children
  )
}

// =============================================================================
// Context Types
// =============================================================================

interface DashboardContextValue {
  // XState
  state: DashboardContext
  send: (event: DashboardEvent) => void

  // Derived state helpers
  isSearching: boolean
  hasSelection: boolean
  selectionCount: number
  currentState: 'idle' | 'searching' | 'selecting'

  // Actions (convenience wrappers)
  search: (bounds: BBox, query?: string) => Promise<void>
  select: (entityId: string) => void
  toggleSelect: (entityId: string) => void
  multiSelect: (entityIds: string[]) => void
  clearSelection: () => void
  setLayout: (layout: 'command' | 'focus' | 'grid') => void
  togglePanel: (panel: keyof DashboardContext['panels']) => void
  toggleSource: (source: IntelSource) => void
  openDial: (position: { x: number; y: number }) => void
  closeDial: () => void

  // Results setter (for external search integration)
  setSearchResults: (results: SearchResultItem[]) => void
}

const DashboardCtx = createContext<DashboardContextValue | null>(null)

// =============================================================================
// Provider Component
// =============================================================================

interface DashboardProviderProps {
  children: ReactNode
  /** Initial layout mode */
  initialLayout?: 'command' | 'focus' | 'grid'
  /** External search function */
  onSearch?: (bounds: BBox, sources: IntelSource[], query: string) => Promise<SearchResultItem[]>
  /** Called when selection changes */
  onSelectionChange?: (selection: string[]) => void
  /** Called when viewport changes */
  onViewportChange?: (viewport: ViewportState, bounds: BBox) => void
}

export function DashboardProvider({
  children,
  initialLayout = 'command',
  onSearch,
  onSelectionChange,
  onViewportChange,
}: DashboardProviderProps) {
  const [snapshot, send] = useMachine(dashboardMachine)

  const state = snapshot.context

  // Sync selection changes to callback
  useMemo(() => {
    onSelectionChange?.(state.selection)
  }, [state.selection, onSelectionChange])

  // Sync viewport changes to callback
  useMemo(() => {
    if (state.bounds) {
      onViewportChange?.(state.viewport, state.bounds)
    }
  }, [state.viewport, state.bounds, onViewportChange])

  // =============================================================================
  // Action Handlers
  // =============================================================================

  const search = useCallback(
    async (bounds: BBox, query?: string) => {
      if (query !== undefined) {
        send({ type: 'SET_QUERY', query })
      }
      send({ type: 'SEARCH', query })

      if (onSearch) {
        try {
          const results = await onSearch(bounds, state.sources, query ?? state.query)
          setResults(results)
          send({ type: 'SEARCH_SUCCESS', count: results.length })
        } catch (error) {
          send({ type: 'SEARCH_ERROR', error: String(error) })
        }
      }
    },
    [onSearch, send, state.sources, state.query]
  )

  const select = useCallback(
    (entityId: string) => {
      send({ type: 'SELECT', entityId })
      // Update selected entity atom
      const results = geointRegistry.get(resultsAtom)
      const entity = results.find((r) => r.id === entityId) ?? null
      selectResult(entity)
    },
    [send]
  )

  const toggleSelect = useCallback(
    (entityId: string) => {
      send({ type: 'TOGGLE_SELECT', entityId })
    },
    [send]
  )

  const multiSelect = useCallback(
    (entityIds: string[]) => {
      send({ type: 'MULTI_SELECT', entityIds })
    },
    [send]
  )

  const clearSelectionHandler = useCallback(() => {
    send({ type: 'CLEAR_SELECTION' })
    selectResult(null)
  }, [send])

  const setLayout = useCallback(
    (layout: 'command' | 'focus' | 'grid') => {
      send({ type: 'SET_LAYOUT', layout })
    },
    [send]
  )

  const togglePanel = useCallback(
    (panel: keyof DashboardContext['panels']) => {
      send({ type: 'TOGGLE_PANEL', panel })
    },
    [send]
  )

  const toggleSource = useCallback(
    (source: IntelSource) => {
      send({ type: 'TOGGLE_SOURCE', source })
    },
    [send]
  )

  const openDial = useCallback(
    (position: { x: number; y: number }) => {
      send({ type: 'OPEN_DIAL', position })
    },
    [send]
  )

  const closeDial = useCallback(() => {
    send({ type: 'CLOSE_DIAL' })
  }, [send])

  const setSearchResults = useCallback((results: SearchResultItem[]) => {
    setResults(results)
    send({ type: 'SEARCH_SUCCESS', count: results.length })
  }, [send])

  // Determine current state
  const currentState = snapshot.matches('searching')
    ? 'searching'
    : snapshot.matches('selecting')
      ? 'selecting'
      : 'idle'

  // =============================================================================
  // Context Value
  // =============================================================================

  const value = useMemo<DashboardContextValue>(
    () => ({
      state,
      send,
      isSearching: state.searchStatus === 'loading',
      hasSelection: state.selection.length > 0,
      selectionCount: state.selection.length,
      currentState,
      search,
      select,
      toggleSelect,
      multiSelect,
      clearSelection: clearSelectionHandler,
      setLayout,
      togglePanel,
      toggleSource,
      openDial,
      closeDial,
      setSearchResults,
    }),
    [
      state,
      send,
      currentState,
      search,
      select,
      toggleSelect,
      multiSelect,
      clearSelectionHandler,
      setLayout,
      togglePanel,
      toggleSource,
      openDial,
      closeDial,
      setSearchResults,
    ]
  )

  return (
    <DashboardCtx.Provider value={value}>
      {children}
    </DashboardCtx.Provider>
  )
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Access dashboard machine context and actions.
 * Must be used within DashboardProvider.
 */
export function useDashboard() {
  const ctx = useContext(DashboardCtx)
  if (!ctx) {
    throw new Error('useDashboard must be used within a DashboardProvider')
  }
  return ctx
}

/**
 * Access search results from atom.
 * Must be used within GeointRegistryProvider.
 */
export function useSearchResults() {
  return useAtomValue(resultsAtom)
}

/**
 * Access results grouped by source.
 * Must be used within GeointRegistryProvider.
 */
export function useResultsBySource() {
  return useAtomValue(resultsBySourceAtom)
}

/**
 * Access source counts for badges.
 * Must be used within GeointRegistryProvider.
 */
export function useSourceCounts() {
  return useAtomValue(sourceCountsAtom)
}

/**
 * Access selected entity data.
 * Must be used within GeointRegistryProvider.
 */
export function useSelectedEntity() {
  return useAtomValue(selectedResultAtom)
}

/**
 * Access and control layer visibility.
 * Must be used within GeointRegistryProvider.
 */
export function useLayerVisibility(): [LayerVisibility, (layer: keyof LayerVisibility) => void] {
  const visibility = useAtomValue(layerVisibilityAtom)
  // Use the action from atoms module for toggling
  const toggle = useCallback((layer: keyof LayerVisibility) => {
    toggleLayer(layer)
  }, [])
  return [visibility, toggle]
}

/**
 * Check if machine is in a specific state.
 * Must be used within DashboardProvider.
 */
export function useDashboardState() {
  const { currentState, isSearching, hasSelection } = useDashboard()
  return {
    isIdle: currentState === 'idle',
    isSearching,
    isSelecting: currentState === 'selecting',
    hasSelection,
  }
}
