/**
 * Shell Session Atoms — Atom.family per-session reactive state.
 *
 * Two-channel pattern:
 *   HOT PATH  — shell:data → direct callback → terminal.write()
 *               (ghostty-web manages its own ring buffer, atoms can't handle
 *                512KB growing string at ~100Hz)
 *   COLD PATH — status, exitCode, info, error → Atom.family atoms
 *               (infrequent, drives React re-renders, WeakRef auto-GC)
 *
 * Agent-facing readOutput lives SERVER-SIDE in xterm-headless (PTY worker).
 * Client atoms hold only UI-consumable metadata.
 *
 * @module harness/interactive-shell/shell-session-atoms
 */

import { Atom, Registry } from '@effect-atom/atom-react'
import type { ShellSessionStatus, ShellSessionInfo, ShellEvent } from './schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Registry — shell atoms use a dedicated registry (or the morphchat one)
// ─────────────────────────────────────────────────────────────────────────────

let _registry: Registry.Registry | null = null

/**
 * Set the Registry instance for shell session atoms.
 * Called once during adapter setup (typically with morphChatRegistry).
 */
export function setShellRegistry(r: Registry.Registry): void {
  _registry = r
}

function getRegistry(): Registry.Registry {
  if (!_registry) {
    // Fallback: create a standalone registry (shouldn't happen in production)
    _registry = Registry.make()
  }
  return _registry
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-Session Atom Bundle
// ─────────────────────────────────────────────────────────────────────────────

export interface ShellSessionAtoms {
  /** Session lifecycle status */
  readonly status$: Atom.Writable<ShellSessionStatus>
  /** Full session info from server */
  readonly info$: Atom.Writable<ShellSessionInfo | null>
  /** Exit code when terminated */
  readonly exitCode$: Atom.Writable<number | null>
  /** Latest error message */
  readonly error$: Atom.Writable<string | null>
  /** Monotonic output sequence counter (triggers re-render on new data) */
  readonly outputSeq$: Atom.Writable<number>
}

// ─────────────────────────────────────────────────────────────────────────────
// The Family — keyed by sessionId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atom.family keyed by sessionId.
 * Each call with the same sessionId returns the SAME atom bundle.
 * WeakRef-based auto-GC when no subscribers remain.
 */
export const shellSessionFamily = Atom.family(
  (_sessionId: string): ShellSessionAtoms => ({
    status$: Atom.make<ShellSessionStatus>('starting'),
    info$: Atom.make<ShellSessionInfo | null>(null),
    exitCode$: Atom.make<number | null>(null),
    error$: Atom.make<string | null>(null),
    outputSeq$: Atom.make(0),
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// Active Sessions Tracking
// ─────────────────────────────────────────────────────────────────────────────

/** Tracks which sessionIds are currently known. */
export const activeSessionIds$ = Atom.make<ReadonlyArray<string>>([])

/** Derived: count of active (non-exited) sessions. */
export const activeSessionCount$ = Atom.make((get) => {
  const ids = get(activeSessionIds$)
  return ids.filter((id) => {
    const session = shellSessionFamily(id)
    const status = get(session.status$)
    return status === 'starting' || status === 'running'
  }).length
})

// ─────────────────────────────────────────────────────────────────────────────
// Hot Path: Direct Data Listeners (NOT through atoms)
// ─────────────────────────────────────────────────────────────────────────────

type ShellDataListener = (data: string) => void
const dataListeners = new Map<string, Set<ShellDataListener>>()

/**
 * Subscribe to raw PTY data for a specific session (hot path).
 * Data goes directly to terminal.write() — no atom intermediary.
 * Returns unsubscribe function.
 */
export function subscribeShellData(
  sessionId: string,
  listener: ShellDataListener,
): () => void {
  let set = dataListeners.get(sessionId)
  if (!set) {
    set = new Set()
    dataListeners.set(sessionId, set)
  }
  set.add(listener)
  return () => {
    set!.delete(listener)
    if (set!.size === 0) dataListeners.delete(sessionId)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Dispatch — single entry point for all shell events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dispatch a ShellEvent into the atom system + data listeners.
 * Called by useHarnessAdapter's daemon fiber on `remote:shell_event`.
 *
 * Hot data → direct callback fan-out (terminal.write)
 * Cold metadata → Atom.set (React re-renders)
 */
export function dispatchShellEvent(event: ShellEvent): void {
  const sessionId =
    'sessionId' in event
      ? (event as { sessionId: string }).sessionId
      : null
  if (!sessionId) return

  const session = shellSessionFamily(sessionId)

  const r = getRegistry()

  // Ensure session is tracked in activeSessionIds$
  const currentIds = r.get(activeSessionIds$)
  if (!currentIds.includes(sessionId)) {
    r.set(activeSessionIds$, [...currentIds, sessionId])
  }

  switch (event._tag) {
    case 'shell:data': {
      // HOT PATH — fan out to direct listeners (terminal.write)
      const set = dataListeners.get(sessionId)
      if (set) {
        for (const listener of set) {
          try {
            listener(event.data)
          } catch {
            // Don't let a bad listener break the fan-out
          }
        }
      }
      // Bump sequence counter so components know new data arrived
      r.set(session.outputSeq$, r.get(session.outputSeq$) + 1)
      break
    }

    case 'shell:started':
      r.set(session.status$, 'running')
      r.set(session.info$, event.info)
      break

    case 'shell:exited':
      r.set(session.status$, 'exited')
      r.set(session.exitCode$, event.exitCode)
      break

    case 'shell:error':
      r.set(session.status$, 'error')
      r.set(session.error$, event.message)
      break
  }
}

/**
 * Remove a session from active tracking and clean up data listeners.
 */
export function cleanupSession(sessionId: string): void {
  dataListeners.delete(sessionId)
  const r = getRegistry()
  const currentIds = r.get(activeSessionIds$)
  r.set(
    activeSessionIds$,
    currentIds.filter((id) => id !== sessionId),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell Command Dispatch (plain functions, backed by adapter WS)
// ─────────────────────────────────────────────────────────────────────────────

type ShellCommandSender = (command: {
  _tag: string
  sessionId: string
  [key: string]: unknown
}) => void

let _sendCommand: ShellCommandSender | null = null

export function registerShellCommandSender(sender: ShellCommandSender): void {
  _sendCommand = sender
}

export function clearShellCommandSender(): void {
  _sendCommand = null
}

export function sendShellInput(
  sessionId: string,
  data?: string,
  options?: {
    inputKeys?: string[]
    inputHex?: string[]
    inputPaste?: string
  },
): void {
  _sendCommand?.({
    _tag: 'remote:shell_input',
    sessionId,
    ...(data !== undefined && { data }),
    ...(options?.inputKeys?.length && { inputKeys: options.inputKeys }),
    ...(options?.inputHex?.length && { inputHex: options.inputHex }),
    ...(options?.inputPaste && { inputPaste: options.inputPaste }),
  })
}

export function sendShellResize(
  sessionId: string,
  cols: number,
  rows: number,
): void {
  _sendCommand?.({
    _tag: 'remote:shell_resize',
    sessionId,
    cols,
    rows,
  })
}

export function sendShellKill(sessionId: string): void {
  _sendCommand?.({
    _tag: 'remote:shell_kill',
    sessionId,
  })
}
