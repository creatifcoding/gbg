/**
 * IIoT Alarm & Event Schemas
 *
 * Effect Schema definitions for alarms and events.
 * These integrate with Apache AGE graph for causality tracking.
 *
 * @module
 */

import { Schema } from 'effect'
import { AlarmId, DeviceId } from './identifiers'

// =============================================================================
// Alarm Types
// =============================================================================

/** Alarm severity levels */
export const AlarmSeverity = Schema.Literal('info', 'warning', 'critical', 'emergency')
export type AlarmSeverity = Schema.Schema.Type<typeof AlarmSeverity>

/** Alarm type categories */
export const AlarmType = Schema.Literal(
  'high_temperature',
  'low_temperature',
  'high_vibration',
  'overcurrent',
  'undercurrent',
  'high_pressure',
  'low_pressure',
  'high_humidity',
  'low_humidity',
  'speed_deviation',
  'communication_loss',
  'sensor_fault',
  'maintenance_due',
  'custom'
)
export type AlarmType = Schema.Schema.Type<typeof AlarmType>

// =============================================================================
// Alarm Schema
// =============================================================================

/** Alarm record from database */
export const Alarm = Schema.TaggedStruct('Alarm', {
  id: AlarmId,
  deviceId: DeviceId,
  alarmType: AlarmType,
  severity: AlarmSeverity,
  message: Schema.optional(Schema.String),
  triggeredAt: Schema.DateTimeUtc,
  acknowledgedAt: Schema.optional(Schema.DateTimeUtc),
  clearedAt: Schema.optional(Schema.DateTimeUtc),
  acknowledgedBy: Schema.optional(Schema.String),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type Alarm = Schema.Schema.Type<typeof Alarm>

/** Create alarm parameters */
export const CreateAlarmParams = Schema.Struct({
  deviceId: DeviceId,
  alarmType: AlarmType,
  severity: AlarmSeverity,
  message: Schema.optional(Schema.String),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type CreateAlarmParams = Schema.Schema.Type<typeof CreateAlarmParams>

/** Acknowledge alarm parameters */
export const AcknowledgeAlarmParams = Schema.Struct({
  alarmId: AlarmId,
  acknowledgedBy: Schema.String,
})
export type AcknowledgeAlarmParams = Schema.Schema.Type<typeof AcknowledgeAlarmParams>

/** Clear alarm parameters */
export const ClearAlarmParams = Schema.Struct({
  alarmId: AlarmId,
})
export type ClearAlarmParams = Schema.Schema.Type<typeof ClearAlarmParams>

/** Alarm query parameters */
export const AlarmQueryParams = Schema.Struct({
  deviceId: Schema.optional(DeviceId),
  severity: Schema.optional(AlarmSeverity),
  onlyOpen: Schema.optional(Schema.Boolean),
  since: Schema.optional(Schema.DateTimeUtc),
  limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
})
export type AlarmQueryParams = Schema.Schema.Type<typeof AlarmQueryParams>

// =============================================================================
// Alarm Context (for root cause analysis)
// =============================================================================

/** Reading context around an alarm */
export const AlarmContext = Schema.TaggedStruct('AlarmContext', {
  alarmId: AlarmId,
  deviceId: DeviceId,
  readingTime: Schema.DateTimeUtc,
  value: Schema.Number,
  offsetFromAlarm: Schema.String, // PostgreSQL interval as string
})
export type AlarmContext = Schema.Schema.Type<typeof AlarmContext>
