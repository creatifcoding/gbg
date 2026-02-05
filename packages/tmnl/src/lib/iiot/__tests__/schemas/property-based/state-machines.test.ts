/**
 * Mode 2: State Machine Transition Tests
 *
 * Tests ISA-18.2 alarm state machine, ISA-95 work order lifecycle,
 * and OEE equipment state transitions.
 *
 * @module @gbg/tmnl/iiot/__tests__/schemas/property-based/state-machines
 */

import { describe, it, expect } from 'vitest'
import {
  property,
  fc,
  Arbitrary,
  ALARM_STATES,
  WORK_ORDER_STATUSES,
  STATE_TYPES,
  generateValidAlarmTransition,
} from './helpers'

// =============================================================================
// Imports: Alarms (ISA-18.2)
// =============================================================================
import {
  Alarm,
  AlarmState,
  isValidTransition,
  canAcknowledge,
  canClear,
  canShelve,
  canSuppress,
  canTakeOutOfService,
  canReturnToService,
} from '../../../schemas/alarms'

// =============================================================================
// Imports: Work Orders (ISA-95)
// =============================================================================
import {
  WorkOrder,
  WorkOrderStatus,
  getValidNextStates,
} from '../../../schemas/work-orders'

// =============================================================================
// Imports: Equipment State (OEE)
// =============================================================================
import {
  EquipmentState,
  isValidStateTransition,
} from '../../../schemas/equipment-state/schema'

// =============================================================================
// MODE 2: State Machine Transition Tests (~28 tests)
// =============================================================================

describe('Mode 2: State Machine Transition Tests', () => {
  describe('Feature: ISA-18.2 Alarm State Machine', () => {
    describe('Scenario: Valid transitions from each state', () => {
      it('unacknowledged can transition to acknowledged, shelved, suppressed, out_of_service', () => {
        const from = 'unacknowledged' as AlarmState
        expect(isValidTransition(from, 'acknowledged' as AlarmState)).toBe(true)
        expect(isValidTransition(from, 'shelved' as AlarmState)).toBe(true)
        expect(isValidTransition(from, 'suppressed' as AlarmState)).toBe(true)
        expect(isValidTransition(from, 'out_of_service' as AlarmState)).toBe(true)
        // Invalid
        expect(isValidTransition(from, 'cleared' as AlarmState)).toBe(false)
      })

      it('acknowledged can transition to cleared, shelved, suppressed, out_of_service', () => {
        const from = 'acknowledged' as AlarmState
        expect(isValidTransition(from, 'cleared' as AlarmState)).toBe(true)
        expect(isValidTransition(from, 'shelved' as AlarmState)).toBe(true)
        expect(isValidTransition(from, 'suppressed' as AlarmState)).toBe(true)
        expect(isValidTransition(from, 'out_of_service' as AlarmState)).toBe(true)
        // Invalid
        expect(isValidTransition(from, 'unacknowledged' as AlarmState)).toBe(false)
      })

      it('shelved can transition to unacknowledged, acknowledged, out_of_service', () => {
        const from = 'shelved' as AlarmState
        expect(isValidTransition(from, 'unacknowledged' as AlarmState)).toBe(true)
        expect(isValidTransition(from, 'acknowledged' as AlarmState)).toBe(true)
        expect(isValidTransition(from, 'out_of_service' as AlarmState)).toBe(true)
      })

      it('suppressed can transition to unacknowledged, acknowledged, out_of_service', () => {
        const from = 'suppressed' as AlarmState
        expect(isValidTransition(from, 'unacknowledged' as AlarmState)).toBe(true)
        expect(isValidTransition(from, 'acknowledged' as AlarmState)).toBe(true)
        expect(isValidTransition(from, 'out_of_service' as AlarmState)).toBe(true)
      })

      it('cleared can only transition to unacknowledged (re-trigger)', () => {
        const from = 'cleared' as AlarmState
        expect(isValidTransition(from, 'unacknowledged' as AlarmState)).toBe(true)
        expect(isValidTransition(from, 'acknowledged' as AlarmState)).toBe(false)
        expect(isValidTransition(from, 'shelved' as AlarmState)).toBe(false)
      })

      it('out_of_service can transition to unacknowledged, cleared', () => {
        const from = 'out_of_service' as AlarmState
        expect(isValidTransition(from, 'unacknowledged' as AlarmState)).toBe(true)
        expect(isValidTransition(from, 'cleared' as AlarmState)).toBe(true)
      })
    })

    describe('Scenario: Helper function consistency', () => {
      it('canAcknowledge returns true only for unacknowledged', () => {
        expect(canAcknowledge('unacknowledged' as AlarmState)).toBe(true)
        expect(canAcknowledge('acknowledged' as AlarmState)).toBe(false)
        expect(canAcknowledge('cleared' as AlarmState)).toBe(false)
      })

      it('canClear returns true only for acknowledged', () => {
        expect(canClear('acknowledged' as AlarmState)).toBe(true)
        expect(canClear('unacknowledged' as AlarmState)).toBe(false)
        expect(canClear('shelved' as AlarmState)).toBe(false)
      })

      it('canShelve returns true for unacknowledged or acknowledged', () => {
        expect(canShelve('unacknowledged' as AlarmState)).toBe(true)
        expect(canShelve('acknowledged' as AlarmState)).toBe(true)
        expect(canShelve('shelved' as AlarmState)).toBe(false)
        expect(canShelve('cleared' as AlarmState)).toBe(false)
      })

      it('canSuppress returns true for unacknowledged or acknowledged', () => {
        expect(canSuppress('unacknowledged' as AlarmState)).toBe(true)
        expect(canSuppress('acknowledged' as AlarmState)).toBe(true)
        expect(canSuppress('suppressed' as AlarmState)).toBe(false)
      })

      it('canTakeOutOfService returns true for all except out_of_service', () => {
        expect(canTakeOutOfService('unacknowledged' as AlarmState)).toBe(true)
        expect(canTakeOutOfService('acknowledged' as AlarmState)).toBe(true)
        expect(canTakeOutOfService('out_of_service' as AlarmState)).toBe(false)
      })

      it('canReturnToService returns true only for out_of_service', () => {
        expect(canReturnToService('out_of_service' as AlarmState)).toBe(true)
        expect(canReturnToService('unacknowledged' as AlarmState)).toBe(false)
      })
    })

    describe('Scenario: Property-based transition tests', () => {
      it('generated valid transitions pass validation', () => {
        fc.assert(
          fc.property(generateValidAlarmTransition(), ({ from, to }) => {
            // Valid transitions should pass
            return isValidTransition(from, to)
          }),
          { numRuns: 50 }
        )
      })

      it('Alarm.canTransitionTo matches isValidTransition', () => {
        fc.assert(
          fc.property(Arbitrary.make(Alarm), fc.constantFrom(...ALARM_STATES), (alarm, target) => {
            return alarm.canTransitionTo(target) === isValidTransition(alarm.state, target)
          }),
          { numRuns: 50 }
        )
      })
    })
  })

  describe('Feature: ISA-95 WorkOrder Lifecycle', () => {
    describe('Scenario: Valid lifecycle transitions', () => {
      it('created can transition to submitted or cancelled', () => {
        const nextStates = getValidNextStates('created')
        expect(nextStates).toContain('submitted')
        expect(nextStates).toContain('cancelled')
        expect(nextStates).not.toContain('started')
      })

      it('submitted can transition to approved or rejected', () => {
        const nextStates = getValidNextStates('submitted')
        expect(nextStates).toContain('approved')
        expect(nextStates).toContain('rejected')
      })

      it('approved can transition to started or cancelled', () => {
        const nextStates = getValidNextStates('approved')
        expect(nextStates).toContain('started')
        expect(nextStates).toContain('cancelled')
      })

      it('started can transition to suspended, completed, or failed', () => {
        const nextStates = getValidNextStates('started')
        expect(nextStates).toContain('suspended')
        expect(nextStates).toContain('completed')
        expect(nextStates).toContain('failed')
      })

      it('suspended can transition to resumed or cancelled', () => {
        const nextStates = getValidNextStates('suspended')
        expect(nextStates).toContain('resumed')
        expect(nextStates).toContain('cancelled')
      })

      it('resumed has same transitions as started', () => {
        const nextStates = getValidNextStates('resumed')
        expect(nextStates).toContain('suspended')
        expect(nextStates).toContain('completed')
        expect(nextStates).toContain('failed')
      })
    })

    describe('Scenario: Terminal states have no successors', () => {
      it('rejected is terminal', () => {
        expect(getValidNextStates('rejected')).toHaveLength(0)
      })

      it('closed is terminal', () => {
        expect(getValidNextStates('closed')).toHaveLength(0)
      })
    })

    describe('Scenario: Entity method consistency', () => {
      property('isActive and isTerminal are mutually exclusive', WorkOrder, (wo) => {
        // A work order cannot be both active and terminal
        if (wo.isActive()) {
          expect(wo.isTerminal()).toBe(false)
        }
        if (wo.isTerminal()) {
          expect(wo.isActive()).toBe(false)
        }
      })

      property('getValidNextStates matches canTransitionTo', WorkOrder, (wo) => {
        const validStates = wo.getValidNextStates()
        for (const status of WORK_ORDER_STATUSES) {
          const canTransition = wo.canTransitionTo(status)
          const inValidStates = validStates.includes(status)
          expect(canTransition).toBe(inValidStates)
        }
      })
    })
  })

  describe('Feature: EquipmentState Transitions', () => {
    describe('Scenario: OEE state transitions', () => {
      it('running can transition to other non-running states', () => {
        expect(isValidStateTransition('running', 'idle')).toBe(true)
        expect(isValidStateTransition('running', 'planned_downtime')).toBe(true)
        expect(isValidStateTransition('running', 'unplanned_downtime')).toBe(true)
        expect(isValidStateTransition('running', 'setup')).toBe(true)
        expect(isValidStateTransition('running', 'blocked')).toBe(true)
        // Self-transition not allowed
        expect(isValidStateTransition('running', 'running')).toBe(false)
      })

      it('self-transitions are never valid', () => {
        for (const state of STATE_TYPES) {
          expect(isValidStateTransition(state, state)).toBe(false)
        }
      })
    })

    describe('Scenario: Entity method consistency', () => {
      property('canTransitionTo matches isValidStateTransition', EquipmentState, (state) => {
        for (const target of STATE_TYPES) {
          expect(state.canTransitionTo(target)).toBe(isValidStateTransition(state.state, target))
        }
      })
    })
  })
})
