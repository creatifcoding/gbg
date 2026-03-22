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

import React, { useMemo, useCallback } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';

// =============================================================================
// Utilities
// =============================================================================

/** Simple class name concatenation utility */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

import {
  linksForPortAtom,
  shouldShowPortsAtom,
  isLinkingAtom,
} from '../atoms';
import type { PortId, PortDirection, PortPosition, PortDataType, BlockId } from '../schemas/link';

// =============================================================================
// Types
// =============================================================================

export interface LinkPortIndicatorProps {
  /** Port ID for connection tracking */
  portId: PortId;

  /** Block ID for visibility control (required for hover reveal) */
  blockId: BlockId;

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

  /** Whether this port is the pending source of the link operation */
  isPendingSource?: boolean;

  /** Callback when port is clicked */
  onClick?: () => void;

  /** Callback when port drag starts (for link creation) */
  onDragStart?: () => void;

  /** Callback when mouse enters the port (for hover feedback during linking) */
  onMouseEnter?: () => void;

  /** Callback when mouse leaves the port (for hover feedback during linking) */
  onMouseLeave?: () => void;
}

// =============================================================================
// Constants
// =============================================================================

/** Hitbox position - larger invisible zone for hover detection */
const HITBOX_POSITION_STYLES: Record<PortPosition, string> = {
  left: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
  right: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
  top: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
  bottom: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
};

/** Hitbox dimensions - wider on the axis parallel to the edge */
const HITBOX_DIMENSIONS: Record<PortPosition, string> = {
  left: 'w-6 h-12',   // Vertical rectangle on left edge
  right: 'w-6 h-12',  // Vertical rectangle on right edge
  top: 'w-12 h-6',    // Horizontal rectangle on top edge
  bottom: 'w-12 h-6', // Horizontal rectangle on bottom edge
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
  geojson: '◎',  // Geographic data (target/coordinates)
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
 * Visual indicator for a dataplane port with hover-reveal behavior.
 *
 * Features:
 * - Invisible hitbox zone for hover detection
 * - Port only visible when block is hovered or linking mode active
 * - Position-aware placement (left/right/top/bottom)
 * - Direction-based coloring (in=cyan, out=amber, inout=violet)
 * - Connection state glow
 * - Data type indicator
 */
export function LinkPortIndicator({
  portId,
  blockId,
  position,
  direction,
  dataType,
  className,
  isHovered = false,
  isDragTarget = false,
  isPendingSource = false,
  onClick,
  onDragStart,
  onMouseEnter,
  onMouseLeave,
}: LinkPortIndicatorProps): React.ReactElement {
  // Check connection state
  const links = useAtomValue(useMemo(() => linksForPortAtom(portId), [portId]));
  const isConnected = links.length > 0;

  // Check visibility from hover state
  const shouldShow = useAtomValue(useMemo(() => shouldShowPortsAtom(blockId), [blockId]));
  const isLinking = useAtomValue(isLinkingAtom);

  // Handle hitbox hover - NOTE: We do NOT manage hoveredBlockIdAtom here.
  // That's the parent EmbeddedBlockWrapper's responsibility.
  // The port only triggers optional callbacks for port-specific hover feedback.
  const handleHitboxEnter = useCallback(() => {
    onMouseEnter?.();
  }, [onMouseEnter]);

  const handleHitboxLeave = useCallback(() => {
    onMouseLeave?.();
  }, [onMouseLeave]);

  // Get colors based on direction
  const colors = DIRECTION_COLORS[direction];
  const colorClass = isConnected ? colors.connected : colors.base;
  const glowClass = isConnected ? colors.glow : '';

  // Get hitbox styles
  const hitboxPositionClass = HITBOX_POSITION_STYLES[position];
  const hitboxDimensions = HITBOX_DIMENSIONS[position];

  // Get data type icon
  const typeIcon = DATA_TYPE_ICONS[dataType];

  // Port is always visible if connected (shows relationship), otherwise follow hover state
  const isVisible = shouldShow || isConnected;

  return (
    <div
      className={cn(
        // Hitbox styles - invisible but interactive
        'absolute z-10',
        'flex items-center justify-center',
        'cursor-pointer',
        hitboxPositionClass,
        hitboxDimensions,
        // Debug: uncomment to see hitbox
        // 'bg-red-500/20',
      )}
      onMouseEnter={handleHitboxEnter}
      onMouseLeave={handleHitboxLeave}
      onClick={onClick}
      onMouseDown={onDragStart}
      data-port-hitbox={portId}
      data-port-position={position}
    >
      {/* Visual port indicator - only shown when visible */}
      <div
        className={cn(
          // Base styles
          'w-4 h-4 rounded-full',
          'border-2',
          'flex items-center justify-center',
          'transition-all duration-150 ease-out',

          // Colors
          colorClass,
          glowClass,

          // Visibility transitions
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75',

          // Hover states (when visible)
          isVisible && 'hover:scale-125',
          isHovered && 'scale-125 ring-2 ring-white/30',
          isDragTarget && 'scale-150 ring-2 ring-white/50 animate-pulse',

          // Linking mode states
          isLinking && !isPendingSource && 'ring-1 ring-white/20 animate-pulse',
          isPendingSource && 'scale-150 ring-2 ring-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]',

          // Custom class
          className
        )}
        title={`${direction} port (${dataType})${isPendingSource ? ' - Click another port to link' : ''}`}
        data-port-id={portId}
        data-port-direction={direction}
        data-port-position={position}
        data-port-connected={isConnected}
        data-port-linking={isLinking}
        data-port-pending-source={isPendingSource}
        data-port-visible={isVisible}
      >
        {/* Data type indicator - only show when visible */}
        {isVisible && (
          <span
            className={cn(
              'font-mono text-white/70',
              'transition-opacity duration-100',
              isConnected ? 'opacity-100' : 'opacity-70'
            )}
            style={{ fontSize: '8px' }}
          >
            {typeIcon}
          </span>
        )}

        {/* Connection count badge */}
        {isVisible && isConnected && links.length > 1 && (
          <span
            className={cn(
              'absolute -top-1 -right-1',
              'w-3 h-3 rounded-full',
              'bg-white text-black',
              'font-bold',
              'flex items-center justify-center'
            )}
            style={{ fontSize: '8px' }}
          >
            {links.length}
          </span>
        )}

        {/* Direction arrow indicator */}
        {isVisible && <DirectionArrow direction={direction} position={position} />}
      </div>
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
