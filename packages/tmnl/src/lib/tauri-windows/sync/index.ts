/**
 * Cross-Window State Sync
 *
 * Synchronizes state across multiple Tauri windows using IPC events.
 * Complements localStorage sync (which works for browser tabs) with
 * Tauri-specific event broadcasting.
 *
 * Synced State:
 * - Scale (UI zoom level)
 * - Theme (if implemented)
 * - Session atoms (if needed)
 *
 * Architecture:
 * - Main window broadcasts state changes via emit_to_all_windows
 * - Child windows listen via listen() and update local state
 * - Uses debouncing to prevent event storms
 *
 * @module
 */

import { Effect } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Event payload for scale sync
 */
export interface ScaleSyncPayload {
  readonly scale: number
  readonly source: string // Window label that originated the change
}

/**
 * Event payload for generic state sync
 */
export interface StateSyncPayload<T> {
  readonly key: string
  readonly value: T
  readonly source: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Names
// ─────────────────────────────────────────────────────────────────────────────

export const SYNC_EVENTS = {
  SCALE_CHANGED: 'tmnl:sync:scale',
  STATE_CHANGED: 'tmnl:sync:state',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Broadcast Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Broadcast scale change to all windows
 */
export function broadcastScaleChange(
  scale: number,
  sourceLabel: string
): Effect.Effect<void, never, never> {
  return Effect.gen(function* () {
    try {
      const { emit } = yield* Effect.promise(() => import('@tauri-apps/api/event'))

      yield* Effect.promise(() =>
        emit(SYNC_EVENTS.SCALE_CHANGED, {
          scale,
          source: sourceLabel,
        } satisfies ScaleSyncPayload)
      )
    } catch {
      // Not in Tauri environment, skip broadcast
    }
  })
}

/**
 * Broadcast generic state change to all windows
 */
export function broadcastStateChange<T>(
  key: string,
  value: T,
  sourceLabel: string
): Effect.Effect<void, never, never> {
  return Effect.gen(function* () {
    try {
      const { emit } = yield* Effect.promise(() => import('@tauri-apps/api/event'))

      yield* Effect.promise(() =>
        emit(SYNC_EVENTS.STATE_CHANGED, {
          key,
          value,
          source: sourceLabel,
        } satisfies StateSyncPayload<T>)
      )
    } catch {
      // Not in Tauri environment, skip broadcast
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Listener Types
// ─────────────────────────────────────────────────────────────────────────────

export type ScaleChangeHandler = (payload: ScaleSyncPayload) => void
export type StateChangeHandler<T> = (payload: StateSyncPayload<T>) => void

/**
 * Subscribe to scale changes from other windows
 *
 * @returns Cleanup function to unsubscribe
 */
export async function subscribeToScaleChanges(
  handler: ScaleChangeHandler,
  currentWindowLabel: string
): Promise<() => void> {
  try {
    const { listen } = await import('@tauri-apps/api/event')

    const unlisten = await listen<ScaleSyncPayload>(
      SYNC_EVENTS.SCALE_CHANGED,
      (event) => {
        // Ignore events from self
        if (event.payload.source === currentWindowLabel) return
        handler(event.payload)
      }
    )

    return unlisten
  } catch {
    // Not in Tauri environment
    return () => {}
  }
}

/**
 * Subscribe to generic state changes from other windows
 *
 * @returns Cleanup function to unsubscribe
 */
export async function subscribeToStateChanges<T>(
  key: string,
  handler: StateChangeHandler<T>,
  currentWindowLabel: string
): Promise<() => void> {
  try {
    const { listen } = await import('@tauri-apps/api/event')

    const unlisten = await listen<StateSyncPayload<T>>(
      SYNC_EVENTS.STATE_CHANGED,
      (event) => {
        // Ignore events from self and events for other keys
        if (event.payload.source === currentWindowLabel) return
        if (event.payload.key !== key) return
        handler(event.payload)
      }
    )

    return unlisten
  } catch {
    // Not in Tauri environment
    return () => {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────────────────────────────────────

export { useCrossWindowSync } from './hooks'

// ─────────────────────────────────────────────────────────────────────────────
// React Component
// ─────────────────────────────────────────────────────────────────────────────

export { ScaleSyncBridge } from './ScaleSyncBridge'
