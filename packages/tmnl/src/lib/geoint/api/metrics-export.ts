/**
 * API Metrics Snapshot Service
 *
 * Effect service for capturing and exporting API metrics snapshots.
 * Periodically takes snapshots of histogram buckets, request counts, and error counts.
 *
 * @module geoint/api/metrics-export
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
} from 'effect'
import {
  apiLatencyHistogram,
  apiRequestCounter,
  apiErrorCounter,
  API_SOURCES,
  type ApiSource,
} from './tracing'

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
})

type LatencyBucketDataType = typeof LatencyBucketData.Type

/**
 * Schema for API metrics snapshot
 */
export class ApiMetricsSnapshot extends Schema.Class<ApiMetricsSnapshot>('ApiMetricsSnapshot')({
  /** Timestamp when snapshot was taken */
  timestamp: Schema.Date,
  /** Latency histogram data per source: source -> bucket counts */
  latencyHistogram: Schema.Record({ key: Schema.String, value: LatencyBucketData }),
  /** Request counts per source: source -> count */
  requestCounts: Schema.Record({ key: Schema.String, value: Schema.Number }),
  /** Error counts per source: source -> count */
  errorCounts: Schema.Record({ key: Schema.String, value: Schema.Number }),
}) {}

/**
 * Schema for snapshot history
 */
export class ApiMetricsHistory extends Schema.Class<ApiMetricsHistory>('ApiMetricsHistory')({
  /** All captured snapshots */
  snapshots: Schema.Array(ApiMetricsSnapshot),
  /** Maximum number of snapshots to retain */
  maxSnapshots: Schema.Number,
}) {}

// =============================================================================
// Snapshot Effect
// =============================================================================

/**
 * Take a snapshot of current API metrics state
 */
export const takeMetricsSnapshot: Effect.Effect<ApiMetricsSnapshot> = Effect.gen(function* () {
  const timestamp = new Date()

  // Collect latency histogram data for each source
  // Using base histogram since tagged metrics share the underlying state
  const latencyHistogram: Record<string, LatencyBucketDataType> = {}
  for (const source of API_SOURCES) {
    const taggedHistogram = Metric.tagged(apiLatencyHistogram, 'source', source)
    const state = yield* Metric.value(taggedHistogram)

    latencyHistogram[source] = {
      buckets: state.buckets as Array<[number, number]>,
      count: state.count,
      min: state.min,
      max: state.max,
      sum: state.sum,
    }
  }

  // Collect request counts for each source
  const requestCounts: Record<string, number> = {}
  for (const source of API_SOURCES) {
    const taggedCounter = Metric.tagged(apiRequestCounter, 'source', source)
    const state = yield* Metric.value(taggedCounter)
    requestCounts[source] = state.count
  }

  // Collect error counts for each source
  const errorCounts: Record<string, number> = {}
  for (const source of API_SOURCES) {
    const taggedCounter = Metric.tagged(apiErrorCounter, 'source', source)
    const state = yield* Metric.value(taggedCounter)
    errorCounts[source] = state.count
  }

  return new ApiMetricsSnapshot({
    timestamp,
    latencyHistogram,
    requestCounts,
    errorCounts,
  })
})

// =============================================================================
// Service Interface
// =============================================================================

/**
 * API Metrics service interface
 */
export interface ApiMetrics {
  /** Take a snapshot of current metrics */
  readonly takeSnapshot: Effect.Effect<ApiMetricsSnapshot>
  /** Get the latest snapshot */
  readonly getLatestSnapshot: Effect.Effect<ApiMetricsSnapshot | null>
  /** Get all captured snapshots */
  readonly getHistory: Effect.Effect<readonly ApiMetricsSnapshot[]>
  /** Start periodic snapshot collection */
  readonly startPeriodicSnapshots: Effect.Effect<void>
  /** Stop periodic snapshot collection */
  readonly stopPeriodicSnapshots: Effect.Effect<void>
  /** Clear all snapshots */
  readonly clearHistory: Effect.Effect<void>
}

/**
 * API Metrics service tag for dependency injection
 */
export class ApiMetricsService extends Context.Tag('geoint/ApiMetrics')<
  ApiMetricsService,
  ApiMetrics
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Default snapshot interval (10 seconds)
 */
const DEFAULT_SNAPSHOT_INTERVAL = Duration.seconds(10)

/**
 * Default maximum snapshots to retain (360 = 1 hour at 10s interval)
 */
const DEFAULT_MAX_SNAPSHOTS = 360

/**
 * Create the metrics snapshot service
 */
const makeMetricsSnapshotService = (config?: {
  snapshotInterval?: Duration.Duration
  maxSnapshots?: number
}): Effect.Effect<ApiMetrics> =>
  Effect.gen(function* () {
    const snapshotInterval = config?.snapshotInterval ?? DEFAULT_SNAPSHOT_INTERVAL
    const maxSnapshots = config?.maxSnapshots ?? DEFAULT_MAX_SNAPSHOTS

    // State: captured snapshots
    const snapshots = yield* Ref.make<readonly ApiMetricsSnapshot[]>([])

    // State: periodic snapshot fiber (if running)
    const snapshotFiber = yield* Ref.make<Fiber.RuntimeFiber<void, never> | null>(null)

    /**
     * Take snapshot and add to history
     */
    const takeSnapshotAndStore: Effect.Effect<ApiMetricsSnapshot> = Effect.gen(function* () {
      const snapshot = yield* takeMetricsSnapshot

      yield* Ref.update(snapshots, (history) => {
        const newHistory = [...history, snapshot]
        // Trim to max snapshots
        if (newHistory.length > maxSnapshots) {
          return newHistory.slice(newHistory.length - maxSnapshots)
        }
        return newHistory
      })

      return snapshot
    })

    /**
     * Periodic snapshot schedule
     */
    const snapshotSchedule = Schedule.spaced(snapshotInterval)

    const takeSnapshot: ApiMetrics['takeSnapshot'] = takeSnapshotAndStore

    const getLatestSnapshot: ApiMetrics['getLatestSnapshot'] = Effect.gen(function* () {
      const history = yield* Ref.get(snapshots)
      return history.length > 0 ? history[history.length - 1] : null
    })

    const getHistory: ApiMetrics['getHistory'] = Ref.get(snapshots)

    const startPeriodicSnapshots: ApiMetrics['startPeriodicSnapshots'] = Effect.gen(function* () {
      // Check if already running
      const existingFiber = yield* Ref.get(snapshotFiber)
      if (existingFiber !== null) {
        return // Already running
      }

      // Start periodic snapshot collection
      const fiber = yield* Effect.fork(
        Effect.repeat(
          takeSnapshotAndStore.pipe(
            Effect.asVoid,
            Effect.catchAll((error) =>
              Effect.logError(`Failed to take metrics snapshot: ${error}`)
            )
          ),
          snapshotSchedule
        ).pipe(Effect.asVoid)
      )

      yield* Ref.set(snapshotFiber, fiber)
      yield* Effect.logInfo('Started periodic metrics snapshot collection')
    })

    const stopPeriodicSnapshots: ApiMetrics['stopPeriodicSnapshots'] = Effect.gen(function* () {
      const fiber = yield* Ref.get(snapshotFiber)
      if (fiber === null) {
        return // Not running
      }

      yield* Fiber.interrupt(fiber)
      yield* Ref.set(snapshotFiber, null)
      yield* Effect.logInfo('Stopped periodic metrics snapshot collection')
    })

    const clearHistory: ApiMetrics['clearHistory'] = Ref.set(snapshots, [])

    return {
      takeSnapshot,
      getLatestSnapshot,
      getHistory,
      startPeriodicSnapshots,
      stopPeriodicSnapshots,
      clearHistory,
    } satisfies ApiMetrics
  })

// =============================================================================
// Layer
// =============================================================================

/**
 * Default API Metrics service layer
 */
export const ApiMetricsLive: Layer.Layer<ApiMetrics> = Layer.effect(
  ApiMetricsService,
  makeMetricsSnapshotService()
)

/**
 * Create API Metrics service layer with custom configuration
 */
export const ApiMetricsConfigured = (config: {
  snapshotInterval?: Duration.Duration
  maxSnapshots?: number
}): Layer.Layer<ApiMetrics> =>
  Layer.effect(ApiMetricsService, makeMetricsSnapshotService(config))

// =============================================================================
// Convenience Effects
// =============================================================================

/**
 * Take a snapshot using the service from context
 */
export const takeSnapshot: Effect.Effect<ApiMetricsSnapshot, never, ApiMetrics> =
  Effect.flatMap(ApiMetricsService, (svc) => svc.takeSnapshot)

/**
 * Get the latest snapshot using the service from context
 */
export const getLatestSnapshot: Effect.Effect<ApiMetricsSnapshot | null, never, ApiMetrics> =
  Effect.flatMap(ApiMetricsService, (svc) => svc.getLatestSnapshot)

/**
 * Get snapshot history using the service from context
 */
export const getHistory: Effect.Effect<readonly ApiMetricsSnapshot[], never, ApiMetrics> =
  Effect.flatMap(ApiMetricsService, (svc) => svc.getHistory)

/**
 * Start periodic snapshots using the service from context
 */
export const startPeriodicSnapshots: Effect.Effect<void, never, ApiMetrics> =
  Effect.flatMap(ApiMetricsService, (svc) => svc.startPeriodicSnapshots)

/**
 * Stop periodic snapshots using the service from context
 */
export const stopPeriodicSnapshots: Effect.Effect<void, never, ApiMetrics> =
  Effect.flatMap(ApiMetricsService, (svc) => svc.stopPeriodicSnapshots)

/**
 * Clear snapshot history using the service from context
 */
export const clearHistory: Effect.Effect<void, never, ApiMetrics> =
  Effect.flatMap(ApiMetricsService, (svc) => svc.clearHistory)

// =============================================================================
// Export Formats
// =============================================================================

/**
 * Convert snapshot to Prometheus exposition format
 */
export const snapshotToPrometheus = (snapshot: ApiMetricsSnapshot): string => {
  const lines: string[] = []
  const timestamp = snapshot.timestamp.getTime()

  // Latency histogram
  lines.push('# HELP geoint_api_latency_ms API request latency distribution in milliseconds')
  lines.push('# TYPE geoint_api_latency_ms histogram')
  for (const [source, data] of Object.entries(snapshot.latencyHistogram)) {
    for (const [le, count] of data.buckets) {
      const leLabel = le === Infinity ? '+Inf' : le.toString()
      lines.push(`geoint_api_latency_ms_bucket{source="${source}",le="${leLabel}"} ${count} ${timestamp}`)
    }
    lines.push(`geoint_api_latency_ms_count{source="${source}"} ${data.count} ${timestamp}`)
    lines.push(`geoint_api_latency_ms_sum{source="${source}"} ${data.sum} ${timestamp}`)
  }

  // Request counter
  lines.push('# HELP geoint_api_requests_total Total number of API requests made')
  lines.push('# TYPE geoint_api_requests_total counter')
  for (const [source, count] of Object.entries(snapshot.requestCounts)) {
    lines.push(`geoint_api_requests_total{source="${source}"} ${count} ${timestamp}`)
  }

  // Error counter
  lines.push('# HELP geoint_api_errors_total Total number of API errors')
  lines.push('# TYPE geoint_api_errors_total counter')
  for (const [source, count] of Object.entries(snapshot.errorCounts)) {
    lines.push(`geoint_api_errors_total{source="${source}"} ${count} ${timestamp}`)
  }

  return lines.join('\n')
}

/**
 * Convert snapshot to JSON format for API responses
 */
export const snapshotToJson = (snapshot: ApiMetricsSnapshot): Record<string, unknown> => ({
  timestamp: snapshot.timestamp.toISOString(),
  latencyHistogram: snapshot.latencyHistogram,
  requestCounts: snapshot.requestCounts,
  errorCounts: snapshot.errorCounts,
})
