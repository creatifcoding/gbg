/**
 * CorrelationView - Entity Relationship Visualization
 *
 * Displays entity relationships as an interactive network graph:
 * - Central focus entity with connected entities
 * - Relationship type indicators (parent, child, linked, proximity)
 * - Confidence scores on edges
 * - Click to navigate between entities
 * - Zoom and pan controls
 *
 * Uses a radial force-directed layout for clarity.
 *
 * Compound component architecture:
 * - CorrelationView.Root - Main container with graph state
 * - CorrelationView.Graph - SVG graph visualization
 * - CorrelationView.Legend - Relationship type legend
 * - CorrelationView.Controls - Zoom/pan controls
 * - CorrelationView.EntityTooltip - Hover information
 * - CorrelationView.DetailPanel - Selected entity details
 *
 * @module geoint/components/CorrelationView
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  memo,
  type FC,
  type ReactNode,
} from 'react'
import { animate } from 'animejs'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  ChevronRight,
  GitBranch,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING, SOURCE_COLORS, CLASSIFICATION_COLORS } from '../tokens'
import type { IntelSource, Classification } from '../schemas'

// =============================================================================
// TYPES
// =============================================================================

export type RelationType = 'parent' | 'child' | 'sibling' | 'linked' | 'proximity' | 'derived'

export interface CorrelationNode {
  /** Unique identifier */
  id: string
  /** Display label */
  label: string
  /** Intel source */
  source?: IntelSource
  /** Classification */
  classification?: Classification
  /** Is the focus/center node */
  isFocus?: boolean
  /** Node size multiplier */
  size?: number
}

export interface CorrelationEdge {
  /** Source node ID */
  source: string
  /** Target node ID */
  target: string
  /** Relationship type */
  type: RelationType
  /** Confidence score (0-1) */
  confidence?: number
  /** Edge label */
  label?: string
}

export interface CorrelationViewContextValue {
  /** Graph nodes */
  nodes: readonly CorrelationNode[]
  /** Graph edges */
  edges: readonly CorrelationEdge[]
  /** Selected node ID */
  selectedNode: string | null
  /** Set selected node */
  setSelectedNode: (id: string | null) => void
  /** Hovered node ID */
  hoveredNode: string | null
  /** Set hovered node */
  setHoveredNode: (id: string | null) => void
  /** Zoom level */
  zoom: number
  /** Set zoom level */
  setZoom: (zoom: number) => void
  /** Visible relation types */
  visibleTypes: Set<RelationType>
  /** Toggle relation type visibility */
  toggleType: (type: RelationType) => void
  /** Compact mode */
  compact: boolean
  /** Navigate to entity handler */
  onNavigateToEntity?: (id: string) => void
}

export interface CorrelationViewRootProps {
  /** Focus entity ID */
  focusEntityId: string
  /** Graph nodes */
  nodes: readonly CorrelationNode[]
  /** Graph edges */
  edges: readonly CorrelationEdge[]
  /** Navigate to entity handler */
  onNavigateToEntity?: (id: string) => void
  /** Close handler */
  onClose?: () => void
  /** Compact mode */
  compact?: boolean
  /** Children */
  children: ReactNode
  /** Additional class */
  className?: string
}

// =============================================================================
// CONTEXT
// =============================================================================

const CorrelationViewContext = createContext<CorrelationViewContextValue | null>(null)

export const useCorrelationView = () => {
  const ctx = useContext(CorrelationViewContext)
  if (!ctx) throw new Error('useCorrelationView must be used within CorrelationView.Root')
  return ctx
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RELATION_COLORS: Record<RelationType, string> = {
  parent: '#3b82f6', // blue-500
  child: '#22c55e', // green-500
  sibling: '#06b6d4', // cyan-500
  linked: '#a855f7', // purple-500
  proximity: '#eab308', // yellow-500
  derived: '#6b7280', // gray-500
}

const RELATION_LABELS: Record<RelationType, string> = {
  parent: 'Parent',
  child: 'Child',
  sibling: 'Sibling',
  linked: 'Linked',
  proximity: 'Proximity',
  derived: 'Derived',
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

const Root: FC<CorrelationViewRootProps> = ({
  focusEntityId: _focusEntityId,
  nodes,
  edges,
  onNavigateToEntity,
  onClose,
  compact = false,
  children,
  className,
}) => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [visibleTypes, setVisibleTypes] = useState<Set<RelationType>>(
    new Set(['parent', 'child', 'sibling', 'linked', 'proximity', 'derived'])
  )
  const containerRef = useRef<HTMLDivElement>(null)

  // Enter animation
  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current, {
        opacity: [0, 1],
        scale: [0.95, 1],
        duration: TIMING.normal,
        ease: EASING.anime.out,
      })
    }
  }, [])

  const toggleType = useCallback((type: RelationType) => {
    setVisibleTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  const contextValue: CorrelationViewContextValue = {
    nodes,
    edges,
    selectedNode,
    setSelectedNode,
    hoveredNode,
    setHoveredNode,
    zoom,
    setZoom,
    visibleTypes,
    toggleType,
    compact,
    onNavigateToEntity,
  }

  return (
    <CorrelationViewContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={cn(
          'flex flex-col bg-surface-1 border border-border-subtle rounded-lg overflow-hidden',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-accent-primary" />
            <span className={cn(
              'font-medium text-text-primary',
              compact ? 'text-sm' : 'text-base'
            )}>
              Entity Relationships
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-surface-2 rounded transition-colors text-text-tertiary hover:text-text-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {children}
      </div>
    </CorrelationViewContext.Provider>
  )
}

// =============================================================================
// GRAPH COMPONENT
// =============================================================================

export interface GraphProps {
  /** Width in pixels */
  width?: number
  /** Height in pixels */
  height?: number
  /** Additional class */
  className?: string
}

const Graph: FC<GraphProps> = memo(function Graph({
  width = 600,
  height = 400,
  className,
}) {
  const { nodes, edges, selectedNode, setSelectedNode, hoveredNode, setHoveredNode, zoom, visibleTypes, onNavigateToEntity } = useCorrelationView()
  const svgRef = useRef<SVGSVGElement>(null)

  // Filter edges by visible types
  const filteredEdges = useMemo(
    () => edges.filter(e => visibleTypes.has(e.type)),
    [edges, visibleTypes]
  )

  // Simple radial layout calculation
  const layout = useMemo(() => {
    const focusNode = nodes.find(n => n.isFocus)
    const otherNodes = nodes.filter(n => !n.isFocus)
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) * 0.35

    const positions = new Map<string, { x: number; y: number }>()

    // Focus node at center
    if (focusNode) {
      positions.set(focusNode.id, { x: centerX, y: centerY })
    }

    // Other nodes in a circle around focus
    otherNodes.forEach((node, i) => {
      const angle = (i / otherNodes.length) * Math.PI * 2 - Math.PI / 2
      const x = centerX + Math.cos(angle) * radius
      const y = centerY + Math.sin(angle) * radius
      positions.set(node.id, { x, y })
    })

    return positions
  }, [nodes, width, height])

  // Animate on mount
  useEffect(() => {
    if (svgRef.current) {
      const nodeElements = svgRef.current.querySelectorAll('[data-node]')
      const edgeElements = svgRef.current.querySelectorAll('[data-edge]')

      animate(edgeElements, {
        opacity: [0, 1],
        strokeDashoffset: [100, 0],
        duration: TIMING.slow,
        ease: EASING.anime.out,
      })

      animate(nodeElements, {
        opacity: [0, 1],
        scale: [0, 1],
        delay: TIMING.fast,
        duration: TIMING.normal,
        ease: EASING.anime.bounce,
      })
    }
  }, [])

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(nodeId === selectedNode ? null : nodeId)
  }

  const handleNodeDoubleClick = (nodeId: string) => {
    onNavigateToEntity?.(nodeId)
  }

  return (
    <div
      className={cn('relative overflow-hidden bg-surface-2/30', className)}
      style={{ width, height }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        style={{ transform: `scale(${zoom})` }}
      >
        {/* Edges */}
        <g className="edges">
          {filteredEdges.map((edge, i) => {
            const sourcePos = layout.get(edge.source)
            const targetPos = layout.get(edge.target)
            if (!sourcePos || !targetPos) return null

            const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target

            return (
              <g key={`${edge.source}-${edge.target}-${i}`} data-edge>
                <line
                  x1={sourcePos.x}
                  y1={sourcePos.y}
                  x2={targetPos.x}
                  y2={targetPos.y}
                  stroke={RELATION_COLORS[edge.type]}
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeOpacity={isHighlighted ? 0.8 : 0.4}
                  strokeDasharray={edge.type === 'proximity' ? '4 2' : undefined}
                />
                {/* Confidence indicator */}
                {edge.confidence != null && (
                  <text
                    x={(sourcePos.x + targetPos.x) / 2}
                    y={(sourcePos.y + targetPos.y) / 2 - 8}
                    textAnchor="middle"
                    className="text-[9px] fill-text-tertiary font-mono"
                  >
                    {(edge.confidence * 100).toFixed(0)}%
                  </text>
                )}
              </g>
            )
          })}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {nodes.map(node => {
            const pos = layout.get(node.id)
            if (!pos) return null

            const isSelected = selectedNode === node.id
            const isHovered = hoveredNode === node.id
            const baseSize = node.isFocus ? 24 : 16
            const size = baseSize * (node.size ?? 1)

            const sourceColors = node.source ? SOURCE_COLORS[node.source] : null
            const classColors = node.classification ? CLASSIFICATION_COLORS[node.classification] : null
            const fillColor = sourceColors?.primary ?? '#6b7280'
            const borderColor = classColors?.primary ?? sourceColors?.primary ?? '#6b7280'

            return (
              <g
                key={node.id}
                data-node
                onClick={() => handleNodeClick(node.id)}
                onDoubleClick={() => handleNodeDoubleClick(node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
                style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
              >
                {/* Selection ring */}
                {isSelected && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={size + 4}
                    fill="none"
                    stroke={fillColor}
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    opacity={0.6}
                  />
                )}

                {/* Node circle */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={size / 2}
                  fill={fillColor}
                  stroke={borderColor}
                  strokeWidth={isHovered || isSelected ? 2 : 1}
                  opacity={isHovered || isSelected ? 1 : 0.8}
                />

                {/* Focus indicator */}
                {node.isFocus && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={size / 2 + 8}
                    fill="none"
                    stroke={fillColor}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    opacity={0.5}
                  />
                )}

                {/* Label */}
                <text
                  x={pos.x}
                  y={pos.y + size / 2 + 12}
                  textAnchor="middle"
                  className={cn(
                    'text-[10px] fill-text-secondary pointer-events-none',
                    (isHovered || isSelected) && 'fill-text-primary font-medium'
                  )}
                >
                  {node.label.length > 15 ? node.label.slice(0, 15) + '...' : node.label}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Hover tooltip */}
      {hoveredNode && (
        <NodeTooltip nodeId={hoveredNode} />
      )}
    </div>
  )
})

// =============================================================================
// NODE TOOLTIP COMPONENT
// =============================================================================

interface NodeTooltipProps {
  nodeId: string
}

const NodeTooltip: FC<NodeTooltipProps> = ({ nodeId }) => {
  const { nodes, edges } = useCorrelationView()
  const node = nodes.find(n => n.id === nodeId)
  if (!node) return null

  const connections = edges.filter(e => e.source === nodeId || e.target === nodeId)
  const sourceColors = node.source ? SOURCE_COLORS[node.source] : null

  return (
    <div className="absolute top-2 right-2 w-48 bg-surface-1/95 backdrop-blur-sm border border-border-subtle rounded-lg p-3 shadow-lg pointer-events-none">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: sourceColors?.primary ?? '#6b7280' }}
        />
        <span className="text-sm font-medium text-text-primary truncate">{node.label}</span>
      </div>
      {node.source && (
        <p className="text-xs text-text-tertiary">Source: {node.source}</p>
      )}
      {node.classification && (
        <p className="text-xs text-text-tertiary">Classification: {node.classification}</p>
      )}
      <p className="text-xs text-text-tertiary mt-1">
        {connections.length} connection{connections.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

// =============================================================================
// LEGEND COMPONENT
// =============================================================================

export interface LegendProps {
  /** Additional class */
  className?: string
}

const Legend: FC<LegendProps> = memo(function Legend({ className }) {
  const { visibleTypes, toggleType } = useCorrelationView()

  return (
    <div className={cn('flex flex-wrap gap-2 px-3 py-2 border-t border-border-subtle', className)}>
      {(Object.keys(RELATION_COLORS) as RelationType[]).map(type => {
        const isVisible = visibleTypes.has(type)

        return (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all',
              isVisible
                ? 'bg-surface-2'
                : 'bg-surface-2/50 opacity-50'
            )}
          >
            <div
              className="w-3 h-0.5 rounded"
              style={{
                backgroundColor: RELATION_COLORS[type],
                opacity: isVisible ? 1 : 0.5,
              }}
            />
            <span className={cn(
              'text-text-secondary',
              !isVisible && 'text-text-tertiary'
            )}>
              {RELATION_LABELS[type]}
            </span>
            {isVisible ? (
              <Eye className="w-3 h-3 text-text-tertiary" />
            ) : (
              <EyeOff className="w-3 h-3 text-text-tertiary" />
            )}
          </button>
        )
      })}
    </div>
  )
})

// =============================================================================
// CONTROLS COMPONENT
// =============================================================================

export interface ControlsProps {
  /** Additional class */
  className?: string
}

const Controls: FC<ControlsProps> = memo(function Controls({ className }) {
  const { zoom, setZoom } = useCorrelationView()

  const handleZoomIn = () => setZoom(Math.min(2, zoom + 0.2))
  const handleZoomOut = () => setZoom(Math.max(0.5, zoom - 0.2))
  const handleReset = () => setZoom(1)

  return (
    <div className={cn(
      'absolute bottom-3 right-3 flex items-center gap-1 bg-surface-1/90 backdrop-blur-sm rounded-md border border-border-subtle p-1',
      className
    )}>
      <button
        onClick={handleZoomOut}
        className="p-1 hover:bg-surface-2 rounded transition-colors"
        title="Zoom out"
      >
        <ZoomOut className="w-4 h-4 text-text-tertiary" />
      </button>
      <button
        onClick={handleReset}
        className="px-2 text-xs text-text-tertiary font-mono hover:bg-surface-2 rounded transition-colors"
        title="Reset zoom"
      >
        {(zoom * 100).toFixed(0)}%
      </button>
      <button
        onClick={handleZoomIn}
        className="p-1 hover:bg-surface-2 rounded transition-colors"
        title="Zoom in"
      >
        <ZoomIn className="w-4 h-4 text-text-tertiary" />
      </button>
      <button
        onClick={handleReset}
        className="p-1 hover:bg-surface-2 rounded transition-colors"
        title="Fit to view"
      >
        <Maximize2 className="w-4 h-4 text-text-tertiary" />
      </button>
    </div>
  )
})

// =============================================================================
// DETAIL PANEL COMPONENT
// =============================================================================

export interface DetailPanelProps {
  /** Additional class */
  className?: string
}

const DetailPanel: FC<DetailPanelProps> = memo(function DetailPanel({ className }) {
  const { nodes, edges, selectedNode, onNavigateToEntity } = useCorrelationView()

  if (!selectedNode) return null

  const node = nodes.find(n => n.id === selectedNode)
  if (!node) return null

  const connections = edges.filter(e => e.source === selectedNode || e.target === selectedNode)
  const sourceColors = node.source ? SOURCE_COLORS[node.source] : null
  const classColors = node.classification ? CLASSIFICATION_COLORS[node.classification] : null

  return (
    <div className={cn(
      'border-t border-border-subtle p-3 space-y-3',
      className
    )}>
      {/* Node info */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: sourceColors?.primary ?? '#6b7280' }}
          />
          <div>
            <h4 className="text-sm font-medium text-text-primary">{node.label}</h4>
            <p className="text-xs text-text-tertiary font-mono">{node.id}</p>
          </div>
        </div>
        {onNavigateToEntity && (
          <button
            onClick={() => onNavigateToEntity(node.id)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-accent-primary hover:bg-surface-2 rounded transition-colors"
          >
            View <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {sourceColors && (
          <span className={cn(
            'px-2 py-0.5 rounded text-[10px] font-mono uppercase',
            sourceColors.tailwind.bg,
            sourceColors.tailwind.primary
          )}>
            {node.source}
          </span>
        )}
        {classColors && (
          <span className={cn(
            'px-2 py-0.5 rounded text-[10px] font-medium uppercase',
            classColors.tailwind.bg,
            classColors.tailwind.text
          )}>
            {node.classification}
          </span>
        )}
      </div>

      {/* Connections */}
      <div className="space-y-1">
        <span className="text-xs text-text-tertiary uppercase font-mono">
          Connections ({connections.length})
        </span>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {connections.map((edge, i) => {
            const otherId = edge.source === selectedNode ? edge.target : edge.source
            const otherNode = nodes.find(n => n.id === otherId)
            const isOutgoing = edge.source === selectedNode

            return (
              <div
                key={i}
                className="flex items-center gap-2 text-xs text-text-secondary"
              >
                <div
                  className="w-2 h-0.5 rounded"
                  style={{ backgroundColor: RELATION_COLORS[edge.type] }}
                />
                <span className="text-text-tertiary">
                  {isOutgoing ? <ArrowRight className="w-3 h-3 inline" /> : <ArrowRight className="w-3 h-3 inline rotate-180" />}
                </span>
                <span className="truncate">{otherNode?.label ?? otherId}</span>
                <span className="text-text-tertiary">({RELATION_LABELS[edge.type]})</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const CorrelationView = Object.assign(Root, {
  Root,
  Graph,
  Legend,
  Controls,
  DetailPanel,
})

// Named exports
export {
  Root as CorrelationViewRoot,
  Graph as CorrelationViewGraph,
  Legend as CorrelationViewLegend,
  Controls as CorrelationViewControls,
  DetailPanel as CorrelationViewDetailPanel,
}

export default CorrelationView
