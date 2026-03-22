/**
 * Durable Streams Effect Bridge
 *
 * Effect-TS wrappers for @durable-streams/client AND @durable-streams/server.
 * Provides service-based access to durable, resumable streams
 * for real-time sync (Telegram WebApp, collaborative editing, etc.)
 *
 * @see https://github.com/durable-streams/durable-streams
 *
 * ## Client Usage
 * ```typescript
 * import { DurableStreamClient, DurableStreamClientLive } from '@/lib/durable-streams';
 *
 * const program = Effect.gen(function* () {
 *   const client = yield* DurableStreamClient;
 *   const handle = yield* client.create({ url: '...', contentType: 'application/json' });
 *   yield* handle.append({ event: 'created', data: { ... } });
 * });
 * ```
 *
 * ## Server Usage
 * ```typescript
 * import { DurableStreamServer, DurableStreamServerPersistent } from '@/lib/durable-streams';
 *
 * const program = Effect.gen(function* () {
 *   const server = yield* DurableStreamServer;
 *   const url = yield* server.url;
 *   console.log(`Server running at ${url}`);
 * });
 *
 * Effect.runPromise(
 *   program.pipe(
 *     Effect.scoped,
 *     Effect.provide(DurableStreamServerPersistent('/tmp/streams'))
 *   )
 * );
 * ```
 *
 * ## Full Stack (Server + Client)
 * ```typescript
 * import { DurableStreamFullStack, DurableStreamServer, DurableStreamClient } from '@/lib/durable-streams';
 *
 * const program = Effect.gen(function* () {
 *   const server = yield* DurableStreamServer;
 *   const client = yield* DurableStreamClient;
 *   const handle = yield* client.getOrCreate({ url: '/my-stream' });
 *   yield* handle.append({ data: 'hello' });
 * });
 *
 * Effect.runPromise(
 *   program.pipe(Effect.scoped, Effect.provide(DurableStreamFullStack()))
 * );
 * ```
 */

// Client (wraps @durable-streams/client)
export * from './service';
export * from './schemas';

// Native HTTP client (fallback when @durable-streams/client unavailable)
export * from './native-client';

// NOTE: Server-related exports are NOT included here because they contain
// Node.js-only dependencies (fs, path, os, lmdb, @durable-streams/server).
//
// For server-side code, import directly:
//   import { DurableStreamServer, ... } from '@/lib/durable-streams/server-wrapper';
//   import * as customServer from '@/lib/durable-streams/server';
