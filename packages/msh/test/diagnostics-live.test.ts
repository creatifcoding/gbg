/** Opt-in live NATS diagnostics checks. */

import { afterAll, beforeAll, expect, it } from 'vitest';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Schema from 'effect-v4/Schema';

import { MshDiagnosticsService, MshDiagnosticsServiceLive } from '../src/diagnostics';
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

const makeLiveLayer = (server: LiveNatsServer) => {
  const connection = NatsConnectionService.layerCustom({
    servers: server.servers,
    name: `msh-diagnostics-live-${Date.now()}`,
    reconnect: false,
    maxReconnectAttempts: 0,
    reconnectDelayMs: 50,
    debug: false,
  });
  const inner = NatsInnerService.layerFromConnection.pipe(Layer.provide(connection));
  const stream = NatsStreamService.layerFromInner.pipe(Layer.provide(inner));
  const kv = NatsKVService.layerFromInner.pipe(Layer.provide(inner));
  const substrate = Layer.mergeAll(connection, inner, stream, kv);
  return Layer.mergeAll(substrate, MshDiagnosticsServiceLive.pipe(Layer.provide(substrate)));
};

liveDescribe('live NATS diagnostics checks', () => {
  let server: LiveNatsServer;

  beforeAll(async () => {
    server = await startLiveNats();
  }, 10_000);

  afterAll(async () => {
    await server?.stop();
  }, 10_000);

  it('checks flush, JSM, stream info, and KV bucket against a live server', async () => {
    const suffix = Date.now();
    const streamName = `MSH_DIAGNOSTICS_${suffix}`;
    const bucketName = `MSH_DIAGNOSTICS_KV_${suffix}`;

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const stream = yield* NatsStreamService;
          const kv = yield* NatsKVService;
          const inner = yield* NatsInnerService;
          yield* stream.ensureStream({ name: streamName, subjects: [`diagnostics.${suffix}.>`] });
          yield* kv.put(bucketName, 'probe', LiveRecord, { id: 'probe', value: 1 });

          const diagnostics = yield* MshDiagnosticsService;
          const report = yield* diagnostics.report;
          const streamCheck = yield* diagnostics.checkStreamInfo(streamName);
          const kvCheck = yield* diagnostics.checkKvBucket(bucketName);

          yield* inner.streams.delete(streamName).pipe(Effect.orElseSucceed(() => false));
          yield* inner.streams.delete(`KV_${bucketName}`).pipe(Effect.orElseSucceed(() => false));

          return { report, streamCheck, kvCheck };
        }),
      ).pipe(Effect.provide(makeLiveLayer(server))),
    );

    expect(result.report.checks.map((check) => check.checkId)).toContain('msh.jsm.access');
    expect(result.report.severity).toBe('ok');
    expect(result.streamCheck.status).toBe('passed');
    expect(result.kvCheck.status).toBe('passed');
  }, 10_000);
});
