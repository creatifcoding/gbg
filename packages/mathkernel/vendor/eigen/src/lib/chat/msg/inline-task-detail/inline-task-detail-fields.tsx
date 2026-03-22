/**
 * Schema-driven field grid for AgentTask detail panel.
 *
 * Two sections:
 * 1. Primary header row — Task ID (chip), Title, Status (colored), Progress (bar)
 * 2. Detail fields grid — all remaining schema fields with hover + copy
 */
import { useCallback, useState, type ReactNode } from 'react'
import { DateTime, HashMap } from 'effect'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatInlineTaskItem } from '../inline-task-types'
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

function resolveValue(task: ChatInlineTaskItem, desc: InlineTaskFieldDescriptor): unknown {
  if (desc.scope === 'metadata') {
    const meta = task.metadata as Record<string, unknown> | undefined
    return meta?.[desc.property]
  }
  return (task as unknown as Record<string, unknown>)[desc.property]
}

const PRIMARY_KEYS = new Set(['taskId', 'title', 'status', 'progress'])

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InlineTaskFieldRenderer = (
  value: unknown,
  task: ChatInlineTaskItem,
  desc: InlineTaskFieldDescriptor,
) => ReactNode

export interface InlineTaskDetailFieldsProps {
  task: ChatInlineTaskItem
  taskIndex?: HashMap.HashMap<string, ChatInlineTaskItem>
  onNavigateTask?: (taskId: string) => void
  fieldRenderers?: Readonly<Record<string, InlineTaskFieldRenderer | undefined>>
  hiddenFields?: ReadonlySet<string>
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
      className={cn(
        'inline-flex items-center p-0.5 rounded',
        'text-neutral-600 hover:text-neutral-300',
        'transition-colors duration-100',
        copied && 'text-emerald-400',
      )}
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy value'}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? <Check size={10} strokeWidth={2} /> : <Copy size={10} strokeWidth={2} />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Inline progress bar (self-contained — no cross-dep to inline-task-shell)
// ---------------------------------------------------------------------------

function ProgressBar({ progress, status }: { progress: number; status: string }) {
  const barColor =
    status === 'completed' ? 'bg-emerald-400'
      : status === 'failed' ? 'bg-red-400'
        : 'bg-cyan-400'

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', barColor)}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="font-mono text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        {Math.round(progress)}%
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Primary header
// ---------------------------------------------------------------------------

function PrimaryHeader({ task }: { task: ChatInlineTaskItem }) {
  const progress = typeof task.progress === 'number'
    ? Math.max(0, Math.min(100, task.progress))
    : task.status === 'completed' ? 100 : null

  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center mb-3">
      <span
        className="font-mono px-2 py-0.5 bg-neutral-800/50 border border-neutral-700 rounded text-neutral-300"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {task.taskId}
      </span>
      <span className="font-mono text-neutral-200 truncate" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
        {task.title}
      </span>
      <InlineTaskDetailFieldStatus status={task.status} />
      <div className="w-24">
        {progress !== null ? (
          <ProgressBar progress={progress} status={task.status} />
        ) : (
          <span className="font-mono text-neutral-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>—</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail field renderer (single field)
// ---------------------------------------------------------------------------

function DetailField({
  desc, task, taskIndex, onNavigateTask, fieldRenderers, copyable,
}: {
  desc: InlineTaskFieldDescriptor
  task: ChatInlineTaskItem
  taskIndex?: HashMap.HashMap<string, ChatInlineTaskItem>
  onNavigateTask?: (taskId: string) => void
  fieldRenderers?: Readonly<Record<string, InlineTaskFieldRenderer | undefined>>
  copyable: boolean
}) {
  const value = resolveValue(task, desc)

  const override = fieldRenderers?.[desc.key]
  if (override) {
    const rendered = override(value, task, desc)
    if (rendered !== undefined) {
      return (
        <div className="flex items-baseline gap-2 py-0.5">
          <dt className="font-mono text-neutral-600 shrink-0 w-28 text-right" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {desc.key.replace('metadata.', 'meta.')}
          </dt>
          <dd className="flex-1 min-w-0">{rendered}</dd>
        </div>
      )
    }
  }

  if (desc.key === 'status') {
    return (
      <div className="flex items-baseline gap-2 py-0.5">
        <dt className="font-mono text-neutral-600 shrink-0 w-28 text-right" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>{desc.key}</dt>
        <dd><InlineTaskDetailFieldStatus status={task.status} /></dd>
      </div>
    )
  }

  if (desc.key === 'dependencies') {
    return (
      <div className="flex items-baseline gap-2 py-0.5">
        <dt className="font-mono text-neutral-600 shrink-0 w-28 text-right" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>{desc.key}</dt>
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

  const formatted = fmt(value)
  return (
    <div className="flex items-baseline gap-2 py-0.5">
      <dt className="font-mono text-neutral-600 shrink-0 w-28 text-right" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        {desc.key.replace('metadata.', 'meta.')}
      </dt>
      <dd className="flex items-center gap-1 min-w-0">
        <span className="font-mono text-neutral-400 truncate" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {formatted}
        </span>
        {copyable && formatted !== '—' ? <CopyFieldButton value={formatted} /> : null}
      </dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InlineTaskDetailFields({
  task, taskIndex, onNavigateTask, fieldRenderers, hiddenFields, copyable = false,
}: InlineTaskDetailFieldsProps) {
  const effectiveHidden = hiddenFields ?? DEFAULT_HIDDEN_FIELDS
  const detailDescs = AGENT_TASK_FIELD_DESCRIPTORS.filter(
    (d) => !PRIMARY_KEYS.has(d.key) && !effectiveHidden.has(d.key),
  )

  return (
    <>
      <PrimaryHeader task={task} />
      <dl className="flex flex-col divide-y divide-neutral-800/30">
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
