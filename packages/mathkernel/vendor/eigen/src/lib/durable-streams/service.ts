/**
 * Durable Streams Effect Service
 *
 * Effect-TS wrapper for @durable-streams/client.
 * Wraps Promise-based APIs in Effect for proper error handling,
 * interruption, and composition with other Effect services.
 *
 * @see Schema definitions in ./schemas.ts
 * @see Error types in @/lib/holonet/durable-streams/schemas/errors.ts
 */

import { Context, Effect, Layer, Stream, PubSub, Scope, Option, pipe, Match } from 'effect';
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

// Import domain errors from holonet
import {
  StreamNotFoundError,
  StreamExistsError,
  ContentTypeMismatch,
  InvalidOffsetError,
  NatsConnectionError,
  UnexpectedError,
  type DurableStreamError,
} from '@/lib/holonet/durable-streams/schemas/errors';

// Re-export error types for consumers
export {
  StreamNotFoundError,
  StreamExistsError,
  ContentTypeMismatch,
  InvalidOffsetError,
  NatsConnectionError,
  UnexpectedError,
  type DurableStreamError,
} from '@/lib/holonet/durable-streams/schemas/errors';

// ============================================================================
// Error Mapping (HTTP status → Domain Error)
// ============================================================================

/**
 * Map HTTP errors to domain errors using Match
 */
const mapHttpError = (url: string) => (error: unknown): DurableStreamError =>
  pipe(
    Match.value(error),
    Match.when(
      (e: unknown): e is { status: number; message?: string } =>
        typeof (e as { status?: unknown })?.status === 'number',
      (e: { status: number; message?: string }) =>
        pipe(
          Match.value(e.status),
          Match.when(404, () => new StreamNotFoundError({ streamId: url })),
          Match.when(409, () => new StreamExistsError({ streamId: url })),
          Match.when(400, () =>
            new InvalidOffsetError({ offset: '', reason: e.message ?? 'Bad request' })
          ),
          Match.orElse(() =>
            new UnexpectedError({ message: e.message ?? String(error), cause: error })
          )
        )
    ),
    Match.when(
      (e: unknown): e is Error => e instanceof Error,
      (e: Error) => {
        const msg = e.message.toLowerCase();
        if (msg.includes('econnrefused') || msg.includes('fetch failed')) {
          return new NatsConnectionError({ reason: e.message, cause: e });
        }
        return new UnexpectedError({ message: e.message, cause: e });
      }
    ),
    Match.orElse(() => new UnexpectedError({ message: String(error), cause: error }))
  );

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
// URL Construction Helper
// ============================================================================

/**
 * Build a full stream URL from baseUrl and streamId.
 * Handles both full URLs (passthrough) and relative paths.
 */
const buildStreamUrl = (baseUrl: string | undefined, streamId: string): string => {
  // If streamId is already a full URL, use it directly
  if (streamId.startsWith('http://') || streamId.startsWith('https://')) {
    return streamId;
  }

  // If no baseUrl, the streamId must be treated as-is (will likely fail)
  if (!baseUrl) {
    return streamId;
  }

  // Normalize: remove trailing slash from baseUrl, ensure streamId starts with /
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const path = streamId.startsWith('/') ? streamId : `/${streamId}`;

  return `${base}${path}`;
};

// ============================================================================
// Helper: Wrap Handle
// ============================================================================

const wrapHandle = <T>(handle: DurableStreamHandle): EffectStreamHandle<T> => ({
  url: handle.url,
  contentType: handle.contentType,

  append: (data: T) =>
    Effect.tryPromise({
      try: () => handle.append(data),
      catch: mapHttpError(handle.url),
    }),

  appendBatch: (items: readonly T[]) =>
    Effect.forEach(items, (item) =>
      Effect.tryPromise({
        try: () => handle.append(item),
        catch: mapHttpError(handle.url),
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
      catch: mapHttpError(handle.url),
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
            res.subscribeJson(async (batch: { items: readonly T[]; offset: string; upToDate: boolean }) => {
              await Effect.runPromise(
                PubSub.publish(pubsub, {
                  items: batch.items,
                  offset: batch.offset,
                  upToDate: batch.upToDate,
                })
              );
            });

            // Keep alive until aborted
            await new Promise(() => {});
          },
          catch: mapHttpError(handle.url),
        })
      );

      // Return a stream from the pubsub
      return pipe(
        Stream.fromPubSub(pubsub),
        Stream.mapError(() =>
          new UnexpectedError({ message: 'PubSub error', cause: undefined })
        )
      );
    }),

  head: () =>
    Effect.tryPromise({
      try: () => handle.head(),
      catch: mapHttpError(handle.url),
    }),

  delete: () =>
    Effect.tryPromise({
      try: () => handle.delete(),
      catch: mapHttpError(handle.url),
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
        new UnexpectedError({
          message: 'Failed to import @durable-streams/client',
          cause: undefined,
        }),
    });

    // Try to get config, default to empty if not provided
    const configOption = yield* Effect.serviceOption(DurableStreamClientConfigTag);
    const baseConfig = Option.getOrElse(configOption, () => ({} as DurableStreamClientConfig));

    return {
      create: <T = unknown>(streamConfig: StreamCreateConfig) => {
        const fullUrl = buildStreamUrl(baseConfig.baseUrl, streamConfig.url);
        return Effect.tryPromise({
          try: () =>
            DurableStream.create({
              url: fullUrl,
              contentType: streamConfig.contentType ?? baseConfig.defaultContentType,
              headers: baseConfig.headers,
              ttlSeconds: streamConfig.ttlSeconds,
              expiresAt: streamConfig.expiresAt,
              body: streamConfig.body as BodyInit | Uint8Array | undefined,
            }),
          catch: mapHttpError(fullUrl),
        }).pipe(Effect.map((handle) => wrapHandle<T>(handle)));
      },

      connect: <T = unknown>(streamConfig: StreamConnectConfig) => {
        const fullUrl = buildStreamUrl(baseConfig.baseUrl, streamConfig.url);
        return Effect.tryPromise({
          try: () =>
            DurableStream.connect({
              url: fullUrl,
              headers: { ...baseConfig.headers, ...streamConfig.headers },
            }),
          catch: mapHttpError(fullUrl),
        }).pipe(Effect.map((handle) => wrapHandle<T>(handle)));
      },

      getOrCreate: <T = unknown>(streamConfig: StreamCreateConfig) =>
        Effect.gen(function* () {
          const fullUrl = buildStreamUrl(baseConfig.baseUrl, streamConfig.url);

          // Try to connect first
          const connectResult = yield* Effect.tryPromise({
            try: () =>
              DurableStream.connect({
                url: fullUrl,
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
                url: fullUrl,
                contentType: streamConfig.contentType ?? baseConfig.defaultContentType,
                headers: baseConfig.headers,
                ttlSeconds: streamConfig.ttlSeconds,
                expiresAt: streamConfig.expiresAt,
                body: streamConfig.body as BodyInit | Uint8Array | undefined,
              }),
            catch: mapHttpError(fullUrl),
          });

          return wrapHandle<T>(handle);
        }),

      exists: (url: string) =>
        Effect.gen(function* () {
          const fullUrl = buildStreamUrl(baseConfig.baseUrl, url);
          const result = yield* Effect.tryPromise({
            try: async () => {
              const handle = new DurableStream({ url: fullUrl, headers: baseConfig.headers });
              await handle.head();
              return true;
            },
            catch: (e) => e as Error,
          }).pipe(Effect.either);

          if (result._tag === 'Right') {
            return true;
          }

          // Map the error to domain error using Match
          const domainError = mapHttpError(fullUrl)(result.left);

          // StreamNotFoundError or connection errors mean "doesn't exist"
          return pipe(
            Match.value(domainError),
            Match.tag('StreamNotFoundError', () => false),
            Match.tag('NatsConnectionError', () => false),
            Match.orElse((e) => Effect.runSync(Effect.fail(e)))
          );
        }),

      delete: (url: string) => {
        const fullUrl = buildStreamUrl(baseConfig.baseUrl, url);
        return Effect.tryPromise({
          try: () => DurableStream.delete({ url: fullUrl, headers: baseConfig.headers }),
          catch: mapHttpError(fullUrl),
        });
      },
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
