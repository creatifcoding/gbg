/**
 * Connection Ports Hooks - Unit Tests
 *
 * Tests the effect-atom Result pattern and Registry-based atom access.
 *
 * @module connection-ports/__tests__/hooks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Effect, Stream, Chunk, Schema, Cause } from 'effect'
import * as Atom from '@effect-atom/atom/Atom'
import * as Registry from '@effect-atom/atom/Registry'
import * as Result from '@effect-atom/atom/Result'

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Wait for a condition with timeout.
 */
const waitFor = async (
  condition: () => boolean,
  { timeout = 2000, interval = 10 }: { timeout?: number; interval?: number } = {}
): Promise<void> => {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error(`waitFor timed out after ${timeout}ms`)
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}

// =============================================================================
// RESULT PATTERN TESTS
// =============================================================================

describe('Result Pattern', () => {
  describe('Result states', () => {
    it('Initial state has correct shape', () => {
      const initial = Result.initial<number, Error>(false)

      expect(Result.isInitial(initial)).toBe(true)
      expect(Result.isSuccess(initial)).toBe(false)
      expect(Result.isFailure(initial)).toBe(false)
      expect(Result.isWaiting(initial)).toBe(false)
    })

    it('Initial with waiting flag', () => {
      const waiting = Result.initial<number, Error>(true)

      expect(Result.isInitial(waiting)).toBe(true)
      expect(Result.isWaiting(waiting)).toBe(true)
    })

    it('Success state has correct shape', () => {
      const success = Result.success([1, 2, 3])

      expect(Result.isSuccess(success)).toBe(true)
      expect(Result.isInitial(success)).toBe(false)
      expect(Result.isFailure(success)).toBe(false)
    })

    it('Failure state has correct shape', () => {
      const failure = Result.failure<number[], Error>(Cause.fail(new Error('test error')))

      expect(Result.isFailure(failure)).toBe(true)
      expect(Result.isSuccess(failure)).toBe(false)
      expect(Result.isInitial(failure)).toBe(false)
    })

    it('Waiting wraps success with waiting flag', () => {
      const success = Result.success([1, 2, 3])
      const waiting = Result.waiting(success)

      expect(Result.isWaiting(waiting)).toBe(true)
      expect(Result.isSuccess(waiting)).toBe(true) // still a success, just waiting
    })
  })

  describe('Result.match pattern', () => {
    it('matches Initial state', () => {
      const result = Result.initial<number, Error>(false)

      const matcher = Result.match({
        onInitial: () => 'loading',
        onSuccess: (s) => `data: ${s.value}`,
        onFailure: () => 'error',
      })

      expect(matcher(result)).toBe('loading')
    })

    it('matches Success state', () => {
      const result = Result.success(42)

      const matcher = Result.match({
        onInitial: () => 'loading',
        onSuccess: (s) => `data: ${s.value}`,
        onFailure: () => 'error',
      })

      expect(matcher(result)).toBe('data: 42')
    })

    it('matches Failure state', () => {
      const result = Result.failure<number, Error>(Cause.fail(new Error('test')))

      const matcher = Result.match({
        onInitial: () => 'loading',
        onSuccess: (s) => 'success',
        onFailure: () => 'error',
      })

      expect(matcher(result)).toBe('error')
    })
  })
})

// =============================================================================
// REGISTRY-BASED ATOM TESTS
// =============================================================================

describe('Registry-based Atoms', () => {
  describe('Basic atom operations', () => {
    it('get/set with Registry', () => {
      const counter = Atom.make(0)
      const r = Registry.make()

      expect(r.get(counter)).toBe(0)
      r.set(counter, 1)
      expect(r.get(counter)).toBe(1)
    })

    it('derived atoms compute from source', () => {
      const data = Atom.make<readonly number[]>([])
      const count = Atom.make((get) => get(data).length)

      const r = Registry.make()

      expect(r.get(count)).toBe(0)

      r.set(data, [1, 2, 3])
      expect(r.get(count)).toBe(3)
    })

    it('subscribe notifies on changes', () => {
      const counter = Atom.make(0)
      const r = Registry.make()

      const values: number[] = []
      const unsubscribe = r.subscribe(counter, (value) => {
        values.push(value)
      })

      r.set(counter, 1)
      r.set(counter, 2)
      r.set(counter, 3)

      expect(values).toEqual([1, 2, 3])

      unsubscribe()
    })
  })

  describe('keepAlive behavior', () => {
    it('non-keepAlive atoms reset when not subscribed', async () => {
      const counter = Atom.make(0)
      const r = Registry.make()

      r.set(counter, 5)
      expect(r.get(counter)).toBe(5)

      // Allow gc to run
      await new Promise((resolve) => resolve(null))

      // Value should be reset to initial
      expect(r.get(counter)).toBe(0)
    })

    it('keepAlive atoms persist value', async () => {
      const counter = Atom.make(0).pipe(Atom.keepAlive)
      const r = Registry.make()

      r.set(counter, 5)
      expect(r.get(counter)).toBe(5)

      // Allow gc to run
      await new Promise((resolve) => resolve(null))

      // Value should persist
      expect(r.get(counter)).toBe(5)
    })
  })
})

// =============================================================================
// STREAM ATOM TESTS
// =============================================================================

describe('Stream Atoms', () => {
  describe('Basic stream to atom', () => {
    it('accumulates stream values', async () => {
      const r = Registry.make()

      // Create atoms for stream state
      const data = Atom.make<readonly number[]>([]).pipe(Atom.keepAlive)
      const status = Atom.make<'idle' | 'running' | 'done'>('idle').pipe(Atom.keepAlive)

      // Subscribe to keep atoms alive
      r.subscribe(data, () => {})
      r.subscribe(status, () => {})

      // Simulate stream processing
      r.set(status, 'running')

      const testStream = Stream.fromIterable([1, 2, 3, 4, 5])

      await Effect.runPromise(
        Stream.runForEach(testStream, (value) =>
          Effect.sync(() => {
            const current = r.get(data)
            r.set(data, [...current, value])
          })
        )
      )

      r.set(status, 'done')

      expect(r.get(data)).toEqual([1, 2, 3, 4, 5])
      expect(r.get(status)).toBe('done')
    })

    it('handles empty streams', async () => {
      const r = Registry.make()

      const data = Atom.make<readonly number[]>([]).pipe(Atom.keepAlive)
      r.subscribe(data, () => {})

      const emptyStream = Stream.empty

      await Effect.runPromise(
        Stream.runForEach(emptyStream, (value: number) =>
          Effect.sync(() => {
            const current = r.get(data)
            r.set(data, [...current, value])
          })
        )
      )

      expect(r.get(data)).toEqual([])
    })

    it('handles stream errors via Result', async () => {
      const r = Registry.make()

      const result = Atom.make<Result.Result<number[], Error>>(Result.initial(false)).pipe(
        Atom.keepAlive
      )
      r.subscribe(result, () => {})

      const failingStream = Stream.fail(new Error('test error'))

      await Effect.runPromise(
        Effect.gen(function* () {
          r.set(result, Result.initial(true)) // waiting

          yield* Stream.runForEach(
            failingStream as Stream.Stream<number, Error>,
            () => Effect.void
          ).pipe(
            Effect.catchAll((error) =>
              Effect.sync(() => {
                r.set(result, Result.failure(Cause.fail(error)))
              })
            )
          )
        })
      )

      const finalResult = r.get(result)
      expect(Result.isFailure(finalResult)).toBe(true)
    })
  })
})

// =============================================================================
// HIGH-THROUGHPUT TESTS
// =============================================================================

describe('High-Throughput Stream Handling', () => {
  it('handles 1000 events without data loss', async () => {
    const r = Registry.make()

    const data = Atom.make<readonly number[]>([]).pipe(Atom.keepAlive)
    const count = Atom.make(0).pipe(Atom.keepAlive)

    r.subscribe(data, () => {})
    r.subscribe(count, () => {})

    const eventCount = 1000
    const fastStream = Stream.fromIterable(
      Array.from({ length: eventCount }, (_, i) => i)
    )

    await Effect.runPromise(
      Stream.runForEach(fastStream, (value) =>
        Effect.sync(() => {
          const current = r.get(data)
          r.set(data, [...current, value])
          const currentCount = r.get(count)
          r.set(count, currentCount + 1)
        })
      )
    )

    expect(r.get(data).length).toBe(eventCount)
    expect(r.get(count)).toBe(eventCount)
  })

  it('maintains order under high throughput', async () => {
    const r = Registry.make()

    const data = Atom.make<readonly number[]>([]).pipe(Atom.keepAlive)
    r.subscribe(data, () => {})

    const eventCount = 500
    const orderedStream = Stream.fromIterable(
      Array.from({ length: eventCount }, (_, i) => i)
    )

    await Effect.runPromise(
      Stream.runForEach(orderedStream, (value) =>
        Effect.sync(() => {
          const current = r.get(data)
          r.set(data, [...current, value])
        })
      )
    )

    const result = r.get(data)

    // Verify order is maintained
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i]).toBeLessThan(result[i + 1])
    }
  })

  it('handles chunked streams efficiently', async () => {
    const r = Registry.make()

    const data = Atom.make<readonly number[]>([]).pipe(Atom.keepAlive)
    r.subscribe(data, () => {})

    const chunkSize = 100
    const numChunks = 10

    const chunkedStream = Stream.fromIterable(
      Array.from({ length: numChunks }, (_, chunkIdx) =>
        Array.from({ length: chunkSize }, (_, i) => chunkIdx * chunkSize + i)
      )
    ).pipe(Stream.flatMap(Stream.fromIterable))

    await Effect.runPromise(
      Stream.runForEach(chunkedStream, (value) =>
        Effect.sync(() => {
          const current = r.get(data)
          r.set(data, [...current, value])
        })
      )
    )

    expect(r.get(data).length).toBe(chunkSize * numChunks)
  })
})

// =============================================================================
// DERIVED ATOM REACTIVITY
// =============================================================================

describe('Derived Atom Reactivity', () => {
  it('derived atoms update when source changes', () => {
    const r = Registry.make()

    const data = Atom.make<readonly number[]>([]).pipe(Atom.keepAlive)
    const count = Atom.make((get) => get(data).length)
    const hasData = Atom.make((get) => get(data).length > 0)

    r.subscribe(data, () => {})

    // Initially empty
    expect(r.get(count)).toBe(0)
    expect(r.get(hasData)).toBe(false)

    // Add data
    r.set(data, [1, 2, 3])

    // Derived atoms should update
    expect(r.get(count)).toBe(3)
    expect(r.get(hasData)).toBe(true)
  })

  it('multiple derived atoms stay in sync', () => {
    const r = Registry.make()

    const status = Atom.make<'idle' | 'loading' | 'success' | 'error'>('idle').pipe(Atom.keepAlive)
    const isLoading = Atom.make((get) => get(status) === 'loading')
    const isSuccess = Atom.make((get) => get(status) === 'success')
    const isError = Atom.make((get) => get(status) === 'error')

    r.subscribe(status, () => {})

    // Transition to loading
    r.set(status, 'loading')
    expect(r.get(isLoading)).toBe(true)
    expect(r.get(isSuccess)).toBe(false)
    expect(r.get(isError)).toBe(false)

    // Transition to success
    r.set(status, 'success')
    expect(r.get(isLoading)).toBe(false)
    expect(r.get(isSuccess)).toBe(true)
    expect(r.get(isError)).toBe(false)

    // Transition to error
    r.set(status, 'error')
    expect(r.get(isLoading)).toBe(false)
    expect(r.get(isSuccess)).toBe(false)
    expect(r.get(isError)).toBe(true)
  })
})

// =============================================================================
// RESULT FROM ATOMS PATTERN
// =============================================================================

describe('Result from Atoms Pattern', () => {
  it('builds Initial result when idle', () => {
    const r = Registry.make()

    const status = Atom.make<'idle' | 'subscribing' | 'active' | 'closed'>('idle').pipe(Atom.keepAlive)
    const data = Atom.make<readonly number[]>([]).pipe(Atom.keepAlive)
    const error = Atom.make<Error | null>(null).pipe(Atom.keepAlive)

    r.subscribe(status, () => {})
    r.subscribe(data, () => {})
    r.subscribe(error, () => {})

    const buildResult = (): Result.Result<readonly number[], Error> => {
      const s = r.get(status)
      const d = r.get(data)
      const e = r.get(error)

      if (e) return Result.failure(Cause.fail(e))
      if (s === 'idle') return Result.initial(false)
      if (s === 'subscribing') return Result.initial(true) // waiting
      return Result.success(d)
    }

    const result = buildResult()
    expect(Result.isInitial(result)).toBe(true)
    expect(Result.isWaiting(result)).toBe(false)
  })

  it('builds Waiting result when subscribing', () => {
    const r = Registry.make()

    const status = Atom.make<'idle' | 'subscribing' | 'active' | 'closed'>('subscribing').pipe(Atom.keepAlive)
    const data = Atom.make<readonly number[]>([]).pipe(Atom.keepAlive)
    const error = Atom.make<Error | null>(null).pipe(Atom.keepAlive)

    r.subscribe(status, () => {})
    r.subscribe(data, () => {})
    r.subscribe(error, () => {})

    const buildResult = (): Result.Result<readonly number[], Error> => {
      const s = r.get(status)
      const d = r.get(data)
      const e = r.get(error)

      if (e) return Result.failure(Cause.fail(e))
      if (s === 'idle') return Result.initial(false)
      if (s === 'subscribing') return Result.initial(true) // waiting
      return Result.success(d)
    }

    const result = buildResult()
    expect(Result.isInitial(result)).toBe(true)
    expect(Result.isWaiting(result)).toBe(true)
  })

  it('builds Success result when active with data', () => {
    const r = Registry.make()

    const status = Atom.make<'idle' | 'subscribing' | 'active' | 'closed'>('active').pipe(Atom.keepAlive)
    const data = Atom.make<readonly number[]>([1, 2, 3]).pipe(Atom.keepAlive)
    const error = Atom.make<Error | null>(null).pipe(Atom.keepAlive)

    r.subscribe(status, () => {})
    r.subscribe(data, () => {})
    r.subscribe(error, () => {})

    const buildResult = (): Result.Result<readonly number[], Error> => {
      const s = r.get(status)
      const d = r.get(data)
      const e = r.get(error)

      if (e) return Result.failure(Cause.fail(e))
      if (s === 'idle') return Result.initial(false)
      if (s === 'subscribing') return Result.initial(true)
      return Result.success(d)
    }

    const result = buildResult()
    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isSuccess(result)) {
      expect(result.value).toEqual([1, 2, 3])
    }
  })

  it('builds Failure result when error occurs', () => {
    const r = Registry.make()

    const status = Atom.make<'idle' | 'subscribing' | 'active' | 'closed'>('closed').pipe(Atom.keepAlive)
    const data = Atom.make<readonly number[]>([]).pipe(Atom.keepAlive)
    const error = Atom.make<Error | null>(new Error('connection failed')).pipe(Atom.keepAlive)

    r.subscribe(status, () => {})
    r.subscribe(data, () => {})
    r.subscribe(error, () => {})

    const buildResult = (): Result.Result<readonly number[], Error> => {
      const s = r.get(status)
      const d = r.get(data)
      const e = r.get(error)

      if (e) return Result.failure(Cause.fail(e))
      if (s === 'idle') return Result.initial(false)
      if (s === 'subscribing') return Result.initial(true)
      return Result.success(d)
    }

    const result = buildResult()
    expect(Result.isFailure(result)).toBe(true)
  })
})
