import { Schema } from 'effect'

export const SessionStatus = Schema.Literal('active', 'archived', 'starred')
export type SessionStatus = typeof SessionStatus.Type

export const HarnessSessionTokenUsage = Schema.Struct({
  input: Schema.Number,
  output: Schema.Number,
  total: Schema.Number,
})
export type HarnessSessionTokenUsage = typeof HarnessSessionTokenUsage.Type

export class HarnessSessionMeta extends Schema.Class<HarnessSessionMeta>('HarnessSessionMeta')({
  sessionId: Schema.String,
  name: Schema.optionalWith(Schema.String, { default: () => '' }),
  autoTitle: Schema.optionalWith(Schema.String, { default: () => '' }),
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] as string[] }),
  status: Schema.optionalWith(SessionStatus, { default: () => 'active' as const }),
  starred: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  messageCount: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  tokenUsage: Schema.optionalWith(HarnessSessionTokenUsage, {
    default: () => ({ input: 0, output: 0, total: 0 }),
  }),
  modelId: Schema.optionalWith(Schema.String, { default: () => '' }),
  provider: Schema.optionalWith(Schema.String, { default: () => '' }),
  previewSnippet: Schema.optionalWith(Schema.String, { default: () => '' }),
  nodeId: Schema.String,
  role: Schema.String,
  agentId: Schema.optionalWith(Schema.String, { default: () => '' }),
}) {}

export const HarnessSessionMetaPatch = Schema.Struct({
  name: Schema.optional(Schema.String),
  autoTitle: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
  status: Schema.optional(SessionStatus),
  starred: Schema.optional(Schema.Boolean),
  createdAt: Schema.optional(Schema.Number),
  updatedAt: Schema.optional(Schema.Number),
  messageCount: Schema.optional(Schema.Number),
  tokenUsage: Schema.optional(HarnessSessionTokenUsage),
  modelId: Schema.optional(Schema.String),
  provider: Schema.optional(Schema.String),
  previewSnippet: Schema.optional(Schema.String),
  nodeId: Schema.optional(Schema.String),
  role: Schema.optional(Schema.String),
  agentId: Schema.optional(Schema.String),
})
export type HarnessSessionMetaPatch = typeof HarnessSessionMetaPatch.Type
