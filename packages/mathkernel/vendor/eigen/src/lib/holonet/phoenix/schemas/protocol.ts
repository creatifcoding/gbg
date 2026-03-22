/**
 * Holonet Phoenix Protocol Schemas
 *
 * @module holonet/phoenix/schemas/protocol
 */

import { Schema } from 'effect';
import { PhoenixEnvelopeChunk } from './envelope';

export const ReplayMode = Schema.Literal('live', 'replay_required');
export type ReplayMode = typeof ReplayMode.Type;

export const ReplayLifecycleState = Schema.Literal(
  'idle',
  'joining',
  'replay_required',
  'replay_buffering_live',
  'awaiting_ack',
  'live',
  'failed',
);
export type ReplayLifecycleState = typeof ReplayLifecycleState.Type;

export const JoinRequest = Schema.Struct({
  last_seen_event_id: Schema.NullOr(Schema.String),
  client_session_id: Schema.String,
  replay_required: Schema.Boolean,
});
export type JoinRequest = typeof JoinRequest.Type;

export const ReplayCursor = Schema.Struct({
  from: Schema.NullOr(Schema.String),
  to: Schema.NullOr(Schema.String),
  count: Schema.Number,
  truncated: Schema.Boolean,
});
export type ReplayCursor = typeof ReplayCursor.Type;

export const JoinReplyLive = Schema.Struct({
  mode: Schema.Literal('live'),
  requires_ack: Schema.Boolean,
});
export type JoinReplyLive = typeof JoinReplyLive.Type;

export const JoinReplyReplayRequired = Schema.Struct({
  mode: Schema.Literal('replay_required'),
  replay_session_id: Schema.String,
  events: PhoenixEnvelopeChunk,
  cursor: ReplayCursor,
  requires_ack: Schema.Boolean,
});
export type JoinReplyReplayRequired = typeof JoinReplyReplayRequired.Type;

export const JoinReply = Schema.Union(JoinReplyLive, JoinReplyReplayRequired);
export type JoinReply = typeof JoinReply.Type;

export const ReplayAckRequest = Schema.Struct({
  replay_session_id: Schema.String,
  up_to_event_id: Schema.String,
  client_session_id: Schema.String,
});
export type ReplayAckRequest = typeof ReplayAckRequest.Type;

export const ReplayAckResponse = Schema.Struct({
  ok: Schema.Boolean,
  reason: Schema.optional(Schema.String),
});
export type ReplayAckResponse = typeof ReplayAckResponse.Type;

export const SessionSnapshot = Schema.Struct({
  state: ReplayLifecycleState,
  topic: Schema.NullOr(Schema.String),
  client_session_id: Schema.String,
  last_seen_event_id: Schema.NullOr(Schema.String),
  replay_session_id: Schema.NullOr(Schema.String),
  reconnect_attempt: Schema.Number,
  can_dispatch_live: Schema.Boolean,
});
export type SessionSnapshot = typeof SessionSnapshot.Type;
