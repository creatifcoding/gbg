/**
 * LogEntryRow — composable compound row renderer.
 *
 * Default layout:
 * - line: timestamp, level, source, message, optional span marker
 * - expandable detail: LogEntryDetail compound
 *
 * @module agent-task/views/log-entry-row
 */

import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
  type HTMLAttributes,
  type PropsWithChildren,
} from 'react'
import type { AssembledLogEntry } from '../services/CodecService'
import { LogEntryDetail } from './log-entry-detail'
import './log-view.css'

interface LogEntryRowContextValue {
  readonly entry: AssembledLogEntry
  readonly timestamp: string
  readonly isExpandable: boolean
  readonly expanded: boolean
  readonly toggleExpanded: () => void
}

const LogEntryRowContext = createContext<LogEntryRowContextValue | null>(null)

const useLogEntryRowContext = (): LogEntryRowContextValue => {
  const ctx = useContext(LogEntryRowContext)
  if (ctx) return ctx
  throw new Error('LogEntryRow compound parts must be used inside <LogEntryRow entry={...}>')
}

export interface LogEntryRowProps extends PropsWithChildren, HTMLAttributes<HTMLDivElement> {
  readonly entry: AssembledLogEntry
  /** Whether to show relative or absolute timestamp */
  readonly relativeTime?: boolean
  /** Uncontrolled initial expansion */
  readonly defaultExpanded?: boolean
  /** Controlled expansion */
  readonly expanded?: boolean
  /** Controlled expansion callback */
  readonly onExpandedChange?: (expanded: boolean) => void
}

export interface LogEntryRowLineProps extends HTMLAttributes<HTMLDivElement> {}
export interface LogEntryRowTextPartProps extends HTMLAttributes<HTMLSpanElement> {
  readonly value?: string
}
export interface LogEntryRowDetailProps extends PropsWithChildren, HTMLAttributes<HTMLDivElement> {}

const DefaultLogEntryRowLayout = () => (
  <>
    <LogEntryRow.Line>
      <LogEntryRow.Timestamp />
      <LogEntryRow.Level />
      <LogEntryRow.Source />
      <LogEntryRow.Message />
      <LogEntryRow.Span />
    </LogEntryRow.Line>
    <LogEntryRow.Detail />
  </>
)

function LogEntryRowRoot({
  entry,
  relativeTime = false,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  children,
  className,
  ...rest
}: LogEntryRowProps) {
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded)

  const hasMetadata =
    entry.entry.metadata !== undefined && Object.keys(entry.entry.metadata).length > 0
  const hasPayload = entry.entry.payload !== undefined
  const hasCorrelatedIds =
    typeof entry.entry.traceId === 'string' ||
    typeof entry.entry.spanId === 'string' ||
    typeof entry.entry.toolCallId === 'string' ||
    typeof entry.entry.parentTaskId === 'string'

  const isExpandable = hasMetadata || hasPayload || hasCorrelatedIds
  const expanded = expandedProp ?? uncontrolledExpanded

  const setExpanded = useCallback(
    (next: boolean) => {
      if (!isExpandable) return
      if (expandedProp === undefined) {
        setUncontrolledExpanded(next)
      }
      onExpandedChange?.(next)
    },
    [isExpandable, expandedProp, onExpandedChange],
  )

  const toggleExpanded = useCallback(() => {
    setExpanded(!expanded)
  }, [expanded, setExpanded])

  const timestamp = relativeTime
    ? entry.relativeTime
    : entry.timestampDisplay.slice(11, 19)

  const value = useMemo<LogEntryRowContextValue>(
    () => ({
      entry,
      timestamp,
      isExpandable,
      expanded,
      toggleExpanded,
    }),
    [entry, timestamp, isExpandable, expanded, toggleExpanded],
  )

  return (
    <LogEntryRowContext.Provider value={value}>
      <div
        {...rest}
        className={className ? `at-log-entry ${className}` : 'at-log-entry'}
        data-slot="log-entry-row"
        data-entry-key={entry.key}
        data-level={entry.levelAttr}
        data-expandable={isExpandable ? '' : undefined}
        data-expanded={expanded ? '' : undefined}
      >
        {children ?? <DefaultLogEntryRowLayout />}
      </div>
    </LogEntryRowContext.Provider>
  )
}

function LogEntryRowLine({ className, onClick, children, ...rest }: LogEntryRowLineProps) {
  const { isExpandable, toggleExpanded } = useLogEntryRowContext()

  const handleClick: React.MouseEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      onClick?.(event)
      if (event.defaultPrevented) return
      if (isExpandable) toggleExpanded()
    },
    [onClick, isExpandable, toggleExpanded],
  )

  return (
    <div
      {...rest}
      className={className ? `at-log-entry__line ${className}` : 'at-log-entry__line'}
      data-slot="log-entry-row-line"
      onClick={handleClick}
    >
      {children}
    </div>
  )
}

function LogEntryRowTimestamp({ className, value, ...rest }: LogEntryRowTextPartProps) {
  const { timestamp } = useLogEntryRowContext()
  return (
    <span
      {...rest}
      className={className ? `at-log-entry__timestamp ${className}` : 'at-log-entry__timestamp'}
      data-slot="log-entry-row-timestamp"
    >
      [{value ?? timestamp}]
    </span>
  )
}

function LogEntryRowLevel({ className, value, ...rest }: LogEntryRowTextPartProps) {
  const { entry } = useLogEntryRowContext()
  return (
    <span
      {...rest}
      className={className ? `at-log-entry__level ${className}` : 'at-log-entry__level'}
      data-slot="log-entry-row-level"
    >
      {value ?? entry.entry.level}
    </span>
  )
}

function LogEntryRowSource({ className, value, ...rest }: LogEntryRowTextPartProps) {
  const { entry } = useLogEntryRowContext()
  return (
    <span
      {...rest}
      className={className ? `at-log-entry__source ${className}` : 'at-log-entry__source'}
      data-slot="log-entry-row-source"
    >
      {value ?? entry.entry.source}
    </span>
  )
}

function LogEntryRowMessage({ className, value, ...rest }: LogEntryRowTextPartProps) {
  const { entry } = useLogEntryRowContext()
  return (
    <span
      {...rest}
      className={className ? `at-log-entry__message ${className}` : 'at-log-entry__message'}
      data-slot="log-entry-row-message"
    >
      {value ?? entry.entry.message}
    </span>
  )
}

function LogEntryRowSpan({ className, children, ...rest }: LogEntryRowTextPartProps) {
  const { entry } = useLogEntryRowContext()
  if (!entry.entry.spanId && !children) return null

  return (
    <span
      {...rest}
      className={className ? `at-log-entry__span ${className}` : 'at-log-entry__span'}
      data-slot="log-entry-row-span"
      title={entry.entry.spanId ? `span: ${entry.entry.spanId}` : undefined}
    >
      {children ?? '⊕'}
    </span>
  )
}

function LogEntryRowDetail({ className, children, ...rest }: LogEntryRowDetailProps) {
  const { expanded, entry } = useLogEntryRowContext()
  if (!expanded) return null

  return (
    <div
      {...rest}
      className={className ? `at-log-entry__meta ${className}` : 'at-log-entry__meta'}
      data-slot="log-entry-row-detail"
    >
      {children ?? (
        <LogEntryDetail entry={entry}>
          <LogEntryDetail.Fields />
          <LogEntryDetail.FlushContainers />
          <LogEntryDetail.PayloadJson />
          <LogEntryDetail.MetadataJson />
          <LogEntryDetail.StackTrace />
        </LogEntryDetail>
      )}
    </div>
  )
}

const LogEntryRowBase = memo(LogEntryRowRoot)

export const LogEntryRow = Object.assign(LogEntryRowBase, {
  Line: LogEntryRowLine,
  Timestamp: LogEntryRowTimestamp,
  Level: LogEntryRowLevel,
  Source: LogEntryRowSource,
  Message: LogEntryRowMessage,
  Span: LogEntryRowSpan,
  Detail: LogEntryRowDetail,
})
