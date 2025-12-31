/**
 * @fileoverview Port Actions Component
 *
 * Container for port action buttons.
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
 */
export const Actions = memo(function PortActions({
  children,
  className,
  showOnHover = true,
}: PortActionsProps) {
  const { portId } = usePort();
  const state = useAtomValue(portStateValueAtom(portId));

  const isVisible = !showOnHover || state === 'hovered' || state === 'expanded';

  return (
    <div
      className={`
        flex items-center
        transition-opacity duration-150
        ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        ${className ?? ''}
      `}
    >
      {children}
    </div>
  );
});

export default Actions;
