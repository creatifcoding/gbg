/**
 * Line State Graph Tests
 *
 * ISA-95 production line operational state transitions with OEE classification.
 * States: idle, running, changeover, starved, blocked, maintenance, decommissioned
 * Terminal: decommissioned
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import {
  lineStateGraph,
  getNodeIndex,
  getStateFromIndex,
  isValidStateTransition,
  getTransitionAction,
  getValidNextStates,
  getValidPreviousStates,
  canStart,
  canStop,
  canBeginChangeover,
  canCompleteChangeover,
  canMarkStarved,
  canClearStarved,
  canMarkBlocked,
  canClearBlocked,
  canEnterMaintenance,
  canCompleteMaintenance,
  canDecommission,
  isTerminalState,
  isProductive,
  isPerformanceLoss,
  isAvailabilityLoss,
  STATE_COUNT,
  TRANSITION_COUNT,
  ALL_STATES,
  TERMINAL_STATES,
  type LineStateNode,
  type LineTransitionAction,
} from '../../../machines/graphs/line-graph'

// =============================================================================
// Graph Structure
// =============================================================================

describe('Line State Graph', () => {
  describe('Graph Structure', () => {
    it('should have correct state count', () => {
      expect(STATE_COUNT).toBe(7)
    })

    it('should have correct transition count', () => {
      expect(TRANSITION_COUNT).toBe(13)
    })

    it('should expose all states', () => {
      expect(ALL_STATES).toEqual([
        'idle',
        'running',
        'changeover',
        'starved',
        'blocked',
        'maintenance',
        'decommissioned',
      ])
    })

    it('should expose terminal states', () => {
      expect(TERMINAL_STATES).toEqual(['decommissioned'])
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
    it('idle -> running (Start)', () => {
      expect(isValidStateTransition('idle', 'running')).toBe(true)
      const action = getTransitionAction('idle', 'running')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Start')
    })

    it('running -> idle (Stop)', () => {
      expect(isValidStateTransition('running', 'idle')).toBe(true)
      const action = getTransitionAction('running', 'idle')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Stop')
    })

    it('running -> changeover (BeginChangeover)', () => {
      expect(isValidStateTransition('running', 'changeover')).toBe(true)
      const action = getTransitionAction('running', 'changeover')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('BeginChangeover')
    })

    it('changeover -> running (CompleteChangeover)', () => {
      expect(isValidStateTransition('changeover', 'running')).toBe(true)
      const action = getTransitionAction('changeover', 'running')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('CompleteChangeover')
    })

    it('running -> starved (MarkStarved)', () => {
      expect(isValidStateTransition('running', 'starved')).toBe(true)
      const action = getTransitionAction('running', 'starved')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('MarkStarved')
    })

    it('starved -> running (ClearStarved)', () => {
      expect(isValidStateTransition('starved', 'running')).toBe(true)
      const action = getTransitionAction('starved', 'running')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('ClearStarved')
    })

    it('running -> blocked (MarkBlocked)', () => {
      expect(isValidStateTransition('running', 'blocked')).toBe(true)
      const action = getTransitionAction('running', 'blocked')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('MarkBlocked')
    })

    it('blocked -> running (ClearBlocked)', () => {
      expect(isValidStateTransition('blocked', 'running')).toBe(true)
      const action = getTransitionAction('blocked', 'running')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('ClearBlocked')
    })

    it('idle -> maintenance (EnterMaintenance)', () => {
      expect(isValidStateTransition('idle', 'maintenance')).toBe(true)
      const action = getTransitionAction('idle', 'maintenance')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('EnterMaintenance')
    })

    it('running -> maintenance (EnterMaintenance)', () => {
      expect(isValidStateTransition('running', 'maintenance')).toBe(true)
      const action = getTransitionAction('running', 'maintenance')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('EnterMaintenance')
    })

    it('maintenance -> idle (CompleteMaintenance)', () => {
      expect(isValidStateTransition('maintenance', 'idle')).toBe(true)
      const action = getTransitionAction('maintenance', 'idle')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('CompleteMaintenance')
    })

    it('idle -> decommissioned (Decommission)', () => {
      expect(isValidStateTransition('idle', 'decommissioned')).toBe(true)
      const action = getTransitionAction('idle', 'decommissioned')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Decommission')
    })

    it('maintenance -> decommissioned (Decommission)', () => {
      expect(isValidStateTransition('maintenance', 'decommissioned')).toBe(true)
      const action = getTransitionAction('maintenance', 'decommissioned')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Decommission')
    })
  })

  // =============================================================================
  // Invalid Transitions
  // =============================================================================

  describe('Invalid Transitions', () => {
    it('running -> decommissioned directly (must go through idle or maintenance)', () => {
      expect(isValidStateTransition('running', 'decommissioned')).toBe(false)
    })

    it('decommissioned -> idle (terminal state, no outgoing)', () => {
      expect(isValidStateTransition('decommissioned', 'idle')).toBe(false)
    })

    it('decommissioned -> running (terminal state, no outgoing)', () => {
      expect(isValidStateTransition('decommissioned', 'running')).toBe(false)
    })

    it('changeover -> idle (must go through running first)', () => {
      expect(isValidStateTransition('changeover', 'idle')).toBe(false)
    })

    it('starved -> idle (must go through running first)', () => {
      expect(isValidStateTransition('starved', 'idle')).toBe(false)
    })

    it('blocked -> idle (must go through running first)', () => {
      expect(isValidStateTransition('blocked', 'idle')).toBe(false)
    })

    it('self-transitions are not defined', () => {
      expect(isValidStateTransition('idle', 'idle')).toBe(false)
      expect(isValidStateTransition('running', 'running')).toBe(false)
      expect(isValidStateTransition('decommissioned', 'decommissioned')).toBe(false)
    })

    it('returns None for invalid transition actions', () => {
      const action = getTransitionAction('decommissioned', 'idle')
      expect(Option.isNone(action)).toBe(true)
    })
  })

  // =============================================================================
  // Next / Previous States
  // =============================================================================

  describe('Next / Previous States', () => {
    it('idle has 3 next states: running, maintenance, decommissioned', () => {
      const next = getValidNextStates('idle')
      expect(next).toHaveLength(3)
      expect(next).toContain('running')
      expect(next).toContain('maintenance')
      expect(next).toContain('decommissioned')
    })

    it('running has 5 next states: idle, changeover, starved, blocked, maintenance', () => {
      const next = getValidNextStates('running')
      expect(next).toHaveLength(5)
      expect(next).toContain('idle')
      expect(next).toContain('changeover')
      expect(next).toContain('starved')
      expect(next).toContain('blocked')
      expect(next).toContain('maintenance')
    })

    it('changeover has 1 next state: running', () => {
      const next = getValidNextStates('changeover')
      expect(next).toHaveLength(1)
      expect(next).toContain('running')
    })

    it('starved has 1 next state: running', () => {
      const next = getValidNextStates('starved')
      expect(next).toHaveLength(1)
      expect(next).toContain('running')
    })

    it('blocked has 1 next state: running', () => {
      const next = getValidNextStates('blocked')
      expect(next).toHaveLength(1)
      expect(next).toContain('running')
    })

    it('maintenance has 2 next states: idle, decommissioned', () => {
      const next = getValidNextStates('maintenance')
      expect(next).toHaveLength(2)
      expect(next).toContain('idle')
      expect(next).toContain('decommissioned')
    })

    it('decommissioned has 0 next states (terminal)', () => {
      const next = getValidNextStates('decommissioned')
      expect(next).toHaveLength(0)
    })

    it('running has 4 previous states: idle, changeover, starved, blocked', () => {
      const prev = getValidPreviousStates('running')
      expect(prev).toHaveLength(4)
      expect(prev).toContain('idle')
      expect(prev).toContain('changeover')
      expect(prev).toContain('starved')
      expect(prev).toContain('blocked')
    })

    it('idle has 2 previous states: running, maintenance', () => {
      const prev = getValidPreviousStates('idle')
      expect(prev).toHaveLength(2)
      expect(prev).toContain('running')
      expect(prev).toContain('maintenance')
    })

    it('decommissioned has 2 previous states: idle, maintenance', () => {
      const prev = getValidPreviousStates('decommissioned')
      expect(prev).toHaveLength(2)
      expect(prev).toContain('idle')
      expect(prev).toContain('maintenance')
    })
  })

  // =============================================================================
  // Action-Specific Validators
  // =============================================================================

  describe('Action-Specific Validators', () => {
    it('canStart: only from idle', () => {
      expect(canStart('idle')).toBe(true)
      expect(canStart('running')).toBe(false)
      expect(canStart('maintenance')).toBe(false)
      expect(canStart('decommissioned')).toBe(false)
    })

    it('canStop: only from running', () => {
      expect(canStop('running')).toBe(true)
      expect(canStop('idle')).toBe(false)
      expect(canStop('changeover')).toBe(false)
    })

    it('canBeginChangeover: only from running', () => {
      expect(canBeginChangeover('running')).toBe(true)
      expect(canBeginChangeover('idle')).toBe(false)
      expect(canBeginChangeover('changeover')).toBe(false)
    })

    it('canCompleteChangeover: only from changeover', () => {
      expect(canCompleteChangeover('changeover')).toBe(true)
      expect(canCompleteChangeover('running')).toBe(false)
      expect(canCompleteChangeover('idle')).toBe(false)
    })

    it('canMarkStarved: only from running', () => {
      expect(canMarkStarved('running')).toBe(true)
      expect(canMarkStarved('idle')).toBe(false)
      expect(canMarkStarved('starved')).toBe(false)
    })

    it('canClearStarved: only from starved', () => {
      expect(canClearStarved('starved')).toBe(true)
      expect(canClearStarved('running')).toBe(false)
      expect(canClearStarved('idle')).toBe(false)
    })

    it('canMarkBlocked: only from running', () => {
      expect(canMarkBlocked('running')).toBe(true)
      expect(canMarkBlocked('idle')).toBe(false)
      expect(canMarkBlocked('blocked')).toBe(false)
    })

    it('canClearBlocked: only from blocked', () => {
      expect(canClearBlocked('blocked')).toBe(true)
      expect(canClearBlocked('running')).toBe(false)
      expect(canClearBlocked('idle')).toBe(false)
    })

    it('canEnterMaintenance: from idle or running', () => {
      expect(canEnterMaintenance('idle')).toBe(true)
      expect(canEnterMaintenance('running')).toBe(true)
      expect(canEnterMaintenance('maintenance')).toBe(false)
      expect(canEnterMaintenance('decommissioned')).toBe(false)
    })

    it('canCompleteMaintenance: only from maintenance', () => {
      expect(canCompleteMaintenance('maintenance')).toBe(true)
      expect(canCompleteMaintenance('idle')).toBe(false)
      expect(canCompleteMaintenance('running')).toBe(false)
    })

    it('canDecommission: from idle or maintenance', () => {
      expect(canDecommission('idle')).toBe(true)
      expect(canDecommission('maintenance')).toBe(true)
      expect(canDecommission('running')).toBe(false)
      expect(canDecommission('decommissioned')).toBe(false)
    })

    it('isTerminalState: only decommissioned', () => {
      expect(isTerminalState('decommissioned')).toBe(true)
      expect(isTerminalState('idle')).toBe(false)
      expect(isTerminalState('running')).toBe(false)
      expect(isTerminalState('maintenance')).toBe(false)
    })
  })

  // =============================================================================
  // OEE Classification Helpers
  // =============================================================================

  describe('OEE Classification Helpers', () => {
    it('isProductive: only running', () => {
      expect(isProductive('running')).toBe(true)
      expect(isProductive('idle')).toBe(false)
      expect(isProductive('changeover')).toBe(false)
      expect(isProductive('maintenance')).toBe(false)
    })

    it('isPerformanceLoss: changeover, starved, blocked, idle', () => {
      expect(isPerformanceLoss('changeover')).toBe(true)
      expect(isPerformanceLoss('starved')).toBe(true)
      expect(isPerformanceLoss('blocked')).toBe(true)
      expect(isPerformanceLoss('idle')).toBe(true)
      expect(isPerformanceLoss('running')).toBe(false)
      expect(isPerformanceLoss('maintenance')).toBe(false)
    })

    it('isAvailabilityLoss: only maintenance', () => {
      expect(isAvailabilityLoss('maintenance')).toBe(true)
      expect(isAvailabilityLoss('running')).toBe(false)
      expect(isAvailabilityLoss('idle')).toBe(false)
      expect(isAvailabilityLoss('changeover')).toBe(false)
    })
  })
})
