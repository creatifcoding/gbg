/**
 * Challenge 5: Primitives Demo
 *
 * Demonstrates the expanded primitive library.
 */

import { Effect, Console, Stream, Chunk, pipe } from "effect"
import {
  ticker,
  counter,
  metronome,
  elapsed,
  backoff,
  stopwatch,
  buffer,
  throttle,
} from "../primitives"

// ============================================================================
// DEMO
// ============================================================================

export const runPrimitivesDemo = Effect.gen(function* () {
  yield* Console.log("═".repeat(60))
  yield* Console.log("  Stream Primitives Demo")
  yield* Console.log("═".repeat(60))

  // ── Metronome (BPM-based ticker) ──────────────────────────────────────────
  yield* Console.log("\n[1] Metronome @ 120 BPM (4 beats):")
  yield* metronome(120).pipe(
    Stream.take(4),
    Stream.tap((beat) => Console.log(`  🥁 Beat ${beat}`)),
    Stream.runDrain
  )

  // ── Elapsed Timer ─────────────────────────────────────────────────────────
  yield* Console.log("\n[2] Elapsed timer (5 ticks @ 100ms):")
  yield* elapsed("100 millis").pipe(
    Stream.take(5),
    Stream.tap((ms) => Console.log(`  ⏱️  ${ms}ms elapsed`)),
    Stream.runDrain
  )

  // ── Backoff Ticker ────────────────────────────────────────────────────────
  yield* Console.log("\n[3] Exponential backoff (100ms → 2x, cap 1s):")
  yield* backoff("100 millis", { factor: 2, max: "1 second" }).pipe(
    Stream.take(5),
    Stream.zipWithIndex,
    Stream.tap(([ts, i]) => Console.log(`  📈 Tick ${i}: interval doubled`)),
    Stream.runDrain
  )

  // ── Buffer (time window batching) ─────────────────────────────────────────
  yield* Console.log("\n[4] Buffer: batch counter into 300ms windows:")
  yield* counter("50 millis").pipe(
    Stream.take(12),
    buffer("300 millis"),
    Stream.tap((chunk) => Console.log(`  📦 Batch: [${Chunk.toReadonlyArray(chunk).join(", ")}]`)),
    Stream.runDrain
  )

  // ── Stopwatch ─────────────────────────────────────────────────────────────
  yield* Console.log("\n[5] Stopwatch demo:")
  const sw = stopwatch("100 millis")

  yield* Console.log("  Starting stopwatch...")
  yield* sw.start

  // Run for 300ms
  yield* sw.stream.pipe(
    Stream.take(3),
    Stream.tap((e) => Console.log(`  ⏱️  ${e.elapsed}ms (running: ${e.running})`)),
    Stream.runDrain
  )

  yield* Console.log("  Recording lap...")
  const lap = yield* sw.lap
  yield* Console.log(`  🏁 Lap ${lap.lap}: ${lap.elapsed}ms`)

  yield* Console.log("  Stopping stopwatch...")
  yield* sw.stop

  const finalLap = yield* sw.lap
  yield* Console.log(`  Final: ${finalLap.elapsed}ms`)

  // ── Throttle ──────────────────────────────────────────────────────────────
  yield* Console.log("\n[6] Throttle: 10 fast ticks → throttled to 200ms:")
  yield* ticker("20 millis").pipe(
    Stream.take(10),
    throttle("200 millis"),
    Stream.zipWithIndex,
    Stream.tap(([ts, i]) => Console.log(`  🚦 Throttled tick ${i}`)),
    Stream.runDrain
  )

  yield* Console.log("\n[Demo] Done!")
})

// ============================================================================
// RUNNER
// ============================================================================

export const runChallenge5 = () => Effect.runPromise(runPrimitivesDemo)
