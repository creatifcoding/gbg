/**
 * Sensor Entity Schema — ISA-95 Level 0 (Field Instrumentation - measurement)
 *
 * A sensor or measurement point on a Device. Sensors produce time-series readings
 * (temperature, pressure, flow, vibration) stored in TimescaleDB.
 *
 * ISA-95 Hierarchy: Enterprise -> Site -> Area -> Plant -> Line -> WorkCell -> Machine -> Device -> **Sensor**
 *
 * @module @gbg/tmnl/iiot/schemas/assets/sensor
 * @see {@link DeviceId} for parent device
 */

export {
  // SensorId
  SensorId,
  makeSensorId,

  // Status
  SensorStatus,
  type SensorStatus as SensorStatusType,

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
