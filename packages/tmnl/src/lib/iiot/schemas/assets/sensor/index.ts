/**
 * Sensor Entity Schema Barrel Export
 *
 * @module @gbg/tmnl/iiot/schemas/assets/sensor
 */

export {
  // SensorId
  SensorId,
  makeSensorId,

  // Type enums
  SensorType,
  MeasurementUnit,
  ThresholdStatus,

  // Entity class
  Sensor,
  type SensorEntity,

  // Command params
  CreateSensorParams,
} from './schema'
