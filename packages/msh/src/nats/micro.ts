/**
 * NATS Micro Service Wrapper
 *
 * @module @tmnl/msh/nats/micro
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import type * as Scope from 'effect/Scope';
import * as Layer from 'effect/Layer';
import type { RequestManyOptions, Service, ServiceClient, ServiceConfig } from 'nats.ws';

import { NatsConnectionService } from './connection';
import { Micro } from './errors';
import { MshSpan } from '../tracing';

// =============================================================================
// Service Shape
// =============================================================================

export interface NatsMicroServiceShape {
  readonly add: (config: ServiceConfig) => Effect.Effect<Service, Micro.AddServiceError>;
  readonly addScoped: (config: ServiceConfig) => Effect.Effect<Service, Micro.AddServiceError, Scope.Scope>;
  readonly client: (opts?: RequestManyOptions, prefix?: string) => Effect.Effect<ServiceClient, Micro.ClientCreationError>;
  readonly stop: (service: Service, err?: Error) => Effect.Effect<void, Micro.StopServiceError>;
}

// =============================================================================
// Service Definition
// =============================================================================

export class NatsMicroService extends Context.Service<
  NatsMicroService, NatsMicroServiceShape
>()('@tmnl/msh/nats/Micro') {
  static readonly layer = Layer.effect(
    NatsMicroService,
    Effect.gen(function* () {
      const { nc } = yield* NatsConnectionService;

      const add = (config: ServiceConfig): Effect.Effect<Service, Micro.AddServiceError> =>
        Effect.tryPromise({
          try: () => nc.services.add(config),
          catch: (cause) => new Micro.AddServiceError({ message: `Failed to add '${config.name}'`, serviceName: config.name, cause }),
        });

      const stop = (service: Service, err?: Error): Effect.Effect<void, Micro.StopServiceError> =>
        Effect.tryPromise({
          try: async () => { await service.stop(err); },
          catch: (cause) => new Micro.StopServiceError({
            message: `Failed to stop '${service.ping().name}'`,
            serviceName: service.ping().name, serviceId: service.ping().id, cause,
          }),
        });

      const addScoped = (config: ServiceConfig): Effect.Effect<Service, Micro.AddServiceError, Scope.Scope> =>
        Effect.acquireRelease(
          add(config),
          (svc) => stop(svc).pipe(Effect.orElseSucceed(() => void 0 as void)),
        );

      const client = (opts?: RequestManyOptions, prefix?: string): Effect.Effect<ServiceClient, Micro.ClientCreationError> =>
        Effect.try({
          try: () => nc.services.client(opts, prefix),
          catch: (cause) => new Micro.ClientCreationError({ message: 'Failed to create discovery client', cause }),
        });

      return NatsMicroService.of({
        add: (c) => add(c).pipe(Effect.withSpan(MshSpan.Micro.add)),
        addScoped: (c) => addScoped(c).pipe(Effect.withSpan(MshSpan.Micro.addScoped)),
        client: (o, p) => client(o, p).pipe(Effect.withSpan(MshSpan.Micro.client)),
        stop: (s, e) => stop(s, e).pipe(Effect.withSpan(MshSpan.Micro.stop)),
      });
    }),
  ).pipe(Layer.provide(NatsConnectionService.layer));
}

export const NatsMicroServiceLive = NatsMicroService.layer;
