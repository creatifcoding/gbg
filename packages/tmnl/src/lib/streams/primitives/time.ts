/**
 * Time-Based Stream Primitives
 *
 * Streams that emit values based on time intervals, schedules, or delays.
 */

import { Stream, Effect, Schedule, Duration, Option, Chunk, pipe, Sink } from "effect"

// ============================================================================
// TICKER — Emit timestamps at intervals
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
 * @example
 * ```typescript
 * // Emit every second, starting immediately
 * const heartbeat = ticker("1 second")
 *
 * // Emit every 500ms, wait for first interval
 * const delayed = ticker("500 millis", { immediate: false })
 * ```
 */
export const ticker = (
  interval: Duration.DurationInput,
  options: TickerOptions = {}
): Stream.Stream<number> => {
  const { immediate = true } = options

  if (immediate) {
    return Stream.make(0).pipe(
      Stream.repeat(Schedule.spaced(interval)),
      Stream.map(() => Date.now())
    )
  } else {
    return Stream.repeatEffect(Effect.sync(() => Date.now())).pipe(
      Stream.schedule(Schedule.spaced(interval))
    )
  }
}

// ============================================================================
// PULSE — Run an Effect at intervals
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
 * @example
 * ```typescript
 * // Poll an API every 5 seconds
 * const statusStream = pulse(fetchSystemStatus, "5 seconds")
 *
 * // Sample a sensor every 100ms, starting after first interval
 * const sensorStream = pulse(readSensor, "100 millis", { immediate: false })
 * ```
 */
export const pulse = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  interval: Duration.DurationInput,
  options: PulseOptions = {}
): Stream.Stream<A, E, R> => {
  const { immediate = true } = options

  if (immediate) {
    return Stream.fromEffect(effect).pipe(
      Stream.repeat(Schedule.spaced(interval))
    )
  } else {
    return Stream.repeatEffect(effect).pipe(
      Stream.schedule(Schedule.spaced(interval))
    )
  }
}

// ============================================================================
// COUNTER — Emit incrementing integers
// ============================================================================

/**
 * Creates a Stream that emits incrementing integers at a fixed interval.
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

// ============================================================================
// HEARTBEAT — Canonical 1-second ticker
// ============================================================================

/**
 * Alias for `ticker("1 second")` — the canonical heartbeat.
 */
export const heartbeat: Stream.Stream<number> = ticker("1 second")

// ============================================================================
// METRONOME — Emit at precise BPM
// ============================================================================

/**
 * Creates a Stream that emits at a specific beats-per-minute rate.
 * Useful for audio/music applications.
 *
 * @param bpm - Beats per minute (e.g., 120 for 2 beats/second)
 * @returns Stream that emits beat numbers (0, 1, 2, ...)
 *
 * @example
 * ```typescript
 * // 120 BPM metronome
 * const beats = metronome(120)
 *
 * // Emit for 4 bars of 4/4 at 90 BPM
 * const fourBars = metronome(90).pipe(Stream.take(16))
 * ```
 */
export const metronome = (bpm: number): Stream.Stream<number> => {
  const msPerBeat = Math.floor(60000 / bpm)
  return counter(Duration.millis(msPerBeat))
}

// ============================================================================
// DELAY — Delay emissions by a duration
// ============================================================================

/**
 * Delays each element in a stream by a fixed duration.
 *
 * @example
 * ```typescript
 * const delayed = someStream.pipe(delay("500 millis"))
 * ```
 */
export const delay = <A, E, R>(
  duration: Duration.DurationInput
) => (stream: Stream.Stream<A, E, R>): Stream.Stream<A, E, R> =>
  stream.pipe(
    Stream.mapEffect((a) =>
      Effect.delay(Effect.succeed(a), duration)
    )
  )

// ============================================================================
// DEBOUNCE — Emit only after silence
// ============================================================================

/**
 * Debounces a stream — only emits after the specified duration of silence.
 * Useful for search-as-you-type, window resize handlers, etc.
 *
 * @param duration - How long to wait after last emission
 * @returns Stream that emits only after silence
 *
 * @example
 * ```typescript
 * // Only emit search query after 300ms of no typing
 * const debouncedSearch = keystrokes.pipe(debounce("300 millis"))
 * ```
 */
export const debounce = <A, E, R>(
  duration: Duration.DurationInput
) => (stream: Stream.Stream<A, E, R>): Stream.Stream<A, E, R> =>
  Stream.debounce(stream, duration)

// ============================================================================
// THROTTLE — Rate-limit emissions
// ============================================================================

/**
 * Throttles a stream — emits at most one value per duration.
 * Takes the FIRST value in each window (leading edge).
 *
 * @param duration - Minimum time between emissions
 * @returns Throttled stream
 *
 * @example
 * ```typescript
 * // At most one scroll event per 100ms
 * const throttledScroll = scrollEvents.pipe(throttle("100 millis"))
 * ```
 */
export const throttle = <A, E, R>(
  duration: Duration.DurationInput
) => (stream: Stream.Stream<A, E, R>): Stream.Stream<A, E, R> =>
  Stream.throttle(stream, {
    cost: () => 1,
    units: 1,
    duration,
    strategy: "enforce",
  })

// ============================================================================
// SAMPLE — Sample stream at intervals
// ============================================================================

/**
 * Samples a stream at fixed intervals, emitting the most recent value.
 * If no value has been emitted since last sample, emits None.
 *
 * @param interval - How often to sample
 * @returns Stream of Option<A> (Some if value available, None otherwise)
 *
 * @example
 * ```typescript
 * // Sample mouse position every 100ms
 * const sampledPosition = mouseMove.pipe(sample("100 millis"))
 * ```
 */
export const sample = <A, E, R>(
  interval: Duration.DurationInput
) => (stream: Stream.Stream<A, E, R>): Stream.Stream<Option.Option<A>, E, R> =>
  pipe(
    Stream.zipLatest(
      stream.pipe(Stream.map(Option.some)),
      ticker(interval).pipe(Stream.map(() => Option.none<A>()))
    ),
    Stream.map(([latest, _tick]) => latest)
  )

// ============================================================================
// BUFFER — Collect elements over time windows
// ============================================================================

/**
 * Buffers elements over fixed time windows, emitting chunks.
 *
 * @param duration - Window duration
 * @returns Stream of Chunks (one per window)
 *
 * @example
 * ```typescript
 * // Batch events into 1-second windows
 * const batched = events.pipe(buffer("1 second"))
 * // Emits: Chunk([e1, e2, e3]), Chunk([e4, e5]), ...
 * ```
 */
export const buffer = <A, E, R>(
  duration: Duration.DurationInput
) => (stream: Stream.Stream<A, E, R>): Stream.Stream<Chunk.Chunk<A>, E, R> =>
  Stream.aggregateWithin(
    stream,
    Sink.collectAll<A>(),
    Schedule.spaced(duration)
  )

// ============================================================================
// TIMEOUT — Fail if no emission within duration
// ============================================================================

/**
 * Fails the stream if no element is emitted within the specified duration.
 *
 * @param duration - Maximum time to wait for next element
 * @returns Stream that fails with TimeoutException on timeout
 *
 * @example
 * ```typescript
 * // Fail if no heartbeat within 5 seconds
 * const monitored = heartbeat.pipe(timeout("5 seconds"))
 * ```
 */
export const timeout = <A, E, R>(
  duration: Duration.DurationInput
) => (stream: Stream.Stream<A, E, R>): Stream.Stream<A, E | Error, R> =>
  stream.pipe(
    Stream.timeoutFail(() => new Error(`Stream timeout after ${duration}`), duration)
  )

// ============================================================================
// ELAPSED — Emit time elapsed since stream start
// ============================================================================

/**
 * Creates a Stream that emits the elapsed time since subscription.
 *
 * @param interval - How often to emit
 * @returns Stream of elapsed milliseconds
 *
 * @example
 * ```typescript
 * elapsed("100 millis").pipe(Stream.take(10), Stream.runCollect)
 * // → Chunk(0, 100, 200, 300, ...)
 * ```
 */
export const elapsed = (
  interval: Duration.DurationInput
): Stream.Stream<number> =>
  Stream.unwrap(
    Effect.sync(() => {
      const start = Date.now()
      return ticker(interval).pipe(
        Stream.map(() => Date.now() - start)
      )
    })
  )

// ============================================================================
// STOPWATCH — Start/stop timer
// ============================================================================

export interface StopwatchEvent {
  readonly elapsed: number
  readonly running: boolean
  readonly lap?: number
}

/**
 * Creates a stopwatch stream that can be controlled via signals.
 * Emits elapsed time while running, pauses when stopped.
 *
 * @param interval - Update frequency while running
 * @returns Object with stream and control functions
 *
 * @example
 * ```typescript
 * const sw = stopwatch("100 millis")
 * yield* sw.start()
 * // ... later
 * yield* sw.lap()  // Record lap time
 * yield* sw.stop()
 * ```
 */
export const stopwatch = (interval: Duration.DurationInput) => {
  let running = false
  let startTime = 0
  let accumulatedTime = 0
  let lapCount = 0

  const stream: Stream.Stream<StopwatchEvent> = ticker(interval, { immediate: true }).pipe(
    Stream.map(() => {
      if (running) {
        const elapsed = accumulatedTime + (Date.now() - startTime)
        return { elapsed, running: true }
      } else {
        return { elapsed: accumulatedTime, running: false }
      }
    })
  )

  return {
    stream,
    start: Effect.sync(() => {
      if (!running) {
        running = true
        startTime = Date.now()
      }
    }),
    stop: Effect.sync(() => {
      if (running) {
        accumulatedTime += Date.now() - startTime
        running = false
      }
    }),
    reset: Effect.sync(() => {
      running = false
      startTime = 0
      accumulatedTime = 0
      lapCount = 0
    }),
    lap: Effect.sync(() => {
      lapCount++
      return { lap: lapCount, elapsed: accumulatedTime + (running ? Date.now() - startTime : 0) }
    }),
  }
}

// ============================================================================
// BACKOFF — Exponential backoff ticker
// ============================================================================

/**
 * Creates a ticker with exponential backoff intervals.
 * Useful for retry logic, polling with increasing delays.
 *
 * @param initial - Initial interval
 * @param factor - Multiplier for each subsequent interval (default: 2)
 * @param max - Maximum interval (caps the backoff)
 * @returns Stream that emits with increasing delays
 *
 * @example
 * ```typescript
 * // Start at 100ms, double each time, cap at 10s
 * const retryTicker = backoff("100 millis", { factor: 2, max: "10 seconds" })
 * ```
 */
export const backoff = (
  initial: Duration.DurationInput,
  options: { factor?: number; max?: Duration.DurationInput } = {}
): Stream.Stream<number> => {
  const { factor = 2, max } = options
  const initialMs = Duration.toMillis(Duration.decode(initial))
  const maxMs = max ? Duration.toMillis(Duration.decode(max)) : Infinity

  return Stream.unfold(initialMs, (currentMs) => {
    const nextMs = Math.min(currentMs * factor, maxMs)
    return Option.some([currentMs, nextMs] as const)
  }).pipe(
    Stream.mapEffect((ms) =>
      Effect.delay(Effect.succeed(Date.now()), Duration.millis(ms))
    )
  )
}
