/**
 * Device State Graph Tests
 *
 * ISA-95 device lifecycle state transitions.
 * States: provisioned, online, offline, faulted, firmware_update, decommissioned
 * Terminal: decommissioned
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import {
  deviceStateGraph,
  getNodeIndex,
  getStateFromIndex,
  isValidStateTransition,
  getTransitionAction,
  getValidNextStates,
  getValidPreviousStates,
  canGoOnline,
  canGoOffline,
  canMarkFaulted,
  canClearFault,
  canStartFirmwareUpdate,
  canCompleteFirmwareUpdate,
  canFailFirmwareUpdate,
  canDecommission,
  isTerminalState,
  STATE_COUNT,
  TRANSITION_COUNT,
  ALL_STATES,
  TERMINAL_STATES,
  type DeviceStateNode,
  type DeviceTransitionAction,
} from '../../../machines/graphs/device-graph'

// =============================================================================
// Graph Structure
// =============================================================================

describe('Device State Graph', () => {
  describe('Graph Structure', () => {
    it('should have correct state count', () => {
      expect(STATE_COUNT).toBe(6)
    })

    it('should have correct transition count', () => {
      expect(TRANSITION_COUNT).toBe(12)
    })

    it('should expose all states', () => {
      expect(ALL_STATES).toEqual([
        'provisioned',
        'online',
        'offline',
        'faulted',
        'firmware_update',
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
    it('provisioned -> online (GoOnline)', () => {
      expect(isValidStateTransition('provisioned', 'online')).toBe(true)
      const action = getTransitionAction('provisioned', 'online')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('GoOnline')
    })

    it('online -> offline (GoOffline)', () => {
      expect(isValidStateTransition('online', 'offline')).toBe(true)
      const action = getTransitionAction('online', 'offline')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('GoOffline')
    })

    it('offline -> online (GoOnline)', () => {
      expect(isValidStateTransition('offline', 'online')).toBe(true)
      const action = getTransitionAction('offline', 'online')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('GoOnline')
    })

    it('online -> faulted (MarkFaulted)', () => {
      expect(isValidStateTransition('online', 'faulted')).toBe(true)
      const action = getTransitionAction('online', 'faulted')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('MarkFaulted')
    })

    it('offline -> faulted (MarkFaulted)', () => {
      expect(isValidStateTransition('offline', 'faulted')).toBe(true)
      const action = getTransitionAction('offline', 'faulted')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('MarkFaulted')
    })

    it('faulted -> offline (ClearFault)', () => {
      expect(isValidStateTransition('faulted', 'offline')).toBe(true)
      const action = getTransitionAction('faulted', 'offline')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('ClearFault')
    })

    it('online -> firmware_update (StartFirmwareUpdate)', () => {
      expect(isValidStateTransition('online', 'firmware_update')).toBe(true)
      const action = getTransitionAction('online', 'firmware_update')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('StartFirmwareUpdate')
    })

    it('offline -> firmware_update (StartFirmwareUpdate)', () => {
      expect(isValidStateTransition('offline', 'firmware_update')).toBe(true)
      const action = getTransitionAction('offline', 'firmware_update')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('StartFirmwareUpdate')
    })

    it('firmware_update -> online (CompleteFirmwareUpdate)', () => {
      expect(isValidStateTransition('firmware_update', 'online')).toBe(true)
      const action = getTransitionAction('firmware_update', 'online')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('CompleteFirmwareUpdate')
    })

    it('firmware_update -> offline (FailFirmwareUpdate)', () => {
      expect(isValidStateTransition('firmware_update', 'offline')).toBe(true)
      const action = getTransitionAction('firmware_update', 'offline')
      expect(Option.isSome(action)).toBe(true)
      expect(Option.getOrThrow(action)).toBe('FailFirmwareUpdate')
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
    it('decommissioned -> online (terminal state, no outgoing)', () => {
      expect(isValidStateTransition('decommissioned', 'online')).toBe(false)
    })

    it('decommissioned -> provisioned (terminal state, no outgoing)', () => {
      expect(isValidStateTransition('decommissioned', 'provisioned')).toBe(false)
    })

    it('provisioned -> offline (no direct transition)', () => {
      expect(isValidStateTransition('provisioned', 'offline')).toBe(false)
    })

    it('provisioned -> faulted (must go through online first)', () => {
      expect(isValidStateTransition('provisioned', 'faulted')).toBe(false)
    })

    it('faulted -> online (must clear fault to offline first)', () => {
      expect(isValidStateTransition('faulted', 'online')).toBe(false)
    })

    it('self-transitions are not defined', () => {
      expect(isValidStateTransition('provisioned', 'provisioned')).toBe(false)
      expect(isValidStateTransition('online', 'online')).toBe(false)
      expect(isValidStateTransition('decommissioned', 'decommissioned')).toBe(false)
    })

    it('returns None for invalid transition actions', () => {
      const action = getTransitionAction('decommissioned', 'online')
      expect(Option.isNone(action)).toBe(true)
    })
  })

  // =============================================================================
  // Next / Previous States
  // =============================================================================

  describe('Next / Previous States', () => {
    it('provisioned has 1 next state: online', () => {
      const next = getValidNextStates('provisioned')
      expect(next).toHaveLength(1)
      expect(next).toContain('online')
    })

    it('online has 3 next states: offline, faulted, firmware_update', () => {
      const next = getValidNextStates('online')
      expect(next).toHaveLength(3)
      expect(next).toContain('offline')
      expect(next).toContain('faulted')
      expect(next).toContain('firmware_update')
    })

    it('offline has 4 next states: online, faulted, firmware_update, decommissioned', () => {
      const next = getValidNextStates('offline')
      expect(next).toHaveLength(4)
      expect(next).toContain('online')
      expect(next).toContain('faulted')
      expect(next).toContain('firmware_update')
      expect(next).toContain('decommissioned')
    })

    it('faulted has 2 next states: offline, decommissioned', () => {
      const next = getValidNextStates('faulted')
      expect(next).toHaveLength(2)
      expect(next).toContain('offline')
      expect(next).toContain('decommissioned')
    })

    it('firmware_update has 2 next states: online, offline', () => {
      const next = getValidNextStates('firmware_update')
      expect(next).toHaveLength(2)
      expect(next).toContain('online')
      expect(next).toContain('offline')
    })

    it('decommissioned has 0 next states (terminal)', () => {
      const next = getValidNextStates('decommissioned')
      expect(next).toHaveLength(0)
    })

    it('provisioned has 0 previous states (initial)', () => {
      const prev = getValidPreviousStates('provisioned')
      expect(prev).toHaveLength(0)
    })

    it('online has 3 previous states: provisioned, offline, firmware_update', () => {
      const prev = getValidPreviousStates('online')
      expect(prev).toHaveLength(3)
      expect(prev).toContain('provisioned')
      expect(prev).toContain('offline')
      expect(prev).toContain('firmware_update')
    })

    it('offline has 3 previous states: online, faulted, firmware_update', () => {
      const prev = getValidPreviousStates('offline')
      expect(prev).toHaveLength(3)
      expect(prev).toContain('online')
      expect(prev).toContain('faulted')
      expect(prev).toContain('firmware_update')
    })

    it('decommissioned has 2 previous states: offline, faulted', () => {
      const prev = getValidPreviousStates('decommissioned')
      expect(prev).toHaveLength(2)
      expect(prev).toContain('offline')
      expect(prev).toContain('faulted')
    })
  })

  // =============================================================================
  // Action-Specific Validators
  // =============================================================================

  describe('Action-Specific Validators', () => {
    it('canGoOnline: from provisioned or offline', () => {
      expect(canGoOnline('provisioned')).toBe(true)
      expect(canGoOnline('offline')).toBe(true)
      expect(canGoOnline('online')).toBe(false)
      expect(canGoOnline('faulted')).toBe(false)
      expect(canGoOnline('decommissioned')).toBe(false)
    })

    it('canGoOffline: only from online', () => {
      expect(canGoOffline('online')).toBe(true)
      expect(canGoOffline('offline')).toBe(false)
      expect(canGoOffline('provisioned')).toBe(false)
      expect(canGoOffline('decommissioned')).toBe(false)
    })

    it('canMarkFaulted: from online or offline', () => {
      expect(canMarkFaulted('online')).toBe(true)
      expect(canMarkFaulted('offline')).toBe(true)
      expect(canMarkFaulted('provisioned')).toBe(false)
      expect(canMarkFaulted('faulted')).toBe(false)
      expect(canMarkFaulted('decommissioned')).toBe(false)
    })

    it('canClearFault: only from faulted', () => {
      expect(canClearFault('faulted')).toBe(true)
      expect(canClearFault('online')).toBe(false)
      expect(canClearFault('offline')).toBe(false)
      expect(canClearFault('decommissioned')).toBe(false)
    })

    it('canStartFirmwareUpdate: from online or offline', () => {
      expect(canStartFirmwareUpdate('online')).toBe(true)
      expect(canStartFirmwareUpdate('offline')).toBe(true)
      expect(canStartFirmwareUpdate('provisioned')).toBe(false)
      expect(canStartFirmwareUpdate('faulted')).toBe(false)
      expect(canStartFirmwareUpdate('firmware_update')).toBe(false)
      expect(canStartFirmwareUpdate('decommissioned')).toBe(false)
    })

    it('canCompleteFirmwareUpdate: only from firmware_update', () => {
      expect(canCompleteFirmwareUpdate('firmware_update')).toBe(true)
      expect(canCompleteFirmwareUpdate('online')).toBe(false)
      expect(canCompleteFirmwareUpdate('offline')).toBe(false)
      expect(canCompleteFirmwareUpdate('decommissioned')).toBe(false)
    })

    it('canFailFirmwareUpdate: only from firmware_update', () => {
      expect(canFailFirmwareUpdate('firmware_update')).toBe(true)
      expect(canFailFirmwareUpdate('online')).toBe(false)
      expect(canFailFirmwareUpdate('offline')).toBe(false)
      expect(canFailFirmwareUpdate('decommissioned')).toBe(false)
    })

    it('canDecommission: from offline or faulted', () => {
      expect(canDecommission('offline')).toBe(true)
      expect(canDecommission('faulted')).toBe(true)
      expect(canDecommission('provisioned')).toBe(false)
      expect(canDecommission('online')).toBe(false)
      expect(canDecommission('firmware_update')).toBe(false)
      expect(canDecommission('decommissioned')).toBe(false)
    })

    it('isTerminalState: only decommissioned', () => {
      expect(isTerminalState('decommissioned')).toBe(true)
      expect(isTerminalState('provisioned')).toBe(false)
      expect(isTerminalState('online')).toBe(false)
      expect(isTerminalState('offline')).toBe(false)
    })
  })
})
