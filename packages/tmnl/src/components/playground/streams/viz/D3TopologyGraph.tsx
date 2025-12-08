/**
 * D3 Topology Graph
 *
 * Force-directed graph visualization for stream topology.
 * Shows inlets, outlets, junctions, and their connections.
 *
 * @module
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import * as d3 from 'd3'

// =============================================================================
// TYPES
// =============================================================================

export type NodeKind = 'inlet' | 'outlet' | 'junction' | 'channel'

export interface TopologyNode {
  id: string
  label: string
  kind: NodeKind
  throughput?: number
  status?: 'idle' | 'active' | 'error' | 'backpressure'
}

export interface TopologyLink {
  source: string
  target: string
  throughput?: number
}

export interface D3TopologyGraphProps {
  /** Nodes in the topology */
  nodes: TopologyNode[]
  /** Links between nodes */
  links: TopologyLink[]
  /** Chart width */
  width?: number
  /** Chart height */
  height?: number
  /** Selected node ID */
  selectedNode?: string | null
  /** Node selection handler */
  onNodeSelect?: (nodeId: string | null) => void
}

// =============================================================================
// CONSTANTS
// =============================================================================

const NODE_COLORS: Record<NodeKind, { fill: string; stroke: string }> = {
  inlet: { fill: '#0891b2', stroke: '#22d3ee' },
  outlet: { fill: '#059669', stroke: '#34d399' },
  junction: { fill: '#d97706', stroke: '#fbbf24' },
  channel: { fill: '#525252', stroke: '#737373' },
}

const NODE_SIZES: Record<NodeKind, number> = {
  inlet: 20,
  outlet: 20,
  junction: 15,
  channel: 30,
}

const STATUS_COLORS: Record<string, string> = {
  idle: '#525252',
  active: '#22c55e',
  error: '#ef4444',
  backpressure: '#f59e0b',
}

// =============================================================================
// D3 TOPOLOGY GRAPH
// =============================================================================

interface D3Node extends d3.SimulationNodeDatum {
  id: string
  label: string
  kind: NodeKind
  throughput?: number
  status?: string
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  throughput?: number
}

/**
 * Force-directed topology graph using D3.
 *
 * Features:
 * - Node types: inlet, outlet, junction, channel
 * - Animated links with throughput-based stroke width
 * - Status indicators
 * - Interactive selection
 * - Drag behavior
 */
export function D3TopologyGraph({
  nodes,
  links,
  width = 600,
  height = 400,
  selectedNode,
  onNodeSelect,
}: D3TopologyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null)

  // Initialize graph
  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)

    // Clear
    svg.selectAll('*').remove()

    // Create groups
    const g = svg.append('g')

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Create arrow marker
    svg.append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#525252')

    // Links group
    g.append('g').attr('class', 'links')

    // Nodes group
    g.append('g').attr('class', 'nodes')

    // Labels group
    g.append('g').attr('class', 'labels')
  }, [width, height])

  // Update graph
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    const g = svg.select('g')

    // Convert data
    const d3Nodes: D3Node[] = nodes.map((n) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 100,
      y: height / 2 + (Math.random() - 0.5) * 100,
    }))

    const nodeMap = new Map(d3Nodes.map((n) => [n.id, n]))

    const d3Links: D3Link[] = links
      .map((l) => ({
        source: nodeMap.get(l.source),
        target: nodeMap.get(l.target),
        throughput: l.throughput,
      }))
      .filter((l) => l.source && l.target) as D3Link[]

    // Create simulation
    const simulation = d3.forceSimulation<D3Node>(d3Nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(d3Links)
        .id((d) => d.id)
        .distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40))

    simulationRef.current = simulation

    // Links
    const linkSelection = g.select('.links')
      .selectAll<SVGLineElement, D3Link>('line')
      .data(d3Links, (d) => `${(d.source as D3Node).id}-${(d.target as D3Node).id}`)

    linkSelection.exit().remove()

    const linkEnter = linkSelection.enter()
      .append('line')
      .attr('stroke', '#404040')
      .attr('stroke-width', (d) => Math.max(1, Math.log10((d.throughput ?? 1) + 1)))
      .attr('marker-end', 'url(#arrowhead)')

    const linkMerge = linkEnter.merge(linkSelection)

    // Nodes
    const nodeSelection = g.select('.nodes')
      .selectAll<SVGCircleElement, D3Node>('circle')
      .data(d3Nodes, (d) => d.id)

    nodeSelection.exit().remove()

    const nodeEnter = nodeSelection.enter()
      .append('circle')
      .attr('r', (d) => NODE_SIZES[d.kind])
      .attr('fill', (d) => NODE_COLORS[d.kind].fill)
      .attr('stroke', (d) => d.id === selectedNode ? '#fff' : NODE_COLORS[d.kind].stroke)
      .attr('stroke-width', (d) => d.id === selectedNode ? 3 : 2)
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation()
        onNodeSelect?.(d.id === selectedNode ? null : d.id)
      })
      .call(d3.drag<SVGCircleElement, D3Node>()
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
        }))

    const nodeMerge = nodeEnter.merge(nodeSelection)

    // Labels
    const labelSelection = g.select('.labels')
      .selectAll<SVGTextElement, D3Node>('text')
      .data(d3Nodes, (d) => d.id)

    labelSelection.exit().remove()

    const labelEnter = labelSelection.enter()
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => NODE_SIZES[d.kind] + 15)
      .attr('fill', '#a3a3a3')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .text((d) => d.label)

    const labelMerge = labelEnter.merge(labelSelection)

    // Update on tick
    simulation.on('tick', () => {
      linkMerge
        .attr('x1', (d) => (d.source as D3Node).x ?? 0)
        .attr('y1', (d) => (d.source as D3Node).y ?? 0)
        .attr('x2', (d) => (d.target as D3Node).x ?? 0)
        .attr('y2', (d) => (d.target as D3Node).y ?? 0)

      nodeMerge
        .attr('cx', (d) => d.x ?? 0)
        .attr('cy', (d) => d.y ?? 0)

      labelMerge
        .attr('x', (d) => d.x ?? 0)
        .attr('y', (d) => d.y ?? 0)
    })

    // Click outside to deselect
    svg.on('click', () => onNodeSelect?.(null))

    return () => {
      simulation.stop()
    }
  }, [nodes, links, width, height, selectedNode, onNodeSelect])

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="bg-neutral-900/50 rounded border border-neutral-800"
    />
  )
}

export default D3TopologyGraph
