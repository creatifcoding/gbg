/**
 * Port Actions Component
 *
 * Container for action buttons, appears on hover.
 * Horizontal row with slot for arbitrary Action children.
 */

import type { ReactNode } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import { cn } from '@/lib/utils';
import { usePort } from './context';
import { portStateValueAtom } from './port-stx';

interface ActionsProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * PortActions
 *
 * Only visible in hovered/expanded states.
 * Horizontal row of action buttons.
 */
export function Actions({ children, className }: ActionsProps) {
  const { portId } = usePort();
  const state = useAtomValue(portStateValueAtom(portId));

  // Only show in hovered or expanded states
  const isVisible = state === 'hovered' || state === 'expanded';

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-0.5',
        'absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full',
        'bg-surface-1 border border-surface-2 rounded-md',
        'p-0.5 shadow-sm',
        'animate-in fade-in-0 slide-in-from-left-2 duration-150',
        className
      )}
      data-port-actions
    >
      {children}
    </div>
  );
}
