/**
 * Property-Based Tests: RPC Schema Roundtrip
 *
 * Verifies that Effect Schema encode/decode roundtrip preserves data
 * integrity for all RPC payload and error schemas used in the HTTP layer.
 *
 * Uses Arbitrary.make() from Effect to generate test data compatible
 * with fast-check for property-based testing.
 *
 * @module @gbg/tmnl/iiot/http/__tests__/property/rpc-schema-roundtrip
 */

import { describe, it, expect } from 'vitest'
import { Arbitrary, Schema, FastCheck as fc } from 'effect'

// =============================================================================
// Imports: Asset Entity Schemas
// =============================================================================
import {
  CreatePlantParams,
  PlantStatus,
} from '../../../../iiot/schemas/assets/plant'
import {
  CreateEnterpriseParams,
  EnterpriseStatus,
} from '../../../../iiot/schemas/assets/enterprise'
import {
  CreateLineParams,
  LineStatus,
} from '../../../../iiot/schemas/assets/line'

// =============================================================================
// Imports: Alarm & WorkOrder Schemas
// =============================================================================
import {
  Alarm,
  CreateAlarmParams,
  AcknowledgeAlarmParams,
  ClearAlarmParams,
  AlarmQueryParams,
  AlarmState,
  AlarmSeverity,
  AlarmType,
} from '../../../../iiot/schemas/alarms'
import {
  WorkOrder,
  CreateWorkOrderParams,
  SubmitWorkOrderParams,
  ApproveWorkOrderParams,
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrderType,
} from '../../../../iiot/schemas/work-orders'

// =============================================================================
// Imports: RPC Error Schemas
// =============================================================================
import {
  RpcQueryError,
  RpcGraphError,
  RpcDeviceNotFoundError,
  RpcInvalidReadingError,
  RpcMachineNotFoundError,
  RpcPlantNotFoundError,
  RpcHierarchyError,
  RpcAlarmNotFoundError,
  RpcAlarmAlreadyAcknowledgedError,
  RpcAlarmAlreadyClearedError,
  RpcWorkflowError,
  RpcAlarmWorkflowError,
  RpcMonitorWorkflowError,
} from '../../../../iiot/rpc/errors'

// =============================================================================
// Imports: RPC-specific schemas from AlarmRpcs
// =============================================================================
import { AlarmStats } from '../../../../iiot/rpc/AlarmRpcs'

// =============================================================================
// Constants
// =============================================================================

const NUM_RUNS = 50

// =============================================================================
// Helper: Roundtrip assertion
// =============================================================================

/**
 * Assert encode -> decode roundtrip preserves a schema value.
 * Uses Schema.encodeSync / Schema.decodeSync to verify lossless transformation.
 */
function assertRoundtrip<A, I>(
  schema: Schema.Schema<A, I, never>,
  value: A,
  fieldChecks?: (original: A, decoded: A) => void
): void {
  const encoded = Schema.encodeSync(schema)(value)
  const decoded = Schema.decodeSync(schema)(encoded)
  if (fieldChecks) {
    fieldChecks(value, decoded)
  }
}

/**
 * Property test wrapper: generate arbitrary values and assert roundtrip.
 */
function roundtripProperty<A, I>(
  name: string,
  schema: Schema.Schema<A, I, never>,
  fieldChecks?: (original: A, decoded: A) => void
): void {
  it(name, () => {
    const arb = Arbitrary.make(schema)
    fc.assert(
      fc.property(arb, (value) => {
        assertRoundtrip(schema, value, fieldChecks)
        return true
      }),
      { numRuns: NUM_RUNS }
    )
  })
}

// =============================================================================
// Tests: Literal/Enum Schema Roundtrip
// =============================================================================

describe('RPC Schema Roundtrip', () => {
  describe('Literal/Enum schemas', () => {
    roundtripProperty('AlarmState roundtrip', AlarmState, (orig, dec) => {
      expect(dec).toBe(orig)
    })

    roundtripProperty('AlarmSeverity roundtrip', AlarmSeverity, (orig, dec) => {
      expect(dec).toBe(orig)
    })

    roundtripProperty('AlarmType roundtrip', AlarmType, (orig, dec) => {
      expect(dec).toBe(orig)
    })

    roundtripProperty('PlantStatus roundtrip', PlantStatus, (orig, dec) => {
      expect(dec).toBe(orig)
    })

    roundtripProperty('EnterpriseStatus roundtrip', EnterpriseStatus, (orig, dec) => {
      expect(dec).toBe(orig)
    })

    roundtripProperty('LineStatus roundtrip', LineStatus, (orig, dec) => {
      expect(dec).toBe(orig)
    })

    roundtripProperty('WorkOrderStatus roundtrip', WorkOrderStatus, (orig, dec) => {
      expect(dec).toBe(orig)
    })

    roundtripProperty('WorkOrderPriority roundtrip', WorkOrderPriority, (orig, dec) => {
      expect(dec).toBe(orig)
    })

    roundtripProperty('WorkOrderType roundtrip', WorkOrderType, (orig, dec) => {
      expect(dec).toBe(orig)
    })
  })

  // ===========================================================================
  // Tests: Alarm Command Param Schemas
  // ===========================================================================

  describe('Alarm command schemas', () => {
    roundtripProperty('CreateAlarmParams roundtrip', CreateAlarmParams, (orig, dec) => {
      expect(dec.deviceId).toBe(orig.deviceId)
      expect(dec.alarmType).toBe(orig.alarmType)
      expect(dec.severity).toBe(orig.severity)
    })

    roundtripProperty('AcknowledgeAlarmParams roundtrip', AcknowledgeAlarmParams, (orig, dec) => {
      expect(dec.alarmId).toBe(orig.alarmId)
      expect(dec.acknowledgedBy).toBe(orig.acknowledgedBy)
    })

    roundtripProperty('ClearAlarmParams roundtrip', ClearAlarmParams, (orig, dec) => {
      expect(dec.alarmId).toBe(orig.alarmId)
    })

    roundtripProperty('AlarmQueryParams roundtrip', AlarmQueryParams)
  })

  // ===========================================================================
  // Tests: WorkOrder Command Param Schemas
  // ===========================================================================

  describe('WorkOrder command schemas', () => {
    roundtripProperty('CreateWorkOrderParams roundtrip', CreateWorkOrderParams, (orig, dec) => {
      expect(dec.workflowDefinitionId).toBe(orig.workflowDefinitionId)
      expect(dec.title).toBe(orig.title)
      expect(dec.type).toBe(orig.type)
      expect(dec.priority).toBe(orig.priority)
    })

    roundtripProperty('SubmitWorkOrderParams roundtrip', SubmitWorkOrderParams, (orig, dec) => {
      expect(dec.workOrderId).toBe(orig.workOrderId)
    })

    roundtripProperty('ApproveWorkOrderParams roundtrip', ApproveWorkOrderParams, (orig, dec) => {
      expect(dec.workOrderId).toBe(orig.workOrderId)
      expect(dec.approvalLevel).toBe(orig.approvalLevel)
    })
  })

  // ===========================================================================
  // Tests: Asset Create Param Schemas
  // ===========================================================================

  describe('Asset create param schemas', () => {
    roundtripProperty('CreatePlantParams roundtrip', CreatePlantParams, (orig, dec) => {
      expect(dec.slug).toBe(orig.slug)
      expect(dec.name).toBe(orig.name)
      expect(dec.timezone).toBe(orig.timezone)
    })

    roundtripProperty('CreateEnterpriseParams roundtrip', CreateEnterpriseParams, (orig, dec) => {
      expect(dec.slug).toBe(orig.slug)
      expect(dec.name).toBe(orig.name)
    })

    roundtripProperty('CreateLineParams roundtrip', CreateLineParams, (orig, dec) => {
      expect(dec.slug).toBe(orig.slug)
      expect(dec.name).toBe(orig.name)
      expect(dec.plantId).toBe(orig.plantId)
    })
  })

  // ===========================================================================
  // Tests: RPC Error Schemas
  // ===========================================================================

  describe('RPC error schemas', () => {
    roundtripProperty('RpcQueryError roundtrip', RpcQueryError, (orig, dec) => {
      expect(dec._tag).toBe('RpcQueryError')
      expect(dec.operation).toBe(orig.operation)
      expect(dec.message).toBe(orig.message)
    })

    roundtripProperty('RpcGraphError roundtrip', RpcGraphError, (orig, dec) => {
      expect(dec._tag).toBe('RpcGraphError')
      expect(dec.message).toBe(orig.message)
    })

    roundtripProperty('RpcDeviceNotFoundError roundtrip', RpcDeviceNotFoundError, (orig, dec) => {
      expect(dec._tag).toBe('RpcDeviceNotFoundError')
      expect(dec.deviceId).toBe(orig.deviceId)
    })

    roundtripProperty('RpcInvalidReadingError roundtrip', RpcInvalidReadingError, (orig, dec) => {
      expect(dec._tag).toBe('RpcInvalidReadingError')
      expect(dec.deviceId).toBe(orig.deviceId)
      expect(dec.message).toBe(orig.message)
    })

    roundtripProperty('RpcMachineNotFoundError roundtrip', RpcMachineNotFoundError, (orig, dec) => {
      expect(dec._tag).toBe('RpcMachineNotFoundError')
      expect(dec.machineId).toBe(orig.machineId)
    })

    roundtripProperty('RpcPlantNotFoundError roundtrip', RpcPlantNotFoundError, (orig, dec) => {
      expect(dec._tag).toBe('RpcPlantNotFoundError')
      expect(dec.plantId).toBe(orig.plantId)
    })

    roundtripProperty('RpcHierarchyError roundtrip', RpcHierarchyError, (orig, dec) => {
      expect(dec._tag).toBe('RpcHierarchyError')
      expect(dec.message).toBe(orig.message)
    })

    roundtripProperty('RpcAlarmNotFoundError roundtrip', RpcAlarmNotFoundError, (orig, dec) => {
      expect(dec._tag).toBe('RpcAlarmNotFoundError')
      expect(dec.alarmId).toBe(orig.alarmId)
    })

    roundtripProperty('RpcAlarmAlreadyAcknowledgedError roundtrip', RpcAlarmAlreadyAcknowledgedError, (orig, dec) => {
      expect(dec._tag).toBe('RpcAlarmAlreadyAcknowledgedError')
      expect(dec.alarmId).toBe(orig.alarmId)
    })

    roundtripProperty('RpcAlarmAlreadyClearedError roundtrip', RpcAlarmAlreadyClearedError, (orig, dec) => {
      expect(dec._tag).toBe('RpcAlarmAlreadyClearedError')
      expect(dec.alarmId).toBe(orig.alarmId)
    })

    roundtripProperty('RpcWorkflowError roundtrip', RpcWorkflowError, (orig, dec) => {
      expect(dec._tag).toBe('RpcWorkflowError')
      expect(dec.workflowId).toBe(orig.workflowId)
      expect(dec.message).toBe(orig.message)
    })

    roundtripProperty('RpcAlarmWorkflowError roundtrip', RpcAlarmWorkflowError, (orig, dec) => {
      expect(dec._tag).toBe('RpcAlarmWorkflowError')
      expect(dec.alarmId).toBe(orig.alarmId)
      expect(dec.message).toBe(orig.message)
    })

    roundtripProperty('RpcMonitorWorkflowError roundtrip', RpcMonitorWorkflowError, (orig, dec) => {
      expect(dec._tag).toBe('RpcMonitorWorkflowError')
      expect(dec.deviceId).toBe(orig.deviceId)
      expect(dec.message).toBe(orig.message)
    })
  })

  // ===========================================================================
  // Tests: AlarmStats Schema (RPC-specific)
  // ===========================================================================

  describe('RPC-specific schemas', () => {
    roundtripProperty('AlarmStats roundtrip', AlarmStats, (orig, dec) => {
      expect(dec.total).toBe(orig.total)
      expect(dec.open).toBe(orig.open)
      expect(dec.acknowledged).toBe(orig.acknowledged)
      expect(dec.cleared).toBe(orig.cleared)
    })
  })

  // ===========================================================================
  // Tests: Idempotency (encode -> decode -> encode produces same encoding)
  // ===========================================================================

  describe('Encode idempotency', () => {
    it('CreateAlarmParams: encode is idempotent', () => {
      const arb = Arbitrary.make(CreateAlarmParams)
      fc.assert(
        fc.property(arb, (value) => {
          const encoded1 = Schema.encodeSync(CreateAlarmParams)(value)
          const decoded = Schema.decodeSync(CreateAlarmParams)(encoded1)
          const encoded2 = Schema.encodeSync(CreateAlarmParams)(decoded)
          expect(JSON.stringify(encoded2)).toBe(JSON.stringify(encoded1))
          return true
        }),
        { numRuns: NUM_RUNS }
      )
    })

    it('RpcQueryError: encode is idempotent', () => {
      const arb = Arbitrary.make(RpcQueryError)
      fc.assert(
        fc.property(arb, (value) => {
          const encoded1 = Schema.encodeSync(RpcQueryError)(value)
          const decoded = Schema.decodeSync(RpcQueryError)(encoded1)
          const encoded2 = Schema.encodeSync(RpcQueryError)(decoded)
          expect(JSON.stringify(encoded2)).toBe(JSON.stringify(encoded1))
          return true
        }),
        { numRuns: NUM_RUNS }
      )
    })

    it('CreateEnterpriseParams: encode is idempotent', () => {
      const arb = Arbitrary.make(CreateEnterpriseParams)
      fc.assert(
        fc.property(arb, (value) => {
          const encoded1 = Schema.encodeSync(CreateEnterpriseParams)(value)
          const decoded = Schema.decodeSync(CreateEnterpriseParams)(encoded1)
          const encoded2 = Schema.encodeSync(CreateEnterpriseParams)(decoded)
          expect(JSON.stringify(encoded2)).toBe(JSON.stringify(encoded1))
          return true
        }),
        { numRuns: NUM_RUNS }
      )
    })
  })
})
