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

import * as Config from 'effect/Config';
import * as ConfigProvider from 'effect/ConfigProvider';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as Redacted from 'effect/Redacted';
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
  type AuthLifecycleSignal,
  type AuthLifecycleSignalTag,
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

  /** Apply a semantic lifecycle signal (I5: explicit operation-driven transitions) */
  readonly signal: (signal: AuthLifecycleSignal) => Effect.Effect<void, AuthInvariantViolation>;

  /** Transition to a new state (I5: compatibility adapter over the lifecycle graph) */
  readonly transition: (to: AuthState) => Effect.Effect<void, AuthInvariantViolation>;

  /** The configured auth mode (if any) */
  readonly mode: MshAuthMode | undefined;
}

export interface MshCredentialSourceReaderShape {
  readonly readFile: (path: string) => Effect.Effect<Uint8Array, CredentialLoadError>;
  readonly readEnv: (variable: string) => Effect.Effect<string, CredentialLoadError>;
}

// =============================================================================
// State Machine Transitions (I5)
// =============================================================================

const AUTH_LIFECYCLE_GRAPH = {
  unconfigured: {
    CredentialLoadRequested: 'loading_credentials',
    CredentialLoadSucceeded: 'ready',
  },
  loading_credentials: {
    CredentialLoadSucceeded: 'ready',
    CredentialLoadFailed: 'failed',
  },
  ready: {
    CredentialLoadRequested: 'loading_credentials',
    AuthenticationRequested: 'authenticating',
  },
  authenticating: {
    AuthenticationSucceeded: 'authenticated',
    AuthenticationFailed: 'failed',
  },
  authenticated: {
    CredentialExpiryDetected: 'expiring',
    AuthenticationFailed: 'failed',
  },
  expiring: {
    CredentialRotationRequested: 'rotating',
  },
  rotating: {
    CredentialRotationSucceeded: 'authenticated',
    CredentialRotationFailed: 'failed',
  },
  failed: {
    CredentialLoadRequested: 'loading_credentials',
    AuthResetRequested: 'unconfigured',
  },
} satisfies Record<AuthState, Partial<Record<AuthLifecycleSignalTag, AuthState>>>;

const transitionTargetsFromState = (state: AuthState): readonly AuthState[] =>
  [...new Set(Object.values(AUTH_LIFECYCLE_GRAPH[state]))];

const nextStateForSignal = (
  current: AuthState,
  signal: AuthLifecycleSignal,
): Option.Option<AuthState> => {
  const transitions = AUTH_LIFECYCLE_GRAPH[current] as Partial<Record<AuthLifecycleSignalTag, AuthState>>;
  return Option.fromNullishOr(transitions[signal._tag]);
};

// =============================================================================
// Credential Source Reader (I7)
// =============================================================================

export class MshCredentialSourceReader extends Context.Service<
  MshCredentialSourceReader,
  MshCredentialSourceReaderShape
>()('@tmnl/msh/auth/CredentialSourceReader') {
  static readonly layer = Layer.succeed(
    MshCredentialSourceReader,
    MshCredentialSourceReader.of({
      readFile: Effect.fn(MshSpan.Auth.readCredentialFile)(function*(path: string) {
        const fs = yield* Effect.tryPromise({
          try: () => import('node:fs/promises'),
          catch: (cause) =>
            new CredentialLoadError({
              message: 'Failed to load node filesystem module',
              source: 'file',
              cause,
            }),
        });

        const contents = yield* Effect.tryPromise({
          try: () => fs.readFile(path),
          catch: (cause) =>
            new CredentialLoadError({
              message: `Failed to read credentials file: ${path}`,
              source: `file:${path}`,
              cause,
            }),
        });

        return new Uint8Array(contents);
      }),

      readEnv: Effect.fn(MshSpan.Auth.readCredentialEnv)(function*(variable: string) {
        const value = yield* Config.string(variable)
          .parse(ConfigProvider.fromEnv())
          .pipe(
            Effect.mapError(
              (cause) =>
                new CredentialLoadError({
                  message: `Environment variable '${variable}' not set or empty`,
                  source: `env:${variable}`,
                  cause,
                }),
            ),
          );

        if (!value) {
          return yield* Effect.fail(
            new CredentialLoadError({
              message: `Environment variable '${variable}' not set or empty`,
              source: `env:${variable}`,
            }),
          );
        }

        return value;
      }),
    }),
  );
}

const loadCredentialContents = Effect.fn(MshSpan.Auth.loadCredentials)(
  function*(
    reader: MshCredentialSourceReaderShape,
    source: CredsFile | CredsEnv | CredsInline,
  ) {
    switch (source._tag) {
      case 'CredsFile':
        return yield* reader.readFile(source.path);

      case 'CredsEnv': {
        const value = yield* reader.readEnv(source.variable);
        return new TextEncoder().encode(value);
      }

      case 'CredsInline':
        return new TextEncoder().encode(Redacted.value(source.contents));
    }
  },
);

// =============================================================================
// Authenticator Factory
// =============================================================================

const createAuthenticator = (
  mode: MshAuthMode,
  reader: MshCredentialSourceReaderShape,
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
        const contents = yield* loadCredentialContents(reader, mode.source);
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
  /** Injectable layer for tests/custom runtimes. Requires MshConfigTag + MshCredentialSourceReader. */
  static readonly layerFromConfigAndCredentialSource = Layer.effect(
    MshAuthService,
    Effect.gen(function* () {
      const config = yield* MshConfigTag;
      const authMode = config.auth;
      const credentialSourceReader = yield* MshCredentialSourceReader;

      const stateRef = yield* Ref.make<AuthState>(
        authMode ? 'unconfigured' : 'ready',
      );

      const signal: MshAuthServiceShape['signal'] = (authSignal) => {
        const planned = Ref.modify(stateRef, (current): readonly [Effect.Effect<void, AuthInvariantViolation>, AuthState] =>
          Option.match(nextStateForSignal(current, authSignal), {
            onNone: () => [
              Effect.fail(
                new AuthInvariantViolation({
                  invariant: 'I5',
                  message: `Invalid auth lifecycle signal '${authSignal._tag}' from state '${current}'`,
                  context: `allowed: ${Object.keys(AUTH_LIFECYCLE_GRAPH[current]).join(', ')}`,
                }),
              ),
              current,
            ] as const,
            onSome: (next) => [Effect.void, next] as const,
          }),
        );

        return planned.pipe(Effect.flatten, Effect.withSpan(MshSpan.Auth.lifecycleSignal));
      };

      // I5: Compatibility adapter for callers that still use target-state transitions.
      const transition: MshAuthServiceShape['transition'] = (to) => {
        const planned = Ref.modify(stateRef, (current): readonly [Effect.Effect<void, AuthInvariantViolation>, AuthState] => {
          const allowed = transitionTargetsFromState(current);
          return allowed.includes(to)
            ? [Effect.void, to] as const
            : [
                Effect.fail(
                  new AuthInvariantViolation({
                    invariant: 'I5',
                    message: `Invalid auth state transition: ${current} → ${to}`,
                    context: `allowed: ${allowed.join(', ')}`,
                  }),
                ),
                current,
              ] as const;
        });

        return planned.pipe(Effect.flatten, Effect.withSpan(MshSpan.Auth.authenticate));
      };

      const getAuthenticator =
        Effect.gen(function* () {
          if (!authMode) return undefined;

          yield* signal({ _tag: 'CredentialLoadRequested' });

          const authenticator = yield* createAuthenticator(authMode, credentialSourceReader).pipe(
            Effect.mapError((err) =>
              new CredentialLoadError({
                message: `Failed to create authenticator for mode '${authMode._tag}'`,
                source: authMode._tag,
                cause: err,
              }),
            ),
            Effect.tapError(() => signal({ _tag: 'CredentialLoadFailed' })),
          );

          yield* signal({ _tag: 'CredentialLoadSucceeded' });

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
        signal,
        transition,
        mode: authMode,
      });
    }),
  );

  /** Injectable layer for tests/custom runtimes. Requires MshConfigTag. */
  static readonly layerFromConfig = MshAuthService.layerFromConfigAndCredentialSource.pipe(
    Layer.provide(MshCredentialSourceReader.layer),
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
