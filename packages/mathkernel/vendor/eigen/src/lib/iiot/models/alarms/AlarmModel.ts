/**
 * AlarmModel - Effect SQL Model for Alarm Entity
 *
 * Derives from Alarm domain schema with Model-specific transforms
 * for PostgreSQL persistence.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { AlarmId } from '../../schemas/identifiers'
import { Alarm } from '../../schemas/alarms'
import { CreatedAt, OptionalMetadata } from '../_common'

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Alarm Model
 *
 * Derives from Alarm domain schema (schemas/alarms.ts).
 * Applies Model-specific transforms for PostgreSQL:
 * - Optional fields → Model.FieldOption (NULL ↔ Option)
 * - DateTimeUtc → Model.DateTimeInsertFromDate (pg Date objects)
 * - Metadata → Model.JsonFromString (JSONB as text)
 *
 * PK: id (auto-generated AlarmId, e.g., "ALM-xxxxx")
 * FK: deviceId → iiot.sensors(device_id)
 */
export class AlarmModel extends Model.Class<AlarmModel>('AlarmModel')({
  // Derived from Alarm.fields - direct reuse
  deviceId: Alarm.fields.deviceId,
  alarmType: Alarm.fields.alarmType,
  severity: Alarm.fields.severity,

  // Derived with Model-specific transforms
  id: Model.Generated(AlarmId),                         // Add Generated modifier
  message: Model.FieldOption(Schema.String),            // Schema.optional → Model.FieldOption
  triggeredAt: CreatedAt,                               // DateTimeUtc → pg Date transform
  acknowledgedAt: Model.FieldOption(Schema.DateFromSelf), // pg returns native Date objects
  clearedAt: Model.FieldOption(Schema.DateFromSelf),      // pg returns native Date objects
  acknowledgedBy: Model.FieldOption(Schema.String),     // Schema.optional → Model.FieldOption
  metadata: OptionalMetadata,                           // optional Record → FieldOption JsonFromString
}) {}
