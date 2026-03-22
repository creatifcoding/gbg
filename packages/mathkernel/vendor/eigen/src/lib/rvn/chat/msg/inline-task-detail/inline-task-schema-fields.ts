/**
 * Schema-driven field descriptors for AgentTask.
 *
 * Introspects AgentTaskSchema + AgentTaskMetadataSchema at module load
 * via SchemaAST.getPropertySignatures. If the schema changes, the field
 * list updates automatically — no manual field enumeration needed.
 */
import { SchemaAST } from 'effect'
import { AgentTaskSchema, AgentTaskMetadataSchema } from '../inline-task-types'

export interface InlineTaskFieldDescriptor {
  /** Display key, e.g. "taskId" or "metadata.phase" */
  readonly key: string
  /** Raw property name on the object (without metadata. prefix) */
  readonly property: string
  /** Whether the field is optional in the schema */
  readonly isOptional: boolean
  /** 'root' = top-level AgentTask field, 'metadata' = nested under metadata */
  readonly scope: 'root' | 'metadata'
  /** AST type tag for the field's type node */
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

/**
 * All field descriptors for AgentTask, including flattened metadata fields.
 * Derived from the schema AST — add a field to the schema and it appears here.
 */
export const AGENT_TASK_FIELD_DESCRIPTORS: ReadonlyArray<InlineTaskFieldDescriptor> = [
  ...extractFields(AgentTaskSchema.ast, 'root', ''),
  ...extractFields(AgentTaskMetadataSchema.ast, 'metadata', 'metadata'),
]

/**
 * Field keys that have specialized renderers (status, dependencies).
 * Everything else gets the default text renderer.
 */
export const SPECIALIZED_FIELD_KEYS = new Set(['status', 'dependencies'])

/**
 * Fields hidden by default — the raw `metadata` object is flattened into
 * `metadata.*` sub-fields, so the container itself is redundant.
 */
export const DEFAULT_HIDDEN_FIELDS = new Set(['metadata'])
