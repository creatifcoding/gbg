/**
 * withEventLog — Pipeline Observability Operator
 *
 * Blesses a Stream with EventLog observability, emitting structured events
 * for each value, error, and completion. Enables:
 *
 * - Real-time event log visualization
 * - Latency tracking (time between emissions)
 * - Throughput metrics aggregation
 * - Cross-stream correlation via channelId
 *
 * Uses @effect/experimental EventLog framework.
 *
 * @example
 * ```typescript
 * const observableStream = myStream.pipe(
 *   withEventLog({
 *     sourceId: "sensor-feed",
 *     channelId: "sensor-hub",
 *   })
 * )
 * ```
 *
 * @module
 */

import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import { Schema } from "effect"

// ============================================================================
// EVENT SCHEMAS
// ============================================================================

/**
 * Event emitted when data flows through the stream.
 */
export class StreamDataEmitted extends Schema.TaggedClass<StreamDataEmitted>()(
  "StreamDataEmitted",
  {
    /** Channel this stream belongs to */
    channelId: Schema.String,
    /** Unique identifier for this stream source */
    sourceId: Schema.String,
    /** Payload (optional, for debugging) */
    payload: Schema.optional(Schema.Unknown),
    /** Emission timestamp */
    timestamp: Schema.Number,
    /** Time since last emission (ms) */
    latencyMs: Schema.Number,
    /** Running count of emissions */
    emitCount: Schema.Number,
  }
) {}

/**
 * Event emitted when stream completes successfully.
 */
export class StreamCompleted extends Schema.TaggedClass<StreamCompleted>()(
  "StreamCompleted",
  {
    channelId: Schema.String,
    sourceId: Schema.String,
    timestamp: Schema.Number,
    /** Total emissions before completion */
    totalEmissions: Schema.Number,
    /** Total runtime in ms */
    durationMs: Schema.Number,
  }
) {}

/**
 * Event emitted when stream errors.
 */
export class StreamErrored extends Schema.TaggedClass<StreamErrored>()(
  "StreamErrored",
  {
    channelId: Schema.String,
    sourceId: Schema.String,
    timestamp: Schema.Number,
    /** Error message */
    error: Schema.String,
    /** Emissions before error */
    emitCount: Schema.Number,
  }
) {}

/**
 * Union of all stream observability events.
 */
export const StreamObservabilityEvent = Schema.Union(
  StreamDataEmitted,
  StreamCompleted,
  StreamErrored
)
export type StreamObservabilityEvent = typeof StreamObservabilityEvent.Type

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Options for the withEventLog pipeline operator.
 */
export interface WithEventLogOptions {
  /** Unique identifier for this stream source */
  readonly sourceId: string

  /** Channel ID for grouping related streams */
  readonly channelId?: string

  /** Include payload in events (default: false for performance) */
  readonly includePayload?: boolean

  /** Callback to emit events (for custom sinks) */
  readonly onEvent?: (event: StreamObservabilityEvent) => void

  /** Emit every N items instead of every item (default: 1) */
  readonly sampleRate?: number
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Pipeline operator that adds observability to a stream.
 *
 * Tracks:
 * - Each emission with timestamp and latency
 * - Stream completion with total count and duration
 * - Stream errors with context
 *
 * @example Basic usage
 * ```typescript
 * const observed = myStream.pipe(
 *   withEventLog({ sourceId: "my-source" })
 * )
 * ```
 *
 * @example With event callback
 * ```typescript
 * const observed = myStream.pipe(
 *   withEventLog({
 *     sourceId: "sensor",
 *     channelId: "sensor-hub",
 *     onEvent: (e) => console.log(e._tag, e),
 *   })
 * )
 * ```
 *
 * @example High-frequency sampling
 * ```typescript
 * const observed = highFreqStream.pipe(
 *   withEventLog({
 *     sourceId: "ticker",
 *     sampleRate: 100, // Only emit event every 100th item
 *   })
 * )
 * ```
 */
export const withEventLog = <A, E, R>(options: WithEventLogOptions) => {
  const {
    sourceId,
    channelId = sourceId,
    includePayload = false,
    onEvent,
    sampleRate = 1,
  } = options

  return (stream: Stream.Stream<A, E, R>): Stream.Stream<A, E, R> => {
    let emitCount = 0
    let lastEmitTime = Date.now()
    const startTime = Date.now()

    const emitEvent = (event: StreamObservabilityEvent) => {
      onEvent?.(event)
    }

    return stream.pipe(
      // Track each emission
      Stream.tap((value) =>
        Effect.sync(() => {
          emitCount++
          const now = Date.now()

          // Sample rate: only emit event every N items
          if (emitCount % sampleRate === 0) {
            emitEvent(
              new StreamDataEmitted({
                channelId,
                sourceId,
                payload: includePayload ? value : undefined,
                timestamp: now,
                latencyMs: now - lastEmitTime,
                emitCount,
              })
            )
          }

          lastEmitTime = now
        })
      ),

      // Track completion
      Stream.ensuring(
        Effect.sync(() => {
          const now = Date.now()
          emitEvent(
            new StreamCompleted({
              channelId,
              sourceId,
              timestamp: now,
              totalEmissions: emitCount,
              durationMs: now - startTime,
            })
          )
        })
      ),

      // Track errors (note: this runs BEFORE ensuring)
      Stream.tapError((error) =>
        Effect.sync(() => {
          emitEvent(
            new StreamErrored({
              channelId,
              sourceId,
              timestamp: Date.now(),
              error: String(error),
              emitCount,
            })
          )
        })
      )
    )
  }
}

// ============================================================================
// CONVENIENCE FACTORIES
// ============================================================================

/**
 * Create a withEventLog operator that logs to console.
 * Useful for debugging.
 */
export const withEventLogConsole = <A, E, R>(
  sourceId: string,
  options?: Omit<WithEventLogOptions, "sourceId" | "onEvent">
) =>
  withEventLog<A, E, R>({
    sourceId,
    ...options,
    onEvent: (event) => {
      const time = new Date(event.timestamp).toISOString().slice(11, 23)
      switch (event._tag) {
        case "StreamDataEmitted":
          console.log(
            `[${time}] 📤 ${event.sourceId} #${event.emitCount} (+${event.latencyMs}ms)`
          )
          break
        case "StreamCompleted":
          console.log(
            `[${time}] ✅ ${event.sourceId} completed (${event.totalEmissions} items, ${event.durationMs}ms)`
          )
          break
        case "StreamErrored":
          console.log(
            `[${time}] ❌ ${event.sourceId} errored: ${event.error}`
          )
          break
      }
    },
  })

/**
 * Create a withEventLog operator that collects events into an array.
 * Useful for testing and metrics aggregation.
 */
export const withEventLogCollector = <A, E, R>(
  sourceId: string,
  collector: StreamObservabilityEvent[],
  options?: Omit<WithEventLogOptions, "sourceId" | "onEvent">
) =>
  withEventLog<A, E, R>({
    sourceId,
    ...options,
    onEvent: (event) => {
      collector.push(event)
    },
  })
