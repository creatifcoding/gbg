/**
 * Equipment State Events - TDD Tests
 *
 * Feature: Equipment State Event Validation
 *   As an IIoT system tracking OEE metrics
 *   I want equipment state events with proper schemas
 *   So that I can accurately track availability, performance, and quality
 *
 * @module @gbg/tmnl/iiot/schemas/events/operational/__tests__/equipment-state-events.test.ts
 * @see ISA-95/IEC 62264 for equipment state standards
 * @see OEE calculations: Availability x Performance x Quality
 */

import { describe, it, expect } from 'vitest'
import { Schema, DateTime, Option } from 'effect'

// Import types we'll create
import {
  // Enums
  EquipmentState,
  MaintenanceType,
  FaultSeverity,
  // Events
  EquipmentStateChanged,
  MaintenanceModeEntered,
  MaintenanceModeExited,
  PerformanceDegraded,
  FaultDetected,
  FaultCleared,
  // Union and Tags
  EQUIPMENT_STATE_EVENT_TAGS,
  type EquipmentStateEvent,
} from '../equipment-state-events'

import { MachineId, AssetId, EventId, EquipmentLevel } from '../../../identifiers'

// =============================================================================
// Feature: Equipment State Enums
// =============================================================================

describe('Feature: Equipment State Enums', () => {
  describe('Scenario: EquipmentState enum validation', () => {
    it('Given valid equipment states, When decoding, Then all should succeed', () => {
      const validStates = ['operational', 'degraded', 'faulted', 'maintenance', 'offline']

      validStates.forEach((state) => {
        expect(Schema.decodeUnknownSync(EquipmentState)(state)).toBe(state)
      })
    })

    it('Given invalid equipment state, When decoding, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(EquipmentState)('invalid')).toThrow()
    })
  })

  describe('Scenario: MaintenanceType enum validation', () => {
    it('Given valid maintenance types, When decoding, Then all should succeed', () => {
      const validTypes = ['scheduled', 'unscheduled', 'emergency']

      validTypes.forEach((type) => {
        expect(Schema.decodeUnknownSync(MaintenanceType)(type)).toBe(type)
      })
    })

    it('Given invalid maintenance type, When decoding, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(MaintenanceType)('preventive')).toThrow()
    })
  })

  describe('Scenario: FaultSeverity enum validation', () => {
    it('Given valid fault severities, When decoding, Then all should succeed', () => {
      const validSeverities = ['minor', 'major', 'critical']

      validSeverities.forEach((severity) => {
        expect(Schema.decodeUnknownSync(FaultSeverity)(severity)).toBe(severity)
      })
    })

    it('Given invalid fault severity, When decoding, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(FaultSeverity)('warning')).toThrow()
    })
  })
})

// =============================================================================
// Feature: EquipmentStateChanged Event
// =============================================================================

describe('Feature: EquipmentStateChanged Event', () => {
  describe('Scenario: Valid state transition', () => {
    it('Given operational to degraded transition, When creating event, Then it should succeed', () => {
      const now = DateTime.unsafeNow()
      const event = new EquipmentStateChanged({
        eventId: 'EVT-001' as EventId,
        occurredAt: now,
        causedBy: 'sensor-monitor',
        entityId: 'MCH-001' as AssetId,
        entityType: 'machine' as EquipmentLevel,
        correlationId: Option.none(),
        machineId: 'MCH-001' as MachineId,
        previousState: 'operational',
        newState: 'degraded',
        reason: Option.some('Temperature threshold exceeded'),
        triggeredBy: Option.some('auto-detection'),
      })

      // Note: _tag remains 'BaseOperationalEvent' from parent class
      // Use instanceof or check event-specific fields for type discrimination
      expect(event.previousState).toBe('operational')
      expect(event.newState).toBe('degraded')
      expect(event instanceof EquipmentStateChanged).toBe(true)
    })

    it('Given a transition without reason, When creating event, Then reason should be None', () => {
      const now = DateTime.unsafeNow()
      const event = new EquipmentStateChanged({
        eventId: 'EVT-002' as EventId,
        occurredAt: now,
        causedBy: 'operator-001',
        entityId: 'MCH-002' as AssetId,
        entityType: 'machine' as EquipmentLevel,
        correlationId: Option.none(),
        machineId: 'MCH-002' as MachineId,
        previousState: 'maintenance',
        newState: 'operational',
        reason: Option.none(),
        triggeredBy: Option.none(),
      })

      expect(event.reason._tag).toBe('None')
    })
  })

  describe('Scenario: State machine transitions', () => {
    it('Given faulted state, When transitioning to offline, Then it should succeed', () => {
      const now = DateTime.unsafeNow()
      const event = new EquipmentStateChanged({
        eventId: 'EVT-003' as EventId,
        occurredAt: now,
        causedBy: 'safety-system',
        entityId: 'MCH-003' as AssetId,
        entityType: 'machine' as EquipmentLevel,
        correlationId: Option.none(),
        machineId: 'MCH-003' as MachineId,
        previousState: 'faulted',
        newState: 'offline',
        reason: Option.some('Critical fault requires shutdown'),
        triggeredBy: Option.some('safety-interlock'),
      })

      expect(event.previousState).toBe('faulted')
      expect(event.newState).toBe('offline')
    })
  })
})

// =============================================================================
// Feature: MaintenanceModeEntered Event
// =============================================================================

describe('Feature: MaintenanceModeEntered Event', () => {
  describe('Scenario: Scheduled maintenance', () => {
    it('Given scheduled maintenance, When creating event, Then maintenanceType should be scheduled', () => {
      const now = DateTime.unsafeNow()
      const event = new MaintenanceModeEntered({
        eventId: 'EVT-004' as EventId,
        occurredAt: now,
        causedBy: 'maintenance-system',
        entityId: 'MCH-001' as AssetId,
        entityType: 'machine' as EquipmentLevel,
        correlationId: Option.none(),
        machineId: 'MCH-001' as MachineId,
        maintenanceType: 'scheduled',
        scheduledDuration: Option.some(3600), // 1 hour in seconds
        workOrderId: Option.some('WO-2026-00001'),
        technician: Option.some('TECH-001'),
        notes: Option.some('Quarterly preventive maintenance'),
      })

      expect(event instanceof MaintenanceModeEntered).toBe(true)
      expect(event.maintenanceType).toBe('scheduled')
      expect(event.scheduledDuration._tag).toBe('Some')
    })
  })

  describe('Scenario: Emergency maintenance', () => {
    it('Given emergency maintenance, When creating event, Then no scheduled duration', () => {
      const now = DateTime.unsafeNow()
      const event = new MaintenanceModeEntered({
        eventId: 'EVT-005' as EventId,
        occurredAt: now,
        causedBy: 'operator-001',
        entityId: 'MCH-002' as AssetId,
        entityType: 'machine' as EquipmentLevel,
        correlationId: Option.none(),
        machineId: 'MCH-002' as MachineId,
        maintenanceType: 'emergency',
        scheduledDuration: Option.none(),
        workOrderId: Option.none(),
        technician: Option.some('TECH-002'),
        notes: Option.some('Emergency repair - bearing failure'),
      })

      expect(event.maintenanceType).toBe('emergency')
      expect(event.scheduledDuration._tag).toBe('None')
    })
  })
})

// =============================================================================
// Feature: MaintenanceModeExited Event
// =============================================================================

describe('Feature: MaintenanceModeExited Event', () => {
  describe('Scenario: Successful maintenance completion', () => {
    it('Given successful maintenance, When creating exit event, Then outcome should be successful', () => {
      const now = DateTime.unsafeNow()
      const event = new MaintenanceModeExited({
        eventId: 'EVT-006' as EventId,
        occurredAt: now,
        causedBy: 'technician-001',
        entityId: 'MCH-001' as AssetId,
        entityType: 'machine' as EquipmentLevel,
        correlationId: Option.none(),
        machineId: 'MCH-001' as MachineId,
        actualDuration: 3200, // seconds
        outcome: 'completed',
        workOrderId: Option.some('WO-2026-00001'),
        technician: Option.some('TECH-001'),
        nextMaintenanceDate: Option.some(DateTime.unsafeNow()),
        notes: Option.some('Maintenance completed successfully'),
      })

      expect(event instanceof MaintenanceModeExited).toBe(true)
      expect(event.outcome).toBe('completed')
      expect(event.actualDuration).toBe(3200)
    })
  })

  describe('Scenario: Aborted maintenance', () => {
    it('Given aborted maintenance, When creating exit event, Then outcome should be aborted', () => {
      const now = DateTime.unsafeNow()
      const event = new MaintenanceModeExited({
        eventId: 'EVT-007' as EventId,
        occurredAt: now,
        causedBy: 'supervisor-001',
        entityId: 'MCH-002' as AssetId,
        entityType: 'machine' as EquipmentLevel,
        correlationId: Option.none(),
        machineId: 'MCH-002' as MachineId,
        actualDuration: 600, // 10 minutes
        outcome: 'aborted',
        workOrderId: Option.none(),
        technician: Option.none(),
        nextMaintenanceDate: Option.none(),
        notes: Option.some('Aborted due to urgent production demand'),
      })

      expect(event.outcome).toBe('aborted')
    })
  })
})

// =============================================================================
// Feature: PerformanceDegraded Event
// =============================================================================

describe('Feature: PerformanceDegraded Event', () => {
  describe('Scenario: Performance degradation detection', () => {
    it('Given performance below threshold, When creating event, Then should capture metrics', () => {
      const now = DateTime.unsafeNow()
      const event = new PerformanceDegraded({
        eventId: 'EVT-008' as EventId,
        occurredAt: now,
        causedBy: 'performance-monitor',
        entityId: 'MCH-001' as AssetId,
        entityType: 'machine' as EquipmentLevel,
        correlationId: Option.none(),
        machineId: 'MCH-001' as MachineId,
        performancePercent: 75.5,
        expectedPerformance: 100.0,
        degradationReason: Option.some('Worn tooling'),
        affectedMetrics: ['cycle_time', 'throughput'],
        oeeImpact: Option.some(0.245), // 24.5% impact on OEE
      })

      expect(event instanceof PerformanceDegraded).toBe(true)
      expect(event.performancePercent).toBe(75.5)
      expect(event.expectedPerformance).toBe(100.0)
      expect(event.affectedMetrics).toContain('cycle_time')
    })
  })

  describe('Scenario: Marginal degradation', () => {
    it('Given small performance drop, When creating event, Then should still capture', () => {
      const now = DateTime.unsafeNow()
      const event = new PerformanceDegraded({
        eventId: 'EVT-009' as EventId,
        occurredAt: now,
        causedBy: 'auto-detection',
        entityId: 'MCH-003' as AssetId,
        entityType: 'machine' as EquipmentLevel,
        correlationId: Option.none(),
        machineId: 'MCH-003' as MachineId,
        performancePercent: 95.0,
        expectedPerformance: 100.0,
        degradationReason: Option.none(),
        affectedMetrics: ['quality'],
        oeeImpact: Option.some(0.05),
      })

      expect(event.performancePercent).toBe(95.0)
    })
  })
})

// =============================================================================
// Feature: FaultDetected Event
// =============================================================================

describe('Feature: FaultDetected Event', () => {
  describe('Scenario: Critical fault detection', () => {
    it('Given critical fault, When creating event, Then severity should be critical', () => {
      const now = DateTime.unsafeNow()
      const event = new FaultDetected({
        eventId: 'EVT-010' as EventId,
        occurredAt: now,
        causedBy: 'fault-monitor',
        entityId: 'MCH-001' as AssetId,
        entityType: 'machine' as EquipmentLevel,
        correlationId: Option.none(),
        machineId: 'MCH-001' as MachineId,
        faultCode: 'E-OVERTEMP-001',
        faultSeverity: 'critical',
        faultDescription: 'Motor temperature exceeded safe operating limit',
        affectedComponent: Option.some('spindle-motor'),
        sensorReadings: Option.some({ temperature: 150.5, threshold: 120.0 }),
        recommendedAction: Option.some('Immediate shutdown and inspection required'),
      })

      expect(event instanceof FaultDetected).toBe(true)
      expect(event.faultCode).toBe('E-OVERTEMP-001')
      expect(event.faultSeverity).toBe('critical')
    })
  })

  describe('Scenario: Minor fault detection', () => {
    it('Given minor fault, When creating event, Then operation can continue', () => {
      const now = DateTime.unsafeNow()
      const event = new FaultDetected({
        eventId: 'EVT-011' as EventId,
        occurredAt: now,
        causedBy: 'diagnostic-system',
        entityId: 'MCH-002' as AssetId,
        entityType: 'machine' as EquipmentLevel,
        correlationId: Option.none(),
        machineId: 'MCH-002' as MachineId,
        faultCode: 'W-VIBRATION-002',
        faultSeverity: 'minor',
        faultDescription: 'Elevated vibration detected on bearing #2',
        affectedComponent: Option.some('bearing-2'),
        sensorReadings: Option.some({ vibration: 2.5, threshold: 2.0 }),
        recommendedAction: Option.some('Schedule maintenance within 7 days'),
      })

      expect(event.faultSeverity).toBe('minor')
    })
  })
})

// =============================================================================
// Feature: FaultCleared Event
// =============================================================================

describe('Feature: FaultCleared Event', () => {
  describe('Scenario: Fault resolution', () => {
    it('Given resolved fault, When creating cleared event, Then should reference original fault', () => {
      const now = DateTime.unsafeNow()
      const event = new FaultCleared({
        eventId: 'EVT-012' as EventId,
        occurredAt: now,
        causedBy: 'technician-001',
        entityId: 'MCH-001' as AssetId,
        entityType: 'machine' as EquipmentLevel,
        correlationId: Option.none(),
        machineId: 'MCH-001' as MachineId,
        faultCode: 'E-OVERTEMP-001',
        clearMethod: 'manual',
        verifiedBy: Option.some('TECH-001'),
        resolutionNotes: Option.some('Replaced thermal paste and cleaned cooling fins'),
        downtime: Option.some(7200), // 2 hours in seconds
      })

      expect(event instanceof FaultCleared).toBe(true)
      expect(event.faultCode).toBe('E-OVERTEMP-001')
      expect(event.clearMethod).toBe('manual')
    })
  })

  describe('Scenario: Auto-cleared fault', () => {
    it('Given auto-resolved fault, When creating cleared event, Then method should be auto', () => {
      const now = DateTime.unsafeNow()
      const event = new FaultCleared({
        eventId: 'EVT-013' as EventId,
        occurredAt: now,
        causedBy: 'fault-monitor',
        entityId: 'MCH-002' as AssetId,
        entityType: 'machine' as EquipmentLevel,
        correlationId: Option.none(),
        machineId: 'MCH-002' as MachineId,
        faultCode: 'W-VIBRATION-002',
        clearMethod: 'auto',
        verifiedBy: Option.none(),
        resolutionNotes: Option.some('Vibration returned to normal operating range'),
        downtime: Option.none(),
      })

      expect(event.clearMethod).toBe('auto')
      expect(event.verifiedBy._tag).toBe('None')
    })
  })
})

// =============================================================================
// Feature: Event Tags and Union Type
// =============================================================================

describe('Feature: Event Tags and Union Type', () => {
  describe('Scenario: Event tags array', () => {
    it('Given EQUIPMENT_STATE_EVENT_TAGS, Then it should contain all 6 event tags', () => {
      expect(EQUIPMENT_STATE_EVENT_TAGS).toHaveLength(6)
      expect(EQUIPMENT_STATE_EVENT_TAGS).toContain('EquipmentStateChanged')
      expect(EQUIPMENT_STATE_EVENT_TAGS).toContain('MaintenanceModeEntered')
      expect(EQUIPMENT_STATE_EVENT_TAGS).toContain('MaintenanceModeExited')
      expect(EQUIPMENT_STATE_EVENT_TAGS).toContain('PerformanceDegraded')
      expect(EQUIPMENT_STATE_EVENT_TAGS).toContain('FaultDetected')
      expect(EQUIPMENT_STATE_EVENT_TAGS).toContain('FaultCleared')
    })
  })
})

// =============================================================================
// Feature: OEE Context
// =============================================================================

describe('Feature: OEE Context', () => {
  describe('Scenario: Events support OEE calculations', () => {
    it('Given PerformanceDegraded event, Then it should have oeeImpact field', () => {
      const now = DateTime.unsafeNow()
      const event = new PerformanceDegraded({
        eventId: 'EVT-014' as EventId,
        occurredAt: now,
        causedBy: 'oee-calculator',
        entityId: 'MCH-001' as AssetId,
        entityType: 'machine' as EquipmentLevel,
        correlationId: Option.none(),
        machineId: 'MCH-001' as MachineId,
        performancePercent: 80.0,
        expectedPerformance: 100.0,
        degradationReason: Option.none(),
        affectedMetrics: ['availability'],
        oeeImpact: Option.some(0.20),
      })

      expect(event.oeeImpact._tag).toBe('Some')
      if (event.oeeImpact._tag === 'Some') {
        expect(event.oeeImpact.value).toBe(0.20)
      }
    })

    it('Given FaultCleared event, Then it should have downtime for availability calculation', () => {
      const now = DateTime.unsafeNow()
      const event = new FaultCleared({
        eventId: 'EVT-015' as EventId,
        occurredAt: now,
        causedBy: 'system',
        entityId: 'MCH-001' as AssetId,
        entityType: 'machine' as EquipmentLevel,
        correlationId: Option.none(),
        machineId: 'MCH-001' as MachineId,
        faultCode: 'E-001',
        clearMethod: 'manual',
        verifiedBy: Option.none(),
        resolutionNotes: Option.none(),
        downtime: Option.some(1800), // 30 minutes
      })

      expect(event.downtime._tag).toBe('Some')
      if (event.downtime._tag === 'Some') {
        expect(event.downtime.value).toBe(1800)
      }
    })
  })
})
