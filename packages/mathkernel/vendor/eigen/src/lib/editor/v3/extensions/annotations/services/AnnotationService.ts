/**
 * AnnotationService
 *
 * Effect.Service for managing annotations (IntentMarks + AnnotationNodes).
 * Provides CRUD operations, querying, and graph traversal.
 *
 * @module editor/v3/extensions/annotations/services/AnnotationService
 */

import { Effect, Context, Layer, Ref, Option, Array as Arr, pipe } from 'effect';
import {
  type AnnotationId,
  type DocumentId,
  type VisualStyle,
  type VisualStyleType,
  type CreationSource,
  IntentMark,
  IntentMarkFactory,
  AnnotationNode,
  AnnotationNodeFactory,
  AnnotationNotFound,
  AnnotationNodeNotFound,
  type IntentPayload,
} from '../schemas';

// =============================================================================
// Query Types
// =============================================================================

/**
 * Filter criteria for querying annotations
 */
export interface AnnotationQuery {
  /** Filter by document */
  readonly documentId?: DocumentId;

  /** Filter by visual style type */
  readonly visualType?: VisualStyleType | VisualStyleType[];

  /** Filter by intent type (_tag) */
  readonly intentType?: string | string[];

  /** Filter by tags (any match) */
  readonly tags?: string[];

  /** Filter by tags (all must match) */
  readonly tagsAll?: string[];

  /** Filter by creation source */
  readonly createdBy?: CreationSource | CreationSource[];

  /** Include only marks with references */
  readonly hasReferences?: boolean;

  /** Include only marks referencing specific annotation */
  readonly referencesId?: AnnotationId;
}

/**
 * Annotation state snapshot
 */
export interface AnnotationState {
  readonly marks: ReadonlyMap<AnnotationId, IntentMark>;
  readonly nodes: ReadonlyMap<AnnotationId, AnnotationNode>;
}

// =============================================================================
// Service Interface
// =============================================================================

export interface AnnotationServiceShape {
  // ===== Mark Operations =====

  /**
   * Create a new IntentMark
   */
  readonly createMark: (config: {
    visualStyle: VisualStyle;
    intent: IntentPayload;
    tags?: string[];
    createdBy?: CreationSource;
  }) => Effect.Effect<IntentMark>;

  /**
   * Get a mark by ID
   */
  readonly getMark: (id: AnnotationId) => Effect.Effect<IntentMark, AnnotationNotFound>;

  /**
   * Get a mark by ID (returns Option)
   */
  readonly findMark: (id: AnnotationId) => Effect.Effect<Option.Option<IntentMark>>;

  /**
   * Update an existing mark
   */
  readonly updateMark: (
    id: AnnotationId,
    update: (mark: IntentMark) => IntentMark
  ) => Effect.Effect<IntentMark, AnnotationNotFound>;

  /**
   * Delete a mark
   */
  readonly deleteMark: (id: AnnotationId) => Effect.Effect<void, AnnotationNotFound>;

  /**
   * Query marks by criteria
   */
  readonly queryMarks: (query: AnnotationQuery) => Effect.Effect<readonly IntentMark[]>;

  /**
   * Get all marks
   */
  readonly getAllMarks: Effect.Effect<readonly IntentMark[]>;

  // ===== Node Operations =====

  /**
   * Create a new AnnotationNode (hidden content container)
   */
  readonly createNode: (config: {
    documentId: DocumentId;
    content: unknown;
    title?: string;
  }) => Effect.Effect<AnnotationNode>;

  /**
   * Get a node by ID
   */
  readonly getNode: (id: AnnotationId) => Effect.Effect<AnnotationNode, AnnotationNodeNotFound>;

  /**
   * Get a node by ID (returns Option)
   */
  readonly findNode: (id: AnnotationId) => Effect.Effect<Option.Option<AnnotationNode>>;

  /**
   * Update an existing node
   */
  readonly updateNode: (
    id: AnnotationId,
    update: (node: AnnotationNode) => AnnotationNode
  ) => Effect.Effect<AnnotationNode, AnnotationNodeNotFound>;

  /**
   * Delete a node
   */
  readonly deleteNode: (id: AnnotationId) => Effect.Effect<void, AnnotationNodeNotFound>;

  /**
   * Get all nodes for a document
   */
  readonly getNodesForDocument: (documentId: DocumentId) => Effect.Effect<readonly AnnotationNode[]>;

  /**
   * Get all nodes
   */
  readonly getAllNodes: Effect.Effect<readonly AnnotationNode[]>;

  // ===== Graph Operations =====

  /**
   * Add a reference from one annotation to another
   */
  readonly addReference: (
    fromId: AnnotationId,
    toId: AnnotationId
  ) => Effect.Effect<IntentMark, AnnotationNotFound>;

  /**
   * Remove a reference
   */
  readonly removeReference: (
    fromId: AnnotationId,
    toId: AnnotationId
  ) => Effect.Effect<IntentMark, AnnotationNotFound>;

  /**
   * Get marks that reference a given annotation
   */
  readonly getBacklinks: (id: AnnotationId) => Effect.Effect<readonly IntentMark[]>;

  /**
   * Get marks that a given annotation references
   */
  readonly getForwardLinks: (id: AnnotationId) => Effect.Effect<readonly IntentMark[], AnnotationNotFound>;

  // ===== Bulk Operations =====

  /**
   * Register a mark (typically called by TipTap extension on parse)
   */
  readonly registerMark: (mark: IntentMark) => Effect.Effect<void>;

  /**
   * Register a node
   */
  readonly registerNode: (node: AnnotationNode) => Effect.Effect<void>;

  /**
   * Clear all annotations (for testing/reset)
   */
  readonly clear: Effect.Effect<void>;

  /**
   * Get full state snapshot
   */
  readonly getState: Effect.Effect<AnnotationState>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class AnnotationService extends Context.Tag('tmnl/editor/AnnotationService')<
  AnnotationService,
  AnnotationServiceShape
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const makeAnnotationService = Effect.gen(function* () {
  // Internal state using Effect.Ref
  const marksRef = yield* Ref.make<ReadonlyMap<AnnotationId, IntentMark>>(new Map());
  const nodesRef = yield* Ref.make<ReadonlyMap<AnnotationId, AnnotationNode>>(new Map());

  // ===== Helper Functions =====

  const matchesQuery = (mark: IntentMark, query: AnnotationQuery): boolean => {
    // Visual type filter
    if (query.visualType) {
      const types = Array.isArray(query.visualType) ? query.visualType : [query.visualType];
      if (!types.includes(mark.visualType as VisualStyleType)) return false;
    }

    // Intent type filter
    if (query.intentType) {
      const types = Array.isArray(query.intentType) ? query.intentType : [query.intentType];
      if (!types.includes(mark.intentType)) return false;
    }

    // Tags filter (any match)
    if (query.tags && query.tags.length > 0) {
      const hasAny = query.tags.some((t) => mark.tags.includes(t));
      if (!hasAny) return false;
    }

    // Tags all filter
    if (query.tagsAll && query.tagsAll.length > 0) {
      const hasAll = query.tagsAll.every((t) => mark.tags.includes(t));
      if (!hasAll) return false;
    }

    // CreatedBy filter
    if (query.createdBy) {
      const sources = Array.isArray(query.createdBy) ? query.createdBy : [query.createdBy];
      if (!sources.includes(mark.createdBy)) return false;
    }

    // Has references filter
    if (query.hasReferences !== undefined) {
      if (query.hasReferences !== mark.hasReferences) return false;
    }

    // References specific ID filter
    if (query.referencesId) {
      const refs = Option.getOrElse(mark.references, () => [] as AnnotationId[]);
      if (!refs.includes(query.referencesId)) return false;
    }

    return true;
  };

  // ===== Mark Operations =====

  const createMark: AnnotationServiceShape['createMark'] = (config) =>
    Effect.gen(function* () {
      const mark = IntentMarkFactory.fromConfig({
        visualStyle: config.visualStyle,
        intent: config.intent,
        tags: config.tags,
        createdBy: config.createdBy,
      });

      yield* Ref.update(marksRef, (marks) => {
        const newMarks = new Map(marks);
        newMarks.set(mark.id, mark);
        return newMarks;
      });

      return mark;
    });

  const getMark: AnnotationServiceShape['getMark'] = (id) =>
    Effect.gen(function* () {
      const marks = yield* Ref.get(marksRef);
      const mark = marks.get(id);

      if (!mark) {
        return yield* Effect.fail(AnnotationNotFound.of(id));
      }

      return mark;
    });

  const findMark: AnnotationServiceShape['findMark'] = (id) =>
    Effect.gen(function* () {
      const marks = yield* Ref.get(marksRef);
      return Option.fromNullable(marks.get(id));
    });

  const updateMark: AnnotationServiceShape['updateMark'] = (id, update) =>
    Effect.gen(function* () {
      const marks = yield* Ref.get(marksRef);
      const existing = marks.get(id);

      if (!existing) {
        return yield* Effect.fail(AnnotationNotFound.of(id));
      }

      const updated = update(existing);

      yield* Ref.update(marksRef, (m) => {
        const newMarks = new Map(m);
        newMarks.set(id, updated);
        return newMarks;
      });

      return updated;
    });

  const deleteMark: AnnotationServiceShape['deleteMark'] = (id) =>
    Effect.gen(function* () {
      const marks = yield* Ref.get(marksRef);

      if (!marks.has(id)) {
        return yield* Effect.fail(AnnotationNotFound.of(id));
      }

      yield* Ref.update(marksRef, (m) => {
        const newMarks = new Map(m);
        newMarks.delete(id);
        return newMarks;
      });
    });

  const queryMarks: AnnotationServiceShape['queryMarks'] = (query) =>
    Effect.gen(function* () {
      const marks = yield* Ref.get(marksRef);
      return pipe(
        Array.from(marks.values()),
        Arr.filter((mark) => matchesQuery(mark, query))
      );
    });

  const getAllMarks: AnnotationServiceShape['getAllMarks'] = Effect.gen(function* () {
    const marks = yield* Ref.get(marksRef);
    return Array.from(marks.values());
  });

  // ===== Node Operations =====

  const createNode: AnnotationServiceShape['createNode'] = (config) =>
    Effect.gen(function* () {
      const node = AnnotationNodeFactory.withContent(
        config.documentId,
        config.content,
        config.title
      );

      yield* Ref.update(nodesRef, (nodes) => {
        const newNodes = new Map(nodes);
        newNodes.set(node.id, node);
        return newNodes;
      });

      return node;
    });

  const getNode: AnnotationServiceShape['getNode'] = (id) =>
    Effect.gen(function* () {
      const nodes = yield* Ref.get(nodesRef);
      const node = nodes.get(id);

      if (!node) {
        return yield* Effect.fail(AnnotationNodeNotFound.of(id));
      }

      return node;
    });

  const findNode: AnnotationServiceShape['findNode'] = (id) =>
    Effect.gen(function* () {
      const nodes = yield* Ref.get(nodesRef);
      return Option.fromNullable(nodes.get(id));
    });

  const updateNode: AnnotationServiceShape['updateNode'] = (id, update) =>
    Effect.gen(function* () {
      const nodes = yield* Ref.get(nodesRef);
      const existing = nodes.get(id);

      if (!existing) {
        return yield* Effect.fail(AnnotationNodeNotFound.of(id));
      }

      const updated = update(existing);

      yield* Ref.update(nodesRef, (n) => {
        const newNodes = new Map(n);
        newNodes.set(id, updated);
        return newNodes;
      });

      return updated;
    });

  const deleteNode: AnnotationServiceShape['deleteNode'] = (id) =>
    Effect.gen(function* () {
      const nodes = yield* Ref.get(nodesRef);

      if (!nodes.has(id)) {
        return yield* Effect.fail(AnnotationNodeNotFound.of(id));
      }

      yield* Ref.update(nodesRef, (n) => {
        const newNodes = new Map(n);
        newNodes.delete(id);
        return newNodes;
      });
    });

  const getNodesForDocument: AnnotationServiceShape['getNodesForDocument'] = (documentId) =>
    Effect.gen(function* () {
      const nodes = yield* Ref.get(nodesRef);
      return pipe(
        Array.from(nodes.values()),
        Arr.filter((node) => node.documentId === documentId)
      );
    });

  const getAllNodes: AnnotationServiceShape['getAllNodes'] = Effect.gen(function* () {
    const nodes = yield* Ref.get(nodesRef);
    return Array.from(nodes.values());
  });

  // ===== Graph Operations =====

  const addReference: AnnotationServiceShape['addReference'] = (fromId, toId) =>
    updateMark(fromId, (mark) => mark.withReference(toId));

  const removeReference: AnnotationServiceShape['removeReference'] = (fromId, toId) =>
    updateMark(fromId, (mark) => mark.withoutReference(toId));

  const getBacklinks: AnnotationServiceShape['getBacklinks'] = (id) =>
    queryMarks({ referencesId: id });

  const getForwardLinks: AnnotationServiceShape['getForwardLinks'] = (id) =>
    Effect.gen(function* () {
      const mark = yield* getMark(id);
      const refs = Option.getOrElse(mark.references, () => [] as AnnotationId[]);

      const results: IntentMark[] = [];
      for (const refId of refs) {
        const refMark = yield* findMark(refId);
        if (Option.isSome(refMark)) {
          results.push(refMark.value);
        }
      }

      return results;
    });

  // ===== Bulk Operations =====

  const registerMark: AnnotationServiceShape['registerMark'] = (mark) =>
    Ref.update(marksRef, (marks) => {
      const newMarks = new Map(marks);
      newMarks.set(mark.id, mark);
      return newMarks;
    });

  const registerNode: AnnotationServiceShape['registerNode'] = (node) =>
    Ref.update(nodesRef, (nodes) => {
      const newNodes = new Map(nodes);
      newNodes.set(node.id, node);
      return newNodes;
    });

  const clear: AnnotationServiceShape['clear'] = Effect.gen(function* () {
    yield* Ref.set(marksRef, new Map());
    yield* Ref.set(nodesRef, new Map());
  });

  const getState: AnnotationServiceShape['getState'] = Effect.gen(function* () {
    const marks = yield* Ref.get(marksRef);
    const nodes = yield* Ref.get(nodesRef);
    return { marks, nodes };
  });

  // ===== Return Service Shape =====

  return {
    createMark,
    getMark,
    findMark,
    updateMark,
    deleteMark,
    queryMarks,
    getAllMarks,

    createNode,
    getNode,
    findNode,
    updateNode,
    deleteNode,
    getNodesForDocument,
    getAllNodes,

    addReference,
    removeReference,
    getBacklinks,
    getForwardLinks,

    registerMark,
    registerNode,
    clear,
    getState,
  } satisfies AnnotationServiceShape;
});

// =============================================================================
// Layer
// =============================================================================

export const AnnotationServiceLive = Layer.effect(AnnotationService, makeAnnotationService);

export default AnnotationService;
