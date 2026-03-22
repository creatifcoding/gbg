/**
 * AnnotationToolsService
 *
 * Agent-facing service for annotation operations.
 * Provides a clean, composable interface for AI agents to:
 * - Create and manage annotations
 * - Query and filter marks/nodes
 * - Navigate annotation graph
 * - Execute intents programmatically
 *
 * @module editor/v3/extensions/annotations/services/AnnotationToolsService
 */

import { Effect, Context, Layer, Option, Schema, Array as Arr, pipe } from 'effect';
import type { Editor } from '@tiptap/core';

import { AnnotationService } from './AnnotationService';
import { IntentExecutor } from './IntentExecutor';
import { IntentRegistry } from './IntentRegistry';
import type {
  AnnotationId,
  IntentMark,
  AnnotationNode,
  Intent,
  VisualStyle,
  VisualEffect,
  TmnlColorToken,
} from '../schemas';

// =============================================================================
// Tool Schemas
// =============================================================================

/**
 * Create annotation input
 */
export const CreateAnnotationInput = Schema.Struct({
  /** Text content to annotate (used to find range) */
  text: Schema.String,

  /** Intent to apply */
  intent: Schema.Union(
    // Hyperlink
    Schema.Struct({
      _tag: Schema.Literal('Hyperlink'),
      href: Schema.String,
      label: Schema.optional(Schema.String),
    }),
    // Ultralink (internal document reference)
    Schema.Struct({
      _tag: Schema.Literal('Ultralink'),
      documentId: Schema.String,
      anchorId: Schema.optional(Schema.String),
      label: Schema.optional(Schema.String),
    }),
    // Popover (hover content)
    Schema.Struct({
      _tag: Schema.Literal('Popover'),
      title: Schema.String,
      content: Schema.optional(Schema.String),
    }),
    // Note (attached comment)
    Schema.Struct({
      _tag: Schema.Literal('Note'),
      content: Schema.String,
    }),
    // Citation
    Schema.Struct({
      _tag: Schema.Literal('Citation'),
      sourceId: Schema.String,
      author: Schema.optional(Schema.String),
      pageOrLocation: Schema.optional(Schema.String),
    }),
    // Action (button/trigger)
    Schema.Struct({
      _tag: Schema.Literal('Action'),
      actionId: Schema.String,
      label: Schema.optional(Schema.String),
    })
  ),

  /** Optional visual style override */
  visualStyle: Schema.optional(
    Schema.Literal('highlight', 'pill', 'squiggle', 'underline', 'none')
  ),

  /** Optional color override */
  color: Schema.optional(Schema.String),

  /** Optional tags for categorization */
  tags: Schema.optional(Schema.Array(Schema.String)),
});
export type CreateAnnotationInput = typeof CreateAnnotationInput.Type;

/**
 * Query annotations input
 */
export const QueryAnnotationsInput = Schema.Struct({
  /** Filter by intent type */
  intentType: Schema.optional(
    Schema.Array(
      Schema.Literal('Hyperlink', 'Ultralink', 'Popover', 'Action', 'Citation', 'Note')
    )
  ),

  /** Filter by tags (AND logic) */
  tags: Schema.optional(Schema.Array(Schema.String)),

  /** Filter by visual style */
  visualStyle: Schema.optional(
    Schema.Array(Schema.Literal('highlight', 'pill', 'squiggle', 'underline', 'none'))
  ),

  /** Filter by created by */
  createdBy: Schema.optional(Schema.Literal('user', 'agent', 'system')),

  /** Limit results */
  limit: Schema.optional(Schema.Number),

  /** Offset for pagination */
  offset: Schema.optional(Schema.Number),
});
export type QueryAnnotationsInput = typeof QueryAnnotationsInput.Type;

/**
 * Annotation result (simplified for agent consumption)
 */
export const AnnotationResult = Schema.Struct({
  id: Schema.String,
  markId: Schema.String,
  intentType: Schema.String,
  text: Schema.String,
  visualStyle: Schema.String,
  color: Schema.optional(Schema.String),
  tags: Schema.Array(Schema.String),
  createdBy: Schema.String,
  createdAt: Schema.Number,
  /** Additional intent-specific data */
  intentData: Schema.optional(Schema.Unknown),
  /** Whether there's an associated node */
  hasNode: Schema.Boolean,
  /** Node title if exists */
  nodeTitle: Schema.optional(Schema.String),
});
export type AnnotationResult = typeof AnnotationResult.Type;

// =============================================================================
// Service Interface
// =============================================================================

export interface AnnotationToolsServiceShape {
  /**
   * Create a new annotation at the specified text
   * Returns the created annotation ID
   */
  readonly createAnnotation: (
    editor: Editor,
    input: CreateAnnotationInput
  ) => Effect.Effect<AnnotationId, Error>;

  /**
   * Remove an annotation by ID
   */
  readonly removeAnnotation: (
    editor: Editor,
    annotationId: AnnotationId
  ) => Effect.Effect<void, Error>;

  /**
   * Query annotations with filters
   */
  readonly queryAnnotations: (
    query: QueryAnnotationsInput
  ) => Effect.Effect<readonly AnnotationResult[]>;

  /**
   * Get all annotations (simplified)
   */
  readonly getAllAnnotations: Effect.Effect<readonly AnnotationResult[]>;

  /**
   * Get annotation by ID
   */
  readonly getAnnotation: (
    annotationId: AnnotationId
  ) => Effect.Effect<Option.Option<AnnotationResult>>;

  /**
   * Update annotation tags
   */
  readonly updateTags: (
    annotationId: AnnotationId,
    tags: readonly string[]
  ) => Effect.Effect<void, Error>;

  /**
   * Execute an intent programmatically
   */
  readonly executeIntent: (
    editor: Editor,
    markId: AnnotationId,
    trigger: 'click' | 'hover' | 'keyboard'
  ) => Effect.Effect<void, Error>;

  /**
   * Get annotation statistics
   */
  readonly getStats: Effect.Effect<{
    readonly totalMarks: number;
    readonly totalNodes: number;
    readonly byIntentType: Record<string, number>;
    readonly byVisualStyle: Record<string, number>;
    readonly byCreatedBy: Record<string, number>;
  }>;

  /**
   * Bulk create annotations (for agent batch operations)
   */
  readonly bulkCreate: (
    editor: Editor,
    inputs: readonly CreateAnnotationInput[]
  ) => Effect.Effect<readonly AnnotationId[], Error>;

  /**
   * Bulk remove annotations
   */
  readonly bulkRemove: (
    editor: Editor,
    annotationIds: readonly AnnotationId[]
  ) => Effect.Effect<void, Error>;

  /**
   * Find annotations containing specific text
   */
  readonly findByText: (
    searchText: string,
    options?: { caseSensitive?: boolean; regex?: boolean }
  ) => Effect.Effect<readonly AnnotationResult[]>;

  /**
   * Get annotations near a document position
   */
  readonly getAtPosition: (
    editor: Editor,
    position: number
  ) => Effect.Effect<readonly AnnotationResult[]>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class AnnotationToolsService extends Context.Tag('tmnl/editor/AnnotationToolsService')<
  AnnotationToolsService,
  AnnotationToolsServiceShape
>() {}

// =============================================================================
// Helper: Convert IntentMark to AnnotationResult
// =============================================================================

const markToResult = (
  mark: IntentMark,
  nodeOpt: Option.Option<AnnotationNode>
): AnnotationResult => ({
  id: mark.annotationId,
  markId: mark.id,
  intentType: mark.intent._tag,
  text: mark.text,
  visualStyle: mark.visual.style,
  color: mark.visual.color
    ? typeof mark.visual.color === 'string'
      ? mark.visual.color
      : undefined
    : undefined,
  tags: [...mark.tags],
  createdBy: mark.createdBy,
  createdAt: mark.createdAt,
  intentData: mark.intent,
  hasNode: Option.isSome(nodeOpt),
  nodeTitle: Option.isSome(nodeOpt) ? nodeOpt.value.title : undefined,
});

// =============================================================================
// Service Implementation
// =============================================================================

const makeAnnotationToolsService = Effect.gen(function* () {
  const annotationService = yield* AnnotationService;
  const intentExecutor = yield* IntentExecutor;

  // Helper to find text range in editor
  const findTextRange = (
    editor: Editor,
    text: string
  ): Option.Option<{ from: number; to: number }> => {
    const doc = editor.state.doc;
    let found: { from: number; to: number } | null = null;

    doc.descendants((node, pos) => {
      if (found) return false;
      if (node.isText && node.text) {
        const idx = node.text.indexOf(text);
        if (idx !== -1) {
          found = { from: pos + idx, to: pos + idx + text.length };
          return false;
        }
      }
      return true;
    });

    return found ? Option.some(found) : Option.none();
  };

  const createAnnotation: AnnotationToolsServiceShape['createAnnotation'] = (editor, input) =>
    Effect.gen(function* () {
      // Find text range
      const rangeOpt = findTextRange(editor, input.text);
      if (Option.isNone(rangeOpt)) {
        return yield* Effect.fail(new Error(`Text not found: "${input.text}"`));
      }

      const range = rangeOpt.value;

      // Build intent
      const intent = input.intent as Intent;

      // Build visual config
      const visual: { style: VisualStyle; color?: TmnlColorToken; effects?: VisualEffect[] } = {
        style: (input.visualStyle as VisualStyle) ?? 'highlight',
      };

      if (input.color) {
        visual.color = input.color as TmnlColorToken;
      }

      // Create mark via service
      const mark = yield* annotationService.createMark({
        intent,
        from: range.from,
        to: range.to,
        text: input.text,
        visual,
        tags: input.tags ?? [],
        createdBy: 'agent',
      });

      // If intent has content (Note, Popover), create associated node
      if (intent._tag === 'Note' || intent._tag === 'Popover') {
        const content = intent._tag === 'Note' ? intent.content : intent.content;
        const title = intent._tag === 'Popover' ? intent.title : 'Note';

        yield* annotationService.createNode({
          annotationId: mark.annotationId,
          title,
          content: content ?? '',
          nodeType: 'popover',
        });
      }

      return mark.annotationId;
    });

  const removeAnnotation: AnnotationToolsServiceShape['removeAnnotation'] = (editor, id) =>
    Effect.gen(function* () {
      // Find mark by annotation ID
      const marks = yield* annotationService.getAllMarks;
      const mark = marks.find((m) => m.annotationId === id);

      if (!mark) {
        return yield* Effect.fail(new Error(`Annotation not found: ${id}`));
      }

      // Remove mark and associated node
      yield* annotationService.removeMark(mark.id);
      yield* annotationService.removeNode(id);
    });

  const queryAnnotations: AnnotationToolsServiceShape['queryAnnotations'] = (query) =>
    Effect.gen(function* () {
      let marks = yield* annotationService.getAllMarks;

      // Apply filters
      if (query.intentType && query.intentType.length > 0) {
        const types = new Set(query.intentType);
        marks = marks.filter((m) => types.has(m.intent._tag as any));
      }

      if (query.tags && query.tags.length > 0) {
        const requiredTags = new Set(query.tags);
        marks = marks.filter((m) => query.tags!.every((t) => m.tags.includes(t)));
      }

      if (query.visualStyle && query.visualStyle.length > 0) {
        const styles = new Set(query.visualStyle);
        marks = marks.filter((m) => styles.has(m.visual.style as any));
      }

      if (query.createdBy) {
        marks = marks.filter((m) => m.createdBy === query.createdBy);
      }

      // Apply pagination
      const offset = query.offset ?? 0;
      const limit = query.limit ?? marks.length;
      marks = marks.slice(offset, offset + limit);

      // Convert to results with node info
      const results: AnnotationResult[] = [];
      for (const mark of marks) {
        const nodeOpt = yield* annotationService.findNode(mark.annotationId);
        results.push(markToResult(mark, nodeOpt));
      }

      return results;
    });

  const getAllAnnotations: AnnotationToolsServiceShape['getAllAnnotations'] = Effect.gen(
    function* () {
      const marks = yield* annotationService.getAllMarks;
      const results: AnnotationResult[] = [];

      for (const mark of marks) {
        const nodeOpt = yield* annotationService.findNode(mark.annotationId);
        results.push(markToResult(mark, nodeOpt));
      }

      return results;
    }
  );

  const getAnnotation: AnnotationToolsServiceShape['getAnnotation'] = (annotationId) =>
    Effect.gen(function* () {
      const marks = yield* annotationService.getAllMarks;
      const mark = marks.find((m) => m.annotationId === annotationId);

      if (!mark) {
        return Option.none();
      }

      const nodeOpt = yield* annotationService.findNode(annotationId);
      return Option.some(markToResult(mark, nodeOpt));
    });

  const updateTags: AnnotationToolsServiceShape['updateTags'] = (annotationId, tags) =>
    Effect.gen(function* () {
      const marks = yield* annotationService.getAllMarks;
      const mark = marks.find((m) => m.annotationId === annotationId);

      if (!mark) {
        return yield* Effect.fail(new Error(`Annotation not found: ${annotationId}`));
      }

      yield* annotationService.updateMark(mark.id, { tags: [...tags] });
    });

  const executeIntent: AnnotationToolsServiceShape['executeIntent'] = (editor, markId, trigger) =>
    Effect.gen(function* () {
      const result = yield* intentExecutor.execute({
        markId,
        trigger,
        modifiers: { shift: false, ctrl: false, alt: false, meta: false },
      });

      if (!result.success && result.error) {
        return yield* Effect.fail(new Error(String(result.error)));
      }
    });

  const getStats: AnnotationToolsServiceShape['getStats'] = Effect.gen(function* () {
    const marks = yield* annotationService.getAllMarks;
    const nodes = yield* annotationService.getAllNodes;

    const byIntentType: Record<string, number> = {};
    const byVisualStyle: Record<string, number> = {};
    const byCreatedBy: Record<string, number> = {};

    for (const mark of marks) {
      // Count by intent type
      const intentType = mark.intent._tag;
      byIntentType[intentType] = (byIntentType[intentType] ?? 0) + 1;

      // Count by visual style
      const style = mark.visual.style;
      byVisualStyle[style] = (byVisualStyle[style] ?? 0) + 1;

      // Count by created by
      const createdBy = mark.createdBy;
      byCreatedBy[createdBy] = (byCreatedBy[createdBy] ?? 0) + 1;
    }

    return {
      totalMarks: marks.length,
      totalNodes: nodes.length,
      byIntentType,
      byVisualStyle,
      byCreatedBy,
    };
  });

  const bulkCreate: AnnotationToolsServiceShape['bulkCreate'] = (editor, inputs) =>
    Effect.gen(function* () {
      const ids: AnnotationId[] = [];

      for (const input of inputs) {
        const id = yield* createAnnotation(editor, input);
        ids.push(id);
      }

      return ids;
    });

  const bulkRemove: AnnotationToolsServiceShape['bulkRemove'] = (editor, annotationIds) =>
    Effect.gen(function* () {
      for (const id of annotationIds) {
        yield* removeAnnotation(editor, id);
      }
    });

  const findByText: AnnotationToolsServiceShape['findByText'] = (searchText, options = {}) =>
    Effect.gen(function* () {
      const marks = yield* annotationService.getAllMarks;

      const matches = marks.filter((mark) => {
        if (options.regex) {
          const regex = new RegExp(searchText, options.caseSensitive ? '' : 'i');
          return regex.test(mark.text);
        }

        if (options.caseSensitive) {
          return mark.text.includes(searchText);
        }

        return mark.text.toLowerCase().includes(searchText.toLowerCase());
      });

      const results: AnnotationResult[] = [];
      for (const mark of matches) {
        const nodeOpt = yield* annotationService.findNode(mark.annotationId);
        results.push(markToResult(mark, nodeOpt));
      }

      return results;
    });

  const getAtPosition: AnnotationToolsServiceShape['getAtPosition'] = (editor, position) =>
    Effect.gen(function* () {
      const marks = yield* annotationService.getAllMarks;

      // Filter marks that span the position
      const atPos = marks.filter((mark) => mark.from <= position && mark.to >= position);

      const results: AnnotationResult[] = [];
      for (const mark of atPos) {
        const nodeOpt = yield* annotationService.findNode(mark.annotationId);
        results.push(markToResult(mark, nodeOpt));
      }

      return results;
    });

  return {
    createAnnotation,
    removeAnnotation,
    queryAnnotations,
    getAllAnnotations,
    getAnnotation,
    updateTags,
    executeIntent,
    getStats,
    bulkCreate,
    bulkRemove,
    findByText,
    getAtPosition,
  } satisfies AnnotationToolsServiceShape;
});

// =============================================================================
// Layer
// =============================================================================

export const AnnotationToolsServiceLive = Layer.effect(
  AnnotationToolsService,
  makeAnnotationToolsService
);

export default AnnotationToolsService;
