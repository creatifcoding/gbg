/**
 * Plant State Graph Tests
 *
 * ISA-95 plant-level lifecycle state transitions.
 * States: commissioning, operational, scheduled_shutdown, emergency_shutdown, maintenance_shutdown, decommissioned
 * Terminal: decommissioned
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import {
  plantStateGraph,
  getNodeIndex,
  getStateFromIndex,
  isValidStateTransition,
  getTransitionAction,
  getValidNextStates,
  getValidPreviousStates,
  canCompleteCommissioning,
  canScheduledShutdown,
  canRestart,
  canEmergencyShutdown,
  canBeginEmergencyMaintenance,
  canCompleteMaintenanceRestart,
  canMaintenanceShutdown,
  canDecommission,
  isTerminalState,
  STATE_COUNT,
  TRANSITION_COUNT,
  ALL_STATES,
  TERMINAL_STATES,
  type PlantStateNode,
  type PlantTransitionAction,
} from '../../../machines/graphs/plant-graph'

// =============================================================================
// Graph Structure
// =============================================================================

describe('Plant State Graph', () => {
  describe('Graph Structure', () => {
    it('should have correct state count', () => {
      expect(STATE_COUNT).toBe(6)
    })

    it('should have correct transition count', () => {
      expect(TRANSITION_COUNT).toBe(9)
    })

    it('should expose all states', () => {
      expect(ALL_STATES).toEqual([
        'commissioning',
        'operational',
        'scheduled_shutdown',
        'emergency_shutdown',
        'maintenance_shutdown',
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
    it('commissioning -> operational (CompleteCommissioning)', () => {
      expect(isValidStateTransition('commissioning', 'operational')).toBe(true)
      const action = getTransitionAction('commissioning', 'operational')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('CompleteCommissioning')
    })

    it('operational -> scheduled_shutdown (ScheduledShutdown)', () => {
      expect(isValidStateTransition('operational', 'scheduled_shutdown')).toBe(true)
      const action = getTransitionAction('operational', 'scheduled_shutdown')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('ScheduledShutdown')
    })

    it('scheduled_shutdown -> operational (Restart)', () => {
      expect(isValidStateTransition('scheduled_shutdown', 'operational')).toBe(true)
      const action = getTransitionAction('scheduled_shutdown', 'operational')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Restart')
    })

    it('operational -> emergency_shutdown (EmergencyShutdown)', () => {
      expect(isValidStateTransition('operational', 'emergency_shutdown')).toBe(true)
      const action = getTransitionAction('operational', 'emergency_shutdown')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('EmergencyShutdown')
    })

    it('emergency_shutdown -> maintenance_shutdown (BeginEmergencyMaintenance)', () => {
      expect(isValidStateTransition('emergency_shutdown', 'maintenance_shutdown')).toBe(true)
      const action = getTransitionAction('emergency_shutdown', 'maintenance_shutdown')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('BeginEmergencyMaintenance')
    })

    it('maintenance_shutdown -> operational (CompleteMaintenanceRestart)', () => {
      expect(isValidStateTransition('maintenance_shutdown', 'operational')).toBe(true)
      const action = getTransitionAction('maintenance_shutdown', 'operational')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('CompleteMaintenanceRestart')
    })

    it('operational -> maintenance_shutdown (MaintenanceShutdown)', () => {
      expect(isValidStateTransition('operational', 'maintenance_shutdown')).toBe(true)
      const action = getTransitionAction('operational', 'maintenance_shutdown')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('MaintenanceShutdown')
    })

    it('scheduled_shutdown -> decommissioned (Decommission)', () => {
      expect(isValidStateTransition('scheduled_shutdown', 'decommissioned')).toBe(true)
      const action = getTransitionAction('scheduled_shutdown', 'decommissioned')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Decommission')
    })

    it('maintenance_shutdown -> decommissioned (Decommission)', () => {
      expect(isValidStateTransition('maintenance_shutdown', 'decommissioned')).toBe(true)
      const action = getTransitionAction('maintenance_shutdown', 'decommissioned')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Decommission')
    })
  })

  // =============================================================================
  // Invalid Transitions
  // =============================================================================

  describe('Invalid Transitions', () => {
    it('commissioning -> decommissioned (must go through operational first)', () => {
      expect(isValidStateTransition('commissioning', 'decommissioned')).toBe(false)
    })

    it('operational -> decommissioned directly (must go through shutdown)', () => {
      expect(isValidStateTransition('operational', 'decommissioned')).toBe(false)
    })

    it('decommissioned -> operational (terminal state, no outgoing)', () => {
      expect(isValidStateTransition('decommissioned', 'operational')).toBe(false)
    })

    it('decommissioned -> commissioning (terminal state, no outgoing)', () => {
      expect(isValidStateTransition('decommissioned', 'commissioning')).toBe(false)
    })

    it('self-transitions are not defined', () => {
      expect(isValidStateTransition('commissioning', 'commissioning')).toBe(false)
      expect(isValidStateTransition('operational', 'operational')).toBe(false)
      expect(isValidStateTransition('decommissioned', 'decommissioned')).toBe(false)
    })

    it('returns None for invalid transition actions', () => {
      const action = getTransitionAction('decommissioned', 'operational')
      expect(Option.isNone(action)).toBe(true)
    })
  })

  // =============================================================================
  // Next / Previous States
  // =============================================================================

  describe('Next / Previous States', () => {
    it('commissioning has 1 next state: operational', () => {
      const next = getValidNextStates('commissioning')
      expect(next).toHaveLength(1)
      expect(next).toContain('operational')
    })

    it('operational has 3 next states: scheduled_shutdown, emergency_shutdown, maintenance_shutdown', () => {
      const next = getValidNextStates('operational')
      expect(next).toHaveLength(3)
      expect(next).toContain('scheduled_shutdown')
      expect(next).toContain('emergency_shutdown')
      expect(next).toContain('maintenance_shutdown')
    })

    it('scheduled_shutdown has 2 next states: operational, decommissioned', () => {
      const next = getValidNextStates('scheduled_shutdown')
      expect(next).toHaveLength(2)
      expect(next).toContain('operational')
      expect(next).toContain('decommissioned')
    })

    it('emergency_shutdown has 1 next state: maintenance_shutdown', () => {
      const next = getValidNextStates('emergency_shutdown')
      expect(next).toHaveLength(1)
      expect(next).toContain('maintenance_shutdown')
    })

    it('maintenance_shutdown has 2 next states: operational, decommissioned', () => {
      const next = getValidNextStates('maintenance_shutdown')
      expect(next).toHaveLength(2)
      expect(next).toContain('operational')
      expect(next).toContain('decommissioned')
    })

    it('decommissioned has 0 next states (terminal)', () => {
      const next = getValidNextStates('decommissioned')
      expect(next).toHaveLength(0)
    })

    it('operational has 3 previous states: commissioning, scheduled_shutdown, maintenance_shutdown', () => {
      const prev = getValidPreviousStates('operational')
      expect(prev).toHaveLength(3)
      expect(prev).toContain('commissioning')
      expect(prev).toContain('scheduled_shutdown')
      expect(prev).toContain('maintenance_shutdown')
    })

    it('decommissioned has 2 previous states: scheduled_shutdown, maintenance_shutdown', () => {
      const prev = getValidPreviousStates('decommissioned')
      expect(prev).toHaveLength(2)
      expect(prev).toContain('scheduled_shutdown')
      expect(prev).toContain('maintenance_shutdown')
    })

    it('commissioning has 0 previous states (entry point)', () => {
      const prev = getValidPreviousStates('commissioning')
      expect(prev).toHaveLength(0)
    })
  })

  // =============================================================================
  // Action-Specific Validators
  // =============================================================================

  describe('Action-Specific Validators', () => {
    it('canCompleteCommissioning: only from commissioning', () => {
      expect(canCompleteCommissioning('commissioning')).toBe(true)
      expect(canCompleteCommissioning('operational')).toBe(false)
      expect(canCompleteCommissioning('decommissioned')).toBe(false)
    })

    it('canScheduledShutdown: only from operational', () => {
      expect(canScheduledShutdown('operational')).toBe(true)
      expect(canScheduledShutdown('commissioning')).toBe(false)
      expect(canScheduledShutdown('scheduled_shutdown')).toBe(false)
    })

    it('canRestart: only from scheduled_shutdown', () => {
      expect(canRestart('scheduled_shutdown')).toBe(true)
      expect(canRestart('operational')).toBe(false)
      expect(canRestart('maintenance_shutdown')).toBe(false)
    })

    it('canEmergencyShutdown: only from operational', () => {
      expect(canEmergencyShutdown('operational')).toBe(true)
      expect(canEmergencyShutdown('commissioning')).toBe(false)
      expect(canEmergencyShutdown('emergency_shutdown')).toBe(false)
    })

    it('canBeginEmergencyMaintenance: only from emergency_shutdown', () => {
      expect(canBeginEmergencyMaintenance('emergency_shutdown')).toBe(true)
      expect(canBeginEmergencyMaintenance('operational')).toBe(false)
      expect(canBeginEmergencyMaintenance('maintenance_shutdown')).toBe(false)
    })

    it('canCompleteMaintenanceRestart: only from maintenance_shutdown', () => {
      expect(canCompleteMaintenanceRestart('maintenance_shutdown')).toBe(true)
      expect(canCompleteMaintenanceRestart('operational')).toBe(false)
      expect(canCompleteMaintenanceRestart('emergency_shutdown')).toBe(false)
    })

    it('canMaintenanceShutdown: only from operational', () => {
      expect(canMaintenanceShutdown('operational')).toBe(true)
      expect(canMaintenanceShutdown('commissioning')).toBe(false)
      expect(canMaintenanceShutdown('maintenance_shutdown')).toBe(false)
    })

    it('canDecommission: from scheduled_shutdown or maintenance_shutdown', () => {
      expect(canDecommission('scheduled_shutdown')).toBe(true)
      expect(canDecommission('maintenance_shutdown')).toBe(true)
      expect(canDecommission('operational')).toBe(false)
      expect(canDecommission('commissioning')).toBe(false)
      expect(canDecommission('decommissioned')).toBe(false)
    })

    it('isTerminalState: only decommissioned', () => {
      expect(isTerminalState('decommissioned')).toBe(true)
      expect(isTerminalState('commissioning')).toBe(false)
      expect(isTerminalState('operational')).toBe(false)
      expect(isTerminalState('scheduled_shutdown')).toBe(false)
      expect(isTerminalState('emergency_shutdown')).toBe(false)
      expect(isTerminalState('maintenance_shutdown')).toBe(false)
    })
  })
})
