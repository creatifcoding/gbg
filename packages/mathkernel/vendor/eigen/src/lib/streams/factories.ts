/**
 * Stream Factories
 *
 * Production-ready stream primitives generalized from playground experiments.
 */

import { Stream, Effect, Schedule, Duration } from "effect"

// ============================================================================
// TICKER — Simple timestamp stream
// ============================================================================

export interface TickerOptions {
  /**
   * Emit immediately on subscription, or wait for first interval?
   * @default true
   */
  readonly immediate?: boolean
}

/**
 * Creates a Stream that emits timestamps at a fixed interval.
 *
 * @param interval - Duration between emissions (e.g., "1 second", "500 millis")
 * @param options - Configuration options
 * @returns Stream<number> of timestamps (Date.now() at emission time)
 *
 * @example
 * ```typescript
 * // Emit every second, starting immediately
 * const heartbeat = ticker("1 second")
 *
 * // Emit every 500ms, wait for first interval
 * const delayed = ticker("500 millis", { immediate: false })
 *
 * // Take 5 ticks
 * await Effect.runPromise(
 *   ticker("1 second").pipe(
 *     Stream.take(5),
 *     Stream.runCollect
 *   )
 * )
 * ```
 */
export const ticker = (
  interval: Duration.DurationInput,
  options: TickerOptions = {}
): Stream.Stream<number> => {
  const { immediate = true } = options

  if (immediate) {
    // Emit immediately, then every interval
    return Stream.make(0).pipe(
      Stream.repeat(Schedule.spaced(interval)),
      Stream.map(() => Date.now())
    )
  } else {
    // Wait for first interval before emitting
    return Stream.repeatEffect(Effect.sync(() => Date.now())).pipe(
      Stream.schedule(Schedule.spaced(interval))
    )
  }
}

// ============================================================================
// PULSE — Run any Effect on a schedule
// ============================================================================

export interface PulseOptions {
  /**
   * Emit immediately on subscription, or wait for first interval?
   * @default true
   */
  readonly immediate?: boolean
}

/**
 * Creates a Stream that runs an Effect at a fixed interval, emitting results.
 *
 * @param effect - The Effect to run on each pulse
 * @param interval - Duration between runs
 * @param options - Configuration options
 * @returns Stream<A, E, R> where A/E/R come from the provided Effect
 *
 * @example
 * ```typescript
 * // Poll an API every 5 seconds
 * const statusStream = pulse(
 *   fetchSystemStatus,
 *   "5 seconds"
 * )
 *
 * // Sample a sensor every 100ms, starting after first interval
 * const sensorStream = pulse(
 *   readSensorValue,
 *   "100 millis",
 *   { immediate: false }
 * )
 *
 * // With error handling
 * const resilientStream = pulse(
 *   Effect.retry(fetchData, { times: 3 }),
 *   "10 seconds"
 * )
 * ```
 */
export const pulse = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  interval: Duration.DurationInput,
  options: PulseOptions = {}
): Stream.Stream<A, E, R> => {
  const { immediate = true } = options

  if (immediate) {
    // Run immediately, then every interval
    return Stream.fromEffect(effect).pipe(
      Stream.repeat(Schedule.spaced(interval))
    )
  } else {
    // Wait for first interval before running
    return Stream.repeatEffect(effect).pipe(
      Stream.schedule(Schedule.spaced(interval))
    )
  }
}

// ============================================================================
// CONVENIENCE ALIASES
// ============================================================================

/**
 * Alias for `ticker("1 second")` — the canonical heartbeat.
 */
export const heartbeat: Stream.Stream<number> = ticker("1 second")

/**
 * Creates a ticker that emits incrementing counters instead of timestamps.
 *
 * @param interval - Duration between emissions
 * @returns Stream<number> of incrementing integers starting at 0
 *
 * @example
 * ```typescript
 * counter("1 second").pipe(Stream.take(5), Stream.runCollect)
 * // → Chunk(0, 1, 2, 3, 4)
 * ```
 */
export const counter = (
  interval: Duration.DurationInput
): Stream.Stream<number> =>
  ticker(interval).pipe(Stream.scan(0, (count, _) => count + 1))
