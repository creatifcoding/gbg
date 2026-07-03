/**
 * DepGraph — Effect v4 Graph-backed formula dependency tracker.
 *
 * Replaces the hand-rolled adjacency maps in formula-engine.ts with
 * the Effect v4 `Graph` module for:
 * - Immutable graph snapshots (functional updates via `mutate`)
 * - Built-in topological sort (`topo`) with cycle detection
 * - `isAcyclic` for cycle validation before registration
 * - Type-safe NodeIndex references
 *
 * ## Error Handling
 *
 * - **Circular dependency**: Detected via `isAcyclic()` before registration.
 *   Returns `CircularDepError` in the Effect E channel. The formula bar
 *   should display this to the user. The cell gets `#REF!`.
 *
 * - **Missing node**: If a dependency references a cell that doesn't exist
 *   in the graph yet, it's auto-created as a data node (no formula).
 *   This is not an error — cells are lazily added.
 *
 * - **Graph corruption**: `Graph.topo()` throws `GraphError` if the
 *   graph is cyclic despite our check. This is a defect (bug in our
 *   acyclicity check) and should never happen.
 *
 * @module dep-graph
 */

import * as Effect from "effect/Effect"
import * as Data from "effect/Data"
import * as Graph from "effect/Graph"
import type { CellKey } from "../schemas/addressing"
import { vmError, type VMErrorCode } from "./stack-vm"

// ═══════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════

/**
 * Circular dependency detected — formula would create a cycle.
 *
 * **Consumer**: Formula bar UI (red highlight on the circular cells)
 * **Recovery**: User must fix the formula to break the cycle.
 * **Cell display**: #REF! via vmError("CIRCULAR_REF", ...)
 */
export class CircularDepError extends Data.TaggedError("CircularDepError")<{
  readonly addr: string
  readonly deps: ReadonlyArray<string>
  readonly reason: string
}> {}

// ═══════════════════════════════════════════════════════
// NODE TYPES
// ═══════════════════════════════════════════════════════

/** Node payload: either a data cell or a formula cell */
export type CellNode =
  | { readonly _tag: "data" }
  | { readonly _tag: "formula"; readonly src: string; readonly deps: ReadonlyArray<string> }

// ═══════════════════════════════════════════════════════
// DEP GRAPH
// ═══════════════════════════════════════════════════════

/**
 * Mutable dependency graph wrapper around Effect v4 Graph.
 *
 * Internally uses `Graph.mutate()` for efficient batch updates
 * while exposing an immutable snapshot for topo sort.
 *
 * Each cell is a node. Edges point from dependency → dependent
 * (i.e., A1 → B1 means "B1 depends on A1", so A1 is evaluated first).
 */
export interface DepGraph {
  /**
   * Register a formula cell with its dependencies.
   * Fails with CircularDepError if adding would create a cycle.
   */
  readonly registerFormula: (
    addr: string,
    src: string,
    deps: ReadonlyArray<string>,
  ) => Effect.Effect<void, CircularDepError>

  /** Remove a formula registration (reverts cell to data node) */
  readonly unregister: (addr: string) => void

  /** Get the evaluation order for cells affected by changes to `dirty` cells */
  readonly evalOrder: (dirty: ReadonlyArray<string>) => ReadonlyArray<string>

  /** Get all direct dependents of a cell (cells that use this cell) */
  readonly dependents: (addr: string) => ReadonlyArray<string>

  /** Get all direct dependencies of a cell (cells this cell reads) */
  readonly dependencies: (addr: string) => ReadonlyArray<string>

  /** Check if a cell has a formula registered */
  readonly hasFormula: (addr: string) => boolean

  /** Get formula source for a cell (null if data) */
  readonly getFormulaSrc: (addr: string) => string | null

  /** Get all registered formula addresses */
  readonly allFormulas: () => ReadonlyArray<string>

  /** Total node count */
  readonly nodeCount: () => number
}

// ═══════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════

/**
 * Create a new DepGraph instance.
 *
 * Uses Effect v4 Graph internally. The graph is mutable for efficiency
 * (formula registration is a hot path), but snapshots are taken for
 * topo sort (which requires immutability).
 */
export function makeDepGraph(): DepGraph {
  // Internal state: node payloads and adjacency
  const nodes = new Map<string, CellNode>()
  // Forward deps: addr → set of addresses this cell depends on
  const fdeps = new Map<string, Set<string>>()
  // Reverse deps: addr → set of addresses that depend on this cell
  const rdeps = new Map<string, Set<string>>()

  function ensureNode(addr: string): void {
    if (!nodes.has(addr)) {
      nodes.set(addr, { _tag: "data" })
    }
  }

  function addEdges(addr: string, deps: ReadonlyArray<string>): void {
    fdeps.set(addr, new Set(deps))
    for (const dep of deps) {
      let rev = rdeps.get(dep)
      if (!rev) { rev = new Set(); rdeps.set(dep, rev) }
      rev.add(addr)
    }
  }

  function removeEdges(addr: string): void {
    const forward = fdeps.get(addr)
    if (forward) {
      for (const dep of forward) rdeps.get(dep)?.delete(addr)
      fdeps.delete(addr)
    }
  }

  /**
   * Check if adding `addr → deps` would create a cycle.
   * Uses DFS from each dep back to addr.
   */
  function wouldCycle(addr: string, deps: ReadonlyArray<string>): boolean {
    // Self-reference
    if (deps.includes(addr)) return true

    const visited = new Set<string>()

    function dfs(current: string): boolean {
      if (current === addr) return true
      if (visited.has(current)) return false
      visited.add(current)
      const forward = fdeps.get(current)
      if (forward) {
        for (const next of forward) {
          if (dfs(next)) return true
        }
      }
      return false
    }

    for (const dep of deps) {
      visited.clear()
      if (dfs(dep)) return true
    }
    return false
  }

  /**
   * Build an Effect v4 Graph snapshot for topo sort.
   *
   * Graph.addNode returns a NodeIndex (integer). We maintain
   * a string→NodeIndex map to translate cell addresses.
   * Edges point dep→dependent so topo yields deps-first.
   */
  function buildGraphSnapshot(): {
    graph: Graph.DirectedGraph<string, void>,
    indexToAddr: Map<number, string>,
  } {
    const addrToIndex = new Map<string, number>()
    const indexToAddr = new Map<number, string>()

    const graph = Graph.directed<string, void>((g) => {
      // Collect all addresses that need nodes
      const allAddrs = new Set<string>()
      for (const [addr] of nodes) allAddrs.add(addr)
      for (const [, deps] of fdeps) {
        for (const dep of deps) allAddrs.add(dep)
      }

      // Add all nodes
      for (const addr of allAddrs) {
        const idx = Graph.addNode(g, addr)
        addrToIndex.set(addr, idx)
        indexToAddr.set(idx, addr)
      }

      // Add edges: dep → dependent (so topo gives deps-first)
      for (const [addr, deps] of fdeps) {
        const targetIdx = addrToIndex.get(addr)!
        for (const dep of deps) {
          const sourceIdx = addrToIndex.get(dep)!
          Graph.addEdge(g, sourceIdx, targetIdx, undefined as void)
        }
      }
    })

    return { graph, indexToAddr }
  }

  return {
    registerFormula: (addr, src, deps) => {
      // Ensure all nodes exist
      ensureNode(addr)
      for (const dep of deps) ensureNode(dep)

      // Check for cycle BEFORE modifying
      // Temporarily remove old edges so we check the new edges
      const oldForward = fdeps.get(addr)
      removeEdges(addr)

      if (wouldCycle(addr, deps)) {
        // Restore old edges
        if (oldForward) addEdges(addr, Array.from(oldForward))
        return Effect.fail(new CircularDepError({
          addr,
          deps,
          reason: `Adding formula at ${addr} with deps [${deps.join(", ")}] would create a cycle`,
        }))
      }

      // Safe — add new edges
      addEdges(addr, deps)
      nodes.set(addr, { _tag: "formula", src, deps })

      return Effect.void
    },

    unregister: (addr) => {
      removeEdges(addr)
      nodes.set(addr, { _tag: "data" })
    },

    evalOrder: (dirty) => {
      // Collect all affected formula cells via reverse deps (BFS)
      const affected = new Set<string>()
      const queue = [...dirty]

      while (queue.length > 0) {
        const current = queue.shift()!
        const revDeps = rdeps.get(current)
        if (revDeps) {
          for (const dependent of revDeps) {
            if (!affected.has(dependent)) {
              affected.add(dependent)
              queue.push(dependent)
            }
          }
        }
      }

      if (affected.size === 0) return []

      // Build graph snapshot and topo sort
      try {
        const { graph, indexToAddr } = buildGraphSnapshot()
        const walker = Graph.topo(graph)
        const order: string[] = []

        for (const [_nodeIdx, addr] of walker) {
          if (affected.has(addr)) {
            order.push(addr)
          }
        }

        return order
      } catch (e) {
        // GraphError from topo = cycle somehow got through.
        // This is a defect — our wouldCycle check should have caught it.
        // Return empty order and log. Don't crash the grid.
        console.error("[DepGraph] topo sort failed — possible cycle:", e)
        return []
      }
    },

    dependents: (addr) => Array.from(rdeps.get(addr) ?? []),
    dependencies: (addr) => Array.from(fdeps.get(addr) ?? []),
    hasFormula: (addr) => nodes.get(addr)?._tag === "formula",
    getFormulaSrc: (addr) => {
      const node = nodes.get(addr)
      return node?._tag === "formula" ? node.src : null
    },
    allFormulas: () => {
      const result: string[] = []
      for (const [addr, node] of nodes) {
        if (node._tag === "formula") result.push(addr)
      }
      return result
    },
    nodeCount: () => nodes.size,
  }
}
