import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Effect, Layer, pipe } from 'effect';
import { HttpApiBuilder, HttpApiClient } from '@effect/platform';
import { BunHttpServer } from '@effect/platform-bun';

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

const TEST_SERVERS = process.env['NATS_SERVERS'] ?? 'ws://localhost:9222';

const TestConnectionLayer = NatsConnectionServiceCustom({
  servers: TEST_SERVERS,
  name: 'durable-streams-api-bun-test',
  debug: false,
});

const timestamp = Date.now();
const uniqueId = () => `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
const testStreamId = () => `test-stream-${uniqueId()}`;

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
  Layer.provideMerge(BunHttpServer.layerTest)
);

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

describe('Durable-Streams HTTP API Tests (Bun)', () => {
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

  describe('Health API', () => {
    test('returns healthy status', async () => {
      await Effect.gen(function* () {
        const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
        const response = yield* client.check();

        expect(response).toMatchObject({
          status: 'healthy',
          nats: { connected: true },
        });
      }).pipe(Effect.provide(HttpTestLayer), Effect.runPromise);
    });
  });

  describe('Streams API - Create', () => {
    test('creates a new stream', async () => {
      await runApi(
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
            config: { contentType: 'application/json' },
          });
        })
      );
    });

    test('returns 409 for existing stream', async () => {
      await runApi(
        Effect.gen(function* () {
          const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
          const streamId = testStreamId();
          streamsToCleanup.push(streamId);

          yield* client.streams.create({
            path: { streamId },
            payload: { contentType: 'application/json' },
          });

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
        })
      );
    });
  });

  describe('Streams API - Append', () => {
    test('appends data to stream', async () => {
      await runApi(
        Effect.gen(function* () {
          const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
          const streamId = testStreamId();
          streamsToCleanup.push(streamId);

          yield* client.streams.create({
            path: { streamId },
            payload: { contentType: 'application/json' },
          });

          const response = yield* client.streams.append({
            path: { streamId },
            urlParams: {},
            payload: { data: { message: 'Hello, NATS!' } },
          });

          expect(response).toMatchObject({
            seq: expect.any(Number),
            stream: expect.any(String),
          });
        })
      );
    });

    test('returns 404 for non-existent stream', async () => {
      await runApi(
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
        })
      );
    });
  });

  describe('Streams API - Read', () => {
    test('reads messages from stream', async () => {
      await runApi(
        Effect.gen(function* () {
          const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
          const streamId = testStreamId();
          streamsToCleanup.push(streamId);

          yield* client.streams.create({
            path: { streamId },
            payload: { contentType: 'application/json' },
          });

          yield* client.streams.append({
            path: { streamId },
            urlParams: {},
            payload: { data: { message: 'Hello, NATS!' } },
          });

          const response = yield* client.streams.read({
            path: { streamId },
            urlParams: {
              offset: '-1',
              limit: 100,
              timeout: 1000,
            },
          });

          expect(response).toMatchObject({
            items: expect.any(Array),
            nextOffset: expect.any(Number),
            upToDate: expect.any(Boolean),
          });
          expect(response.items[0]?.data).toEqual({
            message: 'Hello, NATS!',
          });
        })
      );
    });
  });

  describe('Streams API - Delete', () => {
    test('deletes existing stream', async () => {
      await runApi(
        Effect.gen(function* () {
          const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
          const streamId = testStreamId();

          yield* client.streams.create({
            path: { streamId },
            payload: { contentType: 'application/json' },
          });

          const response = yield* client.streams.delete({
            path: { streamId },
          });

          expect(response).toMatchObject({ streamId, deleted: true });
        })
      );
    });

    test('returns 404 for non-existent stream', async () => {
      await runApi(
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
        })
      );
    });
  });

  describe('Streams API - Long Poll', () => {
    test('returns 204 on timeout with no new data', async () => {
      await runApi(
        Effect.gen(function* () {
          const client = yield* HttpApiClient.make(HolonetDurableStreamsApi);
          const streamId = testStreamId();
          streamsToCleanup.push(streamId);

          yield* client.streams.create({
            path: { streamId },
            payload: { contentType: 'application/json' },
          });

          const result = yield* client.streams
            .read({
              path: { streamId },
              urlParams: {
                offset: '-1',
                limit: 100,
                timeout: 1000,
                live: 'long-poll',
              },
            })
            .pipe(Effect.either);

          expect(result._tag).toBe('Left');
          if (result._tag === 'Left') {
            expect(result.left._tag).toBe('ApiLongPollTimeoutError');
          }
        })
      );
    });
  });
});
