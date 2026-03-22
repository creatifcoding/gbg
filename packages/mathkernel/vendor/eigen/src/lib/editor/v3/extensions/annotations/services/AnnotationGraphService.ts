/**
 * AnnotationGraphService
 *
 * Graph-based annotation relationship tracking using Effect's Graph module.
 * Provides traversal, backlink computation, and reactive graph updates via PubSub.
 *
 * @module editor/v3/extensions/annotations/services/AnnotationGraphService
 */

import { Context, Effect, Layer, Ref, Option, PubSub, Queue, Scope, HashMap, HashSet, pipe } from 'effect';
import * as Graph from 'effect/Graph';

import type { AnnotationId, IntentMark } from '../schemas';
import { AnnotationService } from './AnnotationService';

// =============================================================================
// Graph Event Types
// =============================================================================

/**
 * Events emitted when the annotation graph changes
 */
export type GraphEvent =
  | { readonly _tag: 'NodeAdded'; readonly id: AnnotationId }
  | { readonly _tag: 'NodeRemoved'; readonly id: AnnotationId }
  | { readonly _tag: 'EdgeAdded'; readonly from: AnnotationId; readonly to: AnnotationId }
  | { readonly _tag: 'EdgeRemoved'; readonly from: AnnotationId; readonly to: AnnotationId }
  | { readonly _tag: 'GraphCleared' }
  | { readonly _tag: 'GraphRebuilt'; readonly nodeCount: number; readonly edgeCount: number };

// =============================================================================
// Graph Query Types
// =============================================================================

export interface TraversalResult {
  readonly visited: readonly AnnotationId[];
  readonly depth: HashMap.HashMap<AnnotationId, number>;
}

export interface PathResult {
  readonly path: readonly AnnotationId[];
  readonly distance: number;
}

export interface ComponentResult {
  readonly components: readonly (readonly AnnotationId[])[];
  readonly componentOf: HashMap.HashMap<AnnotationId, number>;
}

export interface GraphStats {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly orphanCount: number;
  readonly leafCount: number;
  readonly maxDepth: number;
  readonly componentCount: number;
}

// =============================================================================
// Service Shape
// =============================================================================

export interface AnnotationGraphServiceShape {
  // ===== Graph Building =====

  /**
   * Rebuild the graph from current annotation state
   */
  readonly rebuild: Effect.Effect<void>;

  /**
   * Add a node to the graph
   */
  readonly addNode: (id: AnnotationId) => Effect.Effect<void>;

  /**
   * Remove a node and all its edges
   */
  readonly removeNode: (id: AnnotationId) => Effect.Effect<void>;

  /**
   * Add a directed edge (reference) between annotations
   */
  readonly addEdge: (from: AnnotationId, to: AnnotationId) => Effect.Effect<void>;

  /**
   * Remove an edge
   */
  readonly removeEdge: (from: AnnotationId, to: AnnotationId) => Effect.Effect<void>;

  // ===== Traversal =====

  /**
   * Breadth-first traversal from a starting node
   */
  readonly bfs: (
    startId: AnnotationId,
    direction?: 'outgoing' | 'incoming'
  ) => Effect.Effect<TraversalResult, AnnotationNotInGraph>;

  /**
   * Depth-first traversal from a starting node
   */
  readonly dfs: (
    startId: AnnotationId,
    direction?: 'outgoing' | 'incoming'
  ) => Effect.Effect<TraversalResult, AnnotationNotInGraph>;

  /**
   * Get all nodes reachable from a starting node
   */
  readonly reachableFrom: (
    startId: AnnotationId,
    direction?: 'outgoing' | 'incoming'
  ) => Effect.Effect<HashSet.HashSet<AnnotationId>, AnnotationNotInGraph>;

  // ===== Path Finding =====

  /**
   * Find shortest path between two annotations
   */
  readonly shortestPath: (
    from: AnnotationId,
    to: AnnotationId
  ) => Effect.Effect<Option.Option<PathResult>, AnnotationNotInGraph>;

  /**
   * Check if there's a path between two annotations
   */
  readonly hasPath: (
    from: AnnotationId,
    to: AnnotationId
  ) => Effect.Effect<boolean, AnnotationNotInGraph>;

  // ===== Backlinks =====

  /**
   * Get all annotations that reference a given annotation (incoming edges)
   */
  readonly getBacklinks: (id: AnnotationId) => Effect.Effect<readonly AnnotationId[]>;

  /**
   * Get all annotations referenced by a given annotation (outgoing edges)
   */
  readonly getForwardLinks: (id: AnnotationId) => Effect.Effect<readonly AnnotationId[]>;

  /**
   * Get bidirectional neighbors (both incoming and outgoing)
   */
  readonly getNeighbors: (id: AnnotationId) => Effect.Effect<{
    readonly incoming: readonly AnnotationId[];
    readonly outgoing: readonly AnnotationId[];
  }>;

  // ===== Components =====

  /**
   * Find strongly connected components in the graph
   */
  readonly getComponents: Effect.Effect<ComponentResult>;

  /**
   * Get orphan nodes (no incoming or outgoing edges)
   */
  readonly getOrphans: Effect.Effect<readonly AnnotationId[]>;

  /**
   * Get leaf nodes (no outgoing edges)
   */
  readonly getLeaves: Effect.Effect<readonly AnnotationId[]>;

  /**
   * Get root nodes (no incoming edges)
   */
  readonly getRoots: Effect.Effect<readonly AnnotationId[]>;

  // ===== Analysis =====

  /**
   * Get graph statistics
   */
  readonly getStats: Effect.Effect<GraphStats>;

  /**
   * Check if graph contains cycles
   */
  readonly hasCycles: Effect.Effect<boolean>;

  /**
   * Get common ancestors of two annotations
   */
  readonly commonAncestors: (
    id1: AnnotationId,
    id2: AnnotationId
  ) => Effect.Effect<readonly AnnotationId[], AnnotationNotInGraph>;

  // ===== Reactive =====

  /**
   * Subscribe to graph change events
   */
  readonly subscribe: Effect.Effect<Queue.Dequeue<GraphEvent>, never, Scope.Scope>;

  /**
   * Get the current graph snapshot
   */
  readonly getSnapshot: Effect.Effect<{
    readonly nodes: readonly AnnotationId[];
    readonly edges: readonly { from: AnnotationId; to: AnnotationId }[];
  }>;
}

// =============================================================================
// Error Types
// =============================================================================

export class AnnotationNotInGraph {
  readonly _tag = 'AnnotationNotInGraph';
  constructor(readonly id: AnnotationId) {}
}

// =============================================================================
// Service Tag
// =============================================================================

export class AnnotationGraphService extends Context.Tag('tmnl/editor/AnnotationGraphService')<
  AnnotationGraphService,
  AnnotationGraphServiceShape
>() {}

// =============================================================================
// Internal State Types
// =============================================================================

interface GraphState {
  // Effect.Graph for traversal algorithms
  graph: Graph.Graph<AnnotationId, void>;
  // HashMap for O(1) ID → node index lookup
  idToIndex: HashMap.HashMap<AnnotationId, number>;
  // Reverse mapping: index → ID
  indexToId: HashMap.HashMap<number, AnnotationId>;
  // Edge count for stats
  edgeCount: number;
}

// =============================================================================
// Service Implementation
// =============================================================================

const makeAnnotationGraphService = Effect.gen(function* () {
  const annotationService = yield* AnnotationService;

  // Internal state
  const stateRef = yield* Ref.make<GraphState>({
    graph: Graph.directed<AnnotationId, void>(() => {}),
    idToIndex: HashMap.empty(),
    indexToId: HashMap.empty(),
    edgeCount: 0,
  });

  // PubSub for reactive updates (capacity 100)
  const eventsPubSub = yield* PubSub.bounded<GraphEvent>(100);

  // ===== Helper Functions =====

  const publishEvent = (event: GraphEvent) =>
    PubSub.publish(eventsPubSub, event);

  const getNodeIndex = (state: GraphState, id: AnnotationId): Option.Option<number> =>
    HashMap.get(state.idToIndex, id);

  const buildGraphFromMarks = (marks: ReadonlyMap<AnnotationId, IntentMark>): GraphState => {
    let idToIndex = HashMap.empty<AnnotationId, number>();
    let indexToId = HashMap.empty<number, AnnotationId>();
    let edgeCount = 0;

    // Build the graph using mutable builder
    const graph = Graph.directed<AnnotationId, void>((mutable) => {
      // First pass: add all nodes
      let index = 0;
      for (const [id] of marks) {
        Graph.addNode(mutable, id);
        idToIndex = HashMap.set(idToIndex, id, index);
        indexToId = HashMap.set(indexToId, index, id);
        index++;
      }

      // Second pass: add edges from references
      for (const [, mark] of marks) {
        const refs = Option.getOrElse(mark.references, () => [] as AnnotationId[]);
        for (const refId of refs) {
          // Only add edge if target exists
          if (marks.has(refId)) {
            const fromIdx = Option.getOrElse(HashMap.get(idToIndex, mark.id), () => -1);
            const toIdx = Option.getOrElse(HashMap.get(idToIndex, refId), () => -1);
            if (fromIdx >= 0 && toIdx >= 0) {
              Graph.addEdge(mutable, fromIdx, toIdx, undefined);
              edgeCount++;
            }
          }
        }
      }
    });

    return { graph, idToIndex, indexToId, edgeCount };
  };

  // ===== Service Implementation =====

  const rebuild: Effect.Effect<void> = Effect.gen(function* () {
    const marks = yield* annotationService.getAllMarks;
    const marksMap = new Map(marks.map((m) => [m.id, m]));
    const newState = buildGraphFromMarks(marksMap);

    yield* Ref.set(stateRef, newState);
    yield* publishEvent({
      _tag: 'GraphRebuilt',
      nodeCount: HashMap.size(newState.idToIndex),
      edgeCount: newState.edgeCount,
    });
  });

  const addNode = (id: AnnotationId): Effect.Effect<void> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef);

      // Skip if already exists
      if (Option.isSome(HashMap.get(state.idToIndex, id))) {
        return;
      }

      // Add to graph (rebuild approach since Graph is immutable)
      const newIndex = HashMap.size(state.idToIndex);
      const newGraph = Graph.directed<AnnotationId, void>((mutable) => {
        // Copy existing nodes
        for (const [existingId] of state.idToIndex) {
          Graph.addNode(mutable, existingId);
        }
        // Add new node
        Graph.addNode(mutable, id);

        // Copy existing edges
        const nodeCount = HashMap.size(state.idToIndex);
        for (let i = 0; i < nodeCount; i++) {
          const neighbors = Graph.neighborsDirected(state.graph, i, 'outgoing');
          for (const neighborIdx of Graph.indices(neighbors)) {
            Graph.addEdge(mutable, i, neighborIdx, undefined);
          }
        }
      });

      yield* Ref.set(stateRef, {
        ...state,
        graph: newGraph,
        idToIndex: HashMap.set(state.idToIndex, id, newIndex),
        indexToId: HashMap.set(state.indexToId, newIndex, id),
      });

      yield* publishEvent({ _tag: 'NodeAdded', id });
    });

  const removeNode = (id: AnnotationId): Effect.Effect<void> =>
    Effect.gen(function* () {
      // Simplest approach: rebuild without this node
      yield* rebuild;
      yield* publishEvent({ _tag: 'NodeRemoved', id });
    });

  const addEdge = (from: AnnotationId, to: AnnotationId): Effect.Effect<void> =>
    Effect.gen(function* () {
      // For now, trigger rebuild to add edge
      // In production, would mutate graph directly if API allows
      yield* rebuild;
      yield* publishEvent({ _tag: 'EdgeAdded', from, to });
    });

  const removeEdge = (from: AnnotationId, to: AnnotationId): Effect.Effect<void> =>
    Effect.gen(function* () {
      yield* rebuild;
      yield* publishEvent({ _tag: 'EdgeRemoved', from, to });
    });

  const bfs = (
    startId: AnnotationId,
    direction: 'outgoing' | 'incoming' = 'outgoing'
  ): Effect.Effect<TraversalResult, AnnotationNotInGraph> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef);
      const startIdx = getNodeIndex(state, startId);

      if (Option.isNone(startIdx)) {
        return yield* Effect.fail(new AnnotationNotInGraph(startId));
      }

      const walker = Graph.bfs(state.graph, [Option.getOrThrow(startIdx)], direction);
      const visited: AnnotationId[] = [];
      let depth = HashMap.empty<AnnotationId, number>();
      let currentDepth = 0;

      for (const idx of Graph.indices(walker)) {
        const id = HashMap.get(state.indexToId, idx);
        if (Option.isSome(id)) {
          const annotationId = Option.getOrThrow(id);
          visited.push(annotationId);
          depth = HashMap.set(depth, annotationId, currentDepth);
        }
        currentDepth++;
      }

      return { visited, depth };
    });

  const dfs = (
    startId: AnnotationId,
    direction: 'outgoing' | 'incoming' = 'outgoing'
  ): Effect.Effect<TraversalResult, AnnotationNotInGraph> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef);
      const startIdx = getNodeIndex(state, startId);

      if (Option.isNone(startIdx)) {
        return yield* Effect.fail(new AnnotationNotInGraph(startId));
      }

      const walker = Graph.dfs(state.graph, [Option.getOrThrow(startIdx)], direction);
      const visited: AnnotationId[] = [];
      let depth = HashMap.empty<AnnotationId, number>();
      let currentDepth = 0;

      for (const idx of Graph.indices(walker)) {
        const id = HashMap.get(state.indexToId, idx);
        if (Option.isSome(id)) {
          const annotationId = Option.getOrThrow(id);
          visited.push(annotationId);
          depth = HashMap.set(depth, annotationId, currentDepth);
        }
        currentDepth++;
      }

      return { visited, depth };
    });

  const reachableFrom = (
    startId: AnnotationId,
    direction: 'outgoing' | 'incoming' = 'outgoing'
  ): Effect.Effect<HashSet.HashSet<AnnotationId>, AnnotationNotInGraph> =>
    Effect.gen(function* () {
      const result = yield* bfs(startId, direction);
      return HashSet.fromIterable(result.visited);
    });

  const shortestPath = (
    from: AnnotationId,
    to: AnnotationId
  ): Effect.Effect<Option.Option<PathResult>, AnnotationNotInGraph> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef);
      const fromIdx = getNodeIndex(state, from);
      const toIdx = getNodeIndex(state, to);

      if (Option.isNone(fromIdx)) {
        return yield* Effect.fail(new AnnotationNotInGraph(from));
      }
      if (Option.isNone(toIdx)) {
        return yield* Effect.fail(new AnnotationNotInGraph(to));
      }

      // Use BFS to find shortest path (unweighted)
      const startIdx = Option.getOrThrow(fromIdx);
      const endIdx = Option.getOrThrow(toIdx);

      // Manual BFS with path tracking
      const visited = new Set<number>();
      const queue: { idx: number; path: number[] }[] = [{ idx: startIdx, path: [startIdx] }];
      visited.add(startIdx);

      while (queue.length > 0) {
        const current = queue.shift()!;

        if (current.idx === endIdx) {
          // Convert indices to IDs
          const path: AnnotationId[] = [];
          for (const idx of current.path) {
            const id = HashMap.get(state.indexToId, idx);
            if (Option.isSome(id)) {
              path.push(Option.getOrThrow(id));
            }
          }
          return Option.some({ path, distance: path.length - 1 });
        }

        const neighbors = Graph.neighborsDirected(state.graph, current.idx, 'outgoing');
        for (const neighborIdx of Graph.indices(neighbors)) {
          if (!visited.has(neighborIdx)) {
            visited.add(neighborIdx);
            queue.push({ idx: neighborIdx, path: [...current.path, neighborIdx] });
          }
        }
      }

      return Option.none();
    });

  const hasPath = (
    from: AnnotationId,
    to: AnnotationId
  ): Effect.Effect<boolean, AnnotationNotInGraph> =>
    Effect.gen(function* () {
      const result = yield* shortestPath(from, to);
      return Option.isSome(result);
    });

  const getBacklinks = (id: AnnotationId): Effect.Effect<readonly AnnotationId[]> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef);
      const idx = getNodeIndex(state, id);

      if (Option.isNone(idx)) {
        return [];
      }

      const neighbors = Graph.neighborsDirected(state.graph, Option.getOrThrow(idx), 'incoming');
      const backlinks: AnnotationId[] = [];

      for (const neighborIdx of Graph.indices(neighbors)) {
        const neighborId = HashMap.get(state.indexToId, neighborIdx);
        if (Option.isSome(neighborId)) {
          backlinks.push(Option.getOrThrow(neighborId));
        }
      }

      return backlinks;
    });

  const getForwardLinks = (id: AnnotationId): Effect.Effect<readonly AnnotationId[]> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef);
      const idx = getNodeIndex(state, id);

      if (Option.isNone(idx)) {
        return [];
      }

      const neighbors = Graph.neighborsDirected(state.graph, Option.getOrThrow(idx), 'outgoing');
      const forwardLinks: AnnotationId[] = [];

      for (const neighborIdx of Graph.indices(neighbors)) {
        const neighborId = HashMap.get(state.indexToId, neighborIdx);
        if (Option.isSome(neighborId)) {
          forwardLinks.push(Option.getOrThrow(neighborId));
        }
      }

      return forwardLinks;
    });

  const getNeighbors = (id: AnnotationId) =>
    Effect.gen(function* () {
      const incoming = yield* getBacklinks(id);
      const outgoing = yield* getForwardLinks(id);
      return { incoming, outgoing };
    });

  const getComponents: Effect.Effect<ComponentResult> = Effect.gen(function* () {
    const state = yield* Ref.get(stateRef);
    const sccs = Graph.stronglyConnectedComponents(state.graph);

    const components: AnnotationId[][] = [];
    let componentOf = HashMap.empty<AnnotationId, number>();

    let componentIndex = 0;
    for (const scc of sccs) {
      const component: AnnotationId[] = [];
      for (const idx of scc) {
        const id = HashMap.get(state.indexToId, idx);
        if (Option.isSome(id)) {
          const annotationId = Option.getOrThrow(id);
          component.push(annotationId);
          componentOf = HashMap.set(componentOf, annotationId, componentIndex);
        }
      }
      if (component.length > 0) {
        components.push(component);
        componentIndex++;
      }
    }

    return { components, componentOf };
  });

  const getOrphans: Effect.Effect<readonly AnnotationId[]> = Effect.gen(function* () {
    const state = yield* Ref.get(stateRef);
    const orphans: AnnotationId[] = [];

    for (const [id, idx] of state.idToIndex) {
      const incoming = Graph.neighborsDirected(state.graph, idx, 'incoming');
      const outgoing = Graph.neighborsDirected(state.graph, idx, 'outgoing');

      let hasIncoming = false;
      let hasOutgoing = false;

      for (const _ of Graph.indices(incoming)) {
        hasIncoming = true;
        break;
      }
      for (const _ of Graph.indices(outgoing)) {
        hasOutgoing = true;
        break;
      }

      if (!hasIncoming && !hasOutgoing) {
        orphans.push(id);
      }
    }

    return orphans;
  });

  const getLeaves: Effect.Effect<readonly AnnotationId[]> = Effect.gen(function* () {
    const state = yield* Ref.get(stateRef);
    const leaves: AnnotationId[] = [];

    for (const [id, idx] of state.idToIndex) {
      const outgoing = Graph.neighborsDirected(state.graph, idx, 'outgoing');

      let hasOutgoing = false;
      for (const _ of Graph.indices(outgoing)) {
        hasOutgoing = true;
        break;
      }

      if (!hasOutgoing) {
        leaves.push(id);
      }
    }

    return leaves;
  });

  const getRoots: Effect.Effect<readonly AnnotationId[]> = Effect.gen(function* () {
    const state = yield* Ref.get(stateRef);
    const roots: AnnotationId[] = [];

    for (const [id, idx] of state.idToIndex) {
      const incoming = Graph.neighborsDirected(state.graph, idx, 'incoming');

      let hasIncoming = false;
      for (const _ of Graph.indices(incoming)) {
        hasIncoming = true;
        break;
      }

      if (!hasIncoming) {
        roots.push(id);
      }
    }

    return roots;
  });

  const getStats: Effect.Effect<GraphStats> = Effect.gen(function* () {
    const state = yield* Ref.get(stateRef);
    const orphans = yield* getOrphans;
    const leaves = yield* getLeaves;
    const components = yield* getComponents;

    // Calculate max depth via BFS from roots
    const roots = yield* getRoots;
    let maxDepth = 0;

    for (const rootId of roots) {
      const result = yield* bfs(rootId, 'outgoing').pipe(Effect.orElseSucceed(() => ({ visited: [], depth: HashMap.empty() })));
      for (const [, d] of result.depth) {
        if (d > maxDepth) maxDepth = d;
      }
    }

    return {
      nodeCount: HashMap.size(state.idToIndex),
      edgeCount: state.edgeCount,
      orphanCount: orphans.length,
      leafCount: leaves.length,
      maxDepth,
      componentCount: components.components.length,
    };
  });

  const hasCycles: Effect.Effect<boolean> = Effect.gen(function* () {
    const components = yield* getComponents;
    // If any strongly connected component has more than 1 node, there's a cycle
    return components.components.some((c) => c.length > 1);
  });

  const commonAncestors = (
    id1: AnnotationId,
    id2: AnnotationId
  ): Effect.Effect<readonly AnnotationId[], AnnotationNotInGraph> =>
    Effect.gen(function* () {
      // Get all ancestors (reachable via incoming edges) for both nodes
      const ancestors1 = yield* reachableFrom(id1, 'incoming');
      const ancestors2 = yield* reachableFrom(id2, 'incoming');

      // Find intersection
      const common: AnnotationId[] = [];
      for (const ancestor of ancestors1) {
        if (HashSet.has(ancestors2, ancestor)) {
          common.push(ancestor);
        }
      }

      return common;
    });

  const subscribe: Effect.Effect<Queue.Dequeue<GraphEvent>, never, Scope.Scope> =
    PubSub.subscribe(eventsPubSub);

  const getSnapshot: Effect.Effect<{
    readonly nodes: readonly AnnotationId[];
    readonly edges: readonly { from: AnnotationId; to: AnnotationId }[];
  }> = Effect.gen(function* () {
    const state = yield* Ref.get(stateRef);

    const nodes: AnnotationId[] = [];
    for (const [id] of state.idToIndex) {
      nodes.push(id);
    }

    const edges: { from: AnnotationId; to: AnnotationId }[] = [];
    for (const [fromId, fromIdx] of state.idToIndex) {
      const neighbors = Graph.neighborsDirected(state.graph, fromIdx, 'outgoing');
      for (const toIdx of Graph.indices(neighbors)) {
        const toId = HashMap.get(state.indexToId, toIdx);
        if (Option.isSome(toId)) {
          edges.push({ from: fromId, to: Option.getOrThrow(toId) });
        }
      }
    }

    return { nodes, edges };
  });

  // Return service shape
  return {
    rebuild,
    addNode,
    removeNode,
    addEdge,
    removeEdge,
    bfs,
    dfs,
    reachableFrom,
    shortestPath,
    hasPath,
    getBacklinks,
    getForwardLinks,
    getNeighbors,
    getComponents,
    getOrphans,
    getLeaves,
    getRoots,
    getStats,
    hasCycles,
    commonAncestors,
    subscribe,
    getSnapshot,
  } satisfies AnnotationGraphServiceShape;
});

// =============================================================================
// Service Layer
// =============================================================================

export const AnnotationGraphServiceLive = Layer.effect(
  AnnotationGraphService,
  makeAnnotationGraphService
);

export default AnnotationGraphService;
