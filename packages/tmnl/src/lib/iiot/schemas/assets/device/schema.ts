/**
 * Device Entity Schema
 *
 * ISA-95 Level 0 - Control Module (Actuator/Device)
 * Devices WRITE values (control physical equipment), distinct from Sensors which READ values.
 * Both are leaf nodes in the asset hierarchy.
 *
 * @module @gbg/tmnl/iiot/schemas/assets/device
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 */

import { Schema } from 'effect'
import { AssetMetadata, AssetStatus, BaseAssetFields } from '../common/types'
import { MachineId } from '../machine/schema'
import { HierarchyPath } from '../../hierarchy'

// =============================================================================
// DeviceId with Embedded Slug
// =============================================================================

/**
 * Device identifier with embedded slug pattern.
 * Format: 'DEV-{slug}' where slug is alphanumeric with hyphens.
 *
 * @example
 * ```ts
 * const id = makeDeviceId('motor-01') // 'DEV-motor-01'
 * ```
 */
export const DeviceId = Schema.String.pipe(
  Schema.pattern(/^DEV-[a-zA-Z0-9-]+$/),
  Schema.brand('DeviceId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/DeviceId',
    description: 'Device identifier with DEV- prefix and alphanumeric slug',
  })
)
export type DeviceId = typeof DeviceId.Type

/**
 * Factory function to create a DeviceId from a slug.
 *
 * @param slug - Alphanumeric identifier (hyphens allowed)
 * @returns Branded DeviceId
 *
 * @example
 * ```ts
 * const id = makeDeviceId('motor-01') // 'DEV-motor-01'
 * ```
 */
export const makeDeviceId = (slug: string): DeviceId => `DEV-${slug}` as DeviceId

// =============================================================================
// Device Type Literal
// =============================================================================

/**
 * Device type classification for industrial actuators and control equipment.
 * Covers common industrial device categories.
 */
export const DeviceType = Schema.Literal(
  'motor',      // Electric motors
  'valve',      // Control valves
  'pump',       // Pumps
  'heater',     // Heating elements
  'cooler',     // Cooling systems
  'conveyor',   // Conveyor belts
  'actuator',   // Generic actuators
  'servo',      // Servo motors
  'relay',      // Relays/contactors
  'vfd',        // Variable frequency drive
  'solenoid',   // Solenoid valves
  'gripper',    // Robotic grippers
  'light',      // Indicator lights/beacons
  'alarm',      // Audible alarms
  'other'       // Catch-all
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/DeviceType',
    description: 'Device type classification for industrial actuators',
  })
)
export type DeviceType = typeof DeviceType.Type

// =============================================================================
// Control Mode Literal
// =============================================================================

/**
 * Device control mode indicating operational authority.
 */
export const ControlMode = Schema.Literal('manual', 'auto', 'remote', 'local')
export type ControlMode = typeof ControlMode.Type

// =============================================================================
// Power Unit Literal
// =============================================================================

/**
 * Power measurement units for device ratings.
 */
export const PowerUnit = Schema.Literal('watts', 'kilowatts', 'horsepower')
export type PowerUnit = typeof PowerUnit.Type

// =============================================================================
// Device Entity (ISA-95 Level 0)
// =============================================================================

/**
 * Device Entity - ISA-95 Control Module (Actuator)
 *
 * Represents physical actuators and control equipment at the lowest level
 * of the automation pyramid. Devices WRITE values to control physical processes,
 * distinguishing them from Sensors which READ values.
 *
 * ISA-95 Hierarchy Position: Level 0 (Physical Process - Actuator)
 * - Parent: Machine or WorkCell (Work Unit)
 * - Children: None (leaf node)
 *
 * @example
 * ```ts
 * import { DateTime, Option } from 'effect'
 *
 * const motor = new Device({
 *   id: makeDeviceId('spindle-motor-01'),
 *   name: 'Main Spindle Motor',
 *   status: 'active',
 *   machineId: Option.some('MCH-cnc-lathe-001' as MachineId),
 *   deviceType: 'motor',
 *   controlMode: Option.some('auto'),
 *   ratedPower: Option.some(7500),
 *   powerUnit: Option.some('watts'),
 *   lastCommandAt: Option.none(),
 *   opcUaNodeId: Option.some('ns=2;s=CNC.SpindleMotor'),
 *   description: Option.some('Main spindle drive motor'),
 *   createdAt: DateTime.unsafeNow(),
 *   updatedAt: Option.none(),
 *   metadata: {},
 *   hierarchyPath: HierarchyPath.fromSegments([...]),
 *   enterpriseId: Option.some('ENT-acme'),
 *   siteId: Option.some('SIT-chicago'),
 *   areaId: Option.none(),
 *   plantId: Option.some('PLT-main'),
 *   lineId: Option.none(),
 *   workCellId: Option.some('WCL-cell-01'),
 *   location: Option.none(),
 * })
 * ```
 */
export class Device extends Schema.TaggedClass<Device>()('Device', {
  /** Unique device identifier (DEV-{slug} format) */
  id: DeviceId,

  /** Spread common asset fields (name, status, description, location, metadata, timestamps, hierarchy) */
  ...BaseAssetFields,

  /** Device type classification */
  deviceType: DeviceType,

  /** Control mode indicating operational authority */
  controlMode: Schema.optionalWith(ControlMode, { as: 'Option' }),

  /** Rated power capacity */
  ratedPower: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),

  /** Power measurement unit */
  powerUnit: Schema.optionalWith(PowerUnit, { as: 'Option' }),

  /** Timestamp of last command sent to device */
  lastCommandAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** OPC-UA Node ID for integration */
  opcUaNodeId: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  /**
   * Get ISA-95 automation level.
   * Devices are always Level 0 (physical process).
   */
  getAutomationLevel(): 0 {
    return 0
  }

  /**
   * Check if device is operational.
   * Only 'active' status counts as operational for devices
   * (stricter than container asset types).
   */
  isOperational(): boolean {
    return this.status === 'active'
  }

  /**
   * Check if this is a container (can have children).
   * Devices are LEAF nodes - they never contain children.
   */
  isContainer(): false {
    return false
  }

  /**
   * Check if this is an actuator (writes values).
   * Distinguishes Device from Sensor.
   */
  isActuator(): true {
    return true
  }

  /**
   * Get materialized path string from hierarchyPath.
   * Convenience method for path serialization.
   */
  materializePath(): string {
    return this.hierarchyPath.toString()
  }
}

// =============================================================================
// Device Namespace
// =============================================================================

/**
 * Device namespace for schema and type exports.
 *
 * @example
 * ```ts
 * import { Device } from '@gbg/tmnl/iiot/schemas/assets/device'
 *
 * // Access schema
 * const schema = Device.Schema
 *
 * // Access type
 * type DeviceType = Device.Type
 * ```
 */

/** Device entity type alias */
export type DeviceEntity = typeof Device.Type

// =============================================================================
// CreateDeviceParams - Command Parameters
// =============================================================================

/**
 * Parameters for creating a new device.
 * Used by command handlers and RPCs.
 *
 * NOTE: hierarchyPath is computed from parent IDs at creation time.
 */
export const CreateDeviceParams = Schema.Struct({
  /** Slug for the device ID (will be prefixed with DEV-) */
  slug: Schema.NonEmptyString.pipe(
    Schema.pattern(/^[a-zA-Z0-9-]+$/),
    Schema.annotations({
      description: 'Alphanumeric slug for device ID (hyphens allowed)',
    })
  ),

  /** Human-readable name */
  name: Schema.NonEmptyString,

  /** Initial status (defaults to 'active' if not provided) */
  status: Schema.optionalWith(AssetStatus, { default: () => 'active' as const }),

  /** Parent machine ID (required - devices must belong to a machine or workcell) */
  machineId: MachineId,

  /** Device type classification */
  deviceType: DeviceType,

  /** Control mode */
  controlMode: Schema.optional(ControlMode),

  /** Rated power capacity */
  ratedPower: Schema.optional(Schema.Number.pipe(Schema.positive())),

  /** Power measurement unit */
  powerUnit: Schema.optional(PowerUnit),

  /** OPC-UA Node ID */
  opcUaNodeId: Schema.optional(Schema.String),

  /** Description */
  description: Schema.optional(Schema.String),

  /** Extensible metadata */
  metadata: Schema.optional(AssetMetadata),
})
export type CreateDeviceParams = Schema.Schema.Type<typeof CreateDeviceParams>
