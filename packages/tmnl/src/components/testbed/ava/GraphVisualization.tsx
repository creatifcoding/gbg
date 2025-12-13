/**
 * AVA Graph Visualization
 *
 * D3 force-directed graph showing view dependencies,
 * channel relationships, and data flow.
 *
 * @pattern D3 + React integration
 * @module
 */

import { useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'

import { useStxData } from '@/lib/stx'
import { getAvaStx, type ViewSummary, type ViewArtifact } from '@/lib/ava/atoms/ava-stx'

// =============================================================================
// Types
// =============================================================================

interface GraphNode {
  id: string
  label: string
  type: 'view' | 'channel' | 'source'
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  type: 'binding' | 'dependency' | 'subscription'
}

// =============================================================================
// Helpers
// =============================================================================

const buildGraphData = (
  views: readonly ViewSummary[],
  artifact: ViewArtifact | null
): { nodes: GraphNode[]; links: GraphLink[] } => {
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []
  const nodeIds = new Set<string>()

  // Add view nodes
  views.forEach(view => {
    if (!nodeIds.has(view.id)) {
      nodes.push({
        id: view.id,
        label: view.name,
        type: 'view',
      })
      nodeIds.add(view.id)
    }
  })

  // If we have an artifact, add channel bindings
  if (artifact) {
    artifact.channel_bindings.forEach(binding => {
      // Add channel node
      if (!nodeIds.has(binding.channel_id)) {
        nodes.push({
          id: binding.channel_id,
          label: binding.channel_id,
          type: 'channel',
        })
        nodeIds.add(binding.channel_id)
      }

      // Add source node if present
      if (binding.source_id && !nodeIds.has(binding.source_id)) {
        nodes.push({
          id: binding.source_id,
          label: binding.source_id,
          type: 'source',
        })
        nodeIds.add(binding.source_id)
      }

      // Link view to channel
      links.push({
        source: artifact.view_id,
        target: binding.channel_id,
        type: 'binding',
      })

      // Link channel to source if present
      if (binding.source_id) {
        links.push({
          source: binding.channel_id,
          target: binding.source_id,
          type: 'dependency',
        })
      }
    })
  }

  return { nodes, links }
}

const getNodeColor = (type: GraphNode['type']): string => {
  switch (type) {
    case 'view':
      return '#22d3ee' // cyan
    case 'channel':
      return '#a855f7' // purple
    case 'source':
      return '#22c55e' // green
    default:
      return '#a3a3a3'
  }
}

const getLinkColor = (type: GraphLink['type']): string => {
  switch (type) {
    case 'binding':
      return '#525252'
    case 'dependency':
      return '#713f12'
    case 'subscription':
      return '#0e7490'
    default:
      return '#404040'
  }
}

// =============================================================================
// Component
// =============================================================================

export function GraphVisualization() {
  const svgRef = useRef<SVGSVGElement>(null)
  const ava = getAvaStx()

  // Subscribe to state
  const views = useStxData(ava, d => d.views.get())
  const artifact = useStxData(ava, d => d.artifact.get())

  // Build graph data
  const graphData = useMemo(
    () => buildGraphData(views, artifact),
    [views, artifact]
  )

  // D3 force simulation
  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    const width = svgRef.current.clientWidth || 400
    const height = svgRef.current.clientHeight || 300

    // Clear previous
    svg.selectAll('*').remove()

    // Create container group
    const g = svg.append('g')

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Create force simulation
    const simulation = d3.forceSimulation<GraphNode>(graphData.nodes as GraphNode[])
      .force('link', d3.forceLink<GraphNode, GraphLink>(graphData.links)
        .id(d => d.id)
        .distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30))

    // Create links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(graphData.links)
      .join('line')
      .attr('stroke', d => getLinkColor(d.type))
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6)

    // Create nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(graphData.nodes)
      .join('g')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        }) as any)

    // Node circles
    node.append('circle')
      .attr('r', d => d.type === 'view' ? 20 : 12)
      .attr('fill', d => getNodeColor(d.type))
      .attr('stroke', '#0a0a0a')
      .attr('stroke-width', 2)
      .attr('opacity', 0.9)

    // Node labels
    node.append('text')
      .attr('dy', d => d.type === 'view' ? 35 : 25)
      .attr('text-anchor', 'middle')
      .attr('fill', '#a3a3a3')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .text(d => d.label.length > 12 ? d.label.slice(0, 12) + '...' : d.label)

    // Node type icons
    node.append('text')
      .attr('dy', 4)
      .attr('text-anchor', 'middle')
      .attr('fill', '#0a0a0a')
      .attr('font-size', d => d.type === 'view' ? '12px' : '8px')
      .attr('font-weight', 'bold')
      .text(d => d.type === 'view' ? 'V' : d.type === 'channel' ? 'C' : 'S')

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x ?? 0)
        .attr('y1', d => (d.source as GraphNode).y ?? 0)
        .attr('x2', d => (d.target as GraphNode).x ?? 0)
        .attr('y2', d => (d.target as GraphNode).y ?? 0)

      node.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    // Cleanup
    return () => {
      simulation.stop()
    }
  }, [graphData])

  return (
    <div className="flex flex-col h-full bg-neutral-950 border border-neutral-800 rounded overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-900/50">
        <span
          className="font-mono text-neutral-400"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          GRAPH VISUALIZATION
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
            <span className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>View</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>Channel</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>Source</span>
          </div>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative">
        {graphData.nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-neutral-600 font-mono"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              No views registered. Click "Register" to add a test view.
            </span>
          </div>
        ) : (
          <svg
            ref={svgRef}
            className="w-full h-full"
            style={{ background: 'transparent' }}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1 border-t border-neutral-800 bg-neutral-900/30">
        <span
          className="font-mono text-neutral-600"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {graphData.nodes.length} nodes • {graphData.links.length} links • Drag to reposition, scroll to zoom
        </span>
      </div>
    </div>
  )
}
