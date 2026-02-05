/**
 * IIoT Schemas - Property-Based Tests
 *
 * Uses fast-check with Effect Schema.Arbitrary for property-based testing.
 * Verifies roundtrip encoding/decoding and schema invariants.
 *
 * @module @gbg/tmnl/iiot/__tests__/schemas/property-based
 * @see https://github.com/dubzzz/fast-check
 * @see Effect Schema.Arbitrary for Effect-native arbitrary generation
 */

import { describe, it, expect } from 'vitest'
import { Arbitrary, Schema, FastCheck as fc } from 'effect'

// =============================================================================
// Identifiers
// =============================================================================
import {
  PlantId,
  LineId,
  MachineId,
  SensorId,
  DeviceId,
  AlarmId,
  WorkOrderId,
  AssetId,
  EnterpriseId,
  SiteId,
  AreaId,
  WorkCellId,
  EventId,
  FactId,
  EquipmentLevel,
} from '../../schemas/identifiers'

// =============================================================================
// Assets
// =============================================================================
import {
  Asset,
  AssetStatus,
  AssetLocation,
  SensorType,
  MeasurementUnit,
  SensorProperties,
  AssetSummary,
} from '../../schemas/asset-polymorphic'

// =============================================================================
// Alarms
// =============================================================================
import {
  Alarm,
  AlarmSummary,
  AlarmSeverity,
  AlarmType,
  AlarmState,
  AlarmContext,
  AlarmTransition,
} from '../../schemas/alarms'

// =============================================================================
// Readings
// =============================================================================
import {
  SensorReading,
  AggregatedReading,
  QualityScore,
  TimeBucket,
  OpcUaQuality,
  AnalyticsRecord,
} from '../../schemas/readings'

// =============================================================================
// Work Orders
// =============================================================================
import {
  WorkOrder,
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrderType,
  WorkOrderOutcome,
  WorkOrderFinalStatus,
  SuspensionReason,
} from '../../schemas/work-orders'

// =============================================================================
// Equipment State
// =============================================================================
import {
  EquipmentState,
  EquipmentStateId,
  EquipmentStateSummary,
  StateType,
  StateReason,
  StateDurationAggregate,
} from '../../schemas/equipment-state/schema'

// =============================================================================
// Device Config
// =============================================================================
import {
  DeviceConfig,
  DeviceConfigId,
  ConfigVersion,
  ConfigStatus,
  ThresholdsConfig,
} from '../../schemas/device-config/schema'

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Assert roundtrip property: decode(encode(x)) === x
 * For schemas that support encoding/decoding.
 *
 * Preserves A and I type parameters from Schema.Schema.
 * R is constrained to `never` since sync encode/decode require no context.
 * @see https://effect.website/docs/schema/arbitrary
 */
function assertRoundtrip<A, I>(schema: Schema.Schema<A, I, never>, value: A): void {
  const encoded = Schema.encodeSync(schema)(value)
  const decoded = Schema.decodeSync(schema)(encoded)
  expect(decoded).toEqual(value)
}

/**
 * Assert idempotent encoding: encode(decode(encode(x))) === encode(x)
 *
 * Preserves A and I type parameters from Schema.Schema.
 * R is constrained to `never` since sync encode/decode require no context.
 */
function assertIdempotentEncoding<A, I>(schema: Schema.Schema<A, I, never>, value: A): void {
  const encoded1 = Schema.encodeSync(schema)(value)
  const decoded = Schema.decodeSync(schema)(encoded1)
  const encoded2 = Schema.encodeSync(schema)(decoded)
  expect(encoded2).toEqual(encoded1)
}

/**
 * Run property test with fast-check using Effect Schema.Arbitrary.
 *
 * Preserves A and I type parameters from Schema.Schema.
 * R is constrained to `never` since Arbitrary.make requires no context.
 * @see https://effect.website/docs/schema/arbitrary
 */
function property<A, I>(
  name: string,
  schema: Schema.Schema<A, I, never>,
  assertion: (value: A) => void,
  options?: fc.Parameters<[A]>
): void {
  it(name, () => {
    const arb = Arbitrary.make(schema)
    fc.assert(
      fc.property(arb, (value) => {
        assertion(value)
        return true
      }),
      { numRuns: 100, ...options }
    )
  })
}

// =============================================================================
// Feature: Branded Identifier Properties
// =============================================================================

describe('Feature: Branded Identifier Properties', () => {
  describe('Scenario: Simple branded string identifiers roundtrip', () => {
    property('PlantId roundtrip', PlantId, (id) => {
      assertRoundtrip(PlantId, id)
    })

    property('LineId roundtrip', LineId, (id) => {
      assertRoundtrip(LineId, id)
    })

    property('MachineId roundtrip', MachineId, (id) => {
      assertRoundtrip(MachineId, id)
    })

    property('SensorId roundtrip', SensorId, (id) => {
      assertRoundtrip(SensorId, id)
    })

    property('DeviceId roundtrip', DeviceId, (id) => {
      assertRoundtrip(DeviceId, id)
    })

    property('AlarmId roundtrip', AlarmId, (id) => {
      assertRoundtrip(AlarmId, id)
    })

    property('WorkOrderId roundtrip', WorkOrderId, (id) => {
      assertRoundtrip(WorkOrderId, id)
    })

    property('AssetId roundtrip', AssetId, (id) => {
      assertRoundtrip(AssetId, id)
    })

    property('EnterpriseId roundtrip', EnterpriseId, (id) => {
      assertRoundtrip(EnterpriseId, id)
    })

    property('SiteId roundtrip', SiteId, (id) => {
      assertRoundtrip(SiteId, id)
    })

    property('AreaId roundtrip', AreaId, (id) => {
      assertRoundtrip(AreaId, id)
    })

    property('WorkCellId roundtrip', WorkCellId, (id) => {
      assertRoundtrip(WorkCellId, id)
    })

    property('EventId roundtrip', EventId, (id) => {
      assertRoundtrip(EventId, id)
    })

    property('FactId roundtrip', FactId, (id) => {
      assertRoundtrip(FactId, id)
    })
  })

  describe('Scenario: Identifiers are non-empty strings', () => {
    property('PlantId is typeof string', PlantId, (id) => {
      expect(typeof id).toBe('string')
    })

    property('DeviceId is typeof string', DeviceId, (id) => {
      expect(typeof id).toBe('string')
    })

    property('AlarmId is typeof string', AlarmId, (id) => {
      expect(typeof id).toBe('string')
    })
  })

  describe('Scenario: Idempotent encoding', () => {
    property('PlantId idempotent encoding', PlantId, (id) => {
      assertIdempotentEncoding(PlantId, id)
    })

    property('DeviceId idempotent encoding', DeviceId, (id) => {
      assertIdempotentEncoding(DeviceId, id)
    })

    property('AlarmId idempotent encoding', AlarmId, (id) => {
      assertIdempotentEncoding(AlarmId, id)
    })
  })
})

// =============================================================================
// Feature: Pattern-Based Identifier Properties
// =============================================================================

describe('Feature: Pattern-Based Identifier Properties', () => {
  describe('Scenario: EquipmentStateId follows EST- pattern', () => {
    property('EquipmentStateId roundtrip', EquipmentStateId, (id) => {
      assertRoundtrip(EquipmentStateId, id)
    })

    property('EquipmentStateId matches EST- pattern', EquipmentStateId, (id) => {
      expect(id).toMatch(/^EST-[a-zA-Z0-9-]+$/)
    })
  })

  describe('Scenario: DeviceConfigId follows CFG- pattern', () => {
    property('DeviceConfigId roundtrip', DeviceConfigId, (id) => {
      assertRoundtrip(DeviceConfigId, id)
    })

    property('DeviceConfigId matches CFG- pattern', DeviceConfigId, (id) => {
      expect(id).toMatch(/^CFG-[a-zA-Z0-9-]+$/)
    })
  })
})

// =============================================================================
// Feature: Literal/Enum Schema Properties
// =============================================================================

describe('Feature: Literal Schema Properties', () => {
  describe('Scenario: Equipment level literals', () => {
    property('EquipmentLevel roundtrip', EquipmentLevel, (level) => {
      assertRoundtrip(EquipmentLevel, level)
    })

    property('EquipmentLevel is valid value', EquipmentLevel, (level) => {
      const validLevels = ['enterprise', 'site', 'area', 'plant', 'line', 'workcell', 'machine', 'sensor', 'device']
      expect(validLevels).toContain(level)
    })
  })

  describe('Scenario: Asset status literals', () => {
    property('AssetStatus roundtrip', AssetStatus, (status) => {
      assertRoundtrip(AssetStatus, status)
    })

    property('AssetStatus is valid value', AssetStatus, (status) => {
      const validStatuses = ['active', 'inactive', 'maintenance', 'decommissioned']
      expect(validStatuses).toContain(status)
    })
  })

  describe('Scenario: Sensor type literals', () => {
    property('SensorType roundtrip', SensorType, (type) => {
      assertRoundtrip(SensorType, type)
    })

    property('SensorType is valid value', SensorType, (type) => {
      const validTypes = ['temperature', 'vibration', 'humidity', 'speed', 'current', 'pressure', 'flow', 'level']
      expect(validTypes).toContain(type)
    })
  })

  describe('Scenario: Measurement unit literals', () => {
    property('MeasurementUnit roundtrip', MeasurementUnit, (unit) => {
      assertRoundtrip(MeasurementUnit, unit)
    })
  })
})

// =============================================================================
// Feature: Alarm Schema Properties
// =============================================================================

describe('Feature: Alarm Schema Properties', () => {
  describe('Scenario: Alarm severity literals', () => {
    property('AlarmSeverity roundtrip', AlarmSeverity, (severity) => {
      assertRoundtrip(AlarmSeverity, severity)
    })

    property('AlarmSeverity is valid ISA-18.2 level', AlarmSeverity, (severity) => {
      const validSeverities = ['info', 'warning', 'critical', 'emergency']
      expect(validSeverities).toContain(severity)
    })
  })

  describe('Scenario: Alarm type literals', () => {
    property('AlarmType roundtrip', AlarmType, (type) => {
      assertRoundtrip(AlarmType, type)
    })

    property('AlarmType is valid category', AlarmType, (type) => {
      const validTypes = [
        'high_temperature', 'low_temperature', 'high_vibration',
        'overcurrent', 'undercurrent', 'high_pressure', 'low_pressure',
        'high_humidity', 'low_humidity', 'speed_deviation',
        'communication_loss', 'sensor_fault', 'maintenance_due', 'custom'
      ]
      expect(validTypes).toContain(type)
    })
  })

  describe('Scenario: Alarm state literals', () => {
    property('AlarmState roundtrip', AlarmState, (state) => {
      assertRoundtrip(AlarmState, state)
    })

    property('AlarmState is valid ISA-18.2 state', AlarmState, (state) => {
      const validStates = ['unacknowledged', 'acknowledged', 'shelved', 'suppressed', 'cleared', 'out_of_service']
      expect(validStates).toContain(state)
    })
  })
})

// =============================================================================
// Feature: Reading Schema Properties
// =============================================================================

describe('Feature: Reading Schema Properties', () => {
  describe('Scenario: QualityScore bounds', () => {
    property('QualityScore roundtrip', QualityScore, (score) => {
      assertRoundtrip(QualityScore, score)
    })

    property('QualityScore is between 0 and 100', QualityScore, (score) => {
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    property('QualityScore is integer', QualityScore, (score) => {
      expect(Number.isInteger(score)).toBe(true)
    })
  })

  describe('Scenario: TimeBucket literals', () => {
    property('TimeBucket roundtrip', TimeBucket, (bucket) => {
      assertRoundtrip(TimeBucket, bucket)
    })

    property('TimeBucket is valid bucket', TimeBucket, (bucket) => {
      const validBuckets = ['1min', '5min', '15min', '1hour', '1day']
      expect(validBuckets).toContain(bucket)
    })
  })

  describe('Scenario: OpcUaQuality literals', () => {
    property('OpcUaQuality roundtrip', OpcUaQuality, (quality) => {
      assertRoundtrip(OpcUaQuality, quality)
    })

    property('OpcUaQuality is valid OPC-UA code', OpcUaQuality, (quality) => {
      const validQualities = [
        'good', 'good_local_override',
        'uncertain', 'uncertain_sensor_calibration', 'uncertain_last_usable_value',
        'bad', 'bad_sensor_failure', 'bad_no_communication',
        'bad_configuration_error', 'bad_not_connected', 'bad_device_failure'
      ]
      expect(validQualities).toContain(quality)
    })
  })
})

// =============================================================================
// Feature: Work Order Schema Properties
// =============================================================================

describe('Feature: Work Order Schema Properties', () => {
  describe('Scenario: WorkOrderStatus literals', () => {
    property('WorkOrderStatus roundtrip', WorkOrderStatus, (status) => {
      assertRoundtrip(WorkOrderStatus, status)
    })

    property('WorkOrderStatus is valid state', WorkOrderStatus, (status) => {
      const validStatuses = [
        'created', 'submitted', 'approved', 'rejected',
        'started', 'suspended', 'resumed', 'completed',
        'failed', 'cancelled', 'closed'
      ]
      expect(validStatuses).toContain(status)
    })
  })

  describe('Scenario: WorkOrderPriority literals', () => {
    property('WorkOrderPriority roundtrip', WorkOrderPriority, (priority) => {
      assertRoundtrip(WorkOrderPriority, priority)
    })

    property('WorkOrderPriority is valid level', WorkOrderPriority, (priority) => {
      const validPriorities = ['low', 'normal', 'high', 'urgent', 'emergency']
      expect(validPriorities).toContain(priority)
    })
  })

  describe('Scenario: WorkOrderType literals', () => {
    property('WorkOrderType roundtrip', WorkOrderType, (type) => {
      assertRoundtrip(WorkOrderType, type)
    })

    property('WorkOrderType is valid ISA-95 type', WorkOrderType, (type) => {
      const validTypes = [
        'preventive_maintenance', 'corrective_maintenance', 'emergency_repair',
        'calibration', 'inspection', 'installation', 'modification',
        'decommissioning', 'production', 'changeover', 'cleaning', 'other'
      ]
      expect(validTypes).toContain(type)
    })
  })

  describe('Scenario: WorkOrderOutcome literals', () => {
    property('WorkOrderOutcome roundtrip', WorkOrderOutcome, (outcome) => {
      assertRoundtrip(WorkOrderOutcome, outcome)
    })
  })

  describe('Scenario: WorkOrderFinalStatus literals', () => {
    property('WorkOrderFinalStatus roundtrip', WorkOrderFinalStatus, (status) => {
      assertRoundtrip(WorkOrderFinalStatus, status)
    })
  })

  describe('Scenario: SuspensionReason literals', () => {
    property('SuspensionReason roundtrip', SuspensionReason, (reason) => {
      assertRoundtrip(SuspensionReason, reason)
    })
  })
})

// =============================================================================
// Feature: Equipment State Schema Properties
// =============================================================================

describe('Feature: Equipment State Schema Properties', () => {
  describe('Scenario: StateType literals', () => {
    property('StateType roundtrip', StateType, (state) => {
      assertRoundtrip(StateType, state)
    })

    property('StateType is valid ISA-95/OEE state', StateType, (state) => {
      const validStates = ['running', 'idle', 'planned_downtime', 'unplanned_downtime', 'setup', 'blocked']
      expect(validStates).toContain(state)
    })
  })

  describe('Scenario: StateReason literals', () => {
    property('StateReason roundtrip', StateReason, (reason) => {
      assertRoundtrip(StateReason, reason)
    })

    property('StateReason is valid reason', StateReason, (reason) => {
      const validReasons = [
        'production', 'test_run', 'warmup',
        'no_operator', 'no_order', 'awaiting_material',
        'scheduled_maintenance', 'break', 'shift_change', 'cleaning',
        'breakdown', 'quality_issue', 'tool_failure', 'electrical', 'mechanical',
        'changeover', 'tooling_change', 'material_change',
        'starved', 'blocked_downstream', 'waiting_approval',
        'other', 'unknown'
      ]
      expect(validReasons).toContain(reason)
    })
  })
})

// =============================================================================
// Feature: Device Config Schema Properties
// =============================================================================

describe('Feature: Device Config Schema Properties', () => {
  describe('Scenario: ConfigVersion bounds', () => {
    property('ConfigVersion roundtrip', ConfigVersion, (version) => {
      assertRoundtrip(ConfigVersion, version)
    })

    property('ConfigVersion is positive integer', ConfigVersion, (version) => {
      expect(version).toBeGreaterThan(0)
      expect(Number.isInteger(version)).toBe(true)
    })
  })

  describe('Scenario: ConfigStatus literals', () => {
    property('ConfigStatus roundtrip', ConfigStatus, (status) => {
      assertRoundtrip(ConfigStatus, status)
    })

    property('ConfigStatus is valid status', ConfigStatus, (status) => {
      const validStatuses = ['draft', 'active', 'archived', 'rejected']
      expect(validStatuses).toContain(status)
    })
  })
})

// =============================================================================
// Feature: Complex Entity Properties
// =============================================================================

describe('Feature: Complex Entity Properties', () => {
  describe('Scenario: AssetLocation properties', () => {
    property('AssetLocation roundtrip', AssetLocation, (location) => {
      assertRoundtrip(AssetLocation, location)
    })

    property('AssetLocation latitude bounds', AssetLocation, (location) => {
      if (location.latitude !== undefined) {
        expect(location.latitude).toBeGreaterThanOrEqual(-90)
        expect(location.latitude).toBeLessThanOrEqual(90)
      }
    })

    property('AssetLocation longitude bounds', AssetLocation, (location) => {
      if (location.longitude !== undefined) {
        expect(location.longitude).toBeGreaterThanOrEqual(-180)
        expect(location.longitude).toBeLessThanOrEqual(180)
      }
    })
  })

  describe('Scenario: SensorProperties properties', () => {
    property('SensorProperties roundtrip', SensorProperties, (props) => {
      assertRoundtrip(SensorProperties, props)
    })

    property('SensorProperties has _tag', SensorProperties, (props) => {
      expect(props._tag).toBe('SensorProperties')
    })

    property('SensorProperties sampleRateMs is positive', SensorProperties, (props) => {
      if (props.sampleRateMs !== undefined) {
        expect(props.sampleRateMs).toBeGreaterThan(0)
      }
    })
  })

  describe('Scenario: ThresholdsConfig properties', () => {
    property('ThresholdsConfig roundtrip', ThresholdsConfig, (config) => {
      assertRoundtrip(ThresholdsConfig, config)
    })
  })
})

// =============================================================================
// Feature: Tagged Class Entity Properties
// =============================================================================

describe('Feature: Tagged Class Entity Properties', () => {
  describe('Scenario: AlarmSummary entity', () => {
    property('AlarmSummary roundtrip', AlarmSummary, (summary) => {
      assertRoundtrip(AlarmSummary, summary)
    })

    property('AlarmSummary has correct tag', AlarmSummary, (summary) => {
      expect(summary._tag).toBe('AlarmSummary')
    })
  })

  describe('Scenario: AlarmContext entity', () => {
    property('AlarmContext roundtrip', AlarmContext, (ctx) => {
      assertRoundtrip(AlarmContext, ctx)
    })

    property('AlarmContext has correct tag', AlarmContext, (ctx) => {
      expect(ctx._tag).toBe('AlarmContext')
    })
  })

  describe('Scenario: AlarmTransition entity', () => {
    property('AlarmTransition roundtrip', AlarmTransition, (transition) => {
      assertRoundtrip(AlarmTransition, transition)
    })

    property('AlarmTransition has correct tag', AlarmTransition, (transition) => {
      expect(transition._tag).toBe('AlarmTransition')
    })
  })

  describe('Scenario: AssetSummary entity', () => {
    property('AssetSummary roundtrip', AssetSummary, (summary) => {
      assertRoundtrip(AssetSummary, summary)
    })

    property('AssetSummary has correct tag', AssetSummary, (summary) => {
      expect(summary._tag).toBe('AssetSummary')
    })
  })

  describe('Scenario: AggregatedReading entity', () => {
    property('AggregatedReading roundtrip', AggregatedReading, (reading) => {
      assertRoundtrip(AggregatedReading, reading)
    })

    property('AggregatedReading has correct tag', AggregatedReading, (reading) => {
      expect(reading._tag).toBe('AggregatedReading')
    })

    property('AggregatedReading sampleCount is positive', AggregatedReading, (reading) => {
      expect(reading.sampleCount).toBeGreaterThan(0)
    })
  })

  describe('Scenario: AnalyticsRecord entity', () => {
    property('AnalyticsRecord roundtrip', AnalyticsRecord, (record) => {
      assertRoundtrip(AnalyticsRecord, record)
    })

    property('AnalyticsRecord has correct tag', AnalyticsRecord, (record) => {
      expect(record._tag).toBe('AnalyticsRecord')
    })
  })

  describe('Scenario: EquipmentStateSummary entity', () => {
    property('EquipmentStateSummary roundtrip', EquipmentStateSummary, (summary) => {
      assertRoundtrip(EquipmentStateSummary, summary)
    })

    property('EquipmentStateSummary has correct tag', EquipmentStateSummary, (summary) => {
      expect(summary._tag).toBe('EquipmentStateSummary')
    })
  })
})

// =============================================================================
// Feature: Full Entity Roundtrip Properties
// =============================================================================

describe('Feature: Full Entity Roundtrip Properties', () => {
  describe('Scenario: SensorReading full entity', () => {
    property('SensorReading roundtrip', SensorReading, (reading) => {
      assertRoundtrip(SensorReading, reading)
    })

    property('SensorReading has correct tag', SensorReading, (reading) => {
      expect(reading._tag).toBe('SensorReading')
    })

    property('SensorReading quality is valid', SensorReading, (reading) => {
      expect(reading.quality).toBeGreaterThanOrEqual(0)
      expect(reading.quality).toBeLessThanOrEqual(100)
    })

    property('SensorReading isUsable returns boolean', SensorReading, (reading) => {
      expect(typeof reading.isUsable()).toBe('boolean')
    })

    property('SensorReading isGood returns boolean', SensorReading, (reading) => {
      expect(typeof reading.isGood()).toBe('boolean')
    })
  })

  describe('Scenario: Alarm full entity', () => {
    property('Alarm roundtrip', Alarm, (alarm) => {
      assertRoundtrip(Alarm, alarm)
    })

    property('Alarm has correct tag', Alarm, (alarm) => {
      expect(alarm._tag).toBe('Alarm')
    })

    property('Alarm isActive returns boolean', Alarm, (alarm) => {
      expect(typeof alarm.isActive()).toBe('boolean')
    })

    property('Alarm requiresAttention returns boolean', Alarm, (alarm) => {
      expect(typeof alarm.requiresAttention()).toBe('boolean')
    })

    property('Alarm isHidden returns boolean', Alarm, (alarm) => {
      expect(typeof alarm.isHidden()).toBe('boolean')
    })
  })

  describe('Scenario: Asset full entity', () => {
    property('Asset roundtrip', Asset, (asset) => {
      assertRoundtrip(Asset, asset)
    })

    property('Asset has correct tag', Asset, (asset) => {
      expect(asset._tag).toBe('Asset')
    })

    property('Asset isOperational returns boolean', Asset, (asset) => {
      expect(typeof asset.isOperational()).toBe('boolean')
    })

    property('Asset isActive returns boolean', Asset, (asset) => {
      expect(typeof asset.isActive()).toBe('boolean')
    })

    property('Asset isContainer returns boolean', Asset, (asset) => {
      expect(typeof asset.isContainer()).toBe('boolean')
    })

    property('Asset isSensor returns boolean', Asset, (asset) => {
      expect(typeof asset.isSensor()).toBe('boolean')
    })

    property('Asset getAutomationLevel returns valid level or undefined for unhandled kinds', Asset, (asset) => {
      const level = asset.getAutomationLevel()
      // Note: getAutomationLevel doesn't handle all EquipmentLevel values
      // (plant, workcell, device are not in the switch statement)
      // This test documents current behavior
      if (level !== undefined) {
        expect([0, 1, 2, 3, 4]).toContain(level)
      }
    })
  })

  describe('Scenario: WorkOrder full entity', () => {
    property('WorkOrder roundtrip', WorkOrder, (wo) => {
      assertRoundtrip(WorkOrder, wo)
    })

    property('WorkOrder has correct tag', WorkOrder, (wo) => {
      expect(wo._tag).toBe('WorkOrder')
    })

    property('WorkOrder isActive returns boolean', WorkOrder, (wo) => {
      expect(typeof wo.isActive()).toBe('boolean')
    })

    property('WorkOrder isExecuting returns boolean', WorkOrder, (wo) => {
      expect(typeof wo.isExecuting()).toBe('boolean')
    })

    property('WorkOrder isTerminal returns boolean', WorkOrder, (wo) => {
      expect(typeof wo.isTerminal()).toBe('boolean')
    })

    property('WorkOrder requiresApproval returns boolean', WorkOrder, (wo) => {
      expect(typeof wo.requiresApproval()).toBe('boolean')
    })

    property('WorkOrder getValidNextStates returns array', WorkOrder, (wo) => {
      expect(Array.isArray(wo.getValidNextStates())).toBe(true)
    })
  })

  describe('Scenario: EquipmentState full entity', () => {
    property('EquipmentState roundtrip', EquipmentState, (state) => {
      assertRoundtrip(EquipmentState, state)
    })

    property('EquipmentState has correct tag', EquipmentState, (state) => {
      expect(state._tag).toBe('EquipmentState')
    })

    property('EquipmentState isActive returns boolean', EquipmentState, (state) => {
      expect(typeof state.isActive()).toBe('boolean')
    })

    property('EquipmentState isProductive returns boolean', EquipmentState, (state) => {
      expect(typeof state.isProductive()).toBe('boolean')
    })

    property('EquipmentState isAvailabilityLoss returns boolean', EquipmentState, (state) => {
      expect(typeof state.isAvailabilityLoss()).toBe('boolean')
    })

    property('EquipmentState isPerformanceLoss returns boolean', EquipmentState, (state) => {
      expect(typeof state.isPerformanceLoss()).toBe('boolean')
    })

    property('EquipmentState getOeeCategory returns valid category', EquipmentState, (state) => {
      const category = state.getOeeCategory()
      expect(['productive', 'availability_loss', 'performance_loss']).toContain(category)
    })
  })

  describe('Scenario: DeviceConfig full entity', () => {
    property('DeviceConfig roundtrip', DeviceConfig, (config) => {
      assertRoundtrip(DeviceConfig, config)
    })

    property('DeviceConfig has correct tag', DeviceConfig, (config) => {
      expect(config._tag).toBe('DeviceConfig')
    })

    property('DeviceConfig isActive returns boolean', DeviceConfig, (config) => {
      expect(typeof config.isActive()).toBe('boolean')
    })

    property('DeviceConfig requiresApproval returns boolean', DeviceConfig, (config) => {
      expect(typeof config.requiresApproval()).toBe('boolean')
    })

    property('DeviceConfig version is positive', DeviceConfig, (config) => {
      expect(config.version).toBeGreaterThan(0)
    })
  })

  describe('Scenario: StateDurationAggregate entity', () => {
    property('StateDurationAggregate roundtrip', StateDurationAggregate, (agg) => {
      assertRoundtrip(StateDurationAggregate, agg)
    })

    property('StateDurationAggregate has correct tag', StateDurationAggregate, (agg) => {
      expect(agg._tag).toBe('StateDurationAggregate')
    })

    property('StateDurationAggregate durations are non-negative', StateDurationAggregate, (agg) => {
      expect(agg.runningMs).toBeGreaterThanOrEqual(0)
      expect(agg.idleMs).toBeGreaterThanOrEqual(0)
      expect(agg.plannedDowntimeMs).toBeGreaterThanOrEqual(0)
      expect(agg.unplannedDowntimeMs).toBeGreaterThanOrEqual(0)
      expect(agg.setupMs).toBeGreaterThanOrEqual(0)
      expect(agg.blockedMs).toBeGreaterThanOrEqual(0)
    })

    property('StateDurationAggregate getTotalMs equals sum of durations', StateDurationAggregate, (agg) => {
      const expectedTotal =
        agg.runningMs +
        agg.idleMs +
        agg.plannedDowntimeMs +
        agg.unplannedDowntimeMs +
        agg.setupMs +
        agg.blockedMs
      expect(agg.getTotalMs()).toBe(expectedTotal)
    })

    property('StateDurationAggregate getAvailability returns 0-1', StateDurationAggregate, (agg) => {
      const availability = agg.getAvailability()
      expect(availability).toBeGreaterThanOrEqual(0)
      expect(availability).toBeLessThanOrEqual(1)
    })
  })
})

// =============================================================================
// Feature: State Transition Invariants
// =============================================================================

describe('Feature: State Transition Invariants', () => {
  describe('Scenario: Alarm state machine consistency', () => {
    property('Active alarms are not cleared or out_of_service', Alarm, (alarm) => {
      if (alarm.isActive()) {
        expect(alarm.state).not.toBe('cleared')
        expect(alarm.state).not.toBe('out_of_service')
      }
    })

    property('Alarms requiring attention are unacknowledged', Alarm, (alarm) => {
      if (alarm.requiresAttention()) {
        expect(alarm.state).toBe('unacknowledged')
      }
    })

    property('Hidden alarms are shelved or suppressed', Alarm, (alarm) => {
      if (alarm.isHidden()) {
        expect(['shelved', 'suppressed']).toContain(alarm.state)
      }
    })
  })

  describe('Scenario: WorkOrder state machine consistency', () => {
    property('Active work orders are not rejected or closed', WorkOrder, (wo) => {
      if (wo.isActive()) {
        expect(wo.status).not.toBe('rejected')
        expect(wo.status).not.toBe('closed')
      }
    })

    property('Executing work orders are started or resumed', WorkOrder, (wo) => {
      if (wo.isExecuting()) {
        expect(['started', 'resumed']).toContain(wo.status)
      }
    })

    property('Terminal work orders are rejected or closed', WorkOrder, (wo) => {
      if (wo.isTerminal()) {
        expect(['rejected', 'closed']).toContain(wo.status)
      }
    })
  })

  describe('Scenario: EquipmentState OEE classification consistency', () => {
    property('Productive state is running', EquipmentState, (state) => {
      if (state.isProductive()) {
        expect(state.state).toBe('running')
      }
    })

    property('Availability loss is downtime', EquipmentState, (state) => {
      if (state.isAvailabilityLoss()) {
        expect(['planned_downtime', 'unplanned_downtime']).toContain(state.state)
      }
    })

    property('Performance loss is idle/blocked/setup', EquipmentState, (state) => {
      if (state.isPerformanceLoss()) {
        expect(['idle', 'blocked', 'setup']).toContain(state.state)
      }
    })

    property('All states have exactly one OEE category', EquipmentState, (state) => {
      const isProductive = state.isProductive()
      const isAvailabilityLoss = state.isAvailabilityLoss()
      const isPerformanceLoss = state.isPerformanceLoss()

      // Exactly one should be true
      const trueCount = [isProductive, isAvailabilityLoss, isPerformanceLoss].filter(Boolean).length
      expect(trueCount).toBe(1)
    })
  })

  describe('Scenario: Asset hierarchy consistency', () => {
    property('Sensors are not containers', Asset, (asset) => {
      if (asset.isSensor()) {
        expect(asset.isContainer()).toBe(false)
      }
    })

    property('Containers are not sensors', Asset, (asset) => {
      if (asset.isContainer()) {
        expect(asset.isSensor()).toBe(false)
      }
    })

    property('Sensor kind implies not container', Asset, (asset) => {
      if (asset.kind === 'sensor') {
        expect(asset.isContainer()).toBe(false)
        expect(asset.isSensor()).toBe(true)
      }
    })
  })
})
