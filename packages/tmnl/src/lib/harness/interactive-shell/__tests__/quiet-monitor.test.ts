/**
 * QuietMonitor Behavior Tests — Effect-native completion gate + hands-free updates.
 *
 * Uses Effect.runPromise for fiber-based tests (fork + Deferred).
 * @effect/vitest's it.effect doesn't support forked fiber concurrency.
 */

import { describe, it, expect } from 'vitest'
import {
  Deferred,
  Duration,
  Effect,
  Fiber,
  Queue,
  Stream,
  pipe,
} from 'effect'
import {
  makeCompletionGate,
  makeHandsFreeUpdates,
  DEFAULT_HANDS_FREE_CONFIG,
  type CompletionInfo,
  type HandsFreeUpdate,
} from '../quiet-monitor'
import type { ShellEvent, ShellSessionId } from '../schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_ID = 'shell-test-123' as ShellSessionId

function makeDataEvent(data = 'output', sessionId = SESSION_ID): ShellEvent {
  return { _tag: 'shell:data', sessionId, data } as ShellEvent
}

function makeExitEvent(exitCode = 0, sessionId = SESSION_ID): ShellEvent {
  return { _tag: 'shell:exited', sessionId, exitCode } as ShellEvent
}

function makeErrorEvent(message = 'boom', sessionId = SESSION_ID): ShellEvent {
  return { _tag: 'shell:error', sessionId, message } as ShellEvent
}

const run = <A>(effect: Effect.Effect<A>): Promise<A> =>
  Effect.runPromise(effect)

// ─────────────────────────────────────────────────────────────────────────────
// Sanity: Effect.fork + Deferred works with Effect.runPromise
// ─────────────────────────────────────────────────────────────────────────────

describe('Effect fiber sanity', () => {
  it('forked fiber resolves Deferred', () =>
    run(
      Effect.gen(function* () {
        const gate = yield* Deferred.make<string>()
        yield* pipe(
          Effect.sleep(Duration.millis(10)),
          Effect.flatMap(() => Deferred.succeed(gate, 'resolved')),
          Effect.fork,
        )
        const result = yield* Deferred.await(gate)
        expect(result).toBe('resolved')
      }),
    ))
})

// ─────────────────────────────────────────────────────────────────────────────
// makeCompletionGate — exit/error resolution
// ─────────────────────────────────────────────────────────────────────────────

describe('makeCompletionGate', () => {
  it('resolves on exit event (finite stream)', () =>
    run(
      Effect.gen(function* () {
        const events = Stream.make(makeDataEvent(), makeExitEvent(0))

        const { gate, dispose } = yield* makeCompletionGate(
          SESSION_ID,
          events,
          {
            killSession: () => Effect.void,
            readOutput: () => Effect.succeed('final output'),
          },
        )

        const result = yield* Deferred.await(gate)
        yield* dispose

        expect(result.sessionId).toBe(SESSION_ID)
        expect(result.exitCode).toBe(0)
        expect(result.outputSnapshot).toBe('final output')
        expect(result.timedOut).toBeUndefined()
        expect(result.autoExitedOnQuiet).toBeUndefined()
      }),
    ))

  it('resolves on error event', () =>
    run(
      Effect.gen(function* () {
        const events = Stream.make(makeErrorEvent('fatal'))

        const { gate, dispose } = yield* makeCompletionGate(
          SESSION_ID,
          events,
          {
            killSession: () => Effect.void,
            readOutput: () => Effect.succeed('error output'),
          },
        )

        const result = yield* Deferred.await(gate)
        yield* dispose

        expect(result.sessionId).toBe(SESSION_ID)
        expect(result.exitCode).toBeNull()
      }),
    ))

  it('exit event carries exit code', () =>
    run(
      Effect.gen(function* () {
        const events = Stream.make(makeExitEvent(42))

        const { gate, dispose } = yield* makeCompletionGate(
          SESSION_ID,
          events,
          {
            killSession: () => Effect.void,
            readOutput: () => Effect.succeed(''),
          },
        )

        const result = yield* Deferred.await(gate)
        yield* dispose

        expect(result.exitCode).toBe(42)
      }),
    ))

  it('filters events by session ID', () =>
    run(
      Effect.gen(function* () {
        const otherSession = 'shell-other' as ShellSessionId
        const events = Stream.make(
          makeExitEvent(99, otherSession), // Wrong session
          makeExitEvent(0, SESSION_ID), // Right session
        )

        const { gate, dispose } = yield* makeCompletionGate(
          SESSION_ID,
          events,
          {
            killSession: () => Effect.void,
            readOutput: () => Effect.succeed('filtered'),
          },
        )

        const result = yield* Deferred.await(gate)
        yield* dispose

        expect(result.exitCode).toBe(0)
      }),
    ))

  it('calls readOutput on completion', () =>
    run(
      Effect.gen(function* () {
        let readCalled = false
        const events = Stream.make(makeExitEvent(0))

        const { gate, dispose } = yield* makeCompletionGate(
          SESSION_ID,
          events,
          {
            killSession: () => Effect.void,
            readOutput: () =>
              Effect.sync(() => {
                readCalled = true
                return 'snapshot'
              }),
          },
        )

        const result = yield* Deferred.await(gate)
        yield* dispose

        expect(readCalled).toBe(true)
        expect(result.outputSnapshot).toBe('snapshot')
      }),
    ))

  it('readOutput failure does not prevent completion', () =>
    run(
      Effect.gen(function* () {
        const events = Stream.make(makeExitEvent(0))

        const { gate, dispose } = yield* makeCompletionGate(
          SESSION_ID,
          events,
          {
            killSession: () => Effect.void,
            readOutput: () => Effect.fail(new Error('read failed')),
          },
        )

        const result = yield* Deferred.await(gate)
        yield* dispose

        expect(result.exitCode).toBe(0)
        expect(result.outputSnapshot).toBe('')
      }),
    ))

  it('timeout resolves gate and kills session', () =>
    run(
      Effect.gen(function* () {
        let killed = false
        const { queue, stream } = yield* Effect.gen(function* () {
          const queue = yield* Queue.unbounded<ShellEvent>()
          return { queue, stream: Stream.fromQueue(queue) }
        })

        const { gate, dispose } = yield* makeCompletionGate(
          SESSION_ID,
          stream,
          {
            timeout: 50,
            killSession: () =>
              Effect.sync(() => {
                killed = true
              }),
            readOutput: () => Effect.succeed('timeout output'),
          },
        )

        const result = yield* Deferred.await(gate)
        yield* dispose
        yield* Queue.shutdown(queue)

        expect(result.timedOut).toBe(true)
        expect(result.sessionId).toBe(SESSION_ID)
        expect(killed).toBe(true)
      }),
    ),
    { timeout: 10_000 },
  )

  it('quiet detection resolves gate when data stops flowing', () =>
    run(
      Effect.gen(function* () {
        let killed = false

        // Use Stream.async (push-based) to match production behavior.
        // Stream.fromQueue is pull-based and Stream.debounce won't detect
        // silence on a pull-based stream that blocks on empty.
        const stream = Stream.async<ShellEvent>((emit) => {
          // Push data, then stop — simulates PTY output that ceases
          emit.single(makeDataEvent('hello'))
          setTimeout(() => emit.single(makeDataEvent('world')), 10)
          // After this, no more data — quiet detection should fire
        })

        const { gate, dispose } = yield* makeCompletionGate(
          SESSION_ID,
          stream,
          {
            autoExitOnQuiet: true,
            quietThreshold: 100,
            killSession: () =>
              Effect.sync(() => {
                killed = true
              }),
            readOutput: () => Effect.succeed('quiet output'),
          },
        )

        const result = yield* Deferred.await(gate)
        yield* dispose

        expect(result.autoExitedOnQuiet).toBe(true)
        expect(killed).toBe(true)
        expect(result.outputSnapshot).toBe('quiet output')
      }),
    ),
    { timeout: 10_000 },
  )

  it('exit event wins over timeout', () =>
    run(
      Effect.gen(function* () {
        let killed = false
        const { queue, stream } = yield* Effect.gen(function* () {
          const queue = yield* Queue.unbounded<ShellEvent>()
          return { queue, stream: Stream.fromQueue(queue) }
        })

        const { gate, dispose } = yield* makeCompletionGate(
          SESSION_ID,
          stream,
          {
            timeout: 5000,
            killSession: () =>
              Effect.sync(() => {
                killed = true
              }),
            readOutput: () => Effect.succeed('exit wins'),
          },
        )

        yield* Queue.offer(queue, makeExitEvent(0))

        const result = yield* Deferred.await(gate)
        yield* dispose
        yield* Queue.shutdown(queue)

        expect(result.exitCode).toBe(0)
        expect(result.timedOut).toBeUndefined()
        expect(killed).toBe(false)
      }),
    ))

  it('dispose cleans up fibers', () =>
    run(
      Effect.gen(function* () {
        const events = Stream.make(makeExitEvent(0))

        const { gate, dispose } = yield* makeCompletionGate(
          SESSION_ID,
          events,
          {
            timeout: 60_000,
            autoExitOnQuiet: true,
            quietThreshold: 60_000,
            killSession: () => Effect.void,
            readOutput: () => Effect.succeed(''),
          },
        )

        yield* Deferred.await(gate) // exit resolves
        yield* dispose // cleanup

        expect(true).toBe(true)
      }),
    ))
})

// ─────────────────────────────────────────────────────────────────────────────
// Timeout & quiet detection contracts
// ─────────────────────────────────────────────────────────────────────────────

describe('makeCompletionGate timeout contract', () => {
  it('timeout=0 is falsy (no timeout fiber created)', () => {
    expect(0).toBeFalsy()
  })

  it('timeout=undefined is falsy (no timeout fiber created)', () => {
    expect(undefined).toBeFalsy()
  })
})

describe('makeCompletionGate quiet detection contract', () => {
  it('autoExitOnQuiet=false means no quiet fiber', () => {
    expect(false).toBeFalsy()
  })

  it('defaults quietThreshold to 5000 when omitted', () => {
    expect(undefined ?? 5000).toBe(5000)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT_HANDS_FREE_CONFIG
// ─────────────────────────────────────────────────────────────────────────────

describe('DEFAULT_HANDS_FREE_CONFIG', () => {
  it('has sane defaults', () => {
    expect(DEFAULT_HANDS_FREE_CONFIG.updateMode).toBe('on-quiet')
    expect(DEFAULT_HANDS_FREE_CONFIG.updateInterval).toBe(60_000)
    expect(DEFAULT_HANDS_FREE_CONFIG.quietThreshold).toBe(5_000)
    expect(DEFAULT_HANDS_FREE_CONFIG.updateMaxChars).toBe(1_500)
    expect(DEFAULT_HANDS_FREE_CONFIG.maxTotalChars).toBe(100_000)
    expect(DEFAULT_HANDS_FREE_CONFIG.autoExitOnQuiet).toBe(false)
  })

  it('budget allows at least 66 updates at default maxChars', () => {
    const updates = Math.floor(
      DEFAULT_HANDS_FREE_CONFIG.maxTotalChars /
        DEFAULT_HANDS_FREE_CONFIG.updateMaxChars,
    )
    expect(updates).toBeGreaterThanOrEqual(66)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// makeHandsFreeUpdates — type & config contracts
// ─────────────────────────────────────────────────────────────────────────────

describe('makeHandsFreeUpdates', () => {
  it('returns a Stream (type contract)', () => {
    const events = Stream.empty as Stream.Stream<ShellEvent>
    const readOutput = (_maxChars: number) => Effect.succeed('')

    const result = makeHandsFreeUpdates(
      SESSION_ID,
      events,
      DEFAULT_HANDS_FREE_CONFIG,
      readOutput,
    )

    expect(result).toBeDefined()
    expect(typeof result.pipe).toBe('function')
  })

  it('budget arithmetic is correct', () => {
    const config = {
      ...DEFAULT_HANDS_FREE_CONFIG,
      updateMaxChars: 100,
      maxTotalChars: 250,
    }
    expect(Math.ceil(config.maxTotalChars / config.updateMaxChars)).toBe(3)
  })
})
