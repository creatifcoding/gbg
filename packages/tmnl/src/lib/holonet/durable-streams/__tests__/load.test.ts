/**
 * Durable-Streams Load Tests
 *
 * Tests performance and scalability:
 * - Concurrent client connections
 * - Message throughput
 * - Latency measurements (p50, p95, p99)
 * - Resource cleanup under load
 *
 * These tests are marked with 'benchmark' tag and excluded from normal test runs.
 * Run explicitly with: bun test load.test.ts
 *
 * Requires NATS server with JetStream enabled (docker compose up nats)
 *
 * @module holonet/durable-streams/__tests__/load
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Effect, Layer, Schema, Fiber, Duration } from 'effect';

import { NatsStreamService } from '@/lib/holonet/nats/stream';
import { NatsInnerService } from '@/lib/holonet/nats/inner';
import { NatsConnectionServiceCustom } from '@/lib/holonet/nats/connection';
import { SchemaRegistry } from '@/lib/holonet/core/schema';
import {
  StreamCodecService,
  HEADER_SCHEMA_ID,
  HEADER_CONTENT_TYPE,
  type SchemaHeaders,
} from '../services';

// =============================================================================
// Load Test Configuration
// =============================================================================

const TEST_SERVERS = process.env['NATS_SERVERS'] ?? 'ws://localhost:9222';

const TestConnectionLayer = NatsConnectionServiceCustom({
  servers: TEST_SERVERS,
  name: 'durable-streams-load-test',
  debug: false,
});

const timestamp = Date.now();
const uniqueId = () => `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
const testStreamName = () => `TEST_LOAD_${uniqueId()}`.toUpperCase();

// =============================================================================
// Test Schemas
// =============================================================================

const LoadTestEvent = Schema.Struct({
  _tag: Schema.Literal('LoadTestEvent'),
  id: Schema.String,
  seq: Schema.Number,
  clientId: Schema.String,
  timestamp: Schema.Number,
  payload: Schema.String, // Variable-size payload for testing
});

type LoadTestEvent = typeof LoadTestEvent.Type;

// =============================================================================
// Test Layer
// =============================================================================

const LoadTestLayer = Layer.mergeAll(
  SchemaRegistry.Default,
  StreamCodecService.Default
).pipe(
  Layer.provideMerge(NatsStreamService.Default),
  Layer.provideMerge(NatsInnerService.Default),
  Layer.provideMerge(TestConnectionLayer)
);

// =============================================================================
// Metrics Collection
// =============================================================================

interface LatencyStats {
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  samples: number;
}

/**
 * Calculate percentile from sorted array
 */
const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
};

/**
 * Calculate latency statistics from raw samples
 */
const calculateLatencyStats = (latencies: number[]): LatencyStats => {
  if (latencies.length === 0) {
    return { min: 0, max: 0, p50: 0, p95: 0, p99: 0, avg: 0, samples: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    avg: sum / sorted.length,
    samples: sorted.length,
  };
};

/**
 * Format stats for console output
 */
const formatStats = (stats: LatencyStats, label: string): string =>
  `${label}: min=${stats.min.toFixed(2)}ms, avg=${stats.avg.toFixed(2)}ms, ` +
  `p50=${stats.p50.toFixed(2)}ms, p95=${stats.p95.toFixed(2)}ms, ` +
  `p99=${stats.p99.toFixed(2)}ms, max=${stats.max.toFixed(2)}ms (n=${stats.samples})`;

// Helper to convert SchemaHeaders to Record<string, string> for NATS
const headersToRecord = (headers: SchemaHeaders): Record<string, string> => ({
  [HEADER_SCHEMA_ID]: headers[HEADER_SCHEMA_ID],
  [HEADER_CONTENT_TYPE]: headers[HEADER_CONTENT_TYPE],
});

// Streams to clean up
const streamsToCleanup: string[] = [];

// =============================================================================
// Throughput Tests
// =============================================================================

describe('Throughput Tests', () => {
  let streamName: string;

  beforeEach(() => {
    streamName = testStreamName();
    streamsToCleanup.push(streamName);
  });

  afterEach(() =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      for (const name of streamsToCleanup) {
        yield* nats.deleteStream(name).pipe(Effect.catchAll(() => Effect.void));
      }
      streamsToCleanup.length = 0;
    }).pipe(
      Effect.provide(LoadTestLayer),
      Effect.runPromise
    )
  );

  it('measures publish throughput (100 messages)', { timeout: 30000 }, () =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      const inner = yield* NatsInnerService;
      const registry = yield* SchemaRegistry;
      const codec = yield* StreamCodecService;

      yield* registry.registerOrUpdate('LoadTestEvent', LoadTestEvent);
      yield* nats.ensureStream({
        name: streamName,
        subjects: [`${streamName.toLowerCase()}.*`],
      });

      const MESSAGE_COUNT = 100;
      const latencies: number[] = [];
      const startTime = Date.now();

      // Publish messages and measure individual latency
      for (let i = 0; i < MESSAGE_COUNT; i++) {
        const event: LoadTestEvent = {
          _tag: 'LoadTestEvent',
          id: `msg-${i}`,
          seq: i,
          clientId: 'throughput-test',
          timestamp: Date.now(),
          payload: 'x'.repeat(100), // 100 byte payload
        };

        const msgStart = Date.now();
        const encoded = yield* codec.encodeWithSchema('LoadTestEvent', event);
        yield* inner.jsPublish(`${streamName.toLowerCase()}.events`, encoded.bytes, {
          headers: headersToRecord(encoded.headers),
        });
        latencies.push(Date.now() - msgStart);
      }

      const totalTime = Date.now() - startTime;
      const throughput = (MESSAGE_COUNT / totalTime) * 1000;
      const stats = calculateLatencyStats(latencies);

      console.log(`\n📊 Publish Throughput Results:`);
      console.log(`   Total messages: ${MESSAGE_COUNT}`);
      console.log(`   Total time: ${totalTime}ms`);
      console.log(`   Throughput: ${throughput.toFixed(2)} msg/sec`);
      console.log(`   ${formatStats(stats, 'Latency')}`);

      // Assertions - ensure reasonable performance
      expect(throughput).toBeGreaterThan(10); // At least 10 msg/sec
      expect(stats.p99).toBeLessThan(500); // p99 under 500ms

      yield* Effect.sleep('200 millis');
    }).pipe(Effect.provide(LoadTestLayer), Effect.runPromise));

  it('measures consume throughput (100 messages)', { timeout: 30000 }, () =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      const inner = yield* NatsInnerService;
      const registry = yield* SchemaRegistry;
      const codec = yield* StreamCodecService;

      yield* registry.registerOrUpdate('LoadTestEvent', LoadTestEvent);
      yield* nats.ensureStream({
        name: streamName,
        subjects: [`${streamName.toLowerCase()}.*`],
      });

      const MESSAGE_COUNT = 100;
      const consumerName = `consumer-${uniqueId()}`;

      // First, publish all messages
      for (let i = 0; i < MESSAGE_COUNT; i++) {
        const event: LoadTestEvent = {
          _tag: 'LoadTestEvent',
          id: `msg-${i}`,
          seq: i,
          clientId: 'consume-test',
          timestamp: Date.now(),
          payload: 'x'.repeat(100),
        };
        const encoded = yield* codec.encodeWithSchema('LoadTestEvent', event);
        yield* inner.jsPublish(`${streamName.toLowerCase()}.events`, encoded.bytes, {
          headers: headersToRecord(encoded.headers),
        });
      }

      // Now measure consume throughput
      const consumer = yield* nats.getConsumer(streamName, consumerName, {
        durableName: consumerName,
        deliverPolicy: 'all',
      });

      const startTime = Date.now();
      const batch = yield* nats.fetch(consumer, LoadTestEvent, { max: MESSAGE_COUNT });
      const totalTime = Date.now() - startTime;

      const throughput = (batch.length / totalTime) * 1000;

      console.log(`\n📊 Consume Throughput Results:`);
      console.log(`   Total messages: ${batch.length}`);
      console.log(`   Total time: ${totalTime}ms`);
      console.log(`   Throughput: ${throughput.toFixed(2)} msg/sec`);

      expect(batch.length).toBe(MESSAGE_COUNT);
      expect(throughput).toBeGreaterThan(50); // At least 50 msg/sec for consume

      yield* Effect.sleep('200 millis');
    }).pipe(Effect.provide(LoadTestLayer), Effect.runPromise));
});

// =============================================================================
// Concurrent Client Tests
// =============================================================================

describe('Concurrent Client Tests', () => {
  let streamName: string;

  beforeEach(() => {
    streamName = testStreamName();
    streamsToCleanup.push(streamName);
  });

  afterEach(() =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      for (const name of streamsToCleanup) {
        yield* nats.deleteStream(name).pipe(Effect.catchAll(() => Effect.void));
      }
      streamsToCleanup.length = 0;
    }).pipe(
      Effect.provide(LoadTestLayer),
      Effect.runPromise
    )
  );

  it('handles 10 concurrent consumers', { timeout: 60000 }, () =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      const inner = yield* NatsInnerService;
      const registry = yield* SchemaRegistry;
      const codec = yield* StreamCodecService;

      yield* registry.registerOrUpdate('LoadTestEvent', LoadTestEvent);
      yield* nats.ensureStream({
        name: streamName,
        subjects: [`${streamName.toLowerCase()}.*`],
      });

      const CONSUMER_COUNT = 10;
      const MESSAGES_PER_CONSUMER = 20;

      // Publish messages for all consumers
      for (let i = 0; i < MESSAGES_PER_CONSUMER; i++) {
        const event: LoadTestEvent = {
          _tag: 'LoadTestEvent',
          id: `msg-${i}`,
          seq: i,
          clientId: 'concurrent-test',
          timestamp: Date.now(),
          payload: 'x'.repeat(100),
        };
        const encoded = yield* codec.encodeWithSchema('LoadTestEvent', event);
        yield* inner.jsPublish(`${streamName.toLowerCase()}.events`, encoded.bytes, {
          headers: headersToRecord(encoded.headers),
        });
      }

      // Create and run concurrent consumers
      const consumerEffects = Array.from({ length: CONSUMER_COUNT }, (_, i) => {
        const consumerName = `concurrent-${i}-${uniqueId()}`;
        return Effect.gen(function* () {
          const consumer = yield* nats.getConsumer(streamName, consumerName, {
            durableName: consumerName,
            deliverPolicy: 'all',
          });

          const startTime = Date.now();
          const batch = yield* nats.fetch(consumer, LoadTestEvent, {
            max: MESSAGES_PER_CONSUMER,
          });
          const elapsed = Date.now() - startTime;

          return { consumerId: i, count: batch.length, elapsed };
        });
      });

      const startTime = Date.now();
      const results = yield* Effect.all(consumerEffects, { concurrency: CONSUMER_COUNT });
      const totalTime = Date.now() - startTime;

      // Log results
      console.log(`\n📊 Concurrent Consumers Results:`);
      console.log(`   Consumer count: ${CONSUMER_COUNT}`);
      console.log(`   Messages per consumer: ${MESSAGES_PER_CONSUMER}`);
      console.log(`   Total time: ${totalTime}ms`);

      for (const r of results) {
        console.log(`   Consumer ${r.consumerId}: ${r.count} messages in ${r.elapsed}ms`);
      }

      // All consumers should get all messages
      for (const r of results) {
        expect(r.count).toBe(MESSAGES_PER_CONSUMER);
      }

      yield* Effect.sleep('500 millis');
    }).pipe(Effect.provide(LoadTestLayer), Effect.runPromise));

  it('handles 10 concurrent publishers', { timeout: 60000 }, () =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      const inner = yield* NatsInnerService;
      const registry = yield* SchemaRegistry;
      const codec = yield* StreamCodecService;

      yield* registry.registerOrUpdate('LoadTestEvent', LoadTestEvent);
      yield* nats.ensureStream({
        name: streamName,
        subjects: [`${streamName.toLowerCase()}.*`],
      });

      const PUBLISHER_COUNT = 10;
      const MESSAGES_PER_PUBLISHER = 20;

      // Create concurrent publisher effects
      const publisherEffects = Array.from({ length: PUBLISHER_COUNT }, (_, publisherId) =>
        Effect.gen(function* () {
          const latencies: number[] = [];

          for (let seq = 0; seq < MESSAGES_PER_PUBLISHER; seq++) {
            const event: LoadTestEvent = {
              _tag: 'LoadTestEvent',
              id: `pub-${publisherId}-msg-${seq}`,
              seq,
              clientId: `publisher-${publisherId}`,
              timestamp: Date.now(),
              payload: 'x'.repeat(100),
            };

            const msgStart = Date.now();
            const encoded = yield* codec.encodeWithSchema('LoadTestEvent', event);
            yield* inner.jsPublish(`${streamName.toLowerCase()}.events`, encoded.bytes, {
              headers: headersToRecord(encoded.headers),
            });
            latencies.push(Date.now() - msgStart);
          }

          return {
            publisherId,
            count: MESSAGES_PER_PUBLISHER,
            stats: calculateLatencyStats(latencies),
          };
        })
      );

      const startTime = Date.now();
      yield* Effect.all(publisherEffects, { concurrency: PUBLISHER_COUNT });
      const totalTime = Date.now() - startTime;

      const totalMessages = PUBLISHER_COUNT * MESSAGES_PER_PUBLISHER;
      const overallThroughput = (totalMessages / totalTime) * 1000;

      console.log(`\n📊 Concurrent Publishers Results:`);
      console.log(`   Publisher count: ${PUBLISHER_COUNT}`);
      console.log(`   Messages per publisher: ${MESSAGES_PER_PUBLISHER}`);
      console.log(`   Total messages: ${totalMessages}`);
      console.log(`   Total time: ${totalTime}ms`);
      console.log(`   Overall throughput: ${overallThroughput.toFixed(2)} msg/sec`);

      // Verify all messages were published
      yield* Effect.sleep('500 millis');

      const consumerName = `verify-${uniqueId()}`;
      const consumer = yield* nats.getConsumer(streamName, consumerName, {
        durableName: consumerName,
        deliverPolicy: 'all',
      });
      const batch = yield* nats.fetch(consumer, LoadTestEvent, { max: totalMessages + 10 });

      console.log(`   Verified messages: ${batch.length}`);
      expect(batch.length).toBe(totalMessages);

      yield* Effect.sleep('200 millis');
    }).pipe(Effect.provide(LoadTestLayer), Effect.runPromise));
});

// =============================================================================
// Latency Under Load Tests
// =============================================================================

describe('Latency Under Load', () => {
  let streamName: string;

  beforeEach(() => {
    streamName = testStreamName();
    streamsToCleanup.push(streamName);
  });

  afterEach(() =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      for (const name of streamsToCleanup) {
        yield* nats.deleteStream(name).pipe(Effect.catchAll(() => Effect.void));
      }
      streamsToCleanup.length = 0;
    }).pipe(
      Effect.provide(LoadTestLayer),
      Effect.runPromise
    )
  );

  it('measures end-to-end latency (publish → consume)', { timeout: 60000 }, () =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      const inner = yield* NatsInnerService;
      const registry = yield* SchemaRegistry;
      const codec = yield* StreamCodecService;

      yield* registry.registerOrUpdate('LoadTestEvent', LoadTestEvent);
      yield* nats.ensureStream({
        name: streamName,
        subjects: [`${streamName.toLowerCase()}.*`],
      });

      const MESSAGE_COUNT = 50;
      const consumerName = `latency-${uniqueId()}`;
      const e2eLatencies: number[] = [];

      // Create consumer first
      const consumer = yield* nats.getConsumer(streamName, consumerName, {
        durableName: consumerName,
        deliverPolicy: 'new', // Only new messages
      });

      // Publish and immediately consume to measure E2E latency
      for (let i = 0; i < MESSAGE_COUNT; i++) {
        const sendTimestamp = Date.now();
        const event: LoadTestEvent = {
          _tag: 'LoadTestEvent',
          id: `e2e-${i}`,
          seq: i,
          clientId: 'e2e-test',
          timestamp: sendTimestamp,
          payload: 'x'.repeat(100),
        };

        const encoded = yield* codec.encodeWithSchema('LoadTestEvent', event);
        yield* inner.jsPublish(`${streamName.toLowerCase()}.events`, encoded.bytes, {
          headers: headersToRecord(encoded.headers),
        });

        // Fetch the message
        const batch = yield* nats.fetch(consumer, LoadTestEvent, { max: 1, expires: 5000 });
        const receiveTimestamp = Date.now();

        if (batch.length > 0) {
          // Use server timestamp from message if available, else use send timestamp
          const msgTimestamp = batch[0]?.data.timestamp ?? sendTimestamp;
          const latency = receiveTimestamp - msgTimestamp;
          e2eLatencies.push(latency);

          // Ack the message
          yield* batch[0]?.ack() ?? Effect.void;
        }
      }

      const stats = calculateLatencyStats(e2eLatencies);

      console.log(`\n📊 End-to-End Latency Results:`);
      console.log(`   ${formatStats(stats, 'E2E Latency')}`);

      // Verify reasonable latency
      expect(stats.p95).toBeLessThan(200); // p95 under 200ms
      expect(stats.samples).toBe(MESSAGE_COUNT);

      yield* Effect.sleep('200 millis');
    }).pipe(Effect.provide(LoadTestLayer), Effect.runPromise));
});

// =============================================================================
// Stress Tests (Optional - longer running)
// =============================================================================

describe.skip('Stress Tests (Long Running)', () => {
  let streamName: string;

  beforeEach(() => {
    streamName = testStreamName();
    streamsToCleanup.push(streamName);
  });

  afterEach(() =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      for (const name of streamsToCleanup) {
        yield* nats.deleteStream(name).pipe(Effect.catchAll(() => Effect.void));
      }
      streamsToCleanup.length = 0;
    }).pipe(
      Effect.provide(LoadTestLayer),
      Effect.runPromise
    )
  );

  it('handles 50 concurrent consumers for 30 seconds', { timeout: 120000 }, () =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      const inner = yield* NatsInnerService;
      const registry = yield* SchemaRegistry;
      const codec = yield* StreamCodecService;

      yield* registry.registerOrUpdate('LoadTestEvent', LoadTestEvent);
      yield* nats.ensureStream({
        name: streamName,
        subjects: [`${streamName.toLowerCase()}.*`],
      });

      const CONSUMER_COUNT = 50;
      const DURATION_MS = 30000;
      const PUBLISH_INTERVAL_MS = 100;

      // Start publisher in background
      const publisherFiber = yield* Effect.fork(
        Effect.gen(function* () {
          let seq = 0;
          const endTime = Date.now() + DURATION_MS;

          while (Date.now() < endTime) {
            const event: LoadTestEvent = {
              _tag: 'LoadTestEvent',
              id: `stress-${seq}`,
              seq: seq++,
              clientId: 'stress-publisher',
              timestamp: Date.now(),
              payload: 'x'.repeat(100),
            };

            const encoded = yield* codec.encodeWithSchema('LoadTestEvent', event);
            yield* inner.jsPublish(`${streamName.toLowerCase()}.events`, encoded.bytes, {
              headers: headersToRecord(encoded.headers),
            });

            yield* Effect.sleep(Duration.millis(PUBLISH_INTERVAL_MS));
          }

          return seq;
        })
      );

      // Start consumers
      const consumerEffects = Array.from({ length: CONSUMER_COUNT }, (_, i) => {
        const consumerName = `stress-${i}-${uniqueId()}`;
        return Effect.gen(function* () {
          const consumer = yield* nats.getConsumer(streamName, consumerName, {
            durableName: consumerName,
            deliverPolicy: 'all',
          });

          let totalReceived = 0;
          const endTime = Date.now() + DURATION_MS;

          while (Date.now() < endTime) {
            const batch = yield* nats.fetch(consumer, LoadTestEvent, {
              max: 100,
              expires: 2000,
            });
            totalReceived += batch.length;

            // Ack all messages
            for (const msg of batch) {
              yield* msg.ack();
            }
          }

          return { consumerId: i, totalReceived };
        });
      });

      const [publishedCount, consumerResults] = yield* Effect.all([
        Fiber.join(publisherFiber),
        Effect.all(consumerEffects, { concurrency: CONSUMER_COUNT }),
      ]);

      console.log(`\n📊 Stress Test Results:`);
      console.log(`   Duration: ${DURATION_MS / 1000}s`);
      console.log(`   Consumer count: ${CONSUMER_COUNT}`);
      console.log(`   Published messages: ${publishedCount}`);

      const totalReceived = consumerResults.reduce((sum, r) => sum + r.totalReceived, 0);
      const avgPerConsumer = totalReceived / CONSUMER_COUNT;

      console.log(`   Total received (all consumers): ${totalReceived}`);
      console.log(`   Average per consumer: ${avgPerConsumer.toFixed(0)}`);

      // Each consumer should receive most messages
      for (const r of consumerResults) {
        expect(r.totalReceived).toBeGreaterThan(publishedCount * 0.8);
      }

      yield* Effect.sleep('1 second');
    }).pipe(Effect.provide(LoadTestLayer), Effect.runPromise));
});
