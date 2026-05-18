/**
 * Live NATS smoke tests.
 *
 * Run with either:
 *   MSH_LIVE_NATS=1 bunx vitest run test/live-unauth.test.ts
 *
 * Or against TMNL collab infra:
 *   cd packages/tmnl && ./.pi/skills/infra-up/scripts/infra-up.sh --group collab
 *   cd ../msh && MSH_LIVE_NATS_URL=ws://localhost:9222 bunx vitest run test/live-unauth.test.ts
 */

import { afterAll, beforeAll, expect, it } from 'vitest';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Schema from 'effect-v4/Schema';

import {
  NatsConnectionService,
  NatsInnerService,
  NatsStreamService,
} from '../src/nats';
import { liveDescribe, startLiveNats, type LiveNatsServer } from './support/live-nats';

const LiveEvent = Schema.Struct({
  id: Schema.String,
  value: Schema.Number,
});

type LiveEvent = typeof LiveEvent.Type;

const makeLiveLayers = (server: LiveNatsServer) => {
  const connection = NatsConnectionService.layerCustom({
    servers: server.servers,
    name: `msh-live-${Date.now()}`,
    reconnect: false,
    maxReconnectAttempts: 0,
    reconnectDelayMs: 50,
    debug: false,
  });
  const inner = NatsInnerService.layerFromConnection.pipe(Layer.provide(connection));
  const stream = NatsStreamService.layerFromInner.pipe(Layer.provide(inner));
  return { connection, inner, stream };
};

liveDescribe('live NATS unauthenticated', () => {
  let server: LiveNatsServer;

  beforeAll(async () => {
    server = await startLiveNats();
  }, 10_000);

  afterAll(async () => {
    await server?.stop();
  }, 10_000);

  it('connects over WebSocket and performs core publish/subscribe', async () => {
    const layers = makeLiveLayers(server);
    const subject = `msh.live.core.${Date.now()}`;

    const received = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const inner = yield* NatsInnerService;
          const sub = yield* inner.core.subscribe(subject);
          yield* inner.core.flush();
          yield* inner.core.publish(subject, new TextEncoder().encode('hello-live'));
          yield* inner.core.flush();

          return yield* Effect.promise(async () => {
            for await (const msg of sub) {
              sub.unsubscribe();
              return msg.string();
            }
            throw new Error('subscription ended without message');
          });
        }),
      ).pipe(Effect.provide(layers.inner)),
    );

    expect(received).toBe('hello-live');
  }, 10_000);

  it('ensures JetStream stream, publishes typed messages, and fetches them', async () => {
    const layers = makeLiveLayers(server);
    const suffix = Date.now();
    const streamName = `MSH_LIVE_${suffix}`;
    const subject = `msh.live.${suffix}.created`;

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const stream = yield* NatsStreamService;
          yield* stream.ensureStream({ name: streamName, subjects: [`msh.live.${suffix}.>`] });

          const event: LiveEvent = { id: 'live-1', value: 42 };
          const ack = yield* stream.publish(subject, LiveEvent, event, { expectStream: streamName });
          const consumer = yield* stream.getConsumer(streamName, 'worker', { durableName: 'worker' });
          const fetched = yield* stream.fetch(consumer, LiveEvent, { max: 10, expires: 1000 });
          const info = yield* stream.getStreamInfo(streamName);
          yield* stream.deleteStream(streamName);
          return { ack, fetched, info };
        }),
      ).pipe(Effect.provide(layers.stream)),
    );

    expect(result.ack.stream).toBe(streamName);
    expect(result.ack.seq).toBe(1);
    expect(result.fetched.map((msg) => msg.data)).toEqual([{ id: 'live-1', value: 42 }]);
    expect((result.info as any)?.state?.last_seq).toBeGreaterThanOrEqual(1);
  }, 10_000);
});
