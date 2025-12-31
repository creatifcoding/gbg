/**
 * Durable Streams Effect Service
 *
 * Effect-TS wrapper for @durable-streams/client.
 * Wraps Promise-based APIs in Effect for proper error handling,
 * interruption, and composition with other Effect services.
 *
 * @see Schema definitions in ./schemas.ts
 */

import { Context, Effect, Layer, Stream, PubSub, Queue, Scope, pipe } from 'effect';
import type {
  DurableStream as DurableStreamHandle,
  StreamResponse,
  DurableStreamOptions,
  CreateOptions,
  StreamOptions,
} from '@durable-streams/client';
import type {
  Offset,
  StreamCreateConfig,
  StreamConnectConfig,
  StreamReadConfig,
  StreamMetadata,
  JsonBatch,
} from './schemas';

// ============================================================================
// Error Types
// ============================================================================

/**
 * Durable stream error with code and context
 */
export class DurableStreamError extends Error {
  readonly _tag = 'DurableStreamError';
  constructor(
    readonly code: string,
    message: string,
    readonly url?: string
  ) {
    super(message);
    this.name = 'DurableStreamError';
  }
}

// ============================================================================
// Stream Handle (wrapped)
// ============================================================================

/**
 * Wrapped stream handle with Effect methods
 */
export interface EffectStreamHandle<T = unknown> {
  /** The underlying URL */
  readonly url: string;
  /** Content type (if known) */
  readonly contentType: string | undefined;

  /** Append data to the stream */
  readonly append: (data: T) => Effect.Effect<void, DurableStreamError>;

  /** Append multiple items */
  readonly appendBatch: (items: readonly T[]) => Effect.Effect<void, DurableStreamError>;

  /** Read from stream (catch-up or live) */
  readonly read: (
    config?: StreamReadConfig
  ) => Effect.Effect<JsonBatch<T>, DurableStreamError>;

  /** Subscribe to live updates as an Effect Stream */
  readonly subscribe: (
    config?: StreamReadConfig
  ) => Effect.Effect<Stream.Stream<JsonBatch<T>, DurableStreamError>, DurableStreamError, Scope.Scope>;

  /** Get stream metadata via HEAD */
  readonly head: () => Effect.Effect<StreamMetadata, DurableStreamError>;

  /** Delete the stream */
  readonly delete: () => Effect.Effect<void, DurableStreamError>;

  /** Get the raw handle (for advanced use) */
  readonly raw: () => DurableStreamHandle;
}

// ============================================================================
// Service Interface
// ============================================================================

/**
 * Durable Stream Client Service interface
 */
export interface DurableStreamClientShape {
  /**
   * Create a new stream (fails if exists)
   */
  readonly create: <T = unknown>(
    config: StreamCreateConfig
  ) => Effect.Effect<EffectStreamHandle<T>, DurableStreamError>;

  /**
   * Connect to an existing stream (fails if not exists)
   */
  readonly connect: <T = unknown>(
    config: StreamConnectConfig
  ) => Effect.Effect<EffectStreamHandle<T>, DurableStreamError>;

  /**
   * Get or create a stream (upsert semantics)
   */
  readonly getOrCreate: <T = unknown>(
    config: StreamCreateConfig
  ) => Effect.Effect<EffectStreamHandle<T>, DurableStreamError>;

  /**
   * Check if a stream exists
   */
  readonly exists: (url: string) => Effect.Effect<boolean, DurableStreamError>;

  /**
   * Delete a stream by URL
   */
  readonly delete: (url: string) => Effect.Effect<void, DurableStreamError>;
}

// ============================================================================
// Service Tag
// ============================================================================

export class DurableStreamClient extends Context.Tag('tmnl/durable-streams/DurableStreamClient')<
  DurableStreamClient,
  DurableStreamClientShape
>() {}

// ============================================================================
// Configuration Tag
// ============================================================================

export interface DurableStreamClientConfig {
  /** Base URL for streams (optional, can use full URLs) */
  baseUrl?: string;
  /** Default headers for all requests */
  headers?: Record<string, string>;
  /** Default content type for new streams */
  defaultContentType?: string;
}

export class DurableStreamClientConfigTag extends Context.Tag(
  'tmnl/durable-streams/DurableStreamClientConfig'
)<DurableStreamClientConfigTag, DurableStreamClientConfig>() {}

// ============================================================================
// Helper: Wrap Handle
// ============================================================================

const wrapHandle = <T>(handle: DurableStreamHandle): EffectStreamHandle<T> => ({
  url: handle.url,
  contentType: handle.contentType,

  append: (data: T) =>
    Effect.tryPromise({
      try: () => handle.append(data),
      catch: (e) =>
        new DurableStreamError(
          (e as any)?.code ?? 'APPEND_ERROR',
          (e as Error).message,
          handle.url
        ),
    }),

  appendBatch: (items: readonly T[]) =>
    Effect.forEach(items, (item) =>
      Effect.tryPromise({
        try: () => handle.append(item),
        catch: (e) =>
          new DurableStreamError(
            (e as any)?.code ?? 'APPEND_ERROR',
            (e as Error).message,
            handle.url
          ),
      })
    ).pipe(Effect.asVoid),

  read: (config?: StreamReadConfig) =>
    Effect.tryPromise({
      try: async () => {
        const res = await handle.stream({
          offset: config?.offset ?? '-1',
          live: config?.live ?? false,
          json: config?.json ?? true,
        });
        const items = await res.json();
        return {
          items: items as readonly T[],
          offset: res.offset,
          upToDate: res.upToDate,
        };
      },
      catch: (e) =>
        new DurableStreamError(
          (e as any)?.code ?? 'READ_ERROR',
          (e as Error).message,
          handle.url
        ),
    }),

  subscribe: (config?: StreamReadConfig) =>
    Effect.gen(function* () {
      const pubsub = yield* PubSub.unbounded<JsonBatch<T>>();

      // Start the subscription in a fiber
      yield* Effect.forkScoped(
        Effect.tryPromise({
          try: async () => {
            const res = await handle.stream({
              offset: config?.offset ?? '-1',
              live: config?.live ?? 'auto',
              json: config?.json ?? true,
            });

            // Use subscribeJson for live updates
            res.subscribeJson(async (batch: { items: T[]; offset: string; upToDate: boolean }) => {
              await Effect.runPromise(
                PubSub.publish(pubsub, {
                  items: batch.items as readonly T[],
                  offset: batch.offset,
                  upToDate: batch.upToDate,
                })
              );
            });

            // Keep alive until aborted
            await new Promise(() => {});
          },
          catch: (e) =>
            new DurableStreamError(
              (e as any)?.code ?? 'SUBSCRIBE_ERROR',
              (e as Error).message,
              handle.url
            ),
        })
      );

      // Return a stream from the pubsub
      return pipe(
        Stream.fromPubSub(pubsub),
        Stream.mapError(
          () => new DurableStreamError('SUBSCRIBE_ERROR', 'PubSub error', handle.url)
        )
      );
    }),

  head: () =>
    Effect.tryPromise({
      try: () => handle.head(),
      catch: (e) =>
        new DurableStreamError(
          (e as any)?.code ?? 'HEAD_ERROR',
          (e as Error).message,
          handle.url
        ),
    }),

  delete: () =>
    Effect.tryPromise({
      try: () => handle.delete(),
      catch: (e) =>
        new DurableStreamError(
          (e as any)?.code ?? 'DELETE_ERROR',
          (e as Error).message,
          handle.url
        ),
    }),

  raw: () => handle,
});

// ============================================================================
// Live Implementation
// ============================================================================

export const DurableStreamClientLive = Layer.effect(
  DurableStreamClient,
  Effect.gen(function* () {
    // Dynamic import to avoid bundling issues
    const { DurableStream } = yield* Effect.tryPromise({
      try: () => import('@durable-streams/client'),
      catch: () =>
        new DurableStreamError('IMPORT_ERROR', 'Failed to import @durable-streams/client'),
    });

    // Try to get config, default to empty if not provided
    const config = yield* Effect.serviceOption(DurableStreamClientConfigTag);
    const baseConfig = config.pipe(
      Effect.getOrElse(() => ({})),
      Effect.runSync
    );

    return {
      create: <T = unknown>(streamConfig: StreamCreateConfig) =>
        Effect.tryPromise({
          try: () =>
            DurableStream.create({
              url: streamConfig.url,
              contentType: streamConfig.contentType ?? baseConfig.defaultContentType,
              headers: baseConfig.headers,
              ttlSeconds: streamConfig.ttlSeconds,
              expiresAt: streamConfig.expiresAt,
              body: streamConfig.body,
            }),
          catch: (e) =>
            new DurableStreamError(
              (e as any)?.code ?? 'CREATE_ERROR',
              (e as Error).message,
              streamConfig.url
            ),
        }).pipe(Effect.map((handle) => wrapHandle<T>(handle))),

      connect: <T = unknown>(streamConfig: StreamConnectConfig) =>
        Effect.tryPromise({
          try: () =>
            DurableStream.connect({
              url: streamConfig.url,
              headers: { ...baseConfig.headers, ...streamConfig.headers },
            }),
          catch: (e) =>
            new DurableStreamError(
              (e as any)?.code ?? 'CONNECT_ERROR',
              (e as Error).message,
              streamConfig.url
            ),
        }).pipe(Effect.map((handle) => wrapHandle<T>(handle))),

      getOrCreate: <T = unknown>(streamConfig: StreamCreateConfig) =>
        Effect.gen(function* () {
          // Try to connect first
          const connectResult = yield* Effect.tryPromise({
            try: () =>
              DurableStream.connect({
                url: streamConfig.url,
                headers: baseConfig.headers,
              }),
            catch: (e) => e as Error,
          }).pipe(Effect.either);

          if (connectResult._tag === 'Right') {
            return wrapHandle<T>(connectResult.right);
          }

          // If connect failed, try to create
          const handle = yield* Effect.tryPromise({
            try: () =>
              DurableStream.create({
                url: streamConfig.url,
                contentType: streamConfig.contentType ?? baseConfig.defaultContentType,
                headers: baseConfig.headers,
                ttlSeconds: streamConfig.ttlSeconds,
                expiresAt: streamConfig.expiresAt,
                body: streamConfig.body,
              }),
            catch: (e) =>
              new DurableStreamError(
                (e as any)?.code ?? 'GET_OR_CREATE_ERROR',
                (e as Error).message,
                streamConfig.url
              ),
          });

          return wrapHandle<T>(handle);
        }),

      exists: (url: string) =>
        Effect.tryPromise({
          try: async () => {
            const handle = new DurableStream({ url, headers: baseConfig.headers });
            await handle.head();
            return true;
          },
          catch: (e) => {
            // If it's a 404, stream doesn't exist
            if ((e as any)?.code === 'NOT_FOUND') {
              return false;
            }
            throw new DurableStreamError(
              (e as any)?.code ?? 'EXISTS_ERROR',
              (e as Error).message,
              url
            );
          },
        }).pipe(
          Effect.catchAll((e) => {
            if (e === false) return Effect.succeed(false);
            return Effect.fail(e as DurableStreamError);
          })
        ),

      delete: (url: string) =>
        Effect.tryPromise({
          try: () => DurableStream.delete({ url, headers: baseConfig.headers }),
          catch: (e) =>
            new DurableStreamError(
              (e as any)?.code ?? 'DELETE_ERROR',
              (e as Error).message,
              url
            ),
        }),
    };
  })
);

// ============================================================================
// Default Layer (no config required)
// ============================================================================

export const DurableStreamClientDefault = DurableStreamClientLive;

// ============================================================================
// Configured Layer
// ============================================================================

export const DurableStreamClientConfigured = (config: DurableStreamClientConfig) =>
  Layer.provide(DurableStreamClientLive, Layer.succeed(DurableStreamClientConfigTag, config));
