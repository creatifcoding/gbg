/**
 * Durable Streams Effect Bridge
 *
 * Effect-TS wrapper for @durable-streams/client protocol.
 * Provides service-based access to durable, resumable streams
 * for real-time sync (Telegram WebApp, collaborative editing, etc.)
 *
 * @see https://github.com/durable-streams/durable-streams
 * @example
 * ```typescript
 * import { DurableStreamClient, DurableStreamClientLive } from '@/lib/durable-streams';
 *
 * const program = Effect.gen(function* () {
 *   const client = yield* DurableStreamClient;
 *   const handle = yield* client.create({ url: '...', contentType: 'application/json' });
 *   yield* handle.append({ event: 'created', data: { ... } });
 * });
 * ```
 */

export * from './service';
export * from './schemas';
