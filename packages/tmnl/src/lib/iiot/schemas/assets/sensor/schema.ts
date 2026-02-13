/**
 * Sensor Entity Schema
 *
 * ISA-95 Control Module (Level 0) - Physical process instrumentation.
 * Sensors are LEAF nodes in the asset hierarchy - they do not contain children.
 *
 * @module @gbg/tmnl/iiot/schemas/assets/sensor
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 */

import { Option, Schema } from 'effect'
import { AssetMetadata, BaseAssetFields } from '../common/types'
import { MachineId } from '../../identifiers'
import { HierarchyPath } from '../../hierarchy'

// =============================================================================
// SensorId with Embedded Slug
// =============================================================================

/**
 * Sensor identifier with embedded slug.
 * Pattern: 'SNS-{slug}' where slug is alphanumeric with hyphens.
 *
 * @example
 * ```ts
 * const id = makeSensorId('temp-01')  // 'SNS-temp-01'
 * const id2 = makeSensorId('vib-motor-a')  // 'SNS-vib-motor-a'
 * ```
 */
export const SensorId = Schema.String.pipe(
  Schema.pattern(/^SNS-[a-zA-Z0-9-]+$/),
  Schema.brand('SensorId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/SensorId',
    description: 'Sensor identifier with SNS- prefix and alphanumeric slug',
  })
)
export type SensorId = Schema.Schema.Type<typeof SensorId>

/**
 * Factory function to create a SensorId from a slug.
 * @param slug - Alphanumeric identifier (hyphens allowed)
 * @returns Branded SensorId
 */
export const makeSensorId = (slug: string): SensorId => `SNS-${slug}` as SensorId

// =============================================================================
// Sensor Type
// =============================================================================

/**
 * Sensor measurement type classification.
 * Covers common industrial sensor categories.
 */
export const SensorType = Schema.Literal(
  'temperature',
  'pressure',
  'vibration',
  'humidity',
  'flow',
  'level',
  'speed',
  'position',
  'current',
  'voltage',
  'power',
  'force',
  'torque',
  'weight',
  'ph',
  'conductivity',
  'other'
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/SensorType',
    description: 'Sensor measurement type classification',
  })
)
export type SensorType = Schema.Schema.Type<typeof SensorType>

// =============================================================================
// Measurement Unit
// =============================================================================

/**
 * Comprehensive measurement unit literals.
 * Supports SI and imperial units across measurement domains.
 */
export const MeasurementUnit = Schema.Literal(
  // Temperature
  'celsius',
  'fahrenheit',
  'kelvin',
  // Pressure
  'psi',
  'bar',
  'pascal',
  'kpa',
  // Vibration
  'mm_s',
  'in_s',
  'g',
  // Flow
  'l_min',
  'gpm',
  'm3_h',
  // Level
  'meters',
  'feet',
  'mm',
  'inches',
  // General
  'percent',
  'rpm',
  'ampere',
  'volt',
  'watt',
  'newton',
  'nm',
  'kg',
  'count',
  'unitless'
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/MeasurementUnit',
    description: 'Measurement unit for sensor readings',
  })
)
export type MeasurementUnit = Schema.Schema.Type<typeof MeasurementUnit>

// =============================================================================
// Threshold Check Result
// =============================================================================

/**
 * Result of checking a value against sensor thresholds.
 */
export const ThresholdStatus = Schema.Literal('normal', 'warning', 'critical')
export type ThresholdStatus = Schema.Schema.Type<typeof ThresholdStatus>

// =============================================================================
// Sensor Status (domain-specific override)
// =============================================================================

/**
 * Sensor lifecycle status matching the ISA-95 control module (sensing) state graph.
 * Overrides the generic AssetStatus from BaseAssetFields.
 *
 * @see machines/graphs/sensor-graph.ts for transition rules
 */
export const SensorStatus = Schema.Literal(
  'active',
  'calibrating',
  'needs_calibration',
  'faulted',
  'offline',
  'decommissioned'
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/SensorStatus',
    description: 'Sensor lifecycle state per ISA-95 control module (sensing) graph',
  })
)
export type SensorStatus = typeof SensorStatus.Type

// =============================================================================
// Sensor Entity (ISA-95 Level 0)
// =============================================================================

/**
 * Sensor Entity Schema - ISA-95 Control Module
 *
 * Represents physical instrumentation at the lowest level of the automation pyramid.
 * Sensors are LEAF nodes - they do not contain children.
 *
 * @example
 * ```ts
 * import { DateTime, Option } from 'effect'
 *
 * const tempSensor = new Sensor({
 *   id: makeSensorId('temp-motor-01'),
 *   name: 'Motor Temperature Sensor',
 *   status: 'active',
 *   hierarchyPath: HierarchyPath.fromSegments([...]),
 *   machineId: 'MCH-001' as MachineId,
 *   sensorType: 'temperature',
 *   unit: 'celsius',
 *   sampleRateMs: Option.some(1000),
 *   thresholdHigh: Option.some(85),
 *   thresholdCritical: Option.some(95),
 *   thresholdLow: Option.none(),
 *   thresholdCriticalLow: Option.none(),
 *   lastCalibrationDate: Option.none(),
 *   nextCalibrationDate: Option.none(),
 *   opcUaNodeId: Option.some('ns=2;s=Motor01.Temperature'),
 *   description: Option.some('Monitors motor housing temperature'),
 *   createdAt: DateTime.unsafeNow(),
 *   updatedAt: Option.none(),
 *   metadata: {},
 * })
 * ```
 */
export class Sensor extends Schema.TaggedClass<Sensor>()('Sensor', {
  /** Unique sensor identifier (SNS-{slug} format) */
  id: SensorId,

  // Spread base asset fields (name, status, description, location, metadata, timestamps, hierarchy)
  ...BaseAssetFields,

  /** Sensor lifecycle state (overrides generic AssetStatus) */
  status: SensorStatus,

  /** Sensor measurement type */
  sensorType: SensorType,

  /** Measurement unit */
  unit: MeasurementUnit,

  /** Sample rate in milliseconds */
  sampleRateMs: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
    { as: 'Option' }
  ),

  /** High threshold for warning alarms */
  thresholdHigh: Schema.optionalWith(Schema.Number, { as: 'Option' }),

  /** Critical high threshold for critical alarms */
  thresholdCritical: Schema.optionalWith(Schema.Number, { as: 'Option' }),

  /** Low threshold for warning alarms */
  thresholdLow: Schema.optionalWith(Schema.Number, { as: 'Option' }),

  /** Critical low threshold for critical alarms */
  thresholdCriticalLow: Schema.optionalWith(Schema.Number, { as: 'Option' }),

  /** Last calibration date */
  lastCalibrationDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Next scheduled calibration date */
  nextCalibrationDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** OPC-UA Node ID for integration */
  opcUaNodeId: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  /**
   * Get the materialized hierarchy path string.
   * @returns Materialized path (e.g., '/ENT-acme/SIT-chicago/PLT-main/LIN-assembly/MCH-001/SNS-temp-01')
   */
  materializePath(): string {
    return this.hierarchyPath.toString()
  }

  /**
   * Get ISA-95 automation level.
   * Sensors are always Level 0 (physical process).
   */
  getAutomationLevel(): 0 {
    return 0
  }

  /**
   * Check if sensor is operational.
   * Active, calibrating, and needs_calibration sensors are still operational
   * (they continue to produce readings, though quality may vary).
   */
  isOperational(): boolean {
    return this.status === 'active' || this.status === 'calibrating' || this.status === 'needs_calibration'
  }

  /**
   * Check if this is a container (can have children).
   * Sensors are LEAF nodes - they never contain children.
   */
  isContainer(): false {
    return false
  }

  /**
   * Check a value against configured thresholds.
   *
   * @param value - The sensor reading value to check
   * @returns 'normal' | 'warning' | 'critical'
   */
  checkThresholds(value: number): ThresholdStatus {
    // Check critical thresholds first (highest priority)
    if (Option.isSome(this.thresholdCritical) && value >= this.thresholdCritical.value) {
      return 'critical'
    }
    if (Option.isSome(this.thresholdCriticalLow) && value <= this.thresholdCriticalLow.value) {
      return 'critical'
    }

    // Check warning thresholds
    if (Option.isSome(this.thresholdHigh) && value >= this.thresholdHigh.value) {
      return 'warning'
    }
    if (Option.isSome(this.thresholdLow) && value <= this.thresholdLow.value) {
      return 'warning'
    }

    return 'normal'
  }

  /**
   * Check if calibration is overdue.
   *
   * @param now - Current date (defaults to now)
   * @returns true if nextCalibrationDate is set and has passed
   */
  isCalibrationOverdue(now?: Date): boolean {
    if (Option.isNone(this.nextCalibrationDate)) {
      return false
    }
    const checkDate = now ?? new Date()
    const nextCal = new Date(this.nextCalibrationDate.value.epochMillis)
    return checkDate > nextCal
  }
}

// =============================================================================
// Sensor Namespace
// =============================================================================

/**
 * Sensor namespace - Provides clean access to schema and type.
 *
 * @example
 * ```ts
 * import { Sensor } from '@gbg/tmnl/iiot/schemas/assets/sensor'
 *
 * // Access schema class
 * const schema = Sensor.Schema
 *
 * // Access type
 * type SensorType = Sensor.Type
 *
 * // Create instance
 * const sensor = new Sensor.Schema({ ... })
 * ```
 */

/** Sensor entity type alias */
export type SensorEntity = typeof Sensor.Type

// =============================================================================
// CreateSensorParams - Command Parameters
// =============================================================================

/**
 * Parameters for creating a new sensor.
 * Used by command handlers and RPCs.
 */
export const CreateSensorParams = Schema.Struct({
  /** Slug for the sensor ID (will be prefixed with SNS-) */
  slug: Schema.NonEmptyString.pipe(
    Schema.pattern(/^[a-zA-Z0-9-]+$/),
    Schema.annotations({
      description: 'Alphanumeric slug for sensor ID (hyphens allowed)',
    })
  ),

  /** Human-readable name */
  name: Schema.NonEmptyString,

  /** Initial status (defaults to 'active') */
  status: Schema.optionalWith(SensorStatus, { default: () => 'active' as SensorStatus }),

  /** Parent machine ID */
  machineId: MachineId,

  /** Sensor measurement type */
  sensorType: SensorType,

  /** Measurement unit */
  unit: MeasurementUnit,

  /** Sample rate in milliseconds */
  sampleRateMs: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),

  /** High threshold for warning alarms */
  thresholdHigh: Schema.optional(Schema.Number),

  /** Critical high threshold */
  thresholdCritical: Schema.optional(Schema.Number),

  /** Low threshold for warning alarms */
  thresholdLow: Schema.optional(Schema.Number),

  /** Critical low threshold */
  thresholdCriticalLow: Schema.optional(Schema.Number),

  /** OPC-UA Node ID */
  opcUaNodeId: Schema.optional(Schema.String),

  /** Description */
  description: Schema.optional(Schema.String),

  /** Extensible metadata */
  metadata: Schema.optional(AssetMetadata),
})
export type CreateSensorParams = Schema.Schema.Type<typeof CreateSensorParams>
