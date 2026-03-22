/**
 * Workcell State Graph Tests
 *
 * ISA-95 workcell-level operational state transitions.
 * States: idle, setup, running, blocked, faulted, maintenance, decommissioned
 * Terminal: decommissioned
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import {
  workcellStateGraph,
  getNodeIndex,
  getStateFromIndex,
  isValidStateTransition,
  getTransitionAction,
  getValidNextStates,
  getValidPreviousStates,
  canBeginSetup,
  canCompleteSetup,
  canStop,
  canMarkBlocked,
  canClearBlocked,
  canMarkFaulted,
  canClearFault,
  canEnterMaintenance,
  canCompleteMaintenance,
  canDecommission,
  isTerminalState,
  STATE_COUNT,
  TRANSITION_COUNT,
  ALL_STATES,
  TERMINAL_STATES,
  type WorkcellStateNode,
  type WorkcellTransitionAction,
} from '../../../machines/graphs/workcell-graph'

// =============================================================================
// Graph Structure
// =============================================================================

describe('Workcell State Graph', () => {
  describe('Graph Structure', () => {
    it('should have correct state count', () => {
      expect(STATE_COUNT).toBe(7)
    })

    it('should have correct transition count', () => {
      expect(TRANSITION_COUNT).toBe(12)
    })

    it('should expose all states', () => {
      expect(ALL_STATES).toEqual([
        'idle',
        'setup',
        'running',
        'blocked',
        'faulted',
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
    it('idle -> setup (BeginSetup)', () => {
      expect(isValidStateTransition('idle', 'setup')).toBe(true)
      const action = getTransitionAction('idle', 'setup')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('BeginSetup')
    })

    it('setup -> running (CompleteSetup)', () => {
      expect(isValidStateTransition('setup', 'running')).toBe(true)
      const action = getTransitionAction('setup', 'running')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('CompleteSetup')
    })

    it('running -> idle (Stop)', () => {
      expect(isValidStateTransition('running', 'idle')).toBe(true)
      const action = getTransitionAction('running', 'idle')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Stop')
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

    it('running -> faulted (MarkFaulted)', () => {
      expect(isValidStateTransition('running', 'faulted')).toBe(true)
      const action = getTransitionAction('running', 'faulted')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('MarkFaulted')
    })

    it('faulted -> idle (ClearFault)', () => {
      expect(isValidStateTransition('faulted', 'idle')).toBe(true)
      const action = getTransitionAction('faulted', 'idle')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('ClearFault')
    })

    it('idle -> maintenance (EnterMaintenance)', () => {
      expect(isValidStateTransition('idle', 'maintenance')).toBe(true)
      const action = getTransitionAction('idle', 'maintenance')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('EnterMaintenance')
    })

    it('faulted -> maintenance (EnterMaintenance)', () => {
      expect(isValidStateTransition('faulted', 'maintenance')).toBe(true)
      const action = getTransitionAction('faulted', 'maintenance')
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

    it('setup -> idle (must go through running first)', () => {
      expect(isValidStateTransition('setup', 'idle')).toBe(false)
    })

    it('blocked -> idle (must go through running first)', () => {
      expect(isValidStateTransition('blocked', 'idle')).toBe(false)
    })

    it('idle -> running directly (must go through setup)', () => {
      expect(isValidStateTransition('idle', 'running')).toBe(false)
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
    it('idle has 3 next states: setup, maintenance, decommissioned', () => {
      const next = getValidNextStates('idle')
      expect(next).toHaveLength(3)
      expect(next).toContain('setup')
      expect(next).toContain('maintenance')
      expect(next).toContain('decommissioned')
    })

    it('setup has 1 next state: running', () => {
      const next = getValidNextStates('setup')
      expect(next).toHaveLength(1)
      expect(next).toContain('running')
    })

    it('running has 3 next states: idle, blocked, faulted', () => {
      const next = getValidNextStates('running')
      expect(next).toHaveLength(3)
      expect(next).toContain('idle')
      expect(next).toContain('blocked')
      expect(next).toContain('faulted')
    })

    it('blocked has 1 next state: running', () => {
      const next = getValidNextStates('blocked')
      expect(next).toHaveLength(1)
      expect(next).toContain('running')
    })

    it('faulted has 2 next states: idle, maintenance', () => {
      const next = getValidNextStates('faulted')
      expect(next).toHaveLength(2)
      expect(next).toContain('idle')
      expect(next).toContain('maintenance')
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

    it('idle has 3 previous states: running, faulted, maintenance', () => {
      const prev = getValidPreviousStates('idle')
      expect(prev).toHaveLength(3)
      expect(prev).toContain('running')
      expect(prev).toContain('faulted')
      expect(prev).toContain('maintenance')
    })

    it('running has 2 previous states: setup, blocked', () => {
      const prev = getValidPreviousStates('running')
      expect(prev).toHaveLength(2)
      expect(prev).toContain('setup')
      expect(prev).toContain('blocked')
    })

    it('decommissioned has 2 previous states: idle, maintenance', () => {
      const prev = getValidPreviousStates('decommissioned')
      expect(prev).toHaveLength(2)
      expect(prev).toContain('idle')
      expect(prev).toContain('maintenance')
    })

    it('maintenance has 2 previous states: idle, faulted', () => {
      const prev = getValidPreviousStates('maintenance')
      expect(prev).toHaveLength(2)
      expect(prev).toContain('idle')
      expect(prev).toContain('faulted')
    })
  })

  // =============================================================================
  // Action-Specific Validators
  // =============================================================================

  describe('Action-Specific Validators', () => {
    it('canBeginSetup: only from idle', () => {
      expect(canBeginSetup('idle')).toBe(true)
      expect(canBeginSetup('running')).toBe(false)
      expect(canBeginSetup('setup')).toBe(false)
      expect(canBeginSetup('decommissioned')).toBe(false)
    })

    it('canCompleteSetup: only from setup', () => {
      expect(canCompleteSetup('setup')).toBe(true)
      expect(canCompleteSetup('idle')).toBe(false)
      expect(canCompleteSetup('running')).toBe(false)
    })

    it('canStop: only from running', () => {
      expect(canStop('running')).toBe(true)
      expect(canStop('idle')).toBe(false)
      expect(canStop('blocked')).toBe(false)
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

    it('canMarkFaulted: only from running', () => {
      expect(canMarkFaulted('running')).toBe(true)
      expect(canMarkFaulted('idle')).toBe(false)
      expect(canMarkFaulted('faulted')).toBe(false)
    })

    it('canClearFault: only from faulted', () => {
      expect(canClearFault('faulted')).toBe(true)
      expect(canClearFault('running')).toBe(false)
      expect(canClearFault('idle')).toBe(false)
    })

    it('canEnterMaintenance: from idle or faulted', () => {
      expect(canEnterMaintenance('idle')).toBe(true)
      expect(canEnterMaintenance('faulted')).toBe(true)
      expect(canEnterMaintenance('running')).toBe(false)
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
      expect(canDecommission('faulted')).toBe(false)
      expect(canDecommission('decommissioned')).toBe(false)
    })

    it('isTerminalState: only decommissioned', () => {
      expect(isTerminalState('decommissioned')).toBe(true)
      expect(isTerminalState('idle')).toBe(false)
      expect(isTerminalState('running')).toBe(false)
      expect(isTerminalState('setup')).toBe(false)
      expect(isTerminalState('maintenance')).toBe(false)
    })
  })
})
