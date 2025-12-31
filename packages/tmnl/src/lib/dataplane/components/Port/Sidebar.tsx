/**
 * @fileoverview Port Sidebar Component
 *
 * Expandable sidebar panel for port configuration and metadata.
 * Slides out from the port when expanded.
 */

import React, { memo } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import { usePort } from './context';
import { portStateValueAtom } from './port-stx';

export interface PortSidebarProps {
  /** Width of the sidebar when expanded */
  width?: number;
  /** Child content (typically PortTab components) */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Sidebar container that appears when port is expanded.
 * Children should be PortTab components.
 */
export const Sidebar = memo(function PortSidebar({
  width = 200,
  children,
  className,
}: PortSidebarProps) {
  const { portId } = usePort();
  const state = useAtomValue(portStateValueAtom(portId));
  const isExpanded = state === 'expanded';

  if (!isExpanded) return null;

  return (
    <div
      className={`
        absolute top-0 left-full ml-2
        rounded-lg border
        bg-surface-1 border-surface-3
        shadow-lg
        transition-all duration-200 ease-out
        ${className ?? ''}
      `}
      style={{
        width: `${width}px`,
        maxHeight: '400px',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
});

export default Sidebar;
