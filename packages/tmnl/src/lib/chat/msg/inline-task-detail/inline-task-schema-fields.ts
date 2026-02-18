/**
 * Schema-driven field descriptors for AgentTask.
 * Introspects AgentTaskSchema + AgentTaskMetadataSchema at module load
 * via SchemaAST.getPropertySignatures.
 */
import { SchemaAST } from 'effect'
import { AgentTaskSchema, AgentTaskMetadataSchema } from '../inline-task-types'

export interface InlineTaskFieldDescriptor {
  readonly key: string
  readonly property: string
  readonly isOptional: boolean
  readonly scope: 'root' | 'metadata'
  readonly astTag: string
}

function extractFields(
  ast: SchemaAST.AST,
  scope: 'root' | 'metadata',
  prefix: string,
): ReadonlyArray<InlineTaskFieldDescriptor> {
  return SchemaAST.getPropertySignatures(ast)
    .filter((p) => p.name !== '_tag')
    .map((p) => ({
      key: prefix ? `${prefix}.${String(p.name)}` : String(p.name),
      property: String(p.name),
      isOptional: p.isOptional,
      scope,
      astTag: p.type._tag,
    }))
}

export const AGENT_TASK_FIELD_DESCRIPTORS: ReadonlyArray<InlineTaskFieldDescriptor> = [
  ...extractFields(AgentTaskSchema.ast, 'root', ''),
  ...extractFields(AgentTaskMetadataSchema.ast, 'metadata', 'metadata'),
]

export const SPECIALIZED_FIELD_KEYS = new Set(['status', 'dependencies'])
export const DEFAULT_HIDDEN_FIELDS = new Set(['metadata'])
