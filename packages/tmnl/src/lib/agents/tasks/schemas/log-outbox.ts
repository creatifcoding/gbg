/**
 * Agent Task Log Outbox Schemas
 *
 * Transactional outbox / WAL envelope for JetStream durability replay.
 *
 * @module agent-task/schemas/log-outbox
 */

import { Schema } from 'effect'
import { AgentTaskLogEntrySchema } from './log-entry'

export const AgentTaskLogOutboxEnvelopeFields = {
  taskId: Schema.String,
  entry: AgentTaskLogEntrySchema,
  enqueuedAt: Schema.DateTimeUtc,
  source: Schema.Literal('runtime', 'recovery'),
}

export class AgentTaskLogOutboxEnvelope extends Schema.TaggedClass<AgentTaskLogOutboxEnvelope>()(
  'AgentTaskLogOutboxEnvelope',
  AgentTaskLogOutboxEnvelopeFields,
) {}

export const AgentTaskLogOutboxEnvelopeSchema = AgentTaskLogOutboxEnvelope
