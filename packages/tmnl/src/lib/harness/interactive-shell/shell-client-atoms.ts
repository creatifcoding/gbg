/**
 * Shell Client Atoms — Browser-side reactive shell IO via effect-atom.
 *
 * Provides atoms for shell event subscription and command dispatch,
 * backed by the harness WS transport (same Layer graph as morphchat).
 *
 * Architecture:
 *   - shellEvents$ atom: PubSub-fed stream of all ShellEvent from WS
 *   - shellSendInput / shellSendResize / shellSendKill: fn-atoms for commands
 *   - Mounted to morphChatRegistry for lifecycle alignment with adapter
 *
 * The events are extracted from HarnessBrowserTransport.events stream.
 * Shell event envelopes (remote:shell_event) are filtered and unwrapped.
 *
 * @module harness/interactive-shell/shell-client-atoms
 */

import { Atom } from '@effect-atom/atom-react'
import { morphChatRegistry } from '@/lib/morphchat/atoms/registry'
import type { ShellEvent } from './schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Shell Event Buffer (Atom.make — React-consumable)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Active shell event listeners.
 * Key: sessionId, Value: array of listener callbacks.
 *
 * This is the simplest possible bridge — no Effect runtime on client needed.
 * The harness adapter's event processor calls `dispatchShellEvent()` when
 * it sees a `remote:shell_event` envelope, which fans out to listeners.
 */
type ShellEventListener = (event: ShellEvent) => void
const listeners = new Map<string, Set<ShellEventListener>>()
const globalListeners = new Set<ShellEventListener>()

/**
 * Subscribe to shell events for a specific session.
 * Returns an unsubscribe function.
 */
export function subscribeShellEvents(
  sessionId: string,
  listener: ShellEventListener,
): () => void {
  let set = listeners.get(sessionId)
  if (!set) {
    set = new Set()
    listeners.set(sessionId, set)
  }
  set.add(listener)
  return () => {
    set!.delete(listener)
    if (set!.size === 0) listeners.delete(sessionId)
  }
}

/**
 * Subscribe to ALL shell events (any session).
 * Returns an unsubscribe function.
 */
export function subscribeAllShellEvents(
  listener: ShellEventListener,
): () => void {
  globalListeners.add(listener)
  return () => {
    globalListeners.delete(listener)
  }
}

/**
 * Dispatch a shell event to registered listeners.
 * Called by the harness event processor when it sees `remote:shell_event`.
 */
export function dispatchShellEvent(event: ShellEvent): void {
  // Extract sessionId from event
  const sessionId =
    'sessionId' in event ? (event as { sessionId: string }).sessionId : null

  // Fan out to session-specific listeners
  if (sessionId) {
    const set = listeners.get(sessionId)
    if (set) {
      for (const listener of set) {
        try {
          listener(event)
        } catch {
          // Don't let a bad listener break the fan-out
        }
      }
    }
  }

  // Fan out to global listeners
  for (const listener of globalListeners) {
    try {
      listener(event)
    } catch {
      // Same
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell Command Dispatch (plain functions, backed by adapter WS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Callback type for sending shell commands via WS.
 * Set by the harness adapter when it connects.
 */
type ShellCommandSender = (command: {
  _tag: string
  sessionId: string
  [key: string]: unknown
}) => void

let _sendCommand: ShellCommandSender | null = null

/**
 * Register the shell command sender (called by harness adapter on connect).
 */
export function registerShellCommandSender(sender: ShellCommandSender): void {
  _sendCommand = sender
}

/**
 * Clear the shell command sender (called by harness adapter on disconnect).
 */
export function clearShellCommandSender(): void {
  _sendCommand = null
}

/**
 * Send input to a PTY session.
 * Supports raw text, named keys, hex bytes, and bracketed paste.
 */
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

/**
 * Resize a PTY session.
 */
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

/**
 * Kill a PTY session.
 */
export function sendShellKill(sessionId: string): void {
  _sendCommand?.({
    _tag: 'remote:shell_kill',
    sessionId,
  })
}
