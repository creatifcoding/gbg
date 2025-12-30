/**
 * @fileoverview DataplaneVisualizer Component
 *
 * React Flow-based visualization for the dataplane linking system.
 * Supports inline and fullscreen modes, document and block scopes.
 *
 * @module dataplane/components/DataplaneVisualizer
 */

import React, { memo, useMemo, useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  BackgroundVariant,
} from '@xyflow/react';
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { Maximize2, Minimize2, X, Link2, Unlink } from 'lucide-react';
import { nanoid } from 'nanoid';

import '@xyflow/react/dist/style.css';

import { portsAtom, linksAtom, dataplaneOps } from '../atoms';
import type {
  PortId,
  BlockId,
  LinkPort,
  Link,
  PortPosition,
  CreateLinkConfig,
} from '../schemas/link';
import { LinkPortNode, type LinkPortNodeData } from './LinkPortNode';
import { BidirectionalEdge, type BidirectionalEdgeData } from './BidirectionalEdge';

// =============================================================================
// Types
// =============================================================================

export type VisualizerMode = 'inline' | 'fullscreen';
export type VisualizerScope = 'document' | 'block';

export interface DataplaneVisualizerProps {
  /** Visualization scope */
  scope: VisualizerScope;
  /** Block ID for block-scoped view */
  blockId?: BlockId;
  /** Display mode */
  mode?: VisualizerMode;
  /** Callback when mode changes */
  onModeChange?: (mode: VisualizerMode) => void;
  /** Custom className */
  className?: string;
  /** Height for inline mode */
  inlineHeight?: number | string;
}

// =============================================================================
// Constants
// =============================================================================

const nodeTypes: NodeTypes = {
  linkPort: LinkPortNode,
};

const edgeTypes: EdgeTypes = {
  bidirectional: BidirectionalEdge,
  default: BidirectionalEdge,
};

const POSITION_OFFSETS: Record<PortPosition, { x: number; y: number }> = {
  left: { x: 0, y: 100 },
  right: { x: 200, y: 100 },
  top: { x: 100, y: 0 },
  bottom: { x: 100, y: 200 },
};

// =============================================================================
// Helpers
// =============================================================================

/** Calculate node position based on port and block */
function getNodePosition(
  port: LinkPort,
  index: number,
  blockPositions: Map<BlockId, { x: number; y: number }>
): { x: number; y: number } {
  // Get or create block position
  let blockPos = blockPositions.get(port.blockId);
  if (!blockPos) {
    const blockIndex = blockPositions.size;
    blockPos = {
      x: (blockIndex % 3) * 300 + 50,
      y: Math.floor(blockIndex / 3) * 250 + 50,
    };
    blockPositions.set(port.blockId, blockPos);
  }

  // Offset based on port position
  const offset = POSITION_OFFSETS[port.position];

  return {
    x: blockPos.x + offset.x,
    y: blockPos.y + offset.y + (index * 10), // Slight offset for multiple ports
  };
}

/** Check if a block is a child of another block */
function isChildBlock(childId: BlockId, parentId: BlockId): boolean {
  // For now, simple prefix check - could be enhanced with actual hierarchy
  return childId.startsWith(`${parentId}:`);
}

// =============================================================================
// Component
// =============================================================================

/**
 * React Flow visualization for dataplane links and ports.
 *
 * Features:
 * - Document-level or block-scoped views
 * - Inline or fullscreen modes
 * - Drag-to-connect link creation
 * - Custom node/edge types
 * - MiniMap for navigation
 */
export const DataplaneVisualizer = memo(function DataplaneVisualizer({
  scope,
  blockId,
  mode = 'inline',
  onModeChange,
  className,
  inlineHeight = 300,
}: DataplaneVisualizerProps): React.ReactElement {
  const allPorts = useAtomValue(portsAtom);
  const allLinks = useAtomValue(linksAtom);

  // Filter based on scope
  const { ports, links } = useMemo(() => {
    if (scope === 'document') {
      return { links: allLinks, ports: allPorts };
    }

    if (!blockId) {
      return { links: [], ports: [] };
    }

    // Block-scoped: show only links connected to this block + its children
    const relevantPorts = allPorts.filter(
      (p) => p.blockId === blockId || isChildBlock(p.blockId, blockId)
    );
    const portIds = new Set(relevantPorts.map((p) => p.id));
    const relevantLinks = allLinks.filter(
      (l) => portIds.has(l.sourcePort) || portIds.has(l.targetPort)
    );

    return { links: relevantLinks, ports: relevantPorts };
  }, [scope, blockId, allLinks, allPorts]);

  // Convert ports to React Flow nodes
  const initialNodes = useMemo(() => {
    const blockPositions = new Map<BlockId, { x: number; y: number }>();

    return ports.map((port, index): Node<LinkPortNodeData> => ({
      id: port.id as string,
      type: 'linkPort',
      position: getNodePosition(port, index, blockPositions),
      data: {
        port,
        blockLabel: port.blockId.slice(0, 8),
      },
      parentId: port.parentBlockId as string | undefined,
      extent: port.parentBlockId ? 'parent' : undefined,
    }));
  }, [ports]);

  // Convert links to React Flow edges
  const initialEdges = useMemo(() => {
    return links.map((link): Edge<BidirectionalEdgeData> => ({
      id: link.id as string,
      source: link.sourcePort as string,
      target: link.targetPort as string,
      sourceHandle: `${link.sourcePort}-source`,
      targetHandle: `${link.targetPort}-target`,
      type: link.direction === 'bidirectional' ? 'bidirectional' : 'default',
      animated: true,
      data: { link },
    }));
  }, [links]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync with atom changes
  React.useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  React.useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Link creation via drag-connect
  const createLink = useAtomSet(dataplaneOps.createLink, { mode: 'promise' });

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const config: CreateLinkConfig = {
        sourcePort: connection.source as PortId,
        targetPort: connection.target as PortId,
        direction: 'unidirectional',
        relationship: 'pipe',
      };

      try {
        await createLink(config);
        // Edges will update via atom subscription
      } catch (err) {
        console.error('[DataplaneVisualizer] Failed to create link:', err);
      }
    },
    [createLink]
  );

  // Mode toggle
  const handleModeToggle = useCallback(() => {
    onModeChange?.(mode === 'inline' ? 'fullscreen' : 'inline');
  }, [mode, onModeChange]);

  // Container styles based on mode
  const containerStyles: React.CSSProperties = mode === 'fullscreen'
    ? {
        position: 'fixed',
        inset: '16px',
        zIndex: 50,
        backgroundColor: 'rgba(10, 10, 15, 0.98)',
        borderRadius: '12px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      }
    : {
        width: '100%',
        height: typeof inlineHeight === 'number' ? `${inlineHeight}px` : inlineHeight,
        backgroundColor: 'rgba(10, 10, 15, 0.6)',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      };

  // Empty state
  if (ports.length === 0) {
    return (
      <div
        className={className}
        style={{
          ...containerStyles,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <Unlink size={32} className="text-gray-500" />
        <span className="text-gray-400 text-sm">No ports registered</span>
        <span className="text-gray-500 text-xs">
          Ports appear when blocks with dataplane integration mount
        </span>
      </div>
    );
  }

  return (
    <div className={className} style={containerStyles}>
      {/* Header with mode toggle */}
      <div
        className="
          absolute top-2 right-2 z-10
          flex items-center gap-2
        "
      >
        {/* Stats badge */}
        <div
          className="
            flex items-center gap-2
            px-2 py-1 rounded
            bg-black/50 text-gray-400
            text-xs font-mono
          "
        >
          <Link2 size={12} />
          <span>{ports.length} ports</span>
          <span>·</span>
          <span>{links.length} links</span>
        </div>

        {/* Mode toggle */}
        <button
          onClick={handleModeToggle}
          className="
            p-1.5 rounded
            bg-black/50 text-gray-400
            hover:bg-black/70 hover:text-white
            transition-colors
          "
          title={mode === 'inline' ? 'Expand to fullscreen' : 'Collapse to inline'}
        >
          {mode === 'inline' ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
        </button>

        {/* Close button (fullscreen only) */}
        {mode === 'fullscreen' && (
          <button
            onClick={() => onModeChange?.('inline')}
            className="
              p-1.5 rounded
              bg-black/50 text-gray-400
              hover:bg-red-900/50 hover:text-red-400
              transition-colors
            "
            title="Close"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* React Flow canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="rgba(255, 255, 255, 0.05)"
        />
        <Controls
          showZoom={true}
          showFitView={true}
          showInteractive={false}
          className="!bg-black/50 !border-white/10"
        />
        {mode === 'fullscreen' && (
          <MiniMap
            nodeColor={(node) => {
              const data = node.data as LinkPortNodeData | undefined;
              const direction = data?.port?.direction ?? 'inout';
              switch (direction) {
                case 'in':
                  return 'rgba(34, 211, 238, 0.8)';
                case 'out':
                  return 'rgba(251, 191, 36, 0.8)';
                default:
                  return 'rgba(167, 139, 250, 0.8)';
              }
            }}
            maskColor="rgba(0, 0, 0, 0.7)"
            className="!bg-black/50 !border-white/10"
          />
        )}
      </ReactFlow>
    </div>
  );
});

// =============================================================================
// Exports
// =============================================================================

export default DataplaneVisualizer;
