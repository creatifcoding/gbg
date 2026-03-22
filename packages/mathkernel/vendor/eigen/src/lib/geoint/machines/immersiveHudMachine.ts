/**
 * Immersive HUD XState Machine
 *
 * State machine for orchestrating the immersive HUD overlay system:
 * - Overlay visibility and positioning
 * - Auto-hide behavior on inactivity
 * - Context-sensitive HUD elements
 * - Animation coordination
 * - Entity tracking mode
 *
 * @module geoint/machines/immersiveHudMachine
 */

import { setup, assign, emit, not } from 'xstate'

// =============================================================================
// TYPES
// =============================================================================

export type HudOverlay =
  | 'quickStats'
  | 'alerts'
  | 'entityInfo'
  | 'minimap'
  | 'timeline'
  | 'compass'
  | 'coordinates'

export type HudPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'

export type HudVisibility = 'visible' | 'dim' | 'hidden'

export interface OverlayState {
  visible: boolean
  position: HudPosition
  expanded: boolean
  opacity: number
  locked: boolean
}

export interface EntityTrackingState {
  entityId: string | null
  following: boolean
  showDetails: boolean
}

export interface ImmersiveHudContext {
  /** Overlay states keyed by overlay name */
  overlays: Record<HudOverlay, OverlayState>
  /** Global visibility mode */
  visibility: HudVisibility
  /** Entity currently being tracked */
  tracking: EntityTrackingState
  /** Auto-hide timeout (ms) */
  autoHideTimeout: number
  /** Whether user has interacted recently */
  userActive: boolean
  /** Cursor position for proximity-based visibility */
  cursorPosition: { x: number; y: number }
  /** Selected preset */
  activePreset: 'minimal' | 'standard' | 'detailed' | 'custom'
  /** Animation phase */
  animationPhase: 'idle' | 'showing' | 'hiding' | 'transitioning'
}

export type ImmersiveHudEvent =
  // Overlay control
  | { type: 'TOGGLE_OVERLAY'; overlay: HudOverlay }
  | { type: 'SHOW_OVERLAY'; overlay: HudOverlay }
  | { type: 'HIDE_OVERLAY'; overlay: HudOverlay }
  | { type: 'EXPAND_OVERLAY'; overlay: HudOverlay }
  | { type: 'COLLAPSE_OVERLAY'; overlay: HudOverlay }
  | { type: 'MOVE_OVERLAY'; overlay: HudOverlay; position: HudPosition }
  | { type: 'LOCK_OVERLAY'; overlay: HudOverlay }
  | { type: 'UNLOCK_OVERLAY'; overlay: HudOverlay }

  // Global visibility
  | { type: 'SHOW_ALL' }
  | { type: 'HIDE_ALL' }
  | { type: 'DIM_ALL' }
  | { type: 'SET_VISIBILITY'; visibility: HudVisibility }

  // Entity tracking
  | { type: 'TRACK_ENTITY'; entityId: string }
  | { type: 'STOP_TRACKING' }
  | { type: 'TOGGLE_FOLLOW' }
  | { type: 'TOGGLE_DETAILS' }

  // User activity
  | { type: 'USER_ACTIVITY' }
  | { type: 'CURSOR_MOVE'; x: number; y: number }
  | { type: 'IDLE_TIMEOUT' }

  // Presets
  | { type: 'APPLY_PRESET'; preset: 'minimal' | 'standard' | 'detailed' }

  // Animation
  | { type: 'ANIMATION_COMPLETE' }

  // Keyboard
  | { type: 'ESCAPE' }
  | { type: 'HOTKEY_TOGGLE'; overlay: HudOverlay }

export type ImmersiveHudEmittedEvent =
  | { type: 'onOverlayChange'; overlay: HudOverlay; state: OverlayState }
  | { type: 'onVisibilityChange'; visibility: HudVisibility }
  | { type: 'onTrackingChange'; tracking: EntityTrackingState }
  | { type: 'onPresetApply'; preset: string }

export interface ImmersiveHudInput {
  autoHideTimeout?: number
  initialPreset?: 'minimal' | 'standard' | 'detailed'
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_AUTO_HIDE_TIMEOUT = 5000

const DEFAULT_OVERLAY_STATE: OverlayState = {
  visible: true,
  position: 'top-left',
  expanded: false,
  opacity: 1,
  locked: false,
}

const PRESET_CONFIGS = {
  minimal: {
    quickStats: { visible: true, position: 'top-left' as const },
    alerts: { visible: false, position: 'top-right' as const },
    entityInfo: { visible: false, position: 'top-right' as const },
    minimap: { visible: false, position: 'bottom-left' as const },
    timeline: { visible: false, position: 'bottom-right' as const },
    compass: { visible: true, position: 'top-right' as const },
    coordinates: { visible: true, position: 'bottom-left' as const },
  },
  standard: {
    quickStats: { visible: true, position: 'top-left' as const },
    alerts: { visible: true, position: 'top-right' as const },
    entityInfo: { visible: true, position: 'top-right' as const },
    minimap: { visible: true, position: 'bottom-left' as const },
    timeline: { visible: true, position: 'bottom-right' as const },
    compass: { visible: true, position: 'top-right' as const },
    coordinates: { visible: true, position: 'bottom-left' as const },
  },
  detailed: {
    quickStats: { visible: true, position: 'top-left' as const, expanded: true },
    alerts: { visible: true, position: 'top-right' as const, expanded: true },
    entityInfo: { visible: true, position: 'top-right' as const, expanded: true },
    minimap: { visible: true, position: 'bottom-left' as const, expanded: true },
    timeline: { visible: true, position: 'bottom-right' as const },
    compass: { visible: true, position: 'top-right' as const },
    coordinates: { visible: true, position: 'bottom-left' as const },
  },
} as const

const ALL_OVERLAYS: HudOverlay[] = [
  'quickStats',
  'alerts',
  'entityInfo',
  'minimap',
  'timeline',
  'compass',
  'coordinates',
]

// =============================================================================
// HELPERS
// =============================================================================

function createInitialOverlays(): Record<HudOverlay, OverlayState> {
  return {
    quickStats: { ...DEFAULT_OVERLAY_STATE, position: 'top-left' },
    alerts: { ...DEFAULT_OVERLAY_STATE, position: 'top-right' },
    entityInfo: { ...DEFAULT_OVERLAY_STATE, position: 'top-right', visible: false },
    minimap: { ...DEFAULT_OVERLAY_STATE, position: 'bottom-left' },
    timeline: { ...DEFAULT_OVERLAY_STATE, position: 'bottom-right' },
    compass: { ...DEFAULT_OVERLAY_STATE, position: 'top-right' },
    coordinates: { ...DEFAULT_OVERLAY_STATE, position: 'bottom-left' },
  }
}

// =============================================================================
// MACHINE
// =============================================================================

export const immersiveHudMachine = setup({
  types: {
    context: {} as ImmersiveHudContext,
    events: {} as ImmersiveHudEvent,
    emitted: {} as ImmersiveHudEmittedEvent,
    input: {} as ImmersiveHudInput,
  },
  delays: {
    autoHideDelay: ({ context }) => context.autoHideTimeout,
  },
  actions: {
    // Overlay visibility
    toggleOverlay: assign(({ context, event }) => {
      if (event.type !== 'TOGGLE_OVERLAY' && event.type !== 'HOTKEY_TOGGLE') return {}
      const overlay = event.type === 'TOGGLE_OVERLAY' ? event.overlay : event.overlay
      return {
        overlays: {
          ...context.overlays,
          [overlay]: {
            ...context.overlays[overlay],
            visible: !context.overlays[overlay].visible,
          },
        },
        activePreset: 'custom' as const,
      }
    }),

    showOverlay: assign(({ context, event }) => {
      if (event.type !== 'SHOW_OVERLAY') return {}
      return {
        overlays: {
          ...context.overlays,
          [event.overlay]: {
            ...context.overlays[event.overlay],
            visible: true,
          },
        },
        activePreset: 'custom' as const,
      }
    }),

    hideOverlay: assign(({ context, event }) => {
      if (event.type !== 'HIDE_OVERLAY') return {}
      return {
        overlays: {
          ...context.overlays,
          [event.overlay]: {
            ...context.overlays[event.overlay],
            visible: false,
          },
        },
        activePreset: 'custom' as const,
      }
    }),

    expandOverlay: assign(({ context, event }) => {
      if (event.type !== 'EXPAND_OVERLAY') return {}
      return {
        overlays: {
          ...context.overlays,
          [event.overlay]: {
            ...context.overlays[event.overlay],
            expanded: true,
          },
        },
      }
    }),

    collapseOverlay: assign(({ context, event }) => {
      if (event.type !== 'COLLAPSE_OVERLAY') return {}
      return {
        overlays: {
          ...context.overlays,
          [event.overlay]: {
            ...context.overlays[event.overlay],
            expanded: false,
          },
        },
      }
    }),

    moveOverlay: assign(({ context, event }) => {
      if (event.type !== 'MOVE_OVERLAY') return {}
      return {
        overlays: {
          ...context.overlays,
          [event.overlay]: {
            ...context.overlays[event.overlay],
            position: event.position,
          },
        },
      }
    }),

    lockOverlay: assign(({ context, event }) => {
      if (event.type !== 'LOCK_OVERLAY') return {}
      return {
        overlays: {
          ...context.overlays,
          [event.overlay]: {
            ...context.overlays[event.overlay],
            locked: true,
          },
        },
      }
    }),

    unlockOverlay: assign(({ context, event }) => {
      if (event.type !== 'UNLOCK_OVERLAY') return {}
      return {
        overlays: {
          ...context.overlays,
          [event.overlay]: {
            ...context.overlays[event.overlay],
            locked: false,
          },
        },
      }
    }),

    // Global visibility
    setVisibilityVisible: assign({
      visibility: 'visible' as const,
      overlays: ({ context }) => {
        const updated = { ...context.overlays }
        for (const key of ALL_OVERLAYS) {
          if (!updated[key].locked) {
            updated[key] = { ...updated[key], opacity: 1 }
          }
        }
        return updated
      },
    }),

    setVisibilityDim: assign({
      visibility: 'dim' as const,
      overlays: ({ context }) => {
        const updated = { ...context.overlays }
        for (const key of ALL_OVERLAYS) {
          if (!updated[key].locked) {
            updated[key] = { ...updated[key], opacity: 0.3 }
          }
        }
        return updated
      },
    }),

    setVisibilityHidden: assign({
      visibility: 'hidden' as const,
      overlays: ({ context }) => {
        const updated = { ...context.overlays }
        for (const key of ALL_OVERLAYS) {
          if (!updated[key].locked) {
            updated[key] = { ...updated[key], opacity: 0 }
          }
        }
        return updated
      },
    }),

    // Entity tracking
    trackEntity: assign(({ context, event }) => {
      if (event.type !== 'TRACK_ENTITY') return {}
      return {
        tracking: {
          entityId: event.entityId,
          following: false,
          showDetails: true,
        },
        overlays: {
          ...context.overlays,
          entityInfo: { ...context.overlays.entityInfo, visible: true },
        },
      }
    }),

    stopTracking: assign({
      tracking: {
        entityId: null,
        following: false,
        showDetails: false,
      },
    }),

    toggleFollow: assign(({ context }) => ({
      tracking: {
        ...context.tracking,
        following: !context.tracking.following,
      },
    })),

    toggleDetails: assign(({ context }) => ({
      tracking: {
        ...context.tracking,
        showDetails: !context.tracking.showDetails,
      },
    })),

    // User activity
    markUserActive: assign({ userActive: true }),
    markUserInactive: assign({ userActive: false }),

    updateCursorPosition: assign(({ event }) => {
      if (event.type !== 'CURSOR_MOVE') return {}
      return {
        cursorPosition: { x: event.x, y: event.y },
        userActive: true,
      }
    }),

    // Presets
    applyPreset: assign(({ context, event }) => {
      if (event.type !== 'APPLY_PRESET') return {}
      const preset = PRESET_CONFIGS[event.preset]
      const overlays = { ...context.overlays }
      for (const [key, config] of Object.entries(preset)) {
        const overlay = key as HudOverlay
        overlays[overlay] = {
          ...overlays[overlay],
          visible: config.visible,
          position: config.position,
          expanded: 'expanded' in config ? config.expanded : false,
        }
      }
      return {
        overlays,
        activePreset: event.preset,
      }
    }),

    // Animation phases
    setShowingPhase: assign({ animationPhase: 'showing' as const }),
    setHidingPhase: assign({ animationPhase: 'hiding' as const }),
    setTransitioningPhase: assign({ animationPhase: 'transitioning' as const }),
    clearAnimationPhase: assign({ animationPhase: 'idle' as const }),

    // Emitters
    emitOverlayChange: emit(({ context, event }) => {
      const overlay =
        event.type === 'TOGGLE_OVERLAY' || event.type === 'SHOW_OVERLAY' || event.type === 'HIDE_OVERLAY'
          ? event.overlay
          : 'quickStats'
      return {
        type: 'onOverlayChange' as const,
        overlay,
        state: context.overlays[overlay],
      }
    }),

    emitVisibilityChange: emit(({ context }) => ({
      type: 'onVisibilityChange' as const,
      visibility: context.visibility,
    })),

    emitTrackingChange: emit(({ context }) => ({
      type: 'onTrackingChange' as const,
      tracking: context.tracking,
    })),

    emitPresetApply: emit(({ event }) => ({
      type: 'onPresetApply' as const,
      preset: event.type === 'APPLY_PRESET' ? event.preset : 'standard',
    })),
  },
  guards: {
    hasTrackedEntity: ({ context }) => context.tracking.entityId !== null,
    isUserActive: ({ context }) => context.userActive,
    isVisible: ({ context }) => context.visibility === 'visible',
    isDimmed: ({ context }) => context.visibility === 'dim',
    isHidden: ({ context }) => context.visibility === 'hidden',
  },
}).createMachine({
  id: 'immersiveHud',
  initial: 'active',
  context: ({ input }) => ({
    overlays: createInitialOverlays(),
    visibility: 'visible',
    tracking: {
      entityId: null,
      following: false,
      showDetails: false,
    },
    autoHideTimeout: input?.autoHideTimeout ?? DEFAULT_AUTO_HIDE_TIMEOUT,
    userActive: true,
    cursorPosition: { x: 0, y: 0 },
    activePreset: input?.initialPreset ?? 'standard',
    animationPhase: 'idle',
  }),
  states: {
    active: {
      initial: 'visible',
      states: {
        visible: {
          entry: ['setVisibilityVisible', 'emitVisibilityChange'],
          after: {
            autoHideDelay: {
              target: 'dimmed',
              guard: not('isUserActive'),
            },
          },
          on: {
            USER_ACTIVITY: {
              actions: 'markUserActive',
              target: '.', // Re-enter to reset timer
            },
            CURSOR_MOVE: {
              actions: 'updateCursorPosition',
            },
            DIM_ALL: {
              target: 'dimmed',
            },
            HIDE_ALL: {
              target: 'hidden',
            },
          },
        },
        dimmed: {
          entry: ['setVisibilityDim', 'emitVisibilityChange'],
          after: {
            autoHideDelay: {
              target: 'hidden',
              guard: not('isUserActive'),
            },
          },
          on: {
            USER_ACTIVITY: {
              target: 'visible',
              actions: 'markUserActive',
            },
            CURSOR_MOVE: {
              target: 'visible',
              actions: 'updateCursorPosition',
            },
            SHOW_ALL: {
              target: 'visible',
            },
            HIDE_ALL: {
              target: 'hidden',
            },
          },
        },
        hidden: {
          entry: ['setVisibilityHidden', 'emitVisibilityChange'],
          on: {
            USER_ACTIVITY: {
              target: 'visible',
              actions: 'markUserActive',
            },
            CURSOR_MOVE: {
              target: 'visible',
              actions: 'updateCursorPosition',
            },
            SHOW_ALL: {
              target: 'visible',
            },
            DIM_ALL: {
              target: 'dimmed',
            },
          },
        },
      },
      on: {
        // Overlay controls (available in any visibility state)
        TOGGLE_OVERLAY: {
          actions: ['toggleOverlay', 'emitOverlayChange'],
        },
        HOTKEY_TOGGLE: {
          actions: ['toggleOverlay', 'emitOverlayChange'],
        },
        SHOW_OVERLAY: {
          actions: ['showOverlay', 'emitOverlayChange'],
        },
        HIDE_OVERLAY: {
          actions: ['hideOverlay', 'emitOverlayChange'],
        },
        EXPAND_OVERLAY: {
          actions: 'expandOverlay',
        },
        COLLAPSE_OVERLAY: {
          actions: 'collapseOverlay',
        },
        MOVE_OVERLAY: {
          actions: 'moveOverlay',
        },
        LOCK_OVERLAY: {
          actions: 'lockOverlay',
        },
        UNLOCK_OVERLAY: {
          actions: 'unlockOverlay',
        },

        // Entity tracking
        TRACK_ENTITY: {
          actions: ['trackEntity', 'emitTrackingChange'],
        },
        STOP_TRACKING: {
          actions: ['stopTracking', 'emitTrackingChange'],
        },
        TOGGLE_FOLLOW: {
          guard: 'hasTrackedEntity',
          actions: ['toggleFollow', 'emitTrackingChange'],
        },
        TOGGLE_DETAILS: {
          guard: 'hasTrackedEntity',
          actions: ['toggleDetails', 'emitTrackingChange'],
        },

        // Presets
        APPLY_PRESET: {
          actions: ['applyPreset', 'emitPresetApply'],
        },

        // Escape closes tracking
        ESCAPE: {
          guard: 'hasTrackedEntity',
          actions: 'stopTracking',
        },
      },
    },
  },
})

// =============================================================================
// EXPORTS
// =============================================================================

export type ImmersiveHudMachine = typeof immersiveHudMachine
export type ImmersiveHudSnapshot = ReturnType<typeof immersiveHudMachine.getInitialSnapshot>
export { PRESET_CONFIGS, ALL_OVERLAYS }
