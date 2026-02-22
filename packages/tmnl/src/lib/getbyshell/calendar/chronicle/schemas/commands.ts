/**
 * Chronicle Command Schemas
 *
 * Typed parameter schemas for all Day mutations.
 * Follows the IIoT pattern: CreateAlarmParams, AcknowledgeAlarmParams, etc.
 *
 * @module @chronicle/schemas/commands
 * @see src/lib/iiot/schemas/alarms.ts — CreateAlarmParams pattern
 */

import { Schema } from 'effect'
import { DayId, NoteId, DayTaskId } from './identifiers'
import {
  EventPriority,
  LinkRelationship,
  LinkableEntity,
  LinkDiscoverer,
  Sentiment,
  EnergyLevel,
} from './day'

// =============================================================================
// Note Commands
// =============================================================================

export const CreateNoteParams = Schema.Struct({
  dayId: DayId,
  content: Schema.NonEmptyString,
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  pinned: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})
export type CreateNoteParams = typeof CreateNoteParams.Type

export const UpdateNoteParams = Schema.Struct({
  dayId: DayId,
  noteId: NoteId,
  content: Schema.optional(Schema.NonEmptyString),
  tags: Schema.optional(Schema.Array(Schema.String)),
  pinned: Schema.optional(Schema.Boolean),
})
export type UpdateNoteParams = typeof UpdateNoteParams.Type

export const DeleteNoteParams = Schema.Struct({
  dayId: DayId,
  noteId: NoteId,
})
export type DeleteNoteParams = typeof DeleteNoteParams.Type

// =============================================================================
// Task Commands
// =============================================================================

export const CreateTaskParams = Schema.Struct({
  dayId: DayId,
  title: Schema.NonEmptyString,
  priority: Schema.optionalWith(EventPriority, { default: () => 'normal' as const }),
  dueTime: Schema.optional(Schema.String),
})
export type CreateTaskParams = typeof CreateTaskParams.Type

export const ToggleTaskParams = Schema.Struct({
  dayId: DayId,
  taskId: DayTaskId,
})
export type ToggleTaskParams = typeof ToggleTaskParams.Type

export const DeleteTaskParams = Schema.Struct({
  dayId: DayId,
  taskId: DayTaskId,
})
export type DeleteTaskParams = typeof DeleteTaskParams.Type

// =============================================================================
// Card Commands
// =============================================================================

export const CreateCardParams = Schema.Struct({
  dayId: DayId,
  title: Schema.NonEmptyString,
  content: Schema.optionalWith(Schema.String, { default: () => '' }),
})
export type CreateCardParams = typeof CreateCardParams.Type

// =============================================================================
// Knowledge Link Commands
// =============================================================================

export const AddLinkParams = Schema.Struct({
  dayId: DayId,
  sourceId: Schema.String,
  sourceType: LinkableEntity,
  targetId: Schema.String,
  targetType: LinkableEntity,
  relationship: LinkRelationship,
  discoverer: Schema.optionalWith(LinkDiscoverer, { default: () => 'user' as const }),
  confidence: Schema.optionalWith(Schema.Number, { default: () => 1.0 }),
  notes: Schema.optional(Schema.String),
})
export type AddLinkParams = typeof AddLinkParams.Type

// =============================================================================
// Mood Commands
// =============================================================================

export const SetMoodParams = Schema.Struct({
  dayId: DayId,
  sentiment: Sentiment,
  energy: EnergyLevel,
  focus: Schema.optionalWith(EnergyLevel, { default: () => 'medium' as const }),
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  note: Schema.optional(Schema.String),
})
export type SetMoodParams = typeof SetMoodParams.Type

// =============================================================================
// Day Lifecycle Commands
// =============================================================================

export const ArchiveDayParams = Schema.Struct({
  dayId: DayId,
})
export type ArchiveDayParams = typeof ArchiveDayParams.Type

export const UnarchiveDayParams = Schema.Struct({
  dayId: DayId,
})
export type UnarchiveDayParams = typeof UnarchiveDayParams.Type
