/**
 * Durable-Streams Metrics Module
 *
 * Effect-native observability infrastructure for durable-streams.
 *
 * @module holonet/durable-streams/metrics
 */

// ─── Tracing & Base Metrics ─────────────────────────────────────────────────
export {
  // Types
  type StreamOperation,
  type DsErrorType,
  STREAM_OPERATIONS,

  // Base Metrics
  operationLatencyHistogram,
  operationCounter,
  errorCounter,
  messagesPublishedCounter,
  messagesConsumedCounter,
  bytesPublishedCounter,
  bytesConsumedCounter,
  activeSSEConnectionsGauge,
  activeSubscriptionsGauge,

  // Recording Helpers
  recordLatency,
  incrementOperations,
  incrementErrors,
  incrementMessagesPublished,
  incrementMessagesConsumed,
  incrementBytesPublished,
  incrementBytesConsumed,
  incrementSSEConnections,
  decrementSSEConnections,
  incrementSubscriptions,
  decrementSubscriptions,

  // Error Classification
  classifyError,

  // Higher-Order Wrappers
  withDsTracing,
  withSSETracking,
  withSubscriptionTracking,
} from './tracing';

// ─── Metrics Snapshot Service ───────────────────────────────────────────────
export {
  // Schemas
  DsMetricsSnapshot,
  DsMetricsHistory,

  // Service
  type DsMetrics,
  DsMetricsService,
  DsMetricsLive,
  DsMetricsConfigured,

  // Convenience Effects
  takeSnapshot,
  getLatestSnapshot,
  getHistory,
  startPeriodicSnapshots,
  stopPeriodicSnapshots,
  clearHistory,
  takeMetricsSnapshot,

  // Export Formats
  snapshotToPrometheus,
  snapshotToJson,
} from './snapshot';
