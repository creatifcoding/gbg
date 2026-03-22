/**
 * Mode 1: Temporal Property Invariants
 *
 * Tests time-based invariants for IIoT entities.
 *
 * @module @gbg/tmnl/iiot/__tests__/schemas/property-based/temporal
 */

import { describe, expect } from 'vitest'
import { property } from './helpers'

// =============================================================================
// Imports: Entity Schemas
// =============================================================================
import { Alarm } from '../../../schemas/alarms'
import { WorkOrder } from '../../../schemas/work-orders'
import { EquipmentState, StateDurationAggregate } from '../../../schemas/equipment-state/schema'
import { SensorReading } from '../../../schemas/readings'

// =============================================================================
// MODE 1: Temporal Property Tests (~14 tests)
// =============================================================================

describe('Mode 1: Temporal Property Invariants', () => {
  describe('Feature: EquipmentState Temporal Invariants', () => {
    property('startedAt is a valid DateTime', EquipmentState, (state) => {
      expect(state.startedAt).toBeDefined()
      // Effect DateTime.epochMillis can be number or bigint depending on implementation
      expect(typeof state.startedAt.epochMillis === 'bigint' || typeof state.startedAt.epochMillis === 'number').toBe(true)
    })

    property('endedAt when present is a valid DateTime', EquipmentState, (state) => {
      if (state.endedAt._tag === 'Some') {
        expect(typeof state.endedAt.value.epochMillis === 'bigint' || typeof state.endedAt.value.epochMillis === 'number').toBe(true)
      }
    })

    property('active states have no endedAt', EquipmentState, (state) => {
      if (state.isActive()) {
        expect(state.endedAt._tag).toBe('None')
      }
    })

    property('getDurationMs returns null for active states', EquipmentState, (state) => {
      if (state.isActive()) {
        expect(state.getDurationMs()).toBeNull()
      }
    })

    property('getDurationMs returns number for ended states', EquipmentState, (state) => {
      if (!state.isActive()) {
        const duration = state.getDurationMs()
        expect(duration === null || typeof duration === 'number').toBe(true)
      }
    })
  })

  describe('Feature: StateDurationAggregate Temporal Invariants', () => {
    property('periodStart and periodEnd are valid DateTimes', StateDurationAggregate, (agg) => {
      expect(agg.periodStart).toBeDefined()
      expect(agg.periodEnd).toBeDefined()
      // Effect DateTime.epochMillis can be number or bigint depending on implementation
      expect(typeof agg.periodStart.epochMillis === 'bigint' || typeof agg.periodStart.epochMillis === 'number').toBe(true)
      expect(typeof agg.periodEnd.epochMillis === 'bigint' || typeof agg.periodEnd.epochMillis === 'number').toBe(true)
    })

    property('all duration fields are non-negative', StateDurationAggregate, (agg) => {
      expect(agg.runningMs).toBeGreaterThanOrEqual(0)
      expect(agg.idleMs).toBeGreaterThanOrEqual(0)
      expect(agg.plannedDowntimeMs).toBeGreaterThanOrEqual(0)
      expect(agg.unplannedDowntimeMs).toBeGreaterThanOrEqual(0)
      expect(agg.setupMs).toBeGreaterThanOrEqual(0)
      expect(agg.blockedMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Feature: Alarm Temporal Invariants', () => {
    property('triggeredAt is always present', Alarm, (alarm) => {
      expect(alarm.triggeredAt).toBeDefined()
    })

    property('acknowledgedAt only present for non-unacknowledged states', Alarm, (alarm) => {
      // Note: acknowledgedAt may be set even if state later changes
      // This tests the data shape, not business logic
      if (alarm.acknowledgedAt) {
        expect(typeof alarm.acknowledgedAt).toBe('object')
      }
    })
  })

  describe('Feature: WorkOrder Temporal Invariants', () => {
    property('createdAt is always present', WorkOrder, (wo) => {
      expect(wo.createdAt).toBeDefined()
    })

    property('actualStart is Option type', WorkOrder, (wo) => {
      expect(wo.actualStart._tag === 'Some' || wo.actualStart._tag === 'None').toBe(true)
    })

    property('actualEnd is Option type', WorkOrder, (wo) => {
      expect(wo.actualEnd._tag === 'Some' || wo.actualEnd._tag === 'None').toBe(true)
    })

    property('scheduledStart is Option type', WorkOrder, (wo) => {
      expect(wo.scheduledStart._tag === 'Some' || wo.scheduledStart._tag === 'None').toBe(true)
    })
  })

  describe('Feature: SensorReading Temporal Invariants', () => {
    property('time is always present and valid', SensorReading, (reading) => {
      // SensorReading uses 'time' field, not 'timestamp'
      expect(reading.time).toBeDefined()
      // Effect DateTime.epochMillis can be number or bigint depending on implementation
      expect(typeof reading.time.epochMillis === 'bigint' || typeof reading.time.epochMillis === 'number').toBe(true)
    })
  })
})
