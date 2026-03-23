/**
 * Stream Watchdog — monitors streaming health.
 *
 * Detects stalls in the streaming pipeline and pushes
 * status rows to the chat UI when the stream goes quiet
 * for too long.
 *
 * @module
 */

import type { Atom } from "effect-v4/unstable/reactivity"

// ── Types ───────────────────────────────────────────

export interface WatchdogHandle {
  /** Reset the timer — call on every chunk received */
  touch(): void
  /** Stop monitoring */
  stop(): void
}

type StreamingState = unknown
type MessageList = unknown
type StatusRowPusher = (text: string) => void

// ── Defaults ────────────────────────────────────────

const STALL_TIMEOUT_MS = 30_000 // 30s before declaring stall

// ── Implementation ──────────────────────────────────

/**
 * Start a watchdog that monitors the streaming atom.
 * If no `.touch()` arrives within STALL_TIMEOUT_MS, it
 * pushes a status message via the callback.
 */
export function startWatchdog(
  _streamingAtom: Atom<StreamingState>,
  _messagesAtom: Atom<MessageList>,
  pushStatus: StatusRowPusher,
): WatchdogHandle {
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const scheduleCheck = () => {
    if (stopped) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      if (!stopped) {
        pushStatus("[watchdog] stream stall detected — no data for 30s")
      }
    }, STALL_TIMEOUT_MS)
  }

  // Start the first check
  scheduleCheck()

  return {
    touch() {
      if (!stopped) scheduleCheck()
    },
    stop() {
      stopped = true
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}
