/**
 * ADRReviewUnitActions
 *
 * Accept/Reject/Discuss buttons for a review unit.
 */
import React from 'react'
import { Check, X, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReviewStatus } from '../schemas/status'

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface ADRReviewUnitActionsProps {
  /**
   * Current status of the unit.
   */
  status: ReviewStatus

  /**
   * Callback when status changes.
   */
  onStatusChange: (status: ReviewStatus) => void

  /**
   * Callback when discuss is clicked.
   */
  onDiscuss?: () => void

  /**
   * Optional className for the container.
   */
  className?: string
}

// -----------------------------------------------------------------------------
// Status Button
// -----------------------------------------------------------------------------

interface StatusButtonProps {
  active: boolean
  variant: 'accept' | 'reject' | 'discuss'
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}

function StatusButton({ active, variant, onClick, disabled, children }: StatusButtonProps) {
  const baseClasses =
    'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors'

  const variantClasses = {
    accept: active
      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
      : 'bg-neutral-800 text-neutral-400 hover:bg-emerald-500/10 hover:text-emerald-400 border border-neutral-700',
    reject: active
      ? 'bg-red-500/20 text-red-400 border border-red-500/50'
      : 'bg-neutral-800 text-neutral-400 hover:bg-red-500/10 hover:text-red-400 border border-neutral-700',
    discuss: active
      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
      : 'bg-neutral-800 text-neutral-400 hover:bg-amber-500/10 hover:text-amber-400 border border-neutral-700',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(baseClasses, variantClasses[variant], disabled && 'opacity-50 cursor-not-allowed')}
    >
      {children}
    </button>
  )
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ADRReviewUnitActions({
  status,
  onStatusChange,
  onDiscuss,
  className,
}: ADRReviewUnitActionsProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <StatusButton
        variant="accept"
        active={status === 'accepted'}
        onClick={() => onStatusChange('accepted')}
      >
        <Check className="w-4 h-4" />
        <span>Accept</span>
      </StatusButton>

      <StatusButton
        variant="reject"
        active={status === 'rejected'}
        onClick={() => onStatusChange('rejected')}
      >
        <X className="w-4 h-4" />
        <span>Reject</span>
      </StatusButton>

      <StatusButton
        variant="discuss"
        active={status === 'discuss'}
        onClick={() => {
          onStatusChange('discuss')
          onDiscuss?.()
        }}
      >
        <MessageCircle className="w-4 h-4" />
        <span>Discuss</span>
      </StatusButton>
    </div>
  )
}
