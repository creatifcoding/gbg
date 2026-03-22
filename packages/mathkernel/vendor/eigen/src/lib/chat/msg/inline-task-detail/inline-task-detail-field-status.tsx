import {
  AlertTriangle,
  Ban,
  Check,
  LoaderCircle,
  Pause,
  ShieldAlert,
  Timer,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import type { ChatInlineTaskStatus } from '../inline-task-types'

const ICON_SIZE = 12
const ICON_STROKE = 2

const STATUS_COLOR: Record<string, string> = {
  queued: 'text-neutral-500',
  claimed: 'text-blue-400',
  running: 'text-cyan-400',
  paused: 'text-amber-400',
  blocked: 'text-red-400',
  failed: 'text-red-500',
  cancelled: 'text-neutral-600',
  completed: 'text-emerald-400',
}

function DetailStatusIcon({ status }: { status: ChatInlineTaskStatus }) {
  const prefersReducedMotion = useReducedMotion()

  if (status === 'running') {
    return (
      <motion.span
        className="inline-flex"
        data-status={status}
        aria-hidden="true"
        initial={false}
        animate={prefersReducedMotion ? { opacity: 1 } : { rotate: 360 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.12 }
            : { duration: 0.9, ease: 'linear', repeat: Infinity }
        }
      >
        <LoaderCircle size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      </motion.span>
    )
  }

  if (status === 'queued') {
    return (
      <motion.span
        className="inline-flex"
        data-status={status}
        aria-hidden="true"
        initial={false}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.45, 1, 0.45] }}
        transition={
          prefersReducedMotion
            ? { duration: 0.12 }
            : { duration: 1.1, ease: 'easeInOut', repeat: Infinity }
        }
      >
        <Timer size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      </motion.span>
    )
  }

  const IconMap: Record<string, typeof Check> = {
    completed: Check,
    failed: AlertTriangle,
    blocked: ShieldAlert,
    cancelled: Ban,
    paused: Pause,
    claimed: Check,
  }
  const Icon = IconMap[status] ?? Timer

  return (
    <span className="inline-flex" data-status={status} aria-hidden="true">
      <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
    </span>
  )
}

export interface InlineTaskDetailFieldStatusProps {
  status: ChatInlineTaskStatus
}

export function InlineTaskDetailFieldStatus({ status }: InlineTaskDetailFieldStatusProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono',
        STATUS_COLOR[status] ?? 'text-neutral-500',
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      data-status={status}
    >
      <DetailStatusIcon status={status} />
      <span className="uppercase tracking-wider">{status}</span>
    </span>
  )
}

InlineTaskDetailFieldStatus.displayName = 'InlineTaskDetail.FieldStatus'
