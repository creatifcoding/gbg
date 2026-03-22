/**
 * NATS Micro Service Wrapper
 *
 * Effect service around the built-in NATS Services API (`nc.services`):
 * - add() for creating service instances
 * - client() for discovery/observability ($SRV.PING/INFO/STATS)
 * - stop() for graceful shutdown/drain
 *
 * @module holonet/nats/micro
 */

import { Effect, Scope } from 'effect';
import type {
  RequestManyOptions,
  Service,
  ServiceClient,
  ServiceConfig,
} from 'nats.ws';

import { NatsConnectionService } from './connection';
import { Micro } from './errors';

// =============================================================================
// Service Shape
// =============================================================================

export interface NatsMicroServiceShape {
  /**
   * Register and start a discoverable micro service instance.
   */
  readonly add: (
    config: ServiceConfig
  ) => Effect.Effect<Service, Micro.AddServiceError>;

  /**
   * Register and start a service tied to the current Scope.
   * Service is stopped/drained automatically on scope release.
   */
  readonly addScoped: (
    config: ServiceConfig
  ) => Effect.Effect<Service, Micro.AddServiceError, Scope.Scope>;

  /**
   * Create a service discovery client.
   */
  readonly client: (
    opts?: RequestManyOptions,
    prefix?: string
  ) => Effect.Effect<ServiceClient, Micro.ClientCreationError>;

  /**
   * Stop/drain a running service instance.
   */
  readonly stop: (
    service: Service,
    err?: Error
  ) => Effect.Effect<void, Micro.StopServiceError>;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class NatsMicroService extends Effect.Service<NatsMicroService>()(
  'holonet/nats/Micro',
  {
    effect: Effect.gen(function* () {
      const { nc } = yield* NatsConnectionService;

      const add = (
        config: ServiceConfig
      ): Effect.Effect<Service, Micro.AddServiceError> =>
        Effect.tryPromise({
          try: () => nc.services.add(config),
          catch: (cause) =>
            new Micro.AddServiceError({
              message: `Failed to add micro service '${config.name}'`,
              serviceName: config.name,
              cause,
            }),
        });

      const stop = (
        service: Service,
        err?: Error
      ): Effect.Effect<void, Micro.StopServiceError> =>
        Effect.tryPromise({
          try: async () => {
            await service.stop(err);
          },
          catch: (cause) =>
            new Micro.StopServiceError({
              message: `Failed to stop micro service '${service.ping().name}'`,
              serviceName: service.ping().name,
              serviceId: service.ping().id,
              cause,
            }),
        });

      const addScoped = (
        config: ServiceConfig
      ): Effect.Effect<Service, Micro.AddServiceError, Scope.Scope> =>
        Effect.acquireRelease(
          add(config),
          (service) =>
            stop(service).pipe(
              // release path must not fail
              Effect.catchAll(() => Effect.void)
            )
        );

      const client = (
        opts?: RequestManyOptions,
        prefix?: string
      ): Effect.Effect<ServiceClient, Micro.ClientCreationError> =>
        Effect.try({
          try: () => nc.services.client(opts, prefix),
          catch: (cause) =>
            new Micro.ClientCreationError({
              message: 'Failed to create NATS micro discovery client',
              cause,
            }),
        });

      return {
        add,
        addScoped,
        client,
        stop,
      } satisfies NatsMicroServiceShape;
    }),
    dependencies: [NatsConnectionService.Default],
  }
) {}

// =============================================================================
// Layer Export
// =============================================================================

export const NatsMicroServiceLive = NatsMicroService.Default;
