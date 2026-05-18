/**
 * NATS KV Service
 *
 * High-level KV with Schema codecs on top of NatsInnerService.
 *
 * @module @tmnl/msh/nats/kv
 */

import * as Context from 'effect-v4/Context';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Stream from 'effect-v4/Stream';
import * as Schema from 'effect-v4/Schema';
import { pipe } from 'effect-v4/Function';
import type { KV as KVBucket, KvEntry, KvWatchOptions } from 'nats.ws';

import { NatsInnerService } from './inner';
import { Inner, KV as KVErrors, Codec } from './errors';
import { NatsCodec } from './codec';
import { MshSpan } from '../tracing';
import { fromAsyncIterable } from '../utils/stream';

// =============================================================================
// Type Definitions
// =============================================================================

export interface TypedKVEntry<A> {
  readonly key: string;
  readonly value: A;
  readonly revision: number;
  readonly created: Date;
  readonly operation: 'PUT' | 'DEL' | 'PURGE';
}

export interface WatchOptions {
  readonly key?: string;
  readonly include?: 'lastValue' | 'allUpdates' | 'updates';
  readonly startRevision?: number;
}

// =============================================================================
// Service Shape
// =============================================================================

export interface NatsKVServiceShape {
  readonly get: <S extends Schema.Top>(
    bucketName: string, key: string, schema: S,
  ) => Effect.Effect<S['Type'], KVErrors.GetError, S['DecodingServices']>;

  readonly getOrNull: <S extends Schema.Top>(
    bucketName: string, key: string, schema: S,
  ) => Effect.Effect<S['Type'] | null, Inner.KV.BucketError | Inner.KV.GetError | Codec.DecodeError, S['DecodingServices']>;

  readonly put: <S extends Schema.Top>(
    bucketName: string, key: string, schema: S, value: S['Type'],
  ) => Effect.Effect<number, KVErrors.PutError, S['EncodingServices']>;

  readonly delete: (bucketName: string, key: string) => Effect.Effect<void, KVErrors.DeleteError>;
  readonly purge: (bucketName: string, key: string) => Effect.Effect<void, KVErrors.DeleteError>;

  readonly watch: <S extends Schema.Top>(
    bucketName: string, schema: S, opts?: WatchOptions,
  ) => Effect.Effect<
    Stream.Stream<TypedKVEntry<S['Type']>, KVErrors.WatchError, S['DecodingServices']>,
    Inner.KV.BucketError | Inner.KV.WatchError,
    S['DecodingServices']
  >;

  readonly keys: (bucketName: string, filter?: string) =>
    Effect.Effect<ReadonlyArray<string>, Inner.KV.BucketError | Inner.KV.GetError>;

  readonly list: <S extends Schema.Top>(
    bucketName: string, schema: S,
  ) => Effect.Effect<ReadonlyArray<TypedKVEntry<S['Type']>>, Inner.KV.BucketError | Inner.KV.GetError | Codec.DecodeError, S['DecodingServices']>;

  readonly history: <S extends Schema.Top>(
    bucketName: string, key: string, schema: S,
  ) => Effect.Effect<ReadonlyArray<TypedKVEntry<S['Type']>>, Inner.KV.BucketError | Inner.KV.GetError | Codec.DecodeError, S['DecodingServices']>;
}

// =============================================================================
// Service Definition
// =============================================================================

export class NatsKVService extends Context.Service<
  NatsKVService, NatsKVServiceShape
>()('@tmnl/msh/nats/KV') {
  /** Injectable layer for tests/custom runtimes. Requires NatsInnerService. */
  static readonly layerFromInner = Layer.effect(
    NatsKVService,
    Effect.gen(function* () {
      const inner = yield* NatsInnerService;
      const bucketCache = new Map<string, KVBucket>();

      const getBucket = (name: string) =>
        Effect.gen(function* () {
          const cached = bucketCache.get(name);
          if (cached) return cached;
          const bucket = yield* inner.kv.bucket(name);
          bucketCache.set(name, bucket);
          return bucket;
        });

      const decodeEntry = <S extends Schema.Top>(
        entry: KvEntry, schema: S, bucketName: string,
      ): Effect.Effect<TypedKVEntry<S['Type']>, Codec.DecodeError, S['DecodingServices']> =>
        pipe(
          NatsCodec.decodeJson(schema, { subject: `kv.${bucketName}.${entry.key}` })(entry.value),
          Effect.map((value): TypedKVEntry<S['Type']> => ({
            key: entry.key, value, revision: entry.revision,
            created: entry.created, operation: entry.operation as 'PUT' | 'DEL' | 'PURGE',
          })),
        );

      const collectAsync = <T>(iter: AsyncIterable<T>): Effect.Effect<T[]> =>
        Effect.promise(async () => { const r: T[] = []; for await (const i of iter) r.push(i); return r; });

      const get: NatsKVServiceShape['get'] = (bucketName, key, schema) =>
        Effect.gen(function* () {
          const bucket = yield* getBucket(bucketName);
          const entry = yield* inner.kv.get(bucketName, bucket, key);
          if (!entry || !entry.value)
            return yield* Effect.fail(new KVErrors.NotFoundError({ bucketName, key }));
          return yield* NatsCodec.decodeJson(schema, { subject: `kv.${bucketName}.${key}` })(entry.value);
        });

      const getOrNull: NatsKVServiceShape['getOrNull'] = (bucketName, key, schema) =>
        Effect.gen(function* () {
          const bucket = yield* getBucket(bucketName);
          const entry = yield* inner.kv.get(bucketName, bucket, key);
          if (!entry || !entry.value) return null;
          return yield* NatsCodec.decodeJson(schema, { subject: `kv.${bucketName}.${key}` })(entry.value);
        });

      const put: NatsKVServiceShape['put'] = (bucketName, key, schema, value) =>
        Effect.gen(function* () {
          const bucket = yield* getBucket(bucketName);
          const bytes = yield* pipe(
            NatsCodec.encodeJson(schema, value),
            Effect.mapError((e) => new Codec.EncodeError({ message: `Encode failed '${bucketName}.${key}'`, cause: e })),
          );
          return yield* inner.kv.put(bucketName, bucket, key, bytes);
        });

      const del: NatsKVServiceShape['delete'] = (bucketName, key) =>
        Effect.gen(function* () { const b = yield* getBucket(bucketName); yield* inner.kv.delete(bucketName, b, key); });

      const purge: NatsKVServiceShape['purge'] = (bucketName, key) =>
        Effect.gen(function* () { const b = yield* getBucket(bucketName); yield* inner.kv.purge(bucketName, b, key); });

      const watch: NatsKVServiceShape['watch'] = (bucketName, schema, opts) =>
        Effect.gen(function* () {
          const bucket = yield* getBucket(bucketName);
          const watchOpts: Partial<KvWatchOptions> = {};
          if (opts?.key) watchOpts.key = opts.key;
          if (opts?.include) watchOpts.include = opts.include as KvWatchOptions['include'];
          if (opts?.startRevision) watchOpts.resumeFromRevision = opts.startRevision;
          const iterator = yield* inner.kv.watch(bucket, watchOpts);
          const rawStream = fromAsyncIterable(
            iterator,
            (err) => new Inner.KV.WatchError({ message: `Watch error '${bucketName}'`, bucketName, key: opts?.key, cause: err }),
          );
          return pipe(
            rawStream,
            Stream.filter((entry) => entry.value !== null && entry.operation === 'PUT'),
            Stream.mapEffect((entry) => decodeEntry(entry, schema, bucketName)),
          );
        });

      const keys: NatsKVServiceShape['keys'] = (bucketName, filter) =>
        Effect.gen(function* () {
          const b = yield* getBucket(bucketName);
          const iter = yield* inner.kv.keys(b, filter);
          return yield* collectAsync(iter);
        });

      const list: NatsKVServiceShape['list'] = (bucketName, schema) =>
        Effect.gen(function* () {
          const b = yield* getBucket(bucketName);
          const iter = yield* inner.kv.keys(b);
          const allKeys = yield* collectAsync(iter);
          const entries: TypedKVEntry<any>[] = [];
          for (const key of allKeys) {
            const entry = yield* inner.kv.get(bucketName, b, key);
            if (entry?.value) entries.push(yield* decodeEntry(entry, schema, bucketName));
          }
          return entries;
        });

      const history: NatsKVServiceShape['history'] = (bucketName, key, schema) =>
        Effect.gen(function* () {
          const b = yield* getBucket(bucketName);
          const iter = yield* inner.kv.history(b, key);
          const all = yield* collectAsync(iter);
          const entries: TypedKVEntry<any>[] = [];
          for (const e of all) { if (e.value) entries.push(yield* decodeEntry(e, schema, bucketName)); }
          return entries;
        });

      return NatsKVService.of({
        get: (b, k, s) => get(b, k, s).pipe(Effect.withSpan(MshSpan.KV.get)),
        getOrNull: (b, k, s) => getOrNull(b, k, s).pipe(Effect.withSpan(MshSpan.KV.getOrNull)),
        put: (b, k, s, v) => put(b, k, s, v).pipe(Effect.withSpan(MshSpan.KV.put)),
        delete: (b, k) => del(b, k).pipe(Effect.withSpan(MshSpan.KV.delete)),
        purge: (b, k) => purge(b, k).pipe(Effect.withSpan(MshSpan.KV.purge)),
        watch: (b, s, o) => watch(b, s, o).pipe(Effect.withSpan(MshSpan.KV.watch)),
        keys: (b, f) => keys(b, f).pipe(Effect.withSpan(MshSpan.KV.keys)),
        list: (b, s) => list(b, s).pipe(Effect.withSpan(MshSpan.KV.list)),
        history: (b, k, s) => history(b, k, s).pipe(Effect.withSpan(MshSpan.KV.history)),
      });
    }),
  );

  static readonly layer = NatsKVService.layerFromInner.pipe(
    Layer.provide(NatsInnerService.layer),
  );
}

export const NatsKVServiceLive = NatsKVService.layer;
