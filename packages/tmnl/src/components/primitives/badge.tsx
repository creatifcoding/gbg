/**
 * TMNL Badge & Utility Primitives
 *
 * Extracted from tmnl-ui.tsx for modular encapsulation.
 * Uses CSS custom properties from ScaleProvider.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// =============================================================================
// BADGE
// =============================================================================

export interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'outline' | 'critical' | 'success' | 'live';
  className?: string;
}

export const Badge = ({
  children,
  variant = 'default',
  className,
}: BadgeProps) => {
  const styles = {
    default: 'bg-neutral-900 text-neutral-400 border-neutral-800',
    outline: 'border-neutral-800 text-neutral-500',
    critical: 'bg-red-950/50 border-red-900 text-red-500 animate-pulse',
    success: 'bg-emerald-950/50 border-emerald-900 text-emerald-500',
    live: 'bg-red-950/50 border-red-800 text-red-500',
  };
  return (
    <span
      className={cn(
        'px-1.5 py-0.5 font-mono uppercase tracking-[0.15em] inline-flex items-center gap-1 border',
        styles[variant],
        className
      )}
      style={{ fontSize: 'calc(var(--tmnl-text-xs, 12px) * 0.7)' }}
    >
      {children}
    </span>
  );
};

// =============================================================================
// SKELETON
// =============================================================================

export interface SkeletonProps {
  className?: string;
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div
    className={cn(
      'animate-pulse bg-neutral-900 border border-neutral-800',
      className
    )}
  />
);

// =============================================================================
// SEPARATOR
// =============================================================================

export interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const Separator = ({
  orientation = 'horizontal',
  className,
}: SeparatorProps) => (
  <div
    className={cn(
      'bg-neutral-800 shrink-0',
      orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
      className
    )}
  />
);

// =============================================================================
// KBD (Keyboard Shortcut)
// =============================================================================

export interface KbdProps {
  children: ReactNode;
}

export const Kbd = ({ children }: KbdProps) => (
  <span
    className="border border-neutral-800 bg-neutral-900 px-1 py-0.5 font-mono text-neutral-500"
    style={{ fontSize: 'calc(var(--tmnl-text-xs, 12px) * 0.7)' }}
  >
    {children}
  </span>
);
