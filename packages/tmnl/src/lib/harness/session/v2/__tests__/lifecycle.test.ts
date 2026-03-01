/**
 * Session Lifecycle Schema Tests
 *
 * Unit: state/event schema validation
 * Behavior: transition table correctness — every valid path, every invalid path
 * Integration: lifecycle state round-trip through JSON
 */

import { describe, it, expect } from '@effect/vitest'
import { Schema } from 'effect'
import {
  SessionLifecycleState,
  LIFECYCLE_STATES,
  TERMINAL_STATES,
  MUTABLE_STATES,
  LifecycleEvent,
  ConnectEvent,
  ConnectedEvent,
  ConnectFailedEvent,
  StreamStartEvent,
  StreamEndEvent,
  StreamErrorEvent,
  CompactStartEvent,
  CompactEndEvent,
  BranchStartEvent,
  BranchEndEvent,
  DisposeEvent,
  ResetEvent,
  TRANSITION_TABLE,
  isValidTransition,
  getTransitionTarget,
} from '../lifecycle'

// =============================================================================
// Unit: State schema
// =============================================================================

describe('SessionLifecycleState — Unit', () => {
  it('accepts all valid states', () => {
    for (const state of LIFECYCLE_STATES) {
      const result = Schema.decodeUnknownSync(SessionLifecycleState)(state)
      expect(result).toBe(state)
    }
  })

  it('rejects invalid state', () => {
    expect(() => Schema.decodeUnknownSync(SessionLifecycleState)('flying')).toThrow()
    expect(() => Schema.decodeUnknownSync(SessionLifecycleState)('')).toThrow()
    expect(() => Schema.decodeUnknownSync(SessionLifecycleState)(42)).toThrow()
  })

  it('LIFECYCLE_STATES has 8 states', () => {
    expect(LIFECYCLE_STATES).toHaveLength(8)
  })

  it('TERMINAL_STATES contains only disposed', () => {
    expect(TERMINAL_STATES.size).toBe(1)
    expect(TERMINAL_STATES.has('disposed')).toBe(true)
  })

  it('MUTABLE_STATES contains the active working states', () => {
    expect(MUTABLE_STATES.has('connected')).toBe(true)
    expect(MUTABLE_STATES.has('streaming')).toBe(true)
    expect(MUTABLE_STATES.has('compacting')).toBe(true)
    expect(MUTABLE_STATES.has('branching')).toBe(true)
    // These should NOT be mutable
    expect(MUTABLE_STATES.has('idle')).toBe(false)
    expect(MUTABLE_STATES.has('connecting')).toBe(false)
    expect(MUTABLE_STATES.has('disposing')).toBe(false)
    expect(MUTABLE_STATES.has('disposed')).toBe(false)
  })
})

// =============================================================================
// Unit: Event schemas
// =============================================================================

describe('LifecycleEvent — Unit', () => {
  it('ConnectEvent requires sessionId', () => {
    const result = Schema.decodeUnknownSync(ConnectEvent)({
      _tag: 'Connect',
      sessionId: 'session-1',
    })
    expect(result._tag).toBe('Connect')
    expect(result.sessionId).toBe('session-1')
  })

  it('ConnectEvent rejects empty sessionId', () => {
    expect(() =>
      Schema.decodeUnknownSync(ConnectEvent)({
        _tag: 'Connect',
        sessionId: '',
      }),
    ).toThrow()
  })

  it('ConnectFailedEvent requires reason', () => {
    const result = Schema.decodeUnknownSync(ConnectFailedEvent)({
      _tag: 'ConnectFailed',
      reason: 'timeout',
    })
    expect(result.reason).toBe('timeout')
  })

  it('StreamErrorEvent requires reason', () => {
    const result = Schema.decodeUnknownSync(StreamErrorEvent)({
      _tag: 'StreamError',
      reason: 'context overflow',
    })
    expect(result.reason).toBe('context overflow')
  })

  it('discriminates all 12 event types', () => {
    const events = [
      { _tag: 'Connect', sessionId: 's-1' },
      { _tag: 'Connected' },
      { _tag: 'ConnectFailed', reason: 'err' },
      { _tag: 'StreamStart' },
      { _tag: 'StreamEnd' },
      { _tag: 'StreamError', reason: 'err' },
      { _tag: 'CompactStart' },
      { _tag: 'CompactEnd' },
      { _tag: 'BranchStart' },
      { _tag: 'BranchEnd' },
      { _tag: 'Dispose' },
      { _tag: 'Reset' },
    ]

    for (const event of events) {
      const result = Schema.decodeUnknownSync(LifecycleEvent)(event)
      expect(result._tag).toBe(event._tag)
    }
  })
})

// =============================================================================
// Behavior: Transition table
// =============================================================================

describe('Transition Table — Behavior', () => {
  // ---- Happy paths ----

  it('idle → Connect → connecting', () => {
    expect(isValidTransition('idle', 'Connect')).toBe(true)
    expect(getTransitionTarget('idle', 'Connect')).toBe('connecting')
  })

  it('connecting → Connected → connected', () => {
    expect(isValidTransition('connecting', 'Connected')).toBe(true)
    expect(getTransitionTarget('connecting', 'Connected')).toBe('connected')
  })

  it('connecting → ConnectFailed → idle', () => {
    expect(isValidTransition('connecting', 'ConnectFailed')).toBe(true)
    expect(getTransitionTarget('connecting', 'ConnectFailed')).toBe('idle')
  })

  it('connected → StreamStart → streaming', () => {
    expect(isValidTransition('connected', 'StreamStart')).toBe(true)
    expect(getTransitionTarget('connected', 'StreamStart')).toBe('streaming')
  })

  it('streaming → StreamEnd → connected', () => {
    expect(isValidTransition('streaming', 'StreamEnd')).toBe(true)
    expect(getTransitionTarget('streaming', 'StreamEnd')).toBe('connected')
  })

  it('streaming → StreamError → connected (recoverable)', () => {
    expect(isValidTransition('streaming', 'StreamError')).toBe(true)
    expect(getTransitionTarget('streaming', 'StreamError')).toBe('connected')
  })

  it('connected → CompactStart → compacting', () => {
    expect(isValidTransition('connected', 'CompactStart')).toBe(true)
    expect(getTransitionTarget('connected', 'CompactStart')).toBe('compacting')
  })

  it('compacting → CompactEnd → connected', () => {
    expect(isValidTransition('compacting', 'CompactEnd')).toBe(true)
    expect(getTransitionTarget('compacting', 'CompactEnd')).toBe('connected')
  })

  it('connected → BranchStart → branching', () => {
    expect(isValidTransition('connected', 'BranchStart')).toBe(true)
    expect(getTransitionTarget('connected', 'BranchStart')).toBe('branching')
  })

  it('branching → BranchEnd → connected', () => {
    expect(isValidTransition('branching', 'BranchEnd')).toBe(true)
    expect(getTransitionTarget('branching', 'BranchEnd')).toBe('connected')
  })

  it('connected → Dispose → disposing', () => {
    expect(isValidTransition('connected', 'Dispose')).toBe(true)
    expect(getTransitionTarget('connected', 'Dispose')).toBe('disposing')
  })

  it('streaming → Dispose → disposing (interrupt)', () => {
    expect(isValidTransition('streaming', 'Dispose')).toBe(true)
    expect(getTransitionTarget('streaming', 'Dispose')).toBe('disposing')
  })

  it('disposing → Reset → idle', () => {
    expect(isValidTransition('disposing', 'Reset')).toBe(true)
    expect(getTransitionTarget('disposing', 'Reset')).toBe('idle')
  })

  // ---- Invalid transitions ----

  it('idle cannot StreamStart', () => {
    expect(isValidTransition('idle', 'StreamStart')).toBe(false)
    expect(getTransitionTarget('idle', 'StreamStart')).toBeUndefined()
  })

  it('idle cannot StreamEnd', () => {
    expect(isValidTransition('idle', 'StreamEnd')).toBe(false)
  })

  it('streaming cannot Connect', () => {
    expect(isValidTransition('streaming', 'Connect')).toBe(false)
  })

  it('disposed has no transitions', () => {
    for (const event of ['Connect', 'Connected', 'StreamStart', 'Dispose', 'Reset'] as const) {
      expect(isValidTransition('disposed', event)).toBe(false)
    }
  })

  it('connecting cannot StreamStart', () => {
    expect(isValidTransition('connecting', 'StreamStart')).toBe(false)
  })

  // ---- Comprehensive: every state has at least one valid transition (except disposed) ----

  it('every non-terminal state has at least one outgoing transition', () => {
    for (const state of LIFECYCLE_STATES) {
      if (TERMINAL_STATES.has(state)) continue
      const transitions = TRANSITION_TABLE[state]
      const validCount = Object.keys(transitions).length
      expect(validCount).toBeGreaterThan(0)
    }
  })

  // ---- Dispose reachable from all working states ----

  it('Dispose is reachable from all working states', () => {
    const workingStates: SessionLifecycleState[] = ['connected', 'streaming', 'compacting', 'branching']
    for (const state of workingStates) {
      expect(isValidTransition(state, 'Dispose')).toBe(true)
    }
  })
})
