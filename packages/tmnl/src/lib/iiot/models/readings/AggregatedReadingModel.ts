/**
 * AggregatedReadingModel - Effect SQL Model for Aggregated Readings
 *
 * Composite primary key (bucket, deviceId). Manual repository required.
 * Maps to TimescaleDB continuous aggregate views.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { AggregatedReading } from '../../schemas/readings'

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Aggregated Reading Model
 *
 * Derives from AggregatedReading domain schema (schemas/readings.ts).
 * Applies Model-specific transforms for PostgreSQL:
 * - bucket → Date (pg driver returns Date objects)
 * - stddevValue → Model.FieldOption (NULL ↔ Option)
 *
 * PK: (bucket, deviceId) - composite, from continuous aggregate
 */
export class AggregatedReadingModel extends Model.Class<AggregatedReadingModel>('AggregatedReadingModel')({
  // Derived from AggregatedReading.fields - with pg Date transform
  bucket: Schema.DateFromSelf,                      // pg driver returns native Date objects
  deviceId: AggregatedReading.fields.deviceId,
  avgValue: AggregatedReading.fields.avgValue,
  minValue: AggregatedReading.fields.minValue,
  maxValue: AggregatedReading.fields.maxValue,
  stddevValue: Model.FieldOption(Schema.Number),    // Schema.optional → Model.FieldOption
  sampleCount: AggregatedReading.fields.sampleCount,
}) {}
