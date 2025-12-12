/**
 * AVA API Schemas
 *
 * Effect Schema definitions for the AVA REST and WebSocket APIs.
 * These provide runtime validation and TypeScript type inference.
 *
 * @module
 */

import { Schema } from 'effect';

// ============================================================================
// Identifiers (Branded Types)
// ============================================================================

/** Branded view identifier */
export const ViewId = Schema.String.pipe(
  Schema.brand('ViewId'),
  Schema.annotations({ title: 'ViewId', description: 'Unique view identifier' })
);
export type ViewId = typeof ViewId.Type;

/** Branded channel identifier */
export const ChannelId = Schema.String.pipe(
  Schema.brand('ChannelId'),
  Schema.annotations({
    title: 'ChannelId',
    description: 'Unique channel identifier',
  })
);
export type ChannelId = typeof ChannelId.Type;

/** Branded assemblage identifier */
export const AssemblageId = Schema.String.pipe(
  Schema.brand('AssemblageId'),
  Schema.annotations({
    title: 'AssemblageId',
    description: 'Unique assemblage identifier',
  })
);
export type AssemblageId = typeof AssemblageId.Type;

// ============================================================================
// Enums
// ============================================================================

/** Channel role types */
export const ChannelRole = Schema.Literal(
  'State',
  'Event',
  'Metric',
  'Command',
  'Log'
);
export type ChannelRole = typeof ChannelRole.Type;

/** Materialization tier */
export const MaterializationTier = Schema.Literal(
  'OnDemand',
  'Cached',
  'Continuous'
);
export type MaterializationTier = typeof MaterializationTier.Type;

// ============================================================================
// REST API Response Types
// ============================================================================

/** View summary (list response item) */
export const ViewSummary = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  version: Schema.Number,
}).pipe(Schema.annotations({ title: 'ViewSummary' }));
export type ViewSummary = typeof ViewSummary.Type;

/** Channel specification */
export const ChannelSpec = Schema.Struct({
  id: Schema.String,
  role: Schema.String,
  source_connection: Schema.String,
  materialization: Schema.String,
  refresh_ms: Schema.optional(Schema.Number),
}).pipe(Schema.annotations({ title: 'ChannelSpec' }));
export type ChannelSpec = typeof ChannelSpec.Type;

/** Full view specification */
export const ViewSpec = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  assemblage_id: Schema.String,
  channels: Schema.Array(ChannelSpec),
  version: Schema.Number,
  tags: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String })
  ),
}).pipe(Schema.annotations({ title: 'ViewSpec' }));
export type ViewSpec = typeof ViewSpec.Type;

/** Channel binding (runtime state) */
export const ChannelBinding = Schema.Struct({
  channel_id: Schema.String,
  role: Schema.String,
  active: Schema.Boolean,
  row_count: Schema.optional(Schema.Number),
  last_updated_ms: Schema.optional(Schema.Number),
}).pipe(Schema.annotations({ title: 'ChannelBinding' }));
export type ChannelBinding = typeof ChannelBinding.Type;

/** View artifact (runtime state with bindings) */
export const ViewArtifact = Schema.Struct({
  view_id: Schema.String,
  asset_id: Schema.optional(Schema.String),
  spec: ViewSpec,
  channel_bindings: Schema.Array(ChannelBinding),
  created_at_ms: Schema.Number,
  version: Schema.Number,
}).pipe(Schema.annotations({ title: 'ViewArtifact' }));
export type ViewArtifact = typeof ViewArtifact.Type;

/** View status */
export const ViewStatus = Schema.Struct({
  view_id: Schema.String,
  is_subscribed: Schema.Boolean,
  version: Schema.Number,
  total_subscriptions: Schema.Number,
}).pipe(Schema.annotations({ title: 'ViewStatus' }));
export type ViewStatus = typeof ViewStatus.Type;

// ============================================================================
// REST API Request Types
// ============================================================================

/** Channel registration request */
export const RegisterChannelRequest = Schema.Struct({
  id: Schema.String,
  role: Schema.String,
  source_connection: Schema.String,
  materialization: Schema.optional(Schema.String),
}).pipe(Schema.annotations({ title: 'RegisterChannelRequest' }));
export type RegisterChannelRequest = typeof RegisterChannelRequest.Type;

/** View registration request */
export const RegisterViewRequest = Schema.Struct({
  id: Schema.optional(Schema.String),
  name: Schema.String,
  description: Schema.optional(Schema.String),
  assemblage_id: Schema.String,
  channels: Schema.Array(RegisterChannelRequest),
  overwrite_existing: Schema.optional(Schema.Boolean),
}).pipe(Schema.annotations({ title: 'RegisterViewRequest' }));
export type RegisterViewRequest = typeof RegisterViewRequest.Type;

/** View registration response */
export const RegisterViewResponse = Schema.Struct({
  view_id: Schema.String,
  was_created: Schema.Boolean,
  version: Schema.Number,
}).pipe(Schema.annotations({ title: 'RegisterViewResponse' }));
export type RegisterViewResponse = typeof RegisterViewResponse.Type;

/** Invalidate request */
export const InvalidateRequest = Schema.Struct({
  reason: Schema.optional(Schema.String),
}).pipe(Schema.annotations({ title: 'InvalidateRequest' }));
export type InvalidateRequest = typeof InvalidateRequest.Type;

/** Invalidate response */
export const InvalidateResponse = Schema.Struct({
  view_id: Schema.String,
  message: Schema.String,
}).pipe(Schema.annotations({ title: 'InvalidateResponse' }));
export type InvalidateResponse = typeof InvalidateResponse.Type;

// ============================================================================
// WebSocket Session Types (Discriminated Unions)
// ============================================================================

/** Subscribe command */
export const SubscribeCommand = Schema.TaggedStruct('subscribe', {
  view_id: Schema.String,
});
export type SubscribeCommand = typeof SubscribeCommand.Type;

/** Unsubscribe command */
export const UnsubscribeCommand = Schema.TaggedStruct('unsubscribe', {
  view_id: Schema.String,
});
export type UnsubscribeCommand = typeof UnsubscribeCommand.Type;

/** Invalidate command (WebSocket) */
export const InvalidateCommand = Schema.TaggedStruct('invalidate', {
  view_id: Schema.String,
  reason: Schema.optional(Schema.String),
});
export type InvalidateCommand = typeof InvalidateCommand.Type;

/** Ping command */
export const PingCommand = Schema.TaggedStruct('ping', {
  payload: Schema.optional(Schema.String),
});
export type PingCommand = typeof PingCommand.Type;

/** All session commands */
export const SessionCommand = Schema.Union(
  SubscribeCommand,
  UnsubscribeCommand,
  InvalidateCommand,
  PingCommand
);
export type SessionCommand = typeof SessionCommand.Type;

/** Artifact event */
export const ArtifactEvent = Schema.TaggedStruct('artifact', {
  artifact: ViewArtifact,
});
export type ArtifactEvent = typeof ArtifactEvent.Type;

/** Delta event (channel update) */
export const DeltaEvent = Schema.TaggedStruct('delta', {
  view_id: Schema.String,
  channel_id: Schema.String,
  row_count: Schema.optional(Schema.Number),
  timestamp_ms: Schema.Number,
});
export type DeltaEvent = typeof DeltaEvent.Type;

/** Status event */
export const StatusEvent = Schema.TaggedStruct('status', {
  view_id: Schema.String,
  subscribed: Schema.Boolean,
  message: Schema.String,
});
export type StatusEvent = typeof StatusEvent.Type;

/** Error event */
export const ErrorEvent = Schema.TaggedStruct('error', {
  view_id: Schema.optional(Schema.String),
  code: Schema.String,
  message: Schema.String,
});
export type ErrorEvent = typeof ErrorEvent.Type;

/** Pong event */
export const PongEvent = Schema.TaggedStruct('pong', {
  payload: Schema.optional(Schema.String),
});
export type PongEvent = typeof PongEvent.Type;

/** All session events */
export const SessionEvent = Schema.Union(
  ArtifactEvent,
  DeltaEvent,
  StatusEvent,
  ErrorEvent,
  PongEvent
);
export type SessionEvent = typeof SessionEvent.Type;

// ============================================================================
// API Error Types
// ============================================================================

/** API error response */
export const ApiError = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
  details: Schema.optional(Schema.String),
}).pipe(Schema.annotations({ title: 'ApiError' }));
export type ApiError = typeof ApiError.Type;
