/**
 * InlineTaskLogView — compound log view container for agent tasks.
 *
 * Default orchestration:
 * FilterBar → Header/Title → Scroll(Body: Empty|Entries+Cursor) → TailControls
 *
 * Supports slot composition while preserving backward-compatible default render.
 *
 * @module agent-task/views/inline-task-log-view
 */

import React, {
  memo,
  useCallback,
  useMemo,
  type HTMLAttributes,
  type PropsWithChildren,
} from 'react'
import type { Atom } from '@effect-atom/atom'
import {
  agentTaskLogSurfaceMockRuntime,
  type AgentTaskLogAtomSurfaceAtoms,
} from '../atoms'
import { LogEntryRow } from './log-entry-row'
import { LogFilterBar, type LogFilterBarProps } from './log-filter-bar'
import { LogTailControls, type LogTailControlsProps } from './log-tail-controls'
import {
  InlineTaskLogViewProvider,
  useInlineTaskLogViewContext,
  type InlineTaskLogViewContextValue,
} from './inline-task-log-view-context'
import { useInlineTaskLogController } from './use-inline-task-log-controller'
import './log-view.css'

export interface InlineTaskLogViewProps
  extends PropsWithChildren,
    HTMLAttributes<HTMLDivElement> {
  readonly taskId: string
  /** Compact mode — fewer filter controls, shorter height */
  readonly compact?: boolean
  /** Max height override (default: 280px via CSS) */
  readonly maxHeight?: number
  /** Optional injected atom-surface atom (DI seam). */
  readonly atomSurfaceAtom?: Atom.Atom<AgentTaskLogAtomSurfaceAtoms>
}

export interface InlineTaskLogViewFilterBarProps
  extends Omit<LogFilterBarProps, 'atoms' | 'compact'> {
  readonly compact?: boolean
}

export interface InlineTaskLogViewTailControlsProps
  extends Omit<LogTailControlsProps, 'atoms' | 'taskId' | 'unreadCountOverride' | 'onJumpToLatest'> {}

export interface InlineTaskLogViewHeaderProps extends HTMLAttributes<HTMLDivElement> {}
export interface InlineTaskLogViewTitleProps extends HTMLAttributes<HTMLSpanElement> {}
export interface InlineTaskLogViewScrollProps extends HTMLAttributes<HTMLDivElement> {}
export interface InlineTaskLogViewBodyProps extends PropsWithChildren {}
export interface InlineTaskLogViewEmptyProps extends HTMLAttributes<HTMLDivElement> {
  readonly children?: React.ReactNode
}
export interface InlineTaskLogViewEntriesProps {
  readonly children?: React.ReactNode
}
export interface InlineTaskLogViewCursorProps extends HTMLAttributes<HTMLSpanElement> {}

const DefaultInlineTaskLogViewLayout = () => (
  <>
    <InlineTaskLogView.FilterBar />
    <InlineTaskLogView.Header>
      <InlineTaskLogView.Title>Real-time Logs</InlineTaskLogView.Title>
    </InlineTaskLogView.Header>
    <InlineTaskLogView.Scroll>
      <InlineTaskLogView.Body>
        <InlineTaskLogView.Empty>Waiting for log entries…</InlineTaskLogView.Empty>
        <InlineTaskLogView.Entries />
      </InlineTaskLogView.Body>
    </InlineTaskLogView.Scroll>
    <InlineTaskLogView.TailControls />
  </>
)

function InlineTaskLogViewRoot({
  taskId,
  compact = false,
  maxHeight,
  atomSurfaceAtom = agentTaskLogSurfaceMockRuntime.atomSurfaceAtom,
  children,
  className,
  style,
  ...rest
}: InlineTaskLogViewProps) {
  const {
    atoms,
    entries,
    tailMode,
    unreadCount,
    scrollRef,
    head,
    tail,
    pointer,
    tailInterruptProps,
    interruptTail,
    jumpToLatest,
  } = useInlineTaskLogController({
    taskId,
    atomSurfaceAtom,
  })

  const mergedStyle = maxHeight ? { ...style, maxHeight: `${maxHeight}px` } : style

  const contextValue = useMemo<InlineTaskLogViewContextValue>(
    () => ({
      taskId,
      compact,
      atoms,
      entries,
      tailMode,
      unreadCount,
      scrollRef,
      head,
      tail,
      pointer,
      tailInterruptProps,
      interruptTail,
      jumpToLatest,
    }),
    [
      taskId,
      compact,
      atoms,
      entries,
      tailMode,
      unreadCount,
      scrollRef,
      head,
      tail,
      pointer,
      tailInterruptProps,
      interruptTail,
      jumpToLatest,
    ],
  )

  return (
    <InlineTaskLogViewProvider value={contextValue}>
      <div
        {...rest}
        className={className ? `at-log-view ${className}` : 'at-log-view'}
        style={mergedStyle}
        data-slot="log-view-root"
      >
        {children ?? <DefaultInlineTaskLogViewLayout />}
      </div>
    </InlineTaskLogViewProvider>
  )
}

function InlineTaskLogViewFilterBar({ compact, ...rest }: InlineTaskLogViewFilterBarProps) {
  const ctx = useInlineTaskLogViewContext()
  return <LogFilterBar {...rest} atoms={ctx.atoms} compact={compact ?? ctx.compact} />
}

function InlineTaskLogViewHeader({ className, children, ...rest }: InlineTaskLogViewHeaderProps) {
  return (
    <div
      {...rest}
      className={className ? `at-log-view__header ${className}` : 'at-log-view__header'}
      data-slot="log-view-header"
    >
      {children}
    </div>
  )
}

function InlineTaskLogViewTitle({ className, children, ...rest }: InlineTaskLogViewTitleProps) {
  return (
    <span
      {...rest}
      className={className ? `at-log-view__title ${className}` : 'at-log-view__title'}
      data-slot="log-view-title"
    >
      {children ?? 'Real-time Logs'}
    </span>
  )
}

function InlineTaskLogViewScroll({
  className,
  children,
  ...rest
}: InlineTaskLogViewScrollProps) {
  const ctx = useInlineTaskLogViewContext()

  return (
    <div
      {...rest}
      ref={ctx.scrollRef}
      className={className ? `at-log-view__scroll ${className}` : 'at-log-view__scroll'}
      data-slot="log-view-scroll"
      {...ctx.tailInterruptProps}
    >
      {children ?? <InlineTaskLogView.Body />}
    </div>
  )
}

function InlineTaskLogViewBody({ children }: InlineTaskLogViewBodyProps) {
  const ctx = useInlineTaskLogViewContext()

  if (children) {
    return <>{children}</>
  }

  if (ctx.entries.length === 0) {
    return <InlineTaskLogView.Empty>Waiting for log entries…</InlineTaskLogView.Empty>
  }

  return <InlineTaskLogView.Entries />
}

function InlineTaskLogViewEmpty({ className, children, ...rest }: InlineTaskLogViewEmptyProps) {
  const ctx = useInlineTaskLogViewContext()
  if (ctx.entries.length > 0) return null

  return (
    <div
      {...rest}
      className={className ? `at-log-view__empty ${className}` : 'at-log-view__empty'}
      data-slot="log-view-empty"
    >
      {children ?? 'Waiting for log entries…'}
    </div>
  )
}

function InlineTaskLogViewEntries({ children }: InlineTaskLogViewEntriesProps) {
  const ctx = useInlineTaskLogViewContext()
  if (ctx.entries.length === 0) return null

  if (children) {
    return (
      <div className="at-log-view__entries" data-slot="log-view-entries">
        <InlineTaskLogView.HeadAnchor />
        {children}
        <InlineTaskLogView.TailAnchor />
      </div>
    )
  }

  return (
    <div className="at-log-view__entries" data-slot="log-view-entries">
      <InlineTaskLogView.HeadAnchor />
      {ctx.entries.map((entry) => (
        <LogEntryRow key={entry.key} entry={entry} />
      ))}
      <InlineTaskLogView.Cursor />
      <InlineTaskLogView.TailAnchor />
    </div>
  )
}

function InlineTaskLogViewCursor({ className, ...rest }: InlineTaskLogViewCursorProps) {
  const { tailMode } = useInlineTaskLogViewContext()
  if (tailMode !== 'tail') return null

  return (
    <span
      {...rest}
      className={className ? `at-log-view__cursor ${className}` : 'at-log-view__cursor'}
      data-slot="log-view-cursor"
    />
  )
}

/** 1px sentinel at the head — IntersectionObserver target for head visibility. */
function InlineTaskLogViewHeadAnchor() {
  const { head } = useInlineTaskLogViewContext()
  return (
    <div
      ref={head.ref}
      className="at-log-view__head-anchor"
      data-slot="log-view-head-anchor"
      aria-hidden="true"
    />
  )
}

/** 1px sentinel at the tail — IntersectionObserver target for tail-mode detection. */
function InlineTaskLogViewTailAnchor() {
  const { tail } = useInlineTaskLogViewContext()
  return (
    <div
      ref={tail.ref}
      className="at-log-view__tail-anchor"
      data-slot="log-view-tail-anchor"
      aria-hidden="true"
    />
  )
}

function InlineTaskLogViewTailControls({ ...rest }: InlineTaskLogViewTailControlsProps) {
  const ctx = useInlineTaskLogViewContext()

  return (
    <LogTailControls
      {...rest}
      taskId={ctx.taskId}
      atoms={ctx.atoms}
      unreadCountOverride={ctx.unreadCount}
      onJumpToLatest={ctx.jumpToLatest}
    />
  )
}

const InlineTaskLogViewBase = memo(InlineTaskLogViewRoot)

export const InlineTaskLogView = Object.assign(InlineTaskLogViewBase, {
  FilterBar: InlineTaskLogViewFilterBar,
  Header: InlineTaskLogViewHeader,
  Title: InlineTaskLogViewTitle,
  Scroll: InlineTaskLogViewScroll,
  Body: InlineTaskLogViewBody,
  Empty: InlineTaskLogViewEmpty,
  Entries: InlineTaskLogViewEntries,
  Cursor: InlineTaskLogViewCursor,
  HeadAnchor: InlineTaskLogViewHeadAnchor,
  TailAnchor: InlineTaskLogViewTailAnchor,
  TailControls: InlineTaskLogViewTailControls,
})
