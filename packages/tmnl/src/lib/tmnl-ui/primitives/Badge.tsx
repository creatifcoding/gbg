/**
 * TMNL Badge Component
 *
 * CEW-styled status badges.
 */

import type { ReactNode } from 'react'
import { cn } from '../utils/cn'
import { TMNL_FONT_SIZE, TMNL_TOKENS } from '../tokens'

// =============================================================================
// TYPES
// =============================================================================

interface BadgeProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
}

// =============================================================================
// VARIANTS
// =============================================================================

const variants = {
  default: 'bg-neutral-800 text-neutral-400 border-neutral-700',
  success: 'bg-emerald-950 text-emerald-400 border-emerald-800',
  warning: 'bg-amber-950 text-amber-400 border-amber-800',
  error: 'bg-red-950 text-red-400 border-red-800',
  info: 'bg-cyan-950 text-cyan-400 border-cyan-800',
}

// =============================================================================
// BADGE
// =============================================================================

export function Badge({ children, className, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded border',
        TMNL_TOKENS.typography.label,
        variants[variant],
        className
      )}
      style={{ fontSize: TMNL_FONT_SIZE.xs }}
    >
      {children}
    </span>
  )
}

// =============================================================================
// STATUS INDICATOR
// =============================================================================

interface StatusIndicatorProps {
  status: 'active' | 'idle' | 'warning' | 'error'
  label?: string
  className?: string
}

const statusColors = {
  active: 'bg-emerald-500',
  idle: 'bg-neutral-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
}

const statusGlow = {
  active: 'shadow-[0_0_8px_rgba(16,185,129,0.6)]',
  idle: '',
  warning: 'shadow-[0_0_8px_rgba(245,158,11,0.6)]',
  error: 'shadow-[0_0_8px_rgba(239,68,68,0.6)]',
}

export function StatusIndicator({ status, label, className }: StatusIndicatorProps) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn(
          'w-2 h-2 rounded-full',
          statusColors[status],
          statusGlow[status]
        )}
      />
      {label && (
        <span
          className={cn(TMNL_TOKENS.typography.label, TMNL_TOKENS.text.muted)}
          style={{ fontSize: TMNL_FONT_SIZE.xs }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
