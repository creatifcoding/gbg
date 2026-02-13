/**
 * Schema-driven field grid for AgentTask detail panel.
 *
 * Two sections (muse parity):
 * 1. Primary header row — Task ID (chip), Title (span 2), Status (colored), Progress (bar)
 * 2. Detail fields grid — all remaining schema fields with hover + copy
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
import { InlineTaskRowProgress } from '../inline-task-shell/row'
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
// Primary header fields — rendered separately in a 4-col layout
// ---------------------------------------------------------------------------

const PRIMARY_KEYS = new Set(['taskId', 'title', 'status', 'progress'])

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
// Primary header section (Task ID chip, Title, Status, Progress)
// ---------------------------------------------------------------------------

function PrimaryHeader({ task }: { task: RvnChatInlineTaskItem }) {
  const progress = typeof task.progress === 'number'
    ? Math.max(0, Math.min(100, task.progress))
    : task.status === 'completed' ? 100 : null

  return (
    <div className="rvn-chat__inline-task-detail-primary">
      <div className="rvn-chat__inline-task-detail-field">
        <dt>Task ID</dt>
        <dd>
          <span className="rvn-chat__inline-task-detail-chip">{task.taskId}</span>
        </dd>
      </div>
      <div className="rvn-chat__inline-task-detail-field rvn-chat__inline-task-detail-field--wide">
        <dt>Title</dt>
        <dd>
          <span className="rvn-chat__inline-task-detail-field-value">{task.title}</span>
        </dd>
      </div>
      <div className="rvn-chat__inline-task-detail-field">
        <dt>Status</dt>
        <dd>
          <InlineTaskDetailFieldStatus status={task.status} />
        </dd>
      </div>
      <div className="rvn-chat__inline-task-detail-field">
        <dt>Progress</dt>
        <dd>
          {progress !== null ? (
            <InlineTaskRowProgress progress={progress} status={task.status} />
          ) : (
            <span className="rvn-chat__inline-task-detail-field-value">—</span>
          )}
        </dd>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail field renderer (single field)
// ---------------------------------------------------------------------------

function DetailField({
  desc,
  task,
  taskIndex,
  onNavigateTask,
  fieldRenderers,
  copyable,
}: {
  desc: InlineTaskFieldDescriptor
  task: RvnChatInlineTaskItem
  taskIndex?: HashMap.HashMap<string, RvnChatInlineTaskItem>
  onNavigateTask?: (taskId: string) => void
  fieldRenderers?: Readonly<Record<string, InlineTaskFieldRenderer | undefined>>
  copyable: boolean
}) {
  const value = resolveValue(task, desc)

  // User-provided override
  const override = fieldRenderers?.[desc.key]
  if (override) {
    const rendered = override(value, task, desc)
    if (rendered !== undefined) {
      return (
        <div className="rvn-chat__inline-task-detail-field">
          <dt>{desc.key.replace('metadata.', 'meta.')}</dt>
          <dd>{rendered}</dd>
        </div>
      )
    }
  }

  // Built-in: status
  if (desc.key === 'status') {
    return (
      <div className="rvn-chat__inline-task-detail-field">
        <dt>{desc.key}</dt>
        <dd><InlineTaskDetailFieldStatus status={task.status} /></dd>
      </div>
    )
  }

  // Built-in: dependencies
  if (desc.key === 'dependencies') {
    return (
      <div className="rvn-chat__inline-task-detail-field">
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

  // Default text
  const formatted = fmt(value)
  return (
    <div className="rvn-chat__inline-task-detail-field">
      <dt>{desc.key.replace('metadata.', 'meta.')}</dt>
      <dd>
        <span className="rvn-chat__inline-task-detail-field-value">{formatted}</span>
        {copyable && formatted !== '—' ? <CopyFieldButton value={formatted} /> : null}
      </dd>
    </div>
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
  const effectiveHidden = hiddenFields ?? DEFAULT_HIDDEN_FIELDS

  // Split descriptors into primary (shown in header) and detail (shown in grid)
  const detailDescs = AGENT_TASK_FIELD_DESCRIPTORS.filter(
    (d) => !PRIMARY_KEYS.has(d.key) && !effectiveHidden.has(d.key),
  )

  return (
    <>
      <PrimaryHeader task={task} />
      <dl className="rvn-chat__inline-task-detail-grid">
        {detailDescs.map((desc) => (
          <DetailField
            key={desc.key}
            desc={desc}
            task={task}
            taskIndex={taskIndex}
            onNavigateTask={onNavigateTask}
            fieldRenderers={fieldRenderers}
            copyable={copyable}
          />
        ))}
      </dl>
    </>
  )
}

InlineTaskDetailFields.displayName = 'InlineTaskDetail.Fields'
