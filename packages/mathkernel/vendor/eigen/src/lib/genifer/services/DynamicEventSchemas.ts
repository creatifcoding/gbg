/**
 * DynamicEventSchemas — @effect/rpc definitions for the dynamic event management API.
 *
 * The management interface (define, emit, subscribe, list) is defined as
 * proper @effect/rpc RPCs. The event bus itself is Atom-based pub/sub.
 *
 * @module genifer/services/DynamicEventSchemas
 */

import { Rpc, RpcGroup } from '@effect/rpc'
import { Schema } from 'effect'

// =============================================================================
// Event Definition — what gets registered
// =============================================================================

export class EventDefinition extends Schema.Class<EventDefinition>('EventDefinition')({
  tag: Schema.String,
  description: Schema.optional(Schema.String),
  payloadSchema: Schema.optional(Schema.Unknown),
  source: Schema.optional(Schema.Literal('decorator', 'dynamic', 'code-mode')),
  definedAt: Schema.optional(Schema.Number),
}) {}

// =============================================================================
// Dynamic Event Payload — what travels on the bus
// =============================================================================

export class DynamicEventPayload extends Schema.Class<DynamicEventPayload>('DynamicEvent')({
  eventTag: Schema.String,
  payload: Schema.Unknown,
  timestamp: Schema.Number,
  emittedBy: Schema.optional(Schema.String),
}) {}

// =============================================================================
// Subscription Record
// =============================================================================

export class EventSubscription extends Schema.Class<EventSubscription>('EventSubscription')({
  id: Schema.String,
  eventTag: Schema.String,
  subscribedAt: Schema.Number,
  label: Schema.optional(Schema.String),
}) {}

// =============================================================================
// Tagged Errors
// =============================================================================

export class EventNotDefinedError extends Schema.TaggedError<EventNotDefinedError>()(
  'EventNotDefinedError',
  { tag: Schema.String, message: Schema.String },
) {}

export class EventValidationError extends Schema.TaggedError<EventValidationError>()(
  'EventValidationError',
  { tag: Schema.String, message: Schema.String, cause: Schema.optional(Schema.Unknown) },
) {}

// =============================================================================
// RPC Definitions — management API via @effect/rpc
// =============================================================================

/** Define a new event type */
export class DefineEvent extends Rpc.make('DefineEvent', {
  payload: { definition: EventDefinition },
  success: Schema.Void,
}) {}

/** Emit a dynamic event */
export class EmitEvent extends Rpc.make('EmitEvent', {
  payload: { tag: Schema.String, data: Schema.Unknown, emittedBy: Schema.optional(Schema.String) },
  success: Schema.Void,
  error: EventNotDefinedError,
}) {}

/** List all defined events */
export class ListEvents extends Rpc.make('ListEvents', {
  success: Schema.Array(EventDefinition),
}) {}

/** Get a single event definition by tag */
export class GetEvent extends Rpc.make('GetEvent', {
  payload: { tag: Schema.String },
  success: EventDefinition,
  error: EventNotDefinedError,
}) {}

/** Undefine an event */
export class UndefineEvent extends Rpc.make('UndefineEvent', {
  payload: { tag: Schema.String },
  success: Schema.Void,
  error: EventNotDefinedError,
}) {}

// =============================================================================
// RPC Group — the complete event management API
// =============================================================================

export class DynamicEventGroup extends RpcGroup.make(
  DefineEvent,
  EmitEvent,
  ListEvents,
  GetEvent,
  UndefineEvent,
) {}
