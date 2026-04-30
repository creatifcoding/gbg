/**
 * Durable-Streams HTTP API Tests
 *
 * Tests the HttpApi handlers for the durable-streams NATS bridge.
 * Uses HttpApiClient with test layer to test handlers without HTTP server.
 *
 * Covers:
 * - Stream CRUD operations (create, read, append, delete)
 * - Long-poll live mode
 * - Error responses and status codes
 * - Health check endpoint
 *
 * Requires NATS server with JetStream enabled (docker compose up nats)
 *
 * @module holonet/durable-streams/__tests__/api
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Effect, Layer, pipe } from 'effect';
import { HttpApiBuilder, HttpApiClient } from '@effect/platform';
import { NodeHttpServer } from '@effect/platform-node';

import { NatsStreamService } from '@/lib/holonet/nats/stream';
import { NatsInnerService } from '@/lib/holonet/nats/inner';
import { NatsConnectionServiceCustom } from '@/lib/holonet/nats/connection';
import { SchemaRegistry } from '@/lib/holonet/core/schema';
import { HolonetDurableStreamsApi, HolonetDurableStreamsApiLive } from '../api';
import {
  StreamBridgeService,
  LiveStreamService,
  StreamCodecService,
} from '../services';
import { DurableStreamsEventLogLive } from '../events';

// =============================================================================
// Test Configuration
// =============================================================================

const TEST_SERVERS = process.env['NATS_SERVERS'] ?? 'ws://localhost:9222';

// Create test connection layer
const TestConnectionLayer = NatsConnectionServiceCustom({
  servers: TEST_SERVERS,
  name: 'durable-streams-api-test',
  debug: false,
});

// Unique test identifiers to avoid conflicts
const timestamp = Date.now();
const uniqueId = () => `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
const testStreamId = () => `test-stream-${uniqueId()}`;

// =============================================================================
// Test Layer Assembly
// =============================================================================

/**
 * Service dependencies for API handlers
 */
const ServiceDependencies = Layer.mergeAll(
  // Bridge services
  StreamBridgeService.Default,
  LiveStreamService.Default,
  // Core services
  SchemaRegistry.Default,
  StreamCodecService.Default,
  // EventLog for observability
  DurableStreamsEventLogLive
).pipe(
  Layer.provideMerge(NatsStreamService.Default),
  Layer.provideMerge(NatsInnerService.Default),
  Layer.provideMerge(TestConnectionLayer)
);

/**
 * API layer with HttpApiBuilder.api() - provides HttpApi.Api service
 */
const ApiLayer = HttpApiBuilder.api(HolonetDurableStreamsApi).pipe(
  Layer.provide(HolonetDurableStreamsApiLive),
  Layer.provide(ServiceDependencies)
);

/**
 * HTTP test layer with NodeHttpServer.layerTest for in-process testing
 */
const HttpTestLayer = HttpApiBuilder.serve().pipe(
  Layer.provide(ApiLayer),
  Layer.provideMerge(NodeHttpServer.layerTest)
);

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Cleanup helper - delete stream if exists via NATS directly
 */
const cleanupStream = (streamId: string) =>
  Effect.gen(function* () {
    const nats = yield* NatsStreamService;
    yield* pipe(
      nats.deleteStream(streamId.toUpperCase().replace(/-/g, '_')),
      Effect.catchAll(() => Effect.void)
    );
  });

/**
 * Cleanup layer for afterEach - just provides NATS services
 */
const CleanupLayer = Layer.mergeAll(
  NatsStreamService.Default,
  NatsInnerService.Default
).pipe(Layer.provide(TestConnectionLayer));

// =============================================================================
// API Tests
// =============================================================================

describe('Durable-Streams HTTP API Tests', () => {
  const streamsToCleanup: string[] = [];

  beforeEach(() => {
    streamsToCleanup.length = 0;
  });

  afterEach(async () => {
    // Clean up any streams created during tests
    for (const streamId of streamsToCleanup) {
      await Effect.runPromise(
        cleanupStream(streamId).pipe(Effect.provide(CleanupLayer))
      );
    }
  });

  describe('Health API', () => {
    it('returns healthy status', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);

        // Health group is topLevel: true, so access is client.check() not client.health.check()
        const response = yield* client.check();

        expect(response).toMatchObject({
          status: 'healthy',
          nats: { connected: true },
        });
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );
  });

  describe('Streams API - Create', () => {
    it('creates a new stream', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamId = testStreamId();
        streamsToCleanup.push(streamId);

        const response = yield* client.streams.create({
          path: { streamId },
          payload: {
            contentType: 'application/json',
            retention: 'limits',
            maxMessages: 1000,
          },
        });

        expect(response).toMatchObject({
          streamId,
          created: true,
          config: {
            contentType: 'application/json',
          },
        });
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );

    it('returns 409 for existing stream', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamId = testStreamId();
        streamsToCleanup.push(streamId);

        // Create first time
        yield* client.streams.create({
          path: { streamId },
          payload: { contentType: 'application/json' },
        });

        // Try to create again - should fail
        const result = yield* client.streams
          .create({
            path: { streamId },
            payload: { contentType: 'application/json' },
          })
          .pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('ApiStreamExistsError');
        }
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );
  });

  describe('Streams API - Append', () => {
    it('appends data to stream', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamId = testStreamId();
        streamsToCleanup.push(streamId);

        // Create stream first
        yield* client.streams.create({
          path: { streamId },
          payload: { contentType: 'application/json' },
        });

        // Append data - must pass urlParams even if empty
        const response = yield* client.streams.append({
          path: { streamId },
          urlParams: {},
          payload: { data: { message: 'Hello, NATS!' } },
        });

        expect(response).toMatchObject({
          seq: expect.any(Number),
          stream: expect.any(String),
        });
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );

    it('returns 404 for non-existent stream', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamId = testStreamId();

        const result = yield* client.streams
          .append({
            path: { streamId },
            urlParams: {},
            payload: { data: { message: 'Hello' } },
          })
          .pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('ApiStreamNotFoundError');
        }
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );
  });

  describe('Streams API - Read', () => {
    it('reads messages from stream', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamId = testStreamId();
        streamsToCleanup.push(streamId);

        // Create stream
        yield* client.streams.create({
          path: { streamId },
          payload: { contentType: 'application/json' },
        });

        // Append multiple messages
        for (let i = 0; i < 3; i++) {
          yield* client.streams.append({
            path: { streamId },
            urlParams: {},
            payload: { data: { index: i, message: `Message ${i}` } },
          });
        }

        // Read messages - offset defaults to -1, limit defaults to 100
        const response = yield* client.streams.read({
          path: { streamId },
          urlParams: { offset: '-1', limit: 10, timeout: 30000 },
        });

        // Verify response shape
        expect(response.items).toBeDefined();
        expect(response.nextOffset).toBeGreaterThanOrEqual(0);
        expect(response.upToDate).toBe(true);

        // Check items array length
        expect(response.items).toHaveLength(3);

        // Verify message content
        expect(response.items[0].seq).toBe(1);
        expect(response.items[0].data).toEqual({
          index: 0,
          message: 'Message 0',
        });
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );

    it('returns 404 for non-existent stream', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamId = testStreamId();

        const result = yield* client.streams
          .read({
            path: { streamId },
            urlParams: { offset: '-1', limit: 100, timeout: 30000 },
          })
          .pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('ApiStreamNotFoundError');
        }
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );
  });

  describe('Streams API - Delete', () => {
    it('deletes existing stream', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamId = testStreamId();

        // Create stream
        yield* client.streams.create({
          path: { streamId },
          payload: { contentType: 'application/json' },
        });

        // Delete stream - should succeed (returns void)
        yield* client.streams.delete({
          path: { streamId },
        });

        // Verify stream is deleted by trying to read
        const readResult = yield* client.streams
          .read({
            path: { streamId },
            urlParams: { offset: '-1', limit: 100, timeout: 30000 },
          })
          .pipe(Effect.either);

        expect(readResult._tag).toBe('Left');
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );

    it('returns 404 for non-existent stream', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamId = testStreamId();

        const result = yield* client.streams
          .delete({
            path: { streamId },
          })
          .pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('ApiStreamNotFoundError');
        }
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );
  });

  describe('Streams API - Long Poll', () => {
    it('returns 204 on timeout with no new data', { timeout: 20000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamId = testStreamId();
        streamsToCleanup.push(streamId);

        // Create stream
        yield* client.streams.create({
          path: { streamId },
          payload: { contentType: 'application/json' },
        });

        // Long poll with short timeout - should timeout with no data
        const result = yield* client.streams
          .read({
            path: { streamId },
            urlParams: {
              offset: '-1',
              limit: 100,
              live: 'long-poll',
              timeout: 1000,
            },
          })
          .pipe(Effect.either);

        // 204 is returned as ApiLongPollTimeoutError
        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('ApiLongPollTimeoutError');
        }
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );
  });
});
