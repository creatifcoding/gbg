/**
 * Native Durable Streams Client
 *
 * Direct HTTP client for our Effect-native durable streams server.
 * Bypasses @durable-streams/client for guaranteed compatibility.
 *
 * @module @gbg/tmnl/durable-streams/native-client
 */

import { Context, Effect, Layer, Stream, Schema, pipe } from 'effect';
import type { Scope } from 'effect/Scope';

// ============================================================================
// Types
// ============================================================================

/**
 * Stream entry from server
 */
export interface StreamEntry<T = unknown> {
  readonly offset: string;
  readonly data: T;
  readonly timestamp: number;
}

/**
 * Read response from server
 */
export interface StreamReadResponse<T = unknown> {
  readonly streamId: string;
  readonly entries: readonly StreamEntry<T>[];
  readonly lastOffset: string;
  readonly upToDate: boolean;
}

/**
 * Stream metadata from server
 */
export interface StreamMetadata {
  readonly exists: boolean;
  readonly streamId?: string;
  readonly contentType?: string;
  readonly currentOffset?: string;
  readonly createdAt?: number;
  readonly updatedAt?: number;
}

/**
 * Append result from server
 */
export interface AppendResult {
  readonly offset: string;
  readonly streamId: string;
  readonly success: boolean;
}

// ============================================================================
// Error
// ============================================================================

export class NativeStreamError extends Error {
  readonly _tag = 'NativeStreamError';
  constructor(
    readonly code: string,
    message: string,
    readonly url?: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'NativeStreamError';
  }
}

// ============================================================================
// Stream Handle
// ============================================================================

export interface NativeStreamHandle<T = unknown> {
  readonly url: string;
  readonly streamId: string;

  /** Append data to stream */
  readonly append: (data: T) => Effect.Effect<AppendResult, NativeStreamError>;

  /** Append multiple items */
  readonly appendBatch: (
    items: readonly T[]
  ) => Effect.Effect<AppendResult[], NativeStreamError>;

  /** Read from stream */
  readonly read: (opts?: {
    offset?: string;
    limit?: number;
  }) => Effect.Effect<StreamReadResponse<T>, NativeStreamError>;

  /** Check if stream exists */
  readonly exists: () => Effect.Effect<boolean, NativeStreamError>;

  /** Get metadata */
  readonly metadata: () => Effect.Effect<StreamMetadata, NativeStreamError>;

  /** Delete stream */
  readonly delete: () => Effect.Effect<void, NativeStreamError>;
}

// ============================================================================
// Create Handle
// ============================================================================

const createHandle = <T>(
  baseUrl: string,
  streamId: string
): NativeStreamHandle<T> => {
  const url = `${baseUrl}/v1/stream/${streamId}`;

  return {
    url,
    streamId,

    append: (data: T) =>
      Effect.tryPromise({
        try: async () => {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data }),
          });

          if (!res.ok) {
            const text = await res.text();
            throw new NativeStreamError(
              res.status === 404 ? 'NOT_FOUND' : 'APPEND_ERROR',
              text || res.statusText,
              url,
              res.status
            );
          }

          return (await res.json()) as AppendResult;
        },
        catch: (e) => {
          if (e instanceof NativeStreamError) return e;
          return new NativeStreamError(
            'APPEND_ERROR',
            (e as Error).message,
            url
          );
        },
      }),

    appendBatch: (items: readonly T[]) =>
      Effect.forEach(items, (item) =>
        Effect.tryPromise({
          try: async () => {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: item }),
            });

            if (!res.ok) {
              const text = await res.text();
              throw new NativeStreamError(
                'APPEND_ERROR',
                text || res.statusText,
                url,
                res.status
              );
            }

            return (await res.json()) as AppendResult;
          },
          catch: (e) => {
            if (e instanceof NativeStreamError) return e;
            return new NativeStreamError(
              'APPEND_ERROR',
              (e as Error).message,
              url
            );
          },
        })
      ),

    read: (opts) =>
      Effect.tryPromise({
        try: async () => {
          const params = new URLSearchParams();
          if (opts?.offset) params.set('offset', opts.offset);
          if (opts?.limit) params.set('limit', String(opts.limit));

          const queryString = params.toString();
          const fullUrl = queryString ? `${url}?${queryString}` : url;

          const res = await fetch(fullUrl, { method: 'GET' });

          if (!res.ok) {
            const text = await res.text();
            throw new NativeStreamError(
              res.status === 404 ? 'NOT_FOUND' : 'READ_ERROR',
              text || res.statusText,
              url,
              res.status
            );
          }

          return (await res.json()) as StreamReadResponse<T>;
        },
        catch: (e) => {
          if (e instanceof NativeStreamError) return e;
          return new NativeStreamError('READ_ERROR', (e as Error).message, url);
        },
      }),

    exists: () =>
      Effect.tryPromise({
        try: async () => {
          const res = await fetch(url, { method: 'HEAD' });
          return res.status === 204 || res.status === 200;
        },
        catch: () => false as boolean,
      }).pipe(Effect.catchAll(() => Effect.succeed(false))),

    metadata: () =>
      Effect.tryPromise({
        try: async () => {
          const res = await fetch(`${url}/metadata`, { method: 'GET' });

          if (!res.ok && res.status !== 404) {
            const text = await res.text();
            throw new NativeStreamError(
              'METADATA_ERROR',
              text || res.statusText,
              url,
              res.status
            );
          }

          return (await res.json()) as StreamMetadata;
        },
        catch: (e) => {
          if (e instanceof NativeStreamError) return e;
          return new NativeStreamError(
            'METADATA_ERROR',
            (e as Error).message,
            url
          );
        },
      }),

    delete: () =>
      Effect.tryPromise({
        try: async () => {
          const res = await fetch(url, { method: 'DELETE' });
          if (!res.ok && res.status !== 204) {
            const text = await res.text();
            throw new NativeStreamError(
              'DELETE_ERROR',
              text || res.statusText,
              url,
              res.status
            );
          }
        },
        catch: (e) => {
          if (e instanceof NativeStreamError) return e;
          return new NativeStreamError(
            'DELETE_ERROR',
            (e as Error).message,
            url
          );
        },
      }),
  };
};

// ============================================================================
// Service Interface
// ============================================================================

export interface NativeStreamClientShape {
  /**
   * Get or create a stream handle
   */
  readonly getOrCreate: <T = unknown>(
    streamId: string
  ) => NativeStreamHandle<T>;

  /**
   * Check if stream exists
   */
  readonly exists: (
    streamId: string
  ) => Effect.Effect<boolean, NativeStreamError>;

  /**
   * Delete a stream
   */
  readonly delete: (streamId: string) => Effect.Effect<void, NativeStreamError>;

  /**
   * Get server health
   */
  readonly health: () => Effect.Effect<boolean, NativeStreamError>;
}

// ============================================================================
// Service Tag
// ============================================================================

export class NativeStreamClient extends Context.Tag(
  'tmnl/durable-streams/NativeStreamClient'
)<NativeStreamClient, NativeStreamClientShape>() {}

// ============================================================================
// Configuration
// ============================================================================

export interface NativeStreamClientConfig {
  readonly baseUrl: string;
}

export class NativeStreamClientConfigTag extends Context.Tag(
  'tmnl/durable-streams/NativeStreamClientConfig'
)<NativeStreamClientConfigTag, NativeStreamClientConfig>() {}

// ============================================================================
// Live Implementation
// ============================================================================

export const NativeStreamClientLive = Layer.effect(
  NativeStreamClient,
  Effect.gen(function* () {
    const config = yield* NativeStreamClientConfigTag;
    const baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash

    return {
      getOrCreate: <T = unknown>(streamId: string) =>
        createHandle<T>(baseUrl, streamId),

      exists: (streamId: string) => createHandle(baseUrl, streamId).exists(),

      delete: (streamId: string) => createHandle(baseUrl, streamId).delete(),

      health: () =>
        Effect.tryPromise({
          try: async () => {
            const res = await fetch(`${baseUrl}/health`);
            return res.ok;
          },
          catch: () => false as boolean,
        }).pipe(Effect.catchAll(() => Effect.succeed(false))),
    };
  })
);

// ============================================================================
// Configured Layer
// ============================================================================

/**
 * Create a configured native stream client layer
 */
export const NativeStreamClientConfigured = (baseUrl: string) =>
  pipe(
    NativeStreamClientLive,
    Layer.provide(Layer.succeed(NativeStreamClientConfigTag, { baseUrl }))
  );

/**
 * Default layer using environment variable
 */
// Browser-safe: use import.meta.env for Vite, fallback to default
const getDefaultStreamUrl = (): string => {
  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_DURABLE_STREAM_URL
  ) {
    return import.meta.env.VITE_DURABLE_STREAM_URL;
  }
  return 'http://127.0.0.1:3030';
};

export const NativeStreamClientDefault = NativeStreamClientConfigured(
  getDefaultStreamUrl()
);
