/**
 * InlineTaskSemanticSummary — Polymorphic summary view by task status.
 *
 * Renders status-aware content:
 * - running → live metrics (log count, uptime, current phase)
 * - completed → result summary (batches, duration, success indicators)
 * - failed → error card (message, stack trace, retry info)
 * - queued → dependency graph + configuration
 * - paused → reason + resume context
 *
 * This is the third view in the Detail ↔ Logs ↔ Summary navigation.
 *
 * @module agent-task/views/semantic-summary
 */

import React, { memo } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { logTotalCountFamily } from '../atoms'
import './semantic-summary.css'

/** Minimal task shape expected by the summary view. */
export interface SemanticSummaryTask {
  readonly id: string
  readonly status: string
  readonly title: string
  readonly progress?: number
  readonly dependencies?: ReadonlyArray<string>
  readonly metadata?: Record<string, unknown>
  readonly assignmentMode?: string
  readonly claimedBy?: string
}

export interface InlineTaskSemanticSummaryProps {
  readonly task: SemanticSummaryTask
}

export const InlineTaskSemanticSummary = memo(function InlineTaskSemanticSummary({
  task,
}: InlineTaskSemanticSummaryProps) {
  switch (task.status) {
    case 'running':
      return <RunningView task={task} />
    case 'completed':
      return <CompletedView task={task} />
    case 'failed':
      return <FailedView task={task} />
    case 'queued':
      return <QueuedView task={task} />
    case 'paused':
      return <PausedView task={task} />
    default:
      return <DefaultView task={task} />
  }
})

// ---------------------------------------------------------------------------
// Running — live metrics
// ---------------------------------------------------------------------------

function RunningView({ task }: { task: SemanticSummaryTask }) {
  const logCount = useAtomValue(logTotalCountFamily(task.id))

  return (
    <div className="at-summary" data-status="running">
      <div className="at-summary__header">
        <span className="at-summary__status-dot" />
        <span className="at-summary__status-label">In Progress</span>
      </div>
      <div className="at-summary__metrics">
        <MetricCell label="Log Entries" value={String(logCount)} />
        <MetricCell label="Progress" value={`${task.progress ?? 0}%`} />
        {task.claimedBy && <MetricCell label="Worker" value={task.claimedBy} />}
        {task.metadata?.phase && (
          <MetricCell label="Phase" value={String(task.metadata.phase)} accent />
        )}
      </div>
      {task.progress !== undefined && (
        <div className="at-summary__progress">
          <div className="at-summary__progress-bar" style={{ width: `${task.progress}%` }} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Completed — result summary
// ---------------------------------------------------------------------------

function CompletedView({ task }: { task: SemanticSummaryTask }) {
  const logCount = useAtomValue(logTotalCountFamily(task.id))

  return (
    <div className="at-summary" data-status="completed">
      <div className="at-summary__header">
        <span className="at-summary__status-dot" />
        <span className="at-summary__status-label">Completed</span>
      </div>
      <div className="at-summary__metrics">
        <MetricCell label="Total Logs" value={String(logCount)} />
        <MetricCell label="Progress" value="100%" />
        {task.metadata?.durationMs && (
          <MetricCell label="Duration" value={`${task.metadata.durationMs}ms`} />
        )}
        {task.metadata?.batches && (
          <MetricCell label="Batches" value={String(task.metadata.batches)} />
        )}
      </div>
      <div className="at-summary__result">
        <span className="at-summary__result-icon">✓</span>
        <span className="at-summary__result-text">
          Task completed successfully
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Failed — error card
// ---------------------------------------------------------------------------

function FailedView({ task }: { task: SemanticSummaryTask }) {
  const errorMessage = task.metadata?.error
    ? String(task.metadata.error)
    : task.metadata?.lastError
      ? String(task.metadata.lastError)
      : 'Unknown error'

  const retryCount = task.metadata?.totalAttempts
    ? Number(task.metadata.totalAttempts)
    : undefined

  return (
    <div className="at-summary" data-status="failed">
      <div className="at-summary__header">
        <span className="at-summary__status-dot" />
        <span className="at-summary__status-label">Failed</span>
      </div>
      <div className="at-summary__error-card">
        <div className="at-summary__error-icon">✕</div>
        <div className="at-summary__error-body">
          <span className="at-summary__error-message">{errorMessage}</span>
          {retryCount !== undefined && (
            <span className="at-summary__error-retries">
              Retried {retryCount}x
            </span>
          )}
          {task.metadata?.stackTrace && (
            <pre className="at-summary__error-stack">
              {String(task.metadata.stackTrace)}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Queued — dependency graph + config
// ---------------------------------------------------------------------------

function QueuedView({ task }: { task: SemanticSummaryTask }) {
  const hasDeps = task.dependencies && task.dependencies.length > 0

  return (
    <div className="at-summary" data-status="queued">
      <div className="at-summary__header">
        <span className="at-summary__status-dot" />
        <span className="at-summary__status-label">Queued</span>
      </div>

      {/* Dependencies */}
      {hasDeps && (
        <div className="at-summary__deps">
          <span className="at-summary__section-label">Dependencies</span>
          <div className="at-summary__dep-list">
            {task.dependencies!.map((depId) => (
              <span key={depId} className="at-summary__dep-badge">
                {depId}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Configuration */}
      {task.metadata && Object.keys(task.metadata).length > 0 && (
        <div className="at-summary__config">
          <span className="at-summary__section-label">Configuration</span>
          <div className="at-summary__config-grid">
            {Object.entries(task.metadata).map(([key, value]) => (
              <div key={key} className="at-summary__config-item">
                <span className="at-summary__config-key">{key}</span>
                <span className="at-summary__config-value">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assignment info */}
      {task.assignmentMode && (
        <div className="at-summary__info-banner" data-variant="info">
          <span className="at-summary__info-icon">ⓘ</span>
          <span className="at-summary__info-text">
            Assignment mode: <strong>{task.assignmentMode}</strong>
          </span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Paused — resume context
// ---------------------------------------------------------------------------

function PausedView({ task }: { task: SemanticSummaryTask }) {
  return (
    <div className="at-summary" data-status="paused">
      <div className="at-summary__header">
        <span className="at-summary__status-dot" />
        <span className="at-summary__status-label">Paused</span>
      </div>
      <div className="at-summary__info-banner" data-variant="warn">
        <span className="at-summary__info-icon">⏸</span>
        <span className="at-summary__info-text">
          Task execution is paused
          {task.metadata?.pauseReason && ` — ${task.metadata.pauseReason}`}
        </span>
      </div>
      <div className="at-summary__metrics">
        <MetricCell label="Progress" value={`${task.progress ?? 0}%`} />
        {task.claimedBy && <MetricCell label="Worker" value={task.claimedBy} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Default fallback
// ---------------------------------------------------------------------------

function DefaultView({ task }: { task: SemanticSummaryTask }) {
  return (
    <div className="at-summary" data-status="unknown">
      <div className="at-summary__header">
        <span className="at-summary__status-dot" />
        <span className="at-summary__status-label">{task.status}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared MetricCell
// ---------------------------------------------------------------------------

function MetricCell({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="at-summary__metric-cell">
      <span className="at-summary__metric-label">{label}</span>
      <span
        className="at-summary__metric-value"
        data-accent={accent ? '' : undefined}
      >
        {value}
      </span>
    </div>
  )
}
