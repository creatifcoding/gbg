/**
 * Drag Orchestrator XState Machine
 *
 * Lifecycle state machine for centralized drag operations:
 * - idle: Ready for drag
 * - dragging: Active drag with velocity tracking
 *
 * This machine coordinates drag state across all consumers
 * (selection system, floating panels, custom draggables).
 *
 * @pattern XState v5 + stx integration
 * @module
 */

import { setup, assign } from 'xstate'
import type { Vector2D, DragSource, DragMachineContext, DragMachineEvent } from '../types'

// =============================================================================
// Machine Setup
// =============================================================================

export const dragMachine = setup({
  types: {
    context: {} as DragMachineContext,
    events: {} as DragMachineEvent,
  },
  actions: {
    setOperationId: assign({
      operationId: (_, params: { id: string }) => params.id,
    }),
    clearOperationId: assign({
      operationId: () => null,
    }),
  },
  guards: {
    hasActiveOperation: ({ context }) => context.operationId !== null,
    noActiveOperation: ({ context }) => context.operationId === null,
  },
}).createMachine({
  id: 'dragOrchestrator',
  initial: 'idle',
  context: {
    operationId: null,
  },
  states: {
    // =========================================================================
    // Idle State - Ready for drag operations
    // =========================================================================
    idle: {
      on: {
        START_DRAG: {
          target: 'dragging',
          guard: 'noActiveOperation',
          actions: {
            type: 'setOperationId',
            params: ({ event }) => ({ id: event.operation.id }),
          },
        },
      },
    },

    // =========================================================================
    // Dragging State - Active drag with velocity tracking
    // =========================================================================
    dragging: {
      on: {
        UPDATE_POSITION: {
          // Stay in dragging, velocity updates happen in stx.data
        },
        ADD_ELEMENTS: {
          // Add elements to current drag (group expansion)
        },
        REMOVE_ELEMENTS: {
          // Remove elements from current drag
        },
        END_DRAG: {
          target: 'idle',
          actions: 'clearOperationId',
        },
        CANCEL_DRAG: {
          target: 'idle',
          actions: 'clearOperationId',
        },
      },
    },
  },
})

export type DragMachine = typeof dragMachine
