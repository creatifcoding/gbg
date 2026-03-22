/**
 * Terminal v3 STX Bridge
 *
 * XState + effect-atom integration following the stx pattern:
 * - terminalActor: XState actor singleton
 * - terminalSnapshotAtom: Bridge atom (XState → effect-atom)
 * - Derived atoms: Read from snapshot for reactive state
 * - Actor operations: Send events to actor
 *
 * React components use derived atoms via useAtomValue().
 * Operations send events to actor, which updates snapshot atom.
 */

import { Atom } from '@effect-atom/atom'
import { RegistryContext } from '@effect-atom/atom-react'
import { createActor } from 'xstate'
import type { ReactNode } from 'react'
import {
  terminalMachine,
  type TerminalMachineSnapshot,
  type TerminalMachineState,
  type InputMode,
  getTerminalState,
  canSubmit,
  isActive,
  isStreaming,
  isExecuting,
} from './machines'
import { aiCoreRegistry } from '@/lib/ai-core'

// =============================================================================
// Registry (CRITICAL: React must use TerminalRegistryProvider)
// =============================================================================

/**
 * Terminal v3 uses aiCoreRegistry (shared with ai-core) for unified state.
 * This allows terminal atoms AND ai-core atoms to be read from same context.
 *
 * Architecture: Terminal v3 composes ai-core, so sharing registry is natural.
 */
export const terminalRegistry = aiCoreRegistry

/**
 * Provider that injects shared registry into React context.
 * Wrap components that use useAtomValue() with terminal OR ai-core atoms.
 *
 * @example
 * <TerminalRegistryProvider>
 *   <BlockTerminal />
 * </TerminalRegistryProvider>
 */
export function TerminalRegistryProvider({ children }: { children: ReactNode }) {
  return (
    <RegistryContext.Provider value={terminalRegistry}>
      {children}
    </RegistryContext.Provider>
  )
}

// =============================================================================
// XState Actor (module-level singleton)
// =============================================================================

/**
 * Create and start the terminal actor.
 * This is a module-level singleton — do not recreate.
 */
const terminalActor = createActor(terminalMachine)
terminalActor.start()

/**
 * Bridge atom: XState snapshot → effect-atom
 * All derived state reads from this single atom.
 */
export const terminalSnapshotAtom = Atom.make<TerminalMachineSnapshot>(
  terminalActor.getSnapshot()
)

// Subscribe actor to update bridge atom (use registry, not global Atom.set)
terminalActor.subscribe((snapshot) => {
  terminalRegistry.set(terminalSnapshotAtom, snapshot)
})

// =============================================================================
// Derived Atoms (from XState snapshot)
// =============================================================================

/** Current machine state value */
export const terminalStateAtom = Atom.make((get): TerminalMachineState => {
  const snapshot = get(terminalSnapshotAtom)
  return getTerminalState(snapshot)
})

/** Machine context */
export const terminalContextAtom = Atom.make((get) => {
  const snapshot = get(terminalSnapshotAtom)
  return snapshot.context
})

/** Current input mode */
export const inputModeAtom = Atom.make((get): InputMode => {
  const context = get(terminalContextAtom)
  return context.inputMode
})

/** Current working directory */
export const cwdAtom = Atom.make((get): string => {
  const context = get(terminalContextAtom)
  return context.cwd
})

/** Whether terminal can accept new commands */
export const canSubmitAtom = Atom.make((get): boolean => {
  const snapshot = get(terminalSnapshotAtom)
  return canSubmit(snapshot)
})

/** Whether terminal has an active operation */
export const isActiveAtom = Atom.make((get): boolean => {
  const snapshot = get(terminalSnapshotAtom)
  return isActive(snapshot)
})

/** Whether terminal is streaming AI response */
export const isStreamingAtom = Atom.make((get): boolean => {
  const snapshot = get(terminalSnapshotAtom)
  return isStreaming(snapshot)
})

/** Whether terminal is executing a command */
export const isExecutingAtom = Atom.make((get): boolean => {
  const snapshot = get(terminalSnapshotAtom)
  return isExecuting(snapshot)
})

/** Active block ID (if any) */
export const activeBlockIdAtom = Atom.make((get): string | null => {
  const context = get(terminalContextAtom)
  return context.activeBlockId
})

/** Active stream ID for AI blocks */
export const activeStreamIdAtom = Atom.make((get): string | null => {
  const context = get(terminalContextAtom)
  return context.activeStreamId
})

/** Active PTY ID for command/interactive blocks */
export const activePtyIdAtom = Atom.make((get): string | null => {
  const context = get(terminalContextAtom)
  return context.activePtyId
})

/** Current error message */
export const errorAtom = Atom.make((get): string | null => {
  const context = get(terminalContextAtom)
  return context.error
})

/** User scroll state */
export const userScrolledAtom = Atom.make((get): boolean => {
  const context = get(terminalContextAtom)
  return context.userScrolled
})

// =============================================================================
// Actor Operations (send events to actor)
// =============================================================================

/**
 * Terminal actor operations.
 * These are synchronous event sends — actor updates snapshot atom asynchronously.
 */
export const terminalActorOps = {
  /** Set input mode */
  setMode: (mode: InputMode): void => {
    terminalActor.send({ type: 'SET_MODE', mode })
  },

  /** Toggle input mode (shell → ai → hybrid → shell) */
  toggleMode: (): void => {
    terminalActor.send({ type: 'TOGGLE_MODE' })
  },

  /** Submit a command for execution */
  submitCommand: (command: string): void => {
    terminalActor.send({ type: 'SUBMIT_COMMAND', command })
  },

  /** Submit an AI query */
  submitAIQuery: (prompt: string, model?: string): void => {
    terminalActor.send({ type: 'SUBMIT_AI_QUERY', prompt, model })
  },

  /** Notify that execution has started */
  executionStarted: (blockId: string, ptyId?: string): void => {
    terminalActor.send({ type: 'EXECUTION_STARTED', blockId, ptyId })
  },

  /** Notify that stream has started */
  streamStarted: (blockId: string, requestId: string): void => {
    terminalActor.send({ type: 'STREAM_STARTED', blockId, requestId })
  },

  /** Notify that execution has completed */
  executionComplete: (exitCode?: number): void => {
    terminalActor.send({ type: 'EXECUTION_COMPLETE', exitCode })
  },

  /** Notify that stream has completed */
  streamComplete: (): void => {
    terminalActor.send({ type: 'STREAM_COMPLETE' })
  },

  /** Abort current operation */
  abort: (): void => {
    terminalActor.send({ type: 'ABORT' })
  },

  /** Dismiss a block */
  dismissBlock: (): void => {
    terminalActor.send({ type: 'DISMISS_BLOCK' })
  },

  /** Set error state */
  error: (message: string): void => {
    terminalActor.send({ type: 'ERROR', message })
  },

  /** Update working directory */
  setCwd: (cwd: string): void => {
    terminalActor.send({ type: 'CWD_CHANGE', cwd })
  },

  /** Update user scroll state */
  setScroll: (userScrolled: boolean): void => {
    terminalActor.send({ type: 'SCROLL', userScrolled })
  },
}

// =============================================================================
// Actor Access (for advanced use cases)
// =============================================================================

/**
 * Get the raw XState actor.
 * Use with caution — prefer derived atoms and operations.
 */
export const getTerminalActor = () => terminalActor
