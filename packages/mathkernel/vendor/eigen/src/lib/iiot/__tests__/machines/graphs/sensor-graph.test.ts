/**
 * Sensor State Graph Tests
 *
 * ISA-95 sensor lifecycle state transitions.
 * States: active, calibrating, needs_calibration, faulted, offline, decommissioned
 * Terminal: decommissioned
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import {
  sensorStateGraph,
  getNodeIndex,
  getStateFromIndex,
  isValidStateTransition,
  getTransitionAction,
  getValidNextStates,
  getValidPreviousStates,
  canStartCalibration,
  canCompleteCalibration,
  canFailCalibration,
  canFlagForCalibration,
  canMarkFaulted,
  canClearFault,
  canTakeOffline,
  canBringOnline,
  canDecommission,
  isTerminalState,
  STATE_COUNT,
  TRANSITION_COUNT,
  ALL_STATES,
  TERMINAL_STATES,
  type SensorStateNode,
  type SensorTransitionAction,
} from '../../../machines/graphs/sensor-graph'

// =============================================================================
// Graph Structure
// =============================================================================

describe('Sensor State Graph', () => {
  describe('Graph Structure', () => {
    it('should have correct state count', () => {
      expect(STATE_COUNT).toBe(6)
    })

    it('should have correct transition count', () => {
      expect(TRANSITION_COUNT).toBe(12)
    })

    it('should expose all states', () => {
      expect(ALL_STATES).toEqual([
        'active',
        'calibrating',
        'needs_calibration',
        'faulted',
        'offline',
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
    it('active -> calibrating (StartCalibration)', () => {
      expect(isValidStateTransition('active', 'calibrating')).toBe(true)
      const action = getTransitionAction('active', 'calibrating')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('StartCalibration')
    })

    it('calibrating -> active (CompleteCalibration)', () => {
      expect(isValidStateTransition('calibrating', 'active')).toBe(true)
      const action = getTransitionAction('calibrating', 'active')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('CompleteCalibration')
    })

    it('calibrating -> faulted (FailCalibration)', () => {
      expect(isValidStateTransition('calibrating', 'faulted')).toBe(true)
      const action = getTransitionAction('calibrating', 'faulted')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('FailCalibration')
    })

    it('active -> needs_calibration (FlagForCalibration)', () => {
      expect(isValidStateTransition('active', 'needs_calibration')).toBe(true)
      const action = getTransitionAction('active', 'needs_calibration')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('FlagForCalibration')
    })

    it('needs_calibration -> calibrating (StartCalibration)', () => {
      expect(isValidStateTransition('needs_calibration', 'calibrating')).toBe(true)
      const action = getTransitionAction('needs_calibration', 'calibrating')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('StartCalibration')
    })

    it('active -> faulted (MarkFaulted)', () => {
      expect(isValidStateTransition('active', 'faulted')).toBe(true)
      const action = getTransitionAction('active', 'faulted')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('MarkFaulted')
    })

    it('faulted -> active (ClearFault)', () => {
      expect(isValidStateTransition('faulted', 'active')).toBe(true)
      const action = getTransitionAction('faulted', 'active')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('ClearFault')
    })

    it('faulted -> offline (TakeOffline)', () => {
      expect(isValidStateTransition('faulted', 'offline')).toBe(true)
      const action = getTransitionAction('faulted', 'offline')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('TakeOffline')
    })

    it('active -> offline (TakeOffline)', () => {
      expect(isValidStateTransition('active', 'offline')).toBe(true)
      const action = getTransitionAction('active', 'offline')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('TakeOffline')
    })

    it('offline -> active (BringOnline)', () => {
      expect(isValidStateTransition('offline', 'active')).toBe(true)
      const action = getTransitionAction('offline', 'active')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('BringOnline')
    })

    it('offline -> decommissioned (Decommission)', () => {
      expect(isValidStateTransition('offline', 'decommissioned')).toBe(true)
      const action = getTransitionAction('offline', 'decommissioned')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Decommission')
    })

    it('faulted -> decommissioned (Decommission)', () => {
      expect(isValidStateTransition('faulted', 'decommissioned')).toBe(true)
      const action = getTransitionAction('faulted', 'decommissioned')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('Decommission')
    })
  })

  // =============================================================================
  // Invalid Transitions
  // =============================================================================

  describe('Invalid Transitions', () => {
    it('decommissioned -> active (terminal state, no outgoing)', () => {
      expect(isValidStateTransition('decommissioned', 'active')).toBe(false)
    })

    it('decommissioned -> offline (terminal state, no outgoing)', () => {
      expect(isValidStateTransition('decommissioned', 'offline')).toBe(false)
    })

    it('calibrating -> offline (no direct transition)', () => {
      expect(isValidStateTransition('calibrating', 'offline')).toBe(false)
    })

    it('calibrating -> decommissioned (no direct transition)', () => {
      expect(isValidStateTransition('calibrating', 'decommissioned')).toBe(false)
    })

    it('needs_calibration -> faulted (must go through calibrating first)', () => {
      expect(isValidStateTransition('needs_calibration', 'faulted')).toBe(false)
    })

    it('self-transitions are not defined', () => {
      expect(isValidStateTransition('active', 'active')).toBe(false)
      expect(isValidStateTransition('calibrating', 'calibrating')).toBe(false)
      expect(isValidStateTransition('decommissioned', 'decommissioned')).toBe(false)
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
    it('active has 4 next states: calibrating, needs_calibration, faulted, offline', () => {
      const next = getValidNextStates('active')
      expect(next).toHaveLength(4)
      expect(next).toContain('calibrating')
      expect(next).toContain('needs_calibration')
      expect(next).toContain('faulted')
      expect(next).toContain('offline')
    })

    it('calibrating has 2 next states: active, faulted', () => {
      const next = getValidNextStates('calibrating')
      expect(next).toHaveLength(2)
      expect(next).toContain('active')
      expect(next).toContain('faulted')
    })

    it('needs_calibration has 1 next state: calibrating', () => {
      const next = getValidNextStates('needs_calibration')
      expect(next).toHaveLength(1)
      expect(next).toContain('calibrating')
    })

    it('faulted has 3 next states: active, offline, decommissioned', () => {
      const next = getValidNextStates('faulted')
      expect(next).toHaveLength(3)
      expect(next).toContain('active')
      expect(next).toContain('offline')
      expect(next).toContain('decommissioned')
    })

    it('offline has 2 next states: active, decommissioned', () => {
      const next = getValidNextStates('offline')
      expect(next).toHaveLength(2)
      expect(next).toContain('active')
      expect(next).toContain('decommissioned')
    })

    it('decommissioned has 0 next states (terminal)', () => {
      const next = getValidNextStates('decommissioned')
      expect(next).toHaveLength(0)
    })

    it('active has 3 previous states: calibrating, faulted, offline', () => {
      const prev = getValidPreviousStates('active')
      expect(prev).toHaveLength(3)
      expect(prev).toContain('calibrating')
      expect(prev).toContain('faulted')
      expect(prev).toContain('offline')
    })

    it('calibrating has 2 previous states: active, needs_calibration', () => {
      const prev = getValidPreviousStates('calibrating')
      expect(prev).toHaveLength(2)
      expect(prev).toContain('active')
      expect(prev).toContain('needs_calibration')
    })

    it('needs_calibration has 1 previous state: active', () => {
      const prev = getValidPreviousStates('needs_calibration')
      expect(prev).toHaveLength(1)
      expect(prev).toContain('active')
    })

    it('faulted has 2 previous states: active, calibrating', () => {
      const prev = getValidPreviousStates('faulted')
      expect(prev).toHaveLength(2)
      expect(prev).toContain('active')
      expect(prev).toContain('calibrating')
    })

    it('offline has 2 previous states: faulted, active', () => {
      const prev = getValidPreviousStates('offline')
      expect(prev).toHaveLength(2)
      expect(prev).toContain('faulted')
      expect(prev).toContain('active')
    })

    it('decommissioned has 2 previous states: faulted, offline', () => {
      const prev = getValidPreviousStates('decommissioned')
      expect(prev).toHaveLength(2)
      expect(prev).toContain('faulted')
      expect(prev).toContain('offline')
    })
  })

  // =============================================================================
  // Action-Specific Validators
  // =============================================================================

  describe('Action-Specific Validators', () => {
    it('canStartCalibration: from active or needs_calibration', () => {
      expect(canStartCalibration('active')).toBe(true)
      expect(canStartCalibration('needs_calibration')).toBe(true)
      expect(canStartCalibration('calibrating')).toBe(false)
      expect(canStartCalibration('faulted')).toBe(false)
      expect(canStartCalibration('offline')).toBe(false)
      expect(canStartCalibration('decommissioned')).toBe(false)
    })

    it('canCompleteCalibration: only from calibrating', () => {
      expect(canCompleteCalibration('calibrating')).toBe(true)
      expect(canCompleteCalibration('active')).toBe(false)
      expect(canCompleteCalibration('needs_calibration')).toBe(false)
      expect(canCompleteCalibration('decommissioned')).toBe(false)
    })

    it('canFailCalibration: only from calibrating', () => {
      expect(canFailCalibration('calibrating')).toBe(true)
      expect(canFailCalibration('active')).toBe(false)
      expect(canFailCalibration('needs_calibration')).toBe(false)
      expect(canFailCalibration('decommissioned')).toBe(false)
    })

    it('canFlagForCalibration: only from active', () => {
      expect(canFlagForCalibration('active')).toBe(true)
      expect(canFlagForCalibration('calibrating')).toBe(false)
      expect(canFlagForCalibration('needs_calibration')).toBe(false)
      expect(canFlagForCalibration('faulted')).toBe(false)
      expect(canFlagForCalibration('offline')).toBe(false)
      expect(canFlagForCalibration('decommissioned')).toBe(false)
    })

    it('canMarkFaulted: only from active', () => {
      expect(canMarkFaulted('active')).toBe(true)
      expect(canMarkFaulted('calibrating')).toBe(false)
      expect(canMarkFaulted('offline')).toBe(false)
      expect(canMarkFaulted('faulted')).toBe(false)
      expect(canMarkFaulted('decommissioned')).toBe(false)
    })

    it('canClearFault: only from faulted', () => {
      expect(canClearFault('faulted')).toBe(true)
      expect(canClearFault('active')).toBe(false)
      expect(canClearFault('offline')).toBe(false)
      expect(canClearFault('decommissioned')).toBe(false)
    })

    it('canTakeOffline: from faulted or active', () => {
      expect(canTakeOffline('faulted')).toBe(true)
      expect(canTakeOffline('active')).toBe(true)
      expect(canTakeOffline('calibrating')).toBe(false)
      expect(canTakeOffline('offline')).toBe(false)
      expect(canTakeOffline('decommissioned')).toBe(false)
    })

    it('canBringOnline: only from offline', () => {
      expect(canBringOnline('offline')).toBe(true)
      expect(canBringOnline('active')).toBe(false)
      expect(canBringOnline('faulted')).toBe(false)
      expect(canBringOnline('decommissioned')).toBe(false)
    })

    it('canDecommission: from offline or faulted', () => {
      expect(canDecommission('offline')).toBe(true)
      expect(canDecommission('faulted')).toBe(true)
      expect(canDecommission('active')).toBe(false)
      expect(canDecommission('calibrating')).toBe(false)
      expect(canDecommission('needs_calibration')).toBe(false)
      expect(canDecommission('decommissioned')).toBe(false)
    })

    it('isTerminalState: only decommissioned', () => {
      expect(isTerminalState('decommissioned')).toBe(true)
      expect(isTerminalState('active')).toBe(false)
      expect(isTerminalState('calibrating')).toBe(false)
      expect(isTerminalState('offline')).toBe(false)
    })
  })
})
