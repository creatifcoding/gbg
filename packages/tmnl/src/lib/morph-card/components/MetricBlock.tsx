/**
 * MetricBlock Component
 *
 * Atomic metric display component for dashboard-style cards.
 * Displays a label, value, and status indicator.
 *
 * @module morph-card/components/MetricBlock
 */

'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

/**
 * Metric status indicators
 */
export type MetricStatus = 'nominal' | 'warning' | 'error' | 'active' | 'inactive';

export interface MetricBlockProps {
  /** Metric label */
  label: string;
  /** Metric value (can be string, number, or ReactNode) */
  value: ReactNode;
  /** Status indicator */
  status?: MetricStatus;
  /** Show status dot */
  showDot?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Optional icon */
  icon?: ReactNode;
  /** Additional className */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

// =============================================================================
// Status Colors
// =============================================================================

const STATUS_COLORS: Record<MetricStatus, { dot: string; glow: string }> = {
  nominal: {
    dot: 'bg-emerald-500',
    glow: 'shadow-[0_0_6px_rgba(16,185,129,0.5)]',
  },
  warning: {
    dot: 'bg-amber-500',
    glow: 'shadow-[0_0_6px_rgba(245,158,11,0.5)]',
  },
  error: {
    dot: 'bg-red-500',
    glow: 'shadow-[0_0_6px_rgba(239,68,68,0.5)]',
  },
  active: {
    dot: 'bg-cyan-500',
    glow: 'shadow-[0_0_6px_rgba(6,182,212,0.5)]',
  },
  inactive: {
    dot: 'bg-neutral-500',
    glow: '',
  },
};

// =============================================================================
// Size Variants
// =============================================================================

const SIZE_STYLES = {
  sm: {
    container: 'p-1.5 gap-0.5',
    label: 'text-[8px]',
    value: 'text-[10px]',
    dot: 'w-1 h-1',
  },
  md: {
    container: 'p-2 gap-1',
    label: 'text-[10px]',
    value: 'text-xs',
    dot: 'w-1.5 h-1.5',
  },
  lg: {
    container: 'p-3 gap-1.5',
    label: 'text-xs',
    value: 'text-sm',
    dot: 'w-2 h-2',
  },
};

// =============================================================================
// Component
// =============================================================================

/**
 * MetricBlock - Atomic metric display
 *
 * @example
 * ```tsx
 * <MetricBlock
 *   label="CPU USAGE"
 *   value="42%"
 *   status="nominal"
 * />
 *
 * <MetricBlock
 *   label="ALERTS"
 *   value={<span className="text-red-500">3</span>}
 *   status="error"
 *   size="lg"
 * />
 * ```
 */
export function MetricBlock({
  label,
  value,
  status = 'nominal',
  showDot = true,
  size = 'md',
  icon,
  className,
  onClick,
}: MetricBlockProps) {
  const sizeStyles = SIZE_STYLES[size];
  const statusColors = STATUS_COLORS[status];

  return (
    <div
      className={cn(
        'flex flex-col rounded bg-neutral-900/50',
        sizeStyles.container,
        onClick && 'cursor-pointer hover:bg-neutral-800/50 transition-colors',
        className
      )}
      onClick={onClick}
    >
      {/* Label */}
      <span
        className={cn(
          'font-mono text-neutral-500 tracking-wider uppercase',
          sizeStyles.label
        )}
      >
        {label}
      </span>

      {/* Value row */}
      <div className="flex items-center gap-1.5">
        {/* Status dot */}
        {showDot && (
          <div
            className={cn(
              'rounded-full',
              sizeStyles.dot,
              statusColors.dot,
              statusColors.glow
            )}
          />
        )}

        {/* Icon */}
        {icon && <span className="text-neutral-400">{icon}</span>}

        {/* Value */}
        <span
          className={cn(
            'font-mono text-neutral-200',
            sizeStyles.value
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// Metric Grid
// =============================================================================

export interface MetricGridProps {
  /** Metric items */
  children: ReactNode;
  /** Number of columns */
  columns?: 2 | 3 | 4;
  /** Gap between items */
  gap?: 'sm' | 'md' | 'lg';
  /** Additional className */
  className?: string;
}

const GRID_COLUMNS = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

const GRID_GAP = {
  sm: 'gap-1',
  md: 'gap-2',
  lg: 'gap-3',
};

/**
 * MetricGrid - Layout container for MetricBlocks
 *
 * @example
 * ```tsx
 * <MetricGrid columns={3}>
 *   <MetricBlock label="CPU" value="42%" status="nominal" />
 *   <MetricBlock label="MEM" value="8.2GB" status="warning" />
 *   <MetricBlock label="NET" value="1.2Gbps" status="active" />
 * </MetricGrid>
 * ```
 */
export function MetricGrid({
  children,
  columns = 2,
  gap = 'md',
  className,
}: MetricGridProps) {
  return (
    <div
      className={cn(
        'grid',
        GRID_COLUMNS[columns],
        GRID_GAP[gap],
        className
      )}
    >
      {children}
    </div>
  );
}

export default MetricBlock;
