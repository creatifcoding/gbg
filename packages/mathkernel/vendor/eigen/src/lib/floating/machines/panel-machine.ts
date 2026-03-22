/**
 * Floating Panel XState Machine
 *
 * Lifecycle state machine for floating panel operations:
 * - idle: Ready for operations
 * - dragging: Panel being dragged
 * - resizing: Panel being resized
 * - opening: Panel opening animation
 * - closing: Panel closing animation
 *
 * @pattern XState v5 + stx integration
 * @module
 */

import { setup, assign } from 'xstate'
import type {
  PanelMachineContext,
  PanelMachineEvent,
  Position,
  Dimensions,
  ResizeEdge,
} from '../types'

// =============================================================================
// Machine Setup
// =============================================================================

export const panelMachine = setup({
  types: {
    context: {} as PanelMachineContext,
    events: {} as PanelMachineEvent,
  },
  actions: {
    setTargetPanel: assign({
      targetPanel: (_, params: { panelId: string }) => params.panelId,
    }),
    clearTargetPanel: assign({
      targetPanel: () => null,
    }),
    setDragStart: assign({
      dragStart: (_, params: { position: Position }) => params.position,
    }),
    clearDragStart: assign({
      dragStart: () => null,
    }),
    setResizeStart: assign({
      resizeStart: (_, params: { dimensions: Dimensions }) => params.dimensions,
      resizeEdge: (_, params: { edge: ResizeEdge }) => params.edge,
    }),
    clearResizeStart: assign({
      resizeStart: () => null,
      resizeEdge: () => null,
    }),
  },
  guards: {
    hasTargetPanel: ({ context }) => context.targetPanel !== null,
  },
}).createMachine({
  id: 'floatingPanels',
  initial: 'idle',
  context: {
    targetPanel: null,
    dragStart: null,
    resizeStart: null,
    resizeEdge: null,
  },
  states: {
    // =========================================================================
    // Idle State - Ready for operations
    // =========================================================================
    idle: {
      on: {
        OPEN_PANEL: {
          target: 'opening',
          actions: {
            type: 'setTargetPanel',
            params: ({ event }) => ({ panelId: event.panelId }),
          },
        },
        CLOSE_PANEL: {
          target: 'closing',
          actions: {
            type: 'setTargetPanel',
            params: ({ event }) => ({ panelId: event.panelId }),
          },
        },
        START_DRAG: {
          target: 'dragging',
          actions: [
            {
              type: 'setTargetPanel',
              params: ({ event }) => ({ panelId: event.panelId }),
            },
            {
              type: 'setDragStart',
              params: ({ event }) => ({ position: event.position }),
            },
          ],
        },
        START_RESIZE: {
          target: 'resizing',
          actions: [
            {
              type: 'setTargetPanel',
              params: ({ event }) => ({ panelId: event.panelId }),
            },
            {
              type: 'setResizeStart',
              params: ({ event }) => ({
                dimensions: event.dimensions,
                edge: event.edge,
              }),
            },
          ],
        },
        // Operations that don't change state
        BRING_TO_FRONT: {},
        SEND_TO_BACK: {},
        DOCK_PANEL: {},
        UNDOCK_PANEL: {},
        SET_VISIBILITY: {},
        TOGGLE_MODE: {},
      },
    },

    // =========================================================================
    // Opening State - Panel appearing animation
    // =========================================================================
    opening: {
      invoke: {
        src: 'animateOpen',
        input: ({ context }) => ({ panelId: context.targetPanel }),
        onDone: {
          target: 'idle',
          actions: 'clearTargetPanel',
        },
        onError: {
          target: 'idle',
          actions: 'clearTargetPanel',
        },
      },
    },

    // =========================================================================
    // Closing State - Panel disappearing animation
    // =========================================================================
    closing: {
      invoke: {
        src: 'animateClose',
        input: ({ context }) => ({ panelId: context.targetPanel }),
        onDone: {
          target: 'idle',
          actions: 'clearTargetPanel',
        },
        onError: {
          target: 'idle',
          actions: 'clearTargetPanel',
        },
      },
    },

    // =========================================================================
    // Dragging State - Panel being repositioned
    // =========================================================================
    dragging: {
      on: {
        UPDATE_DRAG: {
          // Stay in dragging, position updates happen in stx.data
        },
        END_DRAG: {
          target: 'idle',
          actions: ['clearDragStart', 'clearTargetPanel'],
        },
        // Allow z-index operations during drag
        BRING_TO_FRONT: {},
      },
    },

    // =========================================================================
    // Resizing State - Panel being resized
    // =========================================================================
    resizing: {
      on: {
        UPDATE_RESIZE: {
          // Stay in resizing, dimensions update in stx.data
        },
        END_RESIZE: {
          target: 'idle',
          actions: ['clearResizeStart', 'clearTargetPanel'],
        },
        // Allow z-index operations during resize
        BRING_TO_FRONT: {},
      },
    },
  },
})

export type PanelMachine = typeof panelMachine
