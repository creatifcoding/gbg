/**
 * NATS Stream Service
 *
 * High-level JetStream operations with Schema codecs.
 *
 * @module @tmnl/msh/nats/stream
 */

import * as Context from 'effect-v4/Context';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Stream from 'effect-v4/Stream';
import * as Schema from 'effect-v4/Schema';
import * as Result from 'effect-v4/Result';
import { pipe } from 'effect-v4/Function';
import type { StreamInfo, Consumer, ConsumerMessages, PubAck, JsMsg } from 'nats.ws';

import { NatsInnerService, type StreamConfigInput, type ConsumerConfigInput } from './inner';
import { Inner, Stream as StreamErrors, Codec } from './errors';
import { NatsCodec } from './codec';
import { MshSpan } from '../tracing';
import { fromAsyncIterable } from '../utils/stream';

// =============================================================================
// Types
// =============================================================================

export interface TypedJsMessage<A> {
  readonly subject: string;
  readonly data: A;
  readonly seq: number;
  readonly time: Date;
  readonly ack: () => Effect.Effect<void>;
  readonly nak: (delay?: number) => Effect.Effect<void>;
  readonly working: () => Effect.Effect<void>;
  readonly term: (reason?: string) => Effect.Effect<void>;
}

export interface PublishOptions {
  readonly msgId?: string;
  readonly expectStream?: string;
  readonly expectLastMsgId?: string;
  readonly expectLastSequence?: number;
}

export interface SubscribeOptions {
  readonly consumer?: string;
  readonly filterSubject?: string;
  readonly filterSubjects?: readonly string[];
  readonly deliverPolicy?: 'all' | 'last' | 'new' | 'by_start_sequence' | 'by_start_time' | 'last_per_subject';
  readonly startSequence?: number;
  readonly startTime?: Date;
  readonly ackPolicy?: 'none' | 'all' | 'explicit';
  readonly maxAckPending?: number;
  readonly ackWait?: number;
  readonly maxDeliver?: number;
}

export interface FetchOptions {
  readonly max?: number;
  readonly maxBytes?: number;
  readonly expires?: number;
  readonly idleHeartbeat?: number;
}

// =============================================================================
// Service Shape
// =============================================================================

export interface NatsStreamServiceShape {
  readonly ensureStream: (config: StreamConfigInput) => Effect.Effect<StreamInfo, StreamErrors.EnsureStreamError>;
  readonly getStreamInfo: (name: string) => Effect.Effect<StreamInfo | null, Inner.Streams.InfoError>;
  readonly deleteStream: (name: string) => Effect.Effect<boolean, Inner.Streams.DeleteError>;

  readonly publish: <S extends Schema.Top>(
    subject: string, schema: S, data: S['Type'], opts?: PublishOptions,
  ) => Effect.Effect<PubAck, StreamErrors.PublishError, S['EncodingServices']>;

  readonly subscribe: <S extends Schema.Top>(
    streamName: string, schema: S, opts?: SubscribeOptions,
  ) => Effect.Effect<
    Stream.Stream<TypedJsMessage<S['Type']>, StreamErrors.SubscribeError, S['DecodingServices']>,
    Inner.Consumers.GetError | Inner.Consumers.AddError | Inner.Consumers.ConsumeError,
    S['DecodingServices']
  >;

  readonly getConsumer: (
    streamName: string, consumerName?: string, config?: ConsumerConfigInput,
  ) => Effect.Effect<Consumer, Inner.Consumers.GetError | Inner.Consumers.AddError>;

  readonly fetch: <S extends Schema.Top>(
    consumer: Consumer, schema: S, opts?: FetchOptions,
  ) => Effect.Effect<ReadonlyArray<TypedJsMessage<S['Type']>>, Inner.Consumers.ConsumeError | Codec.DecodeError, S['DecodingServices']>;

  readonly next: <S extends Schema.Top>(
    consumer: Consumer, schema: S, opts?: { expires?: number },
  ) => Effect.Effect<TypedJsMessage<S['Type']> | null, Inner.Consumers.ConsumeError | Codec.DecodeError, S['DecodingServices']>;
}

// =============================================================================
// Service Definition
// =============================================================================

export class NatsStreamService extends Context.Service<
  NatsStreamService, NatsStreamServiceShape
>()('@tmnl/msh/nats/Stream') {
  /** Injectable layer for tests/custom runtimes. Requires NatsInnerService. */
  static readonly layerFromInner = Layer.effect(
    NatsStreamService,
    Effect.gen(function* () {
      const inner = yield* NatsInnerService;

      const decodeMessage = <S extends Schema.Top>(
        msg: JsMsg, schema: S,
      ): Effect.Effect<TypedJsMessage<S['Type']>, Codec.DecodeError, S['DecodingServices']> =>
        pipe(
          NatsCodec.decodeJson(schema, { subject: msg.subject, seq: msg.seq })(msg.data),
          Effect.map((data): TypedJsMessage<S['Type']> => ({
            subject: msg.subject, data, seq: msg.seq,
            time: msg.info.timestampNanos
              ? new Date(Number(msg.info.timestampNanos) / 1_000_000)
              : new Date(),
            ack: () => Effect.sync(() => msg.ack()),
            nak: (delay?: number) => Effect.sync(() => msg.nak(delay)),
            working: () => Effect.sync(() => msg.working()),
            term: (reason?: string) => Effect.sync(() => msg.term(reason)),
          })),
        );

      const collectMessages = (messages: ConsumerMessages, limit?: number): Effect.Effect<JsMsg[]> =>
        Effect.promise(async () => {
          const r: JsMsg[] = [];
          for await (const msg of messages) { r.push(msg); if (limit && r.length >= limit) break; }
          return r;
        });

      const sameArray = (left: readonly string[] | undefined, right: readonly string[] | undefined): boolean => {
        if (!left && !right) return true;
        if (!left || !right) return false;
        return left.length === right.length && left.every((value, index) => value === right[index]);
      };

      const streamConfigMismatches = (expected: StreamConfigInput, info: StreamInfo): ReadonlyArray<string> => {
        const actual = info.config as unknown as Record<string, unknown>;
        const mismatches: string[] = [];
        const check = (field: keyof StreamConfigInput, actualKey: string) => {
          const expectedValue = expected[field];
          if (expectedValue !== undefined && actual[actualKey] !== expectedValue) mismatches.push(String(field));
        };

        if (expected.subjects !== undefined && !sameArray(expected.subjects, actual.subjects as readonly string[] | undefined)) {
          mismatches.push('subjects');
        }
        check('storage', 'storage');
        check('retention', 'retention');
        check('maxAge', 'max_age');
        check('maxBytes', 'max_bytes');
        check('maxMsgs', 'max_msgs');
        check('maxMsgSize', 'max_msg_size');
        check('replicas', 'num_replicas');
        check('duplicateWindow', 'duplicate_window');
        return mismatches;
      };

      const ensureStream: NatsStreamServiceShape['ensureStream'] = (config) =>
        Effect.gen(function* () {
          const existing = yield* inner.streams.info(config.name);
          if (existing) {
            const mismatches = streamConfigMismatches(config, existing);
            if (mismatches.length > 0) {
              return yield* Effect.fail(new StreamErrors.ConfigMismatchError({
                message: `Existing stream '${config.name}' does not match requested config: ${mismatches.join(', ')}`,
                streamName: config.name,
                mismatches,
              }));
            }
            return existing;
          }
          return yield* inner.streams.add(config);
        });

      const getStreamInfo: NatsStreamServiceShape['getStreamInfo'] = (name) => inner.streams.info(name);
      const deleteStream: NatsStreamServiceShape['deleteStream'] = (name) => inner.streams.delete(name);

      const publish: NatsStreamServiceShape['publish'] = (subject, schema, data, opts) =>
        Effect.gen(function* () {
          const bytes = yield* NatsCodec.encodeJson(schema, data);
          return yield* inner.jsPublish(subject, bytes, {
            msgID: opts?.msgId,
            expect: { streamName: opts?.expectStream, lastMsgID: opts?.expectLastMsgId, lastSequence: opts?.expectLastSequence },
          });
        });

      const subscribe: NatsStreamServiceShape['subscribe'] = (streamName, schema, opts) =>
        Effect.gen(function* () {
          let consumer: Consumer;
          if (opts?.consumer) {
            const existing = yield* Effect.result(inner.consumers.get(streamName, opts.consumer));
            if (Result.isSuccess(existing)) { consumer = existing.success; }
            else {
              yield* inner.consumers.add(streamName, {
                durableName: opts.consumer, filterSubject: opts?.filterSubject,
                filterSubjects: opts?.filterSubjects, deliverPolicy: opts?.deliverPolicy,
                startSequence: opts?.startSequence, startTime: opts?.startTime,
                ackPolicy: opts?.ackPolicy ?? 'explicit', maxAckPending: opts?.maxAckPending,
                ackWait: opts?.ackWait, maxDeliver: opts?.maxDeliver,
              });
              consumer = yield* inner.consumers.get(streamName, opts.consumer);
            }
          } else {
            yield* inner.consumers.add(streamName, {
              filterSubject: opts?.filterSubject, filterSubjects: opts?.filterSubjects,
              deliverPolicy: opts?.deliverPolicy ?? 'new', startSequence: opts?.startSequence,
              startTime: opts?.startTime, ackPolicy: opts?.ackPolicy ?? 'explicit',
              maxAckPending: opts?.maxAckPending, ackWait: opts?.ackWait, maxDeliver: opts?.maxDeliver,
            });
            consumer = yield* inner.consumers.get(streamName);
          }

          const messages = yield* inner.consumers.consume(consumer);
          const rawStream = fromAsyncIterable<JsMsg, Inner.Consumers.ConsumeError>(
            messages,
            (err) => new Inner.Consumers.ConsumeError({ message: `Consumer error on '${streamName}'`, streamName, cause: err }),
            () => { messages.stop?.(); },
          );
          return pipe(rawStream, Stream.mapEffect((msg) => decodeMessage(msg, schema)));
        });

      const getConsumer: NatsStreamServiceShape['getConsumer'] = (streamName, consumerName, config) =>
        Effect.gen(function* () {
          if (consumerName) {
            const existing = yield* Effect.result(inner.consumers.get(streamName, consumerName));
            if (Result.isSuccess(existing)) return existing.success;
            yield* inner.consumers.add(streamName, { ...config, durableName: consumerName });
            return yield* inner.consumers.get(streamName, consumerName);
          } else {
            if (config) yield* inner.consumers.add(streamName, config);
            return yield* inner.consumers.get(streamName);
          }
        });

      const fetch: NatsStreamServiceShape['fetch'] = (consumer, schema, opts) =>
        Effect.gen(function* () {
          const messages = yield* inner.consumers.fetch(consumer, {
            max_messages: opts?.max ?? 100, max_bytes: opts?.maxBytes,
            expires: opts?.expires ?? 5000, idle_heartbeat: opts?.idleHeartbeat,
          });
          const rawMsgs = yield* collectMessages(messages, opts?.max);
          const results: TypedJsMessage<any>[] = [];
          for (const msg of rawMsgs) results.push(yield* decodeMessage(msg, schema));
          return results;
        });

      const next: NatsStreamServiceShape['next'] = (consumer, schema, opts) =>
        Effect.gen(function* () {
          const msg = yield* inner.consumers.next(consumer, { expires: opts?.expires });
          if (!msg) return null;
          return yield* decodeMessage(msg, schema);
        });

      return NatsStreamService.of({
        ensureStream: (c) => ensureStream(c).pipe(Effect.withSpan(MshSpan.Stream.ensureStream)),
        getStreamInfo: (n) => getStreamInfo(n).pipe(Effect.withSpan(MshSpan.Stream.getStreamInfo)),
        deleteStream: (n) => deleteStream(n).pipe(Effect.withSpan(MshSpan.Stream.deleteStream)),
        publish: (s, sc, d, o) => publish(s, sc, d, o).pipe(Effect.withSpan(MshSpan.Stream.publish)),
        subscribe: (sn, sc, o) => subscribe(sn, sc, o).pipe(Effect.withSpan(MshSpan.Stream.subscribe)),
        getConsumer: (sn, cn, c) => getConsumer(sn, cn, c).pipe(Effect.withSpan(MshSpan.Stream.getConsumer)),
        fetch: (c, sc, o) => fetch(c, sc, o).pipe(Effect.withSpan(MshSpan.Stream.fetch)),
        next: (c, sc, o) => next(c, sc, o).pipe(Effect.withSpan(MshSpan.Stream.next)),
      });
    }),
  );

  static readonly layer = NatsStreamService.layerFromInner.pipe(
    Layer.provide(NatsInnerService.layer),
  );
}

export const NatsStreamServiceLive = NatsStreamService.layer;
