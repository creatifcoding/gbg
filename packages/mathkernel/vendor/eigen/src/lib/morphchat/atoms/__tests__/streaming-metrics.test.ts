/**
 * Streaming Metrics — Unit tests for derived atom + pure functions.
 *
 * Tests the derivation logic, NOT atom reactivity (that's effect-atom's job).
 * Covers: deriveVelocity, IDLE_METRICS sentinel, metric computation.
 *
 * NOTE: We import from the barrel (atoms/index.ts) to verify exports.
 * The vi.mock for useHarnessAdapter prevents transitive import chain
 * from pulling in harnessRuntimeAtom which fails outside Effect runtime.
 */

import { describe, it, expect, vi } from 'vitest'

// Mock the heavy useHarnessAdapter module before any imports that chain through it
vi.mock('../../hooks/useHarnessAdapter', () => {
  const { Atom } = require('@effect-atom/atom')
  // Provide just the streaming$ family — that's all streaming-metrics needs
  return {
    streaming$: Atom.family((_id: string) =>
      Atom.make({ phase: 'idle', buffer: '' }),
    ),
    getMessageAtom: vi.fn(),
  }
})

import {
  deriveVelocity,
  IDLE_METRICS,
  type CursorVelocity,
  type StreamingMetrics,
} from '../index'
import type { StreamPhase } from '../../schemas/message-types'

describe('deriveVelocity', () => {
  it('returns slow for waiting phase regardless of rate', () => {
    expect(deriveVelocity(0, 'waiting')).toBe('slow')
    expect(deriveVelocity(50, 'waiting')).toBe('slow')
    expect(deriveVelocity(100, 'waiting')).toBe('slow')
  })

  it('returns fast when rate >= 20 tok/s', () => {
    expect(deriveVelocity(20, 'receiving')).toBe('fast')
    expect(deriveVelocity(50, 'receiving')).toBe('fast')
    expect(deriveVelocity(100, 'receiving')).toBe('fast')
  })

  it('returns slow when rate > 0 and < 5 tok/s', () => {
    expect(deriveVelocity(1, 'receiving')).toBe('slow')
    expect(deriveVelocity(4, 'receiving')).toBe('slow')
    expect(deriveVelocity(4.9, 'receiving')).toBe('slow')
  })

  it('returns normal for mid-range rates (5-19 tok/s)', () => {
    expect(deriveVelocity(5, 'receiving')).toBe('normal')
    expect(deriveVelocity(10, 'receiving')).toBe('normal')
    expect(deriveVelocity(19, 'receiving')).toBe('normal')
  })

  it('returns normal when rate is exactly 0 and not waiting', () => {
    // 0 tok/s during receiving = just started, treat as normal
    expect(deriveVelocity(0, 'receiving')).toBe('normal')
  })

  it('handles finalizing phase with rate', () => {
    expect(deriveVelocity(30, 'finalizing')).toBe('fast')
    expect(deriveVelocity(3, 'finalizing')).toBe('slow')
  })

  it('handles cancelling phase with rate', () => {
    expect(deriveVelocity(25, 'cancelling')).toBe('fast')
    expect(deriveVelocity(10, 'cancelling')).toBe('normal')
  })
})

describe('IDLE_METRICS', () => {
  it('is frozen (immutable)', () => {
    expect(Object.isFrozen(IDLE_METRICS)).toBe(true)
  })

  it('has correct idle defaults', () => {
    expect(IDLE_METRICS).toEqual({
      active: false,
      phase: 'idle',
      tokensReceived: 0,
      tokensPerSecond: 0,
      elapsedSec: 0,
      velocity: 'normal',
      messageId: null,
    })
  })

  it('returns same reference on repeated access', () => {
    expect(IDLE_METRICS).toBe(IDLE_METRICS)
  })
})

describe('StreamingMetrics type shape', () => {
  it('correctly types all velocity buckets', () => {
    const velocities: CursorVelocity[] = ['fast', 'normal', 'slow']
    expect(velocities).toHaveLength(3)
  })

  it('IDLE_METRICS satisfies StreamingMetrics interface', () => {
    const metrics: StreamingMetrics = IDLE_METRICS
    expect(metrics.active).toBe(false)
    expect(metrics.phase).toBe('idle')
    expect(metrics.tokensReceived).toBe(0)
    expect(metrics.tokensPerSecond).toBe(0)
    expect(metrics.elapsedSec).toBe(0)
    expect(metrics.velocity).toBe('normal')
    expect(metrics.messageId).toBeNull()
  })
})

describe('velocity boundaries', () => {
  const phases: StreamPhase[] = ['receiving', 'finalizing']

  for (const phase of phases) {
    it(`boundary: rate=4.9 in ${phase} → slow`, () => {
      expect(deriveVelocity(4.9, phase)).toBe('slow')
    })

    it(`boundary: rate=5 in ${phase} → normal`, () => {
      expect(deriveVelocity(5, phase)).toBe('normal')
    })

    it(`boundary: rate=19 in ${phase} → normal`, () => {
      expect(deriveVelocity(19, phase)).toBe('normal')
    })

    it(`boundary: rate=20 in ${phase} → fast`, () => {
      expect(deriveVelocity(20, phase)).toBe('fast')
    })
  }
})
