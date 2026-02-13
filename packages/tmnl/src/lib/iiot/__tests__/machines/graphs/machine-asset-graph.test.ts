/**
 * Machine Asset State Graph Tests
 *
 * ISA-95 machine asset lifecycle state transitions.
 * States: commissioned, operational, idle, faulted, scheduled_maintenance,
 *         unscheduled_maintenance, retired, decommissioned
 * Terminal: decommissioned
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import {
  machineAssetStateGraph,
  getNodeIndex,
  getStateFromIndex,
  isValidStateTransition,
  getTransitionAction,
  getValidNextStates,
  getValidPreviousStates,
  canActivate,
  canGoIdle,
  canResume,
  canMarkFaulted,
  canScheduleRepair,
  canEmergencyRepair,
  canScheduleMaintenance,
  canCompleteMaintenance,
  canRetire,
  canDecommission,
  isTerminalState,
  STATE_COUNT,
  TRANSITION_COUNT,
  ALL_STATES,
  TERMINAL_STATES,
  type MachineAssetStateNode,
  type MachineAssetTransitionAction,
} from '../../../machines/graphs/machine-asset-graph'

// =============================================================================
// Graph Structure
// =============================================================================

describe('Machine Asset State Graph', () => {
  describe('Graph Structure', () => {
    it('should have correct state count', () => {
      expect(STATE_COUNT).toBe(8)
    })

    it('should have correct transition count', () => {
      expect(TRANSITION_COUNT).toBe(15)
    })

    it('should expose all states', () => {
      expect(ALL_STATES).toEqual([
        'commissioned',
        'operational',
        'idle',
        'faulted',
        'scheduled_maintenance',
        'unscheduled_maintenance',
        'retired',
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
    it('commissioned -> operational (Activate)', () => {
      expect(isValidStateTransition('commissioned', 'operational')).toBe(true)
      const action = getTransitionAction('commissioned', 'operational')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Activate')
    })

    it('operational -> idle (GoIdle)', () => {
      expect(isValidStateTransition('operational', 'idle')).toBe(true)
      const action = getTransitionAction('operational', 'idle')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('GoIdle')
    })

    it('idle -> operational (Resume)', () => {
      expect(isValidStateTransition('idle', 'operational')).toBe(true)
      const action = getTransitionAction('idle', 'operational')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Resume')
    })

    it('operational -> faulted (MarkFaulted)', () => {
      expect(isValidStateTransition('operational', 'faulted')).toBe(true)
      const action = getTransitionAction('operational', 'faulted')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('MarkFaulted')
    })

    it('idle -> faulted (MarkFaulted)', () => {
      expect(isValidStateTransition('idle', 'faulted')).toBe(true)
      const action = getTransitionAction('idle', 'faulted')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('MarkFaulted')
    })

    it('faulted -> scheduled_maintenance (ScheduleRepair)', () => {
      expect(isValidStateTransition('faulted', 'scheduled_maintenance')).toBe(true)
      const action = getTransitionAction('faulted', 'scheduled_maintenance')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('ScheduleRepair')
    })

    it('faulted -> unscheduled_maintenance (EmergencyRepair)', () => {
      expect(isValidStateTransition('faulted', 'unscheduled_maintenance')).toBe(true)
      const action = getTransitionAction('faulted', 'unscheduled_maintenance')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('EmergencyRepair')
    })

    it('operational -> scheduled_maintenance (ScheduleMaintenance)', () => {
      expect(isValidStateTransition('operational', 'scheduled_maintenance')).toBe(true)
      const action = getTransitionAction('operational', 'scheduled_maintenance')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('ScheduleMaintenance')
    })

    it('idle -> scheduled_maintenance (ScheduleMaintenance)', () => {
      expect(isValidStateTransition('idle', 'scheduled_maintenance')).toBe(true)
      const action = getTransitionAction('idle', 'scheduled_maintenance')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('ScheduleMaintenance')
    })

    it('scheduled_maintenance -> operational (CompleteMaintenance)', () => {
      expect(isValidStateTransition('scheduled_maintenance', 'operational')).toBe(true)
      const action = getTransitionAction('scheduled_maintenance', 'operational')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('CompleteMaintenance')
    })

    it('unscheduled_maintenance -> operational (CompleteMaintenance)', () => {
      expect(isValidStateTransition('unscheduled_maintenance', 'operational')).toBe(true)
      const action = getTransitionAction('unscheduled_maintenance', 'operational')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('CompleteMaintenance')
    })

    it('operational -> retired (Retire)', () => {
      expect(isValidStateTransition('operational', 'retired')).toBe(true)
      const action = getTransitionAction('operational', 'retired')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Retire')
    })

    it('idle -> retired (Retire)', () => {
      expect(isValidStateTransition('idle', 'retired')).toBe(true)
      const action = getTransitionAction('idle', 'retired')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Retire')
    })

    it('retired -> decommissioned (Decommission)', () => {
      expect(isValidStateTransition('retired', 'decommissioned')).toBe(true)
      const action = getTransitionAction('retired', 'decommissioned')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Decommission')
    })

    it('scheduled_maintenance -> decommissioned (Decommission)', () => {
      expect(isValidStateTransition('scheduled_maintenance', 'decommissioned')).toBe(true)
      const action = getTransitionAction('scheduled_maintenance', 'decommissioned')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Decommission')
    })
  })

  // =============================================================================
  // Invalid Transitions
  // =============================================================================

  describe('Invalid Transitions', () => {
    it('decommissioned -> operational (terminal state, no outgoing)', () => {
      expect(isValidStateTransition('decommissioned', 'operational')).toBe(false)
    })

    it('decommissioned -> commissioned (terminal state, no outgoing)', () => {
      expect(isValidStateTransition('decommissioned', 'commissioned')).toBe(false)
    })

    it('commissioned -> retired (must go through operational first)', () => {
      expect(isValidStateTransition('commissioned', 'retired')).toBe(false)
    })

    it('commissioned -> faulted (must go through operational first)', () => {
      expect(isValidStateTransition('commissioned', 'faulted')).toBe(false)
    })

    it('faulted -> operational (must go through maintenance)', () => {
      expect(isValidStateTransition('faulted', 'operational')).toBe(false)
    })

    it('self-transitions are not defined', () => {
      expect(isValidStateTransition('commissioned', 'commissioned')).toBe(false)
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
    it('commissioned has 1 next state: operational', () => {
      const next = getValidNextStates('commissioned')
      expect(next).toHaveLength(1)
      expect(next).toContain('operational')
    })

    it('operational has 4 next states: idle, faulted, scheduled_maintenance, retired', () => {
      const next = getValidNextStates('operational')
      expect(next).toHaveLength(4)
      expect(next).toContain('idle')
      expect(next).toContain('faulted')
      expect(next).toContain('scheduled_maintenance')
      expect(next).toContain('retired')
    })

    it('idle has 4 next states: operational, faulted, scheduled_maintenance, retired', () => {
      const next = getValidNextStates('idle')
      expect(next).toHaveLength(4)
      expect(next).toContain('operational')
      expect(next).toContain('faulted')
      expect(next).toContain('scheduled_maintenance')
      expect(next).toContain('retired')
    })

    it('faulted has 2 next states: scheduled_maintenance, unscheduled_maintenance', () => {
      const next = getValidNextStates('faulted')
      expect(next).toHaveLength(2)
      expect(next).toContain('scheduled_maintenance')
      expect(next).toContain('unscheduled_maintenance')
    })

    it('scheduled_maintenance has 2 next states: operational, decommissioned', () => {
      const next = getValidNextStates('scheduled_maintenance')
      expect(next).toHaveLength(2)
      expect(next).toContain('operational')
      expect(next).toContain('decommissioned')
    })

    it('unscheduled_maintenance has 1 next state: operational', () => {
      const next = getValidNextStates('unscheduled_maintenance')
      expect(next).toHaveLength(1)
      expect(next).toContain('operational')
    })

    it('retired has 1 next state: decommissioned', () => {
      const next = getValidNextStates('retired')
      expect(next).toHaveLength(1)
      expect(next).toContain('decommissioned')
    })

    it('decommissioned has 0 next states (terminal)', () => {
      const next = getValidNextStates('decommissioned')
      expect(next).toHaveLength(0)
    })

    it('commissioned has 0 previous states (initial)', () => {
      const prev = getValidPreviousStates('commissioned')
      expect(prev).toHaveLength(0)
    })

    it('operational has 4 previous states', () => {
      const prev = getValidPreviousStates('operational')
      expect(prev).toHaveLength(4)
      expect(prev).toContain('commissioned')
      expect(prev).toContain('idle')
      expect(prev).toContain('scheduled_maintenance')
      expect(prev).toContain('unscheduled_maintenance')
    })

    it('decommissioned has 2 previous states: retired, scheduled_maintenance', () => {
      const prev = getValidPreviousStates('decommissioned')
      expect(prev).toHaveLength(2)
      expect(prev).toContain('retired')
      expect(prev).toContain('scheduled_maintenance')
    })
  })

  // =============================================================================
  // Action-Specific Validators
  // =============================================================================

  describe('Action-Specific Validators', () => {
    it('canActivate: only from commissioned', () => {
      expect(canActivate('commissioned')).toBe(true)
      expect(canActivate('operational')).toBe(false)
      expect(canActivate('idle')).toBe(false)
      expect(canActivate('faulted')).toBe(false)
      expect(canActivate('decommissioned')).toBe(false)
    })

    it('canGoIdle: only from operational', () => {
      expect(canGoIdle('operational')).toBe(true)
      expect(canGoIdle('commissioned')).toBe(false)
      expect(canGoIdle('idle')).toBe(false)
      expect(canGoIdle('decommissioned')).toBe(false)
    })

    it('canResume: only from idle', () => {
      expect(canResume('idle')).toBe(true)
      expect(canResume('operational')).toBe(false)
      expect(canResume('commissioned')).toBe(false)
      expect(canResume('decommissioned')).toBe(false)
    })

    it('canMarkFaulted: from operational or idle', () => {
      expect(canMarkFaulted('operational')).toBe(true)
      expect(canMarkFaulted('idle')).toBe(true)
      expect(canMarkFaulted('commissioned')).toBe(false)
      expect(canMarkFaulted('faulted')).toBe(false)
      expect(canMarkFaulted('decommissioned')).toBe(false)
    })

    it('canScheduleRepair: only from faulted', () => {
      expect(canScheduleRepair('faulted')).toBe(true)
      expect(canScheduleRepair('operational')).toBe(false)
      expect(canScheduleRepair('idle')).toBe(false)
      expect(canScheduleRepair('decommissioned')).toBe(false)
    })

    it('canEmergencyRepair: only from faulted', () => {
      expect(canEmergencyRepair('faulted')).toBe(true)
      expect(canEmergencyRepair('operational')).toBe(false)
      expect(canEmergencyRepair('idle')).toBe(false)
      expect(canEmergencyRepair('decommissioned')).toBe(false)
    })

    it('canScheduleMaintenance: from operational or idle', () => {
      expect(canScheduleMaintenance('operational')).toBe(true)
      expect(canScheduleMaintenance('idle')).toBe(true)
      expect(canScheduleMaintenance('commissioned')).toBe(false)
      expect(canScheduleMaintenance('faulted')).toBe(false)
      expect(canScheduleMaintenance('decommissioned')).toBe(false)
    })

    it('canCompleteMaintenance: from scheduled_maintenance or unscheduled_maintenance', () => {
      expect(canCompleteMaintenance('scheduled_maintenance')).toBe(true)
      expect(canCompleteMaintenance('unscheduled_maintenance')).toBe(true)
      expect(canCompleteMaintenance('operational')).toBe(false)
      expect(canCompleteMaintenance('faulted')).toBe(false)
      expect(canCompleteMaintenance('decommissioned')).toBe(false)
    })

    it('canRetire: from operational or idle', () => {
      expect(canRetire('operational')).toBe(true)
      expect(canRetire('idle')).toBe(true)
      expect(canRetire('commissioned')).toBe(false)
      expect(canRetire('faulted')).toBe(false)
      expect(canRetire('retired')).toBe(false)
      expect(canRetire('decommissioned')).toBe(false)
    })

    it('canDecommission: from retired or scheduled_maintenance', () => {
      expect(canDecommission('retired')).toBe(true)
      expect(canDecommission('scheduled_maintenance')).toBe(true)
      expect(canDecommission('operational')).toBe(false)
      expect(canDecommission('idle')).toBe(false)
      expect(canDecommission('decommissioned')).toBe(false)
    })

    it('isTerminalState: only decommissioned', () => {
      expect(isTerminalState('decommissioned')).toBe(true)
      expect(isTerminalState('commissioned')).toBe(false)
      expect(isTerminalState('operational')).toBe(false)
      expect(isTerminalState('retired')).toBe(false)
    })
  })
})
