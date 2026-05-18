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
  TokenAuth,
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
});
