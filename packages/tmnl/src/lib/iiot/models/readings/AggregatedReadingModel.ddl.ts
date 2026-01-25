/**
 * AggregatedReadingModel DDL - Co-located database schema for Aggregated Readings
 *
 * Note: The continuous aggregate views are created in SensorReadingModel.ddl.ts
 * since they depend on the sensor_readings hypertable.
 *
 * This file documents the view structure for AggregatedReadingModel mapping.
 *
 * @module
 */

// =============================================================================
// View Schema Documentation
// =============================================================================

/**
 * AggregatedReadingModel maps to TimescaleDB continuous aggregate views:
 *
 * iiot.readings_1min:
 * - bucket: TIMESTAMPTZ (1-minute time bucket)
 * - device_id: TEXT
 * - avg_value: DOUBLE PRECISION
 * - min_value: DOUBLE PRECISION
 * - max_value: DOUBLE PRECISION
 * - stddev_value: DOUBLE PRECISION (nullable)
 * - sample_count: BIGINT
 *
 * iiot.readings_1hour:
 * - bucket: TIMESTAMPTZ (1-hour time bucket)
 * - device_id: TEXT
 * - avg_value: DOUBLE PRECISION
 * - min_value: DOUBLE PRECISION
 * - max_value: DOUBLE PRECISION
 * - avg_stddev: DOUBLE PRECISION (nullable)
 * - sample_count: BIGINT
 *
 * These views are created by SensorReadingModel.ddl.ts:
 * - createReadings1MinAggregate
 * - createReadings1HourAggregate
 */

// Re-export from SensorReadingModel.ddl for explicit dependency
export {
  createReadings1MinAggregate,
  createReadings1HourAggregate,
} from './SensorReadingModel.ddl'
