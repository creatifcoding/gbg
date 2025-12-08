/**
 * Challenge 2: The Cancellable Feed
 *
 * TASK: Create a simulated real-time event feed with:
 *   1. Events emitted at random intervals (50-200ms)
 *   2. Proper cleanup when the stream is interrupted
 *   3. A "connected" log on start, "disconnected" log on end
 *
 * CONSTRAINTS:
 * - Use Stream.acquireRelease or Stream.ensuring for cleanup
 * - Use Stream.repeatEffectOption or similar for the event loop
 * - Randomize intervals using Effect.random
 *
 * BONUS: How does fiber interruption propagate through streams?
 *        What's the difference between Stream.ensuring and Stream.onDone?
 */

import { Stream, Effect, Console, Random, Duration, Schema, Fiber } from "effect"

// ============================================================================
// TYPES
// ============================================================================

class FeedEvent extends Schema.TaggedClass<FeedEvent>()("FeedEvent", {
  id: Schema.Number,
  timestamp: Schema.Number,
  value: Schema.String,
}) {}

// ============================================================================
// SOLUTION — The Beautiful Pattern
// ============================================================================

/**
 * Stream.unwrap: The Effect-to-Stream Bridge
 *
 * Pattern:
 *   Stream.unwrap(Effect that returns Stream) → Stream
 *
 * This lets you:
 *   1. Run setup logic (Effects)
 *   2. Return a Stream from that setup
 *   3. The returned Stream is what consumers see
 *
 * Combined with Stream.ensuring for teardown, you get:
 *   Setup (Effect) → Stream (infinite) → Teardown (on any termination)
 */
export const feed: Stream.Stream<FeedEvent> = Stream.unwrap(
  Effect.gen(function* () {
    // ═══════════════════════════════════════════════════════════
    // SETUP PHASE — runs once when stream is first consumed
    // ═══════════════════════════════════════════════════════════
    yield* Console.log("[feed] connected")

    // Closure state — lives for the lifetime of the stream
    let counter = 0

    // ═══════════════════════════════════════════════════════════
    // STREAM PHASE — the infinite event producer
    // ═══════════════════════════════════════════════════════════
    return Stream.repeatEffect(
      Effect.gen(function* () {
        // Random delay between events (50-200ms)
        const delay = yield* Random.nextIntBetween(50, 200)
        yield* Effect.sleep(Duration.millis(delay))

        // Generate event
        counter++
        return new FeedEvent({
          id: counter,
          timestamp: Date.now(),
          value: `event-${counter}`,
        })
      })
    ).pipe(
      // ═══════════════════════════════════════════════════════════
      // TEARDOWN PHASE — runs on success, failure, OR interruption
      // ═══════════════════════════════════════════════════════════
      Stream.ensuring(Console.log("[feed] disconnected"))
    )
  })
)

// ============================================================================
// ALTERNATIVE: Stream.acquireRelease (resource-oriented)
// ============================================================================

/**
 * If you have an actual resource (WebSocket, file handle, etc.),
 * use Stream.acquireRelease + Stream.flatMap:
 */
interface Connection {
  readonly id: string
  readonly createdAt: number
}
/**
 * A feed, like all Effects, are thunks. This is a declaration of a block scoped execution & it's context. Now you see why the generator exists. 
 * 
 */
export const feedWithResource: Stream.Stream<FeedEvent> = Stream.acquireRelease(
  // Acquire: create the resource
  Effect.gen(function* () {
    yield* Console.log("[feed] connecting...")
    const conn: Connection = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    }
    yield* Console.log(`[feed] connected (${conn.id})`)
    return conn
  }),
  // Release: cleanup the resource (runs on ANY termination)
  (conn) => Console.log(`[feed] disconnected (${conn.id})`)
).pipe(
  // flatMap: use the resource to produce events
  Stream.flatMap((conn) => {
    let counter = 0
    return Stream.repeatEffect(
      Effect.gen(function* () {
        const delay = yield* Random.nextIntBetween(50, 200)
        yield* Effect.sleep(Duration.millis(delay))
        counter++
        return new FeedEvent({
          id: counter,
          timestamp: Date.now(),
          value: `${conn.id.slice(0, 8)}-event-${counter}`,
        })
      })
    )
  })
)

// ============================================================================
// VALIDATION
// ============================================================================

export const runFeed = (durationMs: number = 1000) =>
  Effect.gen(function* () {
    yield* Console.log(`[test] Starting feed, will interrupt after ${durationMs}ms...`)

    const fiber = yield* feed.pipe(
      Stream.tap((event) => Console.log(`[event] #${event.id}: ${event.value}`)),
      Stream.runDrain,
      Effect.fork
    )

    yield* Effect.sleep(Duration.millis(durationMs))
    yield* Console.log("[test] Interrupting...")
    yield* Fiber.interrupt(fiber)
    yield* Console.log("[test] Done")
  })

// ============================================================================
// CRITIQUE & LEARNINGS
// ============================================================================

/**
 * ## Stream.unwrap vs Stream.acquireRelease + flatMap
 *
 * | Pattern                          | Use When                                    |
 * |----------------------------------|---------------------------------------------|
 * | `Stream.unwrap(Effect → Stream)` | Setup is effectful, no resource to release  |
 * | `Stream.acquireRelease + flatMap`| You have a resource with explicit lifecycle |
 *
 * ## Stream.ensuring vs Stream.onDone
 *
 * | Combinator         | Runs On                          | Use Case                |
 * |--------------------|----------------------------------|-------------------------|
 * | `Stream.ensuring`  | Success, failure, AND interruption | Cleanup that MUST happen |
 * | `Stream.onDone`    | Success or failure only          | Cleanup that can skip on cancel |
 *
 * For WebSocket/SSE cleanup, ALWAYS use `ensuring` — you want to close the
 * connection even if the user navigates away (interruption).
 *
 * ## Fiber Interruption in Streams
 *
 * When a fiber running a stream is interrupted:
 * 1. The stream's current Effect is interrupted
 * 2. All finalizers (ensuring, acquireRelease release) run
 * 3. The fiber completes with Exit.interrupt
 *
 * This is why `Stream.ensuring` is safe — it's guaranteed to run.
 *
 * ## The flatMap Mental Model
 *
 * `Stream.flatMap` is NOT a PITA once you see it as:
 *
 *   "For this resource/value, give me the stream that uses it"
 *
 * It's the same as Promise.then or Effect.flatMap:
 *   - Effect.flatMap: A → Effect<B>
 *   - Stream.flatMap: A → Stream<B>
 *
 * The acquire/release pattern REQUIRES flatMap because:
 *   1. acquireRelease emits the resource as a single element
 *   2. flatMap transforms that element into your actual stream
 *   3. When the inner stream ends, release runs
 */
