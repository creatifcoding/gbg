/**
 * Area State Graph Tests
 *
 * ISA-95 area-level state transitions.
 * States: active, restricted, maintenance, inactive, decommissioned
 * Terminal: decommissioned
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import {
  areaStateGraph,
  getNodeIndex,
  getStateFromIndex,
  isValidStateTransition,
  getTransitionAction,
  getValidNextStates,
  getValidPreviousStates,
  canRestrict,
  canClearRestriction,
  canEnterMaintenance,
  canExitMaintenance,
  canDeactivate,
  canActivate,
  canDecommission,
  isTerminalState,
  STATE_COUNT,
  TRANSITION_COUNT,
  ALL_STATES,
  TERMINAL_STATES,
  type AreaStateNode,
  type AreaTransitionAction,
} from '../../../machines/graphs/area-graph'

// =============================================================================
// Graph Structure
// =============================================================================

describe('Area State Graph', () => {
  describe('Graph Structure', () => {
    it('should have correct state count', () => {
      expect(STATE_COUNT).toBe(5)
    })

    it('should have correct transition count', () => {
      expect(TRANSITION_COUNT).toBe(8)
    })

    it('should expose all states', () => {
      expect(ALL_STATES).toEqual([
        'active',
        'restricted',
        'maintenance',
        'inactive',
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
    it('active -> restricted (Restrict)', () => {
      expect(isValidStateTransition('active', 'restricted')).toBe(true)
      const action = getTransitionAction('active', 'restricted')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Restrict')
    })

    it('restricted -> active (ClearRestriction)', () => {
      expect(isValidStateTransition('restricted', 'active')).toBe(true)
      const action = getTransitionAction('restricted', 'active')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('ClearRestriction')
    })

    it('active -> maintenance (EnterMaintenance)', () => {
      expect(isValidStateTransition('active', 'maintenance')).toBe(true)
      const action = getTransitionAction('active', 'maintenance')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('EnterMaintenance')
    })

    it('maintenance -> active (ExitMaintenance)', () => {
      expect(isValidStateTransition('maintenance', 'active')).toBe(true)
      const action = getTransitionAction('maintenance', 'active')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('ExitMaintenance')
    })

    it('active -> inactive (Deactivate)', () => {
      expect(isValidStateTransition('active', 'inactive')).toBe(true)
      const action = getTransitionAction('active', 'inactive')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Deactivate')
    })

    it('inactive -> active (Activate)', () => {
      expect(isValidStateTransition('inactive', 'active')).toBe(true)
      const action = getTransitionAction('inactive', 'active')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Activate')
    })

    it('inactive -> decommissioned (Decommission)', () => {
      expect(isValidStateTransition('inactive', 'decommissioned')).toBe(true)
      const action = getTransitionAction('inactive', 'decommissioned')
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
    it('decommissioned -> any (terminal state, no outgoing)', () => {
      expect(isValidStateTransition('decommissioned', 'active')).toBe(false)
      expect(isValidStateTransition('decommissioned', 'restricted')).toBe(false)
      expect(isValidStateTransition('decommissioned', 'maintenance')).toBe(false)
      expect(isValidStateTransition('decommissioned', 'inactive')).toBe(false)
    })

    it('restricted -> maintenance (must clear restriction first)', () => {
      expect(isValidStateTransition('restricted', 'maintenance')).toBe(false)
    })

    it('restricted -> inactive (must clear restriction first)', () => {
      expect(isValidStateTransition('restricted', 'inactive')).toBe(false)
    })

    it('restricted -> decommissioned (must clear restriction first)', () => {
      expect(isValidStateTransition('restricted', 'decommissioned')).toBe(false)
    })

    it('active -> decommissioned (must deactivate or enter maintenance first)', () => {
      expect(isValidStateTransition('active', 'decommissioned')).toBe(false)
    })

    it('self-transitions are not defined', () => {
      for (const state of ALL_STATES) {
        expect(isValidStateTransition(state, state)).toBe(false)
      }
    })

    it('returns None for invalid transition actions', () => {
      const action = getTransitionAction('decommissioned', 'active')
      expect(Option.isNone(action)).toBe(true)
    })
  })

  // =============================================================================
  // Next / Previous States
  // =============================================================================

  describe('Next / Previous States', () => {
    it('active has 3 next states: restricted, maintenance, inactive', () => {
      const next = getValidNextStates('active')
      expect(next).toHaveLength(3)
      expect(next).toContain('restricted')
      expect(next).toContain('maintenance')
      expect(next).toContain('inactive')
    })

    it('restricted has 1 next state: active', () => {
      const next = getValidNextStates('restricted')
      expect(next).toHaveLength(1)
      expect(next).toContain('active')
    })

    it('maintenance has 2 next states: active, decommissioned', () => {
      const next = getValidNextStates('maintenance')
      expect(next).toHaveLength(2)
      expect(next).toContain('active')
      expect(next).toContain('decommissioned')
    })

    it('inactive has 2 next states: active, decommissioned', () => {
      const next = getValidNextStates('inactive')
      expect(next).toHaveLength(2)
      expect(next).toContain('active')
      expect(next).toContain('decommissioned')
    })

    it('decommissioned has 0 next states (terminal)', () => {
      const next = getValidNextStates('decommissioned')
      expect(next).toHaveLength(0)
    })

    it('active has 3 previous states: restricted, maintenance, inactive', () => {
      const prev = getValidPreviousStates('active')
      expect(prev).toHaveLength(3)
      expect(prev).toContain('restricted')
      expect(prev).toContain('maintenance')
      expect(prev).toContain('inactive')
    })

    it('restricted has 1 previous state: active', () => {
      const prev = getValidPreviousStates('restricted')
      expect(prev).toHaveLength(1)
      expect(prev).toContain('active')
    })

    it('maintenance has 1 previous state: active', () => {
      const prev = getValidPreviousStates('maintenance')
      expect(prev).toHaveLength(1)
      expect(prev).toContain('active')
    })

    it('inactive has 1 previous state: active', () => {
      const prev = getValidPreviousStates('inactive')
      expect(prev).toHaveLength(1)
      expect(prev).toContain('active')
    })

    it('decommissioned has 2 previous states: inactive, maintenance', () => {
      const prev = getValidPreviousStates('decommissioned')
      expect(prev).toHaveLength(2)
      expect(prev).toContain('inactive')
      expect(prev).toContain('maintenance')
    })
  })

  // =============================================================================
  // Action-Specific Validators
  // =============================================================================

  describe('Action-Specific Validators', () => {
    it('canRestrict: only from active', () => {
      expect(canRestrict('active')).toBe(true)
      expect(canRestrict('restricted')).toBe(false)
      expect(canRestrict('maintenance')).toBe(false)
      expect(canRestrict('inactive')).toBe(false)
      expect(canRestrict('decommissioned')).toBe(false)
    })

    it('canClearRestriction: only from restricted', () => {
      expect(canClearRestriction('restricted')).toBe(true)
      expect(canClearRestriction('active')).toBe(false)
      expect(canClearRestriction('maintenance')).toBe(false)
    })

    it('canEnterMaintenance: only from active', () => {
      expect(canEnterMaintenance('active')).toBe(true)
      expect(canEnterMaintenance('restricted')).toBe(false)
      expect(canEnterMaintenance('inactive')).toBe(false)
    })

    it('canExitMaintenance: only from maintenance', () => {
      expect(canExitMaintenance('maintenance')).toBe(true)
      expect(canExitMaintenance('active')).toBe(false)
      expect(canExitMaintenance('inactive')).toBe(false)
    })

    it('canDeactivate: only from active', () => {
      expect(canDeactivate('active')).toBe(true)
      expect(canDeactivate('restricted')).toBe(false)
      expect(canDeactivate('maintenance')).toBe(false)
    })

    it('canActivate: only from inactive', () => {
      expect(canActivate('inactive')).toBe(true)
      expect(canActivate('active')).toBe(false)
      expect(canActivate('maintenance')).toBe(false)
    })

    it('canDecommission: from inactive or maintenance', () => {
      expect(canDecommission('inactive')).toBe(true)
      expect(canDecommission('maintenance')).toBe(true)
      expect(canDecommission('active')).toBe(false)
      expect(canDecommission('restricted')).toBe(false)
      expect(canDecommission('decommissioned')).toBe(false)
    })

    it('isTerminalState: only decommissioned', () => {
      expect(isTerminalState('decommissioned')).toBe(true)
      expect(isTerminalState('active')).toBe(false)
      expect(isTerminalState('restricted')).toBe(false)
      expect(isTerminalState('maintenance')).toBe(false)
      expect(isTerminalState('inactive')).toBe(false)
    })
  })
})
