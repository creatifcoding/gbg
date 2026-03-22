/**
 * NATS Connection Service
 *
 * Provides scoped connection lifecycle management with Effect.acquireRelease.
 * Exposes nc (NatsConnection), js (JetStreamClient), and jsm (JetStreamManager).
 *
 * @module holonet/nats/connection
 */

import { Effect, Layer } from 'effect';
import {
  connect,
  type NatsConnection,
  type JetStreamClient,
  type JetStreamManager,
} from 'nats.ws';

import { HolonetConfigTag, type HolonetConfig } from '../schemas/config';
import { Connection } from './errors';

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
  readonly config: HolonetConfig;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class NatsConnectionService extends Effect.Service<NatsConnectionService>()(
  'holonet/nats/Connection',
  {
    scoped: Effect.gen(function* () {
      const config = yield* HolonetConfigTag;

      if (config.debug) {
        console.log('[NatsConnectionService] Acquiring connection...', {
          servers: config.servers,
          name: config.name,
        });
      }

      // Acquire connection with scoped release
      const nc = yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: async () => {
            const servers = Array.isArray(config.servers)
              ? (config.servers as string[])
              : config.servers;

            const conn = await connect({
              servers,
              name: config.name,
              reconnect: config.reconnect,
              maxReconnectAttempts: config.maxReconnectAttempts,
              reconnectTimeWait: config.reconnectDelayMs,
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
            // Drain and close, ignoring errors during cleanup
            conn.drain().catch(() => {});
            conn.close().catch(() => {});
          })
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

      return { nc, js, jsm, config } satisfies NatsConnectionShape;
    }),
    dependencies: [HolonetConfigTag.Default],
  }
) {}

// =============================================================================
// Layer Exports
// =============================================================================

/**
 * Default layer using default config (ws://localhost:9222).
 */
export const NatsConnectionServiceLive = NatsConnectionService.Default;

/**
 * Custom layer with user-provided config.
 *
 * Uses `DefaultWithoutDependencies` to allow proper config override.
 * The `Default` layer has HolonetConfigTag.Default baked in via the
 * `dependencies` array, which cannot be overridden with Layer.provide.
 *
 * @example
 * ```typescript
 * const CustomConnection = NatsConnectionServiceCustom({
 *   servers: 'wss://nats.example.com:443',
 *   name: 'my-app',
 *   debug: true,
 * });
 *
 * Effect.gen(function* () {
 *   const { nc, js, jsm } = yield* NatsConnectionService;
 *   // Use the connection
 * }).pipe(Effect.provide(CustomConnection));
 * ```
 */
export const NatsConnectionServiceCustom = (
  config: Parameters<typeof HolonetConfigTag.Custom>[0]
) =>
  NatsConnectionService.DefaultWithoutDependencies.pipe(
    Layer.provide(HolonetConfigTag.Custom(config))
  );
