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

import React, { memo, useMemo, useCallback, type CSSProperties } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useAtomValue } from '@effect-atom/atom-react';
import { Link2, Settings, Trash2, Unplug, Maximize2, ChevronDown, ChevronUp } from 'lucide-react';

import { Icon } from '../Icon';
import { linksForPortAtom } from '../../atoms';
import type { LinkPort, PortDirection as SchemaPortDirection, PortDataType, Link } from '../../schemas/link';
import { PortProvider } from './context';
import { PortItem } from './Item';
import { PortBadge } from './Badge';
import { portSnapshotAtom, portOps, type PortVisualState } from './port-stx';
import { Sidebar as PortSidebar } from './Sidebar';
import { Tab as PortTab } from './Tab';
import { Actions as PortActions } from './Actions';
import { Action as PortAction } from './Action';
import type { PortSize } from './types';
import {
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  VANTA_SPACING,
  VANTA_BORDERS,
  VANTA_ANIMATION,
  VANTA_CARD_VARIANTS,
} from '@/components/portal/tokens';

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

/**
 * VANTA-aligned direction colors
 * Uses VANTA accent palette for consistent blackout aesthetic
 */
const DIRECTION_COLORS: Record<
  SchemaPortDirection,
  { accent: string; muted: string; glow: string; glowShadow: string }
> = {
  in: {
    accent: VANTA_COLORS.accent.cyan,
    muted: VANTA_COLORS.accent.cyanMuted,
    glow: VANTA_COLORS.accent.cyanGlow,
    glowShadow: VANTA_BORDERS.shadow.glowCyan,
  },
  out: {
    accent: VANTA_COLORS.accent.amber,
    muted: VANTA_COLORS.accent.amberMuted,
    glow: VANTA_COLORS.accent.amberGlow,
    glowShadow: VANTA_BORDERS.shadow.glowAmber,
  },
  inout: {
    accent: VANTA_COLORS.accent.violet,
    muted: VANTA_COLORS.accent.violetMuted,
    glow: VANTA_COLORS.accent.violetGlow,
    glowShadow: `0 0 20px ${VANTA_COLORS.accent.violetGlow}`,
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
  const dirColors = DIRECTION_COLORS[port.direction];

  const labelStyle: CSSProperties = {
    ...VANTA_TYPOGRAPHY.preset.label,
    color: VANTA_COLORS.text.muted,
  };

  const valueStyle: CSSProperties = {
    ...VANTA_TYPOGRAPHY.preset.micro,
    color: VANTA_COLORS.text.secondary,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: VANTA_SPACING['2'] }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: `${VANTA_SPACING['1']} ${VANTA_SPACING['3']}` }}>
        <span style={labelStyle}>ID</span>
        <span style={valueStyle}>{port.id.slice(0, 12)}...</span>

        <span style={labelStyle}>Block</span>
        <span style={valueStyle}>{port.blockId.slice(0, 12)}...</span>

        <span style={labelStyle}>Direction</span>
        <span style={{ ...valueStyle, color: dirColors.accent, textTransform: 'uppercase' }}>
          {port.direction}
        </span>

        <span style={labelStyle}>Data Type</span>
        <span style={valueStyle}>{port.dataType}</span>

        <span style={labelStyle}>Connections</span>
        <span style={{ ...valueStyle, color: links.length > 0 ? VANTA_COLORS.accent.cyan : VANTA_COLORS.text.secondary }}>
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
  const labelStyle: CSSProperties = {
    ...VANTA_TYPOGRAPHY.preset.label,
    color: VANTA_COLORS.text.muted,
    marginBottom: VANTA_SPACING['1'],
    display: 'block',
  };

  const inputStyle: CSSProperties = {
    ...VANTA_TYPOGRAPHY.preset.micro,
    width: '100%',
    padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
    borderRadius: VANTA_BORDERS.radius.sm,
    background: VANTA_COLORS.surface.elevated,
    border: VANTA_BORDERS.style.subtle,
    color: VANTA_COLORS.text.secondary,
    outline: 'none',
    transition: VANTA_ANIMATION.transition.colors,
  };

  const readOnlyStyle: CSSProperties = {
    ...inputStyle,
    color: VANTA_COLORS.text.muted,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: VANTA_SPACING['3'] }}>
      {/* Label field */}
      <div>
        <label style={labelStyle}>Label</label>
        <input
          type="text"
          defaultValue={port.label ?? ''}
          placeholder={port.direction.toUpperCase()}
          style={inputStyle}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Data type (read-only) */}
      <div>
        <label style={labelStyle}>Data Type</label>
        <div style={readOnlyStyle}>{port.dataType}</div>
      </div>

      {/* Position */}
      <div>
        <label style={labelStyle}>Position</label>
        <div style={{ ...readOnlyStyle, textTransform: 'capitalize' }}>{port.position}</div>
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
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: VANTA_SPACING['4'],
        color: VANTA_COLORS.text.muted,
      }}>
        <Icon icon={Unplug} size={20} color="muted" style={{ marginBottom: VANTA_SPACING['2'], opacity: 0.5 }} />
        <span style={VANTA_TYPOGRAPHY.preset.micro}>No connections</span>
      </div>
    );
  }

  const linkItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: VANTA_SPACING['2'],
    padding: `${VANTA_SPACING['1.5']} ${VANTA_SPACING['2']}`,
    borderRadius: VANTA_BORDERS.radius.sm,
    background: VANTA_COLORS.surface.elevated,
    border: VANTA_BORDERS.style.subtle,
    transition: VANTA_ANIMATION.transition.colors,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: VANTA_SPACING['2'] }}>
      {links.map((link) => {
        const isSource = link.sourcePort === port.id;
        const connectedPortId = isSource ? link.targetPort : link.sourcePort;

        return (
          <div key={link.id} style={linkItemStyle}>
            {/* Direction indicator */}
            <span style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: isSource ? VANTA_COLORS.accent.amber : VANTA_COLORS.accent.cyan,
            }}>
              {isSource ? '→' : '←'}
            </span>

            {/* Connected port ID */}
            <span style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.secondary,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {connectedPortId.slice(0, 10)}...
            </span>

            {/* Link type badge */}
            <span style={{
              ...VANTA_TYPOGRAPHY.preset.label,
              padding: `${VANTA_SPACING['0.5']} ${VANTA_SPACING['1.5']}`,
              borderRadius: VANTA_BORDERS.radius.sm,
              background: VANTA_COLORS.surface.raised,
              color: VANTA_COLORS.text.muted,
            }}>
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

  // Get current visual state from port machine snapshot (uses panelRegistry via context)
  const snapshot = useAtomValue(useMemo(() => portSnapshotAtom(port.id), [port.id]));
  const state = (snapshot?.value ?? 'collapsed') as PortVisualState;
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

  // Toggle actions visibility (collapsed ↔ hovered) - with stopPropagation for ReactFlow
  const handleToggleActions = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent ReactFlow from intercepting
    console.log(`[PortNode] 👆 Toggle clicked, current state: ${state}, isExpanded: ${isExpanded}`);
    if (isExpanded) {
      console.log(`[PortNode] → Collapsing ${port.id}`);
      portOps.collapse(port.id);
    } else {
      console.log(`[PortNode] → Toggling actions for ${port.id}`);
      portOps.toggleActions(port.id);
    }
  }, [port.id, isExpanded, state]);

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

  const handleExpand = useCallback(() => {
    // Expand to info tab
    portOps.expand(port.id);
    portOps.selectTab(port.id, 'info');
  }, [port.id]);

  // ==========================================================================
  // VANTA Blackout Container Styling
  // ==========================================================================

  // Determine glow state
  const showGlow = selected || isConnected || isHovered || isLinking;

  // VANTA container styles — near-black surfaces with accent glows
  const containerStyle: CSSProperties = {
    position: 'relative',
    background: VANTA_COLORS.gradient.surface,
    border: showGlow ? `1px solid ${colors.muted}` : VANTA_BORDERS.style.subtle,
    borderRadius: VANTA_BORDERS.radius.md,
    boxShadow: isLinking
      ? `${VANTA_BORDERS.shadow.card}, ${colors.glowShadow}`
      : showGlow
        ? `${VANTA_BORDERS.shadow.elevated}, ${colors.glowShadow}`
        : VANTA_BORDERS.shadow.card,
    padding: VANTA_SPACING['3'],
    minWidth: isExpanded ? '240px' : '90px',
    transition: VANTA_ANIMATION.transition.all,
    // Pulsing animation for linking state
    animation: isLinking ? 'vanta-port-pulse 2s ease-in-out infinite' : undefined,
  };

  // Depth gradient overlay (VantaCard pattern)
  const depthOverlayStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: VANTA_COLORS.gradient.depth,
    pointerEvents: 'none',
    borderRadius: VANTA_BORDERS.radius.md,
  };

  return (
    <div
      style={containerStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* VANTA depth gradient overlay */}
      <div style={depthOverlayStyle} />

      {/* Content layer */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Port compound component */}
        <PortItem className="bg-transparent border-none">
          {/* Toggle button - explicit click target */}
          <button
            type="button"
            onClick={handleToggleActions}
            style={{
              padding: VANTA_SPACING['1'],
              borderRadius: VANTA_BORDERS.radius.sm,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: VANTA_ANIMATION.transition.colors,
            }}
            title={isHovered || isExpanded ? 'Hide actions' : 'Show actions'}
          >
            <Icon
              icon={isHovered || isExpanded ? ChevronUp : ChevronDown}
              size={12}
              color="muted"
            />
          </button>

          {/* Direction icon */}
          <span
            style={{
              ...VANTA_TYPOGRAPHY.preset.value,
              color: colors.muted,
              opacity: 0.7,
            }}
            title={`Direction: ${port.direction}`}
          >
            {port.direction === 'in' ? '→' : port.direction === 'out' ? '←' : '↔'}
          </span>

          {/* Port label */}
          <span style={{
            ...VANTA_TYPOGRAPHY.preset.cardTitle,
            color: colors.accent,
          }}>
            {port.label ?? port.direction.toUpperCase()}
          </span>

          {/* Data type indicator */}
          <span
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
              opacity: 0.6,
            }}
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
          <div style={{
            ...VANTA_TYPOGRAPHY.preset.micro,
            textAlign: 'center',
            color: VANTA_COLORS.text.muted,
            padding: `0 ${VANTA_SPACING['2']} ${VANTA_SPACING['1']}`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {blockLabel}
          </div>
        )}

        {/* Actions (visible when actions toggled via click) */}
        <PortActions className="justify-center gap-1 py-1">
          <PortAction
            icon={<Icon icon={Maximize2} size={14} color="violet" />}
            onClick={handleExpand}
            label="Expand details"
          />
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
      </div>

      {/* Target handle (for incoming connections) - VANTA pattern */}
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          id={`${port.id}-target`}
          style={{
            width: '10px',
            height: '10px',
            background: VANTA_COLORS.surface.void,
            border: `2px solid ${colors.accent}`,
            boxShadow: showGlow ? `0 0 8px ${colors.glow}` : 'none',
          }}
        />
      )}

      {/* Source handle (for outgoing connections) - VANTA pattern */}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
          id={`${port.id}-source`}
          style={{
            width: '10px',
            height: '10px',
            background: VANTA_COLORS.surface.void,
            border: `2px solid ${colors.accent}`,
            boxShadow: showGlow ? `0 0 8px ${colors.glow}` : 'none',
          }}
        />
      )}

      {/* VANTA pulsing animation keyframes */}
      <style>{`
        @keyframes vanta-port-pulse {
          0%, 100% {
            box-shadow: ${VANTA_BORDERS.shadow.card}, ${colors.glowShadow};
          }
          50% {
            box-shadow: ${VANTA_BORDERS.shadow.elevated}, 0 0 30px ${colors.glow};
          }
        }
      `}</style>
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
