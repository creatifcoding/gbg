/**
 * Durable-Streams Metrics Snapshot Service
 *
 * Effect service for capturing and exporting metrics snapshots.
 * Periodically takes snapshots of histogram buckets, counters, and gauges.
 *
 * @module holonet/durable-streams/metrics/snapshot
 */

import {
  Effect,
  Schedule,
  Duration,
  Schema,
  Context,
  Layer,
  Ref,
  Fiber,
  Metric,
} from 'effect';
import {
  operationLatencyHistogram,
  operationCounter,
  errorCounter,
  messagesPublishedCounter,
  messagesConsumedCounter,
  bytesPublishedCounter,
  bytesConsumedCounter,
  activeSSEConnectionsGauge,
  activeSubscriptionsGauge,
  STREAM_OPERATIONS,
} from './tracing';

// =============================================================================
// Schemas
// =============================================================================

/**
 * Schema for latency histogram bucket data
 */
const LatencyBucketData = Schema.Struct({
  buckets: Schema.Array(Schema.Tuple(Schema.Number, Schema.Number)),
  count: Schema.Number,
  min: Schema.Number,
  max: Schema.Number,
  sum: Schema.Number,
});

type LatencyBucketDataType = typeof LatencyBucketData.Type;

/**
 * Schema for durable-streams metrics snapshot
 */
export class DsMetricsSnapshot extends Schema.Class<DsMetricsSnapshot>('DsMetricsSnapshot')({
  /** Timestamp when snapshot was taken */
  timestamp: Schema.Date,
  /** Latency histogram data per operation: operation -> bucket counts */
  latencyHistogram: Schema.Record({ key: Schema.String, value: LatencyBucketData }),
  /** Operation counts per operation: operation -> count */
  operationCounts: Schema.Record({ key: Schema.String, value: Schema.Number }),
  /** Error counts per operation: operation -> count */
  errorCounts: Schema.Record({ key: Schema.String, value: Schema.Number }),
  /** Messages published total */
  messagesPublished: Schema.Number,
  /** Messages consumed total */
  messagesConsumed: Schema.Number,
  /** Bytes published total */
  bytesPublished: Schema.Number,
  /** Bytes consumed total */
  bytesConsumed: Schema.Number,
  /** Active SSE connections */
  activeSSEConnections: Schema.Number,
  /** Active subscriptions */
  activeSubscriptions: Schema.Number,
}) {}

/**
 * Schema for snapshot history
 */
export class DsMetricsHistory extends Schema.Class<DsMetricsHistory>('DsMetricsHistory')({
  /** All captured snapshots */
  snapshots: Schema.Array(DsMetricsSnapshot),
  /** Maximum number of snapshots to retain */
  maxSnapshots: Schema.Number,
}) {}

// =============================================================================
// Snapshot Effect
// =============================================================================

/**
 * Take a snapshot of current durable-streams metrics state
 */
export const takeMetricsSnapshot: Effect.Effect<DsMetricsSnapshot> = Effect.gen(function* () {
  const timestamp = new Date();

  // Collect latency histogram data for each operation
  const latencyHistogram: Record<string, LatencyBucketDataType> = {};
  for (const operation of STREAM_OPERATIONS) {
    const taggedHistogram = Metric.tagged(operationLatencyHistogram, 'operation', operation);
    const state = yield* Metric.value(taggedHistogram);

    latencyHistogram[operation] = {
      buckets: state.buckets as Array<[number, number]>,
      count: state.count,
      min: state.min,
      max: state.max,
      sum: state.sum,
    };
  }

  // Collect operation counts for each operation
  const operationCounts: Record<string, number> = {};
  for (const operation of STREAM_OPERATIONS) {
    const taggedCounter = Metric.tagged(operationCounter, 'operation', operation);
    const state = yield* Metric.value(taggedCounter);
    operationCounts[operation] = state.count;
  }

  // Collect error counts for each operation
  const errorCounts: Record<string, number> = {};
  for (const operation of STREAM_OPERATIONS) {
    const taggedCounter = Metric.tagged(errorCounter, 'operation', operation);
    const state = yield* Metric.value(taggedCounter);
    errorCounts[operation] = state.count;
  }

  // Collect throughput metrics
  const messagesPublishedState = yield* Metric.value(messagesPublishedCounter);
  const messagesConsumedState = yield* Metric.value(messagesConsumedCounter);
  const bytesPublishedState = yield* Metric.value(bytesPublishedCounter);
  const bytesConsumedState = yield* Metric.value(bytesConsumedCounter);

  // Collect gauge metrics
  const sseConnectionsState = yield* Metric.value(activeSSEConnectionsGauge);
  const subscriptionsState = yield* Metric.value(activeSubscriptionsGauge);

  return new DsMetricsSnapshot({
    timestamp,
    latencyHistogram,
    operationCounts,
    errorCounts,
    messagesPublished: messagesPublishedState.count,
    messagesConsumed: messagesConsumedState.count,
    bytesPublished: bytesPublishedState.count,
    bytesConsumed: bytesConsumedState.count,
    activeSSEConnections: sseConnectionsState.value,
    activeSubscriptions: subscriptionsState.value,
  });
});

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Durable-Streams Metrics service interface
 */
export interface DsMetrics {
  /** Take a snapshot of current metrics */
  readonly takeSnapshot: Effect.Effect<DsMetricsSnapshot>;
  /** Get the latest snapshot */
  readonly getLatestSnapshot: Effect.Effect<DsMetricsSnapshot | null>;
  /** Get all captured snapshots */
  readonly getHistory: Effect.Effect<readonly DsMetricsSnapshot[]>;
  /** Start periodic snapshot collection */
  readonly startPeriodicSnapshots: Effect.Effect<void>;
  /** Stop periodic snapshot collection */
  readonly stopPeriodicSnapshots: Effect.Effect<void>;
  /** Clear all snapshots */
  readonly clearHistory: Effect.Effect<void>;
}

/**
 * Durable-Streams Metrics service tag for dependency injection
 */
export class DsMetricsService extends Context.Tag('holonet/durable-streams/DsMetrics')<
  DsMetricsService,
  DsMetrics
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Default snapshot interval (10 seconds)
 */
const DEFAULT_SNAPSHOT_INTERVAL = Duration.seconds(10);

/**
 * Default maximum snapshots to retain (360 = 1 hour at 10s interval)
 */
const DEFAULT_MAX_SNAPSHOTS = 360;

/**
 * Create the metrics snapshot service
 */
const makeDsMetricsService = (config?: {
  snapshotInterval?: Duration.Duration;
  maxSnapshots?: number;
}): Effect.Effect<DsMetrics> =>
  Effect.gen(function* () {
    const snapshotInterval = config?.snapshotInterval ?? DEFAULT_SNAPSHOT_INTERVAL;
    const maxSnapshots = config?.maxSnapshots ?? DEFAULT_MAX_SNAPSHOTS;

    // State: captured snapshots
    const snapshots = yield* Ref.make<readonly DsMetricsSnapshot[]>([]);

    // State: periodic snapshot fiber (if running)
    const snapshotFiber = yield* Ref.make<Fiber.RuntimeFiber<void, never> | null>(null);

    /**
     * Take snapshot and add to history
     */
    const takeSnapshotAndStore: Effect.Effect<DsMetricsSnapshot> = Effect.gen(function* () {
      const snapshot = yield* takeMetricsSnapshot;

      yield* Ref.update(snapshots, (history) => {
        const newHistory = [...history, snapshot];
        // Trim to max snapshots
        if (newHistory.length > maxSnapshots) {
          return newHistory.slice(newHistory.length - maxSnapshots);
        }
        return newHistory;
      });

      return snapshot;
    });

    /**
     * Periodic snapshot schedule
     */
    const snapshotSchedule = Schedule.spaced(snapshotInterval);

    const takeSnapshot: DsMetrics['takeSnapshot'] = takeSnapshotAndStore;

    const getLatestSnapshot: DsMetrics['getLatestSnapshot'] = Effect.gen(function* () {
      const history = yield* Ref.get(snapshots);
      return history.length > 0 ? history[history.length - 1] ?? null : null;
    });

    const getHistory: DsMetrics['getHistory'] = Ref.get(snapshots);

    const startPeriodicSnapshots: DsMetrics['startPeriodicSnapshots'] = Effect.gen(function* () {
      // Check if already running
      const existingFiber = yield* Ref.get(snapshotFiber);
      if (existingFiber !== null) {
        return; // Already running
      }

      // Start periodic snapshot collection
      const fiber = yield* Effect.fork(
        Effect.repeat(
          takeSnapshotAndStore.pipe(
            Effect.asVoid,
            Effect.catchAll((error) =>
              Effect.logError(`Failed to take durable-streams metrics snapshot: ${error}`)
            )
          ),
          snapshotSchedule
        ).pipe(Effect.asVoid)
      );

      yield* Ref.set(snapshotFiber, fiber);
      yield* Effect.logInfo('Started periodic durable-streams metrics snapshot collection');
    });

    const stopPeriodicSnapshots: DsMetrics['stopPeriodicSnapshots'] = Effect.gen(function* () {
      const fiber = yield* Ref.get(snapshotFiber);
      if (fiber === null) {
        return; // Not running
      }

      yield* Fiber.interrupt(fiber);
      yield* Ref.set(snapshotFiber, null);
      yield* Effect.logInfo('Stopped periodic durable-streams metrics snapshot collection');
    });

    const clearHistory: DsMetrics['clearHistory'] = Ref.set(snapshots, []);

    return {
      takeSnapshot,
      getLatestSnapshot,
      getHistory,
      startPeriodicSnapshots,
      stopPeriodicSnapshots,
      clearHistory,
    } satisfies DsMetrics;
  });

// =============================================================================
// Layer
// =============================================================================

/**
 * Default Durable-Streams Metrics service layer
 */
export const DsMetricsLive: Layer.Layer<DsMetricsService> = Layer.effect(
  DsMetricsService,
  makeDsMetricsService()
);

/**
 * Create Durable-Streams Metrics service layer with custom configuration
 */
export const DsMetricsConfigured = (config: {
  snapshotInterval?: Duration.Duration;
  maxSnapshots?: number;
}): Layer.Layer<DsMetricsService> => Layer.effect(DsMetricsService, makeDsMetricsService(config));

// =============================================================================
// Convenience Effects
// =============================================================================

/**
 * Take a snapshot using the service from context
 */
export const takeSnapshot: Effect.Effect<DsMetricsSnapshot, never, DsMetricsService> =
  Effect.flatMap(DsMetricsService, (svc) => svc.takeSnapshot);

/**
 * Get the latest snapshot using the service from context
 */
export const getLatestSnapshot: Effect.Effect<DsMetricsSnapshot | null, never, DsMetricsService> =
  Effect.flatMap(DsMetricsService, (svc) => svc.getLatestSnapshot);

/**
 * Get snapshot history using the service from context
 */
export const getHistory: Effect.Effect<readonly DsMetricsSnapshot[], never, DsMetricsService> =
  Effect.flatMap(DsMetricsService, (svc) => svc.getHistory);

/**
 * Start periodic snapshots using the service from context
 */
export const startPeriodicSnapshots: Effect.Effect<void, never, DsMetricsService> = Effect.flatMap(
  DsMetricsService,
  (svc) => svc.startPeriodicSnapshots
);

/**
 * Stop periodic snapshots using the service from context
 */
export const stopPeriodicSnapshots: Effect.Effect<void, never, DsMetricsService> = Effect.flatMap(
  DsMetricsService,
  (svc) => svc.stopPeriodicSnapshots
);

/**
 * Clear snapshot history using the service from context
 */
export const clearHistory: Effect.Effect<void, never, DsMetricsService> = Effect.flatMap(
  DsMetricsService,
  (svc) => svc.clearHistory
);

// =============================================================================
// Export Formats
// =============================================================================

/**
 * Convert snapshot to Prometheus exposition format
 */
export const snapshotToPrometheus = (snapshot: DsMetricsSnapshot): string => {
  const lines: string[] = [];
  const timestamp = snapshot.timestamp.getTime();

  // Latency histogram
  lines.push('# HELP durable_streams_operation_latency_ms Operation latency distribution in milliseconds');
  lines.push('# TYPE durable_streams_operation_latency_ms histogram');
  for (const [operation, data] of Object.entries(snapshot.latencyHistogram)) {
    for (const [le, count] of data.buckets) {
      const leLabel = le === Infinity ? '+Inf' : le.toString();
      lines.push(
        `durable_streams_operation_latency_ms_bucket{operation="${operation}",le="${leLabel}"} ${count} ${timestamp}`
      );
    }
    lines.push(`durable_streams_operation_latency_ms_count{operation="${operation}"} ${data.count} ${timestamp}`);
    lines.push(`durable_streams_operation_latency_ms_sum{operation="${operation}"} ${data.sum} ${timestamp}`);
  }

  // Operation counter
  lines.push('# HELP durable_streams_operations_total Total number of operations');
  lines.push('# TYPE durable_streams_operations_total counter');
  for (const [operation, count] of Object.entries(snapshot.operationCounts)) {
    lines.push(`durable_streams_operations_total{operation="${operation}"} ${count} ${timestamp}`);
  }

  // Error counter
  lines.push('# HELP durable_streams_errors_total Total number of errors');
  lines.push('# TYPE durable_streams_errors_total counter');
  for (const [operation, count] of Object.entries(snapshot.errorCounts)) {
    lines.push(`durable_streams_errors_total{operation="${operation}"} ${count} ${timestamp}`);
  }

  // Throughput counters
  lines.push('# HELP durable_streams_messages_published_total Total messages published');
  lines.push('# TYPE durable_streams_messages_published_total counter');
  lines.push(`durable_streams_messages_published_total ${snapshot.messagesPublished} ${timestamp}`);

  lines.push('# HELP durable_streams_messages_consumed_total Total messages consumed');
  lines.push('# TYPE durable_streams_messages_consumed_total counter');
  lines.push(`durable_streams_messages_consumed_total ${snapshot.messagesConsumed} ${timestamp}`);

  lines.push('# HELP durable_streams_bytes_published_total Total bytes published');
  lines.push('# TYPE durable_streams_bytes_published_total counter');
  lines.push(`durable_streams_bytes_published_total ${snapshot.bytesPublished} ${timestamp}`);

  lines.push('# HELP durable_streams_bytes_consumed_total Total bytes consumed');
  lines.push('# TYPE durable_streams_bytes_consumed_total counter');
  lines.push(`durable_streams_bytes_consumed_total ${snapshot.bytesConsumed} ${timestamp}`);

  // Active connections gauges
  lines.push('# HELP durable_streams_sse_active_connections Active SSE connections');
  lines.push('# TYPE durable_streams_sse_active_connections gauge');
  lines.push(`durable_streams_sse_active_connections ${snapshot.activeSSEConnections} ${timestamp}`);

  lines.push('# HELP durable_streams_subscriptions_active Active subscriptions');
  lines.push('# TYPE durable_streams_subscriptions_active gauge');
  lines.push(`durable_streams_subscriptions_active ${snapshot.activeSubscriptions} ${timestamp}`);

  return lines.join('\n');
};

/**
 * Convert snapshot to JSON format for API responses
 */
export const snapshotToJson = (snapshot: DsMetricsSnapshot): Record<string, unknown> => ({
  timestamp: snapshot.timestamp.toISOString(),
  latencyHistogram: snapshot.latencyHistogram,
  operationCounts: snapshot.operationCounts,
  errorCounts: snapshot.errorCounts,
  throughput: {
    messagesPublished: snapshot.messagesPublished,
    messagesConsumed: snapshot.messagesConsumed,
    bytesPublished: snapshot.bytesPublished,
    bytesConsumed: snapshot.bytesConsumed,
  },
  connections: {
    activeSSE: snapshot.activeSSEConnections,
    activeSubscriptions: snapshot.activeSubscriptions,
  },
});
