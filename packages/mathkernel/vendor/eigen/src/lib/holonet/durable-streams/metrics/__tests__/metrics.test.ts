/**
 * Durable-Streams Metrics Tests
 *
 * Tests for tracing and metrics infrastructure.
 *
 * @module holonet/durable-streams/metrics/__tests__/metrics
 */

import { describe, it, expect } from 'vitest';
import { Effect, Layer, Metric } from 'effect';

import {
  // Tracing
  operationLatencyHistogram,
  operationCounter,
  errorCounter,
  messagesPublishedCounter,
  recordLatency,
  incrementOperations,
  incrementErrors,
  incrementMessagesPublished,
  classifyError,
  withDsTracing,

  // Snapshot
  DsMetricsService,
  DsMetricsLive,
  takeMetricsSnapshot,
} from '../index';

// =============================================================================
// Tracing Tests
// =============================================================================

describe('Tracing Metrics', () => {
  it('records operation latency', () =>
    Effect.gen(function* () {
      // Record some latency measurements
      yield* recordLatency('append', 5.5);
      yield* recordLatency('append', 10.2);
      yield* recordLatency('read', 2.1);

      // Verify histogram state
      const appendHistogram = Metric.tagged(operationLatencyHistogram, 'operation', 'append');
      const state = yield* Metric.value(appendHistogram);

      expect(state.count).toBe(2);
      expect(state.sum).toBeCloseTo(15.7, 1);
    }).pipe(Effect.runPromise));

  it('increments operation counter', () =>
    Effect.gen(function* () {
      // Get initial count
      const counter = Metric.tagged(operationCounter, 'operation', 'create');
      const initialState = yield* Metric.value(counter);
      const initialCount = initialState.count;

      // Increment
      yield* incrementOperations('create');
      yield* incrementOperations('create');

      // Verify
      const finalState = yield* Metric.value(counter);
      expect(finalState.count).toBe(initialCount + 2);
    }).pipe(Effect.runPromise));

  it('increments error counter with error type', () =>
    Effect.gen(function* () {
      // Get initial count
      const counter = Metric.tagged(
        Metric.tagged(errorCounter, 'operation', 'append'),
        'error_type',
        'validation_error'
      );
      const initialState = yield* Metric.value(counter);
      const initialCount = initialState.count;

      // Increment
      yield* incrementErrors('append', 'validation_error');

      // Verify
      const finalState = yield* Metric.value(counter);
      expect(finalState.count).toBe(initialCount + 1);
    }).pipe(Effect.runPromise));

  it('increments message counter with count', () =>
    Effect.gen(function* () {
      // Get initial count
      const counter = Metric.tagged(messagesPublishedCounter, 'stream', 'test-stream');
      const initialState = yield* Metric.value(counter);
      const initialCount = initialState.count;

      // Increment by 5
      yield* incrementMessagesPublished('test-stream', 5);

      // Verify
      const finalState = yield* Metric.value(counter);
      expect(finalState.count).toBe(initialCount + 5);
    }).pipe(Effect.runPromise));
});

// =============================================================================
// Error Classification Tests
// =============================================================================

describe('Error Classification', () => {
  it('classifies auth errors correctly', () => {
    expect(classifyError({ _tag: 'Unauthorized' })).toBe('auth_error');
    expect(classifyError({ _tag: 'Forbidden' })).toBe('auth_error');
  });

  it('classifies validation errors correctly', () => {
    expect(classifyError({ _tag: 'SchemaNotFoundError' })).toBe('validation_error');
    expect(classifyError({ _tag: 'CodecError' })).toBe('codec_error');
  });

  it('classifies not found errors correctly', () => {
    expect(classifyError({ _tag: 'StreamNotFoundError' })).toBe('not_found');
  });

  it('classifies conflict errors correctly', () => {
    expect(classifyError({ _tag: 'StreamExistsError' })).toBe('conflict');
    expect(classifyError({ _tag: 'SequenceConflictError' })).toBe('conflict');
  });

  it('classifies timeout errors correctly', () => {
    expect(classifyError({ _tag: 'TimeoutError' })).toBe('timeout');
    expect(classifyError({ _tag: 'LongPollTimeoutError' })).toBe('timeout');
  });

  it('classifies NATS errors correctly', () => {
    expect(classifyError({ _tag: 'NatsConnectionError' })).toBe('nats_error');
    expect(classifyError({ _tag: 'NATSPublishError' })).toBe('nats_error');
  });

  it('returns unknown for unrecognized errors', () => {
    expect(classifyError({ _tag: 'SomeOtherError' })).toBe('unknown');
    expect(classifyError('string error')).toBe('unknown');
    expect(classifyError(null)).toBe('unknown');
  });
});

// =============================================================================
// Higher-Order Wrapper Tests
// =============================================================================

describe('withDsTracing', () => {
  it('records success metrics for successful operations', () =>
    Effect.gen(function* () {
      const successEffect = Effect.succeed('success');
      const tracedEffect = withDsTracing('append', 'test-stream')(successEffect);

      const result = yield* tracedEffect;
      expect(result).toBe('success');

      // Verify operation was counted - must match ALL tags used in withDsTracing
      const counter = Metric.tagged(
        Metric.tagged(operationCounter, 'operation', 'append'),
        'stream',
        'test-stream'
      );
      const state = yield* Metric.value(counter);
      expect(state.count).toBeGreaterThan(0);
    }).pipe(Effect.runPromise));

  it('records error metrics for failed operations', () =>
    Effect.gen(function* () {
      const failEffect = Effect.fail({ _tag: 'ValidationError', message: 'Invalid data' });
      const tracedEffect = withDsTracing('append', 'test-stream')(failEffect);

      const result = yield* Effect.either(tracedEffect);
      expect(result._tag).toBe('Left');

      // Error counter should have been incremented
      const counter = Metric.tagged(
        Metric.tagged(errorCounter, 'operation', 'append'),
        'error_type',
        'unknown'
      );
      const state = yield* Metric.value(counter);
      expect(state.count).toBeGreaterThan(0);
    }).pipe(Effect.runPromise));
});

// =============================================================================
// Snapshot Service Tests
// =============================================================================

describe('Metrics Snapshot Service', () => {
  it('takes a snapshot of current metrics', () =>
    Effect.gen(function* () {
      const snapshot = yield* takeMetricsSnapshot;

      // Timestamp is recent (within last second)
      expect(snapshot.timestamp).toBeInstanceOf(Date);
      expect(Date.now() - snapshot.timestamp.getTime()).toBeLessThan(1000);

      // Latency histogram has entry for EVERY operation type
      const operations = ['create', 'append', 'read', 'delete', 'longPoll', 'sse', 'subscribe'];
      for (const op of operations) {
        expect(snapshot.latencyHistogram[op]).toBeDefined();
        expect(snapshot.latencyHistogram[op].count).toBeGreaterThanOrEqual(0);
        expect(snapshot.latencyHistogram[op].buckets).toBeInstanceOf(Array);
      }

      // Operation counts exist for all operations
      for (const op of operations) {
        expect(typeof snapshot.operationCounts[op]).toBe('number');
        expect(snapshot.operationCounts[op]).toBeGreaterThanOrEqual(0);
      }

      // Error counts exist for all operations
      for (const op of operations) {
        expect(typeof snapshot.errorCounts[op]).toBe('number');
        expect(snapshot.errorCounts[op]).toBeGreaterThanOrEqual(0);
      }

      // Throughput metrics are non-negative numbers
      expect(snapshot.messagesPublished).toBeGreaterThanOrEqual(0);
      expect(snapshot.messagesConsumed).toBeGreaterThanOrEqual(0);
      expect(snapshot.bytesPublished).toBeGreaterThanOrEqual(0);
      expect(snapshot.bytesConsumed).toBeGreaterThanOrEqual(0);

      // Gauge metrics are numbers (can be 0)
      expect(typeof snapshot.activeSSEConnections).toBe('number');
      expect(typeof snapshot.activeSubscriptions).toBe('number');
    }).pipe(Effect.runPromise));

  it('service provides snapshot capabilities', () =>
    Effect.gen(function* () {
      const svc = yield* DsMetricsService;

      // Take a snapshot
      const snapshot = yield* svc.takeSnapshot;
      expect(snapshot.timestamp).toBeInstanceOf(Date);

      // Get latest (should be the one we just took)
      const latest = yield* svc.getLatestSnapshot;
      expect(latest).toBeDefined();
      expect(latest?.timestamp.getTime()).toBe(snapshot.timestamp.getTime());

      // Get history
      const history = yield* svc.getHistory;
      expect(history.length).toBeGreaterThan(0);
    }).pipe(Effect.provide(DsMetricsLive), Effect.runPromise));

  it('clears history', () =>
    Effect.gen(function* () {
      const svc = yield* DsMetricsService;

      // Take a snapshot first
      yield* svc.takeSnapshot;
      const historyBefore = yield* svc.getHistory;
      expect(historyBefore.length).toBeGreaterThan(0);

      // Clear
      yield* svc.clearHistory;

      // Verify cleared
      const historyAfter = yield* svc.getHistory;
      expect(historyAfter.length).toBe(0);
    }).pipe(Effect.provide(DsMetricsLive), Effect.runPromise));
});

// =============================================================================
// Export Format Tests
// =============================================================================

describe('Export Formats', () => {
  it('exports to Prometheus format', async () => {
    const { snapshotToPrometheus } = await import('../snapshot');

    const snapshot = await Effect.runPromise(takeMetricsSnapshot);
    const prometheus = snapshotToPrometheus(snapshot);

    // Should contain standard Prometheus format
    expect(prometheus).toContain('# HELP');
    expect(prometheus).toContain('# TYPE');
    expect(prometheus).toContain('durable_streams_operation_latency_ms');
    expect(prometheus).toContain('durable_streams_operations_total');
    expect(prometheus).toContain('durable_streams_errors_total');
    expect(prometheus).toContain('durable_streams_messages_published_total');
    expect(prometheus).toContain('durable_streams_sse_active_connections');
  });

  it('exports to JSON format', async () => {
    const { snapshotToJson } = await import('../snapshot');

    const snapshot = await Effect.runPromise(takeMetricsSnapshot);
    const json = snapshotToJson(snapshot);

    // Timestamp is ISO string format
    expect(typeof json['timestamp']).toBe('string');
    expect((json['timestamp'] as string)).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Histogram data preserved
    expect(typeof json['latencyHistogram']).toBe('object');
    expect(json['operationCounts']).toEqual(snapshot.operationCounts);
    expect(json['errorCounts']).toEqual(snapshot.errorCounts);

    // Throughput nested structure
    const throughput = json['throughput'] as Record<string, number>;
    expect(throughput['messagesPublished']).toBe(snapshot.messagesPublished);
    expect(throughput['messagesConsumed']).toBe(snapshot.messagesConsumed);
    expect(throughput['bytesPublished']).toBe(snapshot.bytesPublished);
    expect(throughput['bytesConsumed']).toBe(snapshot.bytesConsumed);

    // Connections nested structure
    const connections = json['connections'] as Record<string, number>;
    expect(connections['activeSSE']).toBe(snapshot.activeSSEConnections);
    expect(connections['activeSubscriptions']).toBe(snapshot.activeSubscriptions);
  });
});
