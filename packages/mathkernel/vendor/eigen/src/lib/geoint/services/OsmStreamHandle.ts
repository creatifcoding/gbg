/**
 * OSM Stream Handle Service
 *
 * Provides typed access to the poi-positions DurableStream.
 * Used by OsmIngester to publish POI events transactionally.
 *
 * Pattern: Effect.Service<>() with Layer composition
 *
 * @module geoint/services/OsmStreamHandle
 */

import { Context, Effect, Layer, Scope } from 'effect'
import type { EffectStreamHandle } from '@/lib/durable-streams/service'
import { DurableStreamClient } from '@/lib/durable-streams/service'
import { PoiPositionEvent } from '../schemas/poi-events'

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration for OSM stream connection.
 */
export interface OsmStreamConfig {
  /** DurableStreams server URL (e.g., http://localhost:8787) */
  baseUrl: string
  /** Stream path (defaults to /pois) */
  streamPath?: string
}

/**
 * Configuration tag for OsmStreamHandle.
 */
export class OsmStreamConfigTag extends Context.Tag(
  'geoint/OsmStreamConfig'
)<OsmStreamConfigTag, OsmStreamConfig>() {}

/**
 * Default configuration layer (uses env vars).
 */
export const OsmStreamConfigDefault = Layer.succeed(
  OsmStreamConfigTag,
  {
    baseUrl: typeof import.meta !== 'undefined'
      ? (import.meta.env?.['VITE_DURABLE_STREAMS_URL'] ?? 'http://localhost:8787')
      : 'http://localhost:8787',
    streamPath: '/pois',
  }
)

// =============================================================================
// Service Interface
// =============================================================================

/**
 * OSM stream handle service interface.
 *
 * Provides typed access to the poi-positions stream.
 */
export interface OsmStreamHandleShape {
  /**
   * Get the stream handle (creates if not exists).
   */
  readonly getHandle: () => Effect.Effect<
    EffectStreamHandle<PoiPositionEvent>,
    Error,
    Scope.Scope
  >

  /**
   * Append a single POI event to the stream.
   */
  readonly append: (
    event: PoiPositionEvent
  ) => Effect.Effect<void, Error>

  /**
   * Append a batch of POI events to the stream.
   * More efficient than appending one at a time.
   */
  readonly appendBatch: (
    events: readonly PoiPositionEvent[]
  ) => Effect.Effect<void, Error>
}

// =============================================================================
// Service Tag
// =============================================================================

/**
 * OsmStreamHandle service tag.
 */
export class OsmStreamHandle extends Context.Tag('geoint/OsmStreamHandle')<
  OsmStreamHandle,
  OsmStreamHandleShape
>() {}

// =============================================================================
// Live Layer Implementation
// =============================================================================

/**
 * Live implementation of OsmStreamHandle.
 *
 * Uses DurableStreamClient.getOrCreate() to connect to the POI stream.
 * Caches the handle for efficient reuse across multiple publishes.
 */
export const OsmStreamHandleLive = Layer.scoped(
  OsmStreamHandle,
  Effect.gen(function* () {
    const config = yield* OsmStreamConfigTag
    const dsClient = yield* DurableStreamClient

    // Build stream URL
    const streamUrl = `${config.baseUrl}${config.streamPath ?? '/pois'}`

    // Get or create the stream handle (scoped resource)
    const handle = yield* dsClient.getOrCreate<PoiPositionEvent>({
      url: streamUrl,
      contentType: 'application/json',
    })

    yield* Effect.logInfo(`[OsmStreamHandle] Connected to ${streamUrl}`)

    return {
      getHandle: () =>
        Effect.succeed(handle),

      append: (event) =>
        handle.append(event).pipe(
          Effect.tap(() =>
            Effect.logDebug(`[OsmStreamHandle] Appended event for OSM ${event.osmType}:${event.osmId}`)
          )
        ),

      appendBatch: (events) =>
        Effect.gen(function* () {
          if (events.length === 0) return

          // Use appendBatch from handle
          yield* handle.appendBatch(events)

          yield* Effect.logDebug(
            `[OsmStreamHandle] Appended batch of ${events.length} POI events`
          )
        }),
    } satisfies OsmStreamHandleShape
  })
)

// =============================================================================
// Full Layer with Dependencies
// =============================================================================

/**
 * Full OsmStreamHandle layer with all dependencies.
 *
 * Requires: DurableStreamClient, OsmStreamConfig
 * Provides: OsmStreamHandle
 */
export const OsmStreamHandleFullLive = OsmStreamHandleLive.pipe(
  Layer.provide(OsmStreamConfigDefault)
)
