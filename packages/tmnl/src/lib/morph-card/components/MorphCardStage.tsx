/**
 * MorphCardStage
 *
 * Canonical demo wrapper that preserves layout dimensions without
 * re-centering the card during size transitions.
 */

import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface MorphCardStageProps extends HTMLAttributes<HTMLDivElement> {
  /** Minimum height for the stage container */
  minHeight?: number | string;
}

export function MorphCardStage({
  minHeight,
  className,
  style,
  children,
  ...props
}: MorphCardStageProps) {
  return (
    <div
      className={cn(
        'rounded-xl bg-neutral-950/60 p-4 grid justify-items-center items-start',
        className
      )}
      style={{ minHeight, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

