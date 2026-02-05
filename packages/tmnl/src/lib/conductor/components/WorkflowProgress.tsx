/**
 * WorkflowProgress — Visual workflow status with step indicators
 *
 * Shows workflow name, overall progress bar, and per-step status dots.
 */

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import { conductorStateAtom, workflowProgressAtom, stepResultsAtom } from '../atoms'
import type { StepResult } from '../schemas'

const STEP_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-neutral-700',
  running: 'bg-cyan-500 animate-pulse shadow-[0_0_6px_rgba(6,182,212,0.5)]',
  complete: 'bg-emerald-500',
  failed: 'bg-red-500',
  skipped: 'bg-neutral-600',
}

export function WorkflowProgress({ className }: { className?: string }) {
  const state = useAtomValue(conductorStateAtom)
  const progress = useAtomValue(workflowProgressAtom)
  const stepResults = useAtomValue(stepResultsAtom)

  if (!state.workflow) {
    return (
      <div className={cn('p-3 rounded-lg bg-neutral-900/50 border border-neutral-800', className)}>
        <span style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }} className="font-mono text-neutral-600">
          No active workflow
        </span>
      </div>
    )
  }

  const workflow = state.workflow

  return (
    <div className={cn('p-3 rounded-lg bg-neutral-900/80 border border-neutral-800', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }} className="font-mono font-medium text-neutral-200">
          {workflow.name}
        </span>
        <span style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }} className="font-mono text-neutral-500">
          {progress.completed}/{progress.total} steps · {progress.pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden mb-3">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress.pct}%` }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>

      {/* Step indicators */}
      <div className="flex gap-1.5 flex-wrap">
        {workflow.steps.map((step) => {
          const result = stepResults.get(step.id)
          const status = result?.status ?? 'pending'
          const isCurrent = state.currentStepId === step.id

          return (
            <div
              key={step.id}
              className="flex items-center gap-1"
              title={`${step.id}: ${status}`}
            >
              <span
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-all',
                  STEP_STATUS_COLORS[status],
                  isCurrent && 'ring-1 ring-cyan-500/50 ring-offset-1 ring-offset-neutral-900',
                )}
              />
              <span
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                className={cn(
                  'font-mono',
                  isCurrent ? 'text-cyan-400' : 'text-neutral-600',
                )}
              >
                {step.id}
              </span>
            </div>
          )
        })}
      </div>

      {/* Status */}
      <div className="mt-2 flex items-center gap-2">
        <span
          className={cn(
            'px-2 py-0.5 rounded font-mono border',
            state.status === 'running' && 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
            state.status === 'complete' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
            state.status === 'failed' && 'bg-red-500/10 text-red-400 border-red-500/30',
            state.status === 'paused' && 'bg-amber-500/10 text-amber-400 border-amber-500/30',
            state.status === 'idle' && 'bg-neutral-500/10 text-neutral-400 border-neutral-500/30',
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {state.status}
        </span>
      </div>
    </div>
  )
}
