/**
 * NATS KV Service
 *
 * High-level service for JetStream KV operations with Schema codecs.
 * Provides typed get/put/watch operations on top of NatsInnerService.
 *
 * Features:
 * - Schema-typed get/put/watch operations
 * - Automatic encoding/decoding with Effect Schema
 * - Cached bucket references
 * - Stream-based watch with proper cleanup
 *
 * @module holonet/nats/kv
 */

import { Effect, Stream, Schema, Scope, pipe } from 'effect';
import type { KV as KVBucket, KvEntry, KvWatchOptions } from 'nats.ws';

import { NatsInnerService } from './inner';
import { Inner, KV as KVErrors, Codec } from './errors';
import { NatsCodec } from './codec';
import { fromAsyncIterable } from '../utils/stream';

// =============================================================================
// Type Definitions
// =============================================================================

/** Entry returned from watch/list operations */
export interface TypedKVEntry<A> {
  /** The key */
  readonly key: string;
  /** Decoded value */
  readonly value: A;
  /** Revision number */
  readonly revision: number;
  /** Created timestamp */
  readonly created: Date;
  /** Operation type */
  readonly operation: 'PUT' | 'DEL' | 'PURGE';
}

/** Options for watch operations */
export interface WatchOptions {
  /** Key pattern to watch (supports wildcards) */
  readonly key?: string;
  /** Include initial values or only updates */
  readonly include?: 'lastValue' | 'allUpdates' | 'updates';
  /** Start from specific revision */
  readonly startRevision?: number;
}

// =============================================================================
// Service Shape
// =============================================================================

export interface NatsKVServiceShape {
  /**
   * Get a typed value from KV bucket.
   *
   * @param bucketName - Name of the KV bucket
   * @param key - Key to retrieve
   * @param schema - Schema for decoding the value
   * @returns The decoded value, or fails with NotFoundError if key doesn't exist
   */
  readonly get: <A, I, R>(
    bucketName: string,
    key: string,
    schema: Schema.Schema<A, I, R>
  ) => Effect.Effect<A, KVErrors.GetError, R>;

  /**
   * Get a typed value, returning null if not found.
   *
   * @param bucketName - Name of the KV bucket
   * @param key - Key to retrieve
   * @param schema - Schema for decoding the value
   * @returns The decoded value or null
   */
  readonly getOrNull: <A, I, R>(
    bucketName: string,
    key: string,
    schema: Schema.Schema<A, I, R>
  ) => Effect.Effect<
    A | null,
    Inner.KV.BucketError | Inner.KV.GetError | Codec.DecodeError,
    R
  >;

  /**
   * Put a typed value to KV bucket.
   *
   * @param bucketName - Name of the KV bucket
   * @param key - Key to store
   * @param schema - Schema for encoding the value
   * @param value - Value to store
   * @returns The new revision number
   */
  readonly put: <A, I, R>(
    bucketName: string,
    key: string,
    schema: Schema.Schema<A, I, R>,
    value: A
  ) => Effect.Effect<number, KVErrors.PutError, R>;

  /**
   * Delete a key from KV bucket.
   *
   * @param bucketName - Name of the KV bucket
   * @param key - Key to delete
   */
  readonly delete: (
    bucketName: string,
    key: string
  ) => Effect.Effect<void, KVErrors.DeleteError>;

  /**
   * Purge a key and all its history from KV bucket.
   *
   * @param bucketName - Name of the KV bucket
   * @param key - Key to purge
   */
  readonly purge: (
    bucketName: string,
    key: string
  ) => Effect.Effect<void, KVErrors.DeleteError>;

  /**
   * Watch for changes on a key pattern.
   *
   * @param bucketName - Name of the KV bucket
   * @param schema - Schema for decoding values
   * @param opts - Watch options (key pattern, include mode)
   * @returns Scoped stream of typed entries
   */
  readonly watch: <A, I, R>(
    bucketName: string,
    schema: Schema.Schema<A, I, R>,
    opts?: WatchOptions
  ) => Effect.Effect<
    Stream.Stream<TypedKVEntry<A>, KVErrors.WatchError, R>,
    Inner.KV.BucketError | Inner.KV.WatchError,
    Scope.Scope | R
  >;

  /**
   * List all keys in the bucket.
   *
   * @param bucketName - Name of the KV bucket
   * @param filter - Optional key filter pattern
   * @returns Array of keys
   */
  readonly keys: (
    bucketName: string,
    filter?: string
  ) => Effect.Effect<
    ReadonlyArray<string>,
    Inner.KV.BucketError | Inner.KV.GetError
  >;

  /**
   * List all entries with typed values.
   *
   * @param bucketName - Name of the KV bucket
   * @param schema - Schema for decoding values
   * @returns Array of typed entries
   */
  readonly list: <A, I, R>(
    bucketName: string,
    schema: Schema.Schema<A, I, R>
  ) => Effect.Effect<
    ReadonlyArray<TypedKVEntry<A>>,
    Inner.KV.BucketError | Inner.KV.GetError | Codec.DecodeError,
    R
  >;

  /**
   * Get the history of a key.
   *
   * @param bucketName - Name of the KV bucket
   * @param key - Key to get history for
   * @param schema - Schema for decoding values
   * @returns Array of typed entries representing the key's history
   */
  readonly history: <A, I, R>(
    bucketName: string,
    key: string,
    schema: Schema.Schema<A, I, R>
  ) => Effect.Effect<
    ReadonlyArray<TypedKVEntry<A>>,
    Inner.KV.BucketError | Inner.KV.GetError | Codec.DecodeError,
    R
  >;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class NatsKVService extends Effect.Service<NatsKVService>()(
  'holonet/nats/KV',
  {
    effect: Effect.gen(function* () {
      const inner = yield* NatsInnerService;

      // Bucket cache for reuse
      const bucketCache = new Map<string, KVBucket>();

      // ─────────────────────────────────────────────────────────────────────────
      // BUCKET ACCESS
      // ─────────────────────────────────────────────────────────────────────────

      const getBucket = (name: string) =>
        Effect.gen(function* () {
          const cached = bucketCache.get(name);
          if (cached) return cached;

          const bucket = yield* inner.kv.bucket(name);
          bucketCache.set(name, bucket);
          return bucket;
        });

      // ─────────────────────────────────────────────────────────────────────────
      // HELPERS
      // ─────────────────────────────────────────────────────────────────────────

      const decodeEntry = <A, I, R>(
        entry: KvEntry,
        schema: Schema.Schema<A, I, R>,
        bucketName: string
      ): Effect.Effect<TypedKVEntry<A>, Codec.DecodeError, R> =>
        pipe(
          NatsCodec.decodeJson(schema, { subject: `kv.${bucketName}.${entry.key}` })(
            entry.value
          ),
          Effect.map(
            (value): TypedKVEntry<A> => ({
              key: entry.key,
              value,
              revision: entry.revision,
              created: entry.created,
              operation: entry.operation as 'PUT' | 'DEL' | 'PURGE',
            })
          )
        );

      /**
       * Collect async iterator into array using Effect.promise wrapper.
       * This avoids the "for await inside Effect.gen" issue.
       */
      const collectAsyncIterator = <T>(
        iterator: AsyncIterable<T>
      ): Effect.Effect<T[]> =>
        Effect.promise(async () => {
          const results: T[] = [];
          for await (const item of iterator) {
            results.push(item);
          }
          return results;
        });

      // ─────────────────────────────────────────────────────────────────────────
      // GET
      // ─────────────────────────────────────────────────────────────────────────

      const get = <A, I, R>(
        bucketName: string,
        key: string,
        schema: Schema.Schema<A, I, R>
      ): Effect.Effect<A, KVErrors.GetError, R> =>
        Effect.gen(function* () {
          const bucket = yield* getBucket(bucketName);
          const entry = yield* inner.kv.get(bucketName, bucket, key);

          if (!entry || !entry.value) {
            return yield* Effect.fail(
              new KVErrors.NotFoundError({ bucketName, key })
            );
          }

          return yield* NatsCodec.decodeJson(schema, {
            subject: `kv.${bucketName}.${key}`,
          })(entry.value);
        });

      const getOrNull = <A, I, R>(
        bucketName: string,
        key: string,
        schema: Schema.Schema<A, I, R>
      ): Effect.Effect<
        A | null,
        Inner.KV.BucketError | Inner.KV.GetError | Codec.DecodeError,
        R
      > =>
        Effect.gen(function* () {
          const bucket = yield* getBucket(bucketName);
          const entry = yield* inner.kv.get(bucketName, bucket, key);

          if (!entry || !entry.value) {
            return null;
          }

          return yield* NatsCodec.decodeJson(schema, {
            subject: `kv.${bucketName}.${key}`,
          })(entry.value);
        });

      // ─────────────────────────────────────────────────────────────────────────
      // PUT
      // ─────────────────────────────────────────────────────────────────────────

      const put = <A, I, R>(
        bucketName: string,
        key: string,
        schema: Schema.Schema<A, I, R>,
        value: A
      ): Effect.Effect<number, KVErrors.PutError, R> =>
        Effect.gen(function* () {
          const bucket = yield* getBucket(bucketName);

          const bytes = yield* pipe(
            NatsCodec.encodeJson(schema, value),
            Effect.mapError(
              (encodeError) =>
                new Codec.EncodeError({
                  message: `Failed to encode value for '${bucketName}.${key}': ${encodeError.message}`,
                  cause: encodeError,
                })
            )
          );

          return yield* inner.kv.put(bucketName, bucket, key, bytes);
        });

      // ─────────────────────────────────────────────────────────────────────────
      // DELETE / PURGE
      // ─────────────────────────────────────────────────────────────────────────

      const del = (
        bucketName: string,
        key: string
      ): Effect.Effect<void, KVErrors.DeleteError> =>
        Effect.gen(function* () {
          const bucket = yield* getBucket(bucketName);
          yield* inner.kv.delete(bucketName, bucket, key);
        });

      const purge = (
        bucketName: string,
        key: string
      ): Effect.Effect<void, KVErrors.DeleteError> =>
        Effect.gen(function* () {
          const bucket = yield* getBucket(bucketName);
          yield* inner.kv.purge(bucketName, bucket, key);
        });

      // ─────────────────────────────────────────────────────────────────────────
      // WATCH
      // ─────────────────────────────────────────────────────────────────────────

      const watch = <A, I, R>(
        bucketName: string,
        schema: Schema.Schema<A, I, R>,
        opts?: WatchOptions
      ): Effect.Effect<
        Stream.Stream<TypedKVEntry<A>, KVErrors.WatchError, R>,
        Inner.KV.BucketError | Inner.KV.WatchError,
        Scope.Scope | R
      > =>
        Effect.gen(function* () {
          const bucket = yield* getBucket(bucketName);

          const watchOpts: Partial<KvWatchOptions> = {};
          if (opts?.key) watchOpts.key = opts.key;
          // Cast to satisfy nats.ws KvWatchInclude type
          if (opts?.include) watchOpts.include = opts.include as KvWatchOptions['include'];
          if (opts?.startRevision) watchOpts.resumeFromRevision = opts.startRevision;

          const iterator = yield* inner.kv.watch(bucket, watchOpts);

          const rawStream = fromAsyncIterable(
            iterator,
            (err) =>
              new Inner.KV.WatchError({
                message: `Watch iteration error on bucket '${bucketName}'`,
                bucketName,
                key: opts?.key,
                cause: err,
              }),
            () => {
              /* async iterators clean up automatically */
            }
          );

          return pipe(
            rawStream,
            Stream.filter((entry) => entry.value !== null && entry.operation === 'PUT'),
            Stream.mapEffect((entry) => decodeEntry(entry, schema, bucketName))
          );
        });

      // ─────────────────────────────────────────────────────────────────────────
      // KEYS / LIST / HISTORY
      // ─────────────────────────────────────────────────────────────────────────

      const keys = (
        bucketName: string,
        filter?: string
      ): Effect.Effect<
        ReadonlyArray<string>,
        Inner.KV.BucketError | Inner.KV.GetError
      > =>
        Effect.gen(function* () {
          const bucket = yield* getBucket(bucketName);
          const iterator = yield* inner.kv.keys(bucket, filter);
          return yield* collectAsyncIterator(iterator);
        });

      const list = <A, I, R>(
        bucketName: string,
        schema: Schema.Schema<A, I, R>
      ): Effect.Effect<
        ReadonlyArray<TypedKVEntry<A>>,
        Inner.KV.BucketError | Inner.KV.GetError | Codec.DecodeError,
        R
      > =>
        Effect.gen(function* () {
          const bucket = yield* getBucket(bucketName);
          const iterator = yield* inner.kv.keys(bucket);
          const allKeys = yield* collectAsyncIterator(iterator);

          // Process keys sequentially to maintain proper Effect context
          const entries: TypedKVEntry<A>[] = [];
          for (const key of allKeys) {
            const entry = yield* inner.kv.get(bucketName, bucket, key);
            if (entry && entry.value) {
              const typed = yield* decodeEntry(entry, schema, bucketName);
              entries.push(typed);
            }
          }
          return entries;
        });

      const history = <A, I, R>(
        bucketName: string,
        key: string,
        schema: Schema.Schema<A, I, R>
      ): Effect.Effect<
        ReadonlyArray<TypedKVEntry<A>>,
        Inner.KV.BucketError | Inner.KV.GetError | Codec.DecodeError,
        R
      > =>
        Effect.gen(function* () {
          const bucket = yield* getBucket(bucketName);
          const iterator = yield* inner.kv.history(bucket, key);
          const allEntries = yield* collectAsyncIterator(iterator);

          // Process entries sequentially to maintain proper Effect context
          const entries: TypedKVEntry<A>[] = [];
          for (const entry of allEntries) {
            if (entry.value) {
              const typed = yield* decodeEntry(entry, schema, bucketName);
              entries.push(typed);
            }
          }
          return entries;
        });

      return {
        get,
        getOrNull,
        put,
        delete: del,
        purge,
        watch,
        keys,
        list,
        history,
      } satisfies NatsKVServiceShape;
    }),
    dependencies: [NatsInnerService.Default],
  }
) {}

// =============================================================================
// Layer Exports
// =============================================================================

export const NatsKVServiceLive = NatsKVService.Default;
