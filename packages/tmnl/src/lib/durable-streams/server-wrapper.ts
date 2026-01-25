/**
 * Durable Streams Server Effect Wrapper
 *
 * Effect-TS wrapper for @durable-streams/server.
 * Provides scoped lifecycle management, rich stream operations,
 * and observability hooks.
 *
 * @module @gbg/tmnl/durable-streams/server-wrapper
 */

import { Context, Effect, Layer, Scope, Schema, Stream, PubSub, Queue, pipe } from 'effect';

// NOTE: We intentionally do NOT import types from @durable-streams/server
// because even type imports can cause bundlers to process the module.
// Instead, we use inline types for the server instance.

// ============================================================================
// Error Types
// ============================================================================

export class DurableStreamServerError extends Error {
  readonly _tag = 'DurableStreamServerError';
  constructor(
    readonly code: 'START_FAILED' | 'STOP_FAILED' | 'STORE_ERROR' | 'IMPORT_ERROR' | 'LIFECYCLE_ERROR',
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DurableStreamServerError';
  }
}

// ============================================================================
// Configuration Schema
// ============================================================================

export const DurableStreamServerConfig = Schema.Struct({
  /** Port to listen on (0 = auto-assign) */
  port: Schema.optional(Schema.Number, { default: () => 4437 }),
  /** Host to bind to */
  host: Schema.optional(Schema.String, { default: () => '127.0.0.1' }),
  /** Long-poll timeout in ms */
  longPollTimeout: Schema.optional(Schema.Number, { default: () => 30000 }),
  /** Data directory for FileBackedStreamStore (undefined = in-memory) */
  dataDir: Schema.optional(Schema.String),
  /** Enable lifecycle hooks (onStreamCreated/onStreamDeleted) */
  enableHooks: Schema.optional(Schema.Boolean, { default: () => true }),
});
export type DurableStreamServerConfig = typeof DurableStreamServerConfig.Type;

export class DurableStreamServerConfigTag extends Context.Tag(
  'tmnl/durable-streams/DurableStreamServerConfig'
)<DurableStreamServerConfigTag, DurableStreamServerConfig>() {}

// ============================================================================
// Lifecycle Events (for observability)
// ============================================================================

export const StreamLifecycleEvent = Schema.Union(
  Schema.TaggedStruct('StreamCreated', {
    streamId: Schema.String,
    contentType: Schema.String,
    timestamp: Schema.Number,
  }),
  Schema.TaggedStruct('StreamDeleted', {
    streamId: Schema.String,
    timestamp: Schema.Number,
  }),
  Schema.TaggedStruct('ServerStarted', {
    url: Schema.String,
    timestamp: Schema.Number,
  }),
  Schema.TaggedStruct('ServerStopped', {
    timestamp: Schema.Number,
  })
);
export type StreamLifecycleEvent = typeof StreamLifecycleEvent.Type;

// ============================================================================
// Service Interface
// ============================================================================

export interface DurableStreamServerShape {
  /** Get the server URL (after start) */
  readonly url: Effect.Effect<string, DurableStreamServerError>;

  /** Check if server is running */
  readonly isRunning: Effect.Effect<boolean>;

  /** Subscribe to lifecycle events */
  readonly subscribe: Effect.Effect<
    Stream.Stream<StreamLifecycleEvent, never>,
    never,
    Scope.Scope
  >;

  /** Direct access to underlying store (for advanced use) */
  readonly store: Effect.Effect<unknown, DurableStreamServerError>;

  /** Get server stats */
  readonly stats: Effect.Effect<{
    readonly streamsCount: number;
    readonly uptime: number;
    readonly port: number;
  }>;
}

// ============================================================================
// Service Tag
// ============================================================================

export class DurableStreamServer extends Context.Tag('tmnl/durable-streams/DurableStreamServer')<
  DurableStreamServer,
  DurableStreamServerShape
>() {}

// ============================================================================
// Scoped Live Implementation
// ============================================================================

export const DurableStreamServerLive = Layer.scoped(
  DurableStreamServer,
  Effect.gen(function* () {
    // Get config (with defaults)
    const config = yield* Effect.serviceOption(DurableStreamServerConfigTag).pipe(
      Effect.map((opt) =>
        opt._tag === 'Some'
          ? opt.value
          : Schema.decodeSync(DurableStreamServerConfig)({})
      )
    );

    // Import the server module dynamically
    const { DurableStreamTestServer } = yield* Effect.tryPromise({
      try: () => import('@durable-streams/server'),
      catch: (e) =>
        new DurableStreamServerError('IMPORT_ERROR', 'Failed to import @durable-streams/server', e),
    });

    // Create lifecycle events PubSub
    const eventsPubSub = yield* PubSub.unbounded<StreamLifecycleEvent>();

    // Track start time
    const startTime = Date.now();
    let serverUrl: string | null = null;
    let isRunning = false;

    // Create server instance with hooks
    // Using 'any' for server type since we avoid importing types from @durable-streams/server
    const server: any = new DurableStreamTestServer({
      port: config.port ?? 4437,
      host: config.host ?? '127.0.0.1',
      longPollTimeout: config.longPollTimeout ?? 30000,
      dataDir: config.dataDir,
      onStreamCreated: config.enableHooks
        ? (streamId: string, contentType: string) => {
            Effect.runPromise(
              PubSub.publish(eventsPubSub, {
                _tag: 'StreamCreated' as const,
                streamId,
                contentType,
                timestamp: Date.now(),
              })
            );
          }
        : undefined,
      onStreamDeleted: config.enableHooks
        ? (streamId: string) => {
            Effect.runPromise(
              PubSub.publish(eventsPubSub, {
                _tag: 'StreamDeleted' as const,
                streamId,
                timestamp: Date.now(),
              })
            );
          }
        : undefined,
    });

    // Acquire: Start the server
    const url = yield* Effect.tryPromise({
      try: async () => {
        const u = await server.start();
        serverUrl = u;
        isRunning = true;
        return u;
      },
      catch: (e) => new DurableStreamServerError('START_FAILED', 'Failed to start server', e),
    });

    // Publish ServerStarted event
    yield* PubSub.publish(eventsPubSub, {
      _tag: 'ServerStarted' as const,
      url,
      timestamp: Date.now(),
    });

    // Register finalizer for cleanup
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        yield* Effect.tryPromise({
          try: async () => {
            await server.stop();
            isRunning = false;
          },
          catch: (e) =>
            new DurableStreamServerError('STOP_FAILED', 'Failed to stop server', e),
        }).pipe(
          Effect.catchAll((e) => Effect.logWarning(`Server stop error: ${e.message}`))
        );

        yield* PubSub.publish(eventsPubSub, {
          _tag: 'ServerStopped' as const,
          timestamp: Date.now(),
        });
      })
    );

    // Return service shape
    return {
      url: Effect.sync(() => {
        if (!serverUrl) {
          throw new DurableStreamServerError('LIFECYCLE_ERROR', 'Server not started');
        }
        return serverUrl;
      }),

      isRunning: Effect.sync(() => isRunning),

      subscribe: Effect.gen(function* () {
        const queue = yield* PubSub.subscribe(eventsPubSub);
        return Stream.fromQueue(queue);
      }),

      store: Effect.sync(() => server.store),

      stats: Effect.sync(() => ({
        streamsCount: 0, // Would need to query store
        uptime: Date.now() - startTime,
        port: config.port ?? 4437,
      })),
    };
  })
);

// ============================================================================
// Configured Layer Factory
// ============================================================================

/**
 * Create a configured server layer with custom config
 */
export const DurableStreamServerConfigured = (config: DurableStreamServerConfig) =>
  Layer.provide(
    DurableStreamServerLive,
    Layer.succeed(DurableStreamServerConfigTag, config)
  );

/**
 * Default server layer (port 4437, in-memory store)
 */
export const DurableStreamServerDefault = DurableStreamServerConfigured({
  port: 4437,
  host: '127.0.0.1',
});

/**
 * Persistent server layer (with FileBackedStreamStore)
 */
export const DurableStreamServerPersistent = (dataDir: string) =>
  DurableStreamServerConfigured({
    port: 4437,
    host: '127.0.0.1',
    dataDir,
  });

// ============================================================================
// Composite Layer: Server + Client
// ============================================================================

import { DurableStreamClient, DurableStreamClientLive, DurableStreamClientConfigured } from './service';

/**
 * Full stack layer: Server + Client configured to connect to it
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const server = yield* DurableStreamServer;
 *   const client = yield* DurableStreamClient;
 *
 *   const url = yield* server.url;
 *   const handle = yield* client.create({ url: `${url}/my-stream` });
 *   yield* handle.append({ message: 'hello' });
 * });
 *
 * Effect.runPromise(
 *   program.pipe(
 *     Effect.scoped,
 *     Effect.provide(DurableStreamFullStack())
 *   )
 * );
 * ```
 */
export const DurableStreamFullStack = (config?: {
  server?: DurableStreamServerConfig;
  dataDir?: string;
}) => {
  const serverLayer = config?.dataDir
    ? DurableStreamServerPersistent(config.dataDir)
    : config?.server
      ? DurableStreamServerConfigured(config.server)
      : DurableStreamServerDefault;

  // Client connects to the server's URL dynamically
  const clientLayer = Layer.effect(
    DurableStreamClient,
    Effect.gen(function* () {
      const server = yield* DurableStreamServer;
      const baseUrl = yield* server.url;

      // Re-implement client service with server's URL
      const { DurableStream } = yield* Effect.tryPromise({
        try: () => import('@durable-streams/client'),
        catch: () =>
          new Error('Failed to import @durable-streams/client'),
      });

      // Import the wrapHandle helper from service.ts
      const { wrapHandle } = yield* Effect.tryPromise({
        try: async () => {
          // We need to inline this or refactor
          const mod = await import('./service');
          return { wrapHandle: (mod as any).wrapHandle };
        },
        catch: () => new Error('Failed to import service helpers'),
      });

      return {
        create: (streamConfig: any) =>
          Effect.tryPromise({
            try: () =>
              DurableStream.create({
                url: streamConfig.url.startsWith('http')
                  ? streamConfig.url
                  : `${baseUrl}${streamConfig.url.startsWith('/') ? '' : '/'}${streamConfig.url}`,
                contentType: streamConfig.contentType,
                ttlSeconds: streamConfig.ttlSeconds,
                expiresAt: streamConfig.expiresAt,
                body: streamConfig.body,
              }),
            catch: (e) => new Error((e as Error).message),
          }).pipe(Effect.map((handle) => wrapHandle(handle))),

        connect: (streamConfig: any) =>
          Effect.tryPromise({
            try: () =>
              DurableStream.connect({
                url: streamConfig.url.startsWith('http')
                  ? streamConfig.url
                  : `${baseUrl}${streamConfig.url.startsWith('/') ? '' : '/'}${streamConfig.url}`,
              }),
            catch: (e) => new Error((e as Error).message),
          }).pipe(Effect.map((handle) => wrapHandle(handle))),

        getOrCreate: (streamConfig: any) =>
          Effect.gen(function* () {
            const fullUrl = streamConfig.url.startsWith('http')
              ? streamConfig.url
              : `${baseUrl}${streamConfig.url.startsWith('/') ? '' : '/'}${streamConfig.url}`;

            const connectResult = yield* Effect.tryPromise({
              try: () => DurableStream.connect({ url: fullUrl }),
              catch: (e) => e as Error,
            }).pipe(Effect.either);

            if (connectResult._tag === 'Right') {
              return wrapHandle(connectResult.right);
            }

            const handle = yield* Effect.tryPromise({
              try: () =>
                DurableStream.create({
                  url: fullUrl,
                  contentType: streamConfig.contentType,
                }),
              catch: (e) => new Error((e as Error).message),
            });

            return wrapHandle(handle);
          }),

        exists: (url: string) =>
          Effect.tryPromise({
            try: async () => {
              const fullUrl = url.startsWith('http')
                ? url
                : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
              const handle = new DurableStream({ url: fullUrl });
              await handle.head();
              return true;
            },
            catch: () => false,
          }).pipe(Effect.catchAll(() => Effect.succeed(false))),

        delete: (url: string) =>
          Effect.tryPromise({
            try: () => {
              const fullUrl = url.startsWith('http')
                ? url
                : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
              return DurableStream.delete({ url: fullUrl });
            },
            catch: (e) => new Error((e as Error).message),
          }),
      } as any;
    })
  );

  return Layer.provideMerge(clientLayer, serverLayer);
};
