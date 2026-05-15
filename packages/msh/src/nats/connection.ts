/**
 * NATS Connection Service
 *
 * Provides scoped connection lifecycle management with Effect.acquireRelease.
 * Exposes nc (NatsConnection), js (JetStreamClient), and jsm (JetStreamManager).
 *
 * @module @tmnl/msh/nats/connection
 */

import * as Context from 'effect-v4/Context';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import {
  connect,
  type NatsConnection,
  type JetStreamClient,
  type JetStreamManager,
} from 'nats.ws';

import { MshConfigTag, MshConfigDefault, type MshConfig } from '../schemas/config';
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
  /** JetStream manager for stream/consumer administration */
  readonly jsm: JetStreamManager;
  /** The active configuration */
  readonly config: MshConfig;
}

// =============================================================================
// Service Definition (v4 Context.Service)
// =============================================================================

export class NatsConnectionService extends Context.Service<
  NatsConnectionService,
  NatsConnectionShape
>()('@tmnl/msh/nats/Connection') {
  static readonly layer = Layer.effect(
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
        (conn) =>
          Effect.sync(() => {
            if (config.debug) {
              console.log('[NatsConnectionService] Releasing connection...');
            }
            conn.drain().catch(() => {});
            conn.close().catch(() => {});
          }),
      );

      // Get JetStream client (synchronous)
      const js = nc.jetstream();

      // Get JetStream manager (async)
      const jsm = yield* Effect.tryPromise({
        try: () => nc.jetstreamManager(),
        catch: (err) =>
          new Connection.JetStreamManagerError({
            message: `Failed to get JetStream manager: ${err}`,
            cause: err,
          }),
      });

      return NatsConnectionService.of({ nc, js, jsm, config });
    }),
  ).pipe(Layer.provide(MshConfigDefault));

  /**
   * Custom layer with user-provided config.
   */
  static readonly layerCustom = (
    config: Parameters<typeof import('../schemas/config').MshConfigCustom>[0],
  ) => {
    const { MshConfigCustom } = require('../schemas/config') as typeof import('../schemas/config');
    return Layer.effect(
      NatsConnectionService,
      Effect.gen(function* () {
        const cfg = yield* MshConfigTag;

        const nc = yield* Effect.acquireRelease(
          Effect.tryPromise({
            try: async () => {
              const svrs: string | string[] = Array.isArray(cfg.servers)
                  ? [...cfg.servers] as string[]
                  : cfg.servers as string;
              return await connect({
                servers: svrs,
                name: cfg.name,
                reconnect: cfg.reconnect,
                maxReconnectAttempts: cfg.maxReconnectAttempts,
                reconnectTimeWait: cfg.reconnectDelayMs,
              });
            },
            catch: (err) =>
              new Connection.ConnectError({
                message: `Failed to connect to NATS: ${err}`,
                servers: cfg.servers,
                cause: err,
              }),
          }),
          (conn) =>
            Effect.sync(() => {
              conn.drain().catch(() => {});
              conn.close().catch(() => {});
            }),
        );

        const js = nc.jetstream();
        const jsm = yield* Effect.tryPromise({
          try: () => nc.jetstreamManager(),
          catch: (err) =>
            new Connection.JetStreamManagerError({
              message: `Failed to get JetStream manager: ${err}`,
              cause: err,
            }),
        });

        return NatsConnectionService.of({ nc, js, jsm, config: cfg });
      }),
    ).pipe(Layer.provide(MshConfigCustom(config)));
  };
}

// =============================================================================
// Layer Exports (convenience)
// =============================================================================

export const NatsConnectionServiceLive = NatsConnectionService.layer;
