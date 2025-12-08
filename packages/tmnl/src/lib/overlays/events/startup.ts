/**
 * Startup Replay
 *
 * Replays events from the EventJournal to rebuild state on application start.
 * Call replayEvents() once after the runtime is initialized.
 */

import { EventLog, EventJournal, Entry } from "@effect/experimental"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { OverlayRegistry } from "../services/OverlayRegistry"
import { PortHub } from "../services/PortHub"
import { ContainerEvents } from "./container"
import { OverlayEvents } from "./overlay"
import { PortEvents } from "./port"

// ─────────────────────────────────────────────────────────────
// Entry Decoder Registry
// ─────────────────────────────────────────────────────────────

/**
 * Decodes an entry's payload based on its event tag.
 */
const decodePayload = (entry: Entry): Effect.Effect<unknown> => {
  // Entry has event (tag), primaryKey, and payload (Uint8Array)
  const event = entry.event

  // Find the matching event schema
  const decoder = new TextDecoder()

  return Effect.try(() => {
    const jsonStr = decoder.decode(entry.payload)
    return JSON.parse(jsonStr)
  })
}

// ─────────────────────────────────────────────────────────────
// Replay Logic
// ─────────────────────────────────────────────────────────────

/**
 * Replays all journal entries to rebuild state.
 *
 * This should be called once on application startup, after
 * the EventLog runtime is initialized but before user interaction.
 *
 * The handlers will process each event in order, updating the
 * Ref-based services to match the persisted state.
 *
 * @example
 * ```tsx
 * // In your app initialization
 * import { replayEvents } from "./overlays/events/startup"
 *
 * Effect.gen(function* () {
 *   yield* replayEvents()
 *   // Now state is restored from journal
 * }).pipe(Effect.provide(OverlayEventLogLive))
 * ```
 */
export const replayEvents = Effect.gen(function* () {
  const journal = yield* EventJournal
  const log = yield* EventLog

  // Get all persisted entries
  const entries = yield* journal.entries

  // Track replay stats
  let replayed = 0
  let skipped = 0
  const errors: Array<{ entry: Entry; error: unknown }> = []

  // Process each entry in order
  for (const entry of entries) {
    try {
      // Decode the payload
      const payload = yield* decodePayload(entry)

      // Write to EventLog - handlers will process it
      // This uses the same path as normal writes, so handlers execute
      yield* log.write(entry.event as any, payload)

      replayed++
    } catch (error) {
      errors.push({ entry, error })
      skipped++
    }
  }

  return {
    total: entries.length,
    replayed,
    skipped,
    errors,
  }
})

/**
 * Replay stats returned by replayEvents().
 */
export interface ReplayStats {
  /** Total entries in journal */
  total: number
  /** Successfully replayed */
  replayed: number
  /** Skipped due to errors */
  skipped: number
  /** Errors encountered */
  errors: Array<{ entry: Entry; error: unknown }>
}

// ─────────────────────────────────────────────────────────────
// Alternative: Startup Layer
// ─────────────────────────────────────────────────────────────

/**
 * Layer that automatically replays events on startup.
 *
 * Add this to your layer composition to auto-replay:
 *
 * @example
 * ```tsx
 * const AppLive = OverlayEventLogLive.pipe(
 *   Layer.provide(StartupReplayLive)
 * )
 * ```
 */
export const StartupReplayLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const stats = yield* replayEvents
    yield* Effect.log(`EventLog replay complete: ${stats.replayed}/${stats.total} events`)
    if (stats.errors.length > 0) {
      yield* Effect.logWarning(`${stats.skipped} events failed to replay`)
    }
  })
)
