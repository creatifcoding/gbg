/**
 * TMNL StatusFooter Component
 *
 * CEW-styled status bar for bottom of panels/containers.
 */

import type { ReactNode } from 'react'
import { cn } from '../utils/cn'
import { TMNL_TOKENS, TMNL_FONT_SIZE } from '../tokens'
import { StatusIndicator } from '../primitives/Badge'

// =============================================================================
// TYPES
// =============================================================================

interface StatusFooterProps {
  children?: ReactNode
  className?: string
  status?: 'active' | 'idle' | 'warning' | 'error'
  statusLabel?: string
  left?: ReactNode
  right?: ReactNode
}

interface StatusItemProps {
  label: string
  value: string | number
  className?: string
}

// =============================================================================
// STATUS FOOTER
// =============================================================================

export function StatusFooter({
  children,
  className,
  status,
  statusLabel,
  left,
  right,
}: StatusFooterProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-2 border-t',
        TMNL_TOKENS.bg.secondary,
        TMNL_TOKENS.border.default,
        className
      )}
    >
      <div className="flex items-center gap-4">
        {status && <StatusIndicator status={status} label={statusLabel} />}
        {left}
      </div>

      {children && (
        <div className="flex items-center gap-4">
          {children}
        </div>
      )}

      {right && (
        <div className="flex items-center gap-4">
          {right}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// STATUS ITEM
// =============================================================================

export function StatusItem({ label, value, className }: StatusItemProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(TMNL_TOKENS.typography.label, TMNL_TOKENS.text.muted)}
        style={{ fontSize: TMNL_FONT_SIZE.xs }}
      >
        {label}:
      </span>
      <span
        className={cn(TMNL_TOKENS.typography.mono, TMNL_TOKENS.text.secondary)}
        style={{ fontSize: TMNL_FONT_SIZE.xs }}
      >
        {value}
      </span>
    </div>
  )
}
