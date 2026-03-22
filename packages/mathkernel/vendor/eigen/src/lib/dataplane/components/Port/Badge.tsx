/**
 * @fileoverview Port Badge Component
 *
 * Shows connection status or count with visual indicator.
 */

import React from 'react';

// =============================================================================
// Utilities
// =============================================================================

/** Simple class name concatenation utility */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// =============================================================================
// Types
// =============================================================================

export interface PortBadgeProps {
  /** Connection status - determines color */
  status?: 'connected' | 'error' | 'idle';
  /** Optional connection count */
  count?: number;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DOT_CLASSES = {
  connected: 'bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.6)]',
  error: 'bg-red-400 shadow-[0_0_4px_rgba(248,113,113,0.6)]',
  idle: 'bg-muted-foreground',
} as const;

const TEXT_CLASSES = {
  connected: 'text-cyan-400',
  error: 'text-red-400',
  idle: 'text-muted-foreground',
} as const;

// =============================================================================
// Component
// =============================================================================

/**
 * PortBadge - TAC-aligned typography
 * Uses TMNL 12px floor with monospace font
 */
export function PortBadge({ status = 'idle', count, className }: PortBadgeProps) {
  const dotClass = DOT_CLASSES[status];
  const textClass = TEXT_CLASSES[status];

  return (
    <span className={cn('inline-flex items-center gap-1', textClass, className)}>
      {/* Glowing dot indicator */}
      <span className={cn('w-1.5 h-1.5 rounded-full', dotClass)} />
      {count !== undefined && (
        <span
          className="font-mono tabular-nums"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {count}
        </span>
      )}
    </span>
  );
}

export default PortBadge;
