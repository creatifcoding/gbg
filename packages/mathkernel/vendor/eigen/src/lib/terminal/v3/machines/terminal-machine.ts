/**
 * Terminal v3 State Machine
 *
 * XState machine for terminal lifecycle:
 * - idle: Ready for input
 * - executing: Shell command running
 * - streaming: AI response streaming
 * - aborting: Cleanup in progress
 *
 * Uses stx pattern: XState → snapshotAtom bridge → effect-atom consumers
 */

import { setup, assign, type SnapshotFrom } from 'xstate'

// -----------------------------------------------------------------------------
// Input Mode Type
// -----------------------------------------------------------------------------

export type InputMode = 'shell' | 'ai' | 'hybrid'

// -----------------------------------------------------------------------------
// Context & Event Types
// -----------------------------------------------------------------------------

export interface TerminalMachineContext {
  /** Current input mode */
  inputMode: InputMode
  /** Current working directory */
  cwd: string
  /** Active block ID (if any) */
  activeBlockId: string | null
  /** Active PTY ID (for interactive/command blocks) */
  activePtyId: string | null
  /** Active stream request ID (for AI blocks) */
  activeStreamId: string | null
  /** Error message (if any) */
  error: string | null
  /** User scroll position */
  userScrolled: boolean
}

export type TerminalMachineEvent =
  // Input mode
  | { type: 'SET_MODE'; mode: InputMode }
  | { type: 'TOGGLE_MODE' }
  // Execution
  | { type: 'SUBMIT_COMMAND'; command: string }
  | { type: 'SUBMIT_AI_QUERY'; prompt: string; model?: string }
  | { type: 'EXECUTION_STARTED'; blockId: string; ptyId?: string }
  | { type: 'STREAM_STARTED'; blockId: string; requestId: string }
  | { type: 'EXECUTION_COMPLETE'; exitCode?: number }
  | { type: 'STREAM_COMPLETE' }
  | { type: 'ABORT' }
  | { type: 'DISMISS_BLOCK' }
  | { type: 'ERROR'; message: string }
  // Navigation
  | { type: 'SCROLL'; userScrolled: boolean }
  | { type: 'CWD_CHANGE'; cwd: string }

// -----------------------------------------------------------------------------
// Timing Constants
// -----------------------------------------------------------------------------

const TIMING = {
  /** Abort cleanup timeout */
  abortTimeout: 500,
} as const

// -----------------------------------------------------------------------------
// Machine Definition
// -----------------------------------------------------------------------------

export const terminalMachine = setup({
  types: {
    context: {} as TerminalMachineContext,
    events: {} as TerminalMachineEvent,
  },
  actions: {
    setMode: assign({
      inputMode: ({ event }) =>
        event.type === 'SET_MODE' ? event.mode : 'shell',
    }),
    toggleMode: assign({
      inputMode: ({ context }) => {
        const modes: InputMode[] = ['shell', 'ai', 'hybrid']
        const currentIndex = modes.indexOf(context.inputMode)
        return modes[(currentIndex + 1) % modes.length]
      },
    }),
    setActiveBlock: assign({
      activeBlockId: ({ event }) => {
        if (event.type === 'EXECUTION_STARTED' || event.type === 'STREAM_STARTED') {
          return event.blockId
        }
        return null
      },
    }),
    setActivePty: assign({
      activePtyId: ({ event }) =>
        event.type === 'EXECUTION_STARTED' ? (event.ptyId ?? null) : null,
    }),
    setActiveStream: assign({
      activeStreamId: ({ event }) =>
        event.type === 'STREAM_STARTED' ? event.requestId : null,
    }),
    clearActive: assign({
      activeBlockId: null,
      activePtyId: null,
      activeStreamId: null,
    }),
    setError: assign({
      error: ({ event }) => (event.type === 'ERROR' ? event.message : null),
    }),
    clearError: assign({ error: null }),
    setCwd: assign({
      cwd: ({ event }) => (event.type === 'CWD_CHANGE' ? event.cwd : ''),
    }),
    setUserScrolled: assign({
      userScrolled: ({ event }) =>
        event.type === 'SCROLL' ? event.userScrolled : false,
    }),
  },
  guards: {
    hasActiveBlock: ({ context }) => context.activeBlockId !== null,
    hasActivePty: ({ context }) => context.activePtyId !== null,
    hasActiveStream: ({ context }) => context.activeStreamId !== null,
  },
}).createMachine({
  id: 'terminal',
  initial: 'idle',
  context: {
    inputMode: 'hybrid',
    cwd: '',
    activeBlockId: null,
    activePtyId: null,
    activeStreamId: null,
    error: null,
    userScrolled: false,
  },
  states: {
    idle: {
      entry: ['clearActive', 'clearError'],
      on: {
        SET_MODE: { actions: 'setMode' },
        TOGGLE_MODE: { actions: 'toggleMode' },
        SUBMIT_COMMAND: { target: 'executing' },
        SUBMIT_AI_QUERY: { target: 'streaming' },
        CWD_CHANGE: { actions: 'setCwd' },
        SCROLL: { actions: 'setUserScrolled' },
      },
    },
    executing: {
      // Shell command execution
      entry: 'clearError',
      on: {
        EXECUTION_STARTED: { actions: ['setActiveBlock', 'setActivePty'] },
        EXECUTION_COMPLETE: { target: 'idle' },
        ERROR: { target: 'idle', actions: 'setError' },
        ABORT: { target: 'aborting' },
        SCROLL: { actions: 'setUserScrolled' },
      },
    },
    streaming: {
      // AI stream in progress
      entry: 'clearError',
      on: {
        STREAM_STARTED: { actions: ['setActiveBlock', 'setActiveStream'] },
        STREAM_COMPLETE: { target: 'idle' },
        ERROR: { target: 'idle', actions: 'setError' },
        ABORT: { target: 'aborting' },
        SCROLL: { actions: 'setUserScrolled' },
      },
    },
    aborting: {
      // Cleanup in progress
      entry: 'clearError',
      after: {
        [TIMING.abortTimeout]: { target: 'idle' }, // Timeout fallback
      },
      on: {
        EXECUTION_COMPLETE: { target: 'idle' },
        STREAM_COMPLETE: { target: 'idle' },
      },
    },
  },
})

// -----------------------------------------------------------------------------
// Type Exports
// -----------------------------------------------------------------------------

export type TerminalMachineSnapshot = SnapshotFrom<typeof terminalMachine>

export type TerminalMachineState = 'idle' | 'executing' | 'streaming' | 'aborting'

/**
 * Extract current state value from snapshot
 */
export function getTerminalState(snapshot: TerminalMachineSnapshot): TerminalMachineState {
  return snapshot.value as TerminalMachineState
}

/**
 * Check if terminal can accept new commands
 */
export function canSubmit(snapshot: TerminalMachineSnapshot): boolean {
  return snapshot.value === 'idle'
}

/**
 * Check if terminal has an active operation
 */
export function isActive(snapshot: TerminalMachineSnapshot): boolean {
  const state = getTerminalState(snapshot)
  return state === 'executing' || state === 'streaming'
}

/**
 * Check if terminal is streaming AI response
 */
export function isStreaming(snapshot: TerminalMachineSnapshot): boolean {
  return snapshot.value === 'streaming'
}

/**
 * Check if terminal is executing a command
 */
export function isExecuting(snapshot: TerminalMachineSnapshot): boolean {
  return snapshot.value === 'executing'
}
