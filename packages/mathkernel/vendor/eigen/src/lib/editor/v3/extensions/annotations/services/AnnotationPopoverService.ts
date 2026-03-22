/**
 * AnnotationPopoverService
 *
 * Manages popover state for annotation intents.
 * Coordinates with IntentExecutor to show/hide popovers.
 *
 * State Pattern:
 * - Service manages popover lifecycle (open, close, update)
 * - Atoms expose reactive state to React
 * - PopoverRequest from IntentExecutor triggers show()
 *
 * @module editor/v3/extensions/annotations/services/AnnotationPopoverService
 */

import { Effect, Context, Layer, Ref, Option, Schema } from 'effect';
import type { AnnotationId, IntentMark, AnnotationNode } from '../schemas';
import { AnnotationService } from './AnnotationService';

// =============================================================================
// Schemas
// =============================================================================

/**
 * Popover Position
 */
export const PopoverPosition = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
});
export type PopoverPosition = typeof PopoverPosition.Type;

/**
 * Popover Anchor (element or coordinates)
 */
export const PopoverAnchor = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('element'),
    selector: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('coordinates'),
    position: PopoverPosition,
  }),
  Schema.Struct({
    _tag: Schema.Literal('virtual'),
    getBoundingClientRect: Schema.Unknown, // () => DOMRect
  })
);
export type PopoverAnchor = typeof PopoverAnchor.Type;

/**
 * Popover Placement
 */
export const PopoverPlacement = Schema.Literal(
  'top',
  'top-start',
  'top-end',
  'bottom',
  'bottom-start',
  'bottom-end',
  'left',
  'left-start',
  'left-end',
  'right',
  'right-start',
  'right-end'
);
export type PopoverPlacement = typeof PopoverPlacement.Type;

/**
 * Popover Trigger Type
 */
export const PopoverTrigger = Schema.Literal('hover', 'click', 'focus', 'manual');
export type PopoverTrigger = typeof PopoverTrigger.Type;

/**
 * Active Popover State
 */
export const ActivePopoverState = Schema.Struct({
  /** The annotation ID being displayed */
  annotationId: Schema.String,

  /** The mark that triggered the popover */
  markId: Schema.String,

  /** Anchor for positioning */
  anchor: PopoverAnchor,

  /** Preferred placement */
  placement: PopoverPlacement,

  /** How it was triggered */
  trigger: PopoverTrigger,

  /** Whether popover is pinned (won't auto-close on hover out) */
  isPinned: Schema.Boolean,

  /** Timestamp when opened */
  openedAt: Schema.Number,
});
export type ActivePopoverState = typeof ActivePopoverState.Type;

/**
 * Popover Content (loaded from annotation)
 */
export interface PopoverContent {
  /** Title from intent or node */
  readonly title: string;

  /** Description/body content */
  readonly description?: string;

  /** Icon to display */
  readonly icon?: React.ReactNode;

  /** External link */
  readonly href?: string;

  /** Action button label */
  readonly actionLabel?: string;

  /** Action button callback */
  readonly onAction?: () => void;

  /** Metadata (e.g., reading time, date) */
  readonly meta?: string;

  /** The full mark for advanced rendering */
  readonly mark?: IntentMark;

  /** The node content (for rich content) */
  readonly node?: AnnotationNode;
}

// =============================================================================
// Service Interface
// =============================================================================

export interface AnnotationPopoverServiceShape {
  /**
   * Show a popover for an annotation
   */
  readonly show: (options: {
    annotationId: AnnotationId;
    markId: AnnotationId;
    anchor: PopoverAnchor;
    placement?: PopoverPlacement;
    trigger?: PopoverTrigger;
    isPinned?: boolean;
  }) => Effect.Effect<void>;

  /**
   * Hide the active popover
   */
  readonly hide: Effect.Effect<void>;

  /**
   * Toggle popover for an annotation
   */
  readonly toggle: (options: {
    annotationId: AnnotationId;
    markId: AnnotationId;
    anchor: PopoverAnchor;
    placement?: PopoverPlacement;
  }) => Effect.Effect<void>;

  /**
   * Pin the active popover (won't auto-close)
   */
  readonly pin: Effect.Effect<void>;

  /**
   * Unpin the active popover
   */
  readonly unpin: Effect.Effect<void>;

  /**
   * Get the active popover state
   */
  readonly getActive: Effect.Effect<Option.Option<ActivePopoverState>>;

  /**
   * Check if a specific annotation's popover is open
   */
  readonly isOpen: (annotationId: AnnotationId) => Effect.Effect<boolean>;

  /**
   * Get content for the active popover
   */
  readonly getContent: Effect.Effect<Option.Option<PopoverContent>>;

  /**
   * Update anchor position (for following cursor/element)
   */
  readonly updateAnchor: (anchor: PopoverAnchor) => Effect.Effect<void>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class AnnotationPopoverService extends Context.Tag('tmnl/editor/AnnotationPopoverService')<
  AnnotationPopoverService,
  AnnotationPopoverServiceShape
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const makeAnnotationPopoverService = Effect.gen(function* () {
  // Active popover state
  const activeRef = yield* Ref.make<Option.Option<ActivePopoverState>>(Option.none());

  const show: AnnotationPopoverServiceShape['show'] = (options) =>
    Effect.gen(function* () {
      const state: ActivePopoverState = {
        annotationId: options.annotationId,
        markId: options.markId,
        anchor: options.anchor,
        placement: options.placement ?? 'top',
        trigger: options.trigger ?? 'click',
        isPinned: options.isPinned ?? false,
        openedAt: Date.now(),
      };

      yield* Ref.set(activeRef, Option.some(state));
    });

  const hide: AnnotationPopoverServiceShape['hide'] = Ref.set(activeRef, Option.none());

  const toggle: AnnotationPopoverServiceShape['toggle'] = (options) =>
    Effect.gen(function* () {
      const current = yield* Ref.get(activeRef);

      if (Option.isSome(current) && current.value.annotationId === options.annotationId) {
        yield* hide;
      } else {
        yield* show(options);
      }
    });

  const pin: AnnotationPopoverServiceShape['pin'] = Effect.gen(function* () {
    yield* Ref.update(activeRef, (opt) =>
      Option.map(opt, (state) => ({ ...state, isPinned: true }))
    );
  });

  const unpin: AnnotationPopoverServiceShape['unpin'] = Effect.gen(function* () {
    yield* Ref.update(activeRef, (opt) =>
      Option.map(opt, (state) => ({ ...state, isPinned: false }))
    );
  });

  const getActive: AnnotationPopoverServiceShape['getActive'] = Ref.get(activeRef);

  const isOpen: AnnotationPopoverServiceShape['isOpen'] = (annotationId) =>
    Effect.gen(function* () {
      const current = yield* Ref.get(activeRef);
      return Option.isSome(current) && current.value.annotationId === annotationId;
    });

  const getContent: AnnotationPopoverServiceShape['getContent'] = Effect.gen(function* () {
    const active = yield* Ref.get(activeRef);

    if (Option.isNone(active)) {
      return Option.none();
    }

    const { annotationId, markId } = active.value;
    const annotationService = yield* AnnotationService;

    // Try to get the mark
    const markResult = yield* annotationService.findMark(markId);
    const mark = Option.isSome(markResult) ? markResult.value : undefined;

    // Try to get the node (for rich content)
    const nodeResult = yield* annotationService.findNode(annotationId);
    const node = Option.isSome(nodeResult) ? nodeResult.value : undefined;

    // Build content from mark and node
    const content: PopoverContent = {
      title: node?.title ?? mark?.intent._tag ?? 'Annotation',
      description: node?.content
        ? typeof node.content === 'string'
          ? node.content
          : JSON.stringify(node.content)
        : undefined,
      mark,
      node,
    };

    // Add intent-specific content
    if (mark) {
      const intent = mark.intent;
      switch (intent._tag) {
        case 'Hyperlink':
          content.href = intent.href;
          content.actionLabel = intent.label ? undefined : 'Open Link';
          break;
        case 'Citation':
          content.meta = intent.author
            ? Option.getOrUndefined(intent.author)
            : undefined;
          break;
        case 'Note':
          // Note content comes from node
          break;
      }
    }

    return Option.some(content);
  });

  const updateAnchor: AnnotationPopoverServiceShape['updateAnchor'] = (anchor) =>
    Ref.update(activeRef, (opt) => Option.map(opt, (state) => ({ ...state, anchor })));

  return {
    show,
    hide,
    toggle,
    pin,
    unpin,
    getActive,
    isOpen,
    getContent,
    updateAnchor,
  } satisfies AnnotationPopoverServiceShape;
});

// =============================================================================
// Layer
// =============================================================================

export const AnnotationPopoverServiceLive = Layer.effect(
  AnnotationPopoverService,
  makeAnnotationPopoverService
);

export default AnnotationPopoverService;
