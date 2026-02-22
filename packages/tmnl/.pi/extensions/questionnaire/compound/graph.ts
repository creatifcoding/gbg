/**
 * Graph hydration + validation bridge.
 *
 * Converts JSON-serializable CompoundSpec into Effect Graph.directed instances.
 * Provides validation, topological ordering, and Mermaid diagram generation.
 *
 * This module is the ONLY place that imports `Graph` from `effect`.
 * Schema files remain purely JSON-serializable.
 *
 * @module questionnaire/compound/graph
 */

import { Graph } from 'effect'
import type { CompoundSpec, CompoundNodeDef, CompoundEdgeDef } from './schemas.ts'
import { CompoundValidationError } from './schemas.ts'

// =============================================================================
// Types
// =============================================================================

/** Hydrated directed graph with CompoundNodeDef nodes and CompoundEdgeDef edges */
export type CompoundGraph = Graph.DirectedGraph<CompoundNodeDef, CompoundEdgeDef>

// =============================================================================
// Hydration — JSON spec → Effect Graph
// =============================================================================

/**
 * Hydrate a CompoundSpec into an Effect Graph.directed instance.
 *
 * Builds the graph by adding all nodes, then all edges.
 * Throws CompoundValidationError if edges reference unknown nodes.
 */
export const hydrateGraph = (spec: CompoundSpec): CompoundGraph => {
  const graph = Graph.directed<CompoundNodeDef, CompoundEdgeDef>((mutable) => {
    const nodeIndices = new Map<string, number>()

    // Add all nodes
    for (const node of spec.nodes) {
      const idx = Graph.addNode(mutable, node)
      nodeIndices.set(node.nodeId as string, idx)
    }

    // Add all edges — validate that from/to reference existing nodes
    for (const edge of spec.edges) {
      const fromIdx = nodeIndices.get(edge.from as string)
      const toIdx = nodeIndices.get(edge.to as string)

      if (fromIdx === undefined || toIdx === undefined) {
        throw new CompoundValidationError({
          message: `Edge references unknown node: ${edge.from} -> ${edge.to}`,
          specId: spec.id as string,
          issues: [
            `Unknown node in edge: from=${edge.from} (${fromIdx === undefined ? 'missing' : 'ok'}), to=${edge.to} (${toIdx === undefined ? 'missing' : 'ok'})`,
          ],
        })
      }

      Graph.addEdge(mutable, fromIdx, toIdx, edge)
    }
  })

  return graph
}

// =============================================================================
// Validation — structural integrity checks
// =============================================================================

/**
 * Validate a hydrated compound graph.
 *
 * Checks:
 * - Acyclicity (DAG execution requires no cycles)
 * - Non-empty graph
 * - All start nodes exist in the node set
 * - No orphan nodes (nodes with no edges and not a start node)
 */
export const validateGraph = (spec: CompoundSpec, graph: CompoundGraph): ReadonlyArray<string> => {
  const issues: string[] = []

  // Check node count
  if (Graph.nodeCount(graph) === 0) {
    issues.push('Compound spec has no nodes')
  }

  // Check acyclicity
  if (!Graph.isAcyclic(graph)) {
    issues.push('Compound spec contains cycles — DAG execution requires an acyclic graph')
  }

  // Check start nodes exist in the node set
  const nodeMap = spec.nodeMap
  for (const startId of spec.startNodeIds) {
    if (!nodeMap.has(startId as string)) {
      issues.push(`Start node '${startId}' not found in nodes`)
    }
  }

  // Check for orphan nodes: no incoming AND no outgoing edges, AND not a start node
  const startSet = new Set(spec.startNodeIds.map(id => id as string))
  const indexMap = buildNodeIndexMap(spec, graph)

  for (const node of spec.nodes) {
    const nid = node.nodeId as string
    const idx = indexMap.get(nid)
    if (idx === undefined) continue

    const outgoing = Graph.neighborsDirected(graph, idx, 'outgoing')
    const incoming = Graph.neighborsDirected(graph, idx, 'incoming')

    if (outgoing.length === 0 && incoming.length === 0 && !startSet.has(nid)) {
      issues.push(`Orphan node '${nid}' has no edges and is not a start node`)
    }
  }

  return issues
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Build a nodeId → NodeIndex lookup map from the graph.
 *
 * Uses the Graph iterator API to walk all nodes.
 */
export const buildNodeIndexMap = (spec: CompoundSpec, graph: CompoundGraph): Map<string, number> => {
  const map = new Map<string, number>()
  const walker = Graph.nodes(graph)

  for (const [idx, node] of walker) {
    map.set(node.nodeId as string, idx)
  }

  return map
}

/**
 * Get topological execution order as node ID strings.
 *
 * Uses Kahn's algorithm via Graph.topo. Throws GraphError if graph has cycles.
 */
export const getTopologicalOrder = (graph: CompoundGraph): string[] => {
  const topoWalker = Graph.topo(graph)
  const result: string[] = []

  for (const node of Graph.values(topoWalker)) {
    result.push(node.nodeId as string)
  }

  return result
}

/**
 * Generate Mermaid diagram string for debugging/visualization.
 *
 * Node labels use the human-readable label (falling back to nodeId).
 * Edge labels show the routing strategy tag (or 'always' for unconditional).
 */
export const toMermaid = (graph: CompoundGraph): string => {
  return Graph.toMermaid(graph, {
    nodeLabel: (node) => node.label ?? (node.nodeId as string),
    edgeLabel: (edge) => edge.label ?? (edge.routing ? edge.routing._tag : 'always'),
  })
}
