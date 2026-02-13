import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  PhoenixAuthTokenProvider,
  TmnlAuthTokenService,
} from '../services/PhoenixAuthTokenProvider';

describe('PhoenixAuthTokenProvider', () => {
  it('uses TMNL auth service and caches token until clear', async () => {
    let calls = 0;

    const tmnlAuthStub = {
      getPhoenixAuthToken: Effect.sync(() => {
        calls += 1;
        return {
          token: `token-${calls}`,
          expiresAtMs: Date.now() + 120_000,
        };
      }),
    } as const;

    const providerLayer = PhoenixAuthTokenProvider.Default.pipe(
      Layer.provide(Layer.succeed(TmnlAuthTokenService, tmnlAuthStub)),
    );

    const program = Effect.gen(function* () {
      const provider = yield* PhoenixAuthTokenProvider;

      const token1 = yield* provider.getToken;
      const token2 = yield* provider.getToken;
      yield* provider.clearCache;
      const token3 = yield* provider.getToken;

      return { token1, token2, token3 };
    }).pipe(Effect.provide(providerLayer));

    const result = await Effect.runPromise(program);

    expect(result.token1).toBe('token-1');
    expect(result.token2).toBe('token-1');
    expect(result.token3).toBe('token-2');
    expect(calls).toBe(2);
  });
});
