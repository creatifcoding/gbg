/**
 * Behavioral auth tests.
 *
 * These focus on state transitions and fail-closed service behavior rather than
 * individual schema shape assertions.
 */

import { describe, expect, it } from 'vitest';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Redacted from 'effect-v4/Redacted';

import { MshConfigCustom } from '../src/schemas/config';
import {
  AuthInvariantViolation,
  CredsEnv,
  CredsAuth,
  MshAuthService,
  MshJwtService,
  MshJwtServiceLive,
  TokenAuth,
  UserJwtRequest,
} from '../src/auth';

const baseConfig = {
  servers: 'mock://auth',
  name: 'auth-behavior-test',
  reconnect: false,
  maxReconnectAttempts: 0,
  reconnectDelayMs: 0,
  debug: false,
} as const;

const authLayer = (auth?: Parameters<typeof MshConfigCustom>[0]['auth']) =>
  MshAuthService.layerFromConfig.pipe(
    Layer.provide(MshConfigCustom({ ...baseConfig, ...(auth ? { auth } : {}) })),
  );

describe('MshAuthService behavior', () => {
  it('no auth mode degrades to ready state and no authenticator', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const auth = yield* MshAuthService;
        const state = yield* auth.state;
        const authenticator = yield* auth.getAuthenticator;
        const metadata = yield* auth.metadata;
        return { state, authenticator, metadata };
      }).pipe(Effect.provide(authLayer())),
    );

    expect(result.state).toBe('ready');
    expect(result.authenticator).toBeUndefined();
    expect(result.metadata).toEqual({ mode: 'none', state: 'ready' });
  });

  it('token auth loads credentials once and exposes secret-free metadata', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const auth = yield* MshAuthService;
        const initial = yield* auth.state;
        const authenticator = yield* auth.getAuthenticator;
        const afterLoad = yield* auth.state;
        const metadata = yield* auth.metadata;
        return { initial, authenticator, afterLoad, metadata };
      }).pipe(Effect.provide(authLayer(new TokenAuth({ token: Redacted.make('top-secret-token') })))),
    );

    expect(result.initial).toBe('unconfigured');
    expect(typeof result.authenticator).toBe('function');
    expect(result.afterLoad).toBe('ready');
    expect(result.metadata.mode).toBe('token');
    expect(result.metadata.state).toBe('ready');
    expect('token' in result.metadata).toBe(false);
  });

  it('enforces explicit auth state transition graph', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const auth = yield* MshAuthService;
        yield* auth.getAuthenticator;
        yield* auth.transition('authenticating');
        yield* auth.transition('authenticated');
        yield* auth.transition('expiring');
        yield* auth.transition('rotating');
        yield* auth.transition('authenticated');
        return yield* auth.state;
      }).pipe(Effect.provide(authLayer(new TokenAuth({ token: Redacted.make('transition-token') })))),
    );

    expect(result).toBe('authenticated');
  });

  it('fails closed on invalid auth state transitions', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const auth = yield* MshAuthService;
        return yield* auth.transition('rotating').pipe(Effect.result);
      }).pipe(Effect.provide(authLayer(new TokenAuth({ token: Redacted.make('bad-transition') })))),
    );

    expect(result._tag).toBe('Failure');
    if (result._tag === 'Failure') {
      expect(result.failure).toBeInstanceOf(AuthInvariantViolation);
      expect(result.failure.invariant).toBe('I5');
    }
  });

  it('moves to failed when credential loading fails', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const auth = yield* MshAuthService;
        const load = yield* auth.getAuthenticator.pipe(Effect.result);
        const state = yield* auth.state;
        return { load, state };
      }).pipe(Effect.provide(authLayer(new CredsAuth({ source: new CredsEnv({ variable: 'MSH_AUTH_TEST_MISSING_CREDS' }) })))),
    );

    expect(result.load._tag).toBe('Failure');
    expect(result.state).toBe('failed');
  });

  it('recovers from failed credential loading when credentials become available', async () => {
    const variable = `MSH_AUTH_TEST_RETRY_CREDS_${Date.now()}`;
    delete process.env[variable];

    try {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const jwt = yield* MshJwtService;
          const account = yield* jwt.createAccountKeyPair;
          const user = yield* jwt.createUserKeyPair;
          const userJwt = yield* jwt.encodeUser(new UserJwtRequest({
            name: 'Retry User',
            user,
            issuer: account,
          }));
          const creds = yield* jwt.formatCreds(userJwt, user);
          const auth = yield* MshAuthService;

          const first = yield* auth.getAuthenticator.pipe(Effect.result);
          const afterFirst = yield* auth.state;
          process.env[variable] = new TextDecoder().decode(creds);
          const second = yield* auth.getAuthenticator.pipe(Effect.result);
          const afterSecond = yield* auth.state;

          return { first, afterFirst, second, afterSecond };
        }).pipe(
          Effect.provide(Layer.mergeAll(
            authLayer(new CredsAuth({ source: new CredsEnv({ variable }) })),
            MshJwtServiceLive,
          )),
        ),
      );

      expect(result.first._tag).toBe('Failure');
      expect(result.afterFirst).toBe('failed');
      expect(result.second._tag).toBe('Success');
      expect(result.afterSecond).toBe('ready');
    } finally {
      delete process.env[variable];
    }
  });
});
