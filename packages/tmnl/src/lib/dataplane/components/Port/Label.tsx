import type { ReactNode } from 'react';
import { usePort } from './context';
import { cn } from '@/lib/utils';

/**
 * Port Label Component
 *
 * Displays port name/label text with size-responsive behavior.
 *
 * Size Variants:
 * - compact: Hidden (sr-only for accessibility)
 * - default: Truncated with ellipsis, max-width 80px, 12px text
 * - large: Full display, max-width 120px, 14px text
 *
 * Typography Discipline:
 * - Respects 12px floor from CLAUDE.md
 * - Monospace font for technical aesthetic
 * - Muted foreground color for hierarchy
 */

interface PortLabelProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function PortLabel({ children, className }: PortLabelProps) {
  const { size } = usePort();

  // Size-responsive classes
  const sizeClasses = {
    compact: 'sr-only', // Hidden but accessible
    default: 'max-w-[80px] text-xs', // 12px minimum
    large: 'max-w-[120px] text-sm', // 14px
  };

  return (
    <span
      className={cn(
        // Base styles
        'font-mono text-muted-foreground truncate',
        // Size variant
        sizeClasses[size],
        // User overrides
        className
      )}
    >
      {children}
    </span>
  );
}
