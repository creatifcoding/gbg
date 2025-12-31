/**
 * @fileoverview PortNode Component
 *
 * ReactFlow custom node that wraps Port compound component.
 * Bridges ReactFlow node system with Port stx state machine.
 *
 * Features:
 * - Direction-based coloring (in: cyan, out: amber, inout: purple)
 * - Data type indicator icons
 * - Connection count badge via PortBadge
 * - Handles for edge connections
 * - Visual states: collapsed → hovered → expanded → linking
 * - Expandable sidebar with Info/Config/Links tabs
 *
 * @module dataplane/components/Port/PortNode
 */

import React, { memo, useMemo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useAtomValue } from '@effect-atom/atom-react';
import { Link2, Settings, Trash2, Unplug } from 'lucide-react';

import { Icon } from '../Icon';
import { linksForPortAtom } from '../../atoms';
import type { LinkPort, PortDirection as SchemaPortDirection, PortDataType, Link } from '../../schemas/link';
import { PortProvider } from './context';
import { PortItem } from './Item';
import { PortBadge } from './Badge';
import { portStateValueAtom, portOps } from './port-stx';
import { Sidebar as PortSidebar } from './Sidebar';
import { Tab as PortTab } from './Tab';
import { Actions as PortActions } from './Actions';
import { Action as PortAction } from './Action';
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
  table: '⊞',
  row: '─',
  cell: '◻',
  json: '{}',
};

// =============================================================================
// Tab Panel Components
// =============================================================================

interface PortInfoPanelProps {
  port: LinkPort;
  links: readonly Link[];
}

/** Info tab: connection status, block ID, data type, direction */
const PortInfoPanel = memo(function PortInfoPanel({ port, links }: PortInfoPanelProps) {
  return (
    <div className="space-y-2 text-foreground">
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <span className="text-muted-foreground" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          ID
        </span>
        <span className="font-mono truncate" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {port.id.slice(0, 12)}...
        </span>

        <span className="text-muted-foreground" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          Block
        </span>
        <span className="font-mono truncate" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {port.blockId.slice(0, 12)}...
        </span>

        <span className="text-muted-foreground" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          Direction
        </span>
        <span
          className="font-mono uppercase"
          style={{
            fontSize: 'var(--tmnl-text-xs, 12px)',
            color: port.direction === 'in' ? '#22d3ee' : port.direction === 'out' ? '#fbbf24' : '#a78bfa',
          }}
        >
          {port.direction}
        </span>

        <span className="text-muted-foreground" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          Data Type
        </span>
        <span className="font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {port.dataType}
        </span>

        <span className="text-muted-foreground" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          Connections
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 'var(--tmnl-text-xs, 12px)',
            color: links.length > 0 ? '#22d3ee' : 'inherit',
          }}
        >
          {links.length}
        </span>
      </div>
    </div>
  );
});

interface PortConfigPanelProps {
  port: LinkPort;
}

/** Config tab: rename, validation rules, settings */
const PortConfigPanel = memo(function PortConfigPanel({ port }: PortConfigPanelProps) {
  return (
    <div className="space-y-3">
      {/* Label field */}
      <div>
        <label
          className="block text-muted-foreground mb-1"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Label
        </label>
        <input
          type="text"
          defaultValue={port.label ?? ''}
          placeholder={port.direction.toUpperCase()}
          className="
            w-full px-2 py-1 rounded
            bg-surface-2 border border-surface-3
            text-foreground font-mono
            focus:outline-none focus:border-cyan-500/50
          "
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Data type (read-only) */}
      <div>
        <label
          className="block text-muted-foreground mb-1"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Data Type
        </label>
        <div
          className="
            px-2 py-1 rounded
            bg-surface-2 border border-surface-3
            text-muted-foreground font-mono
          "
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {port.dataType}
        </div>
      </div>

      {/* Position */}
      <div>
        <label
          className="block text-muted-foreground mb-1"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Position
        </label>
        <div
          className="
            px-2 py-1 rounded
            bg-surface-2 border border-surface-3
            text-muted-foreground font-mono capitalize
          "
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {port.position}
        </div>
      </div>
    </div>
  );
});

interface PortLinksPanelProps {
  port: LinkPort;
  links: readonly Link[];
}

/** Links tab: list of connected ports with quick actions */
const PortLinksPanel = memo(function PortLinksPanel({ port, links }: PortLinksPanelProps) {
  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
        <Icon icon={Unplug} size={20} color="muted" className="mb-2 opacity-50" />
        <span style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>No connections</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {links.map((link) => {
        const isSource = link.sourcePort === port.id;
        const connectedPortId = isSource ? link.targetPort : link.sourcePort;

        return (
          <div
            key={link.id}
            className="
              flex items-center gap-2
              px-2 py-1.5 rounded
              bg-surface-2 border border-surface-3
              hover:border-surface-4 transition-colors
            "
          >
            {/* Direction indicator */}
            <span
              className="font-mono"
              style={{
                fontSize: 'var(--tmnl-text-xs, 12px)',
                color: isSource ? '#fbbf24' : '#22d3ee',
              }}
            >
              {isSource ? '→' : '←'}
            </span>

            {/* Connected port ID */}
            <span
              className="font-mono truncate flex-1"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {connectedPortId.slice(0, 10)}...
            </span>

            {/* Link type badge */}
            <span
              className="
                px-1.5 py-0.5 rounded
                bg-surface-3 text-muted-foreground
                font-mono uppercase
              "
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {link.relationship}
            </span>
          </div>
        );
      })}
    </div>
  );
});

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
  const isHovered = state === 'hovered';
  const isLinking = state === 'linking';

  // Determine handle visibility based on port direction
  const showSourceHandle = port.direction === 'out' || port.direction === 'inout';
  const showTargetHandle = port.direction === 'in' || port.direction === 'inout';

  // ==========================================================================
  // Event Handlers (stx integration)
  // ==========================================================================

  const handleMouseEnter = useCallback(() => {
    portOps.hover(port.id);
  }, [port.id]);

  const handleMouseLeave = useCallback(() => {
    portOps.unhover(port.id);
  }, [port.id]);

  const handleClick = useCallback(() => {
    if (isExpanded) {
      portOps.collapse(port.id);
    } else {
      portOps.expand(port.id);
    }
  }, [port.id, isExpanded]);

  const handleStartLinking = useCallback(() => {
    portOps.startLinking(port.id);
  }, [port.id]);

  const handleDelete = useCallback(() => {
    // TODO: Wire to dataplaneOps.removePort when available
    console.log('[PortNode] Delete requested for:', port.id);
  }, [port.id]);

  const handleConfigure = useCallback(() => {
    // Expand and switch to config tab
    portOps.expand(port.id);
    portOps.selectTab(port.id, 'config');
  }, [port.id]);

  return (
    <div
      className="relative"
      style={{
        backgroundColor: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: '12px',
        boxShadow: selected || isConnected || isLinking || isHovered ? colors.glow : 'none',
        minWidth: isExpanded ? 240 : 90,
        transition: 'all 200ms ease-out',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Port compound component */}
      <PortItem className="bg-transparent border-none cursor-pointer">
        {/* Direction icon */}
        <span
          className="font-mono opacity-70"
          title={`Direction: ${port.direction}`}
          style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
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
          className="font-mono opacity-60"
          title={port.dataType}
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
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
          className="text-center font-mono text-muted-foreground px-2 pb-1 truncate"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)', maxWidth: '100%' }}
        >
          {blockLabel}
        </div>
      )}

      {/* Actions (visible on hover/expanded) */}
      <PortActions className="justify-center gap-1 py-1">
        <PortAction
          icon={<Icon icon={Link2} size={14} color="cyan" />}
          onClick={handleStartLinking}
          label="Start linking"
        />
        <PortAction
          icon={<Icon icon={Settings} size={14} color="muted" />}
          onClick={handleConfigure}
          label="Configure"
        />
        <PortAction
          icon={<Icon icon={Trash2} size={14} color="red" />}
          onClick={handleDelete}
          label="Delete"
          variant="destructive"
        />
      </PortActions>

      {/* Sidebar (visible when expanded) */}
      <PortSidebar width={220}>
        <PortTab id="info" label="Info">
          <PortInfoPanel port={port} links={links} />
        </PortTab>
        <PortTab id="config" label="Config">
          <PortConfigPanel port={port} />
        </PortTab>
        <PortTab id="links" label="Links">
          <PortLinksPanel port={port} links={links} />
        </PortTab>
      </PortSidebar>

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

export default PortNode;
