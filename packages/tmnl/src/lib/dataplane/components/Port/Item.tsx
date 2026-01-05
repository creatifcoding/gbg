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
 * Size class mappings (TAC-aligned typography)
 * Uses TMNL fallback sizes with monospace fonts
 */
const sizeClasses = {
  compact: 'p-0.5',  // 12px via CSS var in children
  default: 'px-2 py-1',  // 12px minimum
  large: 'px-3 py-2',  // 14px
} as const;

/**
 * Visual state styles (TAC glass morphism)
 */
const stateStyles = {
  collapsed: '',
  hovered: 'scale-[1.02]',  // Subtle scale, glow handled by parent
  expanded: '',
  linking: '',  // Handled by parent with animate-pulsing-glow
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
        // Base styles (TAC glass pattern)
        'flex items-center gap-1.5 rounded-lg',
        'bg-transparent',  // Parent handles glass morphism
        'cursor-pointer select-none',
        'transition-transform duration-200 ease-out',
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
