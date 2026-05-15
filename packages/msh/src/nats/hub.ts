/**
 * NATS Connection Hub Service
 *
 * Efficient connection sharing via hub architecture. Multiple subscribers
 * to the same pattern share a single NATS subscription via local PubSub fan-out.
 *
 * @module @tmnl/msh/nats/hub
 */

import * as Context from 'effect-v4/Context';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Stream from 'effect-v4/Stream';
import * as PubSub from 'effect-v4/PubSub';

import * as Scope from 'effect-v4/Scope';
import * as Schema from 'effect-v4/Schema';
import { pipe } from 'effect-v4/Function';
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

interface SubjectHub<A> {
  readonly pubsub: PubSub.PubSub<A>;
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
// Pattern Matching
// =============================================================================

function subjectMatchesPattern(subject: string, pattern: string): boolean {
  const subjectTokens = subject.split('.');
  const patternTokens = pattern.split('.');

  for (let i = 0; i < patternTokens.length; i++) {
    const pt = patternTokens[i];
    if (pt === '>') return i < subjectTokens.length;
    if (i >= subjectTokens.length) return false;
    if (pt === '*') continue;
    if (pt !== subjectTokens[i]) return false;
  }

  return subjectTokens.length === patternTokens.length;
}

// =============================================================================
// Service Definition (v4 Context.Service)
// =============================================================================

export class NatsHubService extends Context.Service<
  NatsHubService,
  NatsHubServiceShape
>()('@tmnl/msh/nats/Hub') {
  static readonly layer = Layer.effect(
    NatsHubService,
    Effect.gen(function* () {
      const inner = yield* NatsInnerService;

      const defaultReplay = 3;

      type AnyHub = SubjectHub<TypedHubMessage<unknown>>;
      const activeHubsMap = new Map<string, AnyHub>();

      // ─── HUB FACTORY ──────────────────────────────────────────────────

      const createHub = <S extends Schema.Top>(
        pattern: string,
        schema: S,
        config: SubjectHubConfig & HubSubscribeOptions,
      ): Effect.Effect<
        SubjectHub<TypedHubMessage<S['Type']>>,
        HubErrors.HubCreationError,
        Scope.Scope | S['DecodingServices']
      > =>
        Effect.gen(function* () {
          const replay = config.replay ?? defaultReplay;

          const pubsub = yield* Effect.acquireRelease(
            PubSub.unbounded<TypedHubMessage<S['Type']>>({
              replay,
            }),
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

          const typedStream = pipe(
            natsStream,
            Stream.mapEffect((msg) =>
              pipe(
                NatsCodec.decodeJson(schema, { subject: msg.subject })(msg.data),
                Effect.map(
                  (data): TypedHubMessage<S['Type']> => ({
                    subject: msg.subject,
                    data,
                    reply: msg.reply,
                    raw: msg,
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
          );

          yield* Effect.forkScoped(
            Stream.runForEach(typedStream, (msg) => PubSub.publish(pubsub, msg)),
          );

          return { pubsub, pattern };
        });

      // ─── SUBSCRIBE ────────────────────────────────────────────────────

      const subscribe: NatsHubServiceShape['subscribe'] = (pattern, schema, opts = {}) =>
        Effect.gen(function* () {
          const schemaId = (schema as any).ast?._tag ?? 'unknown';
          const hubKey = `${pattern}::${schemaId}`;

          let hub = activeHubsMap.get(hubKey) as
            | SubjectHub<TypedHubMessage<any>>
            | undefined;

          if (!hub) {
            hub = yield* createHub(pattern, schema, opts);
            activeHubsMap.set(hubKey, hub as AnyHub);

            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                if (activeHubsMap.get(hubKey) === hub) {
                  activeHubsMap.delete(hubKey);
                }
              }),
            );
          }

          return Stream.fromPubSub(hub.pubsub) as any;
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

          const typedMsg: TypedHubMessage<any> = {
            subject,
            data,
            reply: undefined,
            raw: {
              subject,
              data: bytes,
              reply: undefined,
              sid: -1,
              respond: () => false,
              json: () => data,
              string: () => new TextDecoder().decode(bytes),
            } as Msg,
          };

          for (const [key, hub] of activeHubsMap) {
            const [pat] = key.split('::');
            if (subjectMatchesPattern(subject, pat)) {
              yield* PubSub.publish(
                hub.pubsub as PubSub.PubSub<any>,
                typedMsg,
              ).pipe(
                Effect.mapError(() =>
                  new HubErrors.HubPublishError({
                    message: `Failed to publish to hub '${pat}'`,
                    subject,
                  }),
                ),
              );
            }
          }

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
  ).pipe(Layer.provide(NatsInnerService.layer));
}

export const NatsHubServiceLive = NatsHubService.layer;
