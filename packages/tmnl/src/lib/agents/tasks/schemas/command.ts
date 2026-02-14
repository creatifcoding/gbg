/**
 * Agent Task Command Schemas
 *
 * Schema-backed command protocol for NATS microservice endpoints.
 *
 * @module agent-task/schemas/command
 */

import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// Command action domain
// ---------------------------------------------------------------------------

export const AgentTaskCommandAction = Schema.Literal(
  'retry',
  'abort',
  'prioritize',
  'resume',
  'pause',
  'cancel',
)
export type AgentTaskCommandAction = typeof AgentTaskCommandAction.Type

// ---------------------------------------------------------------------------
// Command request
// ---------------------------------------------------------------------------

export const AgentTaskCommandFields = {
  taskId: Schema.String,
  action: AgentTaskCommandAction,
  commandId: Schema.optional(Schema.String),
  requestedBy: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String),
  metadata: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  ),
  createdAt: Schema.DateTimeUtc,
}

export class AgentTaskCommand extends Schema.TaggedClass<AgentTaskCommand>()(
  'AgentTaskCommand',
  AgentTaskCommandFields,
) {}

export const AgentTaskCommandSchema = AgentTaskCommand

// ---------------------------------------------------------------------------
// Command acknowledgement
// ---------------------------------------------------------------------------

export const AgentTaskCommandAckStatus = Schema.Literal(
  'accepted',
  'rejected',
  'queued',
  'failed',
)
export type AgentTaskCommandAckStatus = typeof AgentTaskCommandAckStatus.Type

export const AgentTaskCommandAckFields = {
  taskId: Schema.String,
  action: AgentTaskCommandAction,
  status: AgentTaskCommandAckStatus,
  message: Schema.String,
  commandId: Schema.optional(Schema.String),
  handledBy: Schema.optional(Schema.String),
  receivedAt: Schema.DateTimeUtc,
}

export class AgentTaskCommandAck extends Schema.TaggedClass<AgentTaskCommandAck>()(
  'AgentTaskCommandAck',
  AgentTaskCommandAckFields,
) {}

export const AgentTaskCommandAckSchema = AgentTaskCommandAck

// ---------------------------------------------------------------------------
// Command event (for pub/sub fan-out)
// ---------------------------------------------------------------------------

export const AgentTaskCommandEventKind = Schema.Literal(
  'command.received',
  'command.acknowledged',
  'command.rejected',
)
export type AgentTaskCommandEventKind = typeof AgentTaskCommandEventKind.Type

export const AgentTaskCommandEventFields = {
  taskId: Schema.String,
  kind: AgentTaskCommandEventKind,
  command: AgentTaskCommandSchema,
  ack: Schema.optional(AgentTaskCommandAckSchema),
  emittedAt: Schema.DateTimeUtc,
}

export class AgentTaskCommandEvent extends Schema.TaggedClass<AgentTaskCommandEvent>()(
  'AgentTaskCommandEvent',
  AgentTaskCommandEventFields,
) {}

export const AgentTaskCommandEventSchema = AgentTaskCommandEvent
