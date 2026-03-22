/**
 * @fileoverview Port Actions Component
 *
 * Container for port action buttons.
 * Uses TAC grid-based expand/collapse pattern for smooth animations.
 */

import React, { memo } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import { usePort } from './context';
import { portStateValueAtom } from './port-stx';

export interface PortActionsProps {
  /** Action buttons */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Show only on hover/expanded */
  showOnHover?: boolean;
}

/**
 * Container for action buttons.
 * Visible on hover or when port is expanded.
 * Uses TAC grid-rows pattern for smooth height transitions.
 */
export const Actions = memo(function PortActions({
  children,
  className,
  showOnHover = true,
}: PortActionsProps) {
  const { portId } = usePort();
  const state = useAtomValue(portStateValueAtom(portId));

  const isVisible = !showOnHover || state === 'hovered' || state === 'expanded';

  // TAC grid-based expand/collapse pattern
  return (
    <div
      className={`
        grid
        transition-[grid-template-rows]
        duration-200
        ease-out
        ${isVisible ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
      `}
    >
      <div className="overflow-hidden">
        <div
          className={`
            flex items-center
            ${className ?? ''}
          `}
        >
          {children}
        </div>
      </div>
    </div>
  );
});

export default Actions;
