/**
 * NatsKVService
 *
 * Effect.Service wrapping NATS JetStream KV for reactive key-value storage.
 * Provides get/put/delete/watch/list operations with Schema-based encoding.
 *
 * NOTE: This is a general-purpose NATS KV wrapper. Domain-specific services
 * (e.g., DocumentRegistryService) should import and use this service.
 *
 * @module nats/NatsKVService
 */

import { Effect, Layer, Context, Stream, Schema, ParseResult } from 'effect';
// Use nats.ws for browser-compatible WebSocket transport
// The 'nats' package uses Node.js APIs (dns, fs) that don't work in browsers
import {
  connect,
  type NatsConnection,
  type KV,
  type KvWatchOptions,
} from 'nats.ws';

// =============================================================================
// Types
// =============================================================================

/**
 * KV entry with typed value after Schema decode.
 */
export interface TypedKvEntry<T> {
  readonly key: string;
  readonly value: T;
  readonly revision: number;
  readonly created: Date;
  readonly operation: 'PUT' | 'DEL' | 'PURGE';
}

/**
 * KV watch event — emitted when a key changes.
 */
export interface KvWatchEvent<T> {
  readonly key: string;
  readonly value: T | null; // null on delete
  readonly revision: number;
  readonly operation: 'PUT' | 'DEL' | 'PURGE';
}

/**
 * Configuration for NATS connection.
 */
export interface NatsConfig {
  readonly servers: string | string[];
  readonly name?: string;
}

// =============================================================================
// Errors
// =============================================================================

export class NatsConnectionError extends Error {
  readonly _tag = 'NatsConnectionError';
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'NatsConnectionError';
  }
}

export class NatsKVError extends Error {
  readonly _tag = 'NatsKVError';
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'NatsKVError';
  }
}

export class NatsKVNotFoundError extends Error {
  readonly _tag = 'NatsKVNotFoundError';
  constructor(readonly bucket: string, readonly key: string) {
    super(`Key not found: ${bucket}/${key}`);
    this.name = 'NatsKVNotFoundError';
  }
}

// =============================================================================
// Configuration Tag
// =============================================================================

export class NatsConfigTag extends Context.Tag('tmnl/nats/NatsConfig')<
  NatsConfigTag,
  NatsConfig
>() {
  static readonly Default = Layer.succeed(this, {
    // Use WebSocket protocol for browser compatibility (nats.ws)
    // Connect to port 9222 where NATS WebSocket is configured
    // (see docker/nats/nats-server.conf)
    servers: 'ws://localhost:9222',
    name: 'tmnl-client',
  });

  static readonly Custom = (config: NatsConfig) => Layer.succeed(this, config);
}

// =============================================================================
// Service Interface
// =============================================================================

export interface NatsKVServiceShape {
  /**
   * Get the underlying NATS connection.
   * Use for advanced operations not covered by this service.
   */
  readonly getConnection: () => Effect.Effect<
    NatsConnection,
    NatsConnectionError
  >;

  /**
   * Get or create a KV bucket.
   * Creates the bucket if it doesn't exist.
   */
  readonly getOrCreateBucket: (
    name: string,
    options?: { history?: number; ttl?: number }
  ) => Effect.Effect<KV, NatsKVError>;

  /**
   * Get a value from a bucket with Schema decode.
   * Returns null if key doesn't exist.
   */
  readonly get: <A, I>(
    bucket: KV,
    key: string,
    schema: Schema.Schema<A, I>
  ) => Effect.Effect<A | null, NatsKVError | ParseResult.ParseError>;

  /**
   * Put a value into a bucket with Schema encode.
   * Returns the revision number.
   */
  readonly put: <A, I>(
    bucket: KV,
    key: string,
    value: A,
    schema: Schema.Schema<A, I>
  ) => Effect.Effect<number, NatsKVError | ParseResult.ParseError>;

  /**
   * Delete a key from a bucket.
   */
  readonly delete: (
    bucket: KV,
    key: string
  ) => Effect.Effect<void, NatsKVError>;

  /**
   * Purge a key (remove all history).
   */
  readonly purge: (bucket: KV, key: string) => Effect.Effect<void, NatsKVError>;

  /**
   * Watch for changes on keys matching a pattern.
   * Returns a Stream that emits KvWatchEvent for each change.
   *
   * @param bucket - The KV bucket to watch
   * @param keyPattern - Key pattern to watch (supports wildcards: *, >)
   * @param schema - Schema to decode values
   * @param options - Watch options (includeHistory, etc.)
   */
  readonly watch: <A, I>(
    bucket: KV,
    keyPattern: string,
    schema: Schema.Schema<A, I>,
    options?: KvWatchOptions
  ) => Stream.Stream<KvWatchEvent<A>, NatsKVError | ParseResult.ParseError>;

  /**
   * List all keys in a bucket.
   */
  readonly keys: (bucket: KV) => Effect.Effect<readonly string[], NatsKVError>;

  /**
   * List all entries in a bucket with Schema decode.
   */
  readonly list: <A, I>(
    bucket: KV,
    schema: Schema.Schema<A, I>
  ) => Effect.Effect<
    readonly TypedKvEntry<A>[],
    NatsKVError | ParseResult.ParseError
  >;

  /**
   * Close the NATS connection.
   */
  readonly close: () => Effect.Effect<void, never>;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class NatsKVService extends Effect.Service<NatsKVService>()(
  'tmnl/nats/NatsKVService',
  {
    // Use scoped effect for proper resource management
    // Connection is acquired once and reused across all operations
    scoped: Effect.gen(function* () {
      const config = yield* NatsConfigTag;

      console.log('[NatsKVService] Acquiring NATS connection...', {
        servers: config.servers,
        name: config.name,
      });

      // Acquire connection with proper cleanup
      const nc = yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: async () => {
            console.log('[NatsKVService] Connecting to NATS...');
            const conn = await connect({
              servers: config.servers,
              name: config.name,
            });
            console.log('[NatsKVService] NATS connection established!');
            return conn;
          },
          catch: (err) => {
            console.error('[NatsKVService] NATS connection FAILED:', err);
            return new NatsConnectionError(
              `Failed to connect to NATS: ${err}`,
              err
            );
          },
        }),
        (conn) =>
          Effect.sync(() => {
            console.log('[NatsKVService] Releasing NATS connection...');
            conn.drain().catch(() => {});
            conn.close().catch(() => {});
          })
      );

      const getConnection = () => Effect.succeed(nc);

      const getOrCreateBucket = (
        name: string,
        options?: { history?: number; ttl?: number }
      ): Effect.Effect<KV, NatsKVError> =>
        Effect.gen(function* () {
          // Get JetStream client (connection already established)
          const js = nc.jetstream();

          return yield* Effect.tryPromise({
            try: async () => {
              // js.views.kv() creates bucket if it doesn't exist when opts provided
              return await js.views.kv(name, {
                history: options?.history ?? 5,
                ttl: options?.ttl,
              });
            },
            catch: (err) =>
              new NatsKVError(
                `Failed to get/create bucket '${name}': ${err}`,
                err
              ),
          });
        });

      const get = <A, I>(
        bucket: KV,
        key: string,
        schema: Schema.Schema<A, I>
      ): Effect.Effect<A | null, NatsKVError | ParseResult.ParseError> =>
        Effect.gen(function* () {
          const entry = yield* Effect.tryPromise({
            try: async () => {
              try {
                return await bucket.get(key);
              } catch {
                return null;
              }
            },
            catch: (err) =>
              new NatsKVError(`Failed to get key '${key}': ${err}`, err),
          });

          if (
            !entry ||
            entry.operation === 'DEL' ||
            entry.operation === 'PURGE'
          ) {
            return null;
          }

          const jsonStr = new TextDecoder().decode(entry.value);
          const parsed = JSON.parse(jsonStr);
          return yield* Schema.decodeUnknown(schema)(parsed);
        });

      const put = <A, I>(
        bucket: KV,
        key: string,
        value: A,
        schema: Schema.Schema<A, I>
      ): Effect.Effect<number, NatsKVError | ParseResult.ParseError> =>
        Effect.gen(function* () {
          const encoded = yield* Schema.encode(schema)(value);
          const jsonStr = JSON.stringify(encoded);
          const bytes = new TextEncoder().encode(jsonStr);

          const revision = yield* Effect.tryPromise({
            try: () => bucket.put(key, bytes),
            catch: (err) =>
              new NatsKVError(`Failed to put key '${key}': ${err}`, err),
          });

          return revision;
        });

      const del = (bucket: KV, key: string): Effect.Effect<void, NatsKVError> =>
        Effect.tryPromise({
          try: () => bucket.delete(key),
          catch: (err) =>
            new NatsKVError(`Failed to delete key '${key}': ${err}`, err),
        });

      const purge = (
        bucket: KV,
        key: string
      ): Effect.Effect<void, NatsKVError> =>
        Effect.tryPromise({
          try: () => bucket.purge(key),
          catch: (err) =>
            new NatsKVError(`Failed to purge key '${key}': ${err}`, err),
        });

      const watch = <A, I>(
        bucket: KV,
        keyPattern: string,
        schema: Schema.Schema<A, I>,
        options?: KvWatchOptions
      ): Stream.Stream<KvWatchEvent<A>, NatsKVError | ParseResult.ParseError> =>
        Stream.async<KvWatchEvent<A>, NatsKVError | ParseResult.ParseError>(
          (emit) => {
            let cancelled = false;

            const run = async () => {
              try {
                const watcher = await bucket.watch({
                  key: keyPattern,
                  ...options,
                });

                for await (const entry of watcher) {
                  if (cancelled) break;

                  try {
                    let value: A | null = null;
                    if (entry.operation === 'PUT' && entry.value) {
                      const jsonStr = new TextDecoder().decode(entry.value);
                      const parsed = JSON.parse(jsonStr);
                      const decoded = await Effect.runPromise(
                        Schema.decodeUnknown(schema)(parsed)
                      );
                      value = decoded;
                    }

                    emit.single({
                      key: entry.key,
                      value,
                      revision: entry.revision,
                      operation: entry.operation as 'PUT' | 'DEL' | 'PURGE',
                    });
                  } catch (err) {
                    // Schema decode error — emit as error
                    emit.fail(err as ParseResult.ParseError);
                    return;
                  }
                }

                emit.end();
              } catch (err) {
                emit.fail(
                  new NatsKVError(
                    `Watch failed for pattern '${keyPattern}': ${err}`,
                    err
                  )
                );
              }
            };

            run();

            return Effect.sync(() => {
              cancelled = true;
            });
          }
        );

      const keys = (
        bucket: KV
      ): Effect.Effect<readonly string[], NatsKVError> =>
        Effect.tryPromise({
          try: async () => {
            const result: string[] = [];
            const keysIter = await bucket.keys();
            for await (const key of keysIter) {
              result.push(key);
            }
            return result;
          },
          catch: (err) => new NatsKVError(`Failed to list keys: ${err}`, err),
        });

      const list = <A, I>(
        bucket: KV,
        schema: Schema.Schema<A, I>
      ): Effect.Effect<
        readonly TypedKvEntry<A>[],
        NatsKVError | ParseResult.ParseError
      > =>
        Effect.gen(function* () {
          const allKeys = yield* keys(bucket);
          const entries: TypedKvEntry<A>[] = [];

          for (const key of allKeys) {
            const value = yield* get(bucket, key, schema);
            if (value !== null) {
              // Get full entry for metadata
              const rawEntry = yield* Effect.tryPromise({
                try: () => bucket.get(key),
                catch: (err) =>
                  new NatsKVError(`Failed to get entry '${key}': ${err}`, err),
              });

              if (rawEntry && rawEntry.operation === 'PUT') {
                entries.push({
                  key,
                  value,
                  revision: rawEntry.revision,
                  created: new Date(rawEntry.created.getTime()),
                  operation: rawEntry.operation as 'PUT' | 'DEL' | 'PURGE',
                });
              }
            }
          }

          return entries;
        });

      // Close is now handled by scope cleanup (acquireRelease)
      // This method is kept for API compatibility but is a no-op
      const close = (): Effect.Effect<void, never> =>
        Effect.logDebug(
          'NatsKVService.close() called - cleanup handled by scope'
        );

      return {
        getConnection,
        getOrCreateBucket,
        get,
        put,
        delete: del,
        purge,
        watch,
        keys,
        list,
        close,
      } satisfies NatsKVServiceShape;
    }),
    dependencies: [NatsConfigTag.Default],
  }
) {}

// =============================================================================
// Layer Exports
// =============================================================================

export const NatsKVServiceLive = NatsKVService.Default;

export const NatsKVServiceCustom = (config: NatsConfig) =>
  NatsKVService.Default.pipe(Layer.provide(NatsConfigTag.Custom(config)));
