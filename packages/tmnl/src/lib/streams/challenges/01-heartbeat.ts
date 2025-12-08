/**
 * Challenge 1: The Heartbeat
 *
 * TASK: Create a Stream that emits a timestamp every second, forever.
 *
 * CONSTRAINTS:
 * - Use Stream.repeat or Stream.schedule (your choice)
 * - Timestamp should be Date.now() at emission time, not stream creation time
 *
 * BONUS: What's the difference between Stream.repeat and Stream.schedule?
 *        When would you choose one over the other?
 */

import { Stream, Effect, Schedule, Console } from "effect"

// ============================================================================
// SOLUTION
// ============================================================================

export const heartbeat: Stream.Stream<number> = Stream.make(0).pipe(
  Stream.repeat(Schedule.spaced("1 second")),
  Stream.map(() => Date.now())
)

// ============================================================================
// ALTERNATIVE IDIOM
// ============================================================================

/**
 * More direct path using Stream.repeatEffect + Stream.schedule:
 *
 * Stream.repeatEffect runs the Effect forever (no schedule needed).
 * Stream.schedule then throttles the output.
 */
export const heartbeat2: Stream.Stream<number> = Stream.repeatEffect(
  Effect.sync(() => Date.now())
).pipe(Stream.schedule(Schedule.spaced("1 second")))

// ============================================================================
// VALIDATION
// ============================================================================

export const runHeartbeat = (count: number = 5) =>
  heartbeat.pipe(
    Stream.take(count),
    Stream.runForEach((ts) => Console.log(`[heartbeat] ${ts} → ${new Date(ts).toISOString()}`))
  )

// ============================================================================
// CRITIQUE & LEARNINGS
// ============================================================================

/**
 * ## What Prime Got Right
 *
 * 1. **Lazy timestamp** — `Stream.map(() => Date.now())` evaluates at emission
 *    time, not stream creation time. This is critical.
 *
 * 2. **Schedule composition** — `Schedule.spaced("1 second")` is idiomatic Effect.
 *
 * 3. **Stream.repeat** — Correct mental model: "restart this finite stream
 *    forever, with this timing between restarts."
 *
 * ## The Subtle Bug Avoided
 *
 * Many people write this (WRONG):
 *
 * ```typescript
 * const ts = Date.now() // Captured once!
 * Stream.repeat(Stream.succeed(ts), Schedule.spaced("1 second"))
 * ```
 *
 * This emits the same timestamp forever. Prime avoided this by mapping
 * *after* the repeat, ensuring fresh evaluation.
 *
 * ## Stream.repeat vs Stream.schedule — Sharp Edge
 *
 * | Aspect          | Stream.repeat                          | Stream.schedule                        |
 * |-----------------|----------------------------------------|----------------------------------------|
 * | **Input**       | Finite stream                          | Any stream                             |
 * | **Output**      | Stream elements (repeated)             | Schedule decision outputs              |
 * | **Timing**      | Delay *between* stream restarts        | Delay *between* element emissions      |
 * | **Use when**    | You want the *same sequence* again     | You want to *throttle/debounce/sample* |
 *
 * ## Semantic Difference: heartbeat vs heartbeat2
 *
 * **heartbeat (repeat + map):**
 * - Stream.make(0) emits immediately
 * - Schedule.spaced delays 1s *after* each completion
 * - First emission: immediate (0ms)
 *
 * **heartbeat2 (repeatEffect + schedule):**
 * - Stream.repeatEffect runs Effect.sync immediately
 * - Stream.schedule delays 1s *before* emitting each element
 * - First emission: after 1s delay
 *
 * This is subtle but important for real-time feeds where "emit now, then
 * every N seconds" differs from "emit every N seconds starting in N seconds."
 *
 * ## Production Generalization
 *
 * See `./factories.ts` for:
 * - `ticker(interval)` → Stream<number> — simple timestamp stream
 * - `pulse(effect, interval)` → Stream<A> — run any Effect on schedule
 */
