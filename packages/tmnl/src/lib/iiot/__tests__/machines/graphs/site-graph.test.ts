/**
 * Site State Graph Tests
 *
 * ISA-95 site-level state transitions.
 * States: planned, under_construction, operational, seasonal_shutdown, closed, decommissioned
 * Terminal: decommissioned
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import {
  siteStateGraph,
  getNodeIndex,
  getStateFromIndex,
  isValidStateTransition,
  getTransitionAction,
  getValidNextStates,
  getValidPreviousStates,
  canBeginConstruction,
  canCommission,
  canSeasonalShutdown,
  canReopen,
  canClose,
  canDecommission,
  isTerminalState,
  STATE_COUNT,
  TRANSITION_COUNT,
  ALL_STATES,
  TERMINAL_STATES,
  type SiteStateNode,
  type SiteTransitionAction,
} from '../../../machines/graphs/site-graph'

// =============================================================================
// Graph Structure
// =============================================================================

describe('Site State Graph', () => {
  describe('Graph Structure', () => {
    it('should have correct state count', () => {
      expect(STATE_COUNT).toBe(6)
    })

    it('should have correct transition count', () => {
      expect(TRANSITION_COUNT).toBe(7)
    })

    it('should expose all states', () => {
      expect(ALL_STATES).toEqual([
        'planned',
        'under_construction',
        'operational',
        'seasonal_shutdown',
        'closed',
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
    it('planned -> under_construction (BeginConstruction)', () => {
      expect(isValidStateTransition('planned', 'under_construction')).toBe(true)
      const action = getTransitionAction('planned', 'under_construction')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('BeginConstruction')
    })

    it('under_construction -> operational (Commission)', () => {
      expect(isValidStateTransition('under_construction', 'operational')).toBe(true)
      const action = getTransitionAction('under_construction', 'operational')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Commission')
    })

    it('operational -> seasonal_shutdown (SeasonalShutdown)', () => {
      expect(isValidStateTransition('operational', 'seasonal_shutdown')).toBe(true)
      const action = getTransitionAction('operational', 'seasonal_shutdown')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('SeasonalShutdown')
    })

    it('seasonal_shutdown -> operational (Reopen)', () => {
      expect(isValidStateTransition('seasonal_shutdown', 'operational')).toBe(true)
      const action = getTransitionAction('seasonal_shutdown', 'operational')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Reopen')
    })

    it('operational -> closed (Close)', () => {
      expect(isValidStateTransition('operational', 'closed')).toBe(true)
      const action = getTransitionAction('operational', 'closed')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Close')
    })

    it('closed -> decommissioned (Decommission)', () => {
      expect(isValidStateTransition('closed', 'decommissioned')).toBe(true)
      const action = getTransitionAction('closed', 'decommissioned')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Decommission')
    })

    it('closed -> operational (Reopen)', () => {
      expect(isValidStateTransition('closed', 'operational')).toBe(true)
      const action = getTransitionAction('closed', 'operational')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Reopen')
    })
  })

  // =============================================================================
  // Invalid Transitions
  // =============================================================================

  describe('Invalid Transitions', () => {
    it('decommissioned -> any (terminal state, no outgoing)', () => {
      expect(isValidStateTransition('decommissioned', 'planned')).toBe(false)
      expect(isValidStateTransition('decommissioned', 'operational')).toBe(false)
      expect(isValidStateTransition('decommissioned', 'closed')).toBe(false)
    })

    it('planned -> operational (must go through construction)', () => {
      expect(isValidStateTransition('planned', 'operational')).toBe(false)
    })

    it('under_construction -> closed (must commission first)', () => {
      expect(isValidStateTransition('under_construction', 'closed')).toBe(false)
    })

    it('seasonal_shutdown -> closed (must reopen first)', () => {
      expect(isValidStateTransition('seasonal_shutdown', 'closed')).toBe(false)
    })

    it('self-transitions are not defined', () => {
      for (const state of ALL_STATES) {
        expect(isValidStateTransition(state, state)).toBe(false)
      }
    })

    it('returns None for invalid transition actions', () => {
      const action = getTransitionAction('decommissioned', 'planned')
      expect(Option.isNone(action)).toBe(true)
    })
  })

  // =============================================================================
  // Next / Previous States
  // =============================================================================

  describe('Next / Previous States', () => {
    it('planned has 1 next state: under_construction', () => {
      const next = getValidNextStates('planned')
      expect(next).toHaveLength(1)
      expect(next).toContain('under_construction')
    })

    it('under_construction has 1 next state: operational', () => {
      const next = getValidNextStates('under_construction')
      expect(next).toHaveLength(1)
      expect(next).toContain('operational')
    })

    it('operational has 2 next states: seasonal_shutdown, closed', () => {
      const next = getValidNextStates('operational')
      expect(next).toHaveLength(2)
      expect(next).toContain('seasonal_shutdown')
      expect(next).toContain('closed')
    })

    it('seasonal_shutdown has 1 next state: operational', () => {
      const next = getValidNextStates('seasonal_shutdown')
      expect(next).toHaveLength(1)
      expect(next).toContain('operational')
    })

    it('closed has 2 next states: decommissioned, operational', () => {
      const next = getValidNextStates('closed')
      expect(next).toHaveLength(2)
      expect(next).toContain('decommissioned')
      expect(next).toContain('operational')
    })

    it('decommissioned has 0 next states (terminal)', () => {
      const next = getValidNextStates('decommissioned')
      expect(next).toHaveLength(0)
    })

    it('planned has 0 previous states (initial)', () => {
      const prev = getValidPreviousStates('planned')
      expect(prev).toHaveLength(0)
    })

    it('under_construction has 1 previous state: planned', () => {
      const prev = getValidPreviousStates('under_construction')
      expect(prev).toHaveLength(1)
      expect(prev).toContain('planned')
    })

    it('operational has 3 previous states: under_construction, seasonal_shutdown, closed', () => {
      const prev = getValidPreviousStates('operational')
      expect(prev).toHaveLength(3)
      expect(prev).toContain('under_construction')
      expect(prev).toContain('seasonal_shutdown')
      expect(prev).toContain('closed')
    })

    it('seasonal_shutdown has 1 previous state: operational', () => {
      const prev = getValidPreviousStates('seasonal_shutdown')
      expect(prev).toHaveLength(1)
      expect(prev).toContain('operational')
    })

    it('closed has 1 previous state: operational', () => {
      const prev = getValidPreviousStates('closed')
      expect(prev).toHaveLength(1)
      expect(prev).toContain('operational')
    })

    it('decommissioned has 1 previous state: closed', () => {
      const prev = getValidPreviousStates('decommissioned')
      expect(prev).toHaveLength(1)
      expect(prev).toContain('closed')
    })
  })

  // =============================================================================
  // Action-Specific Validators
  // =============================================================================

  describe('Action-Specific Validators', () => {
    it('canBeginConstruction: only from planned', () => {
      expect(canBeginConstruction('planned')).toBe(true)
      expect(canBeginConstruction('under_construction')).toBe(false)
      expect(canBeginConstruction('operational')).toBe(false)
      expect(canBeginConstruction('closed')).toBe(false)
      expect(canBeginConstruction('decommissioned')).toBe(false)
    })

    it('canCommission: only from under_construction', () => {
      expect(canCommission('under_construction')).toBe(true)
      expect(canCommission('planned')).toBe(false)
      expect(canCommission('operational')).toBe(false)
    })

    it('canSeasonalShutdown: only from operational', () => {
      expect(canSeasonalShutdown('operational')).toBe(true)
      expect(canSeasonalShutdown('planned')).toBe(false)
      expect(canSeasonalShutdown('closed')).toBe(false)
    })

    it('canReopen: from seasonal_shutdown or closed', () => {
      expect(canReopen('seasonal_shutdown')).toBe(true)
      expect(canReopen('closed')).toBe(true)
      expect(canReopen('planned')).toBe(false)
      expect(canReopen('operational')).toBe(false)
      expect(canReopen('decommissioned')).toBe(false)
    })

    it('canClose: only from operational', () => {
      expect(canClose('operational')).toBe(true)
      expect(canClose('planned')).toBe(false)
      expect(canClose('closed')).toBe(false)
      expect(canClose('decommissioned')).toBe(false)
    })

    it('canDecommission: only from closed', () => {
      expect(canDecommission('closed')).toBe(true)
      expect(canDecommission('operational')).toBe(false)
      expect(canDecommission('planned')).toBe(false)
      expect(canDecommission('decommissioned')).toBe(false)
    })

    it('isTerminalState: only decommissioned', () => {
      expect(isTerminalState('decommissioned')).toBe(true)
      expect(isTerminalState('planned')).toBe(false)
      expect(isTerminalState('operational')).toBe(false)
      expect(isTerminalState('closed')).toBe(false)
    })
  })
})
