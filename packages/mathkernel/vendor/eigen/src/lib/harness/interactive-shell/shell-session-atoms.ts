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
import { createActor } from 'xstate'
import type {
  ShellSessionStatus,
  ShellSessionInfo,
  ShellEvent,
  ControlMode,
  ControllerRole,
  ActivityEntry,
} from './schemas'
import {
  controlMachine,
  snapshotToMode,
  snapshotToController,
  canAgentWrite as machineCanAgentWrite,
  type ControlMachineActor,
} from './control-machine'

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
  // ── Control Model ──────────────────────────────────────────────────
  /** Current control mode (agent-controlled, human-controlled, supervised) */
  readonly controlMode$: Atom.Writable<ControlMode>
  /** Who currently holds stdin */
  readonly controller$: Atom.Writable<ControllerRole>
  /** Whether the agent is currently writing (typing indicator) */
  readonly agentWriting$: Atom.Writable<boolean>
  /** Activity log entries (capped at MAX_ACTIVITY_ENTRIES) */
  readonly activityLog$: Atom.Writable<ReadonlyArray<ActivityEntry>>
  /** Bytes written by human + agent */
  readonly bytesIn$: Atom.Writable<number>
  /** Bytes received from shell:data */
  readonly bytesOut$: Atom.Writable<number>
  /** Number of commands sent (writes ending with \n) */
  readonly commandCount$: Atom.Writable<number>
  /** Session creation timestamp */
  readonly createdAt$: Atom.Writable<number>
}

// ─────────────────────────────────────────────────────────────────────────────
// The Family — keyed by sessionId
// ─────────────────────────────────────────────────────────────────────────────

const MAX_ACTIVITY_ENTRIES = 500

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
    // Control model
    controlMode$: Atom.make<ControlMode>('agent-controlled'),
    controller$: Atom.make<ControllerRole>('agent'),
    agentWriting$: Atom.make(false),
    activityLog$: Atom.make<ReadonlyArray<ActivityEntry>>([]),
    // Throughput metrics
    bytesIn$: Atom.make(0),
    bytesOut$: Atom.make(0),
    commandCount$: Atom.make(0),
    createdAt$: Atom.make(Date.now()),
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// XState Actor Management — one machine actor per session
// ─────────────────────────────────────────────────────────────────────────────

const controlActors = new Map<string, ControlMachineActor>()

/**
 * Get or create the control machine actor for a session.
 * Actor syncs its state into the atom family via subscriptions.
 */
export function getControlActor(sessionId: string): ControlMachineActor {
  let actor = controlActors.get(sessionId)
  if (actor) return actor

  actor = createActor(controlMachine)
  controlActors.set(sessionId, actor)

  const session = shellSessionFamily(sessionId)
  const r = getRegistry()

  // Sync machine state → atoms on every transition
  actor.subscribe((snapshot) => {
    r.set(session.controlMode$, snapshotToMode(snapshot))
    r.set(session.controller$, snapshotToController(snapshot))
  })

  actor.start()
  return actor
}

/**
 * Stop and remove the control actor for a session.
 */
function stopControlActor(sessionId: string): void {
  const actor = controlActors.get(sessionId)
  if (actor) {
    actor.send({ type: 'SESSION_ENDED' })
    actor.stop()
    controlActors.delete(sessionId)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Log Helpers
// ─────────────────────────────────────────────────────────────────────────────

function appendActivity(
  sessionId: string,
  entry: ActivityEntry,
): void {
  const session = shellSessionFamily(sessionId)
  const r = getRegistry()
  const log = r.get(session.activityLog$)
  const updated = [...log, entry]
  // FIFO cap
  r.set(
    session.activityLog$,
    updated.length > MAX_ACTIVITY_ENTRIES
      ? updated.slice(updated.length - MAX_ACTIVITY_ENTRIES)
      : updated,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Control Commands — dispatch from UI (send over WS)
// ─────────────────────────────────────────────────────────────────────────────

export function sendShellTakeControl(sessionId: string): void {
  _sendCommand?.({ _tag: 'remote:shell_take_control', sessionId })
}

export function sendShellYieldControl(sessionId: string): void {
  _sendCommand?.({ _tag: 'remote:shell_yield_control', sessionId })
}

export function sendShellSwitchMode(sessionId: string, mode: ControlMode): void {
  _sendCommand?.({ _tag: 'remote:shell_switch_mode', sessionId, mode })
}

/**
 * Notify the control system that the agent wrote (from tool executor).
 * Dispatches to machine + activity log.
 */
export function notifyAgentWrite(sessionId: string, data: string): void {
  const actor = getControlActor(sessionId)
  const ts = Date.now()
  actor.send({ type: 'AGENT_WRITE', timestamp: ts })
  const r = getRegistry()
  const session = shellSessionFamily(sessionId)
  r.set(session.agentWriting$, true)
  // Track throughput
  r.set(session.bytesIn$, r.get(session.bytesIn$) + data.length)
  if (data.includes('\n')) {
    r.set(session.commandCount$, r.get(session.commandCount$) + 1)
  }
  // Activity log
  const cmdLine = data.trim()
  if (cmdLine) {
    appendActivity(sessionId, {
      source: 'agent',
      action: 'Sent command',
      timestamp: ts,
      command: cmdLine.length > 200 ? cmdLine.slice(0, 200) + '…' : cmdLine,
    })
  }
}

/**
 * Clear the agent-writing indicator (call when tool call ends).
 */
export function clearAgentWriting(sessionId: string): void {
  const r = getRegistry()
  const session = shellSessionFamily(sessionId)
  r.set(session.agentWriting$, false)
}

/**
 * Notify the control system that the human typed (from terminal onData).
 * Dispatches to machine + activity log + throughput.
 */
export function notifyHumanKeystroke(sessionId: string, byteCount: number): void {
  const actor = getControlActor(sessionId)
  const ts = Date.now()
  actor.send({ type: 'HUMAN_KEYSTROKE', timestamp: ts })
  const r = getRegistry()
  const session = shellSessionFamily(sessionId)
  r.set(session.bytesIn$, r.get(session.bytesIn$) + byteCount)
}

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
 * Replay buffer per session — captures shell:data that arrives
 * BEFORE any listener subscribes (e.g. during the 500ms tool execution
 * window before the React renderer mounts).
 *
 * On first subscribeShellData(), the buffer is drained and replayed
 * into the new listener, then cleared. Subsequent data goes direct.
 *
 * Max 64KB per session to prevent unbounded growth on long-running
 * sessions with no subscriber.
 */
const MAX_REPLAY_BUFFER = 64 * 1024
const replayBuffers = new Map<string, string[]>()

function appendToReplayBuffer(sessionId: string, data: string): void {
  let buf = replayBuffers.get(sessionId)
  if (!buf) {
    buf = []
    replayBuffers.set(sessionId, buf)
  }
  buf.push(data)
  // Trim from front if we exceed budget
  let total = 0
  for (const chunk of buf) total += chunk.length
  while (total > MAX_REPLAY_BUFFER && buf.length > 1) {
    total -= buf.shift()!.length
  }
}

/**
 * Subscribe to raw PTY data for a specific session (hot path).
 * Data goes directly to terminal.write() — no atom intermediary.
 *
 * On first subscriber: replays any buffered data that arrived before
 * the listener was registered, then clears the buffer.
 *
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

  // Replay buffered data for this session
  const buf = replayBuffers.get(sessionId)
  if (buf && buf.length > 0) {
    for (const chunk of buf) {
      try { listener(chunk) } catch { /* don't let replay errors propagate */ }
    }
    replayBuffers.delete(sessionId)
  }

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
      if (set && set.size > 0) {
        for (const listener of set) {
          try {
            listener(event.data)
          } catch {
            // Don't let a bad listener break the fan-out
          }
        }
      } else {
        // No listeners yet — buffer for replay on first subscribe.
        // This covers the window between tool execution start and
        // React renderer mount (typically ~500ms).
        appendToReplayBuffer(sessionId, event.data)
      }
      // Bump sequence counter so components know new data arrived
      r.set(session.outputSeq$, r.get(session.outputSeq$) + 1)
      // Track bytes out
      r.set(session.bytesOut$, r.get(session.bytesOut$) + event.data.length)
      break
    }

    case 'shell:started':
      r.set(session.status$, 'running')
      r.set(session.info$, event.info)
      r.set(session.createdAt$, Date.now())
      // Initialize control actor for this session
      getControlActor(sessionId)
      appendActivity(sessionId, {
        source: 'system',
        action: 'Session started',
        timestamp: Date.now(),
      })
      break

    case 'shell:exited':
      r.set(session.status$, 'exited')
      r.set(session.exitCode$, event.exitCode)
      stopControlActor(sessionId)
      appendActivity(sessionId, {
        source: 'system',
        action: `Exited with code ${event.exitCode}`,
        timestamp: Date.now(),
      })
      break

    case 'shell:error':
      r.set(session.status$, 'error')
      r.set(session.error$, event.message)
      appendActivity(sessionId, {
        source: 'system',
        action: `Error: ${event.message}`,
        timestamp: Date.now(),
      })
      break

    case 'shell:control_changed':
      r.set(session.controlMode$, event.mode)
      r.set(session.controller$, event.controller)
      // Also sync the XState actor
      {
        const actor = getControlActor(sessionId)
        actor.send({ type: 'SWITCH_MODE', mode: event.mode })
      }
      appendActivity(sessionId, {
        source: 'system',
        action: `Control: ${event.controller} (${event.mode})`,
        timestamp: event.timestamp,
      })
      break
  }
}

/**
 * Remove a session from active tracking and clean up data listeners.
 */
export function cleanupSession(sessionId: string): void {
  dataListeners.delete(sessionId)
  replayBuffers.delete(sessionId)
  stopControlActor(sessionId)
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
