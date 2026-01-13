/**
 * NATS Inner Service
 *
 * Wraps ALL raw NATS operations as Effects with granular error handling.
 * This is the foundation layer that all high-level services build upon.
 *
 * Covers:
 * - Core pub/sub (nc.*)
 * - JetStream publish (js.publish)
 * - JetStream consumers (js.consumers)
 * - JetStream KV views (js.views.kv)
 * - JetStream Object Store views (js.views.os)
 * - Stream management (jsm.streams)
 * - Consumer management (jsm.consumers)
 *
 * @module holonet/nats/inner
 */

import { Effect, Stream, Chunk } from 'effect';
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
} from 'nats.ws';

import { NatsConnectionService } from './connection';
import { Inner } from './errors';

// =============================================================================
// Type Definitions
// =============================================================================

/** Options for core publish */
export interface CorePublishOptions {
  readonly reply?: string;
}

/** Options for core subscribe */
export interface CoreSubscribeOptions {
  readonly queue?: string;
  readonly max?: number;
}

/** Options for core request */
export interface CoreRequestOptions {
  readonly timeout?: number;
  readonly noMux?: boolean;
}

/** Options for JetStream publish */
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

/** Options for stream creation/update */
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

/** Options for consumer creation */
export interface ConsumerConfigInput {
  readonly durableName?: string;
  readonly deliverPolicy?: 'all' | 'last' | 'new' | 'by_start_sequence' | 'by_start_time' | 'last_per_subject';
  readonly ackPolicy?: 'none' | 'all' | 'explicit';
  readonly replayPolicy?: 'instant' | 'original';
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
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE PUB/SUB (nc.*)
  // ═══════════════════════════════════════════════════════════════════════════

  readonly core: {
    /** Fire-and-forget publish */
    readonly publish: (
      subject: string,
      data: Uint8Array,
      opts?: CorePublishOptions
    ) => Effect.Effect<void, Inner.Core.PublishError>;

    /** Subscribe to a subject - returns raw Subscription */
    readonly subscribe: (
      subject: string,
      opts?: CoreSubscribeOptions
    ) => Effect.Effect<Subscription, Inner.Core.SubscribeError>;

    /** Request-reply pattern */
    readonly request: (
      subject: string,
      data: Uint8Array,
      opts?: CoreRequestOptions
    ) => Effect.Effect<Msg, Inner.Core.TimeoutError | Inner.Core.RequestError>;

    /** Flush pending publishes to server */
    readonly flush: () => Effect.Effect<void, Inner.Core.FlushError>;

    /** Drain connection (graceful shutdown) */
    readonly drain: () => Effect.Effect<void, Inner.Core.FlushError>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // JETSTREAM PUBLISH (js.publish)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Publish to JetStream with acknowledgment */
  readonly jsPublish: (
    subject: string,
    data: Uint8Array,
    opts?: JsPublishOptions
  ) => Effect.Effect<PubAck, Inner.Publish.PublishError>;

  // ═══════════════════════════════════════════════════════════════════════════
  // JETSTREAM CONSUMERS (js.consumers)
  // ═══════════════════════════════════════════════════════════════════════════

  readonly consumers: {
    /** Get a consumer by stream and optional name */
    readonly get: (
      stream: string,
      name?: string
    ) => Effect.Effect<Consumer, Inner.Consumers.GetError>;

    /** Start consuming messages from a consumer */
    readonly consume: (
      consumer: Consumer,
      opts?: Partial<ConsumeOptions>
    ) => Effect.Effect<ConsumerMessages, Inner.Consumers.ConsumeError>;

    /** Fetch a batch of messages */
    readonly fetch: (
      consumer: Consumer,
      opts?: Partial<FetchOptions>
    ) => Effect.Effect<ConsumerMessages, Inner.Consumers.ConsumeError>;

    /** Get the next single message */
    readonly next: (
      consumer: Consumer,
      opts?: { expires?: number }
    ) => Effect.Effect<JsMsg | null, Inner.Consumers.ConsumeError>;

    // ─── Consumer Management (jsm.consumers) ─────────────────────────────────

    /** Add/create a consumer */
    readonly add: (
      stream: string,
      config: ConsumerConfigInput
    ) => Effect.Effect<ConsumerInfo, Inner.Consumers.AddError>;

    /** Get consumer info */
    readonly info: (
      stream: string,
      name: string
    ) => Effect.Effect<ConsumerInfo, Inner.Consumers.GetError>;

    /** Delete a consumer */
    readonly delete: (
      stream: string,
      name: string
    ) => Effect.Effect<boolean, Inner.Consumers.DeleteError>;

    /** List consumers for a stream */
    readonly list: (
      stream: string
    ) => Effect.Effect<AsyncIterable<ConsumerInfo>, Inner.Consumers.GetError>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // JETSTREAM STREAMS (jsm.streams)
  // ═══════════════════════════════════════════════════════════════════════════

  readonly streams: {
    /** Get stream info */
    readonly info: (
      name: string
    ) => Effect.Effect<StreamInfo | null, Inner.Streams.InfoError>;

    /** Create a new stream */
    readonly add: (
      config: StreamConfigInput
    ) => Effect.Effect<StreamInfo, Inner.Streams.AddError>;

    /** Update an existing stream */
    readonly update: (
      name: string,
      config: Partial<StreamConfigInput>
    ) => Effect.Effect<StreamInfo, Inner.Streams.UpdateError>;

    /** Delete a stream */
    readonly delete: (
      name: string
    ) => Effect.Effect<boolean, Inner.Streams.DeleteError>;

    /** List all streams */
    readonly list: (
      subject?: string
    ) => Effect.Effect<AsyncIterable<StreamInfo>, Inner.Streams.InfoError>;

    /** Purge messages from a stream */
    readonly purge: (
      stream: string,
      opts?: Partial<PurgeOpts>
    ) => Effect.Effect<PurgeResponse, Inner.Streams.DeleteError>;

    /** Find stream by subject */
    readonly find: (
      subject: string
    ) => Effect.Effect<string | null, Inner.Streams.InfoError>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // JETSTREAM KV (js.views.kv)
  // ═══════════════════════════════════════════════════════════════════════════

  readonly kv: {
    /** Open or create a KV bucket */
    readonly bucket: (
      name: string
    ) => Effect.Effect<KV, Inner.KV.BucketError>;

    /** Get a value from KV */
    readonly get: (
      bucketName: string,
      bucket: KV,
      key: string
    ) => Effect.Effect<KvEntry | null, Inner.KV.GetError>;

    /** Put a value to KV */
    readonly put: (
      bucketName: string,
      bucket: KV,
      key: string,
      value: Uint8Array
    ) => Effect.Effect<number, Inner.KV.PutError>;

    /** Create a new key (fails if exists) */
    readonly create: (
      bucketName: string,
      bucket: KV,
      key: string,
      value: Uint8Array
    ) => Effect.Effect<number, Inner.KV.PutError>;

    /** Delete a key */
    readonly delete: (
      bucketName: string,
      bucket: KV,
      key: string
    ) => Effect.Effect<void, Inner.KV.DeleteError>;

    /** Purge a key and its history */
    readonly purge: (
      bucketName: string,
      bucket: KV,
      key: string
    ) => Effect.Effect<void, Inner.KV.DeleteError>;

    /** Watch for changes */
    readonly watch: (
      bucket: KV,
      opts?: Partial<KvWatchOptions>
    ) => Effect.Effect<AsyncIterable<KvEntry>, Inner.KV.WatchError>;

    /** List all keys */
    readonly keys: (
      bucket: KV,
      filter?: string
    ) => Effect.Effect<AsyncIterable<string>, Inner.KV.GetError>;

    /** Get key history */
    readonly history: (
      bucket: KV,
      key: string
    ) => Effect.Effect<AsyncIterable<KvEntry>, Inner.KV.GetError>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // JETSTREAM OBJECT STORE (js.views.os)
  // ═══════════════════════════════════════════════════════════════════════════

  readonly objectStore: {
    /** Open or create an Object Store bucket */
    readonly bucket: (
      name: string
    ) => Effect.Effect<ObjectStore, Inner.KV.BucketError>;

    /** Get object info */
    readonly info: (
      store: ObjectStore,
      name: string
    ) => Effect.Effect<ObjectInfo | null, Inner.KV.GetError>;

    /** Get object data as Uint8Array */
    readonly get: (
      store: ObjectStore,
      name: string
    ) => Effect.Effect<Uint8Array | null, Inner.KV.GetError>;

    /** Put object data */
    readonly put: (
      store: ObjectStore,
      name: string,
      data: Uint8Array,
      opts?: { description?: string }
    ) => Effect.Effect<ObjectInfo, Inner.KV.PutError>;

    /** Delete an object */
    readonly delete: (
      store: ObjectStore,
      name: string
    ) => Effect.Effect<void, Inner.KV.DeleteError>;

    /** List all objects */
    readonly list: (
      store: ObjectStore
    ) => Effect.Effect<ReadonlyArray<ObjectInfo>, Inner.KV.GetError>;

    /** Watch for changes */
    readonly watch: (
      store: ObjectStore
    ) => Effect.Effect<AsyncIterable<ObjectInfo | null>, Inner.KV.WatchError>;
  };
}

// =============================================================================
// Service Implementation
// =============================================================================

export class NatsInnerService extends Effect.Service<NatsInnerService>()(
  'holonet/nats/Inner',
  {
    effect: Effect.gen(function* () {
      const { nc, js, jsm, config } = yield* NatsConnectionService;

      if (config.debug) {
        console.log('[NatsInnerService] Initialized with shared connection');
      }

      // ─────────────────────────────────────────────────────────────────────────
      // CORE PUB/SUB (nc.*)
      // ─────────────────────────────────────────────────────────────────────────

      const core = {
        publish: (subject: string, data: Uint8Array, opts?: CorePublishOptions) =>
          Effect.try({
            try: () => {
              nc.publish(subject, data, opts);
            },
            catch: (err) =>
              new Inner.Core.PublishError({
                message: `Failed to publish to '${subject}'`,
                subject,
                cause: err,
              }),
          }),

        subscribe: (subject: string, opts?: CoreSubscribeOptions) =>
          Effect.try({
            try: () => nc.subscribe(subject, opts),
            catch: (err) =>
              new Inner.Core.SubscribeError({
                message: `Failed to subscribe to '${subject}'`,
                subject,
                cause: err,
              }),
          }),

        request: (subject: string, data: Uint8Array, opts?: CoreRequestOptions) =>
          Effect.tryPromise({
            try: () => nc.request(subject, data, {
              timeout: opts?.timeout ?? 5000,
              noMux: opts?.noMux,
            }),
            catch: (err) => {
              const errAny = err as { code?: string; message?: string };
              if (
                errAny?.code === 'TIMEOUT' ||
                errAny?.message?.toLowerCase().includes('timeout')
              ) {
                return new Inner.Core.TimeoutError({
                  subject,
                  timeoutMs: opts?.timeout ?? 5000,
                });
              }
              return new Inner.Core.RequestError({
                message: `Request to '${subject}' failed`,
                subject,
                cause: err,
              });
            },
          }),

        flush: () =>
          Effect.tryPromise({
            try: () => nc.flush(),
            catch: (err) =>
              new Inner.Core.FlushError({
                message: 'Failed to flush pending messages',
                cause: err,
              }),
          }),

        drain: () =>
          Effect.tryPromise({
            try: () => nc.drain(),
            catch: (err) =>
              new Inner.Core.FlushError({
                message: 'Failed to drain connection',
                cause: err,
              }),
          }),
      };

      // ─────────────────────────────────────────────────────────────────────────
      // JETSTREAM PUBLISH (js.publish)
      // ─────────────────────────────────────────────────────────────────────────

      const jsPublish = (subject: string, data: Uint8Array, opts?: JsPublishOptions) =>
        Effect.tryPromise({
          try: () =>
            js.publish(subject, data, {
              msgID: opts?.msgID,
              expect: opts?.expect,
              headers: opts?.headers as any,
            }),
          catch: (err) =>
            new Inner.Publish.PublishError({
              message: `Failed to publish to JetStream subject '${subject}'`,
              subject,
              cause: err,
            }),
        });

      // ─────────────────────────────────────────────────────────────────────────
      // JETSTREAM CONSUMERS (js.consumers + jsm.consumers)
      // ─────────────────────────────────────────────────────────────────────────

      const consumers = {
        get: (stream: string, name?: string) =>
          Effect.tryPromise({
            try: () => js.consumers.get(stream, name),
            catch: (err) =>
              new Inner.Consumers.GetError({
                message: `Failed to get consumer${name ? ` '${name}'` : ''} from stream '${stream}'`,
                streamName: stream,
                consumerName: name,
                cause: err,
              }),
          }),

        consume: (consumer: Consumer, opts?: Partial<ConsumeOptions>) =>
          Effect.tryPromise({
            try: () => consumer.consume(opts),
            catch: (err) =>
              new Inner.Consumers.ConsumeError({
                message: 'Failed to start consuming messages',
                streamName: (consumer as any).stream ?? 'unknown',
                cause: err,
              }),
          }),

        fetch: (consumer: Consumer, opts?: Partial<FetchOptions>) =>
          Effect.tryPromise({
            try: () => consumer.fetch(opts),
            catch: (err) =>
              new Inner.Consumers.ConsumeError({
                message: 'Failed to fetch messages',
                streamName: (consumer as any).stream ?? 'unknown',
                cause: err,
              }),
          }),

        next: (consumer: Consumer, opts?: { expires?: number }) =>
          Effect.tryPromise({
            try: () => consumer.next(opts),
            catch: (err) =>
              new Inner.Consumers.ConsumeError({
                message: 'Failed to get next message',
                streamName: (consumer as any).stream ?? 'unknown',
                cause: err,
              }),
          }),

        add: (stream: string, cfg: ConsumerConfigInput) =>
          Effect.tryPromise({
            try: () =>
              jsm.consumers.add(stream, {
                durable_name: cfg.durableName,
                deliver_policy: cfg.deliverPolicy as any,
                ack_policy: cfg.ackPolicy as any,
                replay_policy: cfg.replayPolicy as any,
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
            catch: (err) =>
              new Inner.Consumers.AddError({
                message: `Failed to add consumer${cfg.durableName ? ` '${cfg.durableName}'` : ''} to stream '${stream}'`,
                streamName: stream,
                cause: err,
              }),
          }),

        info: (stream: string, name: string) =>
          Effect.tryPromise({
            try: () => jsm.consumers.info(stream, name),
            catch: (err) =>
              new Inner.Consumers.GetError({
                message: `Failed to get info for consumer '${name}' on stream '${stream}'`,
                streamName: stream,
                consumerName: name,
                cause: err,
              }),
          }),

        delete: (stream: string, name: string) =>
          Effect.tryPromise({
            try: () => jsm.consumers.delete(stream, name),
            catch: (err) =>
              new Inner.Consumers.DeleteError({
                message: `Failed to delete consumer '${name}' from stream '${stream}'`,
                streamName: stream,
                consumerName: name,
                cause: err,
              }),
          }),

        list: (stream: string) =>
          Effect.tryPromise({
            try: async () => jsm.consumers.list(stream),
            catch: (err) =>
              new Inner.Consumers.GetError({
                message: `Failed to list consumers for stream '${stream}'`,
                streamName: stream,
                cause: err,
              }),
          }),
      };

      // ─────────────────────────────────────────────────────────────────────────
      // JETSTREAM STREAMS (jsm.streams)
      // ─────────────────────────────────────────────────────────────────────────

      const streams = {
        info: (name: string) =>
          Effect.tryPromise({
            try: async () => {
              try {
                return await jsm.streams.info(name);
              } catch (err: any) {
                // Stream not found is not an error, return null
                if (err?.message?.includes('stream not found')) {
                  return null;
                }
                throw err;
              }
            },
            catch: (err) =>
              new Inner.Streams.InfoError({
                message: `Failed to get info for stream '${name}'`,
                streamName: name,
                cause: err,
              }),
          }),

        add: (cfg: StreamConfigInput) =>
          Effect.tryPromise({
            try: () =>
              jsm.streams.add({
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
            catch: (err) =>
              new Inner.Streams.AddError({
                message: `Failed to create stream '${cfg.name}'`,
                streamName: cfg.name,
                cause: err,
              }),
          }),

        update: (name: string, cfg: Partial<StreamConfigInput>) =>
          Effect.tryPromise({
            try: () =>
              jsm.streams.update(name, {
                subjects: cfg.subjects ? [...cfg.subjects] : undefined,
                max_age: cfg.maxAge,
                max_bytes: cfg.maxBytes,
                max_msgs: cfg.maxMsgs,
                max_msg_size: cfg.maxMsgSize,
                num_replicas: cfg.replicas,
                duplicate_window: cfg.duplicateWindow,
              } as Partial<StreamUpdateConfig>),
            catch: (err) =>
              new Inner.Streams.UpdateError({
                message: `Failed to update stream '${name}'`,
                streamName: name,
                cause: err,
              }),
          }),

        delete: (name: string) =>
          Effect.tryPromise({
            try: () => jsm.streams.delete(name),
            catch: (err) =>
              new Inner.Streams.DeleteError({
                message: `Failed to delete stream '${name}'`,
                streamName: name,
                cause: err,
              }),
          }),

        list: (subject?: string) =>
          Effect.tryPromise({
            try: async () => jsm.streams.list(subject),
            catch: (err) =>
              new Inner.Streams.InfoError({
                message: 'Failed to list streams',
                streamName: subject ?? '*',
                cause: err,
              }),
          }),

        purge: (stream: string, opts?: Partial<PurgeOpts>) =>
          Effect.tryPromise({
            try: () => jsm.streams.purge(stream, opts as PurgeOpts | undefined),
            catch: (err) =>
              new Inner.Streams.DeleteError({
                message: `Failed to purge stream '${stream}'`,
                streamName: stream,
                cause: err,
              }),
          }),

        find: (subject: string) =>
          Effect.tryPromise({
            try: async () => {
              try {
                return await jsm.streams.find(subject);
              } catch {
                return null;
              }
            },
            catch: (err) =>
              new Inner.Streams.InfoError({
                message: `Failed to find stream for subject '${subject}'`,
                streamName: subject,
                cause: err,
              }),
          }),
      };

      // ─────────────────────────────────────────────────────────────────────────
      // JETSTREAM KV (js.views.kv)
      // ─────────────────────────────────────────────────────────────────────────

      const kv = {
        bucket: (name: string) =>
          Effect.tryPromise({
            try: () => js.views.kv(name),
            catch: (err) =>
              new Inner.KV.BucketError({
                message: `Failed to open KV bucket '${name}'`,
                bucketName: name,
                cause: err,
              }),
          }),

        get: (bucketName: string, bucket: KV, key: string) =>
          Effect.tryPromise({
            try: () => bucket.get(key),
            catch: (err) =>
              new Inner.KV.GetError({
                message: `Failed to get key '${key}'`,
                bucketName,
                key,
                cause: err,
              }),
          }),

        put: (bucketName: string, bucket: KV, key: string, value: Uint8Array) =>
          Effect.tryPromise({
            try: () => bucket.put(key, value),
            catch: (err) =>
              new Inner.KV.PutError({
                message: `Failed to put key '${key}'`,
                bucketName,
                key,
                cause: err,
              }),
          }),

        create: (bucketName: string, bucket: KV, key: string, value: Uint8Array) =>
          Effect.tryPromise({
            try: () => bucket.create(key, value),
            catch: (err) =>
              new Inner.KV.PutError({
                message: `Failed to create key '${key}' (may already exist)`,
                bucketName,
                key,
                cause: err,
              }),
          }),

        delete: (bucketName: string, bucket: KV, key: string) =>
          Effect.tryPromise({
            try: async () => {
              await bucket.delete(key);
            },
            catch: (err) =>
              new Inner.KV.DeleteError({
                message: `Failed to delete key '${key}'`,
                bucketName,
                key,
                cause: err,
              }),
          }),

        purge: (bucketName: string, bucket: KV, key: string) =>
          Effect.tryPromise({
            try: async () => {
              await bucket.purge(key);
            },
            catch: (err) =>
              new Inner.KV.DeleteError({
                message: `Failed to purge key '${key}'`,
                bucketName,
                key,
                cause: err,
              }),
          }),

        watch: (bucket: KV, opts?: Partial<KvWatchOptions>) =>
          Effect.tryPromise({
            try: () => bucket.watch(opts),
            catch: (err) =>
              new Inner.KV.WatchError({
                message: 'Failed to watch KV bucket',
                bucketName: 'unknown', // Caller should track bucket name
                cause: err,
              }),
          }),

        keys: (bucket: KV, filter?: string) =>
          Effect.tryPromise({
            try: () => bucket.keys(filter),
            catch: (err) =>
              new Inner.KV.GetError({
                message: 'Failed to list keys',
                bucketName: 'unknown', // Caller should track bucket name
                key: filter ?? '*',
                cause: err,
              }),
          }),

        history: (bucket: KV, key: string) =>
          Effect.tryPromise({
            try: () => bucket.history({ key }),
            catch: (err) =>
              new Inner.KV.GetError({
                message: `Failed to get history for key '${key}'`,
                bucketName: 'unknown', // Caller should track bucket name
                key,
                cause: err,
              }),
          }),
      };

      // ─────────────────────────────────────────────────────────────────────────
      // JETSTREAM OBJECT STORE (js.views.os)
      // ─────────────────────────────────────────────────────────────────────────

      const objectStore = {
        bucket: (name: string) =>
          Effect.tryPromise({
            try: () => js.views.os(name),
            catch: (err) =>
              new Inner.KV.BucketError({
                message: `Failed to open Object Store bucket '${name}'`,
                bucketName: name,
                cause: err,
              }),
          }),

        info: (store: ObjectStore, name: string): Effect.Effect<ObjectInfo | null, Inner.KV.GetError> =>
          Effect.tryPromise({
            try: async () => {
              try {
                return await store.info(name);
              } catch {
                return null;
              }
            },
            catch: (err) =>
              new Inner.KV.GetError({
                message: `Failed to get info for object '${name}'`,
                bucketName: 'unknown', // Caller should track store name
                key: name,
                cause: err,
              }),
          }),

        get: (store: ObjectStore, name: string): Effect.Effect<Uint8Array | null, Inner.KV.GetError> =>
          Effect.tryPromise({
            try: () => store.get(name),
            catch: (err) =>
              new Inner.KV.GetError({
                message: `Failed to get object '${name}'`,
                bucketName: 'unknown', // Caller should track store name
                key: name,
                cause: err,
              }),
          }).pipe(
            Effect.flatMap((result) => {
              if (!result) return Effect.succeed(null);

              // Use Effect Stream to read ReadableStream properly
              const byteStream = Stream.fromReadableStream({
                evaluate: () => result.data,
                onError: (err) =>
                  new Inner.KV.GetError({
                    message: `Failed to read object data stream for '${name}'`,
                    bucketName: 'unknown',
                    key: name,
                    cause: err,
                  }),
              });

              // Collect all chunks and concatenate into single Uint8Array
              return Stream.runCollect(byteStream).pipe(
                Effect.map((chunks) => {
                  const totalLength = Chunk.reduce(chunks, 0, (acc, chunk) => acc + chunk.length);
                  const resultBytes = new Uint8Array(totalLength);
                  let offset = 0;
                  Chunk.forEach(chunks, (chunk) => {
                    resultBytes.set(chunk, offset);
                    offset += chunk.length;
                  });
                  return resultBytes;
                })
              );
            })
          ),

        put: (store: ObjectStore, name: string, data: Uint8Array, opts?: { description?: string }) =>
          Effect.tryPromise({
            try: () =>
              // Use putBlob which accepts Uint8Array directly
              store.putBlob({ name, description: opts?.description }, data),
            catch: (err) =>
              new Inner.KV.PutError({
                message: `Failed to put object '${name}'`,
                bucketName: 'unknown', // Caller should track store name
                key: name,
                cause: err,
              }),
          }),

        delete: (store: ObjectStore, name: string) =>
          Effect.tryPromise({
            try: async () => {
              await store.delete(name);
            },
            catch: (err) =>
              new Inner.KV.DeleteError({
                message: `Failed to delete object '${name}'`,
                bucketName: 'unknown', // Caller should track store name
                key: name,
                cause: err,
              }),
          }),

        list: (store: ObjectStore) =>
          Effect.tryPromise({
            try: () => store.list(),
            catch: (err) =>
              new Inner.KV.GetError({
                message: 'Failed to list objects',
                bucketName: 'unknown', // Caller should track store name
                key: '*',
                cause: err,
              }),
          }),

        watch: (store: ObjectStore) =>
          Effect.tryPromise({
            try: () => store.watch(),
            catch: (err) =>
              new Inner.KV.WatchError({
                message: 'Failed to watch Object Store',
                bucketName: 'unknown', // Caller should track store name
                cause: err,
              }),
          }),
      };

      return {
        core,
        jsPublish,
        consumers,
        streams,
        kv,
        objectStore,
      } satisfies NatsInnerServiceShape;
    }),
    dependencies: [NatsConnectionService.Default],
  }
) {}

// =============================================================================
// Layer Exports
// =============================================================================

export const NatsInnerServiceLive = NatsInnerService.Default;
