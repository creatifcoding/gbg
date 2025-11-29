/**
 * TMNL Typography Primitives
 *
 * Extracted from tmnl-ui.tsx for modular encapsulation.
 * All components use CSS custom properties from ScaleProvider.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// =============================================================================
// LABELS
// =============================================================================

export const Label = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'font-mono uppercase tracking-[0.15em] text-neutral-500',
      className
    )}
    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
  >
    {children}
  </span>
);

export const LabelSmall = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'font-mono uppercase tracking-[0.2em] text-neutral-600',
      className
    )}
    style={{ fontSize: 'calc(var(--tmnl-text-xs, 12px) * 0.8)' }}
  >
    {children}
  </span>
);

export const CardLabel = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'font-mono uppercase tracking-[0.2em] text-neutral-500 bg-neutral-950 px-2',
      className
    )}
    style={{ fontSize: 'calc(var(--tmnl-text-xs, 12px) * 0.8)' }}
  >
    {children}
  </span>
);

// =============================================================================
// HEADINGS
// =============================================================================

export const Heading = ({
  children,
  size = 'base',
  className,
}: {
  children: ReactNode;
  size?: 'base' | 'lg' | 'xl';
  className?: string;
}) => {
  const sizeStyles = {
    base: { fontSize: 'var(--tmnl-text-sm, 14px)', fontWeight: 400 },
    lg: { fontSize: 'var(--tmnl-text-base, 16px)', fontWeight: 500 },
    xl: { fontSize: 'var(--tmnl-text-lg, 18px)', fontWeight: 700 },
  }[size];
  const baseClass = {
    base: 'font-mono uppercase tracking-[0.15em] text-white',
    lg: 'font-mono uppercase tracking-[0.12em] text-white',
    xl: 'font-mono uppercase tracking-[0.1em] text-white',
  }[size];
  return (
    <span className={cn(baseClass, className)} style={sizeStyles}>
      {children}
    </span>
  );
};

export const GroupHeader = ({
  children,
  color = 'gray',
  className,
}: {
  children: ReactNode;
  color?: 'gray' | 'red' | 'orange' | 'blue' | 'green';
  className?: string;
}) => {
  const colorClass = {
    gray: 'bg-neutral-500',
    red: 'bg-red-600',
    orange: 'bg-amber-600',
    blue: 'bg-blue-500',
    green: 'bg-emerald-600',
  }[color];
  return (
    <div
      className={cn(
        'font-mono font-medium tracking-tight text-white flex items-center gap-3',
        className
      )}
      style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
    >
      <div className={cn('w-2.5 h-2.5', colorClass)} />
      {children}
    </div>
  );
};

// =============================================================================
// BODY TEXT
// =============================================================================

export const Body = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'font-mono tracking-[0.03em] text-neutral-400',
      className
    )}
    style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
  >
    {children}
  </span>
);

export const Coords = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'font-mono tracking-[0.08em] text-neutral-600',
      className
    )}
    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
  >
    {children}
  </span>
);

// =============================================================================
// DISPLAY / DATA
// =============================================================================

export const ID = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'font-mono font-light tracking-[0.08em] text-white',
      className
    )}
    style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
  >
    {children}
  </span>
);

export const Stat = ({
  value,
  unit,
  className,
}: {
  value: string | number;
  unit?: string;
  className?: string;
}) => (
  <span className={cn('inline-flex items-baseline', className)}>
    <span
      className="font-mono font-thin tracking-tight text-white"
      style={{ fontSize: 'var(--tmnl-text-3xl, 36px)' }}
    >
      {value}
    </span>
    {unit && (
      <span
        className="font-mono uppercase tracking-[0.2em] text-neutral-500 ml-1"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {unit}
      </span>
    )}
  </span>
);

export const ItemNumber = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'font-mono uppercase tracking-[0.15em] text-neutral-400',
      className
    )}
    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
  >
    {children}
  </span>
);

export const ItemSubtitle = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'font-mono tracking-[0.05em] text-red-900',
      className
    )}
    style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
  >
    {children}
  </span>
);
