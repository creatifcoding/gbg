/**
 * Flight Stream Handle Service
 *
 * Provides typed access to the flight-positions DurableStream.
 * Used by FlightIngester to publish flight events transactionally.
 *
 * Pattern: Effect.Service<>() with Layer composition
 *
 * @module geoint/services/FlightStreamHandle
 */

import { Context, Effect, Layer, Scope } from 'effect'
import type { EffectStreamHandle } from '@/lib/durable-streams/service'
import { DurableStreamClient } from '@/lib/durable-streams/service'
import { FlightPositionEvent } from '../schemas/flight-events'

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration for flight stream connection.
 */
export interface FlightStreamConfig {
  /** DurableStreams server URL (e.g., http://localhost:8787) */
  baseUrl: string
  /** Stream path (defaults to /flights) */
  streamPath?: string
}

/**
 * Configuration tag for FlightStreamHandle.
 */
export class FlightStreamConfigTag extends Context.Tag(
  'geoint/FlightStreamConfig'
)<FlightStreamConfigTag, FlightStreamConfig>() {}

/**
 * Default configuration layer (uses env vars).
 */
export const FlightStreamConfigDefault = Layer.succeed(
  FlightStreamConfigTag,
  {
    baseUrl: typeof import.meta !== 'undefined'
      ? (import.meta.env?.['VITE_DURABLE_STREAMS_URL'] ?? 'http://localhost:8787')
      : 'http://localhost:8787',
    streamPath: '/flights',
  }
)

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Flight stream handle service interface.
 *
 * Provides typed access to the flight-positions stream.
 */
export interface FlightStreamHandleShape {
  /**
   * Get the stream handle (creates if not exists).
   */
  readonly getHandle: () => Effect.Effect<
    EffectStreamHandle<FlightPositionEvent>,
    Error,
    Scope.Scope
  >

  /**
   * Append a single flight event to the stream.
   */
  readonly append: (
    event: FlightPositionEvent
  ) => Effect.Effect<void, Error>

  /**
   * Append a batch of flight events to the stream.
   * More efficient than appending one at a time.
   */
  readonly appendBatch: (
    events: readonly FlightPositionEvent[]
  ) => Effect.Effect<void, Error>
}

// =============================================================================
// Service Tag
// =============================================================================

/**
 * FlightStreamHandle service tag.
 */
export class FlightStreamHandle extends Context.Tag('geoint/FlightStreamHandle')<
  FlightStreamHandle,
  FlightStreamHandleShape
>() {}

// =============================================================================
// Live Layer Implementation
// =============================================================================

/**
 * Live implementation of FlightStreamHandle.
 *
 * Uses DurableStreamClient.getOrCreate() to connect to the flight stream.
 * Caches the handle for efficient reuse across multiple publishes.
 */
export const FlightStreamHandleLive = Layer.scoped(
  FlightStreamHandle,
  Effect.gen(function* () {
    const config = yield* FlightStreamConfigTag
    const dsClient = yield* DurableStreamClient

    // Build stream URL
    const streamUrl = `${config.baseUrl}${config.streamPath ?? '/flights'}`

    // Get or create the stream handle (scoped resource)
    const handle = yield* dsClient.getOrCreate<FlightPositionEvent>({
      url: streamUrl,
      contentType: 'application/json',
    })

    yield* Effect.logInfo(`[FlightStreamHandle] Connected to ${streamUrl}`)

    return {
      getHandle: () =>
        Effect.succeed(handle),

      append: (event) =>
        handle.append(event).pipe(
          Effect.tap(() =>
            Effect.logDebug(`[FlightStreamHandle] Appended event for ${event.icao24}`)
          )
        ),

      appendBatch: (events) =>
        Effect.gen(function* () {
          if (events.length === 0) return

          // Use appendBatch from handle
          yield* handle.appendBatch(events)

          yield* Effect.logDebug(
            `[FlightStreamHandle] Appended batch of ${events.length} events`
          )
        }),
    } satisfies FlightStreamHandleShape
  })
)

// =============================================================================
// Full Layer with Dependencies
// =============================================================================

/**
 * Full FlightStreamHandle layer with all dependencies.
 *
 * Requires: DurableStreamClient, FlightStreamConfig
 * Provides: FlightStreamHandle
 */
export const FlightStreamHandleFullLive = FlightStreamHandleLive.pipe(
  Layer.provide(FlightStreamConfigDefault)
)
