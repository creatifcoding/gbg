/**
 * @fileoverview PortNode Component
 *
 * ReactFlow custom node that wraps Port compound component.
 * Bridges ReactFlow node system with Port stx state machine.
 *
 * @module dataplane/components/Port/PortNode
 */

import React, { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useAtomValue } from '@effect-atom/atom-react';

import { linksForPortAtom } from '../../atoms';
import type { LinkPort, PortDirection as SchemaPortDirection, PortDataType } from '../../schemas/link';
import { PortProvider } from './context';
import { PortItem } from './Item';
import { PortBadge } from './Badge';
import { portStateValueAtom } from './port-stx';
import type { PortSize } from './types';

// =============================================================================
// Types
// =============================================================================

export interface PortNodeData {
  /** Port data from dataplane schema */
  port: LinkPort;
  /** Block label (for display) */
  blockLabel?: string;
  /** Size variant for Port component */
  size?: PortSize;
}

export interface PortNodeProps {
  data: PortNodeData;
  selected?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const DIRECTION_COLORS: Record<SchemaPortDirection, { bg: string; border: string; glow: string }> = {
  in: {
    bg: 'rgba(34, 211, 238, 0.15)',
    border: 'rgba(34, 211, 238, 0.6)',
    glow: '0 0 12px rgba(34, 211, 238, 0.4)',
  },
  out: {
    bg: 'rgba(251, 191, 36, 0.15)',
    border: 'rgba(251, 191, 36, 0.6)',
    glow: '0 0 12px rgba(251, 191, 36, 0.4)',
  },
  inout: {
    bg: 'rgba(167, 139, 250, 0.15)',
    border: 'rgba(167, 139, 250, 0.6)',
    glow: '0 0 12px rgba(167, 139, 250, 0.4)',
  },
};

const DATA_TYPE_ICONS: Record<PortDataType, string> = {
  geojson: '◎',
  table: '⊞',
  row: '─',
  cell: '◻',
  json: '{}',
  stream: '≋',
};

// =============================================================================
// Inner Component (uses Port context)
// =============================================================================

interface PortNodeInnerProps {
  port: LinkPort;
  blockLabel?: string;
  selected?: boolean;
}

const PortNodeInner = memo(function PortNodeInner({
  port,
  blockLabel,
  selected,
}: PortNodeInnerProps) {
  const colors = DIRECTION_COLORS[port.direction];
  const typeIcon = DATA_TYPE_ICONS[port.dataType];

  // Get connection count via dataplane atoms
  const links = useAtomValue(useMemo(() => linksForPortAtom(port.id), [port.id]));
  const connectionCount = links.length;
  const isConnected = connectionCount > 0;

  // Get current visual state from port machine
  const state = useAtomValue(portStateValueAtom(port.id));
  const isExpanded = state === 'expanded';
  const isLinking = state === 'linking';

  // Determine handle visibility based on port direction
  const showSourceHandle = port.direction === 'out' || port.direction === 'inout';
  const showTargetHandle = port.direction === 'in' || port.direction === 'inout';

  return (
    <div
      className="relative"
      style={{
        // Apply direction-based colors as container overlay
        backgroundColor: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: '12px',
        boxShadow: selected || isConnected || isLinking ? colors.glow : 'none',
        minWidth: 90,
        transition: 'all 200ms ease-out',
      }}
    >
      {/* Port compound component */}
      <PortItem className="bg-transparent border-none">
        {/* Direction icon */}
        <span
          className="text-base font-mono opacity-70"
          title={`Direction: ${port.direction}`}
        >
          {port.direction === 'in' ? '→' : port.direction === 'out' ? '←' : '↔'}
        </span>

        {/* Port label */}
        <span
          className="font-mono font-medium"
          style={{
            color: colors.border,
            fontSize: 'var(--tmnl-text-xs, 12px)',
          }}
        >
          {port.label ?? port.direction.toUpperCase()}
        </span>

        {/* Data type indicator */}
        <span
          className="text-sm font-mono opacity-60"
          title={port.dataType}
        >
          {typeIcon}
        </span>

        {/* Status badge */}
        <PortBadge
          status={isConnected ? 'connected' : 'idle'}
          count={connectionCount > 0 ? connectionCount : undefined}
        />
      </PortItem>

      {/* Block ID (truncated) */}
      {blockLabel && (
        <div
          className="text-center text-xs font-mono text-gray-500 px-2 pb-1 truncate"
          style={{ fontSize: '10px', maxWidth: '100%' }}
        >
          {blockLabel}
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
// Main Component (wraps with PortProvider)
// =============================================================================

/**
 * PortNode
 *
 * Custom ReactFlow node for dataplane ports.
 * Wraps Port compound component with provider for:
 * - Actor lifecycle management (create/dispose)
 * - Visual state machine (hover, expand, linking)
 * - effect-atom reactive subscriptions
 *
 * Features:
 * - Direction-based coloring (in: cyan, out: amber, inout: purple)
 * - Data type indicator icons
 * - Connection count badge via PortBadge
 * - Handles for edge connections
 * - Visual states: collapsed → hovered → expanded → linking
 */
export const PortNode = memo(function PortNode({
  data,
  selected,
}: PortNodeProps): React.ReactElement {
  const port = data.port;
  const size = data.size ?? 'default';

  return (
    <PortProvider portId={port.id} size={size}>
      <PortNodeInner
        port={port}
        blockLabel={data.blockLabel}
        selected={selected}
      />
    </PortProvider>
  );
});

// =============================================================================
// Exports
// =============================================================================

export default PortNode;
