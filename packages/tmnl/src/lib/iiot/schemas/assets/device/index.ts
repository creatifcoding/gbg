/**
 * Device Entity Schema Barrel Export
 *
 * @module @gbg/tmnl/iiot/schemas/assets/device
 */

export {
  // DeviceId
  DeviceId,
  makeDeviceId,

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
