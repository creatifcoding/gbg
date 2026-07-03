/**
 * NATS Connection Hub Service
 *
 * Efficient connection sharing via hub architecture. Multiple subscribers
 * to the same pattern share a single NATS subscription via local PubSub fan-out.
 *
 * @module @tmnl/msh/nats/hub
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import * as PubSub from 'effect/PubSub';

import * as Scope from 'effect/Scope';
import * as Schema from 'effect/Schema';
import { pipe } from 'effect/Function';
import type { Msg } from 'nats.ws';

import { NatsInnerService } from './inner';
import { Hub as HubErrors, Inner, Codec } from './errors';
import { NatsCodec } from './codec';
import { fromAsyncIterable } from '../utils/stream';

// =============================================================================
// Type Definitions
// =============================================================================

export interface TypedHubMessage<A> {
  readonly subject: string;
  readonly data: A;
  readonly reply?: string;
  readonly raw: Msg;
}

export interface SubjectHubConfig {
  readonly replay?: number;
  readonly idleTimeToLive?: number;
}

export interface HubSubscribeOptions {
  readonly queue?: string;
}

interface RawHubMessage {
  readonly subject: string;
  readonly data: Uint8Array;
  readonly reply?: string;
  readonly raw: Msg;
}

interface SubjectHub {
  readonly pubsub: PubSub.PubSub<RawHubMessage>;
  readonly pattern: string;
}

// =============================================================================
// Service Shape
// =============================================================================

export interface NatsHubServiceShape {
  readonly subscribe: <S extends Schema.Top>(
    pattern: string,
    schema: S,
    opts?: SubjectHubConfig & HubSubscribeOptions,
  ) => Effect.Effect<
    Stream.Stream<TypedHubMessage<S['Type']>, HubErrors.SubscribeError>,
    HubErrors.HubCreationError,
    Scope.Scope | S['DecodingServices']
  >;

  readonly publish: <S extends Schema.Top>(
    subject: string,
    schema: S,
    data: S['Type'],
  ) => Effect.Effect<void, HubErrors.PublishError, S['EncodingServices']>;

  readonly activePatterns: () => Effect.Effect<ReadonlyArray<string>>;

  readonly flush: () => Effect.Effect<void, Inner.Core.FlushError>;
}

// =============================================================================
// Service Definition (v4 Context.Service)
// =============================================================================

export class NatsHubService extends Context.Service<
  NatsHubService,
  NatsHubServiceShape
>()('@tmnl/msh/nats/Hub') {
  /** Injectable layer for tests/custom runtimes. Requires NatsInnerService. */
  static readonly layerFromInner = Layer.effect(
    NatsHubService,
    Effect.gen(function* () {
      const inner = yield* NatsInnerService;

      const defaultReplay = 3;

      const activeHubsMap = new Map<string, SubjectHub>();

      // ─── HUB FACTORY ──────────────────────────────────────────────────

      const createHub = (
        pattern: string,
        config: SubjectHubConfig & HubSubscribeOptions,
      ): Effect.Effect<
        SubjectHub,
        HubErrors.HubCreationError,
        Scope.Scope
      > =>
        Effect.gen(function* () {
          const replay = config.replay ?? defaultReplay;

          const pubsub = yield* Effect.acquireRelease(
            PubSub.unbounded<RawHubMessage>({ replay }),
            (ps) => PubSub.shutdown(ps),
          );

          const subscription = yield* inner.core
            .subscribe(pattern, { queue: config.queue })
            .pipe(
              Effect.mapError(
                (err) =>
                  new HubErrors.HubCreationError({
                    message: `Failed to create subscription for '${pattern}'`,
                    subject: pattern,
                    cause: err,
                  }),
              ),
            );

          const natsStream: Stream.Stream<Msg, Inner.Core.SubscribeError> =
            fromAsyncIterable(
              subscription,
              (err) =>
                new Inner.Core.SubscribeError({
                  message: `Subscription iteration error on '${pattern}'`,
                  subject: pattern,
                  cause: err,
                }),
              () => subscription.unsubscribe(),
            );

          const rawStream = pipe(
            natsStream,
            Stream.map((msg): RawHubMessage => ({
              subject: msg.subject,
              data: msg.data,
              reply: msg.reply,
              raw: msg,
            })),
          );

          yield* Effect.forkScoped(
            Stream.runForEach(rawStream, (msg) => PubSub.publish(pubsub, msg)),
          );

          return { pubsub, pattern };
        });

      // ─── SUBSCRIBE ────────────────────────────────────────────────────

      const subscribe: NatsHubServiceShape['subscribe'] = (pattern, schema, opts = {}) =>
        Effect.gen(function* () {
          const hubKey = `${pattern}::${opts.queue ?? ''}`;

          let hub = activeHubsMap.get(hubKey);

          if (!hub) {
            hub = yield* createHub(pattern, opts);
            activeHubsMap.set(hubKey, hub);

            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                if (activeHubsMap.get(hubKey) === hub) {
                  activeHubsMap.delete(hubKey);
                }
              }),
            );
          }

          return pipe(
            Stream.fromPubSub(hub.pubsub),
            Stream.mapEffect((msg) =>
              pipe(
                NatsCodec.decodeJson(schema, { subject: msg.subject })(msg.data),
                Effect.map(
                  (data): TypedHubMessage<any> => ({
                    subject: msg.subject,
                    data,
                    reply: msg.reply,
                    raw: msg.raw,
                  }),
                ),
                Effect.mapError(
                  (parseError) =>
                    new Codec.DecodeError({
                      message: `Failed to decode on '${msg.subject}'`,
                      subject: msg.subject,
                      cause: parseError,
                    }),
                ),
              ),
            ),
          ) as any;
        });

      // ─── PUBLISH ──────────────────────────────────────────────────────

      const publish: NatsHubServiceShape['publish'] = (subject, schema, data) =>
        Effect.gen(function* () {
          const bytes = yield* pipe(
            NatsCodec.encodeJson(schema, data),
            Effect.mapError(
              (err) =>
                new Codec.EncodeError({
                  message: `Failed to encode for '${subject}'`,
                  cause: err,
                }),
            ),
          );

          yield* pipe(
            inner.core.publish(subject, bytes),
            Effect.mapError(
              (err) =>
                new Inner.Core.PublishError({
                  message: `Failed to forward to NATS '${subject}'`,
                  subject,
                  cause: err,
                }),
            ),
          );
        },
      );

      const activePatterns = () =>
        Effect.sync(() =>
          Array.from(activeHubsMap.keys()).map((key) => key.split('::')[0]),
        );

      const flush = () => inner.core.flush();

      return NatsHubService.of({ subscribe, publish, activePatterns, flush });
    }),
  );

  static readonly layer = NatsHubService.layerFromInner.pipe(
    Layer.provide(NatsInnerService.layer),
  );
}

export const NatsHubServiceLive = NatsHubService.layer;
