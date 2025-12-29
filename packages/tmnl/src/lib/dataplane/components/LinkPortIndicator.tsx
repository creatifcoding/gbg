/**
 * @fileoverview LinkPortIndicator Component
 *
 * Visual indicator for dataplane connection ports on EmbeddedBlockWrapper.
 * Shows port position, direction, connection state, and data type.
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <LinkPortIndicator
 *     portId={portId}
 *     position="left"
 *     direction="in"
 *     dataType="table"
 *   />
 *   <BlockContent />
 *   <LinkPortIndicator
 *     portId={outPortId}
 *     position="right"
 *     direction="out"
 *     dataType="table"
 *   />
 * </div>
 * ```
 */

import React, { useMemo } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import { cn } from '@/lib/utils';

import { linksForPortAtom } from '../atoms';
import type { PortId, PortDirection, PortPosition, PortDataType } from '../schemas/link';

// =============================================================================
// Types
// =============================================================================

export interface LinkPortIndicatorProps {
  /** Port ID for connection tracking */
  portId: PortId;

  /** Position on the block edge */
  position: PortPosition;

  /** Data flow direction */
  direction: PortDirection;

  /** Type of data this port handles */
  dataType: PortDataType;

  /** Optional className for customization */
  className?: string;

  /** Whether the port is currently being hovered for connection */
  isHovered?: boolean;

  /** Whether a drag operation is targeting this port */
  isDragTarget?: boolean;

  /** Callback when port is clicked */
  onClick?: () => void;

  /** Callback when port drag starts (for link creation) */
  onDragStart?: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const POSITION_STYLES: Record<PortPosition, string> = {
  left: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
  right: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
  top: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
  bottom: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
};

const DIRECTION_COLORS: Record<PortDirection, { base: string; connected: string; glow: string }> = {
  in: {
    base: 'bg-cyan-900/60 border-cyan-700/50',
    connected: 'bg-cyan-600 border-cyan-400',
    glow: 'shadow-[0_0_8px_rgba(34,211,238,0.5)]',
  },
  out: {
    base: 'bg-amber-900/60 border-amber-700/50',
    connected: 'bg-amber-600 border-amber-400',
    glow: 'shadow-[0_0_8px_rgba(251,191,36,0.5)]',
  },
  inout: {
    base: 'bg-violet-900/60 border-violet-700/50',
    connected: 'bg-violet-600 border-violet-400',
    glow: 'shadow-[0_0_8px_rgba(167,139,250,0.5)]',
  },
};

const DATA_TYPE_ICONS: Record<PortDataType, string> = {
  table: '⊞',    // Grid/table
  row: '─',      // Single row
  cell: '◻',     // Single cell
  json: '{ }',   // JSON object
  stream: '≋',   // Streaming data
};

// =============================================================================
// Component
// =============================================================================

/**
 * Visual indicator for a dataplane port.
 *
 * Features:
 * - Position-aware placement (left/right/top/bottom)
 * - Direction-based coloring (in=cyan, out=amber, inout=violet)
 * - Connection state glow
 * - Data type indicator
 * - Hover/drag target states
 */
export function LinkPortIndicator({
  portId,
  position,
  direction,
  dataType,
  className,
  isHovered = false,
  isDragTarget = false,
  onClick,
  onDragStart,
}: LinkPortIndicatorProps): React.ReactElement {
  // Check connection state
  const links = useAtomValue(useMemo(() => linksForPortAtom(portId), [portId]));
  const isConnected = links.length > 0;

  // Get colors based on direction
  const colors = DIRECTION_COLORS[direction];
  const colorClass = isConnected ? colors.connected : colors.base;
  const glowClass = isConnected ? colors.glow : '';

  // Get position styles
  const positionClass = POSITION_STYLES[position];

  // Get data type icon
  const typeIcon = DATA_TYPE_ICONS[dataType];

  return (
    <div
      className={cn(
        // Base styles
        'absolute z-10',
        'w-4 h-4 rounded-full',
        'border-2',
        'flex items-center justify-center',
        'cursor-pointer',
        'transition-all duration-150 ease-out',

        // Position
        positionClass,

        // Colors
        colorClass,
        glowClass,

        // Hover states
        'hover:scale-125',
        isHovered && 'scale-125 ring-2 ring-white/30',
        isDragTarget && 'scale-150 ring-2 ring-white/50 animate-pulse',

        // Custom class
        className
      )}
      onClick={onClick}
      onMouseDown={onDragStart}
      title={`${direction} port (${dataType})`}
      data-port-id={portId}
      data-port-direction={direction}
      data-port-position={position}
      data-port-connected={isConnected}
    >
      {/* Data type indicator - only show on hover or when connected */}
      <span
        className={cn(
          'text-[8px] font-mono text-white/70',
          'opacity-0 group-hover:opacity-100',
          isConnected && 'opacity-100'
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)', transform: 'scale(0.6)' }}
      >
        {typeIcon}
      </span>

      {/* Connection count badge */}
      {isConnected && links.length > 1 && (
        <span
          className={cn(
            'absolute -top-1 -right-1',
            'w-3 h-3 rounded-full',
            'bg-white text-black',
            'text-[8px] font-bold',
            'flex items-center justify-center'
          )}
          style={{ fontSize: '8px' }}
        >
          {links.length}
        </span>
      )}

      {/* Direction arrow indicator */}
      <DirectionArrow direction={direction} position={position} />
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

interface DirectionArrowProps {
  direction: PortDirection;
  position: PortPosition;
}

function DirectionArrow({ direction, position }: DirectionArrowProps): React.ReactElement | null {
  // Only show arrow for directional ports
  if (direction === 'inout') return null;

  // Determine arrow direction based on port position and direction
  const isInput = direction === 'in';
  const arrowRotation = getArrowRotation(position, isInput);

  return (
    <span
      className="absolute text-white/50 text-[10px] pointer-events-none"
      style={{
        transform: `rotate(${arrowRotation}deg)`,
        [position === 'left' || position === 'right' ? 'left' : 'top']:
          position === 'left' || position === 'top' ? '-12px' : 'auto',
        [position === 'left' || position === 'right' ? 'right' : 'bottom']:
          position === 'right' || position === 'bottom' ? '-12px' : 'auto',
      }}
    >
      →
    </span>
  );
}

function getArrowRotation(position: PortPosition, isInput: boolean): number {
  const baseRotation: Record<PortPosition, number> = {
    left: 0,
    right: 180,
    top: 90,
    bottom: 270,
  };

  let rotation = baseRotation[position];
  if (isInput) rotation += 180;

  return rotation;
}

// =============================================================================
// Exports
// =============================================================================

export default LinkPortIndicator;
