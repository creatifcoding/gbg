/**
 * Device Entity Schema — ISA-95 Level 0 (Field Instrumentation)
 *
 * A physical device (PLC, controller, actuator) attached to a Machine.
 * Devices host one or more Sensors and represent field-level instrumentation.
 *
 * ISA-95 Hierarchy: Enterprise -> Site -> Area -> Plant -> Line -> WorkCell -> Machine -> **Device** -> Sensor
 *
 * @module @gbg/tmnl/iiot/schemas/assets/device
 * @see {@link MachineId} for parent machine
 * @see {@link SensorId} for child sensors
 */

export {
  // DeviceId
  DeviceId,
  makeDeviceId,

  // Status
  DeviceStatus,
  type DeviceStatus as DeviceStatusType,

  // Type enums
  DeviceType,
  ControlMode,
  PowerUnit,

  // Entity class
  Device,
  type DeviceEntity,

  // Command params
  CreateDeviceParams,
} from './schema'
