/**
 * NATS Inner Service
 *
 * Wraps ALL raw NATS operations as Effects with granular error handling.
 * This is the foundation layer that all high-level services build upon.
 *
 * @module @tmnl/msh/nats/inner
 */

import * as Context from 'effect-v4/Context';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Stream from 'effect-v4/Stream';

import { headers as createNatsHeaders } from 'nats.ws';
import type {
  Subscription,
  Msg,
  PubAck,
  StreamInfo,
  StreamConfig,
  StreamUpdateConfig,
  ConsumerInfo,
  ConsumerConfig,
  Consumer,
  ConsumerMessages,
  KV,
  KvEntry,
  KvWatchOptions,
  ObjectStore,
  ObjectInfo,
  FetchOptions,
  ConsumeOptions,
  PurgeOpts,
  PurgeResponse,
  JsMsg,
  JetStreamManager,
} from 'nats.ws';

import { NatsConnectionService } from './connection';
import { Inner } from './errors';
import { MshSpan } from '../tracing';

const errorMessage = (err: unknown): string => {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { readonly message?: unknown }).message ?? err);
  }
  return String(err);
};

const isStreamNotFoundError = (err: unknown): boolean =>
  errorMessage(err).toLowerCase().includes('stream not found');

const wrapJsm = <A, E>(
  operation: () => A | PromiseLike<A>,
  toError: (cause: unknown) => E,
): Effect.Effect<A, E> =>
  Effect.tryPromise({
    try: async () => operation(),
    catch: toError,
  });

const wrapJsmNullable = <A, E>(
  operation: () => A | PromiseLike<A>,
  isAbsent: (cause: unknown) => boolean,
  toError: (cause: unknown) => E,
): Effect.Effect<A | null, E> =>
  Effect.tryPromise({
    try: async () => operation(),
    catch: (cause) => cause,
  }).pipe(
    Effect.catchIf(isAbsent, () => Effect.succeed(null)),
    Effect.mapError(toError),
  );

const wrapJsmOptional = <A>(
  operation: () => A | PromiseLike<A>,
): Effect.Effect<A | null> =>
  Effect.tryPromise({
    try: async () => operation(),
    catch: (cause) => cause,
  }).pipe(Effect.catch(() => Effect.succeed(null)));

type GetJsm = () => Effect.Effect<JetStreamManager, unknown>;

const wrapJsmWith = <A, E>(
  getJsm: GetJsm,
  operation: (jsm: JetStreamManager) => A | PromiseLike<A>,
  toError: (cause: unknown) => E,
): Effect.Effect<A, E> =>
  getJsm().pipe(
    Effect.mapError(toError),
    Effect.flatMap((jsm) => wrapJsm(() => operation(jsm), toError)),
  );

const wrapJsmNullableWith = <A, E>(
  getJsm: GetJsm,
  operation: (jsm: JetStreamManager) => A | PromiseLike<A>,
  isAbsent: (cause: unknown) => boolean,
  toError: (cause: unknown) => E,
): Effect.Effect<A | null, E> =>
  getJsm().pipe(
    Effect.mapError(toError),
    Effect.flatMap((jsm) => wrapJsmNullable(() => operation(jsm), isAbsent, toError)),
  );

const wrapJsmOptionalWith = <A>(
  getJsm: GetJsm,
  operation: (jsm: JetStreamManager) => A | PromiseLike<A>,
): Effect.Effect<A | null> =>
  getJsm().pipe(
    Effect.flatMap((jsm) => wrapJsmOptional(() => operation(jsm))),
    Effect.catch(() => Effect.succeed(null)),
  );

// =============================================================================
// Type Definitions
// =============================================================================

export interface CorePublishOptions {
  readonly reply?: string;
}

export interface CoreSubscribeOptions {
  readonly queue?: string;
  readonly max?: number;
}

export interface CoreRequestOptions {
  readonly timeout?: number;
  readonly noMux?: boolean;
}

export interface JsPublishOptions {
  readonly msgID?: string;
  readonly expect?: {
    readonly streamName?: string;
    readonly lastMsgID?: string;
    readonly lastSequence?: number;
    readonly lastSubjectSequence?: number;
  };
  readonly headers?: Record<string, string>;
}

export interface StreamConfigInput {
  readonly name: string;
  readonly subjects?: readonly string[];
  readonly storage?: 'file' | 'memory';
  readonly retention?: 'limits' | 'interest' | 'workqueue';
  readonly maxAge?: number;
  readonly maxBytes?: number;
  readonly maxMsgs?: number;
  readonly maxMsgSize?: number;
  readonly replicas?: number;
  readonly duplicateWindow?: number;
}

export interface ConsumerConfigInput {
  readonly durableName?: string;
  readonly deliverPolicy?:
    | 'all'
    | 'last'
    | 'new'
    | 'by_start_sequence'
    | 'by_start_time'
    | 'last_per_subject';
  readonly ackPolicy?: 'none' | 'all' | 'explicit';
  readonly replayPolicy?: 'instant' | 'original';
  readonly startSequence?: number;
  readonly startTime?: Date;
  readonly filterSubject?: string;
  readonly filterSubjects?: readonly string[];
  readonly ackWait?: number;
  readonly maxDeliver?: number;
  readonly maxAckPending?: number;
  readonly maxWaiting?: number;
  readonly maxBatch?: number;
  readonly maxBytes?: number;
  readonly idleHeartbeat?: number;
}

// =============================================================================
// Service Shape
// =============================================================================

export interface NatsInnerServiceShape {
  readonly core: {
    readonly publish: (
      subject: string,
      data: Uint8Array,
      opts?: CorePublishOptions,
    ) => Effect.Effect<void, Inner.Core.PublishError>;

    readonly subscribe: (
      subject: string,
      opts?: CoreSubscribeOptions,
    ) => Effect.Effect<Subscription, Inner.Core.SubscribeError>;

    readonly request: (
      subject: string,
      data: Uint8Array,
      opts?: CoreRequestOptions,
    ) => Effect.Effect<Msg, Inner.Core.TimeoutError | Inner.Core.RequestError>;

    readonly flush: () => Effect.Effect<void, Inner.Core.FlushError>;

    readonly drain: () => Effect.Effect<void, Inner.Core.FlushError>;
  };

  readonly jsPublish: (
    subject: string,
    data: Uint8Array,
    opts?: JsPublishOptions,
  ) => Effect.Effect<PubAck, Inner.Publish.PublishError>;

  readonly consumers: {
    readonly get: (
      stream: string,
      name?: string,
    ) => Effect.Effect<Consumer, Inner.Consumers.GetError>;
    readonly consume: (
      consumer: Consumer,
      opts?: Partial<ConsumeOptions>,
    ) => Effect.Effect<ConsumerMessages, Inner.Consumers.ConsumeError>;
    readonly fetch: (
      consumer: Consumer,
      opts?: Partial<FetchOptions>,
    ) => Effect.Effect<ConsumerMessages, Inner.Consumers.ConsumeError>;
    readonly next: (
      consumer: Consumer,
      opts?: { expires?: number },
    ) => Effect.Effect<JsMsg | null, Inner.Consumers.ConsumeError>;
    readonly add: (
      stream: string,
      config: ConsumerConfigInput,
    ) => Effect.Effect<ConsumerInfo, Inner.Consumers.AddError>;
    readonly info: (
      stream: string,
      name: string,
    ) => Effect.Effect<ConsumerInfo, Inner.Consumers.GetError>;
    readonly delete: (
      stream: string,
      name: string,
    ) => Effect.Effect<boolean, Inner.Consumers.DeleteError>;
    readonly list: (
      stream: string,
    ) => Effect.Effect<AsyncIterable<ConsumerInfo>, Inner.Consumers.GetError>;
  };

  readonly streams: {
    readonly info: (
      name: string,
    ) => Effect.Effect<StreamInfo | null, Inner.Streams.InfoError>;
    readonly add: (
      config: StreamConfigInput,
    ) => Effect.Effect<StreamInfo, Inner.Streams.AddError>;
    readonly update: (
      name: string,
      config: Partial<StreamConfigInput>,
    ) => Effect.Effect<StreamInfo, Inner.Streams.UpdateError>;
    readonly delete: (
      name: string,
    ) => Effect.Effect<boolean, Inner.Streams.DeleteError>;
    readonly list: (
      subject?: string,
    ) => Effect.Effect<AsyncIterable<StreamInfo>, Inner.Streams.InfoError>;
    readonly purge: (
      stream: string,
      opts?: Partial<PurgeOpts>,
    ) => Effect.Effect<PurgeResponse, Inner.Streams.DeleteError>;
    readonly find: (
      subject: string,
    ) => Effect.Effect<string | null, Inner.Streams.InfoError>;
  };

  readonly kv: {
    readonly bucket: (name: string) => Effect.Effect<KV, Inner.KV.BucketError>;
    readonly get: (
      bucketName: string,
      bucket: KV,
      key: string,
    ) => Effect.Effect<KvEntry | null, Inner.KV.GetError>;
    readonly put: (
      bucketName: string,
      bucket: KV,
      key: string,
      value: Uint8Array,
    ) => Effect.Effect<number, Inner.KV.PutError>;
    readonly create: (
      bucketName: string,
      bucket: KV,
      key: string,
      value: Uint8Array,
    ) => Effect.Effect<number, Inner.KV.PutError>;
    readonly delete: (
      bucketName: string,
      bucket: KV,
      key: string,
    ) => Effect.Effect<void, Inner.KV.DeleteError>;
    readonly purge: (
      bucketName: string,
      bucket: KV,
      key: string,
    ) => Effect.Effect<void, Inner.KV.DeleteError>;
    readonly watch: (
      bucket: KV,
      opts?: Partial<KvWatchOptions>,
    ) => Effect.Effect<AsyncIterable<KvEntry>, Inner.KV.WatchError>;
    readonly keys: (
      bucket: KV,
      filter?: string,
    ) => Effect.Effect<AsyncIterable<string>, Inner.KV.GetError>;
    readonly history: (
      bucket: KV,
      key: string,
    ) => Effect.Effect<AsyncIterable<KvEntry>, Inner.KV.GetError>;
  };

  readonly objectStore: {
    readonly bucket: (
      name: string,
    ) => Effect.Effect<ObjectStore, Inner.KV.BucketError>;
    readonly info: (
      store: ObjectStore,
      name: string,
    ) => Effect.Effect<ObjectInfo | null, Inner.KV.GetError>;
    readonly get: (
      store: ObjectStore,
      name: string,
    ) => Effect.Effect<Uint8Array | null, Inner.KV.GetError>;
    readonly put: (
      store: ObjectStore,
      name: string,
      data: Uint8Array,
      opts?: { description?: string },
    ) => Effect.Effect<ObjectInfo, Inner.KV.PutError>;
    readonly delete: (
      store: ObjectStore,
      name: string,
    ) => Effect.Effect<void, Inner.KV.DeleteError>;
    readonly list: (
      store: ObjectStore,
    ) => Effect.Effect<ReadonlyArray<ObjectInfo>, Inner.KV.GetError>;
    readonly watch: (
      store: ObjectStore,
    ) => Effect.Effect<AsyncIterable<ObjectInfo | null>, Inner.KV.WatchError>;
  };
}

// =============================================================================
// Service Definition (v4 Context.Service)
// =============================================================================

export class NatsInnerService extends Context.Service<
  NatsInnerService,
  NatsInnerServiceShape
>()('@tmnl/msh/nats/Inner') {
  /** Injectable layer for tests/custom runtimes. Requires NatsConnectionService. */
  static readonly layerFromConnection = Layer.effect(
    NatsInnerService,
    Effect.gen(function* () {
      const connection = yield* NatsConnectionService;
      const { nc, js, getJsm, config } = connection;

      if (config.debug) {
        console.log('[NatsInnerService] Initialized with shared connection');
      }

      // ─── CORE PUB/SUB ──────────────────────────────────────────────────

      const core: NatsInnerServiceShape['core'] = {
        publish: Effect.fn(MshSpan.Inner.Core.publish)(
          function*(subject: string, data: Uint8Array, opts?: CorePublishOptions) {
            yield* Effect.try({
              try: () => { nc.publish(subject, data, opts); },
              catch: (err) => new Inner.Core.PublishError({ message: `Failed to publish to '${subject}'`, subject, cause: err }),
            });
          },
        ),

        subscribe: Effect.fn(MshSpan.Inner.Core.subscribe)(
          function*(subject: string, opts?: CoreSubscribeOptions) {
            return yield* Effect.try({
              try: () => nc.subscribe(subject, opts),
              catch: (err) => new Inner.Core.SubscribeError({ message: `Failed to subscribe to '${subject}'`, subject, cause: err }),
            });
          },
        ),

        request: Effect.fn(MshSpan.Inner.Core.request)(
          function*(subject: string, data: Uint8Array, opts?: CoreRequestOptions) {
            return yield* Effect.tryPromise({
              try: () => nc.request(subject, data, { timeout: opts?.timeout ?? 5000, noMux: opts?.noMux }),
              catch: (err) => {
                const e = err as { code?: string; message?: string; name?: string };
                const msg = e?.message?.toLowerCase() ?? '';
                const name = e?.name?.toLowerCase() ?? '';
                const code = e?.code ?? '';
                if (code === 'TIMEOUT' || code === '503' || name.includes('timeout') || name.includes('noresponders') || msg.includes('timeout') || msg.includes('no responders')) {
                  return new Inner.Core.TimeoutError({ subject, timeoutMs: opts?.timeout ?? 5000 });
                }
                return new Inner.Core.RequestError({ message: `Request to '${subject}' failed`, subject, cause: err });
              },
            });
          },
        ),

        flush: Effect.fn(MshSpan.Inner.Core.flush)(function*() {
          yield* Effect.tryPromise({ try: () => nc.flush(), catch: (err) => new Inner.Core.FlushError({ message: 'Failed to flush', cause: err }) });
        }),

        drain: Effect.fn(MshSpan.Inner.Core.drain)(function*() {
          yield* Effect.tryPromise({ try: () => nc.drain(), catch: (err) => new Inner.Core.FlushError({ message: 'Failed to drain', cause: err }) });
        }),
      };

      // ─── JETSTREAM PUBLISH ──────────────────────────────────────────────

      const jsPublish: NatsInnerServiceShape['jsPublish'] = Effect.fn(MshSpan.Inner.JsPublish)(
        function*(subject: string, data: Uint8Array, opts?: JsPublishOptions) {
          const natsHeaders = opts?.headers
            ? yield* Effect.try({
                try: () => {
                  const hdrs = createNatsHeaders();
                  for (const [key, value] of Object.entries(opts.headers!)) {
                    hdrs.set(key, value);
                  }
                  return hdrs;
                },
                catch: (err) =>
                  new Inner.Publish.PublishError({
                    message: `Failed to create headers for '${subject}'`,
                    subject,
                    cause: err,
                  }),
              })
            : undefined;

          return yield* Effect.tryPromise({
            try: () =>
              js.publish(subject, data, {
                msgID: opts?.msgID,
                expect: opts?.expect,
                headers: natsHeaders,
              }),
            catch: (err) =>
              new Inner.Publish.PublishError({
                message: `Failed to publish to JetStream '${subject}'`,
                subject,
                cause: err,
              }),
          });
        },
      );

      // ─── CONSUMERS ──────────────────────────────────────────────────────

      const consumers: NatsInnerServiceShape['consumers'] = {
        get: (stream, name) =>
          Effect.tryPromise({
            try: () => js.consumers.get(stream, name),
            catch: (err) =>
              new Inner.Consumers.GetError({
                message: `Failed to get consumer${name ? ` '${name}'` : ''} from '${stream}'`,
                streamName: stream,
                consumerName: name,
                cause: err,
              }),
          }).pipe(Effect.withSpan(MshSpan.Inner.Consumers.get)),

        consume: (consumer, opts) =>
          Effect.tryPromise({
            try: () => consumer.consume(opts),
            catch: (err) =>
              new Inner.Consumers.ConsumeError({
                message: 'Failed to start consuming',
                streamName: (consumer as any).stream ?? 'unknown',
                cause: err,
              }),
          }).pipe(Effect.withSpan(MshSpan.Inner.Consumers.consume)),

        fetch: (consumer, opts) =>
          Effect.tryPromise({
            try: () => consumer.fetch(opts),
            catch: (err) =>
              new Inner.Consumers.ConsumeError({
                message: 'Failed to fetch',
                streamName: (consumer as any).stream ?? 'unknown',
                cause: err,
              }),
          }).pipe(Effect.withSpan(MshSpan.Inner.Consumers.fetch)),

        next: (consumer, opts) =>
          Effect.tryPromise({
            try: () => consumer.next(opts),
            catch: (err) =>
              new Inner.Consumers.ConsumeError({
                message: 'Failed to get next',
                streamName: (consumer as any).stream ?? 'unknown',
                cause: err,
              }),
          }).pipe(Effect.withSpan(MshSpan.Inner.Consumers.next)),

        add: (stream, cfg) =>
          wrapJsmWith(
            getJsm,
            (jsm) => jsm.consumers.add(stream, {
              durable_name: cfg.durableName,
              deliver_policy: cfg.deliverPolicy as any,
              ack_policy: cfg.ackPolicy as any,
              replay_policy: cfg.replayPolicy as any,
              opt_start_seq: cfg.startSequence,
              opt_start_time: cfg.startTime?.toISOString(),
              filter_subject: cfg.filterSubject,
              filter_subjects: cfg.filterSubjects ? [...cfg.filterSubjects] : undefined,
              ack_wait: cfg.ackWait,
              max_deliver: cfg.maxDeliver,
              max_ack_pending: cfg.maxAckPending,
              max_waiting: cfg.maxWaiting,
              max_batch: cfg.maxBatch,
              max_bytes: cfg.maxBytes,
              idle_heartbeat: cfg.idleHeartbeat,
            } as ConsumerConfig),
            (err) =>
              new Inner.Consumers.AddError({
                message: `Failed to add consumer to '${stream}'`,
                streamName: stream,
                cause: err,
              }),
          ).pipe(Effect.withSpan(MshSpan.Inner.Consumers.add)),

        info: (stream, name) =>
          wrapJsmWith(
            getJsm,
            (jsm) => jsm.consumers.info(stream, name),
            (err) =>
              new Inner.Consumers.GetError({
                message: `Failed to get consumer info '${name}' on '${stream}'`,
                streamName: stream,
                consumerName: name,
                cause: err,
              }),
          ).pipe(Effect.withSpan(MshSpan.Inner.Consumers.info)),

        delete: (stream, name) =>
          wrapJsmWith(
            getJsm,
            (jsm) => jsm.consumers.delete(stream, name),
            (err) =>
              new Inner.Consumers.DeleteError({
                message: `Failed to delete consumer '${name}' from '${stream}'`,
                streamName: stream,
                consumerName: name,
                cause: err,
              }),
          ).pipe(Effect.withSpan(MshSpan.Inner.Consumers.delete)),

        list: (stream) =>
          wrapJsmWith(
            getJsm,
            (jsm) => jsm.consumers.list(stream),
            (err) =>
              new Inner.Consumers.GetError({
                message: `Failed to list consumers for '${stream}'`,
                streamName: stream,
                cause: err,
              }),
          ).pipe(Effect.withSpan(MshSpan.Inner.Consumers.list)),
      };

      // ─── STREAMS ────────────────────────────────────────────────────────

      const streams: NatsInnerServiceShape['streams'] = {
        info: (name) =>
          wrapJsmNullableWith(
            getJsm,
            (jsm) => jsm.streams.info(name),
            isStreamNotFoundError,
            (err) =>
              new Inner.Streams.InfoError({ message: `Failed to get stream '${name}'`, streamName: name, cause: err }),
          ).pipe(Effect.withSpan(MshSpan.Inner.Streams.info)),

        add: (cfg) =>
          wrapJsmWith(
            getJsm,
            (jsm) => jsm.streams.add({
              name: cfg.name,
              subjects: cfg.subjects ? [...cfg.subjects] : undefined,
              storage: cfg.storage as any,
              retention: cfg.retention as any,
              max_age: cfg.maxAge,
              max_bytes: cfg.maxBytes,
              max_msgs: cfg.maxMsgs,
              max_msg_size: cfg.maxMsgSize,
              num_replicas: cfg.replicas,
              duplicate_window: cfg.duplicateWindow,
            } as Partial<StreamConfig> & { name: string }),
            (err) =>
              new Inner.Streams.AddError({ message: `Failed to create stream '${cfg.name}'`, streamName: cfg.name, cause: err }),
          ).pipe(Effect.withSpan(MshSpan.Inner.Streams.add)),

        update: (name, cfg) =>
          wrapJsmWith(
            getJsm,
            (jsm) => jsm.streams.update(name, {
              subjects: cfg.subjects ? [...cfg.subjects] : undefined,
              max_age: cfg.maxAge,
              max_bytes: cfg.maxBytes,
              max_msgs: cfg.maxMsgs,
              max_msg_size: cfg.maxMsgSize,
              num_replicas: cfg.replicas,
              duplicate_window: cfg.duplicateWindow,
            } as Partial<StreamUpdateConfig>),
            (err) =>
              new Inner.Streams.UpdateError({ message: `Failed to update stream '${name}'`, streamName: name, cause: err }),
          ).pipe(Effect.withSpan(MshSpan.Inner.Streams.update)),

        delete: (name) =>
          wrapJsmWith(
            getJsm,
            (jsm) => jsm.streams.delete(name),
            (err) =>
              new Inner.Streams.DeleteError({ message: `Failed to delete stream '${name}'`, streamName: name, cause: err }),
          ).pipe(Effect.withSpan(MshSpan.Inner.Streams.delete)),

        list: (subject) =>
          wrapJsmWith(
            getJsm,
            (jsm) => jsm.streams.list(subject),
            (err) =>
              new Inner.Streams.InfoError({ message: 'Failed to list streams', streamName: subject ?? '*', cause: err }),
          ).pipe(Effect.withSpan(MshSpan.Inner.Streams.list)),

        purge: (stream, opts) =>
          wrapJsmWith(
            getJsm,
            (jsm) => jsm.streams.purge(stream, opts as PurgeOpts | undefined),
            (err) =>
              new Inner.Streams.DeleteError({ message: `Failed to purge '${stream}'`, streamName: stream, cause: err }),
          ).pipe(Effect.withSpan(MshSpan.Inner.Streams.purge)),

        find: (subject) =>
          wrapJsmOptionalWith(getJsm, (jsm) => jsm.streams.find(subject)).pipe(
            Effect.withSpan(MshSpan.Inner.Streams.find),
          ),
      };

      // ─── KV ─────────────────────────────────────────────────────────────

      const kv: NatsInnerServiceShape['kv'] = {
        bucket: (name) =>
          Effect.tryPromise({
            try: () => js.views.kv(name),
            catch: (err) => new Inner.KV.BucketError({ message: `Failed to open KV '${name}'`, bucketName: name, cause: err }),
          }).pipe(Effect.withSpan(MshSpan.Inner.KV.bucket)),
        get: (bn, bucket, key) =>
          Effect.tryPromise({
            try: () => bucket.get(key),
            catch: (err) => new Inner.KV.GetError({ message: `Failed to get '${key}'`, bucketName: bn, key, cause: err }),
          }).pipe(Effect.withSpan(MshSpan.Inner.KV.get)),
        put: (bn, bucket, key, value) =>
          Effect.tryPromise({
            try: () => bucket.put(key, value),
            catch: (err) => new Inner.KV.PutError({ message: `Failed to put '${key}'`, bucketName: bn, key, cause: err }),
          }).pipe(Effect.withSpan(MshSpan.Inner.KV.put)),
        create: (bn, bucket, key, value) =>
          Effect.tryPromise({
            try: () => bucket.create(key, value),
            catch: (err) => new Inner.KV.PutError({ message: `Failed to create '${key}'`, bucketName: bn, key, cause: err }),
          }).pipe(Effect.withSpan(MshSpan.Inner.KV.create)),
        delete: (bn, bucket, key) =>
          Effect.tryPromise({
            try: async () => { await bucket.delete(key); },
            catch: (err) => new Inner.KV.DeleteError({ message: `Failed to delete '${key}'`, bucketName: bn, key, cause: err }),
          }).pipe(Effect.withSpan(MshSpan.Inner.KV.delete)),
        purge: (bn, bucket, key) =>
          Effect.tryPromise({
            try: async () => { await bucket.purge(key); },
            catch: (err) => new Inner.KV.DeleteError({ message: `Failed to purge '${key}'`, bucketName: bn, key, cause: err }),
          }).pipe(Effect.withSpan(MshSpan.Inner.KV.purge)),
        watch: (bucket, opts) =>
          Effect.tryPromise({
            try: () => bucket.watch(opts),
            catch: (err) => new Inner.KV.WatchError({ message: 'Failed to watch KV', bucketName: 'unknown', cause: err }),
          }).pipe(Effect.withSpan(MshSpan.Inner.KV.watch)),
        keys: (bucket, filter) =>
          Effect.tryPromise({
            try: () => bucket.keys(filter),
            catch: (err) => new Inner.KV.GetError({ message: 'Failed to list keys', bucketName: 'unknown', key: filter ?? '*', cause: err }),
          }).pipe(Effect.withSpan(MshSpan.Inner.KV.keys)),
        history: (bucket, key) =>
          Effect.tryPromise({
            try: () => bucket.history({ key }),
            catch: (err) => new Inner.KV.GetError({ message: `Failed to get history '${key}'`, bucketName: 'unknown', key, cause: err }),
          }).pipe(Effect.withSpan(MshSpan.Inner.KV.history)),
      };

      // ─── OBJECT STORE ───────────────────────────────────────────────────

      const objectStore: NatsInnerServiceShape['objectStore'] = {
        bucket: (name) =>
          Effect.tryPromise({
            try: () => js.views.os(name),
            catch: (err) => new Inner.KV.BucketError({ message: `Failed to open OS '${name}'`, bucketName: name, cause: err }),
          }).pipe(Effect.withSpan(MshSpan.Inner.ObjectStore.bucket)),
        info: (store, name) =>
          Effect.tryPromise({
            try: () => store.info(name),
            catch: (err) => err,
          }).pipe(
            Effect.catch(() => Effect.succeed(null)),
            Effect.withSpan(MshSpan.Inner.ObjectStore.info),
          ),
        get: (store, name) =>
          Effect.tryPromise({
            try: () => store.get(name),
            catch: (err) => new Inner.KV.GetError({ message: `Failed to get object '${name}'`, bucketName: 'unknown', key: name, cause: err }),
          }).pipe(
            Effect.flatMap((result) => {
              if (!result) return Effect.succeed(null);
              const byteStream = Stream.fromReadableStream({
                evaluate: () => result.data,
                onError: (err) => new Inner.KV.GetError({ message: `Failed to read '${name}'`, bucketName: 'unknown', key: name, cause: err }),
              });
              return Stream.runCollect(byteStream).pipe(
                Effect.map((chunks) => {
                  const arr = Array.from(chunks) as Uint8Array[];
                  const totalLength = arr.reduce((acc, c) => acc + c.length, 0);
                  const bytes = new Uint8Array(totalLength);
                  let offset = 0;
                  for (const c of arr) { bytes.set(c, offset); offset += c.length; }
                  return bytes;
                }),
              );
            }),
          ),
        put: (store, name, data, opts) =>
          Effect.tryPromise({
            try: () => store.putBlob({ name, description: opts?.description }, data),
            catch: (err) => new Inner.KV.PutError({ message: `Failed to put object '${name}'`, bucketName: 'unknown', key: name, cause: err }),
          }).pipe(Effect.withSpan(MshSpan.Inner.ObjectStore.put)),
        delete: (store, name) =>
          Effect.tryPromise({
            try: async () => { await store.delete(name); },
            catch: (err) => new Inner.KV.DeleteError({ message: `Failed to delete object '${name}'`, bucketName: 'unknown', key: name, cause: err }),
          }).pipe(Effect.withSpan(MshSpan.Inner.ObjectStore.delete)),
        list: (store) =>
          Effect.tryPromise({
            try: () => store.list(),
            catch: (err) => new Inner.KV.GetError({ message: 'Failed to list objects', bucketName: 'unknown', key: '*', cause: err }),
          }).pipe(Effect.withSpan(MshSpan.Inner.ObjectStore.list)),
        watch: (store) =>
          Effect.tryPromise({
            try: () => store.watch(),
            catch: (err) => new Inner.KV.WatchError({ message: 'Failed to watch OS', bucketName: 'unknown', cause: err }),
          }).pipe(Effect.withSpan(MshSpan.Inner.ObjectStore.watch)),
      };

      return NatsInnerService.of({
        core,
        jsPublish,
        consumers,
        streams,
        kv,
        objectStore,
      });
    }),
  );

  static readonly layer = NatsInnerService.layerFromConnection.pipe(
    Layer.provide(NatsConnectionService.layer),
  );
}

// =============================================================================
// Layer Exports
// =============================================================================

export const NatsInnerServiceLive = NatsInnerService.layer;
