/**
 * Durable-Streams Tracing & Metrics Infrastructure
 *
 * Effect-native observability for durable-streams operations.
 * Provides:
 * - Request latency histogram per operation
 * - Request counter per operation/stream
 * - Error counter per operation/error type
 * - Message throughput counter
 * - Active connection gauge
 *
 * @see https://effect.website/docs/observability/metrics
 * @module holonet/durable-streams/metrics/tracing
 */

import { Effect, Metric, MetricBoundaries } from 'effect';

// =============================================================================
// Types
// =============================================================================

/**
 * Stream operations for type-safe tagging
 */
export type StreamOperation =
  | 'create'
  | 'append'
  | 'read'
  | 'delete'
  | 'longPoll'
  | 'sse'
  | 'subscribe';

/**
 * Array of all operations for iteration
 */
export const STREAM_OPERATIONS: readonly StreamOperation[] = [
  'create',
  'append',
  'read',
  'delete',
  'longPoll',
  'sse',
  'subscribe',
] as const;

/**
 * Error type classification for metrics
 */
export type DsErrorType =
  | 'auth_error'
  | 'validation_error'
  | 'not_found'
  | 'conflict'
  | 'timeout'
  | 'nats_error'
  | 'codec_error'
  | 'unknown';

// =============================================================================
// Base Metrics
// =============================================================================

/**
 * Histogram tracking operation latencies in milliseconds.
 * Buckets: Exponential from 1ms to ~2 seconds (for fast ops like append)
 */
export const operationLatencyHistogram = Metric.histogram(
  'durable_streams.operation.latency_ms',
  MetricBoundaries.exponential({ start: 1, factor: 2, count: 12 })
);

/**
 * Counter tracking total operations.
 */
export const operationCounter = Metric.counter('durable_streams.operations');

/**
 * Counter tracking operation errors.
 */
export const errorCounter = Metric.counter('durable_streams.errors');

/**
 * Counter tracking messages published.
 */
export const messagesPublishedCounter = Metric.counter('durable_streams.messages.published');

/**
 * Counter tracking messages consumed.
 */
export const messagesConsumedCounter = Metric.counter('durable_streams.messages.consumed');

/**
 * Counter tracking bytes published.
 */
export const bytesPublishedCounter = Metric.counter('durable_streams.bytes.published');

/**
 * Counter tracking bytes consumed.
 */
export const bytesConsumedCounter = Metric.counter('durable_streams.bytes.consumed');

/**
 * Gauge tracking active SSE connections.
 */
export const activeSSEConnectionsGauge = Metric.gauge('durable_streams.sse.active_connections');

/**
 * Gauge tracking active subscriptions.
 */
export const activeSubscriptionsGauge = Metric.gauge('durable_streams.subscriptions.active');

// =============================================================================
// Metric Recording Helpers
// =============================================================================

/**
 * Record a latency measurement for an operation
 */
export const recordLatency = (
  operation: StreamOperation,
  latencyMs: number,
  streamId?: string
) =>
  operationLatencyHistogram.pipe(
    Metric.tagged('operation', operation),
    streamId ? Metric.tagged('stream', streamId) : (m) => m,
    (m) => Metric.update(m, latencyMs)
  );

/**
 * Increment the operation counter
 */
export const incrementOperations = (operation: StreamOperation, streamId?: string) =>
  operationCounter.pipe(
    Metric.tagged('operation', operation),
    streamId ? Metric.tagged('stream', streamId) : (m) => m,
    (m) => Metric.increment(m)
  );

/**
 * Increment the error counter
 */
export const incrementErrors = (operation: StreamOperation, errorType: DsErrorType) =>
  errorCounter.pipe(
    Metric.tagged('operation', operation),
    Metric.tagged('error_type', errorType),
    (m) => Metric.increment(m)
  );

/**
 * Increment the messages published counter
 */
export const incrementMessagesPublished = (streamId: string, count: number = 1) =>
  messagesPublishedCounter.pipe(
    Metric.tagged('stream', streamId),
    (m) => Metric.incrementBy(m, count)
  );

/**
 * Increment the messages consumed counter
 */
export const incrementMessagesConsumed = (streamId: string, count: number = 1) =>
  messagesConsumedCounter.pipe(
    Metric.tagged('stream', streamId),
    (m) => Metric.incrementBy(m, count)
  );

/**
 * Increment the bytes published counter
 */
export const incrementBytesPublished = (streamId: string, bytes: number) =>
  bytesPublishedCounter.pipe(
    Metric.tagged('stream', streamId),
    (m) => Metric.incrementBy(m, bytes)
  );

/**
 * Increment the bytes consumed counter
 */
export const incrementBytesConsumed = (streamId: string, bytes: number) =>
  bytesConsumedCounter.pipe(
    Metric.tagged('stream', streamId),
    (m) => Metric.incrementBy(m, bytes)
  );

/**
 * Increment active SSE connections gauge
 */
export const incrementSSEConnections = (streamId: string) =>
  activeSSEConnectionsGauge.pipe(
    Metric.tagged('stream', streamId),
    (m) => Metric.increment(m)
  );

/**
 * Decrement active SSE connections gauge
 */
export const decrementSSEConnections = (streamId: string) =>
  activeSSEConnectionsGauge.pipe(
    Metric.tagged('stream', streamId),
    (m) => Metric.incrementBy(m, -1)
  );

/**
 * Increment active subscriptions gauge
 */
export const incrementSubscriptions = (streamId: string) =>
  activeSubscriptionsGauge.pipe(
    Metric.tagged('stream', streamId),
    (m) => Metric.increment(m)
  );

/**
 * Decrement active subscriptions gauge
 */
export const decrementSubscriptions = (streamId: string) =>
  activeSubscriptionsGauge.pipe(
    Metric.tagged('stream', streamId),
    (m) => Metric.incrementBy(m, -1)
  );

// =============================================================================
// Error Classification
// =============================================================================

/**
 * Classify an error into a DsErrorType for metrics
 */
export const classifyError = (error: unknown): DsErrorType => {
  if (error && typeof error === 'object' && '_tag' in error) {
    const tag = (error as { _tag: string })._tag;

    // Auth errors
    if (tag === 'Unauthorized' || tag === 'Forbidden') return 'auth_error';

    // Codec errors (check before validation to distinguish)
    if (tag === 'EncodeError' || tag === 'DecodeError' || tag === 'CodecError') return 'codec_error';

    // Validation errors
    if (tag === 'SchemaNotFoundError') return 'validation_error';

    // Not found
    if (tag === 'StreamNotFoundError') return 'not_found';

    // Conflicts
    if (tag === 'StreamExistsError' || tag === 'SequenceConflictError') return 'conflict';

    // Timeout
    if (tag === 'TimeoutError' || tag === 'LongPollTimeoutError') return 'timeout';

    // NATS errors
    if (tag.includes('Nats') || tag.includes('NATS')) return 'nats_error';
  }
  return 'unknown';
};

// =============================================================================
// Higher-Order Tracing Wrapper
// =============================================================================

/**
 * Wrap a durable-streams operation with tracing and metrics.
 *
 * This higher-order function adds:
 * - Operation counter increment
 * - Latency histogram recording
 * - Error counter increment on failure
 *
 * @example
 * ```typescript
 * const appendWithTracing = withDsTracing('append', 'my-stream')(
 *   bridgeService.append(streamId, data)
 * )
 * ```
 */
export const withDsTracing =
  (operation: StreamOperation, streamId?: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.gen(function* () {
      // Increment operation counter
      yield* incrementOperations(operation, streamId);

      const startTime = Date.now();

      const result = yield* effect.pipe(
        Effect.tapBoth({
          onSuccess: () =>
            recordLatency(operation, Date.now() - startTime, streamId),
          onFailure: (e) =>
            Effect.all([
              recordLatency(operation, Date.now() - startTime, streamId),
              incrementErrors(operation, classifyError(e)),
            ]),
        })
      );

      return result;
    });

/**
 * Track SSE connection lifecycle with metrics.
 *
 * Increments active connections on start, decrements on cleanup.
 *
 * @example
 * ```typescript
 * const trackedSSE = withSSETracking('my-stream')(sseStream)
 * ```
 */
export const withSSETracking =
  (streamId: string) =>
  <A, E, R>(stream: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.acquireUseRelease(
      incrementSSEConnections(streamId),
      () => stream,
      () => decrementSSEConnections(streamId)
    );

/**
 * Track subscription lifecycle with metrics.
 *
 * Increments active subscriptions on start, decrements on cleanup.
 *
 * @example
 * ```typescript
 * const trackedSubscription = withSubscriptionTracking('my-stream')(subscribeEffect)
 * ```
 */
export const withSubscriptionTracking =
  (streamId: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.acquireUseRelease(
      incrementSubscriptions(streamId),
      () => effect,
      () => decrementSubscriptions(streamId)
    );
