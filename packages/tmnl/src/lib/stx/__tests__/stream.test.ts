/**
 * stxStream Tests
 *
 * Tests for progressive state from Effect Streams.
 * Uses Legend-State observables (state$) for direct reads in tests.
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Effect, Stream } from 'effect'

import { stxStream } from '../stream'

// Helper: wait for condition with timeout
const waitFor = async (
  predicate: () => boolean,
  timeout = 2000,
  interval = 10,
) => {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeout) {
      throw new Error(`waitFor timed out after ${timeout}ms`)
    }
    await new Promise((r) => setTimeout(r, interval))
  }
}

describe('stxStream()', () => {
  describe('Basic streaming', () => {
    it('streams values from a finite iterable', async () => {
      const s = stxStream({
        stream: Stream.fromIterable([1, 2, 3]),
        initial: 0,
      })

      await waitFor(() => s.state$.status.get() === 'complete')

      expect(s.state$.value.get()).toBe(3)
      expect(s.state$.hasValue.get()).toBe(true)
      expect(s.state$.status.get()).toBe('complete')
      s.dispose()
    })

    it('uses initial value before stream emits', () => {
      const s = stxStream({
        stream: Stream.never, // Never emits
        initial: 42,
      })

      expect(s.state$.value.get()).toBe(42)
      expect(s.state$.hasValue.get()).toBe(true)
      expect(s.state$.status.get()).toBe('streaming')
      s.dispose()
    })

    it('handles empty stream', async () => {
      const s = stxStream({
        stream: Stream.empty,
        initial: 0,
      })

      await waitFor(() => s.state$.status.get() === 'complete')

      expect(s.state$.value.get()).toBe(0) // Still initial
      expect(s.state$.status.get()).toBe('complete')
      s.dispose()
    })

    it('handles stream errors', async () => {
      const s = stxStream({
        stream: Stream.fail(new Error('boom')),
      })

      await waitFor(() => s.state$.status.get() === 'error')

      expect(s.state$.status.get()).toBe('error')
      expect(s.state$.hasError.get()).toBe(true)
      s.dispose()
    })
  })

  describe('Buffer strategies', () => {
    it('buffer: "all" accumulates all values', async () => {
      const s = stxStream({
        stream: Stream.fromIterable([10, 20, 30, 40, 50]),
        buffer: 'all',
      })

      await waitFor(() => s.state$.status.get() === 'complete')

      expect(s.state$.buffer.get()).toEqual([10, 20, 30, 40, 50])
      s.dispose()
    })

    it('buffer: { size: N } keeps last N values', async () => {
      const s = stxStream({
        stream: Stream.fromIterable([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
        buffer: { size: 3 },
      })

      await waitFor(() => s.state$.status.get() === 'complete')

      expect(s.state$.buffer.get()).toEqual([8, 9, 10])
      s.dispose()
    })

    it('buffer: "latest" does not accumulate', async () => {
      const s = stxStream({
        stream: Stream.fromIterable([1, 2, 3]),
        buffer: 'latest',
      })

      await waitFor(() => s.state$.status.get() === 'complete')

      expect(s.state$.buffer.get()).toEqual([])
      s.dispose()
    })
  })

  describe('Pause / Resume', () => {
    it('pause stops streaming', async () => {
      const s = stxStream({
        stream: Stream.fromIterable([1, 2, 3]).pipe(
          Stream.concat(Stream.never),
        ),
        initial: 0,
      })

      // Wait for at least one value
      await waitFor(() => s.state$.value.get() !== 0)

      s.pause()
      expect(s.state$.status.get()).toBe('idle')
      s.dispose()
    })

    it('resume restarts streaming', async () => {
      const s = stxStream({
        stream: Stream.fromIterable([1, 2, 3]),
        initial: 0,
      })

      await waitFor(() => s.state$.status.get() === 'complete')

      s.reset()
      expect(s.state$.status.get()).toBe('idle')

      s.resume()
      await waitFor(() => s.state$.status.get() === 'complete')

      expect(s.state$.value.get()).toBe(3)
      s.dispose()
    })
  })

  describe('Reset', () => {
    it('reset clears value and buffer', async () => {
      const s = stxStream({
        stream: Stream.fromIterable([1, 2, 3]),
        initial: 0,
        buffer: 'all',
      })

      await waitFor(() => s.state$.status.get() === 'complete')
      expect(s.state$.buffer.get()).toEqual([1, 2, 3])

      s.reset()

      expect(s.state$.status.get()).toBe('idle')
      expect(s.state$.buffer.get()).toEqual([])
      expect(s.state$.value.get()).toBe(0) // Back to initial
      expect(s.state$.hasValue.get()).toBe(true)

      s.dispose()
    })
  })

  describe('Multiple values via mapEffect', () => {
    it('transforms each element', async () => {
      const s = stxStream({
        stream: Stream.fromIterable(['a', 'b', 'c']).pipe(
          Stream.map((v) => v.toUpperCase()),
        ),
        buffer: 'all',
      })

      await waitFor(() => s.state$.status.get() === 'complete')

      expect(s.state$.buffer.get()).toEqual(['A', 'B', 'C'])
      expect(s.state$.value.get()).toBe('C')
      s.dispose()
    })
  })
})
