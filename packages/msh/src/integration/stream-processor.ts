/**
 * MshStreamProcessor
 *
 * Durable, resumable streaming via NATS JetStream. Drop-in replacement
 * for DurableStreamClient pattern with automatic consumer-based offset tracking.
 *
 * @module @tmnl/msh/integration/stream-processor
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import * as Schema from 'effect/Schema';
import { pipe } from 'effect/Function';

import { NatsStreamService, type TypedJsMessage } from '../nats/stream';
import { NatsInnerService } from '../nats/inner';
import { MshSpan } from '../tracing';

// =============================================================================
// Configuration
// =============================================================================

export const StreamProcessorConfig = Schema.Struct({
  streamName: Schema.String,
  subject: Schema.String,
  subjects: Schema.Array(Schema.String),
  consumerName: Schema.String,
  retention: Schema.optionalKey(Schema.Literals(['limits', 'workqueue', 'interest'] as const)),
  maxAge: Schema.optionalKey(Schema.Number),
  maxMsgs: Schema.optionalKey(Schema.Number),
  maxBytes: Schema.optionalKey(Schema.Number),
  replicas: Schema.optionalKey(Schema.Number),
});
export type StreamProcessorConfig = typeof StreamProcessorConfig.Type;

// =============================================================================
// Types
// =============================================================================

export interface PublishResult {
  readonly seq: number;
  readonly stream: string;
  readonly duplicate: boolean;
}

export interface ReadResult<T> {
  readonly items: readonly T[];
  readonly lastSequence: number;
  readonly upToDate: boolean;
}

export interface StreamMessage<T> {
  readonly data: T;
  readonly sequence: number;
  readonly timestamp: Date;
  readonly ack: () => Effect.Effect<void>;
  readonly nak: (delay?: number) => Effect.Effect<void>;
  readonly working: () => Effect.Effect<void>;
  readonly term: (reason?: string) => Effect.Effect<void>;
}

export interface StreamInfoResult {
  readonly messages: number;
  readonly bytes: number;
  readonly firstSeq: number;
  readonly lastSeq: number;
  readonly created: Date;
}

// =============================================================================
// Errors
// =============================================================================

export class StreamProcessorError extends Schema.TaggedErrorClass<StreamProcessorError>(
  '@tmnl/msh/StreamProcessorError',
)('StreamProcessorError', {
  message: Schema.String,
  operation: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class StreamNotFoundError extends Schema.TaggedErrorClass<StreamNotFoundError>(
  '@tmnl/msh/StreamNotFoundError',
)('StreamNotFoundError', {
  streamName: Schema.String,
}) {}

// =============================================================================
// Service Shape
// =============================================================================

export interface MshStreamProcessorShape<T> {
  readonly publish: (data: T, opts?: { msgId?: string }) => Effect.Effect<PublishResult, StreamProcessorError>;
  readonly publishBatch: (items: readonly T[]) => Effect.Effect<readonly PublishResult[], StreamProcessorError>;
  readonly read: (opts?: { fromSequence?: number; limit?: number }) => Effect.Effect<ReadResult<T>, StreamProcessorError>;
  readonly subscribe: Effect.Effect<Stream.Stream<StreamMessage<T>, StreamProcessorError>, StreamProcessorError>;
  readonly subscribeFrom: (fromSequence: number) => Effect.Effect<Stream.Stream<StreamMessage<T>, StreamProcessorError>, StreamProcessorError>;
  readonly getCurrentSequence: Effect.Effect<number, StreamProcessorError>;
  readonly getInfo: Effect.Effect<StreamInfoResult, StreamProcessorError>;
  readonly delete: Effect.Effect<boolean, StreamProcessorError>;
}

// =============================================================================
// Factory
// =============================================================================

/** Schema with no service requirements (pure decode/encode) */
type PureSchema = Schema.Top & { readonly DecodingServices: never; readonly EncodingServices: never };

export const makeStreamProcessor = <S extends PureSchema>(
  config: StreamProcessorConfig,
  schema: S,
): Effect.Effect<
  MshStreamProcessorShape<S['Type']>,
  StreamProcessorError,
  NatsStreamService | NatsInnerService
> =>
  Effect.gen(function* () {
    const streamService = yield* NatsStreamService;
    const inner = yield* NatsInnerService;

    yield* streamService
      .ensureStream({
        name: config.streamName,
        subjects: [...config.subjects],
        retention: config.retention ?? 'limits',
        maxAge: config.maxAge ? config.maxAge * 1_000_000_000 : undefined,
        maxMsgs: config.maxMsgs,
        maxBytes: config.maxBytes,
        replicas: config.replicas ?? 1,
      })
      .pipe(Effect.mapError((e) =>
        new StreamProcessorError({ message: `Failed to ensure stream '${config.streamName}': ${e.message}`, operation: 'ensureStream', cause: e }),
      ));

    const mapMsg = (msg: TypedJsMessage<S['Type']>): StreamMessage<S['Type']> => ({
      data: msg.data, sequence: msg.seq, timestamp: msg.time,
      ack: msg.ack, nak: msg.nak, working: msg.working, term: msg.term,
    });

    const wrapErr = (op: string) => <E extends { message: string }>(e: E): StreamProcessorError =>
      new StreamProcessorError({ message: `${op} failed: ${e.message}`, operation: op, cause: e });

    const publish: MshStreamProcessorShape<S['Type']>['publish'] = (data, opts) =>
      streamService.publish(config.subject, schema, data, { msgId: opts?.msgId, expectStream: config.streamName }).pipe(
        Effect.map((ack): PublishResult => ({ seq: ack.seq, stream: ack.stream, duplicate: ack.duplicate })),
        Effect.mapError(wrapErr('publish')),
      );

    const publishBatch: MshStreamProcessorShape<S['Type']>['publishBatch'] = (items) =>
      Effect.forEach(items, (item) => publish(item), { concurrency: 'unbounded' });

    const read: MshStreamProcessorShape<S['Type']>['read'] = (opts) =>
      Effect.scoped(
        Effect.gen(function* () {
          const fromSeq = opts?.fromSequence ?? 1;
          const limit = opts?.limit ?? 100;
          const ephName = `ephemeral-read-${Date.now()}`;
          const stream = yield* streamService
            .subscribe(config.streamName, schema, {
              consumer: ephName, deliverPolicy: 'by_start_sequence',
              startSequence: fromSeq, ackPolicy: 'none',
            }).pipe(Effect.mapError(wrapErr('subscribe')));

          const messages = yield* pipe(
            stream, Stream.take(limit), Stream.runCollect,
            Effect.map((chunk) => Array.from(chunk) as TypedJsMessage<S['Type']>[]),
            Effect.timeout(5000),
            Effect.orElseSucceed(() => [] as TypedJsMessage<S['Type']>[]),
          );

          yield* inner.consumers.delete(config.streamName, ephName).pipe(
            Effect.orElseSucceed(() => false),
          );

          const info = yield* streamService.getStreamInfo(config.streamName).pipe(Effect.mapError(wrapErr('getStreamInfo')));
          const lastSeq = messages.length > 0 ? messages[messages.length - 1].seq : fromSeq;
          const streamLastSeq = (info as any)?.state?.last_seq ?? 0;

          return { items: messages.map((m) => m.data), lastSequence: lastSeq, upToDate: lastSeq >= streamLastSeq };
        }),
      );

    const subscribe: MshStreamProcessorShape<S['Type']>['subscribe'] =
      Effect.gen(function* () {
        const stream = yield* streamService
          .subscribe(config.streamName, schema, {
            consumer: config.consumerName, deliverPolicy: 'new', ackPolicy: 'explicit', maxDeliver: 5,
          }).pipe(Effect.mapError(wrapErr('subscribe')));
        return pipe(stream, Stream.map(mapMsg), Stream.mapError(wrapErr('streamMessage')));
      });

    const subscribeFrom: MshStreamProcessorShape<S['Type']>['subscribeFrom'] = (fromSequence) =>
      Effect.gen(function* () {
        yield* inner.consumers.delete(config.streamName, config.consumerName).pipe(
          Effect.orElseSucceed(() => false),
        );
        const stream = yield* streamService
          .subscribe(config.streamName, schema, {
            consumer: config.consumerName, deliverPolicy: 'by_start_sequence',
            startSequence: fromSequence, ackPolicy: 'explicit', maxDeliver: 5,
          }).pipe(Effect.mapError(wrapErr('subscribeFrom')));
        return pipe(stream, Stream.map(mapMsg), Stream.mapError(wrapErr('streamMessage')));
      });

    const getCurrentSequence: MshStreamProcessorShape<S['Type']>['getCurrentSequence'] =
      streamService.getStreamInfo(config.streamName).pipe(
        Effect.flatMap((info) => info
          ? Effect.succeed((info as any).state?.last_seq ?? 0)
          : Effect.fail(new StreamProcessorError({ message: `Stream '${config.streamName}' not found`, operation: 'getCurrentSequence' })),
        ),
        Effect.mapError(wrapErr('getCurrentSequence')),
      );

    const getInfo: MshStreamProcessorShape<S['Type']>['getInfo'] =
      streamService.getStreamInfo(config.streamName).pipe(
        Effect.flatMap((info) => info
          ? Effect.succeed({
              messages: (info as any).state?.messages ?? 0, bytes: (info as any).state?.bytes ?? 0,
              firstSeq: (info as any).state?.first_seq ?? 0, lastSeq: (info as any).state?.last_seq ?? 0,
              created: new Date((info as any).created),
            })
          : Effect.fail(new StreamProcessorError({ message: `Stream '${config.streamName}' not found`, operation: 'getInfo' })),
        ),
        Effect.mapError(wrapErr('getInfo')),
      );

    const deleteStream: MshStreamProcessorShape<S['Type']>['delete'] =
      streamService.deleteStream(config.streamName).pipe(Effect.mapError(wrapErr('delete')));

    return {
      publish: (d, o) => publish(d, o).pipe(Effect.withSpan(MshSpan.Processor.publish)),
      publishBatch,
      read: (o) => read(o).pipe(Effect.withSpan(MshSpan.Processor.read)),
      subscribe: subscribe.pipe(Effect.withSpan(MshSpan.Processor.subscribe)),
      subscribeFrom: (s) => subscribeFrom(s).pipe(Effect.withSpan(MshSpan.Processor.subscribeFrom)),
      getCurrentSequence: getCurrentSequence.pipe(Effect.withSpan(MshSpan.Processor.getInfo)),
      getInfo: getInfo.pipe(Effect.withSpan(MshSpan.Processor.getInfo)),
      delete: deleteStream.pipe(Effect.withSpan(MshSpan.Processor.delete)),
    };
  });

// =============================================================================
// Context Tag
// =============================================================================

export class MshStreamProcessor extends Context.Service<
  MshStreamProcessor, MshStreamProcessorShape<unknown>
>()('@tmnl/msh/integration/StreamProcessor') {}

export const makeStreamProcessorLayer = <S extends PureSchema>(
  config: StreamProcessorConfig,
  schema: S,
) =>
  Layer.effect(
    MshStreamProcessor,
    makeStreamProcessor(config, schema) as Effect.Effect<
      MshStreamProcessorShape<unknown>, StreamProcessorError, NatsStreamService | NatsInnerService
    >,
  ).pipe(
    Layer.provide(NatsStreamService.layer),
    Layer.provide(NatsInnerService.layer),
  );
