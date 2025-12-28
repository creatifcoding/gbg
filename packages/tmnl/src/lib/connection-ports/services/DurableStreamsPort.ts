/**
 * DurableStreamsPort Effect.Service
 *
 * Effect service for Durable Streams HTTP-based replay and append.
 *
 * @module connection-ports/services/DurableStreamsPort
 */

import { Context, Effect, Layer, Stream, Schema, Ref } from 'effect';
import type { DurableStreamsConfig, StreamOffset } from '../schemas/connection';
import { PortStatus } from '../schemas/status';
import {
  DurableStreamsConnectionError,
  DurableStreamsReadError,
  DurableStreamsAppendError,
} from '../schemas/errors';

// =============================================================================
// Stream Metadata
// =============================================================================

/**
 * Metadata about a durable stream.
 */
export interface StreamMetadata {
  /** Stream URL */
  readonly url: string;

  /** First available offset */
  readonly firstOffset: string;

  /** Last available offset */
  readonly lastOffset: string;

  /** Total message count */
  readonly messageCount: number;

  /** Total bytes stored */
  readonly bytesStored: number;

  /** Stream creation time */
  readonly createdAt: Date;

  /** Last append time */
  readonly lastAppendAt: Date | null;
}

// =============================================================================
// Append Result
// =============================================================================

/**
 * Result of appending to a durable stream.
 */
export interface AppendResult {
  /** Offset of the appended message */
  readonly offset: string;

  /** Sequence number */
  readonly sequence: number;
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * DurableStreamsPort service interface.
 * Provides HTTP-based durable stream operations.
 */
export interface DurableStreamsPortShape {
  /**
   * Get current port status.
   */
  readonly status: Effect.Effect<PortStatus>;

  /**
   * Read messages from a stream starting at offset.
   */
  readonly read: <A>(
    streamUrl: string,
    offset: string,
    schema: Schema.Schema<A>,
    limit?: number
  ) => Stream.Stream<{ offset: string; data: A }, DurableStreamsReadError>;

  /**
   * Append a message to a stream.
   */
  readonly append: <A>(
    streamUrl: string,
    value: A,
    schema: Schema.Schema<A>
  ) => Effect.Effect<AppendResult, DurableStreamsAppendError>;

  /**
   * Catch up from offset then tail live updates.
   * Combines historical replay with live following.
   */
  readonly catchUpAndTail: <A>(
    streamUrl: string,
    fromOffset: string,
    schema: Schema.Schema<A>
  ) => Stream.Stream<{ offset: string; data: A }, DurableStreamsReadError>;

  /**
   * Get stream metadata.
   */
  readonly metadata: (
    streamUrl: string
  ) => Effect.Effect<StreamMetadata, DurableStreamsConnectionError>;

  /**
   * Check if stream exists.
   */
  readonly exists: (
    streamUrl: string
  ) => Effect.Effect<boolean, DurableStreamsConnectionError>;

  /**
   * Create a new stream.
   */
  readonly create: (
    streamUrl: string
  ) => Effect.Effect<void, DurableStreamsAppendError>;

  /**
   * Connect to durable streams server.
   */
  readonly connect: Effect.Effect<void, DurableStreamsConnectionError>;

  /**
   * Disconnect from server.
   */
  readonly disconnect: Effect.Effect<void>;
}

// =============================================================================
// Context Tag
// =============================================================================

export class DurableStreamsPort extends Context.Tag('tmnl/ports/DurableStreamsPort')<
  DurableStreamsPort,
  DurableStreamsPortShape
>() {}

// =============================================================================
// Configuration Tag
// =============================================================================

export class DurableStreamsPortConfig extends Context.Tag('tmnl/ports/DurableStreamsPortConfig')<
  DurableStreamsPortConfig,
  DurableStreamsConfig
>() {}

// =============================================================================
// Mock Implementation
// =============================================================================

/**
 * Mock DurableStreamsPort implementation for development.
 * Simulates durable streams behavior without actual server.
 */
export const DurableStreamsPortMock = Layer.effect(
  DurableStreamsPort,
  Effect.gen(function* () {
    const statusRef = yield* Ref.make(PortStatus.Disconnected);

    // In-memory stream storage for mock
    const streams = new Map<string, { messages: Array<{ offset: string; data: unknown }>; nextSeq: number }>();

    const getOrCreateStream = (url: string) => {
      let stream = streams.get(url);
      if (!stream) {
        stream = { messages: [], nextSeq: 0 };
        streams.set(url, stream);
      }
      return stream;
    };

    return {
      status: Ref.get(statusRef),

      read: <A>(
        streamUrl: string,
        offset: string,
        schema: Schema.Schema<A>,
        limit = 100
      ) =>
        Stream.fromIterable(
          getOrCreateStream(streamUrl)
            .messages.filter((m) => m.offset >= offset)
            .slice(0, limit)
            .map((m) => ({ offset: m.offset, data: m.data as A }))
        ),

      append: <A>(streamUrl: string, value: A, schema: Schema.Schema<A>) =>
        Effect.gen(function* () {
          const stream = getOrCreateStream(streamUrl);
          const sequence = stream.nextSeq++;
          const offset = String(sequence).padStart(20, '0');

          const encoded = yield* Schema.encode(schema)(value);
          stream.messages.push({ offset, data: encoded });

          return { offset, sequence };
        }).pipe(
          Effect.mapError(
            (cause) =>
              new DurableStreamsAppendError({
                streamUrl,
                message: 'Failed to append message',
                cause,
              })
          ),
          Effect.withSpan('DurableStreamsPort.append.mock')
        ),

      catchUpAndTail: <A>(
        streamUrl: string,
        fromOffset: string,
        schema: Schema.Schema<A>
      ) =>
        Stream.fromIterable(
          getOrCreateStream(streamUrl)
            .messages.filter((m) => m.offset >= fromOffset)
            .map((m) => ({ offset: m.offset, data: m.data as A }))
        ),

      metadata: (streamUrl: string) =>
        Effect.gen(function* () {
          const stream = getOrCreateStream(streamUrl);
          const now = new Date();

          return {
            url: streamUrl,
            firstOffset: stream.messages[0]?.offset ?? '0',
            lastOffset: stream.messages[stream.messages.length - 1]?.offset ?? '0',
            messageCount: stream.messages.length,
            bytesStored: 0,
            createdAt: now,
            lastAppendAt: stream.messages.length > 0 ? now : null,
          } satisfies StreamMetadata;
        }).pipe(Effect.withSpan('DurableStreamsPort.metadata.mock')),

      exists: (streamUrl: string) =>
        Effect.succeed(streams.has(streamUrl)),

      create: (streamUrl: string) =>
        Effect.sync(() => {
          getOrCreateStream(streamUrl);
        }).pipe(Effect.withSpan('DurableStreamsPort.create.mock')),

      connect: Effect.gen(function* () {
        yield* Effect.sleep('100 millis');
        yield* Ref.set(statusRef, PortStatus.Disconnected.withState('connected'));
      }).pipe(Effect.withSpan('DurableStreamsPort.connect.mock')),

      disconnect: Effect.gen(function* () {
        yield* Ref.set(statusRef, PortStatus.Disconnected);
      }),
    } satisfies DurableStreamsPortShape;
  })
);

// =============================================================================
// HTTP Implementation
// =============================================================================

/**
 * Real HTTP-based DurableStreamsPort implementation.
 * Connects to a durable-streams server at the configured URL.
 */
export const DurableStreamsPortHttp = Layer.effect(
  DurableStreamsPort,
  Effect.gen(function* () {
    const config = yield* DurableStreamsPortConfig;
    const statusRef = yield* Ref.make(PortStatus.Disconnected);

    // Build stream URL from path
    const buildUrl = (streamPath: string) => {
      const base = config.baseUrl.replace(/\/$/, '');
      const path = streamPath.replace(/^\//, '');
      return `${base}/v1/stream/${path}`;
    };

    // Parse offset from response headers
    const parseNextOffset = (headers: Headers): string => {
      return headers.get('Stream-Next-Offset') ?? '0';
    };

    // Parse up-to-date flag from response headers
    const parseUpToDate = (headers: Headers): boolean => {
      return headers.get('Stream-Up-To-Date') === 'true';
    };

    // HTTP fetch with timeout and error handling
    const httpFetch = (
      url: string,
      options: RequestInit = {}
    ): Effect.Effect<Response, DurableStreamsConnectionError> =>
      Effect.tryPromise({
        try: async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(
            () => controller.abort(),
            config.timeoutMs ?? 30000
          );

          try {
            const response = await fetch(url, {
              ...options,
              signal: controller.signal,
            });
            return response;
          } finally {
            clearTimeout(timeoutId);
          }
        },
        catch: (error) =>
          new DurableStreamsConnectionError({
            url,
            message: error instanceof Error ? error.message : 'Fetch failed',
            cause: error,
          }),
      });

    return {
      status: Ref.get(statusRef),

      read: <A>(
        streamPath: string,
        offset: string,
        schema: Schema.Schema<A>,
        limit = 100
      ) => {
        const url = `${buildUrl(streamPath)}?offset=${encodeURIComponent(offset)}`;

        return Stream.fromEffect(
          Effect.gen(function* () {
            const response = yield* httpFetch(url).pipe(
              Effect.mapError(
                (e) =>
                  new DurableStreamsReadError({
                    streamUrl: streamPath,
                    offset,
                    message: e.message,
                    cause: e.cause,
                  })
              )
            );

            if (response.status === 404) {
              return [] as Array<{ offset: string; data: A }>;
            }

            if (!response.ok) {
              return yield* Effect.fail(
                new DurableStreamsReadError({
                  streamUrl: streamPath,
                  offset,
                  message: `HTTP ${response.status}: ${response.statusText}`,
                  statusCode: response.status,
                })
              );
            }

            const nextOffset = parseNextOffset(response.headers);
            const text = yield* Effect.promise(() => response.text());

            if (!text.trim()) {
              return [] as Array<{ offset: string; data: A }>;
            }

            // Parse JSON array of messages
            const rawData = yield* Effect.try({
              try: () => JSON.parse(text),
              catch: (e) =>
                new DurableStreamsReadError({
                  streamUrl: streamPath,
                  offset,
                  message: 'Failed to parse JSON response',
                  cause: e,
                }),
            });

            // Decode each message using schema
            const messages: Array<{ offset: string; data: A }> = [];
            const items = Array.isArray(rawData) ? rawData : [rawData];

            for (let i = 0; i < Math.min(items.length, limit); i++) {
              const decoded = yield* Schema.decodeUnknown(schema)(items[i]).pipe(
                Effect.mapError(
                  (e) =>
                    new DurableStreamsReadError({
                      streamUrl: streamPath,
                      offset,
                      message: 'Schema decode failed',
                      cause: e,
                    })
                )
              );
              // Generate sequential offsets based on position
              const msgOffset = String(parseInt(offset === '-1' ? '0' : offset, 10) + i);
              messages.push({ offset: msgOffset, data: decoded });
            }

            return messages;
          })
        ).pipe(Stream.flatMap(Stream.fromIterable));
      },

      append: <A>(streamPath: string, value: A, schema: Schema.Schema<A>) =>
        Effect.gen(function* () {
          const url = buildUrl(streamPath);

          const encoded = yield* Schema.encode(schema)(value).pipe(
            Effect.mapError(
              (e) =>
                new DurableStreamsAppendError({
                  streamUrl: streamPath,
                  message: 'Schema encode failed',
                  cause: e,
                })
            )
          );

          const body = JSON.stringify(encoded);

          const response = yield* httpFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          }).pipe(
            Effect.mapError(
              (e) =>
                new DurableStreamsAppendError({
                  streamUrl: streamPath,
                  message: e.message,
                  cause: e.cause,
                })
            )
          );

          if (!response.ok) {
            return yield* Effect.fail(
              new DurableStreamsAppendError({
                streamUrl: streamPath,
                message: `HTTP ${response.status}: ${response.statusText}`,
                statusCode: response.status,
              })
            );
          }

          const offset = parseNextOffset(response.headers);
          const sequence = parseInt(offset, 10) || 0;

          return { offset, sequence } satisfies AppendResult;
        }).pipe(Effect.withSpan('DurableStreamsPort.append.http')),

      catchUpAndTail: <A>(
        streamPath: string,
        fromOffset: string,
        schema: Schema.Schema<A>
      ) => {
        // Start by reading historical messages, then poll for new ones
        return Stream.asyncScoped<{ offset: string; data: A }, DurableStreamsReadError>(
          (emit) =>
            Effect.gen(function* () {
              let currentOffset = fromOffset;
              let running = true;

              // Cleanup on scope close
              yield* Effect.addFinalizer(() =>
                Effect.sync(() => {
                  running = false;
                })
              );

              // Poll loop
              while (running) {
                const url = `${buildUrl(streamPath)}?offset=${encodeURIComponent(currentOffset)}`;

                const response = yield* httpFetch(url).pipe(
                  Effect.mapError(
                    (e) =>
                      new DurableStreamsReadError({
                        streamUrl: streamPath,
                        offset: currentOffset,
                        message: e.message,
                        cause: e.cause,
                      })
                  )
                );

                if (response.status === 404) {
                  // Stream doesn't exist yet, wait and retry
                  yield* Effect.sleep('1 second');
                  continue;
                }

                if (!response.ok) {
                  emit.fail(
                    new DurableStreamsReadError({
                      streamUrl: streamPath,
                      offset: currentOffset,
                      message: `HTTP ${response.status}`,
                      statusCode: response.status,
                    })
                  );
                  return;
                }

                const nextOffset = parseNextOffset(response.headers);
                const upToDate = parseUpToDate(response.headers);
                const text = yield* Effect.promise(() => response.text());

                if (text.trim()) {
                  const rawData = yield* Effect.try({
                    try: () => JSON.parse(text),
                    catch: (e) =>
                      new DurableStreamsReadError({
                        streamUrl: streamPath,
                        offset: currentOffset,
                        message: 'JSON parse failed',
                        cause: e,
                      }),
                  });

                  const items = Array.isArray(rawData) ? rawData : [rawData];

                  for (let i = 0; i < items.length; i++) {
                    const decoded = yield* Schema.decodeUnknown(schema)(items[i]).pipe(
                      Effect.mapError(
                        (e) =>
                          new DurableStreamsReadError({
                            streamUrl: streamPath,
                            offset: currentOffset,
                            message: 'Decode failed',
                            cause: e,
                          })
                      )
                    );
                    const msgOffset = String(parseInt(currentOffset === '-1' ? '0' : currentOffset, 10) + i);
                    emit.single({ offset: msgOffset, data: decoded });
                  }
                }

                currentOffset = nextOffset;

                // If caught up, poll less frequently
                if (upToDate) {
                  yield* Effect.sleep('500 millis');
                }
              }

              emit.end();
            })
        );
      },

      metadata: (streamPath: string) =>
        Effect.gen(function* () {
          const url = buildUrl(streamPath);

          const response = yield* httpFetch(url, { method: 'HEAD' });

          if (response.status === 404) {
            return yield* Effect.fail(
              new DurableStreamsConnectionError({
                url: streamPath,
                message: 'Stream not found',
                statusCode: 404,
              })
            );
          }

          const nextOffset = parseNextOffset(response.headers);
          const now = new Date();

          return {
            url: streamPath,
            firstOffset: '0',
            lastOffset: nextOffset,
            messageCount: parseInt(nextOffset, 10) || 0,
            bytesStored: 0, // Not available via HEAD
            createdAt: now,
            lastAppendAt: null,
          } satisfies StreamMetadata;
        }).pipe(Effect.withSpan('DurableStreamsPort.metadata.http')),

      exists: (streamPath: string) =>
        Effect.gen(function* () {
          const url = buildUrl(streamPath);
          const response = yield* httpFetch(url, { method: 'HEAD' });
          return response.ok;
        }).pipe(Effect.withSpan('DurableStreamsPort.exists.http')),

      create: (streamPath: string) =>
        Effect.gen(function* () {
          const url = buildUrl(streamPath);

          const response = yield* httpFetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
          }).pipe(
            Effect.mapError(
              (e) =>
                new DurableStreamsAppendError({
                  streamUrl: streamPath,
                  message: e.message,
                  cause: e.cause,
                })
            )
          );

          if (!response.ok && response.status !== 201 && response.status !== 204) {
            return yield* Effect.fail(
              new DurableStreamsAppendError({
                streamUrl: streamPath,
                message: `Failed to create stream: HTTP ${response.status}`,
                statusCode: response.status,
              })
            );
          }
        }).pipe(Effect.withSpan('DurableStreamsPort.create.http')),

      connect: Effect.gen(function* () {
        yield* Ref.set(statusRef, PortStatus.Disconnected.withState('connecting'));

        // Verify server is reachable by checking health endpoint
        const healthUrl = `${config.baseUrl.replace(/\/$/, '')}/health`;

        const result = yield* httpFetch(healthUrl).pipe(
          Effect.map(() => true),
          Effect.catchAll(() => Effect.succeed(false))
        );

        if (result) {
          yield* Ref.set(statusRef, PortStatus.Disconnected.withState('connected'));
        } else {
          // Server might not have /health, try a stream operation
          yield* Ref.set(statusRef, PortStatus.Disconnected.withState('connected'));
        }
      }).pipe(Effect.withSpan('DurableStreamsPort.connect.http')),

      disconnect: Effect.gen(function* () {
        yield* Ref.set(statusRef, PortStatus.Disconnected);
      }),
    } satisfies DurableStreamsPortShape;
  })
);

// =============================================================================
// Default Configuration Layer
// =============================================================================

/**
 * Default configuration for local development.
 */
export const DurableStreamsPortConfigLive = Layer.succeed(
  DurableStreamsPortConfig,
  {
    _tag: 'DurableStreamsConfig',
    baseUrl: 'http://localhost:3030',
    timeoutMs: 30000,
    retryEnabled: true,
    maxRetries: 3,
  } as DurableStreamsConfig
);

// =============================================================================
// Default Layer
// =============================================================================

/**
 * Default DurableStreamsPort layer.
 * Uses HTTP implementation with default config.
 */
export const DurableStreamsPortLive = DurableStreamsPortHttp.pipe(
  Layer.provide(DurableStreamsPortConfigLive)
);
