/**
 * Enterprise State Graph Tests
 *
 * ISA-95 enterprise-level state transitions.
 * States: active, restructuring, merged, dissolved
 * Terminal: merged, dissolved
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import {
  enterpriseStateGraph,
  getNodeIndex,
  getStateFromIndex,
  isValidStateTransition,
  getTransitionAction,
  getValidNextStates,
  getValidPreviousStates,
  canRestructure,
  canCompleteRestructuring,
  canMerge,
  canDissolve,
  isTerminalState,
  STATE_COUNT,
  TRANSITION_COUNT,
  ALL_STATES,
  TERMINAL_STATES,
  type EnterpriseStateNode,
  type EnterpriseTransitionAction,
} from '../../../machines/graphs/enterprise-graph'

// =============================================================================
// Graph Structure
// =============================================================================

describe('Enterprise State Graph', () => {
  describe('Graph Structure', () => {
    it('should have correct state count', () => {
      expect(STATE_COUNT).toBe(4)
    })

    it('should have correct transition count', () => {
      expect(TRANSITION_COUNT).toBe(5)
    })

    it('should expose all states', () => {
      expect(ALL_STATES).toEqual(['active', 'restructuring', 'merged', 'dissolved'])
    })

    it('should expose terminal states', () => {
      expect(TERMINAL_STATES).toEqual(['merged', 'dissolved'])
    })

    it('should return valid NodeIndex for each state', () => {
      for (const state of ALL_STATES) {
        const index = getNodeIndex(state)
        expect(index).toBeDefined()
        const retrieved = getStateFromIndex(index)
        expect(Option.isSome(retrieved)).toBe(true)
        expect(Option.getOrThrow(retrieved)).toBe(state)
      }
    })
  })

  // =============================================================================
  // Valid Transitions
  // =============================================================================

  describe('Valid Transitions', () => {
    it('active -> restructuring (Restructure)', () => {
      expect(isValidStateTransition('active', 'restructuring')).toBe(true)
      const action = getTransitionAction('active', 'restructuring')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Restructure')
    })

    it('restructuring -> active (CompleteRestructuring)', () => {
      expect(isValidStateTransition('restructuring', 'active')).toBe(true)
      const action = getTransitionAction('restructuring', 'active')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('CompleteRestructuring')
    })

    it('active -> merged (Merge)', () => {
      expect(isValidStateTransition('active', 'merged')).toBe(true)
      const action = getTransitionAction('active', 'merged')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Merge')
    })

    it('active -> dissolved (Dissolve)', () => {
      expect(isValidStateTransition('active', 'dissolved')).toBe(true)
      const action = getTransitionAction('active', 'dissolved')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Dissolve')
    })

    it('restructuring -> dissolved (Dissolve)', () => {
      expect(isValidStateTransition('restructuring', 'dissolved')).toBe(true)
      const action = getTransitionAction('restructuring', 'dissolved')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Dissolve')
    })
  })

  // =============================================================================
  // Invalid Transitions
  // =============================================================================

  describe('Invalid Transitions', () => {
    it('merged -> active (terminal state, no outgoing)', () => {
      expect(isValidStateTransition('merged', 'active')).toBe(false)
    })

    it('merged -> restructuring (terminal state, no outgoing)', () => {
      expect(isValidStateTransition('merged', 'restructuring')).toBe(false)
    })

    it('dissolved -> active (terminal state, no outgoing)', () => {
      expect(isValidStateTransition('dissolved', 'active')).toBe(false)
    })

    it('dissolved -> restructuring (terminal state, no outgoing)', () => {
      expect(isValidStateTransition('dissolved', 'restructuring')).toBe(false)
    })

    it('restructuring -> merged (must go through active first)', () => {
      expect(isValidStateTransition('restructuring', 'merged')).toBe(false)
    })

    it('self-transitions are not defined', () => {
      expect(isValidStateTransition('active', 'active')).toBe(false)
      expect(isValidStateTransition('restructuring', 'restructuring')).toBe(false)
    })

    it('returns None for invalid transition actions', () => {
      const action = getTransitionAction('merged', 'active')
      expect(Option.isNone(action)).toBe(true)
    })
  })

  // =============================================================================
  // Next / Previous States
  // =============================================================================

  describe('Next / Previous States', () => {
    it('active has 3 next states: restructuring, merged, dissolved', () => {
      const next = getValidNextStates('active')
      expect(next).toHaveLength(3)
      expect(next).toContain('restructuring')
      expect(next).toContain('merged')
      expect(next).toContain('dissolved')
    })

    it('restructuring has 2 next states: active, dissolved', () => {
      const next = getValidNextStates('restructuring')
      expect(next).toHaveLength(2)
      expect(next).toContain('active')
      expect(next).toContain('dissolved')
    })

    it('merged has 0 next states (terminal)', () => {
      const next = getValidNextStates('merged')
      expect(next).toHaveLength(0)
    })

    it('dissolved has 0 next states (terminal)', () => {
      const next = getValidNextStates('dissolved')
      expect(next).toHaveLength(0)
    })

    it('active has 1 previous state: restructuring', () => {
      const prev = getValidPreviousStates('active')
      expect(prev).toHaveLength(1)
      expect(prev).toContain('restructuring')
    })

    it('restructuring has 1 previous state: active', () => {
      const prev = getValidPreviousStates('restructuring')
      expect(prev).toHaveLength(1)
      expect(prev).toContain('active')
    })

    it('merged has 1 previous state: active', () => {
      const prev = getValidPreviousStates('merged')
      expect(prev).toHaveLength(1)
      expect(prev).toContain('active')
    })

    it('dissolved has 2 previous states: active, restructuring', () => {
      const prev = getValidPreviousStates('dissolved')
      expect(prev).toHaveLength(2)
      expect(prev).toContain('active')
      expect(prev).toContain('restructuring')
    })
  })

  // =============================================================================
  // Action-Specific Validators
  // =============================================================================

  describe('Action-Specific Validators', () => {
    it('canRestructure: only from active', () => {
      expect(canRestructure('active')).toBe(true)
      expect(canRestructure('restructuring')).toBe(false)
      expect(canRestructure('merged')).toBe(false)
      expect(canRestructure('dissolved')).toBe(false)
    })

    it('canCompleteRestructuring: only from restructuring', () => {
      expect(canCompleteRestructuring('restructuring')).toBe(true)
      expect(canCompleteRestructuring('active')).toBe(false)
      expect(canCompleteRestructuring('merged')).toBe(false)
      expect(canCompleteRestructuring('dissolved')).toBe(false)
    })

    it('canMerge: only from active', () => {
      expect(canMerge('active')).toBe(true)
      expect(canMerge('restructuring')).toBe(false)
      expect(canMerge('merged')).toBe(false)
      expect(canMerge('dissolved')).toBe(false)
    })

    it('canDissolve: from active or restructuring', () => {
      expect(canDissolve('active')).toBe(true)
      expect(canDissolve('restructuring')).toBe(true)
      expect(canDissolve('merged')).toBe(false)
      expect(canDissolve('dissolved')).toBe(false)
    })

    it('isTerminalState: merged and dissolved', () => {
      expect(isTerminalState('merged')).toBe(true)
      expect(isTerminalState('dissolved')).toBe(true)
      expect(isTerminalState('active')).toBe(false)
      expect(isTerminalState('restructuring')).toBe(false)
    })
  })
})
