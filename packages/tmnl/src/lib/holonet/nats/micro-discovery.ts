/**
 * NATS Micro Discovery Service
 *
 * Stream adapters for service discovery/observability queries:
 * - ping()  → $SRV.PING...
 * - info()  → $SRV.INFO...
 * - stats() → $SRV.STATS...
 *
 * Uses requestMany internally via nats.js ServiceClient.
 *
 * @module holonet/nats/micro-discovery
 */

import { Effect, Stream } from 'effect';
import type { ServiceIdentity, ServiceInfo, ServiceStats } from 'nats.ws';

import { fromAsyncIterable } from '../utils/stream';
import { NatsMicroService } from './micro';
import { Micro } from './errors';

// =============================================================================
// Service Shape
// =============================================================================

export interface NatsServiceDiscoveryServiceShape {
  /** Stream service identities (PING). */
  readonly ping: (
    name?: string,
    id?: string
  ) => Effect.Effect<
    Stream.Stream<ServiceIdentity, Micro.DiscoveryQueryError>,
    Micro.DiscoveryQueryError
  >;

  /** Stream service metadata (INFO). */
  readonly info: (
    name?: string,
    id?: string
  ) => Effect.Effect<
    Stream.Stream<ServiceInfo, Micro.DiscoveryQueryError>,
    Micro.DiscoveryQueryError
  >;

  /** Stream service metrics/statistics (STATS). */
  readonly stats: (
    name?: string,
    id?: string
  ) => Effect.Effect<
    Stream.Stream<ServiceStats, Micro.DiscoveryQueryError>,
    Micro.DiscoveryQueryError
  >;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class NatsServiceDiscoveryService extends Effect.Service<NatsServiceDiscoveryService>()(
  'holonet/nats/MicroDiscovery',
  {
    effect: Effect.gen(function* () {
      const micro = yield* NatsMicroService;

      const ping = (
        name = '',
        id = ''
      ): Effect.Effect<
        Stream.Stream<ServiceIdentity, Micro.DiscoveryQueryError>,
        Micro.DiscoveryQueryError
      > =>
        Effect.gen(function* () {
          const client = yield* micro.client();
          const iter = yield* Effect.tryPromise({
            try: () => client.ping(name, id),
            catch: (cause) =>
              new Micro.DiscoveryQueryError({
                message: `Failed to query PING for '${name || '*'}'`,
                operation: 'ping',
                serviceName: name || undefined,
                serviceId: id || undefined,
                cause,
              }),
          });

          return fromAsyncIterable(
            iter,
            (cause) =>
              new Micro.DiscoveryQueryError({
                message: `Failed while iterating PING responses for '${name || '*'}'`,
                operation: 'ping',
                serviceName: name || undefined,
                serviceId: id || undefined,
                cause,
              })
          );
        });

      const info = (
        name = '',
        id = ''
      ): Effect.Effect<
        Stream.Stream<ServiceInfo, Micro.DiscoveryQueryError>,
        Micro.DiscoveryQueryError
      > =>
        Effect.gen(function* () {
          const client = yield* micro.client();
          const iter = yield* Effect.tryPromise({
            try: () => client.info(name, id),
            catch: (cause) =>
              new Micro.DiscoveryQueryError({
                message: `Failed to query INFO for '${name || '*'}'`,
                operation: 'info',
                serviceName: name || undefined,
                serviceId: id || undefined,
                cause,
              }),
          });

          return fromAsyncIterable(
            iter,
            (cause) =>
              new Micro.DiscoveryQueryError({
                message: `Failed while iterating INFO responses for '${name || '*'}'`,
                operation: 'info',
                serviceName: name || undefined,
                serviceId: id || undefined,
                cause,
              })
          );
        });

      const stats = (
        name = '',
        id = ''
      ): Effect.Effect<
        Stream.Stream<ServiceStats, Micro.DiscoveryQueryError>,
        Micro.DiscoveryQueryError
      > =>
        Effect.gen(function* () {
          const client = yield* micro.client();
          const iter = yield* Effect.tryPromise({
            try: () => client.stats(name, id),
            catch: (cause) =>
              new Micro.DiscoveryQueryError({
                message: `Failed to query STATS for '${name || '*'}'`,
                operation: 'stats',
                serviceName: name || undefined,
                serviceId: id || undefined,
                cause,
              }),
          });

          return fromAsyncIterable(
            iter,
            (cause) =>
              new Micro.DiscoveryQueryError({
                message: `Failed while iterating STATS responses for '${name || '*'}'`,
                operation: 'stats',
                serviceName: name || undefined,
                serviceId: id || undefined,
                cause,
              })
          );
        });

      return {
        ping,
        info,
        stats,
      } satisfies NatsServiceDiscoveryServiceShape;
    }),
    dependencies: [NatsMicroService.Default],
  }
) {}

// =============================================================================
// Layer Export
// =============================================================================

export const NatsServiceDiscoveryServiceLive = NatsServiceDiscoveryService.Default;
