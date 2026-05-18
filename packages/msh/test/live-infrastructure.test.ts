/**
 * Live infrastructure acceptance tests.
 *
 * These cover real server behavior that the mock transport cannot prove: NATS KV
 * bucket semantics and JetStream duplicate message IDs.
 */

import { afterAll, beforeAll, expect, it } from 'vitest';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Schema from 'effect-v4/Schema';

import {
  NatsConnectionService,
  NatsInnerService,
  NatsKVService,
  NatsStreamService,
} from '../src/nats';
import { liveDescribe, startLiveNats, type LiveNatsServer } from './support/live-nats';

const LiveRecord = Schema.Struct({
  id: Schema.String,
  value: Schema.Number,
});

type LiveRecord = typeof LiveRecord.Type;

const makeLiveLayers = (server: LiveNatsServer) => {
  const connection = NatsConnectionService.layerCustom({
    servers: server.servers,
    name: `msh-live-infra-${Date.now()}`,
    reconnect: false,
    maxReconnectAttempts: 0,
    reconnectDelayMs: 50,
    debug: false,
  });
  const inner = NatsInnerService.layerFromConnection.pipe(Layer.provide(connection));
  const kv = NatsKVService.layerFromInner.pipe(Layer.provide(inner));
  const stream = NatsStreamService.layerFromInner.pipe(Layer.provide(inner));
  return { connection, inner, kv, stream };
};

liveDescribe('live NATS infrastructure semantics', () => {
  let server: LiveNatsServer;

  beforeAll(async () => {
    server = await startLiveNats();
  }, 10_000);

  afterAll(async () => {
    await server?.stop();
  }, 10_000);

  it('persists typed values in real NATS KV and reports missing keys as null', async () => {
    const layers = makeLiveLayers(server);
    const suffix = Date.now();
    const bucket = `MSH_LIVE_KV_${suffix}`;
    const key = 'records.alpha';

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const kv = yield* NatsKVService;
          const inner = yield* NatsInnerService;

          const firstRevision = yield* kv.put(bucket, key, LiveRecord, { id: 'alpha', value: 1 });
          const secondRevision = yield* kv.put(bucket, key, LiveRecord, { id: 'alpha', value: 2 });
          const got = yield* kv.get(bucket, key, LiveRecord);
          const keys = yield* kv.keys(bucket, 'records.>');
          const listed = yield* kv.list(bucket, LiveRecord);
          yield* kv.delete(bucket, key);
          const missing = yield* kv.getOrNull(bucket, key, LiveRecord);
          yield* inner.streams.delete(`KV_${bucket}`).pipe(Effect.orElseSucceed(() => false));

          return { firstRevision, secondRevision, got, keys, listed, missing };
        }),
      ).pipe(Effect.provide(Layer.mergeAll(layers.inner, layers.kv))),
    );

    expect(result.firstRevision).toBeGreaterThanOrEqual(1);
    expect(result.secondRevision).toBeGreaterThan(result.firstRevision);
    expect(result.got).toEqual({ id: 'alpha', value: 2 });
    expect(result.keys).toContain(key);
    expect(result.listed.map((entry) => entry.value)).toContainEqual({ id: 'alpha', value: 2 });
    expect(result.missing).toBeNull();
  }, 10_000);

  it('honors JetStream duplicate message IDs on a real stream', async () => {
    const layers = makeLiveLayers(server);
    const suffix = Date.now();
    const streamName = `MSH_LIVE_DUP_${suffix}`;
    const subject = `msh.live.dup.${suffix}.created`;

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const stream = yield* NatsStreamService;
          yield* stream.ensureStream({
            name: streamName,
            subjects: [`msh.live.dup.${suffix}.>`],
            duplicateWindow: 120_000_000_000,
          });

          const first = yield* stream.publish(subject, LiveRecord, { id: 'dup', value: 1 }, {
            msgId: 'same-message-id',
            expectStream: streamName,
          });
          const duplicate = yield* stream.publish(subject, LiveRecord, { id: 'dup', value: 2 }, {
            msgId: 'same-message-id',
            expectStream: streamName,
          });
          const info = yield* stream.getStreamInfo(streamName);
          yield* stream.deleteStream(streamName);
          return { first, duplicate, info };
        }),
      ).pipe(Effect.provide(layers.stream)),
    );

    expect(result.first.duplicate).toBe(false);
    expect(result.duplicate.duplicate).toBe(true);
    expect(result.duplicate.seq).toBe(result.first.seq);
    expect((result.info as any)?.state?.messages).toBe(1);
  }, 10_000);
});
