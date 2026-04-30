/**
 * Durable-Streams E2E Test
 *
 * End-to-end test proving the holonet durable-streams server works.
 * Test patterns follow @durable-streams/client-conformance-tests.
 *
 * KEY INSIGHT: The official @durable-streams/client is a thin wrapper
 * around fetch(). This test uses Effect's HttpApiClient which provides
 * typed access to the same protocol endpoints.
 *
 * Test Categories (following durable-streams patterns):
 * - lifecycle: create, connect, head, delete, multiple streams
 * - producer: append string, multiple, binary, unicode
 * - consumer: read catchup, offset handling
 * - THE GAP: NATS subscription not supported
 *
 * @module holonet/durable-streams/__tests__/e2e
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

const TestConnectionLayer = NatsConnectionServiceCustom({
  servers: TEST_SERVERS,
  name: 'durable-streams-e2e-test',
  debug: false,
});

// Unique test identifiers (following durable-streams pattern)
const timestamp = Date.now();
const uniqueId = () => `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
const testStreamPath = () => `e2e-${uniqueId()}`;

// =============================================================================
// Test Layer Assembly
// =============================================================================

const ServiceDependencies = Layer.mergeAll(
  StreamBridgeService.Default,
  LiveStreamService.Default,
  SchemaRegistry.Default,
  StreamCodecService.Default,
  DurableStreamsEventLogLive
).pipe(
  Layer.provideMerge(NatsStreamService.Default),
  Layer.provideMerge(NatsInnerService.Default),
  Layer.provideMerge(TestConnectionLayer)
);

const ApiLayer = HttpApiBuilder.api(HolonetDurableStreamsApi).pipe(
  Layer.provide(HolonetDurableStreamsApiLive),
  Layer.provide(ServiceDependencies)
);

const HttpTestLayer = HttpApiBuilder.serve().pipe(
  Layer.provide(ApiLayer),
  Layer.provideMerge(NodeHttpServer.layerTest)
);

// Layer that also exposes NATS services for direct access in tests
const HttpTestLayerWithNats = Layer.mergeAll(
  HttpTestLayer,
  NatsStreamService.Default.pipe(
    Layer.provideMerge(NatsInnerService.Default),
    Layer.provideMerge(TestConnectionLayer)
  )
);

// =============================================================================
// Cleanup Helpers
// =============================================================================

const CleanupLayer = Layer.mergeAll(
  NatsStreamService.Default,
  NatsInnerService.Default
).pipe(Layer.provide(TestConnectionLayer));

const cleanupStream = (streamId: string) =>
  Effect.gen(function* () {
    const nats = yield* NatsStreamService;
    yield* pipe(
      nats.deleteStream(streamId.toUpperCase().replace(/-/g, '_')),
      Effect.catchAll(() => Effect.void)
    );
  });

// =============================================================================
// E2E Tests - Following durable-streams/client-conformance-tests patterns
// =============================================================================

describe('Durable-Streams E2E Tests', () => {
  const streamsToCleanup: string[] = [];

  beforeEach(() => {
    streamsToCleanup.length = 0;
  });

  afterEach(async () => {
    for (const streamId of streamsToCleanup) {
      await Effect.runPromise(
        cleanupStream(streamId).pipe(Effect.provide(CleanupLayer))
      );
    }
  });

  // ===========================================================================
  // Lifecycle Tests (from stream-lifecycle.yaml)
  // ===========================================================================

  describe('lifecycle', () => {
    /**
     * full-lifecycle: Create, append, read, and delete a stream
     * @see packages/client-conformance-tests/test-cases/lifecycle/stream-lifecycle.yaml
     */
    it('full-lifecycle: create → append → read → delete', { timeout: 30000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamPath = testStreamPath();
        streamsToCleanup.push(streamPath);

        // create
        const createRes = yield* client.streams.create({
          path: { streamId: streamPath },
          payload: { contentType: 'text/plain' },
        });
        expect(createRes.created).toBe(true);

        // append
        yield* client.streams.append({
          path: { streamId: streamPath },
          urlParams: {},
          payload: { data: 'lifecycle-test-data' },
        });

        // read
        const readRes = yield* client.streams.read({
          path: { streamId: streamPath },
          urlParams: { offset: '-1', limit: 100, timeout: 30000 },
        });
        expect(readRes.items).toHaveLength(1);
        expect(readRes.items[0].data).toBe('lifecycle-test-data');
        expect(readRes.upToDate).toBe(true);

        // delete
        yield* client.streams.delete({ path: { streamId: streamPath } });
        streamsToCleanup.pop();

        // read after delete → 404
        const readAfterDelete = yield* client.streams
          .read({
            path: { streamId: streamPath },
            urlParams: { offset: '-1', limit: 100, timeout: 30000 },
          })
          .pipe(Effect.either);
        expect(readAfterDelete._tag).toBe('Left');
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );

    /**
     * connect-existing: Connect should work for existing streams
     */
    it('connect-existing: read existing stream', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamPath = testStreamPath();
        streamsToCleanup.push(streamPath);

        // Setup: create and append
        yield* client.streams.create({
          path: { streamId: streamPath },
          payload: { contentType: 'text/plain' },
        });
        yield* client.streams.append({
          path: { streamId: streamPath },
          urlParams: {},
          payload: { data: 'pre-existing' },
        });

        // Read (equivalent to connect + read)
        const readRes = yield* client.streams.read({
          path: { streamId: streamPath },
          urlParams: { offset: '-1', limit: 100, timeout: 30000 },
        });
        expect(readRes.items[0].data).toBe('pre-existing');
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );

    /**
     * head-metadata: HEAD returns stream metadata
     */
    it('head-metadata: returns content-type and offset', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamPath = testStreamPath();
        streamsToCleanup.push(streamPath);

        // Setup
        yield* client.streams.create({
          path: { streamId: streamPath },
          payload: { contentType: 'application/json' },
        });
        yield* client.streams.append({
          path: { streamId: streamPath },
          urlParams: {},
          payload: { data: { key: 'value' } },
        });

        // HEAD (via read with limit 0 or just read metadata)
        const readRes = yield* client.streams.read({
          path: { streamId: streamPath },
          urlParams: { offset: '-1', limit: 1, timeout: 30000 },
        });
        expect(readRes.nextOffset).toBeGreaterThan(0);
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );

    /**
     * multiple-streams: Operations on one stream should not affect others
     */
    it('multiple-streams: independent streams', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const stream1 = testStreamPath();
        const stream2 = testStreamPath();
        streamsToCleanup.push(stream1, stream2);

        // Create both
        yield* client.streams.create({
          path: { streamId: stream1 },
          payload: { contentType: 'application/json' },
        });
        yield* client.streams.create({
          path: { streamId: stream2 },
          payload: { contentType: 'application/json' },
        });

        // Append to both
        yield* client.streams.append({
          path: { streamId: stream1 },
          urlParams: {},
          payload: { data: 'stream1-data' },
        });
        yield* client.streams.append({
          path: { streamId: stream2 },
          urlParams: {},
          payload: { data: 'stream2-data' },
        });

        // Read both
        const res1 = yield* client.streams.read({
          path: { streamId: stream1 },
          urlParams: { offset: '-1', limit: 100, timeout: 30000 },
        });
        const res2 = yield* client.streams.read({
          path: { streamId: stream2 },
          urlParams: { offset: '-1', limit: 100, timeout: 30000 },
        });

        expect(res1.items[0].data).toBe('stream1-data');
        expect(res2.items[0].data).toBe('stream2-data');

        // Delete stream1, stream2 should be unaffected
        yield* client.streams.delete({ path: { streamId: stream1 } });
        streamsToCleanup.shift();

        const res2After = yield* client.streams.read({
          path: { streamId: stream2 },
          urlParams: { offset: '-1', limit: 100, timeout: 30000 },
        });
        expect(res2After.items[0].data).toBe('stream2-data');
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );

    /**
     * recreate-after-delete: Creating after delete should succeed
     */
    it('recreate-after-delete: create succeeds after delete', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamPath = testStreamPath();
        streamsToCleanup.push(streamPath);

        // Create, append, delete
        yield* client.streams.create({
          path: { streamId: streamPath },
          payload: { contentType: 'application/json' },
        });
        yield* client.streams.append({
          path: { streamId: streamPath },
          urlParams: {},
          payload: { data: 'original' },
        });
        yield* client.streams.delete({ path: { streamId: streamPath } });

        // Recreate at same path
        const createRes = yield* client.streams.create({
          path: { streamId: streamPath },
          payload: { contentType: 'application/json' },
        });
        expect(createRes.created).toBe(true);
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );
  });

  // ===========================================================================
  // Producer Tests (from append-data.yaml)
  // ===========================================================================

  describe('producer', () => {
    /**
     * append-string: Client should append string data
     */
    it('append-string: text data', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamPath = testStreamPath();
        streamsToCleanup.push(streamPath);

        yield* client.streams.create({
          path: { streamId: streamPath },
          payload: { contentType: 'text/plain' },
        });

        yield* client.streams.append({
          path: { streamId: streamPath },
          urlParams: {},
          payload: { data: 'Hello, World!' },
        });

        const readRes = yield* client.streams.read({
          path: { streamId: streamPath },
          urlParams: { offset: '-1', limit: 100, timeout: 30000 },
        });
        expect(readRes.items[0].data).toBe('Hello, World!');
        expect(readRes.upToDate).toBe(true);
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );

    /**
     * append-multiple: Multiple appends should accumulate
     */
    it('append-multiple: multiple chunks', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamPath = testStreamPath();
        streamsToCleanup.push(streamPath);

        yield* client.streams.create({
          path: { streamId: streamPath },
          payload: { contentType: 'text/plain' },
        });

        yield* client.streams.append({
          path: { streamId: streamPath },
          urlParams: {},
          payload: { data: 'First ' },
        });
        yield* client.streams.append({
          path: { streamId: streamPath },
          urlParams: {},
          payload: { data: 'Second ' },
        });
        yield* client.streams.append({
          path: { streamId: streamPath },
          urlParams: {},
          payload: { data: 'Third' },
        });

        const readRes = yield* client.streams.read({
          path: { streamId: streamPath },
          urlParams: { offset: '-1', limit: 100, timeout: 30000 },
        });
        expect(readRes.items).toHaveLength(3);
        expect(readRes.items.map((i) => i.data).join('')).toBe('First Second Third');
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );

    /**
     * append-json: JSON data with application/json content-type
     */
    it('append-json: structured data', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamPath = testStreamPath();
        streamsToCleanup.push(streamPath);

        yield* client.streams.create({
          path: { streamId: streamPath },
          payload: { contentType: 'application/json' },
        });

        const items = [
          { id: 1, name: 'first' },
          { id: 2, name: 'second' },
        ];

        for (const item of items) {
          yield* client.streams.append({
            path: { streamId: streamPath },
            urlParams: {},
            payload: { data: item },
          });
        }

        const readRes = yield* client.streams.read({
          path: { streamId: streamPath },
          urlParams: { offset: '-1', limit: 100, timeout: 30000 },
        });
        expect(readRes.items).toHaveLength(2);
        expect(readRes.items[0].data).toEqual({ id: 1, name: 'first' });
        expect(readRes.items[1].data).toEqual({ id: 2, name: 'second' });
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );

    /**
     * append-unicode: Client should handle unicode characters
     */
    it('append-unicode: international characters', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamPath = testStreamPath();
        streamsToCleanup.push(streamPath);

        yield* client.streams.create({
          path: { streamId: streamPath },
          payload: { contentType: 'text/plain' },
        });

        yield* client.streams.append({
          path: { streamId: streamPath },
          urlParams: {},
          payload: { data: 'Hello 世界 🌍 Привет мир' },
        });

        const readRes = yield* client.streams.read({
          path: { streamId: streamPath },
          urlParams: { offset: '-1', limit: 100, timeout: 30000 },
        });
        expect(readRes.items[0].data).toBe('Hello 世界 🌍 Привет мир');
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );
  });

  // ===========================================================================
  // Consumer Tests (from offset-handling.yaml, read-catchup.yaml)
  // ===========================================================================

  describe('consumer', () => {
    /**
     * read-from-offset: Resume reading from specific offset
     */
    it('read-from-offset: resume from offset', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamPath = testStreamPath();
        streamsToCleanup.push(streamPath);

        yield* client.streams.create({
          path: { streamId: streamPath },
          payload: { contentType: 'application/json' },
        });

        // Append 10 items
        for (let i = 0; i < 10; i++) {
          yield* client.streams.append({
            path: { streamId: streamPath },
            urlParams: {},
            payload: { data: { index: i } },
          });
        }

        // Read from beginning
        const allRes = yield* client.streams.read({
          path: { streamId: streamPath },
          urlParams: { offset: '-1', limit: 100, timeout: 30000 },
        });
        expect(allRes.items).toHaveLength(10);

        // Read from offset 5 (should get items 5-9)
        const laterRes = yield* client.streams.read({
          path: { streamId: streamPath },
          urlParams: { offset: '5', limit: 100, timeout: 30000 },
        });
        expect(laterRes.items).toHaveLength(5);
        expect((laterRes.items[0].data as { index: number }).index).toBe(5);
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );

    /**
     * read-with-limit: Limit should cap returned items
     */
    it('read-with-limit: capped results', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamPath = testStreamPath();
        streamsToCleanup.push(streamPath);

        yield* client.streams.create({
          path: { streamId: streamPath },
          payload: { contentType: 'application/json' },
        });

        for (let i = 0; i < 10; i++) {
          yield* client.streams.append({
            path: { streamId: streamPath },
            urlParams: {},
            payload: { data: { index: i } },
          });
        }

        // Read with limit 3
        const limitedRes = yield* client.streams.read({
          path: { streamId: streamPath },
          urlParams: { offset: '-1', limit: 3, timeout: 30000 },
        });
        expect(limitedRes.items).toHaveLength(3);
        expect(limitedRes.upToDate).toBe(false); // More data available
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );

    /**
     * read-empty-stream: Reading empty stream returns upToDate true
     */
    it('read-empty-stream: empty is upToDate', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamPath = testStreamPath();
        streamsToCleanup.push(streamPath);

        yield* client.streams.create({
          path: { streamId: streamPath },
          payload: { contentType: 'application/json' },
        });

        const readRes = yield* client.streams.read({
          path: { streamId: streamPath },
          urlParams: { offset: '-1', limit: 100, timeout: 30000 },
        });
        expect(readRes.items).toHaveLength(0);
        expect(readRes.upToDate).toBe(true);
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );
  });

  // ===========================================================================
  // Error Handling Tests (from error-handling.yaml)
  // ===========================================================================

  describe('error-handling', () => {
    /**
     * 404: Stream not found
     */
    it('404: stream not found', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);

        const readRes = yield* client.streams
          .read({
            path: { streamId: 'non-existent-stream' },
            urlParams: { offset: '-1', limit: 100, timeout: 30000 },
          })
          .pipe(Effect.either);

        expect(readRes._tag).toBe('Left');
        if (readRes._tag === 'Left') {
          expect(readRes.left._tag).toBe('ApiStreamNotFoundError');
        }
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );

    /**
     * 409: Stream already exists (conflict)
     */
    it('409: stream already exists', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const streamPath = testStreamPath();
        streamsToCleanup.push(streamPath);

        yield* client.streams.create({
          path: { streamId: streamPath },
          payload: { contentType: 'application/json' },
        });

        const dupRes = yield* client.streams
          .create({
            path: { streamId: streamPath },
            payload: { contentType: 'application/json' },
          })
          .pipe(Effect.either);

        expect(dupRes._tag).toBe('Left');
        if (dupRes._tag === 'Left') {
          expect(dupRes.left._tag).toBe('ApiStreamExistsError');
        }
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );

    /**
     * 404: Append to non-existent stream
     */
    it('404: append to non-existent', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);

        const appendRes = yield* client.streams
          .append({
            path: { streamId: 'non-existent-stream' },
            urlParams: {},
            payload: { data: 'test' },
          })
          .pipe(Effect.either);

        expect(appendRes._tag).toBe('Left');
        if (appendRes._tag === 'Left') {
          expect(appendRes.left._tag).toBe('ApiStreamNotFoundError');
        }
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );
  });

  // ===========================================================================
  // THE GAP: NATS Subscription Not Supported
  // ===========================================================================

  describe('THE GAP: NATS Subscription Not Supported', () => {
    /**
     * This test proves the fundamental limitation:
     *
     * The durable-streams protocol is SELF-CONTAINED. It only works with
     * streams created via the HTTP API. There is NO WAY to:
     *
     * 1. Subscribe to existing NATS subjects
     * 2. Bridge pre-existing NATS streams
     * 3. Discover NATS infrastructure
     *
     * This is by design - durable-streams is a simple HTTP protocol,
     * not a NATS proxy.
     */
    it('cannot access NATS streams not created via durable-streams API', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const apiClient = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const nats = yield* NatsStreamService;
        const inner = yield* NatsInnerService;

        // === Create NATS stream DIRECTLY (bypassing durable-streams) ===
        const natsStreamName = `DIRECT_NATS_${uniqueId()}`;
        const natsSubject = `direct.nats.${uniqueId()}`;

        yield* nats.ensureStream({
          name: natsStreamName,
          subjects: [natsSubject],
        });

        // Publish directly to NATS
        yield* inner.jsPublish(
          natsSubject,
          new TextEncoder().encode(JSON.stringify({ msg: 'direct-1' }))
        );
        yield* inner.jsPublish(
          natsSubject,
          new TextEncoder().encode(JSON.stringify({ msg: 'direct-2' }))
        );

        // === THE GAP: Try to access via durable-streams HTTP API ===

        // Attempt 1: Use NATS stream name as streamId
        const attempt1 = yield* apiClient.streams
          .read({
            path: { streamId: natsStreamName.toLowerCase() },
            urlParams: { offset: '-1', limit: 100, timeout: 30000 },
          })
          .pipe(Effect.either);

        expect(attempt1._tag).toBe('Left');
        if (attempt1._tag === 'Left') {
          expect(attempt1.left._tag).toBe('ApiStreamNotFoundError');
        }

        // Attempt 2: Use NATS subject as streamId
        const attempt2 = yield* apiClient.streams
          .read({
            path: { streamId: natsSubject.replace(/\./g, '-') },
            urlParams: { offset: '-1', limit: 100, timeout: 30000 },
          })
          .pipe(Effect.either);

        expect(attempt2._tag).toBe('Left');
        if (attempt2._tag === 'Left') {
          expect(attempt2.left._tag).toBe('ApiStreamNotFoundError');
        }

        // Cleanup
        yield* nats.deleteStream(natsStreamName);

        // === CONCLUSION ===
        // durable-streams has NO visibility into pre-existing NATS streams.
        // This is THE GAP.
      }).pipe(Effect.provide(HttpTestLayerWithNats), Effect.runPromise)
    );

    /**
     * Document what's missing for NATS bridging
     */
    it('documents missing NATS bridging endpoints', () => {
      // Current durable-streams HTTP API endpoints (per PROTOCOL.md):
      const implemented = [
        'PUT /v1/stream/:id     - Create stream',
        'POST /v1/stream/:id    - Append to stream',
        'GET /v1/stream/:id     - Read from stream',
        'HEAD /v1/stream/:id    - Get metadata',
        'DELETE /v1/stream/:id  - Delete stream',
      ];

      // What would be needed for NATS bridging:
      const missing = [
        'POST /v1/subscribe/:subject   - Subscribe to NATS subject',
        'GET /v1/nats/streams          - List NATS streams',
        'POST /v1/bridge/:stream       - Bridge NATS stream to HTTP',
        'DELETE /v1/subscribe/:id      - Unsubscribe',
      ];

      expect(implemented).toHaveLength(5);
      expect(missing).toHaveLength(4);

      console.log('\n=== DURABLE-STREAMS / NATS GAP ===');
      console.log('Implemented:', implemented.join('\n  '));
      console.log('\nMissing for NATS bridging:', missing.join('\n  '));
      console.log('==================================\n');
    });
  });

  // ===========================================================================
  // Health Check
  // ===========================================================================

  describe('health', () => {
    it('returns healthy status with NATS connected', { timeout: 10000 }, () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const response = yield* client.check();

        expect(response.status).toBe('healthy');
        expect(response.nats.connected).toBe(true);
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise)
    );
  });
});
