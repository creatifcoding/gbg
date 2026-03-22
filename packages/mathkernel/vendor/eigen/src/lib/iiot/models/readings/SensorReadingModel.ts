/**
 * SensorReadingModel - Effect SQL Model for Sensor Readings
 *
 * Composite primary key (time, deviceId). Manual repository required.
 * Maps to TimescaleDB hypertable: iiot.sensor_readings
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { SensorReading } from '../../schemas/readings'

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Sensor Reading Model
 *
 * Derives from SensorReading domain schema (schemas/readings.ts).
 * Applies Model-specific transforms for PostgreSQL/TimescaleDB:
 * - time → Date (pg driver returns Date objects)
 * - quality has default in DB
 *
 * PK: (time, deviceId) - composite, no auto-generation
 */
export class SensorReadingModel extends Model.Class<SensorReadingModel>('SensorReadingModel')({
  // Derived from SensorReading.fields - with pg Date transform
  time: Schema.DateFromSelf,                      // pg driver returns native Date objects
  deviceId: SensorReading.fields.deviceId,
  value: SensorReading.fields.value,
  quality: SensorReading.fields.quality,
}) {}
