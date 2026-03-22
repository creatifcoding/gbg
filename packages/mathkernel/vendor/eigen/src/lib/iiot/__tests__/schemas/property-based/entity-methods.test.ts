/**
 * Mode 6: Entity Method Behavior Tests
 *
 * Tests method contracts for all IIoT entity schemas.
 *
 * @module @gbg/tmnl/iiot/__tests__/schemas/property-based/entity-methods
 */

import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import { property, ALARM_STATES } from './helpers'

// =============================================================================
// Imports: Entity Schemas
// =============================================================================
import { Alarm } from '../../../schemas/alarms'
import { WorkOrder } from '../../../schemas/work-orders'
import { EquipmentState } from '../../../schemas/equipment-state/schema'
import { Asset } from '../../../schemas/asset-polymorphic'
import { SensorReading } from '../../../schemas/readings'
import { HierarchyPath, PathSegment } from '../../../schemas/hierarchy'

// =============================================================================
// MODE 6: Method Behavior Tests (~33 tests)
// =============================================================================

describe('Mode 6: Entity Method Behavior Tests', () => {
  describe('Feature: Alarm Method Behavior', () => {
    property('isActive returns boolean', Alarm, (alarm) => {
      expect(typeof alarm.isActive()).toBe('boolean')
    })

    property('isActive is false for cleared or out_of_service', Alarm, (alarm) => {
      if (alarm.state === 'cleared' || alarm.state === 'out_of_service') {
        expect(alarm.isActive()).toBe(false)
      }
    })

    property('isActive is true for other states', Alarm, (alarm) => {
      if (
        alarm.state === 'unacknowledged' ||
        alarm.state === 'acknowledged' ||
        alarm.state === 'shelved' ||
        alarm.state === 'suppressed'
      ) {
        expect(alarm.isActive()).toBe(true)
      }
    })

    property('requiresAttention returns boolean', Alarm, (alarm) => {
      expect(typeof alarm.requiresAttention()).toBe('boolean')
    })

    property('requiresAttention is true only for unacknowledged', Alarm, (alarm) => {
      if (alarm.requiresAttention()) {
        expect(alarm.state).toBe('unacknowledged')
      }
    })

    property('isHidden returns boolean', Alarm, (alarm) => {
      expect(typeof alarm.isHidden()).toBe('boolean')
    })

    property('isHidden is true only for shelved or suppressed', Alarm, (alarm) => {
      if (alarm.isHidden()) {
        expect(['shelved', 'suppressed']).toContain(alarm.state)
      }
    })

    property('canTransitionTo returns boolean', Alarm, (alarm) => {
      for (const state of ALARM_STATES) {
        expect(typeof alarm.canTransitionTo(state)).toBe('boolean')
      }
    })
  })

  describe('Feature: WorkOrder Method Behavior', () => {
    property('isActive returns boolean', WorkOrder, (wo) => {
      expect(typeof wo.isActive()).toBe('boolean')
    })

    property('isExecuting returns boolean', WorkOrder, (wo) => {
      expect(typeof wo.isExecuting()).toBe('boolean')
    })

    property('isExecuting is true for started or resumed', WorkOrder, (wo) => {
      if (wo.isExecuting()) {
        expect(['started', 'resumed']).toContain(wo.status)
      }
    })

    property('isTerminal returns boolean', WorkOrder, (wo) => {
      expect(typeof wo.isTerminal()).toBe('boolean')
    })

    property('isTerminal is true for rejected or closed', WorkOrder, (wo) => {
      if (wo.isTerminal()) {
        expect(['rejected', 'closed']).toContain(wo.status)
      }
    })

    property('requiresApproval returns boolean', WorkOrder, (wo) => {
      expect(typeof wo.requiresApproval()).toBe('boolean')
    })

    property('requiresApproval is true only for submitted', WorkOrder, (wo) => {
      if (wo.requiresApproval()) {
        expect(wo.status).toBe('submitted')
      }
    })

    property('getValidNextStates returns array', WorkOrder, (wo) => {
      expect(Array.isArray(wo.getValidNextStates())).toBe(true)
    })
  })

  describe('Feature: EquipmentState Method Behavior', () => {
    property('isActive returns boolean', EquipmentState, (state) => {
      expect(typeof state.isActive()).toBe('boolean')
    })

    property('isProductive returns boolean', EquipmentState, (state) => {
      expect(typeof state.isProductive()).toBe('boolean')
    })

    property('isProductive is true only for running state', EquipmentState, (state) => {
      if (state.isProductive()) {
        expect(state.state).toBe('running')
      }
    })

    property('isAvailabilityLoss returns boolean', EquipmentState, (state) => {
      expect(typeof state.isAvailabilityLoss()).toBe('boolean')
    })

    property(
      'isAvailabilityLoss is true for planned_downtime or unplanned_downtime',
      EquipmentState,
      (state) => {
        if (state.isAvailabilityLoss()) {
          expect(['planned_downtime', 'unplanned_downtime']).toContain(state.state)
        }
      }
    )

    property('isPerformanceLoss returns boolean', EquipmentState, (state) => {
      expect(typeof state.isPerformanceLoss()).toBe('boolean')
    })

    property('isPerformanceLoss is true for idle, blocked, or setup', EquipmentState, (state) => {
      if (state.isPerformanceLoss()) {
        expect(['idle', 'blocked', 'setup']).toContain(state.state)
      }
    })

    property('getOeeCategory returns valid category', EquipmentState, (state) => {
      const category = state.getOeeCategory()
      expect(['productive', 'availability_loss', 'performance_loss']).toContain(category)
    })
  })

  describe('Feature: Asset Method Behavior', () => {
    property('isOperational returns boolean', Asset, (asset) => {
      expect(typeof asset.isOperational()).toBe('boolean')
    })

    property('isOperational is false for maintenance or decommissioned', Asset, (asset) => {
      if (asset.status === 'maintenance' || asset.status === 'decommissioned') {
        expect(asset.isOperational()).toBe(false)
      }
    })

    property('isActive returns boolean', Asset, (asset) => {
      expect(typeof asset.isActive()).toBe('boolean')
    })

    property('isActive is true only for active status', Asset, (asset) => {
      expect(asset.isActive()).toBe(asset.status === 'active')
    })

    property('isContainer returns boolean', Asset, (asset) => {
      expect(typeof asset.isContainer()).toBe('boolean')
    })

    property('isSensor returns boolean', Asset, (asset) => {
      expect(typeof asset.isSensor()).toBe('boolean')
    })

    property('isSensor and isContainer are mutually exclusive for sensors', Asset, (asset) => {
      if (asset.kind === 'sensor') {
        expect(asset.isSensor()).toBe(true)
        expect(asset.isContainer()).toBe(false)
      }
    })

    property('getAutomationLevel returns valid level or undefined', Asset, (asset) => {
      const level = asset.getAutomationLevel()
      if (level !== undefined) {
        expect([0, 1, 2, 3, 4]).toContain(level)
      }
    })
  })

  describe('Feature: SensorReading Method Behavior', () => {
    property('isUsable returns boolean', SensorReading, (reading) => {
      expect(typeof reading.isUsable()).toBe('boolean')
    })

    property('isGood returns boolean', SensorReading, (reading) => {
      expect(typeof reading.isGood()).toBe('boolean')
    })

    property('quality is between 0 and 100', SensorReading, (reading) => {
      expect(reading.quality).toBeGreaterThanOrEqual(0)
      expect(reading.quality).toBeLessThanOrEqual(100)
    })
  })

  describe('Feature: HierarchyPath Method Behavior', () => {
    it('isEmpty returns true for empty path', () => {
      expect(HierarchyPath.empty().isEmpty).toBe(true)
    })

    it('isEmpty returns false for non-empty path', () => {
      const path = HierarchyPath.root('ENT-test')
      expect(path.isEmpty).toBe(false)
    })

    it('root returns first segment', () => {
      const path = HierarchyPath.root('ENT-test')
      expect(path.root?.id).toBe('ENT-test')
    })

    it('leaf returns last segment', () => {
      const enterprise = new PathSegment({
        level: 'enterprise',
        id: 'ENT-acme',
        name: Option.none(),
      })
      const site = new PathSegment({
        level: 'site',
        id: 'SIT-chicago',
        name: Option.none(),
      })
      const path = HierarchyPath.fromSegments([enterprise, site])
      expect(path.leaf?.id).toBe('SIT-chicago')
    })

    it('depth equals segment count', () => {
      const enterprise = new PathSegment({
        level: 'enterprise',
        id: 'ENT-acme',
        name: Option.none(),
      })
      const site = new PathSegment({
        level: 'site',
        id: 'SIT-chicago',
        name: Option.none(),
      })
      const path = HierarchyPath.fromSegments([enterprise, site])
      expect(path.depth).toBe(2)
      expect(path.segments.length).toBe(2)
    })

    it('toIdArray returns array of IDs', () => {
      const enterprise = new PathSegment({
        level: 'enterprise',
        id: 'ENT-acme',
        name: Option.none(),
      })
      const site = new PathSegment({
        level: 'site',
        id: 'SIT-chicago',
        name: Option.none(),
      })
      const path = HierarchyPath.fromSegments([enterprise, site])
      expect(path.toIdArray()).toEqual(['ENT-acme', 'SIT-chicago'])
    })
  })
})
