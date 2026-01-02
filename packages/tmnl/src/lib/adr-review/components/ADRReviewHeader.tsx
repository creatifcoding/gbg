/**
 * ADRReviewHeader
 *
 * Document header with title, status, and metadata.
 */
import React from 'react'
import { FileText, Calendar, GitCommit, Tag } from 'lucide-react'
import { useAtomValue } from 'effect-atom'
import { cn } from '@/lib/utils'
import { useADRReviewContext } from './ADRReviewProvider'
import { currentSummaryAtom } from '../atoms'
import type { ReviewSummary } from '../schemas/status'

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface ADRReviewHeaderProps {
  /**
   * Optional className for the container.
   */
  className?: string
}

// -----------------------------------------------------------------------------
// Progress Bar
// -----------------------------------------------------------------------------

function ProgressBar({ summary }: { summary: ReviewSummary }) {
  const { total, accepted, rejected, discuss, pending } = summary

  if (total === 0) return null

  const segments = [
    { count: accepted, color: 'bg-emerald-500', label: 'Accepted' },
    { count: rejected, color: 'bg-red-500', label: 'Rejected' },
    { count: discuss, color: 'bg-amber-500', label: 'Discuss' },
    { count: pending, color: 'bg-neutral-600', label: 'Pending' },
  ]

  return (
    <div className="space-y-2">
      <div className="flex h-2 rounded-full overflow-hidden bg-neutral-800">
        {segments.map(
          (seg, i) =>
            seg.count > 0 && (
              <div
                key={seg.label}
                className={cn(seg.color, 'transition-all duration-300')}
                style={{ width: `${(seg.count / total) * 100}%` }}
              />
            )
        )}
      </div>
      <div className="flex justify-between text-xs text-neutral-400">
        {segments.map(
          (seg) =>
            seg.count > 0 && (
              <span key={seg.label} className="flex items-center gap-1">
                <span className={cn('w-2 h-2 rounded-full', seg.color)} />
                {seg.label}: {seg.count}
              </span>
            )
        )}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ADRReviewHeader({ className }: ADRReviewHeaderProps) {
  const { metadata, isLoading } = useADRReviewContext()
  const summary = useAtomValue(currentSummaryAtom)

  if (isLoading) {
    return (
      <div className={cn('animate-pulse', className)}>
        <div className="h-8 bg-neutral-800 rounded w-1/2 mb-4" />
        <div className="h-4 bg-neutral-800 rounded w-1/3" />
      </div>
    )
  }

  if (!metadata) {
    return (
      <div className={cn('text-neutral-500', className)}>
        No ADR selected. Choose an ADR from the list.
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Title */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-mono text-cyan-400">ADR-{metadata.id}</span>
          <span
            className={cn(
              'px-2 py-0.5 text-xs rounded',
              metadata.status === 'draft' && 'bg-neutral-700 text-neutral-300',
              metadata.status === 'review' && 'bg-amber-500/20 text-amber-400',
              metadata.status === 'accepted' && 'bg-emerald-500/20 text-emerald-400',
              metadata.status === 'superseded' && 'bg-neutral-700 text-neutral-500 line-through'
            )}
          >
            {metadata.status}
          </span>
        </div>
        <h1 className="text-xl font-bold text-neutral-100">{metadata.title}</h1>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap gap-4 text-sm text-neutral-400">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4" />
          <span>{metadata.date}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <GitCommit className="w-4 h-4" />
          <code className="text-xs">{metadata.commitHash}</code>
        </div>
        <div className="flex items-center gap-1.5">
          <Tag className="w-4 h-4" />
          <span className="capitalize">{metadata.tier}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileText className="w-4 h-4" />
          <span>Stages: {metadata.stages.join(', ')}</span>
        </div>
      </div>

      {/* Progress */}
      {summary && <ProgressBar summary={summary} />}
    </div>
  )
}
