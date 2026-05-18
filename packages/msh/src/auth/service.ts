/**
 * MshAuthService — Authenticator Factory + Credential Loading
 *
 * Invariants enforced:
 * - I1: Seeds/tokens wrapped in Redacted — never in logs
 * - I4: Authenticator function returns fresh sig per call (nats.ws handles this)
 * - I5: 8-state lifecycle FSM with explicit transitions
 * - I7: Credential provenance tracked per source type
 * - I8: Fail closed on misconfiguration
 * - I9: Span metadata includes mode/publicKey, never secrets
 *
 * @module @tmnl/msh/auth/service
 */

import * as Context from 'effect-v4/Context';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Ref from 'effect-v4/Ref';
import * as Redacted from 'effect-v4/Redacted';
import {
  jwtAuthenticator,
  nkeyAuthenticator,
  credsAuthenticator,
  tokenAuthenticator,
  type Authenticator,
} from 'nats.ws';

import { MshConfigTag, type MshConfig } from '../schemas/config';
import { MshSpan } from '../tracing';
import {
  type MshAuthMode,
  type AuthState,
  type AuthMetadata,
  NKeyAuth,
  JwtAuth,
  CredsAuth,
  TokenAuth,
  CredsFile,
  CredsEnv,
  CredsInline,
  CredentialLoadError,
  AuthenticationError,
  AuthInvariantViolation,
} from './schemas';

// =============================================================================
// Service Shape
// =============================================================================

export interface MshAuthServiceShape {
  /** Get the nats.ws Authenticator for the current auth mode */
  readonly getAuthenticator: Effect.Effect<Authenticator | undefined, CredentialLoadError | AuthInvariantViolation>;

  /** Current auth state (I5) */
  readonly state: Effect.Effect<AuthState>;

  /** Safe-to-log metadata about current auth (I9) */
  readonly metadata: Effect.Effect<AuthMetadata>;

  /** Transition to a new state (I5: explicit transitions only) */
  readonly transition: (to: AuthState) => Effect.Effect<void, AuthInvariantViolation>;

  /** The configured auth mode (if any) */
  readonly mode: MshAuthMode | undefined;
}

// =============================================================================
// State Machine Transitions (I5)
// =============================================================================

const VALID_TRANSITIONS: Record<AuthState, readonly AuthState[]> = {
  unconfigured: ['loading_credentials', 'ready'],
  loading_credentials: ['ready', 'failed'],
  ready: ['authenticating'],
  authenticating: ['authenticated', 'failed'],
  authenticated: ['expiring', 'failed'],
  expiring: ['rotating'],
  rotating: ['authenticated', 'failed'],
  failed: ['loading_credentials', 'unconfigured'],
};

// =============================================================================
// Credential Loading (I7)
// =============================================================================

const loadCredentialContents = (
  source: CredsFile | CredsEnv | CredsInline,
): Effect.Effect<Uint8Array, CredentialLoadError> => {
  switch (source._tag) {
    case 'CredsFile':
      return Effect.tryPromise({
        try: async () => {
          // Use dynamic import for fs to avoid bundler issues
          const fs = await import('fs');
          const contents = fs.readFileSync(source.path);
          return new Uint8Array(contents);
        },
        catch: (err) =>
          new CredentialLoadError({
            message: `Failed to read credentials file: ${source.path}`,
            source: `file:${source.path}`,
            cause: err,
          }),
      });

    case 'CredsEnv':
      return Effect.gen(function* () {
        const value = typeof process !== 'undefined'
          ? process.env[source.variable]
          : undefined;
        if (!value) {
          return yield* Effect.fail(
            new CredentialLoadError({
              message: `Environment variable '${source.variable}' not set or empty`,
              source: `env:${source.variable}`,
            }),
          );
        }
        return new TextEncoder().encode(value);
      });

    case 'CredsInline':
      return Effect.succeed(
        new TextEncoder().encode(Redacted.value(source.contents)),
      );
  }
};

// =============================================================================
// Authenticator Factory
// =============================================================================

const createAuthenticator = (
  mode: MshAuthMode,
): Effect.Effect<Authenticator, CredentialLoadError> =>
  Effect.gen(function* () {
    switch (mode._tag) {
      case 'NKeyAuth': {
        const seedStr = Redacted.value(mode.seed);
        const seedBytes = new TextEncoder().encode(seedStr);
        return nkeyAuthenticator(seedBytes);
      }
      case 'JwtAuth': {
        if (mode.seed) {
          const seedStr = Redacted.value(mode.seed);
          const seedBytes = new TextEncoder().encode(seedStr);
          return jwtAuthenticator(mode.jwt, seedBytes);
        }
        return jwtAuthenticator(mode.jwt);
      }
      case 'CredsAuth': {
        const contents = yield* loadCredentialContents(mode.source);
        return credsAuthenticator(contents);
      }
      case 'TokenAuth': {
        const tokenStr = Redacted.value(mode.token);
        return tokenAuthenticator(tokenStr);
      }
    }
  }).pipe(Effect.withSpan(MshSpan.Auth.createAuthenticator));

// =============================================================================
// Service Definition
// =============================================================================

export class MshAuthService extends Context.Service<
  MshAuthService,
  MshAuthServiceShape
>()('@tmnl/msh/auth/AuthService') {
  /** Injectable layer for tests/custom runtimes. Requires MshConfigTag. */
  static readonly layerFromConfig = Layer.effect(
    MshAuthService,
    Effect.gen(function* () {
      const config = yield* MshConfigTag;
      const authMode = config.auth;

      const stateRef = yield* Ref.make<AuthState>(
        authMode ? 'unconfigured' : 'ready',
      );

      // I5: Explicit state transitions only
      const transition: MshAuthServiceShape['transition'] = (to) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(stateRef);
          const allowed = VALID_TRANSITIONS[current];
          if (!allowed.includes(to)) {
            return yield* Effect.fail(
              new AuthInvariantViolation({
                invariant: 'I5',
                message: `Invalid auth state transition: ${current} → ${to}`,
                context: `allowed: ${allowed.join(', ')}`,
              }),
            );
          }
          yield* Ref.set(stateRef, to);
        }).pipe(Effect.withSpan(MshSpan.Auth.authenticate));

      const getAuthenticator =
        Effect.gen(function* () {
          if (!authMode) return undefined;

          const current = yield* Ref.get(stateRef);
          if (current === 'unconfigured' || current === 'failed') {
            yield* transition('loading_credentials');
          }

          const authenticator = yield* createAuthenticator(authMode).pipe(
            Effect.tapError(() => Ref.set(stateRef, 'failed')),
            Effect.mapError((err) =>
              new CredentialLoadError({
                message: `Failed to create authenticator for mode '${authMode._tag}'`,
                source: authMode._tag,
                cause: err,
              }),
            ),
          );

          const st = yield* Ref.get(stateRef);
          if (st === 'loading_credentials') {
            yield* transition('ready');
          }

          return authenticator;
        }).pipe(Effect.withSpan(MshSpan.Auth.loadCredentials));

      const state = Ref.get(stateRef);

      const metadata: Effect.Effect<AuthMetadata> = Effect.gen(function* () {
        const currentState = yield* Ref.get(stateRef);
        if (!authMode) {
          return {
            mode: 'none' as const,
            state: currentState,
          };
        }

        const modeLabel = ({
          NKeyAuth: 'nkey',
          JwtAuth: 'jwt',
          CredsAuth: 'creds',
          TokenAuth: 'token',
        } as const)[authMode._tag];

        return {
          mode: modeLabel,
          state: currentState,
          publicKey: authMode._tag === 'NKeyAuth' ? authMode.publicKey : undefined,
          sourceType: authMode._tag === 'CredsAuth' ? authMode.source._tag : undefined,
        };
      });

      return MshAuthService.of({
        getAuthenticator,
        state,
        metadata,
        transition,
        mode: authMode,
      });
    }),
  );

  static readonly layer = MshAuthService.layerFromConfig.pipe(
    Layer.provide(Layer.effect(MshConfigTag, Effect.succeed({
      servers: 'ws://localhost:9222',
      name: 'tmnl-msh',
      reconnect: true,
      maxReconnectAttempts: 10,
      reconnectDelayMs: 2000,
      debug: false,
    }))),
  );
}

export const MshAuthServiceLive = MshAuthService.layer;
