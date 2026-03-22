/**
 * Phoenix Auth Token Provider Service
 *
 * @module holonet/phoenix/services/PhoenixAuthTokenProvider
 */

import { Atom, Registry } from '@effect-atom/atom';
import { Context, Effect, Layer, Schema } from 'effect';
import { PhoenixErrors } from '../schemas/errors';

export const PhoenixAuthTokenPayload = Schema.Struct({
  token: Schema.String,
  expiresAtMs: Schema.Number,
});
export type PhoenixAuthTokenPayload = typeof PhoenixAuthTokenPayload.Type;

/**
 * Integration boundary to TMNL auth subsystem.
 *
 * Consumers should provide this service from existing TMNL auth runtime.
 */
export interface TmnlAuthTokenServiceShape {
  readonly getPhoenixAuthToken: Effect.Effect<PhoenixAuthTokenPayload, unknown>;
}

export const TmnlAuthTokenService = Context.GenericTag<TmnlAuthTokenServiceShape>(
  'tmnl/auth/TmnlAuthTokenService',
);

export const TmnlAuthTokenServiceFromResolver = (
  resolver: () => Promise<PhoenixAuthTokenPayload>,
): Layer.Layer<TmnlAuthTokenService> =>
  Layer.succeed(TmnlAuthTokenService, {
    getPhoenixAuthToken: Effect.tryPromise({
      try: () => resolver(),
      catch: (cause) =>
        new PhoenixErrors.AuthTokenError({
          message: 'TMNL auth token resolver failed',
          cause,
        }),
    }),
  });

export interface PhoenixAuthTokenProviderShape {
  readonly getToken: Effect.Effect<string, PhoenixErrors.AuthTokenError>;
  readonly clearCache: Effect.Effect<void>;
}

export class PhoenixAuthTokenProvider extends Effect.Service<PhoenixAuthTokenProvider>()(
  'holonet/phoenix/PhoenixAuthTokenProvider',
  {
    effect: Effect.gen(function* () {
      const tmnlAuth = yield* TmnlAuthTokenService;

      const cacheAtom = Atom.make<PhoenixAuthTokenPayload | null>(null);
      const refreshSkewMsAtom = Atom.make<number>(30_000);
      const registry = Registry.make();

      const now = () => Date.now();

      const clearCache: Effect.Effect<void> = Effect.sync(() => {
        registry.set(cacheAtom, null);
      });

      const getToken: Effect.Effect<string, PhoenixErrors.AuthTokenError> = Effect.gen(function* () {
        const cached = registry.get(cacheAtom);
        const refreshSkewMs = registry.get(refreshSkewMsAtom);

        if (cached !== null && cached.expiresAtMs - now() > refreshSkewMs) {
          return cached.token;
        }

        const next = yield* tmnlAuth.getPhoenixAuthToken.pipe(
          Effect.mapError((cause) =>
            new PhoenixErrors.AuthTokenError({
              message: 'Failed to retrieve Phoenix auth token from TMNL auth service',
              cause,
            }),
          ),
        );

        const validated = yield* Schema.decodeUnknown(PhoenixAuthTokenPayload)(next).pipe(
          Effect.mapError((cause) =>
            new PhoenixErrors.AuthTokenError({
              message: 'TMNL auth token payload failed schema validation',
              cause,
            }),
          ),
        );

        registry.set(cacheAtom, validated);
        return validated.token;
      });

      return {
        getToken,
        clearCache,
      } satisfies PhoenixAuthTokenProviderShape;
    }),
  },
) {}

export const TmnlAuthTokenServiceMissingLayer = Layer.succeed(TmnlAuthTokenService, {
  getPhoenixAuthToken: Effect.fail(
    new PhoenixErrors.AuthTokenError({
      message: 'TmnlAuthTokenService is not configured',
    }),
  ),
});
