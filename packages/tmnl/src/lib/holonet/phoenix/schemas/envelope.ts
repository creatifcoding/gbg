/**
 * Holonet Phoenix Envelope Schemas
 *
 * @module holonet/phoenix/schemas/envelope
 */

import { Schema } from 'effect';

export const EventId = Schema.String.pipe(Schema.minLength(1));
export type EventId = typeof EventId.Type;

export const WorkspaceId = Schema.String.pipe(Schema.minLength(1));
export type WorkspaceId = typeof WorkspaceId.Type;

export const EventType = Schema.String.pipe(Schema.minLength(1));
export type EventType = typeof EventType.Type;

export const IsoTimestamp = Schema.String.pipe(Schema.minLength(1));
export type IsoTimestamp = typeof IsoTimestamp.Type;

export const EnvelopePayload = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
});
export type EnvelopePayload = typeof EnvelopePayload.Type;

export const PhoenixEnvelope = Schema.Struct({
  event_id: EventId,
  schema_version: Schema.Number,
  event_type: EventType,
  workspace_id: WorkspaceId,
  occurred_at: IsoTimestamp,
  payload: EnvelopePayload,
});
export type PhoenixEnvelope = typeof PhoenixEnvelope.Type;

export const PhoenixEnvelopeChunk = Schema.Array(PhoenixEnvelope);
export type PhoenixEnvelopeChunk = typeof PhoenixEnvelopeChunk.Type;
