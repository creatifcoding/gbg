/**
 * @fileoverview Port Sidebar Component
 *
 * Expandable sidebar panel for port configuration and metadata.
 * Uses TAC grid-based expand/collapse pattern for smooth animations.
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
 * Uses TAC grid-rows pattern for smooth height transitions.
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

  // TAC grid-based expand/collapse pattern
  // Grid transitions from grid-rows-[0fr] to grid-rows-[1fr]
  return (
    <div
      className={`
        grid
        transition-[grid-template-rows]
        duration-300
        ease-out
        ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
      `}
    >
      <div className="overflow-hidden">
        <div
          className={`
            mt-2 px-2 pb-2
            rounded-lg border
            bg-gray-900/80 backdrop-blur-md
            border-surface-3
            shadow-lg
            ${className ?? ''}
          `}
          style={{
            width: `${width}px`,
            maxHeight: '400px',
            overflow: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  );
});

export default Sidebar;
