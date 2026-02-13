/**
 * Schema-driven field grid for AgentTask detail panel.
 *
 * Iterates AGENT_TASK_FIELD_DESCRIPTORS (derived from SchemaAST) so any
 * schema change propagates without touching this component. Individual
 * fields can be overridden via the `fieldRenderers` prop.
 */
import { useCallback, useState, type ReactNode } from 'react'
import { DateTime, HashMap, Option } from 'effect'
import { Check, Copy } from 'lucide-react'
import type { RvnChatInlineTaskItem } from '../inline-task-types'
import { InlineTaskDetailFieldStatus } from './inline-task-detail-field-status'
import { InlineTaskDetailFieldDeps } from './inline-task-detail-field-deps'
import {
  AGENT_TASK_FIELD_DESCRIPTORS,
  DEFAULT_HIDDEN_FIELDS,
  type InlineTaskFieldDescriptor,
} from './inline-task-schema-fields'

// ---------------------------------------------------------------------------
// Value formatting
// ---------------------------------------------------------------------------

const fmt = (value: unknown): string => {
  if (value === undefined || value === null) return '—'
  if (DateTime.isDateTime(value)) return DateTime.toDate(value).toISOString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—'
  if (typeof value === 'object') {
    try { return JSON.stringify(value) } catch { return '—' }
  }
  return String(value)
}

// ---------------------------------------------------------------------------
// Field accessors
// ---------------------------------------------------------------------------

/** Resolve a field descriptor's value from a task instance. */
function resolveValue(
  task: RvnChatInlineTaskItem,
  desc: InlineTaskFieldDescriptor,
): unknown {
  if (desc.scope === 'metadata') {
    const meta = task.metadata as Record<string, unknown> | undefined
    return meta?.[desc.property]
  }
  return (task as unknown as Record<string, unknown>)[desc.property]
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InlineTaskFieldRenderer = (
  value: unknown,
  task: RvnChatInlineTaskItem,
  desc: InlineTaskFieldDescriptor,
) => ReactNode

export interface InlineTaskDetailFieldsProps {
  task: RvnChatInlineTaskItem
  /** Sibling tasks for resolving dep badges */
  taskIndex?: HashMap.HashMap<string, RvnChatInlineTaskItem>
  onNavigateTask?: (taskId: string) => void
  /**
   * Override renderer for any field key.
   * Return `undefined` to fall back to default rendering.
   *
   * @example
   * ```tsx
   * <InlineTaskDetail.Fields
   *   task={task}
   *   fieldRenderers={{
   *     progress: (val) => <ProgressBar value={val as number} />,
   *   }}
   * />
   * ```
   */
  fieldRenderers?: Readonly<Record<string, InlineTaskFieldRenderer | undefined>>
  /** Field keys to hide entirely. Defaults to hiding the raw `metadata` container. */
  hiddenFields?: ReadonlySet<string>
  /** Show copy-to-clipboard button on each non-empty field value. */
  copyable?: boolean
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyFieldButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [value])

  return (
    <button
      type="button"
      className="rvn-chat__inline-task-detail-field-copy"
      data-copied={copied || undefined}
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy value'}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? <Check size={10} strokeWidth={2} /> : <Copy size={10} strokeWidth={2} />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InlineTaskDetailFields({
  task,
  taskIndex,
  onNavigateTask,
  fieldRenderers,
  hiddenFields,
  copyable = false,
}: InlineTaskDetailFieldsProps) {
  return (
    <dl className="rvn-chat__inline-task-detail-grid">
      {AGENT_TASK_FIELD_DESCRIPTORS.map((desc) => {
        const effectiveHidden = hiddenFields ?? DEFAULT_HIDDEN_FIELDS
        if (effectiveHidden.has(desc.key)) return null

        const value = resolveValue(task, desc)

        // Check for user-provided override first
        const override = fieldRenderers?.[desc.key]
        if (override) {
          const rendered = override(value, task, desc)
          if (rendered !== undefined) {
            return (
              <div key={desc.key} className="rvn-chat__inline-task-detail-field">
                <dt>{desc.key}</dt>
                <dd>{rendered}</dd>
              </div>
            )
          }
        }

        // Built-in specialized renderers
        if (desc.key === 'status') {
          return (
            <div key={desc.key} className="rvn-chat__inline-task-detail-field">
              <dt>{desc.key}</dt>
              <dd>
                <InlineTaskDetailFieldStatus status={task.status} />
              </dd>
            </div>
          )
        }

        if (desc.key === 'dependencies') {
          return (
            <div key={desc.key} className="rvn-chat__inline-task-detail-field">
              <dt>{desc.key}</dt>
              <dd>
                <InlineTaskDetailFieldDeps
                  dependencies={Array.isArray(task.dependencies) ? task.dependencies : []}
                  taskIndex={taskIndex}
                  onNavigate={onNavigateTask}
                />
              </dd>
            </div>
          )
        }

        // Default text renderer
        const formatted = fmt(value)
        return (
          <div key={desc.key} className="rvn-chat__inline-task-detail-field">
            <dt>{desc.key}</dt>
            <dd>
              <span className="rvn-chat__inline-task-detail-field-value">
                {formatted}
              </span>
              {copyable && formatted !== '—' ? (
                <CopyFieldButton value={formatted} />
              ) : null}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

InlineTaskDetailFields.displayName = 'InlineTaskDetail.Fields'
