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
import type { RvnChatInlineTaskStatus } from '../inline-task-types'

const DETAIL_ICON_SIZE = 10 as const
const DETAIL_ICON_STROKE = 2 as const

function DetailStatusIcon({ status }: { status: RvnChatInlineTaskStatus }) {
  const prefersReducedMotion = useReducedMotion()

  if (status === 'running') {
    return (
      <motion.span
        className="rvn-chat__inline-task-detail-status-icon"
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
        <LoaderCircle size={DETAIL_ICON_SIZE} strokeWidth={DETAIL_ICON_STROKE} />
      </motion.span>
    )
  }

  if (status === 'queued') {
    return (
      <motion.span
        className="rvn-chat__inline-task-detail-status-icon"
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
        <Timer size={DETAIL_ICON_SIZE} strokeWidth={DETAIL_ICON_STROKE} />
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
    <span
      className="rvn-chat__inline-task-detail-status-icon"
      data-status={status}
      aria-hidden="true"
    >
      <Icon size={DETAIL_ICON_SIZE} strokeWidth={DETAIL_ICON_STROKE} />
    </span>
  )
}

export interface InlineTaskDetailFieldStatusProps {
  status: RvnChatInlineTaskStatus
}

export function InlineTaskDetailFieldStatus({ status }: InlineTaskDetailFieldStatusProps) {
  return (
    <span
      className="rvn-chat__inline-task-detail-status"
      data-status={status}
    >
      <DetailStatusIcon status={status} />
      <span className="rvn-chat__inline-task-detail-status-label">{status}</span>
    </span>
  )
}

InlineTaskDetailFieldStatus.displayName = 'InlineTaskDetail.FieldStatus'
