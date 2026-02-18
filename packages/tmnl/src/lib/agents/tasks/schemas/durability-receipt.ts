/**
 * Agent Task Log Durability Schemas
 *
 * Schema-backed durability receipt emitted after JetStream publish ack.
 *
 * @module agent-task/schemas/log-durability
 */

import { Schema } from 'effect'

export const AgentTaskLogDurabilityReceiptFields = {
  taskId: Schema.String,
  entryId: Schema.String,
  subject: Schema.String,
  stream: Schema.String,
  sequence: Schema.Number.pipe(Schema.int(), Schema.positive()),
  duplicate: Schema.Boolean,
  entryTimestamp: Schema.DateTimeUtc,
  ackedAt: Schema.DateTimeUtc,
  publishLatencyMs: Schema.Number.pipe(Schema.nonNegative()),
}

export class AgentTaskLogDurabilityReceipt extends Schema.TaggedClass<AgentTaskLogDurabilityReceipt>()(
  'AgentTaskLogDurabilityReceipt',
  AgentTaskLogDurabilityReceiptFields,
) {}

export const AgentTaskLogDurabilityReceiptSchema = AgentTaskLogDurabilityReceipt
