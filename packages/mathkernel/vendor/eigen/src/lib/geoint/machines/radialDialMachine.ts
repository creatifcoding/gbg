/**
 * Radial Command Dial XState Machine
 *
 * State machine for radial menu orchestration:
 * - Open/close state with animations
 * - Hover/selection state tracking
 * - Gesture recognition (long-press, drag)
 * - Keyboard navigation
 * - Section focusing
 *
 * @module geoint/machines/radialDialMachine
 */

import { setup, assign, emit } from 'xstate'

// =============================================================================
// TYPES
// =============================================================================

export type DialSection = 'navigation' | 'primary' | 'secondary' | 'danger'

export type GestureType = 'click' | 'longPress' | 'drag'

export interface DialPosition {
  x: number
  y: number
}

export interface RadialDialContext {
  /** Position of the dial center */
  position: DialPosition
  /** Entity ID the dial is for */
  entityId: string | null
  /** Currently hovered action ID */
  hoveredActionId: string | null
  /** Focused section (for keyboard nav) */
  focusedSection: DialSection | null
  /** Focused action index within section */
  focusedActionIndex: number
  /** Gesture that opened the dial */
  openGesture: GestureType
  /** Animation phase */
  animationPhase: 'idle' | 'opening' | 'closing' | 'selecting'
  /** Long press timer started */
  longPressStartTime: number | null
  /** Drag start position */
  dragStartPosition: DialPosition | null
  /** Current drag position */
  dragCurrentPosition: DialPosition | null
  /** Thresholds from input */
  longPressThreshold: number
  dragThreshold: number
}

export type RadialDialEvent =
  // Open/close events
  | { type: 'OPEN'; entityId: string; position: DialPosition; gesture?: GestureType }
  | { type: 'CLOSE' }
  | { type: 'CLOSE_WITH_SELECTION'; actionId: string }

  // Hover events
  | { type: 'HOVER_ACTION'; actionId: string }
  | { type: 'UNHOVER' }

  // Keyboard navigation
  | { type: 'NAV_NEXT_SECTION' }
  | { type: 'NAV_PREV_SECTION' }
  | { type: 'NAV_NEXT_ACTION' }
  | { type: 'NAV_PREV_ACTION' }
  | { type: 'SELECT_FOCUSED' }
  | { type: 'ESCAPE' }

  // Gesture events
  | { type: 'POINTER_DOWN'; position: DialPosition; entityId: string }
  | { type: 'POINTER_MOVE'; position: DialPosition }
  | { type: 'POINTER_UP'; position: DialPosition }
  | { type: 'LONG_PRESS_DETECTED' }

  // Animation
  | { type: 'ANIMATION_COMPLETE' }

export type RadialDialEmittedEvent =
  | { type: 'onOpen'; entityId: string; position: DialPosition }
  | { type: 'onClose' }
  | { type: 'onActionSelect'; actionId: string; entityId: string }
  | { type: 'onHover'; actionId: string | null }
  | { type: 'onGestureDetected'; gesture: GestureType }

export interface RadialDialInput {
  longPressThreshold?: number // ms
  dragThreshold?: number // pixels
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const SECTION_ORDER: readonly DialSection[] = [
  'navigation',
  'primary',
  'secondary',
  'danger',
]

const DEFAULT_LONG_PRESS_THRESHOLD = 500 // ms
const DEFAULT_DRAG_THRESHOLD = 10 // pixels

// =============================================================================
// HELPERS
// =============================================================================

function getDistance(p1: DialPosition, p2: DialPosition): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
}

// =============================================================================
// MACHINE
// =============================================================================

export const radialDialMachine = setup({
  types: {
    context: {} as RadialDialContext,
    events: {} as RadialDialEvent,
    emitted: {} as RadialDialEmittedEvent,
    input: {} as RadialDialInput,
  },
  delays: {
    longPressDelay: ({ context }) => context.longPressThreshold,
  },
  actions: {
    // Position and entity
    setDialPosition: assign(({ event }) => {
      if (event.type !== 'OPEN') return {}
      return {
        position: event.position,
        entityId: event.entityId,
        openGesture: event.gesture ?? 'click',
      }
    }),

    clearDialState: assign({
      entityId: null,
      hoveredActionId: null,
      focusedSection: null,
      focusedActionIndex: 0,
      longPressStartTime: null,
      dragStartPosition: null,
      dragCurrentPosition: null,
    }),

    // Hover
    setHoveredAction: assign(({ event }) => {
      if (event.type !== 'HOVER_ACTION') return {}
      return { hoveredActionId: event.actionId }
    }),

    clearHover: assign({ hoveredActionId: null }),

    // Keyboard navigation
    focusNextSection: assign(({ context }) => {
      const currentIndex = context.focusedSection
        ? SECTION_ORDER.indexOf(context.focusedSection)
        : -1
      const nextIndex = (currentIndex + 1) % SECTION_ORDER.length
      return {
        focusedSection: SECTION_ORDER[nextIndex],
        focusedActionIndex: 0,
      }
    }),

    focusPrevSection: assign(({ context }) => {
      const currentIndex = context.focusedSection
        ? SECTION_ORDER.indexOf(context.focusedSection)
        : 0
      const prevIndex = (currentIndex - 1 + SECTION_ORDER.length) % SECTION_ORDER.length
      return {
        focusedSection: SECTION_ORDER[prevIndex],
        focusedActionIndex: 0,
      }
    }),

    focusNextAction: assign(({ context }) => ({
      focusedActionIndex: context.focusedActionIndex + 1,
    })),

    focusPrevAction: assign(({ context }) => ({
      focusedActionIndex: Math.max(0, context.focusedActionIndex - 1),
    })),

    // Gesture tracking
    startLongPress: assign(({ event }) => {
      if (event.type !== 'POINTER_DOWN') return {}
      return {
        longPressStartTime: Date.now(),
        dragStartPosition: event.position,
      }
    }),

    updateDragPosition: assign(({ event }) => {
      if (event.type !== 'POINTER_MOVE') return {}
      return { dragCurrentPosition: event.position }
    }),

    clearGestureTracking: assign({
      longPressStartTime: null,
      dragStartPosition: null,
      dragCurrentPosition: null,
    }),

    // Animation
    setOpeningPhase: assign({ animationPhase: 'opening' as const }),
    setClosingPhase: assign({ animationPhase: 'closing' as const }),
    setSelectingPhase: assign({ animationPhase: 'selecting' as const }),
    clearAnimationPhase: assign({ animationPhase: 'idle' as const }),

    // Emitters
    emitOpen: emit(({ context }) => ({
      type: 'onOpen' as const,
      entityId: context.entityId ?? '',
      position: context.position,
    })),

    emitClose: emit({
      type: 'onClose' as const,
    }),

    emitActionSelect: emit(({ context, event }) => {
      const actionId = event.type === 'CLOSE_WITH_SELECTION' ? event.actionId : ''
      return {
        type: 'onActionSelect' as const,
        actionId,
        entityId: context.entityId ?? '',
      }
    }),

    emitHover: emit(({ context }) => ({
      type: 'onHover' as const,
      actionId: context.hoveredActionId,
    })),

    emitGestureDetected: emit(({ context }) => ({
      type: 'onGestureDetected' as const,
      gesture: context.openGesture,
    })),
  },
  guards: {
    hasEntity: ({ context }) => context.entityId !== null,
    isDragGesture: ({ context }) => {
      if (!context.dragStartPosition || !context.dragCurrentPosition) return false
      return getDistance(context.dragStartPosition, context.dragCurrentPosition) > context.dragThreshold
    },
    hasFocusedSection: ({ context }) => context.focusedSection !== null,
  },
}).createMachine({
  id: 'radialDial',
  initial: 'closed',
  context: ({ input }) => ({
    position: { x: 0, y: 0 },
    entityId: null,
    hoveredActionId: null,
    focusedSection: null,
    focusedActionIndex: 0,
    openGesture: 'click' as GestureType,
    animationPhase: 'idle' as const,
    longPressStartTime: null,
    dragStartPosition: null,
    dragCurrentPosition: null,
    longPressThreshold: input?.longPressThreshold ?? DEFAULT_LONG_PRESS_THRESHOLD,
    dragThreshold: input?.dragThreshold ?? DEFAULT_DRAG_THRESHOLD,
  }),
  states: {
    closed: {
      on: {
        OPEN: {
          target: 'opening',
          actions: ['setDialPosition', 'setOpeningPhase'],
        },
        POINTER_DOWN: {
          target: 'detectingGesture',
          actions: 'startLongPress',
        },
      },
    },

    detectingGesture: {
      after: {
        longPressDelay: {
          target: 'opening',
          actions: [
            assign({ openGesture: 'longPress' as GestureType }),
            'setOpeningPhase',
            'emitGestureDetected',
          ],
        },
      },
      on: {
        POINTER_MOVE: [
          {
            guard: 'isDragGesture',
            target: 'dragging',
            actions: [
              assign({ openGesture: 'drag' as GestureType }),
              'updateDragPosition',
              'emitGestureDetected',
            ],
          },
          {
            actions: 'updateDragPosition',
          },
        ],
        POINTER_UP: {
          target: 'closed',
          actions: 'clearGestureTracking',
        },
      },
    },

    dragging: {
      on: {
        POINTER_MOVE: {
          actions: 'updateDragPosition',
        },
        POINTER_UP: {
          target: 'opening',
          actions: [
            assign(({ context, event }) => {
              if (event.type !== 'POINTER_UP') return {}
              return {
                position: event.position,
                entityId: context.entityId,
              }
            }),
            'setOpeningPhase',
          ],
        },
      },
    },

    opening: {
      entry: 'emitOpen',
      after: {
        200: {
          target: 'open',
          actions: 'clearAnimationPhase',
        },
      },
      on: {
        CLOSE: {
          target: 'closing',
          actions: 'setClosingPhase',
        },
        ANIMATION_COMPLETE: {
          target: 'open',
          actions: 'clearAnimationPhase',
        },
      },
    },

    open: {
      on: {
        CLOSE: {
          target: 'closing',
          actions: 'setClosingPhase',
        },
        CLOSE_WITH_SELECTION: {
          target: 'selecting',
          actions: ['setSelectingPhase', 'emitActionSelect'],
        },
        ESCAPE: {
          target: 'closing',
          actions: 'setClosingPhase',
        },
        HOVER_ACTION: {
          actions: ['setHoveredAction', 'emitHover'],
        },
        UNHOVER: {
          actions: ['clearHover', 'emitHover'],
        },
        NAV_NEXT_SECTION: {
          actions: 'focusNextSection',
        },
        NAV_PREV_SECTION: {
          actions: 'focusPrevSection',
        },
        NAV_NEXT_ACTION: {
          actions: 'focusNextAction',
        },
        NAV_PREV_ACTION: {
          actions: 'focusPrevAction',
        },
        SELECT_FOCUSED: {
          guard: 'hasFocusedSection',
          target: 'selecting',
          actions: 'setSelectingPhase',
        },
      },
    },

    selecting: {
      entry: 'emitActionSelect',
      after: {
        150: {
          target: 'closing',
          actions: 'setClosingPhase',
        },
      },
    },

    closing: {
      entry: 'emitClose',
      after: {
        200: {
          target: 'closed',
          actions: ['clearDialState', 'clearAnimationPhase', 'clearGestureTracking'],
        },
      },
      on: {
        ANIMATION_COMPLETE: {
          target: 'closed',
          actions: ['clearDialState', 'clearAnimationPhase', 'clearGestureTracking'],
        },
      },
    },
  },
})

// =============================================================================
// EXPORTS
// =============================================================================

export type RadialDialMachine = typeof radialDialMachine
export type RadialDialSnapshot = ReturnType<typeof radialDialMachine.getInitialSnapshot>
