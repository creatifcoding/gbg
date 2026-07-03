/**
 * NATS Connection Service
 *
 * Provides scoped connection lifecycle management with Effect.acquireRelease.
 * Exposes nc (NatsConnection), js (JetStreamClient), and lazy JetStreamManager access.
 *
 * @module @tmnl/msh/nats/connection
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import {
  connect,
  type NatsConnection,
  type JetStreamClient,
  type JetStreamManager,
} from 'nats.ws';

import { MshConfigTag, MshConfigDefault, MshConfigCustom, type MshConfig, type MshConfigInput } from '../schemas/config';
import { Connection } from './errors';
import { MshAuthService } from '../auth/service';
import { MshSpan } from '../tracing';

// =============================================================================
// Service Shape
// =============================================================================

export interface NatsConnectionShape {
  /** Raw NATS connection for core pub/sub */
  readonly nc: NatsConnection;
  /** JetStream client for streams, KV, object store */
  readonly js: JetStreamClient;
  /** Optional already-resolved JetStream manager for stream/consumer administration. */
  readonly jsm?: JetStreamManager;
  /** Lazily resolve the JetStream manager; core pub/sub users do not require this permission. */
  readonly getJsm: () => Effect.Effect<JetStreamManager, Connection.JetStreamManagerError>;
  /** The active configuration */
  readonly config: MshConfig;
}

// =============================================================================
// Release Helpers
// =============================================================================

export const releaseNatsConnection = (
  conn: NatsConnection,
  config: Pick<MshConfig, 'debug'>,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (config.debug) {
      console.log('[NatsConnectionService] Releasing connection...');
    }

    yield* Effect.tryPromise({
      try: () => conn.drain(),
      catch: (err) => err,
    }).pipe(Effect.ignore);
    yield* Effect.tryPromise({
      try: () => conn.close(),
      catch: (err) => err,
    }).pipe(Effect.ignore);
  });

// =============================================================================
// Service Definition (v4 Context.Service)
// =============================================================================

export class NatsConnectionService extends Context.Service<
  NatsConnectionService,
  NatsConnectionShape
>()('@tmnl/msh/nats/Connection') {
  /** Injectable layer for tests/custom runtimes. Requires MshConfigTag. */
  static readonly layerFromConfig = Layer.effect(
    NatsConnectionService,
    Effect.gen(function* () {
      const config = yield* MshConfigTag;

      // Optionally get auth service (I8: absent = no auth, not error)
      const authResult = yield* Effect.result(
        Effect.serviceOption(MshAuthService),
      );
      let authenticator: import('nats.ws').Authenticator | undefined;

      // If auth service is available and config has auth mode, get authenticator
      if (authResult._tag === 'Success' && authResult.success._tag === 'Some') {
        const authService = authResult.success.value;
        const authFn = yield* authService.getAuthenticator;
        authenticator = authFn;
      }

      if (config.debug) {
        console.log('[NatsConnectionService] Acquiring connection...', {
          servers: config.servers,
          name: config.name,
          authMode: config.auth?._tag ?? 'none',
        });
      }

      // Acquire connection with scoped release
      const nc = yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: async () => {
            const svrs: string | string[] = Array.isArray(config.servers)
                ? [...config.servers] as string[]
                : config.servers as string;
            const conn = await connect({
              servers: svrs,
              name: config.name,
              reconnect: config.reconnect,
              maxReconnectAttempts: config.maxReconnectAttempts,
              reconnectTimeWait: config.reconnectDelayMs,
              ...(authenticator ? { authenticator } : {}),
            });

            if (config.debug) {
              console.log('[NatsConnectionService] Connected!');
            }

            return conn;
          },
          catch: (err) =>
            new Connection.ConnectError({
              message: `Failed to connect to NATS: ${err}`,
              servers: config.servers,
              cause: err,
            }),
        }),
        (conn) => releaseNatsConnection(conn, config),
      );

      // Get JetStream client (synchronous)
      const js = nc.jetstream();

      let jsmPromise: Promise<JetStreamManager> | undefined;
      const getJsm = () =>
        Effect.tryPromise({
          try: () => {
            jsmPromise ??= nc.jetstreamManager();
            return jsmPromise;
          },
          catch: (err) =>
            new Connection.JetStreamManagerError({
              message: `Failed to get JetStream manager: ${err}`,
              cause: err,
            }),
        });

      return NatsConnectionService.of({ nc, js, getJsm, config });
    }),
  );

  static readonly layer = NatsConnectionService.layerFromConfig.pipe(
    Layer.provide(MshConfigDefault),
  );

  /** Custom layer with user-provided config. */
  static readonly layerCustom = (config: MshConfigInput) =>
    NatsConnectionService.layerFromConfig.pipe(
      Layer.provide(MshConfigCustom(config)),
    );
}

// =============================================================================
// Layer Exports (convenience)
// =============================================================================

export const NatsConnectionServiceLive = NatsConnectionService.layer;
