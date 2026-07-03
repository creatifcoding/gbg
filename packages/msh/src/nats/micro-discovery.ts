/**
 * NATS Micro Discovery Service
 *
 * Stream adapters for service discovery queries (PING/INFO/STATS).
 *
 * @module @tmnl/msh/nats/micro-discovery
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import type { ServiceIdentity, ServiceInfo, ServiceStats } from 'nats.ws';

import { fromAsyncIterable } from '../utils/stream';
import { NatsMicroService } from './micro';
import { Micro } from './errors';
import { MshSpan } from '../tracing';

// =============================================================================
// Service Shape
// =============================================================================

export interface NatsServiceDiscoveryServiceShape {
  readonly ping: (
    name?: string,
    id?: string
  ) => Effect.Effect<
    Stream.Stream<ServiceIdentity, Micro.DiscoveryQueryError>,
    Micro.DiscoveryQueryError | Micro.ClientCreationError
  >;
  readonly info: (
    name?: string,
    id?: string
  ) => Effect.Effect<
    Stream.Stream<ServiceInfo, Micro.DiscoveryQueryError>,
    Micro.DiscoveryQueryError | Micro.ClientCreationError
  >;
  readonly stats: (
    name?: string,
    id?: string
  ) => Effect.Effect<
    Stream.Stream<ServiceStats, Micro.DiscoveryQueryError>,
    Micro.DiscoveryQueryError | Micro.ClientCreationError
  >;
}

// =============================================================================
// Service Definition
// =============================================================================

// [REFACTOR] I am unsure whether or not we have the full coverage for this particular service. Let's enumerate the NATS Micro Service Discovery API's and ensure we're not leaving anything out.
export class NatsServiceDiscoveryService extends Context.Service<
  NatsServiceDiscoveryService,
  NatsServiceDiscoveryServiceShape
>()('@tmnl/msh/nats/MicroDiscovery') {
  static readonly layer = Layer.effect(
    NatsServiceDiscoveryService,
    Effect.gen(function* () {
      const micro = yield* NatsMicroService;

      const makeQuery =
        <T>(
          operation: 'ping' | 'info' | 'stats',
          queryFn: (
            client: any,
            name: string,
            id: string
          ) => Promise<AsyncIterable<T>>
        ) =>
        (name = '', id = '') =>
          Effect.gen(function* () {
            const client = yield* micro.client();
            const iter = yield* Effect.tryPromise({
              try: () => queryFn(client, name, id),
              catch: (cause) =>
                new Micro.DiscoveryQueryError({
                  message: `Failed ${operation.toUpperCase()} for '${
                    name || '*'
                  }'`,
                  operation,
                  serviceName: name || undefined,
                  serviceId: id || undefined,
                  cause,
                }),
            });
            return fromAsyncIterable(
              iter,
              (cause) =>
                new Micro.DiscoveryQueryError({
                  message: `Iteration error ${operation.toUpperCase()} for '${
                    name || '*'
                  }'`,
                  operation,
                  serviceName: name || undefined,
                  serviceId: id || undefined,
                  cause,
                })
            );
          });

      return NatsServiceDiscoveryService.of({
        ping: (n, i) =>
          makeQuery<ServiceIdentity>('ping', (c, nn, ii) => c.ping(nn, ii))(
            n,
            i
          ).pipe(Effect.withSpan(MshSpan.Discovery.ping)),
        info: (n, i) =>
          makeQuery<ServiceInfo>('info', (c, nn, ii) => c.info(nn, ii))(
            n,
            i
          ).pipe(Effect.withSpan(MshSpan.Discovery.info)),
        stats: (n, i) =>
          makeQuery<ServiceStats>('stats', (c, nn, ii) => c.stats(nn, ii))(
            n,
            i
          ).pipe(Effect.withSpan(MshSpan.Discovery.stats)),
      });
    })
  ).pipe(Layer.provide(NatsMicroService.layer));
}

export const NatsServiceDiscoveryServiceLive =
  NatsServiceDiscoveryService.layer;
