/**
 * Port Badge Component
 *
 * Status indicator showing connection state and count.
 * Glowing dot + optional count.
 *
 * Pattern: Compound component child
 */

import { cn } from '@/lib/utils';
import { usePort } from './context';

type PortStatus = 'connected' | 'error' | 'idle';

interface PortBadgeProps {
  readonly status?: PortStatus;
  readonly count?: number;
  readonly className?: string;
}

/**
 * Dot color and glow styles per status
 */
const dotStyles = {
  connected: 'bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.6)]',
  error: 'bg-red-400 shadow-[0_0_4px_rgba(248,113,113,0.6)]',
  idle: 'bg-muted-foreground',
} as const;

/**
 * Text color per status
 */
const textStyles = {
  connected: 'text-cyan-400',
  error: 'text-red-400',
  idle: 'text-muted-foreground',
} as const;

/**
 * PortBadge
 *
 * Visual indicator for port status:
 * - Glowing dot for connected/error states
 * - Optional connection count
 * - Hidden in compact mode (sr-only)
 */
export function PortBadge({
  status = 'idle',
  count,
  className,
}: PortBadgeProps) {
  const { size } = usePort();

  // Hidden but accessible in compact mode
  if (size === 'compact') {
    return (
      <span className="sr-only">
        Status: {status}
        {count !== undefined && `, ${count} connections`}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1',
        textStyles[status],
        className
      )}
    >
      {/* Status dot with glow */}
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          dotStyles[status]
        )}
        aria-hidden="true"
      />
      {/* Optional count */}
      {count !== undefined && (
        <span className="text-xs font-mono tabular-nums">{count}</span>
      )}
    </span>
  );
}
