/**
 * GEOINT Dashboard State Machine
 *
 * XState v5 machine for managing dashboard-wide state including:
 * - Search flow (idle → searching → results)
 * - Selection mode (single, multi, area)
 * - Layout transitions (command, focus, grid)
 * - Panel visibility
 *
 * @module geoint/machines/dashboardMachine
 */

import { setup, assign } from 'xstate'
import type { ViewportState } from '../workspace/schemas'
import type { IntelSource, BBox } from '../schemas'

// =============================================================================
// Types
// =============================================================================

export interface DashboardContext {
  /** Current map viewport */
  viewport: ViewportState

  /** Selected entity IDs */
  selection: string[]

  /** Selection mode */
  selectionMode: 'single' | 'multi' | 'area'

  /** Active layout variant */
  layout: 'command' | 'focus' | 'grid'

  /** Search query */
  query: string

  /** Enabled source filters */
  sources: IntelSource[]

  /** Current viewport bounds for search */
  bounds: BBox | null

  /** Search status */
  searchStatus: 'idle' | 'loading' | 'success' | 'error'

  /** Search error message */
  searchError: string | null

  /** Search results (local cache for machine) */
  resultCount: number

  /** Panel visibility states */
  panels: {
    search: boolean
    entity: boolean
    intel: boolean
    layers: boolean
    timeline: boolean
  }

  /** Entity drawer open state (focus mode) */
  drawerOpen: boolean

  /** Radial dial visibility */
  dialOpen: boolean
  dialPosition: { x: number; y: number } | null
}

export type DashboardEvent =
  // Search events
  | { type: 'SEARCH'; query?: string }
  | { type: 'SEARCH_SUCCESS'; count: number }
  | { type: 'SEARCH_ERROR'; error: string }
  | { type: 'CLEAR_SEARCH' }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'TOGGLE_SOURCE'; source: IntelSource }

  // Viewport events
  | { type: 'VIEWPORT_CHANGE'; viewport: ViewportState; bounds: BBox }

  // Selection events
  | { type: 'SELECT'; entityId: string }
  | { type: 'MULTI_SELECT'; entityIds: string[] }
  | { type: 'TOGGLE_SELECT'; entityId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_SELECTION_MODE'; mode: 'single' | 'multi' | 'area' }

  // Layout events
  | { type: 'SET_LAYOUT'; layout: 'command' | 'focus' | 'grid' }
  | { type: 'TOGGLE_PANEL'; panel: keyof DashboardContext['panels'] }
  | { type: 'TOGGLE_DRAWER' }

  // Radial dial events
  | { type: 'OPEN_DIAL'; position: { x: number; y: number } }
  | { type: 'CLOSE_DIAL' }
  | { type: 'DIAL_ACTION'; action: string }

// =============================================================================
// Initial Context
// =============================================================================

const DEFAULT_VIEWPORT: ViewportState = {
  longitude: 0,
  latitude: 20,
  zoom: 2,
  pitch: 0,
  bearing: 0,
}

const initialContext: DashboardContext = {
  viewport: DEFAULT_VIEWPORT,
  selection: [],
  selectionMode: 'single',
  layout: 'command',
  query: '',
  sources: ['track', 'osm', 'opensky', 'feature'],
  bounds: null,
  searchStatus: 'idle',
  searchError: null,
  resultCount: 0,
  panels: {
    search: true,
    entity: false,
    intel: false,
    layers: true,
    timeline: false,
  },
  drawerOpen: false,
  dialOpen: false,
  dialPosition: null,
}

// =============================================================================
// Machine Definition
// =============================================================================

export const dashboardMachine = setup({
  types: {
    context: {} as DashboardContext,
    events: {} as DashboardEvent,
  },

  actions: {
    // Selection actions
    selectEntity: assign(({ context, event }) => {
      if (event.type !== 'SELECT') return context
      return {
        selection: [event.entityId],
        panels: { ...context.panels, entity: true },
      }
    }),

    toggleSelectEntity: assign(({ context, event }) => {
      if (event.type !== 'TOGGLE_SELECT') return context
      const { entityId } = event
      const exists = context.selection.includes(entityId)
      return {
        selection: exists
          ? context.selection.filter((id) => id !== entityId)
          : [...context.selection, entityId],
      }
    }),

    multiSelect: assign(({ context, event }) => {
      if (event.type !== 'MULTI_SELECT') return context
      return {
        selection: [...new Set([...context.selection, ...event.entityIds])],
      }
    }),

    clearSelection: assign({
      selection: [],
      panels: ({ context }) => ({ ...context.panels, entity: false }),
      dialOpen: false,
      dialPosition: null,
    }),

    setSelectionMode: assign(({ event }) => {
      if (event.type !== 'SET_SELECTION_MODE') return {}
      return { selectionMode: event.mode }
    }),

    // Search actions
    setQuery: assign(({ event }) => {
      if (event.type !== 'SET_QUERY') return {}
      return { query: event.query }
    }),

    toggleSource: assign(({ context, event }) => {
      if (event.type !== 'TOGGLE_SOURCE') return context
      const { source } = event
      const exists = context.sources.includes(source)
      return {
        sources: exists
          ? context.sources.filter((s) => s !== source)
          : [...context.sources, source],
      }
    }),

    setSearchLoading: assign({
      searchStatus: 'loading' as const,
      searchError: null,
    }),

    setSearchSuccess: assign(({ event }) => {
      if (event.type !== 'SEARCH_SUCCESS') return {}
      return {
        searchStatus: 'success' as const,
        resultCount: event.count,
      }
    }),

    setSearchError: assign(({ event }) => {
      if (event.type !== 'SEARCH_ERROR') return {}
      return {
        searchStatus: 'error' as const,
        searchError: event.error,
      }
    }),

    clearSearch: assign({
      query: '',
      searchStatus: 'idle' as const,
      searchError: null,
      resultCount: 0,
    }),

    // Viewport actions
    updateViewport: assign(({ event }) => {
      if (event.type !== 'VIEWPORT_CHANGE') return {}
      return {
        viewport: event.viewport,
        bounds: event.bounds,
      }
    }),

    // Layout actions
    setLayout: assign(({ context, event }) => {
      if (event.type !== 'SET_LAYOUT') return context
      // Reset panels based on layout
      const panels = { ...context.panels }
      if (event.layout === 'focus') {
        panels.search = false // Use floating search
        panels.entity = false // Use drawer
      } else if (event.layout === 'command') {
        panels.search = true
        panels.entity = context.selection.length > 0
      }
      return {
        layout: event.layout,
        panels,
        drawerOpen: false,
      }
    }),

    togglePanel: assign(({ context, event }) => {
      if (event.type !== 'TOGGLE_PANEL') return context
      return {
        panels: {
          ...context.panels,
          [event.panel]: !context.panels[event.panel],
        },
      }
    }),

    toggleDrawer: assign(({ context }) => ({
      drawerOpen: !context.drawerOpen,
    })),

    // Radial dial actions
    openDial: assign(({ event }) => {
      if (event.type !== 'OPEN_DIAL') return {}
      return {
        dialOpen: true,
        dialPosition: event.position,
      }
    }),

    closeDial: assign({
      dialOpen: false,
      dialPosition: null,
    }),
  },

  guards: {
    hasSelection: ({ context }) => context.selection.length > 0,
    isMultiSelectMode: ({ context }) => context.selectionMode === 'multi',
    isFocusLayout: ({ context }) => context.layout === 'focus',
    hasQuery: ({ context }) => context.query.trim().length > 0,
    hasBounds: ({ context }) => context.bounds !== null,
  },
}).createMachine({
  id: 'geointDashboard',
  initial: 'idle',
  context: initialContext,

  // Global event handlers
  on: {
    VIEWPORT_CHANGE: {
      actions: 'updateViewport',
    },
    SET_LAYOUT: {
      actions: 'setLayout',
    },
    TOGGLE_PANEL: {
      actions: 'togglePanel',
    },
    TOGGLE_DRAWER: {
      actions: 'toggleDrawer',
    },
    SET_QUERY: {
      actions: 'setQuery',
    },
    TOGGLE_SOURCE: {
      actions: 'toggleSource',
    },
    SET_SELECTION_MODE: {
      actions: 'setSelectionMode',
    },
  },

  states: {
    idle: {
      on: {
        SEARCH: {
          target: 'searching',
          actions: 'setSearchLoading',
        },
        SELECT: {
          target: 'selecting',
          actions: 'selectEntity',
        },
        MULTI_SELECT: {
          target: 'selecting',
          actions: 'multiSelect',
        },
        TOGGLE_SELECT: {
          target: 'selecting',
          actions: 'toggleSelectEntity',
        },
      },
    },

    searching: {
      on: {
        SEARCH_SUCCESS: {
          target: 'idle',
          actions: 'setSearchSuccess',
        },
        SEARCH_ERROR: {
          target: 'idle',
          actions: 'setSearchError',
        },
        // Allow selection during search
        SELECT: {
          target: 'selecting',
          actions: 'selectEntity',
        },
      },
    },

    selecting: {
      on: {
        SELECT: {
          actions: 'selectEntity',
        },
        MULTI_SELECT: {
          actions: 'multiSelect',
        },
        TOGGLE_SELECT: {
          actions: 'toggleSelectEntity',
        },
        CLEAR_SELECTION: {
          target: 'idle',
          actions: 'clearSelection',
        },
        SEARCH: {
          target: 'searching',
          actions: 'setSearchLoading',
        },
        OPEN_DIAL: {
          actions: 'openDial',
        },
        CLOSE_DIAL: {
          actions: 'closeDial',
        },
        DIAL_ACTION: {
          // Handle dial actions - could transition to action-specific states
        },
      },
    },
  },
})

// =============================================================================
// Type Exports
// =============================================================================

export type DashboardMachine = typeof dashboardMachine
export type DashboardSnapshot = ReturnType<typeof dashboardMachine.getInitialSnapshot>
