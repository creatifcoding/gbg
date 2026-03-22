/**
 * Mode 5: OEE Calculation Invariants
 *
 * Tests mathematical correctness of OEE (Overall Equipment Effectiveness) calculations.
 *
 * @module @gbg/tmnl/iiot/__tests__/schemas/property-based/oee-calculations
 */

import { describe, it, expect } from 'vitest'
import { property, categoryForState, STATE_TYPES } from './helpers'

// =============================================================================
// Imports: Equipment State (OEE)
// =============================================================================
import {
  EquipmentState,
  StateDurationAggregate,
} from '../../../schemas/equipment-state/schema'

// =============================================================================
// MODE 5: OEE Calculation Invariants (~20 tests)
// =============================================================================

describe('Mode 5: OEE Calculation Invariants', () => {
  describe('Feature: OEE Calculation Invariants', () => {
    describe('Scenario: Availability bounded [0, 1]', () => {
      property('getAvailability returns value between 0 and 1', StateDurationAggregate, (agg) => {
        const availability = agg.getAvailability()
        expect(availability).toBeGreaterThanOrEqual(0)
        expect(availability).toBeLessThanOrEqual(1)
      })

      property('zero running time yields zero availability', StateDurationAggregate, (agg) => {
        // If running = 0 and unplanned_downtime > 0, availability should be 0
        if (agg.runningMs === 0) {
          expect(agg.getAvailability()).toBe(0)
        }
      })
    })

    describe('Scenario: Total time equals sum of components', () => {
      property('getTotalMs equals sum of all duration components', StateDurationAggregate, (agg) => {
        const expectedTotal =
          agg.runningMs +
          agg.idleMs +
          agg.plannedDowntimeMs +
          agg.unplannedDowntimeMs +
          agg.setupMs +
          agg.blockedMs
        expect(agg.getTotalMs()).toBe(expectedTotal)
      })

      property(
        'getTotalDowntimeMs equals planned + unplanned downtime',
        StateDurationAggregate,
        (agg) => {
          const expectedDowntime = agg.plannedDowntimeMs + agg.unplannedDowntimeMs
          expect(agg.getTotalDowntimeMs()).toBe(expectedDowntime)
        }
      )

      property(
        'getTotalPerformanceLossMs equals idle + blocked + setup',
        StateDurationAggregate,
        (agg) => {
          const expectedLoss = agg.idleMs + agg.blockedMs + agg.setupMs
          expect(agg.getTotalPerformanceLossMs()).toBe(expectedLoss)
        }
      )
    })

    describe('Scenario: Productive time <= total time', () => {
      property('running time does not exceed total time', StateDurationAggregate, (agg) => {
        expect(agg.runningMs).toBeLessThanOrEqual(agg.getTotalMs())
      })

      property('downtime does not exceed total time', StateDurationAggregate, (agg) => {
        expect(agg.getTotalDowntimeMs()).toBeLessThanOrEqual(agg.getTotalMs())
      })

      property('performance loss does not exceed total time', StateDurationAggregate, (agg) => {
        expect(agg.getTotalPerformanceLossMs()).toBeLessThanOrEqual(agg.getTotalMs())
      })
    })

    describe('Scenario: OEE category mutual exclusivity', () => {
      property('each EquipmentState has exactly one OEE category', EquipmentState, (state) => {
        const isProductive = state.isProductive()
        const isAvailabilityLoss = state.isAvailabilityLoss()
        const isPerformanceLoss = state.isPerformanceLoss()

        const trueCount = [isProductive, isAvailabilityLoss, isPerformanceLoss].filter(Boolean)
          .length
        expect(trueCount).toBe(1)
      })

      property('getOeeCategory matches boolean methods', EquipmentState, (state) => {
        const category = state.getOeeCategory()

        if (category === 'productive') {
          expect(state.isProductive()).toBe(true)
          expect(state.isAvailabilityLoss()).toBe(false)
          expect(state.isPerformanceLoss()).toBe(false)
        } else if (category === 'availability_loss') {
          expect(state.isProductive()).toBe(false)
          expect(state.isAvailabilityLoss()).toBe(true)
          expect(state.isPerformanceLoss()).toBe(false)
        } else if (category === 'performance_loss') {
          expect(state.isProductive()).toBe(false)
          expect(state.isAvailabilityLoss()).toBe(false)
          expect(state.isPerformanceLoss()).toBe(true)
        }
      })
    })

    describe('Scenario: State type to category mapping', () => {
      it('running maps to productive', () => {
        expect(categoryForState('running')).toBe('productive')
      })

      it('planned_downtime maps to availability_loss', () => {
        expect(categoryForState('planned_downtime')).toBe('availability_loss')
      })

      it('unplanned_downtime maps to availability_loss', () => {
        expect(categoryForState('unplanned_downtime')).toBe('availability_loss')
      })

      it('idle maps to performance_loss', () => {
        expect(categoryForState('idle')).toBe('performance_loss')
      })

      it('blocked maps to performance_loss', () => {
        expect(categoryForState('blocked')).toBe('performance_loss')
      })

      it('setup maps to performance_loss', () => {
        expect(categoryForState('setup')).toBe('performance_loss')
      })
    })
  })
})
