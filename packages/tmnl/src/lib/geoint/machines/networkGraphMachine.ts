/**
 * Network Graph XState Machine
 *
 * State machine for network graph visualization:
 * - Node selection and hover states
 * - Layout algorithms (force, hierarchical, radial)
 * - Zoom and pan controls
 * - Cluster detection and navigation
 * - Edge filtering and highlighting
 *
 * @module geoint/machines/networkGraphMachine
 */

import { setup, assign, emit } from 'xstate'

// =============================================================================
// TYPES
// =============================================================================

export type LayoutAlgorithm = 'force' | 'hierarchical' | 'radial' | 'grid' | 'circular'

export type NodeType = 'entity' | 'cluster' | 'gateway' | 'unknown'

export type EdgeType = 'association' | 'communication' | 'ownership' | 'temporal' | 'spatial'

export interface GraphNode {
  id: string
  label: string
  type: NodeType
  entityId?: string
  data?: Record<string, unknown>
  position?: { x: number; y: number }
  size?: number
  color?: string
  clusterId?: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: EdgeType
  weight?: number
  label?: string
  data?: Record<string, unknown>
}

export interface GraphCluster {
  id: string
  label: string
  nodeIds: string[]
  color: string
  expanded: boolean
}

export interface ViewportState {
  x: number
  y: number
  zoom: number
}

export interface NetworkGraphContext {
  /** All nodes */
  nodes: GraphNode[]
  /** All edges */
  edges: GraphEdge[]
  /** Detected clusters */
  clusters: GraphCluster[]
  /** Current layout algorithm */
  layout: LayoutAlgorithm
  /** Selected node IDs */
  selectedNodeIds: Set<string>
  /** Hovered node ID */
  hoveredNodeId: string | null
  /** Selected edge IDs */
  selectedEdgeIds: Set<string>
  /** Hovered edge ID */
  hoveredEdgeId: string | null
  /** Visible edge types */
  visibleEdgeTypes: Set<EdgeType>
  /** Current viewport state */
  viewport: ViewportState
  /** Is layout calculation in progress */
  isLayouting: boolean
  /** Animation phase */
  animationPhase: 'idle' | 'layouting' | 'focusing' | 'expanding'
  /** Search query for node filtering */
  searchQuery: string
  /** Highlight path (for path finding) */
  highlightPath: string[] | null
  /** Min edge weight for visibility */
  minEdgeWeight: number
  /** Show labels */
  showLabels: boolean
  /** Show edge labels */
  showEdgeLabels: boolean
  /** Minimap visible */
  minimapVisible: boolean
  /** Physics simulation running */
  physicsEnabled: boolean
}

export type NetworkGraphEvent =
  // Node operations
  | { type: 'ADD_NODES'; nodes: GraphNode[] }
  | { type: 'REMOVE_NODES'; nodeIds: string[] }
  | { type: 'UPDATE_NODE'; nodeId: string; data: Partial<GraphNode> }
  | { type: 'SET_NODES'; nodes: GraphNode[] }

  // Edge operations
  | { type: 'ADD_EDGES'; edges: GraphEdge[] }
  | { type: 'REMOVE_EDGES'; edgeIds: string[] }
  | { type: 'SET_EDGES'; edges: GraphEdge[] }

  // Selection
  | { type: 'SELECT_NODE'; nodeId: string; additive?: boolean }
  | { type: 'SELECT_NODES'; nodeIds: string[] }
  | { type: 'DESELECT_NODE'; nodeId: string }
  | { type: 'DESELECT_ALL_NODES' }
  | { type: 'SELECT_EDGE'; edgeId: string }
  | { type: 'DESELECT_EDGE' }
  | { type: 'HOVER_NODE'; nodeId: string }
  | { type: 'UNHOVER_NODE' }
  | { type: 'HOVER_EDGE'; edgeId: string }
  | { type: 'UNHOVER_EDGE' }

  // Layout
  | { type: 'SET_LAYOUT'; layout: LayoutAlgorithm }
  | { type: 'APPLY_LAYOUT' }
  | { type: 'LAYOUT_COMPLETE' }
  | { type: 'TOGGLE_PHYSICS' }

  // Viewport
  | { type: 'SET_VIEWPORT'; viewport: ViewportState }
  | { type: 'ZOOM_IN' }
  | { type: 'ZOOM_OUT' }
  | { type: 'FIT_VIEW' }
  | { type: 'FOCUS_NODE'; nodeId: string }
  | { type: 'FOCUS_CLUSTER'; clusterId: string }

  // Clusters
  | { type: 'EXPAND_CLUSTER'; clusterId: string }
  | { type: 'COLLAPSE_CLUSTER'; clusterId: string }
  | { type: 'DETECT_CLUSTERS' }
  | { type: 'CLUSTERS_DETECTED'; clusters: GraphCluster[] }

  // Filtering
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'TOGGLE_EDGE_TYPE'; edgeType: EdgeType }
  | { type: 'SET_MIN_EDGE_WEIGHT'; weight: number }
  | { type: 'SHOW_ALL_EDGE_TYPES' }

  // Display options
  | { type: 'TOGGLE_LABELS' }
  | { type: 'TOGGLE_EDGE_LABELS' }
  | { type: 'TOGGLE_MINIMAP' }

  // Path finding
  | { type: 'FIND_PATH'; sourceId: string; targetId: string }
  | { type: 'PATH_FOUND'; path: string[] }
  | { type: 'CLEAR_PATH' }

  // Animation
  | { type: 'ANIMATION_COMPLETE' }

export type NetworkGraphEmittedEvent =
  | { type: 'onNodeSelect'; nodeIds: string[] }
  | { type: 'onNodeDoubleClick'; nodeId: string }
  | { type: 'onEdgeSelect'; edgeId: string | null }
  | { type: 'onLayoutChange'; layout: LayoutAlgorithm }
  | { type: 'onViewportChange'; viewport: ViewportState }
  | { type: 'onClusterExpand'; clusterId: string }
  | { type: 'onClusterCollapse'; clusterId: string }
  | { type: 'onPathFound'; path: string[] }

export interface NetworkGraphInput {
  initialLayout?: LayoutAlgorithm
  initialNodes?: GraphNode[]
  initialEdges?: GraphEdge[]
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const LAYOUT_ALGORITHMS: LayoutAlgorithm[] = ['force', 'hierarchical', 'radial', 'grid', 'circular']

export const EDGE_TYPES: EdgeType[] = ['association', 'communication', 'ownership', 'temporal', 'spatial']

export const EDGE_TYPE_COLORS: Record<EdgeType, string> = {
  association: '#6366f1',
  communication: '#22c55e',
  ownership: '#f59e0b',
  temporal: '#3b82f6',
  spatial: '#ef4444',
}

export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  entity: '#3b82f6',
  cluster: '#8b5cf6',
  gateway: '#f59e0b',
  unknown: '#6b7280',
}

const DEFAULT_VIEWPORT: ViewportState = { x: 0, y: 0, zoom: 1 }

// =============================================================================
// MACHINE
// =============================================================================

export const networkGraphMachine = setup({
  types: {
    context: {} as NetworkGraphContext,
    events: {} as NetworkGraphEvent,
    emitted: {} as NetworkGraphEmittedEvent,
    input: {} as NetworkGraphInput,
  },
  actions: {
    // Node operations
    addNodes: assign(({ context, event }) => {
      if (event.type !== 'ADD_NODES') return {}
      return { nodes: [...context.nodes, ...event.nodes] }
    }),

    removeNodes: assign(({ context, event }) => {
      if (event.type !== 'REMOVE_NODES') return {}
      const idsToRemove = new Set(event.nodeIds)
      return {
        nodes: context.nodes.filter((n) => !idsToRemove.has(n.id)),
        edges: context.edges.filter(
          (e) => !idsToRemove.has(e.source) && !idsToRemove.has(e.target)
        ),
        selectedNodeIds: new Set(
          [...context.selectedNodeIds].filter((id) => !idsToRemove.has(id))
        ),
      }
    }),

    updateNode: assign(({ context, event }) => {
      if (event.type !== 'UPDATE_NODE') return {}
      return {
        nodes: context.nodes.map((n) =>
          n.id === event.nodeId ? { ...n, ...event.data } : n
        ),
      }
    }),

    setNodes: assign(({ event }) => {
      if (event.type !== 'SET_NODES') return {}
      return { nodes: event.nodes }
    }),

    // Edge operations
    addEdges: assign(({ context, event }) => {
      if (event.type !== 'ADD_EDGES') return {}
      return { edges: [...context.edges, ...event.edges] }
    }),

    removeEdges: assign(({ context, event }) => {
      if (event.type !== 'REMOVE_EDGES') return {}
      const idsToRemove = new Set(event.edgeIds)
      return {
        edges: context.edges.filter((e) => !idsToRemove.has(e.id)),
        selectedEdgeIds: new Set(
          [...context.selectedEdgeIds].filter((id) => !idsToRemove.has(id))
        ),
      }
    }),

    setEdges: assign(({ event }) => {
      if (event.type !== 'SET_EDGES') return {}
      return { edges: event.edges }
    }),

    // Selection
    selectNode: assign(({ context, event }) => {
      if (event.type !== 'SELECT_NODE') return {}
      const newSelection = event.additive
        ? new Set([...context.selectedNodeIds, event.nodeId])
        : new Set([event.nodeId])
      return { selectedNodeIds: newSelection }
    }),

    selectNodes: assign(({ event }) => {
      if (event.type !== 'SELECT_NODES') return {}
      return { selectedNodeIds: new Set(event.nodeIds) }
    }),

    deselectNode: assign(({ context, event }) => {
      if (event.type !== 'DESELECT_NODE') return {}
      const newSelection = new Set(context.selectedNodeIds)
      newSelection.delete(event.nodeId)
      return { selectedNodeIds: newSelection }
    }),

    deselectAllNodes: assign({ selectedNodeIds: new Set<string>() }),

    selectEdge: assign(({ event }) => {
      if (event.type !== 'SELECT_EDGE') return {}
      return { selectedEdgeIds: new Set([event.edgeId]) }
    }),

    deselectEdge: assign({ selectedEdgeIds: new Set<string>() }),

    hoverNode: assign(({ event }) => {
      if (event.type !== 'HOVER_NODE') return {}
      return { hoveredNodeId: event.nodeId }
    }),

    unhoverNode: assign({ hoveredNodeId: null }),

    hoverEdge: assign(({ event }) => {
      if (event.type !== 'HOVER_EDGE') return {}
      return { hoveredEdgeId: event.edgeId }
    }),

    unhoverEdge: assign({ hoveredEdgeId: null }),

    // Layout
    setLayout: assign(({ event }) => {
      if (event.type !== 'SET_LAYOUT') return {}
      return { layout: event.layout }
    }),

    startLayouting: assign({ isLayouting: true, animationPhase: 'layouting' as const }),

    finishLayouting: assign({ isLayouting: false, animationPhase: 'idle' as const }),

    togglePhysics: assign(({ context }) => ({
      physicsEnabled: !context.physicsEnabled,
    })),

    // Viewport
    setViewport: assign(({ event }) => {
      if (event.type !== 'SET_VIEWPORT') return {}
      return { viewport: event.viewport }
    }),

    zoomIn: assign(({ context }) => ({
      viewport: { ...context.viewport, zoom: Math.min(context.viewport.zoom * 1.2, 4) },
    })),

    zoomOut: assign(({ context }) => ({
      viewport: { ...context.viewport, zoom: Math.max(context.viewport.zoom / 1.2, 0.1) },
    })),

    // Clusters
    expandCluster: assign(({ context, event }) => {
      if (event.type !== 'EXPAND_CLUSTER') return {}
      return {
        clusters: context.clusters.map((c) =>
          c.id === event.clusterId ? { ...c, expanded: true } : c
        ),
        animationPhase: 'expanding' as const,
      }
    }),

    collapseCluster: assign(({ context, event }) => {
      if (event.type !== 'COLLAPSE_CLUSTER') return {}
      return {
        clusters: context.clusters.map((c) =>
          c.id === event.clusterId ? { ...c, expanded: false } : c
        ),
      }
    }),

    setClusters: assign(({ event }) => {
      if (event.type !== 'CLUSTERS_DETECTED') return {}
      return { clusters: event.clusters }
    }),

    // Filtering
    setSearchQuery: assign(({ event }) => {
      if (event.type !== 'SET_SEARCH_QUERY') return {}
      return { searchQuery: event.query }
    }),

    toggleEdgeType: assign(({ context, event }) => {
      if (event.type !== 'TOGGLE_EDGE_TYPE') return {}
      const newTypes = new Set(context.visibleEdgeTypes)
      if (newTypes.has(event.edgeType)) {
        newTypes.delete(event.edgeType)
      } else {
        newTypes.add(event.edgeType)
      }
      return { visibleEdgeTypes: newTypes }
    }),

    setMinEdgeWeight: assign(({ event }) => {
      if (event.type !== 'SET_MIN_EDGE_WEIGHT') return {}
      return { minEdgeWeight: event.weight }
    }),

    showAllEdgeTypes: assign({
      visibleEdgeTypes: new Set(EDGE_TYPES),
    }),

    // Display options
    toggleLabels: assign(({ context }) => ({
      showLabels: !context.showLabels,
    })),

    toggleEdgeLabels: assign(({ context }) => ({
      showEdgeLabels: !context.showEdgeLabels,
    })),

    toggleMinimap: assign(({ context }) => ({
      minimapVisible: !context.minimapVisible,
    })),

    // Path finding
    setPath: assign(({ event }) => {
      if (event.type !== 'PATH_FOUND') return {}
      return { highlightPath: event.path }
    }),

    clearPath: assign({ highlightPath: null }),

    // Animation
    startFocusing: assign({ animationPhase: 'focusing' as const }),

    finishAnimation: assign({ animationPhase: 'idle' as const }),

    // Emit events
    emitNodeSelect: emit(({ context }) => ({
      type: 'onNodeSelect' as const,
      nodeIds: [...context.selectedNodeIds],
    })),

    emitEdgeSelect: emit(({ context }) => ({
      type: 'onEdgeSelect' as const,
      edgeId: context.selectedEdgeIds.size > 0 ? [...context.selectedEdgeIds][0] : null,
    })),

    emitLayoutChange: emit(({ context }) => ({
      type: 'onLayoutChange' as const,
      layout: context.layout,
    })),

    emitViewportChange: emit(({ context }) => ({
      type: 'onViewportChange' as const,
      viewport: context.viewport,
    })),

    emitClusterExpand: emit(({ event }) => {
      if (event.type !== 'EXPAND_CLUSTER') {
        return { type: 'onClusterExpand' as const, clusterId: '' }
      }
      return { type: 'onClusterExpand' as const, clusterId: event.clusterId }
    }),

    emitClusterCollapse: emit(({ event }) => {
      if (event.type !== 'COLLAPSE_CLUSTER') {
        return { type: 'onClusterCollapse' as const, clusterId: '' }
      }
      return { type: 'onClusterCollapse' as const, clusterId: event.clusterId }
    }),

    emitPathFound: emit(({ context }) => ({
      type: 'onPathFound' as const,
      path: context.highlightPath ?? [],
    })),
  },
}).createMachine({
  id: 'networkGraph',
  initial: 'idle',
  context: ({ input }) => ({
    nodes: input.initialNodes ?? [],
    edges: input.initialEdges ?? [],
    clusters: [],
    layout: input.initialLayout ?? 'force',
    selectedNodeIds: new Set<string>(),
    hoveredNodeId: null,
    selectedEdgeIds: new Set<string>(),
    hoveredEdgeId: null,
    visibleEdgeTypes: new Set(EDGE_TYPES),
    viewport: DEFAULT_VIEWPORT,
    isLayouting: false,
    animationPhase: 'idle',
    searchQuery: '',
    highlightPath: null,
    minEdgeWeight: 0,
    showLabels: true,
    showEdgeLabels: false,
    minimapVisible: true,
    physicsEnabled: true,
  }),
  states: {
    idle: {
      on: {
        // Node operations
        ADD_NODES: { actions: ['addNodes'] },
        REMOVE_NODES: { actions: ['removeNodes'] },
        UPDATE_NODE: { actions: ['updateNode'] },
        SET_NODES: { actions: ['setNodes'] },

        // Edge operations
        ADD_EDGES: { actions: ['addEdges'] },
        REMOVE_EDGES: { actions: ['removeEdges'] },
        SET_EDGES: { actions: ['setEdges'] },

        // Selection
        SELECT_NODE: { actions: ['selectNode', 'emitNodeSelect'] },
        SELECT_NODES: { actions: ['selectNodes', 'emitNodeSelect'] },
        DESELECT_NODE: { actions: ['deselectNode', 'emitNodeSelect'] },
        DESELECT_ALL_NODES: { actions: ['deselectAllNodes', 'emitNodeSelect'] },
        SELECT_EDGE: { actions: ['selectEdge', 'emitEdgeSelect'] },
        DESELECT_EDGE: { actions: ['deselectEdge', 'emitEdgeSelect'] },
        HOVER_NODE: { actions: ['hoverNode'] },
        UNHOVER_NODE: { actions: ['unhoverNode'] },
        HOVER_EDGE: { actions: ['hoverEdge'] },
        UNHOVER_EDGE: { actions: ['unhoverEdge'] },

        // Layout
        SET_LAYOUT: { actions: ['setLayout', 'emitLayoutChange'] },
        APPLY_LAYOUT: { target: 'layouting', actions: ['startLayouting'] },
        TOGGLE_PHYSICS: { actions: ['togglePhysics'] },

        // Viewport
        SET_VIEWPORT: { actions: ['setViewport', 'emitViewportChange'] },
        ZOOM_IN: { actions: ['zoomIn', 'emitViewportChange'] },
        ZOOM_OUT: { actions: ['zoomOut', 'emitViewportChange'] },
        FIT_VIEW: { target: 'focusing' },
        FOCUS_NODE: { target: 'focusing', actions: ['startFocusing'] },
        FOCUS_CLUSTER: { target: 'focusing', actions: ['startFocusing'] },

        // Clusters
        EXPAND_CLUSTER: { target: 'expanding', actions: ['expandCluster', 'emitClusterExpand'] },
        COLLAPSE_CLUSTER: { actions: ['collapseCluster', 'emitClusterCollapse'] },
        DETECT_CLUSTERS: { target: 'detectingClusters' },
        CLUSTERS_DETECTED: { actions: ['setClusters'] },

        // Filtering
        SET_SEARCH_QUERY: { actions: ['setSearchQuery'] },
        TOGGLE_EDGE_TYPE: { actions: ['toggleEdgeType'] },
        SET_MIN_EDGE_WEIGHT: { actions: ['setMinEdgeWeight'] },
        SHOW_ALL_EDGE_TYPES: { actions: ['showAllEdgeTypes'] },

        // Display options
        TOGGLE_LABELS: { actions: ['toggleLabels'] },
        TOGGLE_EDGE_LABELS: { actions: ['toggleEdgeLabels'] },
        TOGGLE_MINIMAP: { actions: ['toggleMinimap'] },

        // Path finding
        FIND_PATH: { target: 'findingPath' },
        CLEAR_PATH: { actions: ['clearPath'] },
      },
    },
    layouting: {
      on: {
        LAYOUT_COMPLETE: { target: 'idle', actions: ['finishLayouting'] },
      },
    },
    focusing: {
      on: {
        ANIMATION_COMPLETE: { target: 'idle', actions: ['finishAnimation'] },
      },
    },
    expanding: {
      on: {
        ANIMATION_COMPLETE: { target: 'idle', actions: ['finishAnimation'] },
      },
    },
    detectingClusters: {
      on: {
        CLUSTERS_DETECTED: { target: 'idle', actions: ['setClusters'] },
      },
    },
    findingPath: {
      on: {
        PATH_FOUND: { target: 'idle', actions: ['setPath', 'emitPathFound'] },
        CLEAR_PATH: { target: 'idle', actions: ['clearPath'] },
      },
    },
  },
})

// =============================================================================
// EXPORTS
// =============================================================================

export type NetworkGraphMachine = typeof networkGraphMachine
export type NetworkGraphSnapshot = ReturnType<typeof networkGraphMachine.getInitialSnapshot>
