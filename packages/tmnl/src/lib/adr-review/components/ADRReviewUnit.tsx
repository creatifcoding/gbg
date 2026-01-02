/**
 * ADRReviewUnit
 *
 * Single reviewable unit with content, actions, and comments.
 */
import React, { createContext, useContext, useMemo, useCallback } from 'react'
import { useAtomValue } from 'effect-atom'
import { cn } from '@/lib/utils'
import type { ReviewUnit } from '../schemas/unit'
import { getUnitDisplayName } from '../schemas/unit'
import type { ReviewStatus, Comment } from '../schemas/status'
import { reviewRegistry, unitStatusFamily, unitCommentsFamily, makeUnitKey } from '../atoms'
import { setUnitStatus, addComment } from '../atoms/operations'
import { ADRReviewUnitActions } from './ADRReviewUnitActions'
import { ADRReviewUnitComments } from './ADRReviewUnitComments'

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface UnitContextValue {
  unit: ReviewUnit
  status: ReviewStatus
  comments: Comment[]
  setStatus: (status: ReviewStatus) => void
  addUnitComment: (content: string) => void
}

const UnitContext = createContext<UnitContextValue | null>(null)

export function useUnitContext() {
  const ctx = useContext(UnitContext)
  if (!ctx) throw new Error('useUnitContext must be used within ADRReviewUnit')
  return ctx
}

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface ADRReviewUnitProps {
  /**
   * The review unit data.
   */
  unit: ReviewUnit

  /**
   * Optional className for the container.
   */
  className?: string

  /**
   * Children to render (custom content layout).
   * If not provided, renders default layout.
   */
  children?: React.ReactNode
}

// -----------------------------------------------------------------------------
// Status Badge
// -----------------------------------------------------------------------------

function StatusBadge({ status }: { status: ReviewStatus }) {
  const colors: Record<ReviewStatus, string> = {
    pending: 'bg-neutral-600 text-neutral-200',
    accepted: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50',
    rejected: 'bg-red-500/20 text-red-400 border border-red-500/50',
    discuss: 'bg-amber-500/20 text-amber-400 border border-amber-500/50',
  }

  return (
    <span className={cn('px-2 py-0.5 text-xs font-medium rounded', colors[status])}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// -----------------------------------------------------------------------------
// Unit Content Renderers
// -----------------------------------------------------------------------------

function renderUnitContent(unit: ReviewUnit): React.ReactNode {
  switch (unit._tag) {
    case 'ProblemUnit':
      return <p className="text-neutral-300 whitespace-pre-wrap">{unit.content}</p>

    case 'ConstraintUnit':
      return <p className="text-neutral-300">{unit.constraint}</p>

    case 'AssumptionUnit':
      return <p className="text-neutral-300">{unit.assumption}</p>

    case 'SummaryUnit':
      return <p className="text-neutral-300 whitespace-pre-wrap">{unit.summary}</p>

    case 'TechnologyUnit':
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-cyan-400">{unit.technology}</span>
          </div>
          <p className="text-neutral-400 text-sm">{unit.purpose}</p>
          {unit.reference && (
            <p className="text-neutral-500 text-xs font-mono">{unit.reference}</p>
          )}
        </div>
      )

    case 'PatternUnit':
      return (
        <div className="space-y-2">
          <span className="font-medium text-purple-400">{unit.name}</span>
          {unit.characteristics && (
            <p className="text-neutral-400 text-sm">{unit.characteristics}</p>
          )}
          {unit.codeExample && (
            <pre className="p-3 bg-neutral-900 rounded text-xs overflow-x-auto">
              <code className="text-neutral-300">{unit.codeExample}</code>
            </pre>
          )}
        </div>
      )

    case 'InterfaceUnit':
      return (
        <div className="space-y-1">
          <span className="font-medium text-blue-400">{unit.interfaceName}</span>
          <p className="text-neutral-400 text-sm">
            {unit.from} → {unit.to} via {unit.protocol}
          </p>
          {unit.schema && <p className="text-neutral-500 text-xs font-mono">{unit.schema}</p>}
        </div>
      )

    case 'AlternativeUnit':
      return (
        <div className="space-y-1">
          <span className="font-medium text-orange-400">{unit.alternative}</span>
          <p className="text-neutral-400 text-sm">
            <span className="text-red-400">Rejected:</span> {unit.rejectionReason}
          </p>
        </div>
      )

    case 'TradeoffUnit':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-emerald-400 uppercase tracking-wide">Gain</span>
            <p className="text-neutral-300 text-sm mt-1">{unit.gain}</p>
          </div>
          <div>
            <span className="text-xs text-red-400 uppercase tracking-wide">Cost</span>
            <p className="text-neutral-300 text-sm mt-1">{unit.cost}</p>
          </div>
        </div>
      )

    case 'RiskUnit':
      return (
        <div className="space-y-2">
          <span className="font-medium text-red-400">{unit.risk}</span>
          <div className="flex gap-4 text-sm">
            <span className="text-neutral-400">
              Likelihood: <span className="text-neutral-200">{unit.likelihood}</span>
            </span>
            <span className="text-neutral-400">
              Impact: <span className="text-neutral-200">{unit.impact}</span>
            </span>
          </div>
          <p className="text-neutral-400 text-sm">
            <span className="text-emerald-400">Mitigation:</span> {unit.mitigation}
          </p>
        </div>
      )

    case 'FileUnit':
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono text-cyan-400">{unit.filePath}</code>
            <span
              className={cn(
                'px-1.5 py-0.5 text-xs rounded',
                unit.action === 'create' && 'bg-emerald-500/20 text-emerald-400',
                unit.action === 'modify' && 'bg-amber-500/20 text-amber-400',
                unit.action === 'delete' && 'bg-red-500/20 text-red-400'
              )}
            >
              {unit.action}
            </span>
          </div>
          <p className="text-neutral-400 text-sm">{unit.description}</p>
        </div>
      )

    case 'DependencyUnit':
      return (
        <div className="space-y-1">
          <code className="text-sm font-mono text-purple-400">{unit.dependency}</code>
          {unit.reason && <p className="text-neutral-400 text-sm">{unit.reason}</p>}
        </div>
      )

    case 'TestStrategyUnit':
      return <p className="text-neutral-300 whitespace-pre-wrap text-sm">{unit.strategy}</p>

    default:
      return <p className="text-neutral-500">Unknown unit type</p>
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ADRReviewUnit({ unit, className, children }: ADRReviewUnitProps) {
  const key = makeUnitKey(unit.adrId, unit.path)

  // Get status from atom
  const status = useAtomValue(unitStatusFamily(key))
  const comments = useAtomValue(unitCommentsFamily(key))

  const setStatus = useCallback(
    (newStatus: ReviewStatus) => {
      setUnitStatus(unit.adrId, unit.path, newStatus)
    },
    [unit.adrId, unit.path]
  )

  const addUnitComment = useCallback(
    (content: string) => {
      addComment(unit.adrId, unit.path, {
        author: 'Val',
        content,
        timestamp: new Date(),
      })
    },
    [unit.adrId, unit.path]
  )

  const contextValue = useMemo(
    () => ({
      unit,
      status,
      comments,
      setStatus,
      addUnitComment,
    }),
    [unit, status, comments, setStatus, addUnitComment]
  )

  return (
    <UnitContext.Provider value={contextValue}>
      <div
        className={cn(
          'p-4 bg-neutral-800/50 border border-neutral-700 rounded-lg',
          status === 'accepted' && 'border-emerald-500/30',
          status === 'rejected' && 'border-red-500/30',
          status === 'discuss' && 'border-amber-500/30',
          className
        )}
      >
        {children || (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 font-mono">{unit.path}</span>
                <span className="text-xs text-neutral-600">•</span>
                <span className="text-xs text-neutral-400">{getUnitDisplayName(unit._tag)}</span>
              </div>
              <StatusBadge status={status} />
            </div>

            {/* Content */}
            <div className="mb-4">{renderUnitContent(unit)}</div>

            {/* Actions */}
            <ADRReviewUnitActions status={status} onStatusChange={setStatus} />

            {/* Comments */}
            <ADRReviewUnitComments comments={comments} onAddComment={addUnitComment} />
          </>
        )}
      </div>
    </UnitContext.Provider>
  )
}

// -----------------------------------------------------------------------------
// Sub-components for custom layouts
// -----------------------------------------------------------------------------

export function ADRReviewUnitContent({ className }: { className?: string }) {
  const { unit } = useUnitContext()
  return <div className={className}>{renderUnitContent(unit)}</div>
}

export function ADRReviewUnitActionsSlot({ className }: { className?: string }) {
  const { status, setStatus } = useUnitContext()
  return <ADRReviewUnitActions status={status} onStatusChange={setStatus} className={className} />
}

export function ADRReviewUnitCommentsSlot({ className }: { className?: string }) {
  const { comments, addUnitComment } = useUnitContext()
  return (
    <ADRReviewUnitComments comments={comments} onAddComment={addUnitComment} className={className} />
  )
}
