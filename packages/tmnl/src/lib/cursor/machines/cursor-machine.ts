/**
 * Cursor State Machine
 *
 * XState machine for AI chat cursor lifecycle:
 * - pill: Collapsed indicator
 * - expanding: Transition to chat
 * - chat: Full chat interface
 * - collapsing: Transition to pill
 * - repositioning: Moving to new corner
 *
 * Uses stx pattern: XState → snapshotAtom bridge → effect-atom consumers
 */

import { setup, assign, type SnapshotFrom } from 'xstate'
import type { CornerPreset } from '../schemas/position'

// -----------------------------------------------------------------------------
// Context & Event Types
// -----------------------------------------------------------------------------

export interface CursorMachineContext {
  /** Current size preset key */
  sizeKey: string
  /** Current corner position */
  currentCorner: CornerPreset
  /** Has unread messages while in pill state */
  hasUnread: boolean
  /** AI status */
  aiStatus: 'idle' | 'thinking' | 'streaming'
}

export type CursorMachineEvent =
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'MOVE_TO'; corner: CornerPreset }
  | { type: 'REPOSITION_COMPLETE' }
  | { type: 'AI_THINKING' }
  | { type: 'AI_STREAMING' }
  | { type: 'AI_IDLE' }
  | { type: 'MESSAGE_RECEIVED' }
  | { type: 'MESSAGES_READ' }

// -----------------------------------------------------------------------------
// Timing Constants
// -----------------------------------------------------------------------------

const TIMING = {
  /** Duration for expand/collapse animation */
  transition: 200,
  /** Duration for reposition trajectory */
  reposition: 300,
} as const

// -----------------------------------------------------------------------------
// Machine Definition
// -----------------------------------------------------------------------------

export const cursorMachine = setup({
  types: {
    context: {} as CursorMachineContext,
    events: {} as CursorMachineEvent,
  },
  actions: {
    setSizeMinimal: assign({ sizeKey: 'minimal' }),
    setSizeDefault: assign({ sizeKey: 'default' }),
    setSizeExpanded: assign({ sizeKey: 'expanded' }),
    setAiThinking: assign({ aiStatus: 'thinking' }),
    setAiStreaming: assign({ aiStatus: 'streaming' }),
    setAiIdle: assign({ aiStatus: 'idle' }),
    markUnread: assign({ hasUnread: true }),
    clearUnread: assign({ hasUnread: false }),
    updateCorner: assign({
      currentCorner: ({ event }) => {
        if (event.type === 'MOVE_TO') {
          return event.corner
        }
        return 'bottom-right' // fallback
      },
    }),
  },
  guards: {
    hasMessages: ({ context }) => context.hasUnread,
  },
}).createMachine({
  id: 'cursor',
  initial: 'pill',
  context: {
    sizeKey: 'minimal',
    currentCorner: 'bottom-right',
    hasUnread: false,
    aiStatus: 'idle',
  },
  states: {
    pill: {
      entry: ['setSizeMinimal', 'setAiIdle'],
      on: {
        EXPAND: { target: 'expanding' },
        AI_THINKING: { actions: 'setAiThinking' },
        AI_STREAMING: { target: 'expanding' }, // Auto-expand when AI starts streaming
        MESSAGE_RECEIVED: { actions: 'markUnread' },
      },
    },
    expanding: {
      entry: 'setSizeDefault',
      after: {
        [TIMING.transition]: { target: 'chat' },
      },
      on: {
        // Allow interrupting expansion
        COLLAPSE: { target: 'collapsing' },
      },
    },
    chat: {
      entry: 'clearUnread',
      on: {
        COLLAPSE: { target: 'collapsing' },
        MOVE_TO: {
          target: 'repositioning',
          actions: 'updateCorner',
        },
        AI_THINKING: { actions: 'setAiThinking' },
        AI_STREAMING: { actions: 'setAiStreaming' },
        AI_IDLE: { actions: 'setAiIdle' },
        MESSAGES_READ: { actions: 'clearUnread' },
      },
    },
    collapsing: {
      entry: 'setSizeMinimal',
      after: {
        [TIMING.transition]: { target: 'pill' },
      },
      on: {
        // Allow interrupting collapse
        EXPAND: { target: 'expanding' },
        AI_STREAMING: { target: 'expanding' }, // Auto-expand if AI starts responding
      },
    },
    repositioning: {
      // Position animation in progress
      // Uses existing DynamicIsland physics for trajectory
      after: {
        [TIMING.reposition]: { target: 'chat' },
      },
      on: {
        REPOSITION_COMPLETE: { target: 'chat' },
        COLLAPSE: { target: 'collapsing' },
      },
    },
  },
})

// -----------------------------------------------------------------------------
// Type Exports
// -----------------------------------------------------------------------------

export type CursorMachineSnapshot = SnapshotFrom<typeof cursorMachine>

export type CursorMachineState =
  | 'pill'
  | 'expanding'
  | 'chat'
  | 'collapsing'
  | 'repositioning'

/**
 * Extract current state value from snapshot
 */
export function getCursorState(snapshot: CursorMachineSnapshot): CursorMachineState {
  return snapshot.value as CursorMachineState
}

/**
 * Check if cursor is in an interactive state (not transitioning)
 */
export function isCursorInteractive(snapshot: CursorMachineSnapshot): boolean {
  const state = getCursorState(snapshot)
  return state === 'pill' || state === 'chat'
}

/**
 * Check if cursor is expanded (chat or transitioning to chat)
 */
export function isCursorExpanded(snapshot: CursorMachineSnapshot): boolean {
  const state = getCursorState(snapshot)
  return state === 'chat' || state === 'expanding' || state === 'repositioning'
}
