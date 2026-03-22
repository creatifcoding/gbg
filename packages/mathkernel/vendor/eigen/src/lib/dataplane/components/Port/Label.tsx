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

  // Size-responsive styles (TAC-aligned with TMNL fallbacks)
  const sizeStyles = {
    compact: { maxWidth: undefined, fontSize: undefined, srOnly: true },
    default: { maxWidth: '80px', fontSize: 'var(--tmnl-text-xs, 12px)', srOnly: false },
    large: { maxWidth: '120px', fontSize: 'var(--tmnl-text-sm, 14px)', srOnly: false },
  };

  const style = sizeStyles[size];

  if (style.srOnly) {
    return <span className="sr-only">{children}</span>;
  }

  return (
    <span
      className={cn(
        // Base styles
        'font-mono text-muted-foreground truncate',
        // User overrides
        className
      )}
      style={{
        maxWidth: style.maxWidth,
        fontSize: style.fontSize,
      }}
    >
      {children}
    </span>
  );
}
