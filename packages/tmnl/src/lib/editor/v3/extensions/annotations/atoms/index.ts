/**
 * Annotation System - Atoms (Materialized Views)
 *
 * Effect-atom reactive state for the annotation system.
 * Components subscribe to these atoms; AnnotationService updates them.
 *
 * Pattern:
 * - Atoms declared at module level (singleton, writable)
 * - Operation atoms use ctx.set() to publish updates
 * - Components call useAtomValue() to subscribe
 *
 * @module editor/v3/extensions/annotations/atoms
 */

import { Atom } from '@effect-atom/atom-react';
import { Layer, Effect, Option } from 'effect';

import {
  AnnotationService,
  AnnotationServiceLive,
  IntentRegistry,
  IntentRegistryLive,
  IntentExecutor,
  IntentExecutorLive,
  AnnotationPopoverService,
  AnnotationPopoverServiceLive,
  AnnotationToolsService,
  AnnotationToolsServiceLive,
  type PopoverAnchor,
  type PopoverPlacement,
  type PopoverTrigger,
  type PopoverContent,
  type CreateAnnotationInput,
  type QueryAnnotationsInput,
} from '../services';
import type { AnnotationQuery, AnnotationState } from '../services';
import type {
  AnnotationId,
  IntentMark,
  AnnotationNode,
  VisualStyle,
  IntentPayload,
  CreationSource,
  DocumentId,
} from '../schemas';

// =============================================================================
// Materialized View Atoms (Module-Level Singletons)
// =============================================================================

/**
 * All Marks Atom
 *
 * Current map of all registered IntentMarks.
 * Updated by service operations.
 */
export const marksAtom = Atom.make<ReadonlyMap<AnnotationId, IntentMark>>(new Map());

/**
 * All Nodes Atom
 *
 * Current map of all registered AnnotationNodes.
 * Updated by service operations.
 */
export const nodesAtom = Atom.make<ReadonlyMap<AnnotationId, AnnotationNode>>(new Map());

/**
 * Active Query Atom
 *
 * Current filter query being applied to marks.
 */
export const activeQueryAtom = Atom.make<AnnotationQuery | null>(null);

/**
 * Filtered Marks Atom
 *
 * Marks matching the active query. Empty = show all.
 */
export const filteredMarkIdsAtom = Atom.make<Set<AnnotationId>>(new Set());

/**
 * Selected Annotation Atom
 *
 * Currently selected/focused annotation (for inspector panel).
 */
export const selectedAnnotationIdAtom = Atom.make<AnnotationId | null>(null);

/**
 * Hovered Annotation Atom
 *
 * Currently hovered annotation (for popover triggers).
 */
export const hoveredAnnotationIdAtom = Atom.make<AnnotationId | null>(null);

/**
 * Visibility Override Map
 *
 * Per-annotation visibility overrides. null = use global visibility.
 */
export const visibilityOverridesAtom = Atom.make<ReadonlyMap<AnnotationId, boolean>>(new Map());

/**
 * Global Visibility Atom
 *
 * Master toggle for annotation visibility.
 */
export const globalVisibilityAtom = Atom.make<boolean>(true);

// =============================================================================
// Derived Atoms (Computed from Materialized Views)
// =============================================================================

/**
 * Mark Count Atom
 */
export const markCountAtom = Atom.make((get) => get(marksAtom).size);

/**
 * Node Count Atom
 */
export const nodeCountAtom = Atom.make((get) => get(nodesAtom).size);

/**
 * Has Marks Atom
 */
export const hasMarksAtom = Atom.make((get) => get(marksAtom).size > 0);

/**
 * Marks Array Atom
 *
 * Convenience: marks as array for iteration.
 */
export const marksArrayAtom = Atom.make((get) => Array.from(get(marksAtom).values()));

/**
 * Nodes Array Atom
 *
 * Convenience: nodes as array for iteration.
 */
export const nodesArrayAtom = Atom.make((get) => Array.from(get(nodesAtom).values()));

/**
 * Selected Mark Atom
 *
 * Full IntentMark object for selected annotation.
 */
export const selectedMarkAtom = Atom.make((get) => {
  const id = get(selectedAnnotationIdAtom);
  if (!id) return null;
  return get(marksAtom).get(id) ?? null;
});

/**
 * Hovered Mark Atom
 *
 * Full IntentMark object for hovered annotation.
 */
export const hoveredMarkAtom = Atom.make((get) => {
  const id = get(hoveredAnnotationIdAtom);
  if (!id) return null;
  return get(marksAtom).get(id) ?? null;
});

/**
 * Visible Mark IDs Atom
 *
 * Set of marks that should be visually rendered.
 * Respects global visibility + per-mark overrides + query filter.
 */
export const visibleMarkIdsAtom = Atom.make((get) => {
  const globalVisible = get(globalVisibilityAtom);
  const marks = get(marksAtom);
  const overrides = get(visibilityOverridesAtom);
  const filtered = get(filteredMarkIdsAtom);
  const hasFilter = filtered.size > 0;

  const visible = new Set<AnnotationId>();

  for (const [id] of marks) {
    // Check override first
    const override = overrides.get(id);
    if (override !== undefined) {
      if (override) visible.add(id);
      continue;
    }

    // Check global + filter
    if (!globalVisible) continue;
    if (hasFilter && !filtered.has(id)) continue;

    visible.add(id);
  }

  return visible;
});

/**
 * Mark Stats Atom
 *
 * Statistics about marks by type.
 */
export const markStatsAtom = Atom.make((get) => {
  const marks = get(marksArrayAtom);

  const byVisualType = new Map<string, number>();
  const byIntentType = new Map<string, number>();
  const byCreatedBy = new Map<string, number>();

  for (const mark of marks) {
    // Visual type
    const vt = mark.visualType;
    byVisualType.set(vt, (byVisualType.get(vt) ?? 0) + 1);

    // Intent type
    const it = mark.intentType;
    byIntentType.set(it, (byIntentType.get(it) ?? 0) + 1);

    // Created by
    const cb = mark.createdBy;
    byCreatedBy.set(cb, (byCreatedBy.get(cb) ?? 0) + 1);
  }

  return { byVisualType, byIntentType, byCreatedBy };
});

// =============================================================================
// Runtime Atom (For Effect Operations)
// =============================================================================

/**
 * Annotation Runtime Atom
 *
 * Provides Effect runtime for annotation operations.
 * Includes all services: AnnotationService, IntentRegistry, IntentExecutor.
 */
export const annotationRuntimeAtom = Atom.runtime(
  Layer.mergeAll(
    AnnotationServiceLive,
    IntentRegistryLive,
    IntentExecutorLive,
    AnnotationPopoverServiceLive,
    AnnotationToolsServiceLive
  )
);

// =============================================================================
// Operation Atoms (Mutations via Effect)
// =============================================================================

/**
 * Sync state from service to atoms
 */
const syncState = (ctx: { set: <T>(atom: Atom.WritableAtom<T>, value: T) => void }) =>
  Effect.gen(function* () {
    const service = yield* AnnotationService;
    const state = yield* service.getState;
    ctx.set(marksAtom, state.marks);
    ctx.set(nodesAtom, state.nodes);
  });

/**
 * Mark Operations
 */
export const markOps = {
  /**
   * Create a new mark
   */
  create: annotationRuntimeAtom.fn<{
    visualStyle: VisualStyle;
    intent: IntentPayload;
    tags?: string[];
    createdBy?: CreationSource;
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* AnnotationService;
      const mark = yield* service.createMark(args);
      yield* syncState(ctx);
      return mark;
    })
  ),

  /**
   * Update an existing mark
   */
  update: annotationRuntimeAtom.fn<{
    id: AnnotationId;
    update: (mark: IntentMark) => IntentMark;
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* AnnotationService;
      const mark = yield* service.updateMark(args.id, args.update);
      yield* syncState(ctx);
      return mark;
    })
  ),

  /**
   * Delete a mark
   */
  delete: annotationRuntimeAtom.fn<{ id: AnnotationId }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* AnnotationService;
      yield* service.deleteMark(args.id);
      yield* syncState(ctx);
    })
  ),

  /**
   * Register an existing mark (from TipTap parse)
   */
  register: annotationRuntimeAtom.fn<{ mark: IntentMark }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* AnnotationService;
      yield* service.registerMark(args.mark);
      yield* syncState(ctx);
    })
  ),

  /**
   * Add reference between marks
   */
  addReference: annotationRuntimeAtom.fn<{
    fromId: AnnotationId;
    toId: AnnotationId;
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* AnnotationService;
      yield* service.addReference(args.fromId, args.toId);
      yield* syncState(ctx);
    })
  ),

  /**
   * Remove reference
   */
  removeReference: annotationRuntimeAtom.fn<{
    fromId: AnnotationId;
    toId: AnnotationId;
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* AnnotationService;
      yield* service.removeReference(args.fromId, args.toId);
      yield* syncState(ctx);
    })
  ),
} as const;

/**
 * Node Operations
 */
export const nodeOps = {
  /**
   * Create a new node
   */
  create: annotationRuntimeAtom.fn<{
    documentId: DocumentId;
    content: unknown;
    title?: string;
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* AnnotationService;
      const node = yield* service.createNode(args);
      yield* syncState(ctx);
      return node;
    })
  ),

  /**
   * Update an existing node
   */
  update: annotationRuntimeAtom.fn<{
    id: AnnotationId;
    update: (node: AnnotationNode) => AnnotationNode;
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* AnnotationService;
      const node = yield* service.updateNode(args.id, args.update);
      yield* syncState(ctx);
      return node;
    })
  ),

  /**
   * Delete a node
   */
  delete: annotationRuntimeAtom.fn<{ id: AnnotationId }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* AnnotationService;
      yield* service.deleteNode(args.id);
      yield* syncState(ctx);
    })
  ),

  /**
   * Register an existing node
   */
  register: annotationRuntimeAtom.fn<{ node: AnnotationNode }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* AnnotationService;
      yield* service.registerNode(args.node);
      yield* syncState(ctx);
    })
  ),
} as const;

/**
 * Query Operations
 */
export const queryOps = {
  /**
   * Apply a filter query
   */
  applyFilter: annotationRuntimeAtom.fn<{ query: AnnotationQuery }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* AnnotationService;
      const matches = yield* service.queryMarks(args.query);
      const matchIds = new Set(matches.map((m) => m.id));

      ctx.set(activeQueryAtom, args.query);
      ctx.set(filteredMarkIdsAtom, matchIds);

      return matches;
    })
  ),

  /**
   * Clear filter
   */
  clearFilter: annotationRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.sync(() => {
      ctx.set(activeQueryAtom, null);
      ctx.set(filteredMarkIdsAtom, new Set());
    })
  ),

  /**
   * Get backlinks for an annotation
   */
  getBacklinks: annotationRuntimeAtom.fn<{ id: AnnotationId }>()(
    (args) =>
      Effect.gen(function* () {
        const service = yield* AnnotationService;
        return yield* service.getBacklinks(args.id);
      })
  ),

  /**
   * Get forward links for an annotation
   */
  getForwardLinks: annotationRuntimeAtom.fn<{ id: AnnotationId }>()(
    (args) =>
      Effect.gen(function* () {
        const service = yield* AnnotationService;
        return yield* service.getForwardLinks(args.id);
      })
  ),
} as const;

/**
 * Visibility Operations
 */
export const visibilityOps = {
  /**
   * Toggle global visibility
   */
  toggleGlobal: () => {
    Atom.set(globalVisibilityAtom, (v) => !v);
  },

  /**
   * Set global visibility
   */
  setGlobal: (visible: boolean) => {
    Atom.set(globalVisibilityAtom, visible);
  },

  /**
   * Override visibility for specific mark
   */
  setOverride: (id: AnnotationId, visible: boolean | null) => {
    Atom.set(visibilityOverridesAtom, (overrides) => {
      const newOverrides = new Map(overrides);
      if (visible === null) {
        newOverrides.delete(id);
      } else {
        newOverrides.set(id, visible);
      }
      return newOverrides;
    });
  },

  /**
   * Clear all overrides
   */
  clearOverrides: () => {
    Atom.set(visibilityOverridesAtom, new Map());
  },

  /**
   * Hide marks matching query
   */
  hideByQuery: annotationRuntimeAtom.fn<{ query: AnnotationQuery }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* AnnotationService;
      const matches = yield* service.queryMarks(args.query);

      ctx.set(visibilityOverridesAtom, (overrides) => {
        const newOverrides = new Map(overrides);
        for (const mark of matches) {
          newOverrides.set(mark.id, false);
        }
        return newOverrides;
      });
    })
  ),

  /**
   * Show marks matching query
   */
  showByQuery: annotationRuntimeAtom.fn<{ query: AnnotationQuery }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* AnnotationService;
      const matches = yield* service.queryMarks(args.query);

      ctx.set(visibilityOverridesAtom, (overrides) => {
        const newOverrides = new Map(overrides);
        for (const mark of matches) {
          newOverrides.set(mark.id, true);
        }
        return newOverrides;
      });
    })
  ),
} as const;

/**
 * Selection Operations (synchronous, no Effect needed)
 */
export const selectionOps = {
  /**
   * Select an annotation
   */
  select: (id: AnnotationId | null) => {
    Atom.set(selectedAnnotationIdAtom, id);
  },

  /**
   * Set hovered annotation
   */
  hover: (id: AnnotationId | null) => {
    Atom.set(hoveredAnnotationIdAtom, id);
  },

  /**
   * Clear selection
   */
  clearSelection: () => {
    Atom.set(selectedAnnotationIdAtom, null);
  },
} as const;

/**
 * Admin Operations
 */
export const adminOps = {
  /**
   * Clear all annotations
   */
  clear: annotationRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.gen(function* () {
      const service = yield* AnnotationService;
      yield* service.clear;
      yield* syncState(ctx);
    })
  ),

  /**
   * Get full state snapshot
   */
  getState: annotationRuntimeAtom.fn<void>()(() =>
    Effect.gen(function* () {
      const service = yield* AnnotationService;
      return yield* service.getState;
    })
  ),
} as const;

/**
 * Intent Operations
 */
export const intentOps = {
  /**
   * Execute an intent by mark ID
   */
  execute: annotationRuntimeAtom.fn<{
    markId: AnnotationId;
    trigger: 'click' | 'hover' | 'keyboard' | 'programmatic';
    event?: MouseEvent | KeyboardEvent;
  }>()((args) =>
    Effect.gen(function* () {
      const executor = yield* IntentExecutor;
      return yield* executor.executeById(args.markId, args.trigger, args.event);
    })
  ),

  /**
   * Register a custom action
   */
  registerAction: annotationRuntimeAtom.fn<{
    key: string;
    name: string;
    description?: string;
    program: (ctx: { annotationId: AnnotationId; params: unknown }) => Effect.Effect<void>;
  }>()((args) =>
    Effect.gen(function* () {
      const registry = yield* IntentRegistry;
      yield* registry.register({
        key: args.key,
        name: args.name,
        description: args.description,
        program: (ctx) => args.program({ annotationId: ctx.annotationId, params: ctx.params }),
      });
    })
  ),

  /**
   * Unregister an action
   */
  unregisterAction: annotationRuntimeAtom.fn<{ key: string }>()((args) =>
    Effect.gen(function* () {
      const registry = yield* IntentRegistry;
      yield* registry.unregister(args.key);
    })
  ),

  /**
   * Get all registered actions
   */
  getRegisteredActions: annotationRuntimeAtom.fn<void>()(() =>
    Effect.gen(function* () {
      const registry = yield* IntentRegistry;
      return yield* registry.getAll;
    })
  ),

  /**
   * Cancel a running intent execution
   */
  cancel: annotationRuntimeAtom.fn<{ markId: AnnotationId }>()((args) =>
    Effect.gen(function* () {
      const executor = yield* IntentExecutor;
      return yield* executor.cancel(args.markId);
    })
  ),

  /**
   * Cancel all running executions
   */
  cancelAll: annotationRuntimeAtom.fn<void>()(() =>
    Effect.gen(function* () {
      const executor = yield* IntentExecutor;
      return yield* executor.cancelAll;
    })
  ),
} as const;

// =============================================================================
// Popover Atoms (Materialized Views)
// =============================================================================

/**
 * Active Popover State Atom
 *
 * Current popover state (if any). Updated by popoverOps.
 */
export const activePopoverAtom = Atom.make<{
  annotationId: AnnotationId;
  markId: AnnotationId;
  placement: PopoverPlacement;
  trigger: PopoverTrigger;
  isPinned: boolean;
} | null>(null);

/**
 * Popover Content Atom
 *
 * Content for the active popover. Derived from active popover + service.
 */
export const popoverContentAtom = Atom.make<PopoverContent | null>(null);

/**
 * Is Popover Open Atom
 *
 * Whether any popover is currently open.
 */
export const isPopoverOpenAtom = Atom.make((get) => get(activePopoverAtom) !== null);

// =============================================================================
// Popover Operations
// =============================================================================

/**
 * Popover Operations
 */
export const popoverOps = {
  /**
   * Show a popover for an annotation
   */
  show: annotationRuntimeAtom.fn<{
    annotationId: AnnotationId;
    markId: AnnotationId;
    anchor: PopoverAnchor;
    placement?: PopoverPlacement;
    trigger?: PopoverTrigger;
    isPinned?: boolean;
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const popoverService = yield* AnnotationPopoverService;
      yield* popoverService.show(args);

      // Get content and update atoms
      const content = yield* popoverService.getContent;

      ctx.set(activePopoverAtom, {
        annotationId: args.annotationId,
        markId: args.markId,
        placement: args.placement ?? 'top',
        trigger: args.trigger ?? 'click',
        isPinned: args.isPinned ?? false,
      });

      if (Option.isSome(content)) {
        ctx.set(popoverContentAtom, content.value);
      }
    })
  ),

  /**
   * Hide the active popover
   */
  hide: annotationRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.gen(function* () {
      const popoverService = yield* AnnotationPopoverService;
      yield* popoverService.hide;

      ctx.set(activePopoverAtom, null);
      ctx.set(popoverContentAtom, null);
    })
  ),

  /**
   * Toggle popover for an annotation
   */
  toggle: annotationRuntimeAtom.fn<{
    annotationId: AnnotationId;
    markId: AnnotationId;
    anchor: PopoverAnchor;
    placement?: PopoverPlacement;
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const popoverService = yield* AnnotationPopoverService;
      const current = yield* popoverService.getActive;

      if (Option.isSome(current) && current.value.annotationId === args.annotationId) {
        yield* popoverService.hide;
        ctx.set(activePopoverAtom, null);
        ctx.set(popoverContentAtom, null);
      } else {
        yield* popoverService.show(args);
        const content = yield* popoverService.getContent;

        ctx.set(activePopoverAtom, {
          annotationId: args.annotationId,
          markId: args.markId,
          placement: args.placement ?? 'top',
          trigger: 'click',
          isPinned: false,
        });

        if (Option.isSome(content)) {
          ctx.set(popoverContentAtom, content.value);
        }
      }
    })
  ),

  /**
   * Pin the active popover
   */
  pin: annotationRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.gen(function* () {
      const popoverService = yield* AnnotationPopoverService;
      yield* popoverService.pin;

      ctx.set(activePopoverAtom, (prev) =>
        prev ? { ...prev, isPinned: true } : null
      );
    })
  ),

  /**
   * Unpin the active popover
   */
  unpin: annotationRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.gen(function* () {
      const popoverService = yield* AnnotationPopoverService;
      yield* popoverService.unpin;

      ctx.set(activePopoverAtom, (prev) =>
        prev ? { ...prev, isPinned: false } : null
      );
    })
  ),

  /**
   * Update popover anchor position
   */
  updateAnchor: annotationRuntimeAtom.fn<{ anchor: PopoverAnchor }>()((args) =>
    Effect.gen(function* () {
      const popoverService = yield* AnnotationPopoverService;
      yield* popoverService.updateAnchor(args.anchor);
    })
  ),
} as const;

// =============================================================================
// Tool Operations (Agent-Facing Interface)
// =============================================================================

/**
 * Tool Operations for AI Agent Access
 *
 * These operations provide a clean interface for AI agents to
 * interact with the annotation system programmatically.
 */
export const toolOps = {
  /**
   * Create a new annotation (agent)
   *
   * @example
   * await toolOps.create({
   *   editor,
   *   input: {
   *     text: 'highlighted text',
   *     intent: { _tag: 'Note', content: 'My note' },
   *     visualStyle: 'highlight',
   *     tags: ['important']
   *   }
   * })
   */
  create: annotationRuntimeAtom.fn<{
    editor: import('@tiptap/core').Editor;
    input: CreateAnnotationInput;
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const tools = yield* AnnotationToolsService;
      const id = yield* tools.createAnnotation(args.editor, args.input);
      yield* syncState(ctx);
      return id;
    })
  ),

  /**
   * Remove an annotation (agent)
   */
  remove: annotationRuntimeAtom.fn<{
    editor: import('@tiptap/core').Editor;
    annotationId: AnnotationId;
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const tools = yield* AnnotationToolsService;
      yield* tools.removeAnnotation(args.editor, args.annotationId);
      yield* syncState(ctx);
    })
  ),

  /**
   * Query annotations with filters
   */
  query: annotationRuntimeAtom.fn<{ query: QueryAnnotationsInput }>()((args) =>
    Effect.gen(function* () {
      const tools = yield* AnnotationToolsService;
      return yield* tools.queryAnnotations(args.query);
    })
  ),

  /**
   * Get all annotations (simplified for agents)
   */
  getAll: annotationRuntimeAtom.fn<void>()(() =>
    Effect.gen(function* () {
      const tools = yield* AnnotationToolsService;
      return yield* tools.getAllAnnotations;
    })
  ),

  /**
   * Get single annotation by ID
   */
  get: annotationRuntimeAtom.fn<{ annotationId: AnnotationId }>()((args) =>
    Effect.gen(function* () {
      const tools = yield* AnnotationToolsService;
      return yield* tools.getAnnotation(args.annotationId);
    })
  ),

  /**
   * Update annotation tags
   */
  updateTags: annotationRuntimeAtom.fn<{
    annotationId: AnnotationId;
    tags: readonly string[];
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const tools = yield* AnnotationToolsService;
      yield* tools.updateTags(args.annotationId, args.tags);
      yield* syncState(ctx);
    })
  ),

  /**
   * Get annotation statistics
   */
  getStats: annotationRuntimeAtom.fn<void>()(() =>
    Effect.gen(function* () {
      const tools = yield* AnnotationToolsService;
      return yield* tools.getStats;
    })
  ),

  /**
   * Bulk create annotations
   */
  bulkCreate: annotationRuntimeAtom.fn<{
    editor: import('@tiptap/core').Editor;
    inputs: readonly CreateAnnotationInput[];
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const tools = yield* AnnotationToolsService;
      const ids = yield* tools.bulkCreate(args.editor, args.inputs);
      yield* syncState(ctx);
      return ids;
    })
  ),

  /**
   * Bulk remove annotations
   */
  bulkRemove: annotationRuntimeAtom.fn<{
    editor: import('@tiptap/core').Editor;
    annotationIds: readonly AnnotationId[];
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const tools = yield* AnnotationToolsService;
      yield* tools.bulkRemove(args.editor, args.annotationIds);
      yield* syncState(ctx);
    })
  ),

  /**
   * Search annotations by text
   */
  findByText: annotationRuntimeAtom.fn<{
    searchText: string;
    options?: { caseSensitive?: boolean; regex?: boolean };
  }>()((args) =>
    Effect.gen(function* () {
      const tools = yield* AnnotationToolsService;
      return yield* tools.findByText(args.searchText, args.options);
    })
  ),

  /**
   * Get annotations at a document position
   */
  getAtPosition: annotationRuntimeAtom.fn<{
    editor: import('@tiptap/core').Editor;
    position: number;
  }>()((args) =>
    Effect.gen(function* () {
      const tools = yield* AnnotationToolsService;
      return yield* tools.getAtPosition(args.editor, args.position);
    })
  ),

  /**
   * Execute an intent programmatically
   */
  executeIntent: annotationRuntimeAtom.fn<{
    editor: import('@tiptap/core').Editor;
    markId: AnnotationId;
    trigger: 'click' | 'hover' | 'keyboard';
  }>()((args) =>
    Effect.gen(function* () {
      const tools = yield* AnnotationToolsService;
      yield* tools.executeIntent(args.editor, args.markId, args.trigger);
    })
  ),
} as const;
