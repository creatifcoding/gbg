/**
 * Rate Limiter Tests — checkQueryRate timing invariants.
 *
 * Tests the per-session query rate limiter that prevents excessive
 * readOutput/dumpScreen calls from LLM polling loops.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkQueryRate } from '../InteractiveShellService'

describe('checkQueryRate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows first call for a new session (returns 0)', () => {
    const waitMs = checkQueryRate('test-session-fresh')
    expect(waitMs).toBe(0)
  })

  it('blocks immediate second call (returns > 0)', () => {
    const sid = 'test-session-block'
    checkQueryRate(sid) // first call
    const waitMs = checkQueryRate(sid) // immediate second
    expect(waitMs).toBeGreaterThan(0)
    expect(waitMs).toBeLessThanOrEqual(1000)
  })

  it('allows call after MIN_QUERY_INTERVAL has elapsed', () => {
    const sid = 'test-session-elapsed'
    checkQueryRate(sid) // first call
    vi.advanceTimersByTime(1001) // advance past 1000ms interval
    const waitMs = checkQueryRate(sid)
    expect(waitMs).toBe(0)
  })

  it('returns correct remaining wait time', () => {
    const sid = 'test-session-remaining'
    checkQueryRate(sid) // first call at t=0
    vi.advanceTimersByTime(400) // advance 400ms
    const waitMs = checkQueryRate(sid) // should wait ~600ms more
    expect(waitMs).toBeGreaterThan(500)
    expect(waitMs).toBeLessThanOrEqual(600)
  })

  it('tracks sessions independently', () => {
    const sid1 = 'test-session-a'
    const sid2 = 'test-session-b'

    checkQueryRate(sid1) // block sid1
    const wait1 = checkQueryRate(sid1) // sid1 blocked
    const wait2 = checkQueryRate(sid2) // sid2 should be fine

    expect(wait1).toBeGreaterThan(0)
    expect(wait2).toBe(0)
  })

  it('resets timer on successful check', () => {
    const sid = 'test-session-reset'
    checkQueryRate(sid) // t=0
    vi.advanceTimersByTime(1001) // t=1001
    checkQueryRate(sid) // allowed, resets timer to t=1001

    // Immediate check should be blocked again
    const waitMs = checkQueryRate(sid)
    expect(waitMs).toBeGreaterThan(0)
  })
})
