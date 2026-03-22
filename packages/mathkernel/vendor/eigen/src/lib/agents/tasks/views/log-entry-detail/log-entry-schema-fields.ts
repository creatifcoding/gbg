import { DateTime, SchemaAST } from 'effect'
import type { AssembledLogEntry } from '../../services/CodecService'
import { AgentTaskLogEntrySchema } from '../../schemas/log-entry'

export interface LogEntryFieldDescriptor {
  readonly key: string
  readonly property: string
  readonly label: string
  readonly isOptional: boolean
  readonly astTag: string
}

const toFieldLabel = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toUpperCase()

const extractFields = (ast: SchemaAST.AST): ReadonlyArray<LogEntryFieldDescriptor> =>
  SchemaAST.getPropertySignatures(ast)
    .filter((p) => p.name !== '_tag')
    .map((p) => {
      const property = String(p.name)
      return {
        key: property,
        property,
        label: toFieldLabel(property),
        isOptional: p.isOptional,
        astTag: p.type._tag,
      }
    })

export const LOG_ENTRY_FIELD_DESCRIPTORS = extractFields(AgentTaskLogEntrySchema.ast)

export const DEFAULT_HIDDEN_LOG_FIELDS = new Set([
  'message',
  'metadata',
  'payload',
  'level',
  'source',
])

export const formatLogFieldValue = (value: unknown): string => {
  if (value === undefined || value === null) return '—'
  if (DateTime.isDateTime(value)) return DateTime.formatIso(value)
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.length > 0 ? value.map(String).join(', ') : '—'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return '—'
    }
  }
  return String(value)
}

export const getLogEntryFieldValue = (
  entry: AssembledLogEntry,
  desc: LogEntryFieldDescriptor,
): unknown => {
  const source = entry.entry as unknown as Record<string, unknown>
  return source[desc.property]
}
