/**
 * GraphCanvas — Cytoscape-backed RCA graph explorer.
 *
 * React owns data/query/UI state; Cytoscape owns the graph viewport, layout,
 * selection hit-testing, zoom, pan, and graph interaction inside one DOM island.
 */
import { useEffect, useMemo, useRef } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import {
  useAtomValue,
  useAtomSet,
  useAtom,
  selectedSessionIdAtom,
  selectedNodeIdAtom,
  showNodeLabelsAtom,
  showEdgeLabelsAtom,
  focusNeighboursAtom,
} from '../lib/atoms.ts'
import { useGraphQuery } from '../lib/query.ts'
import type { RcaNode, RcaEdge } from '../lib/schema.ts'

const NODE_COLOURS: Record<string, string> = {
  anomaly: '#ff4444',
  bottleneck: '#ff8800',
  root_cause: '#ff2222',
  symptom: '#cc6600',
  probe: '#44aaff',
  script: '#88ff44',
  agent_decision: '#cc44ff',
  incident: '#ff2266',
  hazard: '#ffbb33',
  hypothesis: '#9b7cff',
  loss: '#ff5c8a',
  normal: '#555555',
}

const NODE_SHAPES: Record<string, cytoscape.Css.NodeShape> = {
  root_cause: 'diamond',
  incident: 'hexagon',
  hazard: 'triangle',
  hypothesis: 'round-rectangle',
  loss: 'vee',
  probe: 'ellipse',
  script: 'rectangle',
}

function nodeSize(node: RcaNode, degree = 0): number {
  if (node.node_type === 'root_cause' || node.node_type === 'incident') return 30
  if (node.node_type === 'hazard' || node.node_type === 'hypothesis') return 26
  if (node.node_type === 'anomaly' || node.node_type === 'bottleneck') return 24
  return degree >= 4 ? 21 : 18
}

function nodeImportance(node: RcaNode, degree = 0): number {
  const typeWeight = ({
    root_cause: 100,
    incident: 92,
    hazard: 84,
    hypothesis: 76,
    bottleneck: 72,
    anomaly: 68,
    loss: 64,
    symptom: 58,
    probe: 34,
    script: 28,
    agent_decision: 52,
  } as Record<string, number>)[node.node_type] ?? 20
  return typeWeight + degree * 5 + (node.severity ?? 0) * 20
}

function shortLabel(label: string): string {
  return label.length > 34 ? `${label.slice(0, 33)}…` : label
}

function makeElements(nodes: readonly RcaNode[], edges: readonly RcaEdge[]): ElementDefinition[] {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const degreeByNode = new Map<string, number>()
  for (const edge of edges) {
    if (!nodeIds.has(edge.source_id) || !nodeIds.has(edge.target_id)) continue
    degreeByNode.set(edge.source_id, (degreeByNode.get(edge.source_id) ?? 0) + 1)
    degreeByNode.set(edge.target_id, (degreeByNode.get(edge.target_id) ?? 0) + 1)
  }
  const overviewLabelIds = new Set(
    [...nodes]
      .sort((left, right) =>
        nodeImportance(right, degreeByNode.get(right.id) ?? 0) - nodeImportance(left, degreeByNode.get(left.id) ?? 0),
      )
      .slice(0, 7)
      .map((node) => node.id),
  )

  const nodeElements: ElementDefinition[] = nodes.map((node) => {
    const degree = degreeByNode.get(node.id) ?? 0
    return {
      group: 'nodes',
      data: {
        id: node.id,
        label: shortLabel(node.label),
        overviewLabel: overviewLabelIds.has(node.id) ? shortLabel(node.label) : '',
        fullLabel: node.label,
        nodeType: node.node_type,
        severity: node.severity ?? 0,
        size: nodeSize(node, degree),
        degree,
        colour: NODE_COLOURS[node.node_type] ?? NODE_COLOURS.normal,
        shape: NODE_SHAPES[node.node_type] ?? 'ellipse',
      },
      classes: `kind-${node.node_type.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
    }
  })

  const edgeElements: ElementDefinition[] = edges
    .filter((edge) => nodeIds.has(edge.source_id) && nodeIds.has(edge.target_id))
    .map((edge) => ({
      group: 'edges',
      data: {
        id: edge.id,
        source: edge.source_id,
        target: edge.target_id,
        label: edge.label ?? edge.edge_type ?? '',
        edgeType: edge.edge_type ?? '',
        weight: edge.weight ?? 0.4,
      },
    }))

  return [...nodeElements, ...edgeElements]
}

function makeStylesheet(showLabels: boolean, showEdgeLabels: boolean): cytoscape.StylesheetJson {
  return ([
    {
      selector: 'core',
      style: {
        'active-bg-opacity': 0,
        'selection-box-color': '#ffffff',
        'selection-box-border-color': '#ffffff',
        'selection-box-opacity': 0.08,
      },
    },
    {
      selector: 'node',
      style: {
        width: 'data(size)',
        height: 'data(size)',
        shape: 'data(shape)',
        'background-color': 'data(colour)',
        'border-color': '#222222',
        'border-width': 1,
        label: showLabels ? 'data(overviewLabel)' : '',
        color: '#ffffff',
        'font-family': 'IBM Plex Mono, JetBrains Mono, Courier New, monospace',
        'font-size': 9,
        'font-weight': 500,
        'text-margin-y': 9,
        'text-wrap': 'wrap',
        'text-max-width': 128,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'overlay-padding': 16,
        'overlay-opacity': 0,
        'underlay-padding': 4,
        'underlay-opacity': 0,
      },
    },
    {
      selector: 'edge',
      style: {
        width: 1,
        'line-color': '#2a2a2a',
        'target-arrow-color': '#2a2a2a',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        label: showEdgeLabels ? 'data(label)' : '',
        color: '#888888',
        'font-family': 'IBM Plex Mono, JetBrains Mono, Courier New, monospace',
        'font-size': 8,
        'text-background-color': '#000000',
        'text-background-opacity': 0.85,
        'text-background-padding': 2,
        'text-rotation': 'autorotate',
      },
    },
    {
      selector: 'node:selected, node.selected',
      style: {
        label: showLabels ? 'data(fullLabel)' : '',
        'border-color': '#ffffff',
        'border-width': 3,
        'underlay-color': '#ffffff',
        'underlay-opacity': 0.16,
        'underlay-padding': 12,
        'z-index': 20,
      },
    },
    {
      selector: 'node.neighbour',
      style: {
        label: showLabels ? 'data(label)' : '',
        'border-color': '#777777',
        'border-width': 2,
        'z-index': 12,
      },
    },
    {
      selector: 'edge.selected-edge, edge.neighbour-edge',
      style: {
        width: 2,
        'line-color': '#8a8a8a',
        'target-arrow-color': '#8a8a8a',
        'z-index': 8,
      },
    },
    {
      selector: '.second-hop',
      style: {
        opacity: 0.38,
      },
    },
    {
      selector: '.faded',
      style: {
        opacity: 0.14,
      },
    },
  ] as unknown) as cytoscape.StylesheetJson
}

function fitGraph(cy: Core) {
  cy.fit(cy.elements(), 48)
}

function runLayout(cy: Core) {
  cy.layout({
    name: 'cose',
    animate: false,
    fit: true,
    padding: 48,
    randomize: false,
    idealEdgeLength: 92,
    nodeRepulsion: 5200,
    gravity: 0.28,
    numIter: 800,
  }).run()
}

export function GraphCanvas() {
  const sessionId = useAtomValue(selectedSessionIdAtom)
  const [selectedNodeId, setSelectedNodeId] = useAtom(selectedNodeIdAtom)
  const showLabels = useAtomValue(showNodeLabelsAtom)
  const showEdgeLabels = useAtomValue(showEdgeLabelsAtom)
  const focusNeighbours = useAtomValue(focusNeighboursAtom)
  const setShowLabels = useAtomSet(showNodeLabelsAtom)
  const setShowEdgeLabels = useAtomSet(showEdgeLabelsAtom)
  const setFocusNeighbours = useAtomSet(focusNeighboursAtom)

  const { data: graph, isLoading, error, refetch } = useGraphQuery(sessionId)

  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const elements = useMemo(
    () => (graph ? makeElements(graph.nodes, graph.edges) : []),
    [graph],
  )

  useEffect(() => {
    if (!containerRef.current || !graph) return

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: makeStylesheet(showLabels, showEdgeLabels),
      minZoom: 0.18,
      maxZoom: 3.5,
      boxSelectionEnabled: true,
      autoungrabify: false,
    })

    cyRef.current = cy
    runLayout(cy)

    cy.on('tap', 'node', (event) => {
      const nodeId = event.target.id()
      setSelectedNodeId((previous) => (previous === nodeId ? null : nodeId))
    })

    cy.on('tap', (event) => {
      if (event.target === cy) setSelectedNodeId(null)
    })

    return () => {
      cy.stop(true)
      cy.destroy()
      if (cyRef.current === cy) cyRef.current = null
    }
  }, [elements, graph, setSelectedNodeId])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || cy.destroyed()) return
    cy.style(makeStylesheet(showLabels, showEdgeLabels))
  }, [showLabels, showEdgeLabels])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || cy.destroyed()) return

    cy.batch(() => {
      cy.elements().removeClass('selected selected-edge neighbour neighbour-edge second-hop faded')
      if (!selectedNodeId) return

      const selected = cy.getElementById(selectedNodeId)
      selected.addClass('selected')
      selected.connectedEdges().addClass('selected-edge')

      const oneHop = selected.openNeighborhood('node')
      const directEdges = selected.edgesWith(oneHop)
      const oneHopInternalEdges = oneHop.edgesWith(oneHop)
      const branchEdges = directEdges.union(oneHopInternalEdges)
      oneHop.addClass('neighbour')
      branchEdges.addClass('neighbour-edge')

      if (focusNeighbours) {
        const twoHop = oneHop.connectedEdges().connectedNodes().not(selected).not(oneHop)
        const kept = selected.union(oneHop).union(branchEdges).union(twoHop)
        twoHop.addClass('second-hop')
        cy.elements().not(kept).addClass('faded')
      }
    })
  }, [selectedNodeId, focusNeighbours])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedNodeId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setSelectedNodeId])

  if (!sessionId) {
    return (
      <div className="gbm-graph">
        <div className="gbm-graph__empty">select a session to inspect its RCA graph</div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="gbm-graph">
        <div className="gbm-graph__empty">loading graph…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="gbm-graph">
        <div className="gbm-graph__empty gbm-graph__empty--error">
          <span>{error instanceof Error ? error.message : 'error loading graph'}</span>
          <button className="gbm-btn" onClick={refetch}>retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="gbm-graph">
      <div className="gbm-graph__toolbar" aria-label="Graph controls">
        <button
          className={`gbm-btn ${showLabels ? 'gbm-btn--active' : ''}`}
          onClick={() => setShowLabels((value) => !value)}
          aria-pressed={showLabels}
          title="Toggle node labels"
        >
          nodes
        </button>
        <button
          className={`gbm-btn ${showEdgeLabels ? 'gbm-btn--active' : ''}`}
          onClick={() => setShowEdgeLabels((value) => !value)}
          aria-pressed={showEdgeLabels}
          title="Toggle edge labels"
        >
          edges
        </button>
        <button
          className={`gbm-btn ${focusNeighbours ? 'gbm-btn--active' : ''}`}
          onClick={() => setFocusNeighbours((value) => !value)}
          aria-pressed={focusNeighbours}
          title="Dim everything except the selected node neighborhood"
        >
          focus
        </button>
        <button className="gbm-btn" onClick={() => cyRef.current && fitGraph(cyRef.current)}>
          fit
        </button>
        <button className="gbm-btn" onClick={refetch}>
          refresh
        </button>
      </div>

      <div ref={containerRef} className="gbm-graph__cy" />

      {graph && graph.nodes.length > 0 && (
        <div className="gbm-graph__legend" aria-label="Graph summary">
          <span>{graph.nodes.length} nodes</span>
          <span>{graph.edges.length} edges</span>
          <span>{selectedNodeId ? 'focus: 1-hop bright / 2-hop faint' : 'overview: ranked labels'}</span>
        </div>
      )}

      {graph && graph.nodes.length === 0 && (
        <div className="gbm-graph__empty">graph has no nodes yet; evidence may still be collecting</div>
      )}
    </div>
  )
}
