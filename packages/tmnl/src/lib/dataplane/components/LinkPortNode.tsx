/**
 * @fileoverview LinkPortNode Component
 *
 * Custom React Flow node for dataplane ports.
 * Renders as a connection point with direction indicators.
 *
 * @module dataplane/components/LinkPortNode
 */

import React, { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useAtomValue } from '@effect-atom/atom-react';

import { linksForPortAtom } from '../atoms';
import type { LinkPort, PortDirection, PortDataType } from '../schemas/link';

// =============================================================================
// Types
// =============================================================================

export interface LinkPortNodeData {
  /** Port data */
  port: LinkPort;
  /** Block label (for display) */
  blockLabel?: string;
}

export type LinkPortNodeProps = NodeProps<LinkPortNodeData>;

// =============================================================================
// Constants
// =============================================================================

const DIRECTION_COLORS: Record<PortDirection, { bg: string; border: string; glow: string }> = {
  in: {
    bg: 'rgba(34, 211, 238, 0.2)',
    border: 'rgba(34, 211, 238, 0.8)',
    glow: '0 0 12px rgba(34, 211, 238, 0.5)',
  },
  out: {
    bg: 'rgba(251, 191, 36, 0.2)',
    border: 'rgba(251, 191, 36, 0.8)',
    glow: '0 0 12px rgba(251, 191, 36, 0.5)',
  },
  inout: {
    bg: 'rgba(167, 139, 250, 0.2)',
    border: 'rgba(167, 139, 250, 0.8)',
    glow: '0 0 12px rgba(167, 139, 250, 0.5)',
  },
};

const DATA_TYPE_ICONS: Record<PortDataType, string> = {
  table: '⊞',
  row: '─',
  cell: '◻',
  json: '{}',
  stream: '≋',
};

// =============================================================================
// Component
// =============================================================================

/**
 * Custom React Flow node for dataplane ports.
 *
 * Features:
 * - Direction-based coloring
 * - Data type indicator
 * - Connection state display
 * - Handles for edge connections
 */
export const LinkPortNode = memo(function LinkPortNode({
  data,
  selected,
}: LinkPortNodeProps): React.ReactElement {
  const port = data.port;
  const colors = DIRECTION_COLORS[port.direction];
  const typeIcon = DATA_TYPE_ICONS[port.dataType];

  // Get connection count
  const links = useAtomValue(useMemo(() => linksForPortAtom(port.id), [port.id]));
  const connectionCount = links.length;
  const isConnected = connectionCount > 0;

  // Determine handle positions based on port direction
  const showSourceHandle = port.direction === 'out' || port.direction === 'inout';
  const showTargetHandle = port.direction === 'in' || port.direction === 'inout';

  return (
    <div
      className="
        relative
        flex flex-col items-center
        px-3 py-2
        rounded-lg
        cursor-pointer
        transition-all duration-150
      "
      style={{
        backgroundColor: colors.bg,
        border: `2px solid ${colors.border}`,
        boxShadow: selected || isConnected ? colors.glow : 'none',
        minWidth: 80,
      }}
    >
      {/* Port label */}
      <div
        className="text-xs font-mono font-medium"
        style={{
          color: colors.border,
          fontSize: 'var(--tmnl-text-xs, 12px)',
        }}
      >
        {port.label ?? port.direction.toUpperCase()}
      </div>

      {/* Data type indicator */}
      <div
        className="text-lg font-mono opacity-60"
        title={port.dataType}
      >
        {typeIcon}
      </div>

      {/* Block ID (truncated) */}
      {data.blockLabel && (
        <div
          className="text-xs font-mono text-gray-400 truncate max-w-full"
          style={{ fontSize: '10px' }}
        >
          {data.blockLabel}
        </div>
      )}

      {/* Connection count badge */}
      {isConnected && (
        <div
          className="
            absolute -top-2 -right-2
            w-5 h-5 rounded-full
            bg-white text-black
            text-xs font-bold
            flex items-center justify-center
          "
          style={{ fontSize: '10px' }}
        >
          {connectionCount}
        </div>
      )}

      {/* Target handle (for incoming connections) */}
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          id={`${port.id}-target`}
          className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-cyan-300"
          style={{
            boxShadow: '0 0 6px rgba(34, 211, 238, 0.5)',
          }}
        />
      )}

      {/* Source handle (for outgoing connections) */}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
          id={`${port.id}-source`}
          className="!w-3 !h-3 !bg-amber-500 !border-2 !border-amber-300"
          style={{
            boxShadow: '0 0 6px rgba(251, 191, 36, 0.5)',
          }}
        />
      )}
    </div>
  );
});

// =============================================================================
// Exports
// =============================================================================

export default LinkPortNode;
