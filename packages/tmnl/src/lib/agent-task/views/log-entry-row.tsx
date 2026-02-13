/**
 * LogEntryRow — Single log line renderer.
 *
 * Renders one AssembledLogEntry as a monospace line with:
 * - Timestamp (blue, mono)
 * - Level badge (colored by severity via data-level attribute)
 * - Source label (dimmed)
 * - Message text
 * - Expandable metadata (if present)
 *
 * @module agent-task/views/log-entry-row
 */

import React, { useState, useCallback, memo } from 'react'
import type { AssembledLogEntry } from '../services/CodecService'
import './log-view.css'

export interface LogEntryRowProps {
  readonly entry: AssembledLogEntry
  /** Whether to show relative or absolute timestamp */
  readonly relativeTime?: boolean
}

export const LogEntryRow = memo(function LogEntryRow({
  entry,
  relativeTime = false,
}: LogEntryRowProps) {
  const [expanded, setExpanded] = useState(false)
  const hasMetadata =
    entry.entry.metadata !== undefined &&
    Object.keys(entry.entry.metadata).length > 0
  const hasPayload = entry.entry.payload !== undefined

  const toggleExpand = useCallback(() => {
    if (hasMetadata || hasPayload) setExpanded((p) => !p)
  }, [hasMetadata, hasPayload])

  // Format timestamp: either relative ("2s ago") or HH:MM:SS
  const timestamp = relativeTime
    ? entry.relativeTime
    : entry.timestampDisplay.slice(11, 19) // HH:MM:SS from ISO

  return (
    <div
      className="at-log-entry"
      data-level={entry.levelAttr}
      data-expandable={hasMetadata || hasPayload ? '' : undefined}
    >
      <div className="at-log-entry__line" onClick={toggleExpand}>
        <span className="at-log-entry__timestamp">[{timestamp}]</span>
        <span className="at-log-entry__level">{entry.entry.level}</span>
        <span className="at-log-entry__source">{entry.entry.source}</span>
        <span className="at-log-entry__message">{entry.entry.message}</span>
        {entry.entry.spanId && (
          <span className="at-log-entry__span" title={`span: ${entry.entry.spanId}`}>
            ⊕
          </span>
        )}
      </div>
      {expanded && (
        <div className="at-log-entry__meta">
          {hasMetadata && (
            <div className="at-log-entry__meta-section">
              <span className="at-log-entry__meta-label">metadata</span>
              <pre className="at-log-entry__meta-value">
                {JSON.stringify(entry.entry.metadata, null, 2)}
              </pre>
            </div>
          )}
          {hasPayload && (
            <div className="at-log-entry__meta-section">
              <span className="at-log-entry__meta-label">payload</span>
              <pre className="at-log-entry__meta-value">
                {JSON.stringify(entry.entry.payload, null, 2)}
              </pre>
            </div>
          )}
          {entry.entry.traceId && (
            <div className="at-log-entry__meta-section">
              <span className="at-log-entry__meta-label">traceId</span>
              <span className="at-log-entry__meta-value at-log-entry__meta-value--inline">
                {entry.entry.traceId}
              </span>
            </div>
          )}
          {entry.entry.toolCallId && (
            <div className="at-log-entry__meta-section">
              <span className="at-log-entry__meta-label">toolCallId</span>
              <span className="at-log-entry__meta-value at-log-entry__meta-value--inline">
                {entry.entry.toolCallId}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
