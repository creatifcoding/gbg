/**
 * Weather Stream Handle Service
 *
 * Provides typed access to the /weather DurableStream for weather observation events.
 * Used by WeatherIngester for transactional outbox pattern.
 *
 * Pattern: Effect.Service<>() with DurableStreamClient dependency
 *
 * @module geoint/services/WeatherStreamHandle
 */

import { Context, Effect, Layer } from 'effect'
import { DurableStreamClient, type EffectStreamHandle } from '@/lib/durable-streams/service'
import { WeatherObservationEvent } from '../schemas/weather-events'

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration for WeatherStreamHandle.
 */
export interface WeatherStreamConfig {
  /** DurableStreams server URL */
  durableStreamsUrl: string
  /** Stream path for weather observations */
  weatherStreamPath?: string
}

/**
 * Configuration tag.
 */
export class WeatherStreamConfigTag extends Context.Tag(
  'geoint/WeatherStreamConfig'
)<WeatherStreamConfigTag, WeatherStreamConfig>() {}

/**
 * Default configuration.
 */
export const WeatherStreamConfigDefault = Layer.succeed(
  WeatherStreamConfigTag,
  {
    durableStreamsUrl: 'http://localhost:8787',
    weatherStreamPath: '/weather',
  }
)

// =============================================================================
// Service Interface
// =============================================================================

/**
 * WeatherStreamHandle service interface.
 *
 * Wraps a DurableStream handle for typed weather observation events.
 */
export interface WeatherStreamHandleShape {
  /**
   * Append a single weather observation event to the stream.
   */
  readonly append: (event: WeatherObservationEvent) => Effect.Effect<void, Error>

  /**
   * Append multiple weather observation events to the stream.
   */
  readonly appendBatch: (events: readonly WeatherObservationEvent[]) => Effect.Effect<void, Error>

  /**
   * Get the underlying stream handle for subscription.
   */
  readonly handle: EffectStreamHandle<WeatherObservationEvent>
}

// =============================================================================
// Service Tag
// =============================================================================

/**
 * WeatherStreamHandle service tag.
 */
export class WeatherStreamHandle extends Context.Tag('geoint/WeatherStreamHandle')<
  WeatherStreamHandle,
  WeatherStreamHandleShape
>() {}

// =============================================================================
// Live Layer Implementation
// =============================================================================

/**
 * Live implementation of WeatherStreamHandle.
 *
 * Connects to DurableStream and provides typed append operations.
 */
export const WeatherStreamHandleLive = Layer.scoped(
  WeatherStreamHandle,
  Effect.gen(function* () {
    const config = yield* WeatherStreamConfigTag
    const dsClient = yield* DurableStreamClient

    const streamUrl = `${config.durableStreamsUrl}${config.weatherStreamPath ?? '/weather'}`

    yield* Effect.logDebug(`[WeatherStreamHandle] Connecting to ${streamUrl}`)

    // Get or create the stream handle
    const handle = yield* dsClient.getOrCreate<WeatherObservationEvent>({
      url: streamUrl,
      contentType: 'application/json',
    })

    yield* Effect.logDebug('[WeatherStreamHandle] Connected')

    /**
     * Append a single event.
     */
    const append: WeatherStreamHandleShape['append'] = (event) =>
      handle.append(event).pipe(
        Effect.mapError((e) => new Error(`Weather stream append failed: ${String(e)}`))
      )

    /**
     * Append multiple events.
     */
    const appendBatch: WeatherStreamHandleShape['appendBatch'] = (events) => {
      if (events.length === 0) {
        return Effect.void
      }
      return handle.appendBatch([...events]).pipe(
        Effect.mapError((e) => new Error(`Weather stream batch append failed: ${String(e)}`))
      )
    }

    return {
      append,
      appendBatch,
      handle,
    } satisfies WeatherStreamHandleShape
  })
)

// =============================================================================
// Full Layer with Dependencies
// =============================================================================

/**
 * WeatherStreamHandle with default config.
 *
 * Requires: DurableStreamClient
 */
export const WeatherStreamHandleFullLive = WeatherStreamHandleLive.pipe(
  Layer.provide(WeatherStreamConfigDefault)
)
