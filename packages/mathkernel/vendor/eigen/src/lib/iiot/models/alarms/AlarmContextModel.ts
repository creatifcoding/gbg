/**
 * AlarmContextModel - Effect SQL Model for Alarm Context (Root Cause Analysis)
 *
 * Backed by materialized view iiot.alarm_context.
 * Pre-computed sensor readings around alarm events for fast operator triage.
 *
 * Read-only - no insert/update (view is refreshed via DDL functions).
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { AlarmContext } from '../../schemas/alarms'

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Alarm Context Model
 *
 * Derives from AlarmContext domain schema (schemas/alarms.ts).
 * Maps to materialized view iiot.alarm_context.
 * Contains sensor readings within ±5 minutes of alarm trigger.
 *
 * Key: (alarmId, readingTime) - composite unique
 */
export class AlarmContextModel extends Model.Class<AlarmContextModel>('AlarmContextModel')({
  // Derived from AlarmContext.fields - with pg Date transform
  alarmId: AlarmContext.fields.alarmId,
  deviceId: AlarmContext.fields.deviceId,
  readingTime: Schema.DateFromSelf,    // DateTimeUtc → Date (pg driver returns native Date)
  value: AlarmContext.fields.value,
  quality: AlarmContext.fields.quality,
  // pg EXTRACT returns string for precision - use NumberFromString
  offsetSeconds: Schema.NumberFromString,
}) {}
