/**
 * AnalyticsRecordModel - Effect SQL Model for Historical Analytics
 *
 * Composite primary key (hour, deviceId). Manual repository required.
 * Maps to pg_mooncake columnstore: iiot.analytics_records
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { AnalyticsRecord } from '../../schemas/readings'

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Analytics Record Model
 *
 * Derives from AnalyticsRecord domain schema (schemas/readings.ts).
 * Applies Model-specific transforms for PostgreSQL:
 * - hour → Date (pg driver returns Date objects)
 * - stddev → Model.FieldOption (NULL ↔ Option)
 *
 * PK: (hour, deviceId) - composite
 * Storage: pg_mooncake columnstore for historical analytics
 */
export class AnalyticsRecordModel extends Model.Class<AnalyticsRecordModel>('AnalyticsRecordModel')({
  // Derived from AnalyticsRecord.fields - with pg Date transform
  hour: Schema.DateFromSelf,                      // pg driver returns native Date objects
  deviceId: AnalyticsRecord.fields.deviceId,
  avgValue: AnalyticsRecord.fields.avgValue,
  minValue: AnalyticsRecord.fields.minValue,
  maxValue: AnalyticsRecord.fields.maxValue,
  stddev: Model.FieldOption(Schema.Number),       // Schema.optional → Model.FieldOption
  sampleCount: AnalyticsRecord.fields.sampleCount,
}) {}
