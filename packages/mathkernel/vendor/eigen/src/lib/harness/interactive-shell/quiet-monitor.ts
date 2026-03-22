/**
 * QuietMonitor — Effect-native session lifecycle monitor.
 *
 * Replaces pi extension's imperative HeadlessDispatchMonitor with:
 *   - Stream.debounce for quiet detection (not setTimeout + reset)
 *   - Deferred for completion signaling (not callback arrays)
 *   - Schedule.spaced for periodic hands-free updates (not setInterval)
 *   - Scope-based cleanup (not manual dispose)
 *
 * Two modes:
 *   hands-free: Periodic updates + optional auto-exit on quiet
 *   dispatch:   Fire-and-forget, Deferred resolves on exit/quiet/timeout
 *
 * @module harness/interactive-shell/quiet-monitor
 */

import { Deferred, Duration, Effect, Fiber, Schedule, Stream, pipe } from 'effect'
import type { ShellSessionId, ShellEvent, ShellSessionInfo } from './schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HandsFreeConfig {
  /** 'on-quiet' (emit when output stops) or 'interval' (fixed schedule). @default 'on-quiet' */
  readonly updateMode: 'on-quiet' | 'interval'
  /** Max interval between updates in ms. @default 60000 */
  readonly updateInterval: number
  /** Silence duration before emitting in on-quiet mode (ms). @default 5000 */
  readonly quietThreshold: number
  /** Max chars per update. @default 1500 */
  readonly updateMaxChars: number
  /** Total char budget for all updates. @default 100000 */
  readonly maxTotalChars: number
  /** Auto-kill session when output stops. @default false */
  readonly autoExitOnQuiet: boolean
}

export const DEFAULT_HANDS_FREE_CONFIG: HandsFreeConfig = {
  updateMode: 'on-quiet',
  updateInterval: 60_000,
  quietThreshold: 5_000,
  updateMaxChars: 1_500,
  maxTotalChars: 100_000,
  autoExitOnQuiet: false,
}

export interface CompletionInfo {
  readonly sessionId: ShellSessionId
  readonly exitCode: number | null
  readonly signal?: number
  readonly timedOut?: boolean
  readonly autoExitedOnQuiet?: boolean
  readonly outputSnapshot?: string
}

export interface HandsFreeUpdate {
  readonly sessionId: ShellSessionId
  readonly output: string
  readonly totalCharsEmitted: number
  readonly budgetRemaining: number
}

// ─────────────────────────────────────────────────────────────────────────────
// QuietMonitor — monitors a session's event stream for quiet/exit/timeout
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a Deferred-based completion gate for a session.
 *
 * Watches the session's event stream and resolves when:
 *   - Process exits (shell:exited)
 *   - Process errors (shell:error)
 *   - Quiet threshold exceeded + autoExitOnQuiet (kills process)
 *   - Timeout exceeded (kills process)
 *
 * Returns an Effect that creates the monitor fiber + Deferred.
 */
export const makeCompletionGate = (
  sessionId: ShellSessionId,
  events: Stream.Stream<ShellEvent>,
  options: {
    autoExitOnQuiet?: boolean
    quietThreshold?: number
    timeout?: number
    killSession: () => Effect.Effect<void>
    readOutput: () => Effect.Effect<string>
  },
) =>
  Effect.gen(function* () {
    const gate = yield* Deferred.make<CompletionInfo>()

    const sessionEvents = pipe(
      events,
      Stream.filter((e) =>
        'sessionId' in e
          ? (e as { sessionId: string }).sessionId === (sessionId as string)
          : false,
      ),
    )

    // Exit/error watcher
    const exitFiber = yield* pipe(
      sessionEvents,
      Stream.filter(
        (e): e is Extract<ShellEvent, { _tag: 'shell:exited' | 'shell:error' }> =>
          e._tag === 'shell:exited' || e._tag === 'shell:error',
      ),
      Stream.take(1),
      Stream.runForEach((event) =>
        Effect.gen(function* () {
          const output = yield* options.readOutput().pipe(Effect.orElseSucceed(() => ''))
          yield* Deferred.succeed(gate, {
            sessionId,
            exitCode: event._tag === 'shell:exited' ? event.exitCode : null,
            outputSnapshot: output,
          })
        }),
      ),
      Effect.fork,
    )

    // Quiet detection (Stream.debounce on data events)
    let quietFiber: Fiber.RuntimeFiber<void, never> | null = null
    if (options.autoExitOnQuiet) {
      const threshold = options.quietThreshold ?? 5000
      const dataEvents = pipe(
        sessionEvents,
        Stream.filter((e) => e._tag === 'shell:data'),
      )

      // Stream.debounce emits only when data stops for `threshold` ms
      quietFiber = yield* pipe(
        dataEvents,
        Stream.debounce(Duration.millis(threshold)),
        Stream.take(1),
        Stream.runForEach(() =>
          Effect.gen(function* () {
            yield* options.killSession()
            const output = yield* options.readOutput().pipe(Effect.orElseSucceed(() => ''))
            yield* Deferred.succeed(gate, {
              sessionId,
              exitCode: null,
              autoExitedOnQuiet: true,
              outputSnapshot: output,
            })
          }),
        ),
        Effect.fork,
      )
    }

    // Timeout
    let timeoutFiber: Fiber.RuntimeFiber<void, never> | null = null
    if (options.timeout && options.timeout > 0) {
      timeoutFiber = yield* pipe(
        Effect.sleep(Duration.millis(options.timeout)),
        Effect.flatMap(() =>
          Effect.gen(function* () {
            yield* options.killSession()
            const output = yield* options.readOutput().pipe(Effect.orElseSucceed(() => ''))
            yield* Deferred.succeed(gate, {
              sessionId,
              exitCode: null,
              timedOut: true,
              outputSnapshot: output,
            })
          }),
        ),
        Effect.fork,
      )
    }

    // Cleanup helper
    const dispose = Effect.gen(function* () {
      yield* Fiber.interrupt(exitFiber)
      if (quietFiber) yield* Fiber.interrupt(quietFiber)
      if (timeoutFiber) yield* Fiber.interrupt(timeoutFiber)
    })

    return { gate, dispose }
  })

// ─────────────────────────────────────────────────────────────────────────────
// Hands-Free Update Stream
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a stream of periodic updates for hands-free mode.
 *
 * In 'on-quiet' mode: emits when output pauses for quietThreshold ms.
 * In 'interval' mode: emits on fixed schedule.
 *
 * Stream ends when:
 *   - Total char budget exhausted
 *   - Session exits (detected via completion gate)
 *   - Scope closed (fiber interrupted)
 */
export const makeHandsFreeUpdates = (
  sessionId: ShellSessionId,
  events: Stream.Stream<ShellEvent>,
  config: HandsFreeConfig,
  readOutput: (maxChars: number) => Effect.Effect<string>,
): Stream.Stream<HandsFreeUpdate> => {
  let totalCharsEmitted = 0

  const sessionDataEvents = pipe(
    events,
    Stream.filter(
      (e) =>
        e._tag === 'shell:data' &&
        'sessionId' in e &&
        (e as { sessionId: string }).sessionId === (sessionId as string),
    ),
  )

  const triggerStream =
    config.updateMode === 'on-quiet'
      ? pipe(
          sessionDataEvents,
          Stream.debounce(Duration.millis(config.quietThreshold)),
        )
      : Stream.fromSchedule(Schedule.spaced(Duration.millis(config.updateInterval)))

  return pipe(
    triggerStream,
    Stream.mapEffect(() =>
      Effect.gen(function* () {
        const budgetRemaining = config.maxTotalChars - totalCharsEmitted
        if (budgetRemaining <= 0) return null

        const maxChars = Math.min(config.updateMaxChars, budgetRemaining)
        const output = yield* readOutput(maxChars).pipe(
          Effect.orElseSucceed(() => ''),
        )
        totalCharsEmitted += output.length

        return {
          sessionId,
          output,
          totalCharsEmitted,
          budgetRemaining: config.maxTotalChars - totalCharsEmitted,
        } satisfies HandsFreeUpdate
      }),
    ),
    Stream.filter((u): u is HandsFreeUpdate => u !== null),
    Stream.takeWhile((u) => u.budgetRemaining > 0),
  )
}
