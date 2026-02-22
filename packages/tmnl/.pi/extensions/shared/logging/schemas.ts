import { Schema } from 'effect'

export const LogLevelSchema = Schema.Literal('debug', 'info', 'warn', 'error')
export type LogLevel = typeof LogLevelSchema.Type

export const LogEntrySchema = Schema.Struct({
  timestamp: Schema.String,
  source: Schema.NonEmptyString,
  level: LogLevelSchema,
  message: Schema.String,
  origin: Schema.optional(Schema.Literal('service')),
})
export type LogEntry = typeof LogEntrySchema.Type

export const LogInputSchema = Schema.Struct({
  source: Schema.NonEmptyString,
  level: LogLevelSchema,
  message: Schema.String,
  timestamp: Schema.optional(Schema.String),
  origin: Schema.optional(Schema.Literal('service')),
})
export type LogInput = typeof LogInputSchema.Type

export const LogQuerySchema = Schema.Struct({
  sourceFilter: Schema.optional(Schema.String),
  levels: Schema.optional(Schema.Array(LogLevelSchema)),
  limit: Schema.optional(Schema.Number),
})
export type LogQuery = typeof LogQuerySchema.Type

export const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'] as const
