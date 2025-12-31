/**
 * Port Item Component
 *
 * Main visual representation of a port.
 * Handles hover/click interactions and visual state transitions.
 *
 * Pattern: Compound component child (DynamicIsland.tsx precedent)
 */

import type { ReactNode } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import { cn } from '@/lib/utils';
import { usePort } from './context';
import { portOps, portStateValueAtom } from './port-stx';

interface PortItemProps {
  readonly children?: ReactNode;
  readonly className?: string;
}

/**
 * Size class mappings
 */
const sizeClasses = {
  compact: 'p-0.5 text-xs',
  default: 'px-2 py-1 text-sm',
  large: 'px-3 py-2 text-base',
} as const;

/**
 * Visual state styles
 */
const stateStyles = {
  collapsed: '',
  hovered: 'scale-105 shadow-[0_0_8px_rgba(168,219,197,0.3)]',
  expanded: 'opacity-100',
  linking: 'animate-pulse',
} as const;

/**
 * PortItem
 *
 * Main visual container for port components.
 * - Subscribes to portStateValueAtom for reactive visual updates
 * - Handles mouse enter/leave for hover states
 * - Click triggers expand
 */
export function PortItem({ children, className }: PortItemProps) {
  const { portId, size } = usePort();
  const state = useAtomValue(portStateValueAtom(portId));

  const handleMouseEnter = () => {
    portOps.hover(portId);
  };

  const handleMouseLeave = () => {
    portOps.unhover(portId);
  };

  const handleClick = () => {
    portOps.expand(portId);
  };

  return (
    <div
      className={cn(
        // Base styles
        'flex items-center gap-1 rounded-full',
        'bg-surface-1 border border-surface-2',
        'cursor-pointer select-none',
        'transition-all duration-200 ease-out',
        // Size variant
        sizeClasses[size],
        // State variant
        stateStyles[state as keyof typeof stateStyles] ?? '',
        // User override
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      data-port-state={state}
    >
      {children}
    </div>
  );
}
