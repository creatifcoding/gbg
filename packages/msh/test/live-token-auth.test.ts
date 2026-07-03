/**
 * Live NATS token auth tests.
 *
 * Run with:
 *   MSH_LIVE_NATS=1 bunx vitest run test/live-token-auth.test.ts
 */

import { afterAll, beforeAll, expect, it } from 'vitest';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Redacted from 'effect/Redacted';

import { MshConfigCustom } from '../src/schemas/config';
import { TokenAuth, MshAuthService } from '../src/auth';
import { NatsConnectionService, NatsInnerService } from '../src/nats';
import { liveDescribe, startLiveNats, type LiveNatsServer } from './support/live-nats';

const makeTokenLayers = (server: LiveNatsServer, token: string) => {
  const configLayer = MshConfigCustom({
    servers: server.servers,
    name: `msh-live-token-${Date.now()}`,
    reconnect: false,
    maxReconnectAttempts: 0,
    reconnectDelayMs: 50,
    debug: false,
    auth: new TokenAuth({ token: Redacted.make(token) }),
  });

  const authLayer = MshAuthService.layerFromConfig.pipe(Layer.provide(configLayer));
  const connectionLayer = NatsConnectionService.layerFromConfig.pipe(
    Layer.provide(configLayer),
    Layer.provide(authLayer),
  );
  const innerLayer = NatsInnerService.layerFromConnection.pipe(Layer.provide(connectionLayer));
  return { authLayer, connectionLayer, innerLayer };
};

liveDescribe('live NATS token auth', () => {
  let server: LiveNatsServer;
  const token = `msh-token-${Date.now()}`;

  beforeAll(async () => {
    server = await startLiveNats({
      authorization: `authorization {\n  token: "${token}"\n}`,
    });
  }, 10_000);

  afterAll(async () => {
    await server?.stop();
  }, 10_000);

  it('connects with TokenAuth and performs a real flush', async () => {
    const layers = makeTokenLayers(server, token);

    const metadata = await Effect.runPromise(
      Effect.gen(function* () {
        const auth = yield* MshAuthService;
        const inner = yield* NatsInnerService;
        yield* inner.core.flush();
        return yield* auth.metadata;
      }).pipe(Effect.provide(Layer.mergeAll(layers.authLayer, layers.innerLayer))),
    );

    expect(metadata.mode).toBe('token');
    expect(metadata.state).toBe('ready');
    expect('token' in metadata).toBe(false);
  }, 10_000);

  it('fails closed with an invalid token', async () => {
    const layers = makeTokenLayers(server, 'wrong-token');

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const inner = yield* NatsInnerService;
        yield* inner.core.flush();
      }).pipe(
        Effect.provide(layers.innerLayer),
        Effect.result,
      ),
    );

    expect(result._tag).toBe('Failure');
    if (result._tag === 'Failure') {
      expect(String(result.failure)).toContain('Connect');
    }
  }, 10_000);
});
