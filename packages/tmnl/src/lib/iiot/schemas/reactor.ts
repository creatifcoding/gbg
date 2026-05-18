/**
 * Reactor domain schemas.
 *
 * Schema-backed contracts for relationship consistency sidecars: checkpoints,
 * delivery dedupe, and replay cursors.
 *
 * @module
 */

import { Schema } from 'effect'

export const ReactorConsumerId = Schema.String.pipe(Schema.brand('ReactorConsumerId'))
export type ReactorConsumerId = typeof ReactorConsumerId.Type

export const ReactorSourceEntryId = Schema.String.pipe(Schema.brand('ReactorSourceEntryId'))
export type ReactorSourceEntryId = typeof ReactorSourceEntryId.Type

export const ReactorCheckpointOutcome = Schema.Literal('processed', 'skipped', 'failed')
export type ReactorCheckpointOutcome = typeof ReactorCheckpointOutcome.Type

export class ReactorCheckpointRecord extends Schema.TaggedClass<ReactorCheckpointRecord>()('ReactorCheckpointRecord', {
  consumerId: ReactorConsumerId,
  sourceEntryId: ReactorSourceEntryId,
  sourceEvent: Schema.String,
  primaryKey: Schema.String,
  outcome: ReactorCheckpointOutcome,
  processedAt: Schema.DateTimeUtc,
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
}) {}

export class ReactorCheckpointInsert extends Schema.TaggedClass<ReactorCheckpointInsert>()('ReactorCheckpointInsert', {
  consumerId: ReactorConsumerId,
  sourceEntryId: ReactorSourceEntryId,
  sourceEvent: Schema.String,
  primaryKey: Schema.String,
  outcome: ReactorCheckpointOutcome,
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}
