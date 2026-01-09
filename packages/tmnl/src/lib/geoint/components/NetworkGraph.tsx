/**
 * Network Graph Component
 *
 * Entity relationship visualization using @xyflow/react.
 * Features:
 * - Force-directed and hierarchical layouts
 * - Cluster detection and navigation
 * - Edge type filtering
 * - Path finding visualization
 * - Animated transitions
 *
 * @example
 * ```tsx
 * <NetworkGraph.Root
 *   nodes={nodes}
 *   edges={edges}
 *   onNodeSelect={handleNodeSelect}
 * >
 *   <NetworkGraph.Canvas />
 *   <NetworkGraph.Controls />
 *   <NetworkGraph.Minimap />
 *   <NetworkGraph.EdgeLegend />
 * </NetworkGraph.Root>
 * ```
 *
 * @module geoint/components/NetworkGraph
 */

import {
  FC,
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
  memo,
} from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeProps,
  EdgeProps,
  MarkerType,
  ConnectionMode,
  Handle,
  Position,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMachine } from '@xstate/react'
import { cn } from '@/lib/utils'
import {
  networkGraphMachine,
  LAYOUT_ALGORITHMS,
  EDGE_TYPES,
  EDGE_TYPE_COLORS,
  NODE_TYPE_COLORS,
  type GraphNode,
  type GraphEdge,
  type LayoutAlgorithm,
  type EdgeType,
  type NodeType,
} from '../machines'

// =============================================================================
// CONTEXT
// =============================================================================

interface NetworkGraphContextValue {
  /** XState actor state */
  state: ReturnType<typeof networkGraphMachine.getInitialSnapshot>
  /** Send event to machine */
  send: (event: Parameters<ReturnType<typeof useMachine<typeof networkGraphMachine>>[1]>[0]) => void
  /** Nodes in graph format */
  graphNodes: GraphNode[]
  /** Edges in graph format */
  graphEdges: GraphEdge[]
  /** Current layout algorithm */
  layout: LayoutAlgorithm
  /** Selected node IDs */
  selectedNodeIds: Set<string>
  /** Hovered node ID */
  hoveredNodeId: string | null
  /** Visible edge types */
  visibleEdgeTypes: Set<EdgeType>
  /** Is physics enabled */
  physicsEnabled: boolean
  /** Show labels */
  showLabels: boolean
  /** Show edge labels */
  showEdgeLabels: boolean
  /** Search query */
  searchQuery: string
  /** Highlight path */
  highlightPath: string[] | null
}

const NetworkGraphContext = createContext<NetworkGraphContextValue | null>(null)

export function useNetworkGraph() {
  const ctx = useContext(NetworkGraphContext)
  if (!ctx) throw new Error('useNetworkGraph must be used within NetworkGraph.Root')
  return ctx
}

// =============================================================================
// CUSTOM NODE COMPONENT
// =============================================================================

interface EntityNodeData extends Record<string, unknown> {
  label: string
  type: NodeType
  entityId?: string
  size?: number
  color?: string
  isSelected?: boolean
  isHovered?: boolean
  isInPath?: boolean
  showLabel?: boolean
}

const EntityNode: FC<NodeProps<Node<EntityNodeData>>> = memo(({ data }) => {
  const color = data.color ?? NODE_TYPE_COLORS[data.type]
  const size = data.size ?? 40
  const isHighlighted = data.isSelected || data.isHovered || data.isInPath

  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-full transition-all duration-200',
        isHighlighted && 'ring-2 ring-accent-primary ring-offset-2 ring-offset-surface-0'
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        boxShadow: isHighlighted
          ? `0 0 20px ${color}80`
          : `0 4px 12px rgba(0,0,0,0.3)`,
      }}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />

      {/* Node icon based on type */}
      <div className="text-white text-xs font-bold">
        {data.type === 'entity' && '●'}
        {data.type === 'cluster' && '◆'}
        {data.type === 'gateway' && '◉'}
        {data.type === 'unknown' && '?'}
      </div>

      {/* Label */}
      {data.showLabel && data.label && (
        <div
          className="absolute top-full mt-1 px-2 py-0.5 bg-surface-2/90 backdrop-blur-sm rounded text-xs text-text-primary whitespace-nowrap"
          style={{ left: '50%', transform: 'translateX(-50%)' }}
        >
          {data.label}
        </div>
      )}
    </div>
  )
})
EntityNode.displayName = 'EntityNode'

// =============================================================================
// CUSTOM EDGE COMPONENT
// =============================================================================

const CustomEdge: FC<EdgeProps> = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  style,
  markerEnd,
}) => {
  const edgeType = (data?.['type'] as EdgeType) ?? 'association'
  const color = EDGE_TYPE_COLORS[edgeType]
  const isHighlighted = data?.['isSelected'] || data?.['isHovered'] || data?.['isInPath']
  const weight = (data?.['weight'] as number) ?? 1

  // Simple straight line for now - can enhance with bezier curves
  const pathD = `M${sourceX},${sourceY} L${targetX},${targetY}`

  return (
    <g className="react-flow__edge">
      <path
        id={id}
        className="react-flow__edge-path"
        d={pathD}
        stroke={color}
        strokeWidth={isHighlighted ? 3 : Math.max(1, weight)}
        strokeOpacity={isHighlighted ? 1 : 0.6}
        fill="none"
        markerEnd={markerEnd}
        style={{
          ...style,
          filter: isHighlighted ? `drop-shadow(0 0 4px ${color})` : undefined,
        }}
      />
      {data?.['showLabel'] && data?.['label'] && (
        <text
          x={(sourceX + targetX) / 2}
          y={(sourceY + targetY) / 2}
          className="fill-text-secondary text-xs"
          textAnchor="middle"
          dy={-8}
        >
          {String(data['label'])}
        </text>
      )}
    </g>
  )
})
CustomEdge.displayName = 'CustomEdge'

// =============================================================================
// NODE TYPES
// =============================================================================

const nodeTypes = {
  entity: EntityNode,
  cluster: EntityNode,
  gateway: EntityNode,
  unknown: EntityNode,
}

const edgeTypes = {
  custom: CustomEdge,
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

export interface NetworkGraphRootProps {
  children: ReactNode
  /** Initial nodes */
  nodes?: GraphNode[]
  /** Initial edges */
  edges?: GraphEdge[]
  /** Called when nodes are selected */
  onNodeSelect?: (nodeIds: string[]) => void
  /** Called when node is double-clicked */
  onNodeDoubleClick?: (nodeId: string) => void
  /** Called when edge is selected */
  onEdgeSelect?: (edgeId: string | null) => void
  /** Initial layout algorithm */
  layout?: LayoutAlgorithm
  /** Additional class names */
  className?: string
}

const NetworkGraphRoot: FC<NetworkGraphRootProps> = ({
  children,
  nodes = [],
  edges = [],
  onNodeSelect,
  onNodeDoubleClick,
  onEdgeSelect,
  layout = 'force',
  className,
}) => {
  const [state, send] = useMachine(networkGraphMachine, {
    input: {
      initialLayout: layout,
      initialNodes: nodes,
      initialEdges: edges,
    },
  })

  // Sync nodes and edges with machine
  useEffect(() => {
    send({ type: 'SET_NODES', nodes })
  }, [nodes, send])

  useEffect(() => {
    send({ type: 'SET_EDGES', edges })
  }, [edges, send])

  // Emit callbacks
  useEffect(() => {
    onNodeSelect?.([...state.context.selectedNodeIds])
  }, [state.context.selectedNodeIds, onNodeSelect])

  useEffect(() => {
    const edgeId = state.context.selectedEdgeIds.size > 0
      ? [...state.context.selectedEdgeIds][0]
      : null
    onEdgeSelect?.(edgeId)
  }, [state.context.selectedEdgeIds, onEdgeSelect])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case '1':
          e.preventDefault()
          send({ type: 'SET_LAYOUT', layout: 'force' })
          break
        case '2':
          e.preventDefault()
          send({ type: 'SET_LAYOUT', layout: 'hierarchical' })
          break
        case '3':
          e.preventDefault()
          send({ type: 'SET_LAYOUT', layout: 'radial' })
          break
        case '4':
          e.preventDefault()
          send({ type: 'SET_LAYOUT', layout: 'grid' })
          break
        case '5':
          e.preventDefault()
          send({ type: 'SET_LAYOUT', layout: 'circular' })
          break
        case 'f':
          e.preventDefault()
          send({ type: 'FIT_VIEW' })
          break
        case 'l':
          e.preventDefault()
          send({ type: 'TOGGLE_LABELS' })
          break
        case 'p':
          e.preventDefault()
          send({ type: 'TOGGLE_PHYSICS' })
          break
        case 'm':
          e.preventDefault()
          send({ type: 'TOGGLE_MINIMAP' })
          break
        case '+':
        case '=':
          e.preventDefault()
          send({ type: 'ZOOM_IN' })
          break
        case '-':
          e.preventDefault()
          send({ type: 'ZOOM_OUT' })
          break
        case 'Escape':
          e.preventDefault()
          send({ type: 'DESELECT_ALL_NODES' })
          send({ type: 'DESELECT_EDGE' })
          send({ type: 'CLEAR_PATH' })
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [send])

  // Context value
  const contextValue = useMemo<NetworkGraphContextValue>(
    () => ({
      state,
      send,
      graphNodes: state.context.nodes,
      graphEdges: state.context.edges,
      layout: state.context.layout,
      selectedNodeIds: state.context.selectedNodeIds,
      hoveredNodeId: state.context.hoveredNodeId,
      visibleEdgeTypes: state.context.visibleEdgeTypes,
      physicsEnabled: state.context.physicsEnabled,
      showLabels: state.context.showLabels,
      showEdgeLabels: state.context.showEdgeLabels,
      searchQuery: state.context.searchQuery,
      highlightPath: state.context.highlightPath,
    }),
    [state, send]
  )

  return (
    <NetworkGraphContext.Provider value={contextValue}>
      <div
        className={cn(
          'relative w-full h-full bg-surface-0 rounded-xl border border-border-subtle overflow-hidden',
          className
        )}
      >
        {children}
      </div>
    </NetworkGraphContext.Provider>
  )
}

// =============================================================================
// CANVAS COMPONENT
// =============================================================================

export interface CanvasProps {
  className?: string
}

const Canvas: FC<CanvasProps> = ({ className }) => {
  const {
    graphNodes,
    graphEdges,
    selectedNodeIds,
    hoveredNodeId,
    visibleEdgeTypes,
    showLabels,
    showEdgeLabels,
    highlightPath,
    send,
    state,
  } = useNetworkGraph()

  // Convert to ReactFlow format
  const rfNodes = useMemo<Node[]>(() => {
    return graphNodes.map((node, index) => ({
      id: node.id,
      type: node.type,
      position: node.position ?? {
        // Default grid layout if no position
        x: (index % 10) * 100 + 50,
        y: Math.floor(index / 10) * 100 + 50,
      },
      data: {
        label: node.label,
        type: node.type,
        entityId: node.entityId,
        size: node.size,
        color: node.color,
        isSelected: selectedNodeIds.has(node.id),
        isHovered: hoveredNodeId === node.id,
        isInPath: highlightPath?.includes(node.id) ?? false,
        showLabel: showLabels,
      },
    }))
  }, [graphNodes, selectedNodeIds, hoveredNodeId, highlightPath, showLabels])

  const rfEdges = useMemo<Edge[]>(() => {
    const pathSet = new Set(highlightPath ?? [])

    return graphEdges
      .filter((edge) => visibleEdgeTypes.has(edge.type))
      .filter((edge) => (edge.weight ?? 1) >= state.context.minEdgeWeight)
      .map((edge) => {
        const isInPath =
          pathSet.has(edge.source) && pathSet.has(edge.target)

        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'custom',
          data: {
            type: edge.type,
            weight: edge.weight,
            label: edge.label,
            isSelected: state.context.selectedEdgeIds.has(edge.id),
            isHovered: state.context.hoveredEdgeId === edge.id,
            isInPath,
            showLabel: showEdgeLabels,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: EDGE_TYPE_COLORS[edge.type],
          },
        }
      })
  }, [
    graphEdges,
    visibleEdgeTypes,
    state.context.minEdgeWeight,
    state.context.selectedEdgeIds,
    state.context.hoveredEdgeId,
    highlightPath,
    showEdgeLabels,
  ])

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges)

  // Sync nodes and edges when they change
  useEffect(() => {
    setNodes(rfNodes)
  }, [rfNodes, setNodes])

  useEffect(() => {
    setEdges(rfEdges)
  }, [rfEdges, setEdges])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      send({ type: 'SELECT_NODE', nodeId: node.id })
    },
    [send]
  )

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Could emit to parent or focus on node
      send({ type: 'FOCUS_NODE', nodeId: node.id })
    },
    [send]
  )

  const handleNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => {
      send({ type: 'HOVER_NODE', nodeId: node.id })
    },
    [send]
  )

  const handleNodeMouseLeave = useCallback(
    () => {
      send({ type: 'UNHOVER_NODE' })
    },
    [send]
  )

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      send({ type: 'SELECT_EDGE', edgeId: edge.id })
    },
    [send]
  )

  const handlePaneClick = useCallback(() => {
    send({ type: 'DESELECT_ALL_NODES' })
    send({ type: 'DESELECT_EDGE' })
  }, [send])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onNodeDoubleClick={handleNodeDoubleClick}
      onNodeMouseEnter={handleNodeMouseEnter}
      onNodeMouseLeave={handleNodeMouseLeave}
      onEdgeClick={handleEdgeClick}
      onPaneClick={handlePaneClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      connectionMode={ConnectionMode.Loose}
      fitView
      className={cn('bg-transparent', className)}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="rgba(255,255,255,0.1)"
      />
    </ReactFlow>
  )
}

// =============================================================================
// CONTROLS COMPONENT
// =============================================================================

export interface ControlsProps {
  className?: string
}

const GraphControls: FC<ControlsProps> = ({ className }) => {
  const { send, layout, physicsEnabled, showLabels, state } = useNetworkGraph()

  return (
    <div
      className={cn(
        'absolute top-4 left-4 flex flex-col gap-2 z-10',
        className
      )}
    >
      {/* Layout selector */}
      <div className="bg-surface-1/90 backdrop-blur-sm rounded-lg border border-border-subtle p-2">
        <p className="text-xs text-text-tertiary mb-2">Layout</p>
        <div className="flex flex-wrap gap-1">
          {LAYOUT_ALGORITHMS.map((algo) => (
            <button
              key={algo}
              onClick={() => send({ type: 'SET_LAYOUT', layout: algo })}
              className={cn(
                'px-2 py-1 text-xs rounded transition-colors capitalize',
                layout === algo
                  ? 'bg-accent-primary text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/10'
              )}
            >
              {algo}
            </button>
          ))}
        </div>
      </div>

      {/* Display options */}
      <div className="bg-surface-1/90 backdrop-blur-sm rounded-lg border border-border-subtle p-2">
        <p className="text-xs text-text-tertiary mb-2">Display</p>
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={() => send({ type: 'TOGGLE_LABELS' })}
              className="rounded"
            />
            Labels (L)
          </label>
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={state.context.showEdgeLabels}
              onChange={() => send({ type: 'TOGGLE_EDGE_LABELS' })}
              className="rounded"
            />
            Edge Labels
          </label>
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={physicsEnabled}
              onChange={() => send({ type: 'TOGGLE_PHYSICS' })}
              className="rounded"
            />
            Physics (P)
          </label>
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={state.context.minimapVisible}
              onChange={() => send({ type: 'TOGGLE_MINIMAP' })}
              className="rounded"
            />
            Minimap (M)
          </label>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="bg-surface-1/90 backdrop-blur-sm rounded-lg border border-border-subtle p-2">
        <div className="flex gap-1">
          <button
            onClick={() => send({ type: 'ZOOM_OUT' })}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-white/10 rounded transition-colors"
            title="Zoom out (-)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={() => send({ type: 'ZOOM_IN' })}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-white/10 rounded transition-colors"
            title="Zoom in (+)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={() => send({ type: 'FIT_VIEW' })}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-white/10 rounded transition-colors"
            title="Fit view (F)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// EDGE LEGEND COMPONENT
// =============================================================================

export interface EdgeLegendProps {
  className?: string
}

const EdgeLegend: FC<EdgeLegendProps> = ({ className }) => {
  const { visibleEdgeTypes, send } = useNetworkGraph()

  return (
    <div
      className={cn(
        'absolute bottom-4 left-4 bg-surface-1/90 backdrop-blur-sm rounded-lg border border-border-subtle p-2 z-10',
        className
      )}
    >
      <p className="text-xs text-text-tertiary mb-2">Edge Types</p>
      <div className="flex flex-col gap-1">
        {EDGE_TYPES.map((type) => (
          <label
            key={type}
            className="flex items-center gap-2 text-xs cursor-pointer"
          >
            <input
              type="checkbox"
              checked={visibleEdgeTypes.has(type)}
              onChange={() => send({ type: 'TOGGLE_EDGE_TYPE', edgeType: type })}
              className="rounded"
            />
            <span
              className="w-3 h-1 rounded"
              style={{ backgroundColor: EDGE_TYPE_COLORS[type] }}
            />
            <span className="text-text-secondary capitalize">{type}</span>
          </label>
        ))}
      </div>
      <button
        onClick={() => send({ type: 'SHOW_ALL_EDGE_TYPES' })}
        className="mt-2 text-xs text-accent-primary hover:underline"
      >
        Show All
      </button>
    </div>
  )
}

// =============================================================================
// MINIMAP COMPONENT
// =============================================================================

export interface MinimapProps {
  className?: string
}

const GraphMinimap: FC<MinimapProps> = ({ className }) => {
  const { state } = useNetworkGraph()

  if (!state.context.minimapVisible) return null

  return (
    <MiniMap
      className={cn('!bg-surface-1/80 !border-border-subtle', className)}
      nodeColor={(node) => {
        const data = node.data as EntityNodeData
        return data.color ?? NODE_TYPE_COLORS[data.type] ?? '#6b7280'
      }}
      maskColor="rgba(0, 0, 0, 0.5)"
      style={{
        width: 150,
        height: 100,
      }}
    />
  )
}

// =============================================================================
// SEARCH INPUT COMPONENT
// =============================================================================

export interface SearchInputProps {
  className?: string
}

const SearchInput: FC<SearchInputProps> = ({ className }) => {
  const { searchQuery, send } = useNetworkGraph()

  return (
    <div
      className={cn(
        'absolute top-4 right-4 z-10',
        className
      )}
    >
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => send({ type: 'SET_SEARCH_QUERY', query: e.target.value })}
        placeholder="Search nodes..."
        className="w-48 px-3 py-1.5 text-sm bg-surface-1/90 backdrop-blur-sm border border-border-subtle rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-primary"
      />
    </div>
  )
}

// =============================================================================
// SELECTION INFO COMPONENT
// =============================================================================

export interface SelectionInfoProps {
  className?: string
}

const SelectionInfo: FC<SelectionInfoProps> = ({ className }) => {
  const { selectedNodeIds, graphNodes, graphEdges, send } = useNetworkGraph()

  if (selectedNodeIds.size === 0) return null

  const selectedNodes = graphNodes.filter((n) => selectedNodeIds.has(n.id))
  const connectedEdges = graphEdges.filter(
    (e) => selectedNodeIds.has(e.source) || selectedNodeIds.has(e.target)
  )

  return (
    <div
      className={cn(
        'absolute bottom-4 right-4 bg-surface-1/90 backdrop-blur-sm rounded-lg border border-border-subtle p-3 z-10 min-w-[200px]',
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-text-primary">
          {selectedNodeIds.size} Selected
        </h4>
        <button
          onClick={() => send({ type: 'DESELECT_ALL_NODES' })}
          className="text-xs text-text-tertiary hover:text-text-primary"
        >
          Clear
        </button>
      </div>

      <div className="space-y-1">
        {selectedNodes.slice(0, 5).map((node) => (
          <div
            key={node.id}
            className="flex items-center gap-2 text-xs text-text-secondary"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: node.color ?? NODE_TYPE_COLORS[node.type] }}
            />
            <span className="truncate">{node.label}</span>
          </div>
        ))}
        {selectedNodes.length > 5 && (
          <p className="text-xs text-text-tertiary">
            +{selectedNodes.length - 5} more
          </p>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-border-subtle text-xs text-text-tertiary">
        {connectedEdges.length} connected edges
      </div>
    </div>
  )
}

// =============================================================================
// STATS OVERLAY COMPONENT
// =============================================================================

export interface StatsOverlayProps {
  className?: string
}

const StatsOverlay: FC<StatsOverlayProps> = ({ className }) => {
  const { graphNodes, graphEdges, state } = useNetworkGraph()

  return (
    <div
      className={cn(
        'absolute top-4 left-1/2 -translate-x-1/2 bg-surface-1/90 backdrop-blur-sm rounded-lg border border-border-subtle px-4 py-2 z-10 flex gap-6',
        className
      )}
    >
      <div className="text-center">
        <p className="text-lg font-bold text-text-primary">{graphNodes.length}</p>
        <p className="text-xs text-text-tertiary">Nodes</p>
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-text-primary">{graphEdges.length}</p>
        <p className="text-xs text-text-tertiary">Edges</p>
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-text-primary">{state.context.clusters.length}</p>
        <p className="text-xs text-text-tertiary">Clusters</p>
      </div>
    </div>
  )
}

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const NetworkGraph = Object.assign(NetworkGraphRoot, {
  Root: NetworkGraphRoot,
  Canvas,
  Controls: GraphControls,
  Minimap: GraphMinimap,
  EdgeLegend,
  SearchInput,
  SelectionInfo,
  StatsOverlay,
})

// Note: useNetworkGraph is already exported via function declaration above
