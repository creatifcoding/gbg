/**
 * MessageActionBar — Progressive actions for completed messages.
 *
 * EPOCH-0005: Turns completed responses into interactive objects.
 * Shows on hover with a smooth opacity transition.
 *
 * Actions:
 * - **Copy**: Copy message content as plain text
 * - **Copy MD**: Copy as markdown (content IS markdown)
 * - **Retry**: Replay the last user message
 * - **Continue**: Send a continuation prompt
 *
 * PURPOSE: Completed messages should be actionable, not static.
 * Users shouldn't have to manually select and copy text.
 *
 * @module chat/msg/action-bar
 */

import { memo, useCallback, useState } from 'react'
import { Copy, FileText, RefreshCw, ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// =============================================================================
// Types
// =============================================================================

export interface MessageActionBarProps {
  /** Message content to copy */
  content: string
  /** Callback to retry (resend last user message) */
  onRetry?: () => void
  /** Callback to continue (send continuation prompt) */
  onContinue?: () => void
  /** Additional CSS classes */
  className?: string
}

// =============================================================================
// Action Button
// =============================================================================

function ActionButton({
  icon: Icon,
  label,
  onClick,
  feedbackIcon: FeedbackIcon,
}: {
  icon: React.ComponentType<{ className?: string; size?: number }>
  label: string
  onClick: () => void
  feedbackIcon?: React.ComponentType<{ className?: string; size?: number }>
}) {
  const [showFeedback, setShowFeedback] = useState(false)

  const handleClick = useCallback(() => {
    onClick()
    if (FeedbackIcon) {
      setShowFeedback(true)
      setTimeout(() => setShowFeedback(false), 1500)
    }
  }, [onClick, FeedbackIcon])

  const DisplayIcon = showFeedback && FeedbackIcon ? FeedbackIcon : Icon

  return (
    <button
      type="button"
      onClick={handleClick}
      title={label}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded',
        'font-mono transition-colors duration-150',
        'text-neutral-500 hover:text-neutral-300',
        'hover:bg-neutral-800/60',
        showFeedback && 'text-emerald-400',
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      <DisplayIcon size={12} className="shrink-0" />
      <span>{label}</span>
    </button>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export const MessageActionBar = memo(function MessageActionBar({
  content,
  onRetry,
  onContinue,
  className,
}: MessageActionBarProps) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).catch(() => {
      // Silent fail — clipboard API requires secure context
    })
  }, [content])

  const handleCopyMd = useCallback(() => {
    // Content IS markdown — same as copy for now
    // Future: could strip to plain text for "Copy" and keep MD for "Copy MD"
    navigator.clipboard.writeText(content).catch(() => {})
  }, [content])

  return (
    <div
      data-slot="tmnl-message-action-bar"
      className={cn(
        'flex items-center gap-0.5 mt-1',
        // EPOCH-0005: appear on hover of parent group/message
        'opacity-0 group-hover/message:opacity-100',
        'transition-opacity duration-150 ease-out',
        className,
      )}
    >
      <ActionButton
        icon={Copy}
        feedbackIcon={Check}
        label="Copy"
        onClick={handleCopy}
      />
      <ActionButton
        icon={FileText}
        feedbackIcon={Check}
        label="Copy MD"
        onClick={handleCopyMd}
      />
      {onRetry && (
        <ActionButton
          icon={RefreshCw}
          label="Retry"
          onClick={onRetry}
        />
      )}
      {onContinue && (
        <ActionButton
          icon={ArrowRight}
          label="Continue"
          onClick={onContinue}
        />
      )}
    </div>
  )
})

MessageActionBar.displayName = 'ChatMessage.ActionBar'
