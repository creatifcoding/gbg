/**
 * BFTA — Bottom-Up Finite Tree Automaton for genifer component validation
 *
 * Implements incremental tree validation per research-tree-grammars.md §5.
 *
 * Architecture:
 *   Grammar layer — Effect Graph.directed for specification
 *     - Nodes: component types (ranked alphabet Σ)
 *     - Edges: parent→child constraints (transition rules Δ)
 *     - Graph.isAcyclic for DAG check at catalog-time
 *     - Graph.toMermaid for visualization
 *     - Graph.neighbors for allowed-children lookup
 *
 *   Validator layer — plain JS Map/Set for hot-path runtime
 *     - O(1) per node validation
 *     - Compiled from Grammar at construction time
 *     - Runs incrementally alongside d2ts streaming parser
 *
 * Validation runs bottom-up:
 *   1. Leaf identified → apply leaf rule → state q_leaf
 *   2. Container closes → apply transition rule → state q_container or q_dead
 *   3. Root closes → check root state ∈ Qf
 *
 * @module genifer/streaming/bfta
 */

import { Graph, HashMap, HashSet, Option, pipe } from 'effect'

// =============================================================================
// Types
// =============================================================================

/** Automaton state for a validated node */
export type BFTAState = {
  readonly componentType: string
  readonly accepted: boolean
  readonly reason?: string
  readonly depth: number
}

/** Node data in the grammar graph */
export type ComponentNode = {
  readonly type: string
  readonly isLeaf: boolean
  /** Whether this component requires at least one child */
  readonly requiresChildren: boolean
}

/** Edge data: parent→child constraint label */
export type ConstraintEdge = {
  readonly label: string
}

/** Validation result for a single node */
export type ValidationResult = {
  readonly componentType: string
  readonly elementKey: string | undefined
  readonly depth: number
  readonly accepted: boolean
  readonly reason?: string
  readonly childStates: readonly BFTAState[]
}

/** Callbacks from the BFTA validator */
export type BFTACallbacks = {
  onValidated: (result: ValidationResult) => void
  onUnknownType?: (componentType: string, depth: number) => void
}

// =============================================================================
// Component Registration (input shape from DomainCatalog)
// =============================================================================

export type ComponentRegistration = {
  readonly type: string
  readonly hasChildren: boolean
  /** Explicit constraint: which child types are allowed. Omit = any. */
  readonly allowedChildren?: readonly string[]
  /** Whether this component requires at least one child */
  readonly requiresChildren?: boolean
}

// =============================================================================
// Grammar (Effect Graph.directed)
// =============================================================================

export type Grammar = {
  /** The directed constraint graph: nodes=types, edges=parent→allowed-child */
  readonly graph: Graph.DirectedGraph<ComponentNode, ConstraintEdge>
  /** Node index lookup by type name */
  readonly nodeIndex: HashMap.HashMap<string, number>
  /** All registered types (ranked alphabet Σ) */
  readonly alphabet: HashSet.HashSet<string>
  /** Leaf types (arity 0) */
  readonly leaves: HashSet.HashSet<string>
  /** Types that accept any child (unconstrained containers) */
  readonly wildcardParents: HashSet.HashSet<string>
}

/**
 * Build a grammar from component registrations using Effect Graph.
 *
 * Each registration becomes a node. Parent→child constraints become edges.
 * Types with allowedChildren=undefined become wildcard parents (accept any).
 * Types with hasChildren=false become leaves (accept none).
 */
export function buildGrammar(registrations: readonly ComponentRegistration[]): Grammar {
  const indexLookup = new Map<string, number>()
  let leaves = HashSet.empty<string>()
  let wildcardParents = HashSet.empty<string>()
  let alphabet = HashSet.empty<string>()

  const graph = Graph.directed<ComponentNode, ConstraintEdge>((mutable) => {
    // Phase 1: Add all types as nodes
    for (const reg of registrations) {
      alphabet = HashSet.add(alphabet, reg.type)

      const nodeIdx = Graph.addNode(mutable, {
        type: reg.type,
        isLeaf: !reg.hasChildren,
        requiresChildren: reg.requiresChildren ?? false,
      })
      indexLookup.set(reg.type, nodeIdx)

      if (!reg.hasChildren) {
        leaves = HashSet.add(leaves, reg.type)
      } else if (!reg.allowedChildren || reg.allowedChildren.length === 0) {
        wildcardParents = HashSet.add(wildcardParents, reg.type)
      }
    }

    // Phase 2: Add constraint edges (parent → allowed child)
    for (const reg of registrations) {
      if (reg.hasChildren && reg.allowedChildren && reg.allowedChildren.length > 0) {
        const parentIdx = indexLookup.get(reg.type)!
        for (const childType of reg.allowedChildren) {
          const childIdx = indexLookup.get(childType)
          if (childIdx !== undefined) {
            Graph.addEdge(mutable, parentIdx, childIdx, {
              label: `${reg.type} accepts ${childType}`,
            })
          }
        }
      }
    }
  })

  return {
    graph,
    nodeIndex: HashMap.fromIterable(indexLookup),
    alphabet,
    leaves,
    wildcardParents,
  }
}

/**
 * Check if the grammar's constraint graph is acyclic.
 * Cyclic constraints (A requires B, B requires A) are contradictory.
 */
export function isConstraintDAG(grammar: Grammar): boolean {
  return Graph.isAcyclic(grammar.graph)
}

/**
 * Check if the grammar's language is empty.
 *
 * Algorithm from [COMON-TATA2007 §1.5.1]:
 * Mark states bottom-up. A state is accessible if it's a leaf,
 * or a container whose children are accessible.
 * L(A) ≠ ∅ iff some type is accessible.
 */
export function isLanguageEmpty(grammar: Grammar): boolean {
  const accessible = new Set<string>()

  // Phase 1: All leaves are immediately accessible
  for (const leaf of HashSet.values(grammar.leaves)) {
    accessible.add(leaf)
  }

  // Phase 2: Wildcard parents are accessible if any type is
  // (or if they don't require children)
  for (const wp of HashSet.values(grammar.wildcardParents)) {
    const node = pipe(
      HashMap.get(grammar.nodeIndex, wp),
      Option.flatMap((idx) => Graph.getNode(grammar.graph, idx)),
    )
    const requiresChildren = Option.isSome(node) ? node.value.requiresChildren : false
    if (!requiresChildren || accessible.size > 0) {
      accessible.add(wp)
    }
  }

  // Phase 3: Fixed point — constrained containers
  let changed = true
  while (changed) {
    changed = false
    for (const type of HashSet.values(grammar.alphabet)) {
      if (accessible.has(type)) continue

      const nodeIdxOpt = HashMap.get(grammar.nodeIndex, type)
      if (Option.isNone(nodeIdxOpt)) continue
      const nodeIdx = nodeIdxOpt.value

      const nodeOpt = Graph.getNode(grammar.graph, nodeIdx)
      if (Option.isNone(nodeOpt)) continue
      const node = nodeOpt.value

      if (node.isLeaf) continue // already handled

      // Check if at least one allowed child is accessible
      const childIndices = Graph.neighbors(grammar.graph, nodeIdx)
      if (childIndices.length === 0) continue // no constraint edges = wildcard, handled above

      const hasAccessibleChild = childIndices.some((childIdx) => {
        const childNode = Graph.getNode(grammar.graph, childIdx)
        return Option.isSome(childNode) && accessible.has(childNode.value.type)
      })

      if (hasAccessibleChild || !node.requiresChildren) {
        accessible.add(type)
        changed = true
      }
    }
  }

  return accessible.size === 0
}

/**
 * Export grammar as Mermaid diagram for visualization.
 */
export function grammarToMermaid(grammar: Grammar): string {
  return Graph.toMermaid(grammar.graph, {
    nodeLabel: (node) => {
      const suffix = node.isLeaf ? ' (leaf)' : ''
      return `${node.type}${suffix}`
    },
    edgeLabel: (edge) => edge.label,
  })
}

// =============================================================================
// Compiled Validator (hot-path runtime)
// =============================================================================

type CompiledRule = {
  readonly isLeaf: boolean
  readonly requiresChildren: boolean
  /** undefined = wildcard (any child), Set = constrained */
  readonly allowedChildren: ReadonlySet<string> | undefined
}

/**
 * Compile a grammar into a fast lookup table for runtime validation.
 * Called once at grammar construction, not per-token.
 */
function compileGrammar(grammar: Grammar): Map<string, CompiledRule> {
  const rules = new Map<string, CompiledRule>()

  for (const type of HashSet.values(grammar.alphabet)) {
    const nodeIdxOpt = HashMap.get(grammar.nodeIndex, type)
    if (Option.isNone(nodeIdxOpt)) continue
    const nodeIdx = nodeIdxOpt.value

    const nodeOpt = Graph.getNode(grammar.graph, nodeIdx)
    if (Option.isNone(nodeOpt)) continue
    const node = nodeOpt.value

    if (node.isLeaf) {
      rules.set(type, { isLeaf: true, requiresChildren: false, allowedChildren: new Set() })
    } else if (HashSet.has(grammar.wildcardParents, type)) {
      rules.set(type, { isLeaf: false, requiresChildren: node.requiresChildren, allowedChildren: undefined })
    } else {
      // Constrained: collect allowed children from graph edges
      const childIndices = Graph.neighbors(grammar.graph, nodeIdx)
      const allowed = new Set<string>()
      for (const childIdx of childIndices) {
        const childNode = Graph.getNode(grammar.graph, childIdx)
        if (Option.isSome(childNode)) {
          allowed.add(childNode.value.type)
        }
      }
      rules.set(type, { isLeaf: false, requiresChildren: node.requiresChildren, allowedChildren: allowed })
    }
  }

  return rules
}

// =============================================================================
// BFTA Validator (Runtime — Stage 4b)
// =============================================================================

/**
 * Creates a BFTA validator that runs incrementally during streaming.
 *
 * The grammar is compiled once into a fast lookup table.
 * Each pushNode/popNode is O(1).
 *
 * Usage (called by streaming graph):
 *   validator.pushNode('Grid', 'grid-1', 1)
 *   validator.pushNode('Text', 'text-1', 2)
 *   validator.popNode(2)   // Text closes → leaf validated
 *   validator.popNode(1)   // Grid closes → children validated
 */
export function createBFTAValidator(grammar: Grammar, callbacks: BFTACallbacks) {
  const rules = compileGrammar(grammar)

  // Stack of open nodes at each depth
  const openNodes = new Map<
    number,
    { componentType: string; elementKey: string | undefined; childStates: BFTAState[] }
  >()

  return {
    pushNode(componentType: string, elementKey: string | undefined, depth: number) {
      if (!HashSet.has(grammar.alphabet, componentType)) {
        callbacks.onUnknownType?.(componentType, depth)
      }
      openNodes.set(depth, { componentType, elementKey, childStates: [] })
    },

    popNode(depth: number): BFTAState {
      const node = openNodes.get(depth)
      if (!node) {
        return { componentType: 'unknown', accepted: false, reason: 'No open node at depth', depth }
      }
      openNodes.delete(depth)

      const rule = rules.get(node.componentType)
      let accepted = true
      let reason: string | undefined

      if (!rule) {
        // Unknown type — accept gracefully with warning
        accepted = true
        reason = `Unknown type: ${node.componentType} (not in grammar)`
      } else if (rule.isLeaf) {
        if (node.childStates.length > 0) {
          accepted = false
          reason = `${node.componentType} is a leaf but has ${node.childStates.length} children`
        }
      } else if (rule.requiresChildren && node.childStates.length === 0) {
        accepted = false
        reason = `${node.componentType} requires at least one child`
      } else if (rule.allowedChildren !== undefined) {
        // Constrained parent — check each child
        for (const child of node.childStates) {
          if (!rule.allowedChildren.has(child.componentType)) {
            accepted = false
            reason = `${node.componentType} does not accept ${child.componentType} (allowed: ${Array.from(rule.allowedChildren).join(', ')})`
            break
          }
        }
      }
      // allowedChildren === undefined → wildcard, any child accepted

      const state: BFTAState = { componentType: node.componentType, accepted, reason, depth }

      callbacks.onValidated({
        componentType: node.componentType,
        elementKey: node.elementKey,
        depth,
        accepted,
        reason,
        childStates: node.childStates,
      })

      // Register as child of parent
      const parent = openNodes.get(depth - 1)
      if (parent) {
        parent.childStates.push(state)
      }

      return state
    },

    reset() {
      openNodes.clear()
    },

    get hasOpenNodes(): boolean {
      return openNodes.size > 0
    },
  }
}
