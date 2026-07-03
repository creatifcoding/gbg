/**
 * NATS PubSub Service
 *
 * High-level typed pub/sub with Schema codecs.
 * Uses NatsHubService for connection sharing, NatsInnerService for request-reply.
 *
 * @module @tmnl/msh/nats/pubsub
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import { pipe } from 'effect/Function';
import type { Msg } from 'nats.ws';

import { NatsInnerService } from './inner';
import { NatsHubService, type TypedHubMessage } from './hub';
import { Inner, Codec, PubSub as PubSubErrors, Hub as HubErrors } from './errors';
import { NatsCodec } from './codec';
import { MshSpan } from '../tracing';

// =============================================================================
// Type Definitions
// =============================================================================

export interface TypedMessage<A> {
  readonly subject: string;
  readonly data: A;
  readonly reply?: string;
  readonly raw: Msg;
}

export interface PubSubSubscribeOptions {
  readonly queue?: string;
  readonly max?: number;
  readonly replay?: number;
}

export interface RequestOptions {
  readonly timeout?: number;
  readonly noMux?: boolean;
}

// =============================================================================
// Service Shape
// =============================================================================

export interface NatsPubSubServiceShape {
  readonly publish: <S extends Schema.Top>(
    subject: string,
    schema: S,
    data: S['Type'],
  ) => Effect.Effect<void, PubSubErrors.PublishError, S['EncodingServices']>;

  readonly subscribe: <S extends Schema.Top>(
    subject: string,
    schema: S,
    opts?: PubSubSubscribeOptions,
  ) => Effect.Effect<
    Stream.Stream<TypedMessage<S['Type']>, PubSubErrors.SubscribeError>,
    HubErrors.HubCreationError,
    Scope.Scope | S['DecodingServices']
  >;

  readonly request: <SReq extends Schema.Top, SRes extends Schema.Top>(
    subject: string,
    requestSchema: SReq,
    responseSchema: SRes,
    data: SReq['Type'],
    opts?: RequestOptions,
  ) => Effect.Effect<
    SRes['Type'],
    PubSubErrors.RequestError,
    SReq['EncodingServices'] | SRes['DecodingServices']
  >;

  readonly flush: () => Effect.Effect<void, Inner.Core.FlushError>;
}

// =============================================================================
// Service Definition (v4 Context.Service)
// =============================================================================

export class NatsPubSubService extends Context.Service<
  NatsPubSubService,
  NatsPubSubServiceShape
>()('@tmnl/msh/nats/PubSub') {
  /** Injectable layer for tests/custom runtimes. Requires NatsInnerService + NatsHubService. */
  static readonly layerFromServices = Layer.effect(
    NatsPubSubService,
    Effect.gen(function* () {
      const inner = yield* NatsInnerService;
      const hub = yield* NatsHubService;

      const publish: NatsPubSubServiceShape['publish'] = (subject, schema, data) =>
        pipe(
          hub.publish(subject, schema, data),
          Effect.mapError((err): PubSubErrors.PublishError => {
            if (err._tag === 'Codec/Encode') return err;
            if (err._tag === 'Inner/Core/Publish') return err;
            return new Inner.Core.PublishError({
              message: err.message,
              subject,
              cause: err,
            });
          }),
        );

      const subscribe: NatsPubSubServiceShape['subscribe'] = (subject, schema, opts) =>
        Effect.gen(function* () {

          const hubStream = yield* hub.subscribe(subject, schema, {
            queue: opts?.queue,
            replay: opts?.replay,
          });

          return pipe(
            hubStream,
            Stream.map(
              (msg: TypedHubMessage<any>): TypedMessage<any> => ({
                subject: msg.subject,
                data: msg.data,
                reply: msg.reply,
                raw: msg.raw,
              }),
            ),
            Stream.mapError((err): PubSubErrors.SubscribeError => {
              if (err._tag === 'Codec/Decode') return err;
              if (err._tag === 'Inner/Core/Subscribe') return err;
              return new Inner.Core.SubscribeError({
                message: err.message,
                subject,
                cause: err,
              });
            }),
          );
        });

      const request: NatsPubSubServiceShape['request'] = (
        subject,
        requestSchema,
        responseSchema,
        data,
        opts,
      ) =>
        Effect.gen(function* () {

          const requestBytes = yield* NatsCodec.encodeJson(requestSchema, data).pipe(
            Effect.mapError(
              (err) =>
                new Codec.EncodeError({
                  message: `Failed to encode request for '${subject}'`,
                  cause: err,
                }),
            ),
          );

          const response = yield* inner.core.request(subject, requestBytes, opts);

          return yield* NatsCodec.decodeJson(responseSchema, { subject })(response.data).pipe(
            Effect.mapError(
              (err) =>
                new Codec.DecodeError({
                  message: `Failed to decode response from '${subject}'`,
                  subject,
                  cause: err,
                }),
            ),
          );
        });

      const flush = () => hub.flush();

      return NatsPubSubService.of({
        publish: (s, sc, d) => publish(s, sc, d).pipe(Effect.withSpan(MshSpan.PubSub.publish)),
        subscribe: (s, sc, o) => subscribe(s, sc, o).pipe(Effect.withSpan(MshSpan.PubSub.subscribe)),
        request: (s, rq, rs, d, o) => request(s, rq, rs, d, o).pipe(Effect.withSpan(MshSpan.PubSub.request)),
        flush: () => flush().pipe(Effect.withSpan(MshSpan.PubSub.flush)),
      });
    }),
  );

  static readonly layer = NatsPubSubService.layerFromServices.pipe(
    Layer.provide(NatsInnerService.layer),
    Layer.provide(NatsHubService.layer),
  );
}

export const NatsPubSubServiceLive = NatsPubSubService.layer;
