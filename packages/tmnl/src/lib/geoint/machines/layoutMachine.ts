/**
 * GEOINT Layout State Machine
 *
 * XState v5 machine for managing dashboard layout transitions:
 * - Three layout variants: command, focus, analytics
 * - Panel collapse/expand state
 * - Animation coordination between layouts
 * - Keyboard shortcut handling
 * - Layout persistence
 *
 * @module geoint/machines/layoutMachine
 */

import { setup, assign, type ActorRefFrom, type SnapshotFrom } from 'xstate'
import {
  type LayoutMode,
  type SidebarSection,
  type IntelTab,
  type TimelineRange,
  type FloatingPanelId,
  type FloatingPanelPosition,
  type FloatingPanelSize,
  // Atoms for sync
  layoutModeAtom,
  sidebarStateAtom,
  intelPanelStateAtom,
  timelineStateAtom,
  animationStateAtom,
  floatingPanelsAtom,
} from '../atoms/layoutAtoms'
import { geointRegistry } from '../atoms'

// =============================================================================
// Types
// =============================================================================

/** Panel collapse/expand state */
export interface PanelStates {
  readonly sidebar: {
    readonly collapsed: boolean
    readonly section: SidebarSection
  }
  readonly intel: {
    readonly collapsed: boolean
    readonly tab: IntelTab
  }
  readonly timeline: {
    readonly collapsed: boolean
    readonly range: TimelineRange
  }
}

/** Floating panel configuration (Focus Mode) */
export interface FloatingPanelConfig {
  readonly id: FloatingPanelId
  readonly visible: boolean
  readonly minimized: boolean
  readonly position: FloatingPanelPosition
  readonly size: FloatingPanelSize
  readonly zIndex: number
}

/** Animation phase for transition orchestration */
export type AnimationPhase =
  | 'idle'
  | 'exit_panels'
  | 'transition_layout'
  | 'enter_panels'
  | 'complete'

/** Layout machine context */
export interface LayoutContext {
  /** Current layout mode */
  readonly currentLayout: LayoutMode
  /** Previous layout (for transition animation) */
  readonly previousLayout: LayoutMode | null
  /** Panel states */
  readonly panels: PanelStates
  /** Floating panels (Focus mode) */
  readonly floatingPanels: Record<FloatingPanelId, FloatingPanelConfig>
  /** Current animation phase */
  readonly animationPhase: AnimationPhase
  /** Animation in progress flag */
  readonly isAnimating: boolean
  /** Maximum floating panel z-index */
  readonly maxZIndex: number
}

/** Layout events */
export type LayoutEvent =
  // Layout switching
  | { type: 'SET_LAYOUT'; layout: LayoutMode }
  | { type: 'TOGGLE_LAYOUT' } // Cycle through layouts

  // Animation coordination
  | { type: 'ANIMATION_PHASE'; phase: AnimationPhase }
  | { type: 'ANIMATION_COMPLETE' }

  // Sidebar events
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_SECTION'; section: SidebarSection }
  | { type: 'EXPAND_SIDEBAR' }
  | { type: 'COLLAPSE_SIDEBAR' }

  // Intel panel events
  | { type: 'TOGGLE_INTEL' }
  | { type: 'SET_INTEL_TAB'; tab: IntelTab }
  | { type: 'EXPAND_INTEL' }
  | { type: 'COLLAPSE_INTEL' }

  // Timeline events
  | { type: 'TOGGLE_TIMELINE' }
  | { type: 'SET_TIMELINE_RANGE'; range: TimelineRange }
  | { type: 'EXPAND_TIMELINE' }
  | { type: 'COLLAPSE_TIMELINE' }

  // Floating panel events (Focus mode)
  | { type: 'MOVE_PANEL'; id: FloatingPanelId; position: FloatingPanelPosition }
  | { type: 'RESIZE_PANEL'; id: FloatingPanelId; size: Partial<FloatingPanelSize> }
  | { type: 'TOGGLE_PANEL_VISIBILITY'; id: FloatingPanelId }
  | { type: 'TOGGLE_PANEL_MINIMIZE'; id: FloatingPanelId }
  | { type: 'BRING_PANEL_TO_FRONT'; id: FloatingPanelId }

  // Keyboard shortcuts
  | { type: 'KEYBOARD_SHORTCUT'; key: string; modifiers: { meta?: boolean; ctrl?: boolean; shift?: boolean } }

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_PANELS: PanelStates = {
  sidebar: {
    collapsed: false,
    section: 'search',
  },
  intel: {
    collapsed: false,
    tab: 'results',
  },
  timeline: {
    collapsed: true,
    range: '24h',
  },
}

const DEFAULT_FLOATING_PANELS: Record<FloatingPanelId, FloatingPanelConfig> = {
  layers: {
    id: 'layers',
    visible: true,
    minimized: false,
    position: { x: 16, y: 80 },
    size: { width: 200, height: 300 },
    zIndex: 1,
  },
  entity: {
    id: 'entity',
    visible: true,
    minimized: false,
    position: { x: -396, y: 80 },
    size: { width: 380, height: 400 },
    zIndex: 2,
  },
  timeline: {
    id: 'timeline',
    visible: true,
    minimized: false,
    position: { x: 32, y: -120 },
    size: { width: 800, height: 80 },
    zIndex: 3,
  },
  search: {
    id: 'search',
    visible: false,
    minimized: false,
    position: { x: 0, y: 80 },
    size: { width: 400, height: 48 },
    zIndex: 10,
  },
}

const initialContext: LayoutContext = {
  currentLayout: 'command',
  previousLayout: null,
  panels: DEFAULT_PANELS,
  floatingPanels: DEFAULT_FLOATING_PANELS,
  animationPhase: 'idle',
  isAnimating: false,
  maxZIndex: 10,
}

// =============================================================================
// Helpers
// =============================================================================

const LAYOUT_CYCLE: LayoutMode[] = ['command', 'focus', 'analytics']

function getNextLayout(current: LayoutMode): LayoutMode {
  const idx = LAYOUT_CYCLE.indexOf(current)
  return LAYOUT_CYCLE[(idx + 1) % LAYOUT_CYCLE.length]
}

function persistLayout(layout: LayoutMode): void {
  try {
    localStorage.setItem('geoint-layout', layout)
  } catch {
    // Ignore storage errors
  }
}

function loadPersistedLayout(): LayoutMode | null {
  try {
    const stored = localStorage.getItem('geoint-layout')
    if (stored && LAYOUT_CYCLE.includes(stored as LayoutMode)) {
      return stored as LayoutMode
    }
  } catch {
    // Ignore storage errors
  }
  return null
}

// =============================================================================
// Machine Definition
// =============================================================================

export const layoutMachine = setup({
  types: {
    context: {} as LayoutContext,
    events: {} as LayoutEvent,
  },

  guards: {
    isCommandLayout: ({ event }) =>
      event.type === 'SET_LAYOUT' && event.layout === 'command',
    isFocusLayout: ({ event }) =>
      event.type === 'SET_LAYOUT' && event.layout === 'focus',
    isAnalyticsLayout: ({ event }) =>
      event.type === 'SET_LAYOUT' && event.layout === 'analytics',
    isSameLayout: ({ context, event }) =>
      event.type === 'SET_LAYOUT' && event.layout === context.currentLayout,
    isNotAnimating: ({ context }) => !context.isAnimating,
  },

  actions: {
    // Layout transition actions
    startTransition: assign(({ context, event }) => {
      if (event.type !== 'SET_LAYOUT') return {}
      return {
        previousLayout: context.currentLayout,
        currentLayout: event.layout,
        animationPhase: 'exit_panels' as AnimationPhase,
        isAnimating: true,
      }
    }),

    cycleLayout: assign(({ context }) => {
      const nextLayout = getNextLayout(context.currentLayout)
      return {
        previousLayout: context.currentLayout,
        currentLayout: nextLayout,
        animationPhase: 'exit_panels' as AnimationPhase,
        isAnimating: true,
      }
    }),

    setAnimationPhase: assign(({ event }) => {
      if (event.type !== 'ANIMATION_PHASE') return {}
      return {
        animationPhase: event.phase,
      }
    }),

    completeTransition: assign({
      animationPhase: 'idle' as AnimationPhase,
      isAnimating: false,
      previousLayout: null,
    }),

    persistCurrentLayout: ({ context }) => {
      persistLayout(context.currentLayout)
    },

    // Sidebar actions
    toggleSidebar: assign(({ context }) => ({
      panels: {
        ...context.panels,
        sidebar: {
          ...context.panels.sidebar,
          collapsed: !context.panels.sidebar.collapsed,
        },
      },
    })),

    expandSidebar: assign(({ context }) => ({
      panels: {
        ...context.panels,
        sidebar: { ...context.panels.sidebar, collapsed: false },
      },
    })),

    collapseSidebar: assign(({ context }) => ({
      panels: {
        ...context.panels,
        sidebar: { ...context.panels.sidebar, collapsed: true },
      },
    })),

    setSidebarSection: assign(({ context, event }) => {
      if (event.type !== 'SET_SIDEBAR_SECTION') return {}
      return {
        panels: {
          ...context.panels,
          sidebar: {
            ...context.panels.sidebar,
            section: event.section,
            collapsed: false, // Expand when selecting section
          },
        },
      }
    }),

    // Intel panel actions
    toggleIntel: assign(({ context }) => ({
      panels: {
        ...context.panels,
        intel: {
          ...context.panels.intel,
          collapsed: !context.panels.intel.collapsed,
        },
      },
    })),

    expandIntel: assign(({ context }) => ({
      panels: {
        ...context.panels,
        intel: { ...context.panels.intel, collapsed: false },
      },
    })),

    collapseIntel: assign(({ context }) => ({
      panels: {
        ...context.panels,
        intel: { ...context.panels.intel, collapsed: true },
      },
    })),

    setIntelTab: assign(({ context, event }) => {
      if (event.type !== 'SET_INTEL_TAB') return {}
      return {
        panels: {
          ...context.panels,
          intel: {
            ...context.panels.intel,
            tab: event.tab,
            collapsed: false, // Expand when selecting tab
          },
        },
      }
    }),

    // Timeline actions
    toggleTimeline: assign(({ context }) => ({
      panels: {
        ...context.panels,
        timeline: {
          ...context.panels.timeline,
          collapsed: !context.panels.timeline.collapsed,
        },
      },
    })),

    expandTimeline: assign(({ context }) => ({
      panels: {
        ...context.panels,
        timeline: { ...context.panels.timeline, collapsed: false },
      },
    })),

    collapseTimeline: assign(({ context }) => ({
      panels: {
        ...context.panels,
        timeline: { ...context.panels.timeline, collapsed: true },
      },
    })),

    setTimelineRange: assign(({ context, event }) => {
      if (event.type !== 'SET_TIMELINE_RANGE') return {}
      return {
        panels: {
          ...context.panels,
          timeline: {
            ...context.panels.timeline,
            range: event.range,
          },
        },
      }
    }),

    // Floating panel actions
    movePanel: assign(({ context, event }) => {
      if (event.type !== 'MOVE_PANEL') return {}
      const panel = context.floatingPanels[event.id]
      if (!panel) return {}
      return {
        floatingPanels: {
          ...context.floatingPanels,
          [event.id]: { ...panel, position: event.position },
        },
      }
    }),

    resizePanel: assign(({ context, event }) => {
      if (event.type !== 'RESIZE_PANEL') return {}
      const panel = context.floatingPanels[event.id]
      if (!panel) return {}
      return {
        floatingPanels: {
          ...context.floatingPanels,
          [event.id]: { ...panel, size: { ...panel.size, ...event.size } },
        },
      }
    }),

    togglePanelVisibility: assign(({ context, event }) => {
      if (event.type !== 'TOGGLE_PANEL_VISIBILITY') return {}
      const panel = context.floatingPanels[event.id]
      if (!panel) return {}
      return {
        floatingPanels: {
          ...context.floatingPanels,
          [event.id]: { ...panel, visible: !panel.visible },
        },
      }
    }),

    togglePanelMinimize: assign(({ context, event }) => {
      if (event.type !== 'TOGGLE_PANEL_MINIMIZE') return {}
      const panel = context.floatingPanels[event.id]
      if (!panel) return {}
      return {
        floatingPanels: {
          ...context.floatingPanels,
          [event.id]: { ...panel, minimized: !panel.minimized },
        },
      }
    }),

    bringPanelToFront: assign(({ context, event }) => {
      if (event.type !== 'BRING_PANEL_TO_FRONT') return {}
      const panel = context.floatingPanels[event.id]
      if (!panel) return {}
      const newZIndex = context.maxZIndex + 1
      return {
        maxZIndex: newZIndex,
        floatingPanels: {
          ...context.floatingPanels,
          [event.id]: { ...panel, zIndex: newZIndex },
        },
      }
    }),

    // Keyboard shortcut handler
    handleKeyboardShortcut: assign(({ context, event }) => {
      if (event.type !== 'KEYBOARD_SHORTCUT') return {}
      const { key, modifiers } = event

      // Meta+1/2/3 = Layout switching
      if (modifiers.meta) {
        if (key === '1') return { currentLayout: 'command' as LayoutMode }
        if (key === '2') return { currentLayout: 'focus' as LayoutMode }
        if (key === '3') return { currentLayout: 'analytics' as LayoutMode }

        // Meta+B = Toggle sidebar
        if (key === 'b') {
          return {
            panels: {
              ...context.panels,
              sidebar: { ...context.panels.sidebar, collapsed: !context.panels.sidebar.collapsed },
            },
          }
        }

        // Meta+E = Toggle intel panel
        if (key === 'e') {
          return {
            panels: {
              ...context.panels,
              intel: { ...context.panels.intel, collapsed: !context.panels.intel.collapsed },
            },
          }
        }

        // Meta+T = Toggle timeline
        if (key === 't') {
          return {
            panels: {
              ...context.panels,
              timeline: { ...context.panels.timeline, collapsed: !context.panels.timeline.collapsed },
            },
          }
        }
      }

      return {}
    }),

    // =========================================================================
    // Atom Sync Actions (XState → Atoms)
    // =========================================================================

    /**
     * Sync layout mode to atoms.
     * Called on state entry to keep atoms in sync with machine state.
     */
    syncLayoutAtom: ({ context }) => {
      geointRegistry.set(layoutModeAtom, context.currentLayout)
      geointRegistry.set(animationStateAtom, {
        phase: context.animationPhase === 'exit_panels' ? 'exit'
             : context.animationPhase === 'enter_panels' ? 'enter'
             : context.animationPhase === 'transition_layout' ? 'transition'
             : 'idle',
        previousLayout: context.previousLayout,
        staggerIndex: 0,
        isAnimating: context.isAnimating,
      })
    },

    /**
     * Sync panel states to atoms.
     * Called after panel state changes.
     */
    syncPanelAtoms: ({ context }) => {
      // Sync sidebar
      const currentSidebar = geointRegistry.get(sidebarStateAtom)
      geointRegistry.set(sidebarStateAtom, {
        ...currentSidebar,
        collapsed: context.panels.sidebar.collapsed,
        activeSection: context.panels.sidebar.section,
      })

      // Sync intel panel
      const currentIntel = geointRegistry.get(intelPanelStateAtom)
      geointRegistry.set(intelPanelStateAtom, {
        ...currentIntel,
        collapsed: context.panels.intel.collapsed,
        activeTab: context.panels.intel.tab,
      })

      // Sync timeline
      const currentTimeline = geointRegistry.get(timelineStateAtom)
      geointRegistry.set(timelineStateAtom, {
        ...currentTimeline,
        collapsed: context.panels.timeline.collapsed,
        range: context.panels.timeline.range,
      })
    },

    /**
     * Sync floating panels to atoms.
     * Called after floating panel changes in focus mode.
     */
    syncFloatingPanelAtoms: ({ context }) => {
      const atomPanels = geointRegistry.get(floatingPanelsAtom)
      const updatedPanels = { ...atomPanels }

      for (const [id, panel] of Object.entries(context.floatingPanels)) {
        const panelId = id as FloatingPanelId
        if (atomPanels[panelId]) {
          updatedPanels[panelId] = {
            ...atomPanels[panelId],
            visible: panel.visible,
            minimized: panel.minimized,
            position: panel.position,
            size: panel.size,
            zIndex: panel.zIndex,
          }
        }
      }

      geointRegistry.set(floatingPanelsAtom, updatedPanels)
    },
  },
}).createMachine({
  id: 'layout',
  initial: 'command',
  context: initialContext,

  states: {
    command: {
      entry: ['persistCurrentLayout', 'syncLayoutAtom', 'syncPanelAtoms'],
      on: {
        SET_LAYOUT: [
          { guard: 'isSameLayout' },
          { guard: 'isFocusLayout', target: 'transitioning', actions: 'startTransition' },
          { guard: 'isAnalyticsLayout', target: 'transitioning', actions: 'startTransition' },
        ],
        TOGGLE_LAYOUT: { target: 'transitioning', actions: 'cycleLayout' },
        TOGGLE_SIDEBAR: { actions: 'toggleSidebar' },
        EXPAND_SIDEBAR: { actions: 'expandSidebar' },
        COLLAPSE_SIDEBAR: { actions: 'collapseSidebar' },
        SET_SIDEBAR_SECTION: { actions: 'setSidebarSection' },
        TOGGLE_INTEL: { actions: 'toggleIntel' },
        EXPAND_INTEL: { actions: 'expandIntel' },
        COLLAPSE_INTEL: { actions: 'collapseIntel' },
        SET_INTEL_TAB: { actions: 'setIntelTab' },
        TOGGLE_TIMELINE: { actions: 'toggleTimeline' },
        EXPAND_TIMELINE: { actions: 'expandTimeline' },
        COLLAPSE_TIMELINE: { actions: 'collapseTimeline' },
        SET_TIMELINE_RANGE: { actions: 'setTimelineRange' },
        KEYBOARD_SHORTCUT: { actions: 'handleKeyboardShortcut' },
      },
    },

    focus: {
      entry: ['persistCurrentLayout', 'syncLayoutAtom', 'syncFloatingPanelAtoms'],
      on: {
        SET_LAYOUT: [
          { guard: 'isSameLayout' },
          { guard: 'isCommandLayout', target: 'transitioning', actions: 'startTransition' },
          { guard: 'isAnalyticsLayout', target: 'transitioning', actions: 'startTransition' },
        ],
        TOGGLE_LAYOUT: { target: 'transitioning', actions: 'cycleLayout' },
        // Floating panel events
        MOVE_PANEL: { actions: 'movePanel' },
        RESIZE_PANEL: { actions: 'resizePanel' },
        TOGGLE_PANEL_VISIBILITY: { actions: 'togglePanelVisibility' },
        TOGGLE_PANEL_MINIMIZE: { actions: 'togglePanelMinimize' },
        BRING_PANEL_TO_FRONT: { actions: 'bringPanelToFront' },
        KEYBOARD_SHORTCUT: { actions: 'handleKeyboardShortcut' },
      },
    },

    analytics: {
      entry: ['persistCurrentLayout', 'syncLayoutAtom', 'syncPanelAtoms'],
      on: {
        SET_LAYOUT: [
          { guard: 'isSameLayout' },
          { guard: 'isCommandLayout', target: 'transitioning', actions: 'startTransition' },
          { guard: 'isFocusLayout', target: 'transitioning', actions: 'startTransition' },
        ],
        TOGGLE_LAYOUT: { target: 'transitioning', actions: 'cycleLayout' },
        TOGGLE_SIDEBAR: { actions: 'toggleSidebar' },
        TOGGLE_INTEL: { actions: 'toggleIntel' },
        TOGGLE_TIMELINE: { actions: 'toggleTimeline' },
        KEYBOARD_SHORTCUT: { actions: 'handleKeyboardShortcut' },
      },
    },

    transitioning: {
      on: {
        ANIMATION_PHASE: { actions: 'setAnimationPhase' },
        ANIMATION_COMPLETE: [
          {
            guard: ({ context }) => context.currentLayout === 'command',
            target: 'command',
            actions: 'completeTransition',
          },
          {
            guard: ({ context }) => context.currentLayout === 'focus',
            target: 'focus',
            actions: 'completeTransition',
          },
          {
            guard: ({ context }) => context.currentLayout === 'analytics',
            target: 'analytics',
            actions: 'completeTransition',
          },
        ],
      },
      after: {
        // Auto-complete transition after 500ms (safety fallback)
        500: [
          {
            guard: ({ context }) => context.currentLayout === 'command',
            target: 'command',
            actions: 'completeTransition',
          },
          {
            guard: ({ context }) => context.currentLayout === 'focus',
            target: 'focus',
            actions: 'completeTransition',
          },
          {
            target: 'analytics',
            actions: 'completeTransition',
          },
        ],
      },
    },
  },
})

// =============================================================================
// Type Exports
// =============================================================================

export type LayoutMachineRef = ActorRefFrom<typeof layoutMachine>
export type LayoutMachineSnapshot = SnapshotFrom<typeof layoutMachine>

/**
 * Load initial layout from localStorage.
 */
export function getInitialLayoutContext(): LayoutContext {
  const persisted = loadPersistedLayout()
  return persisted ? { ...initialContext, currentLayout: persisted } : initialContext
}
