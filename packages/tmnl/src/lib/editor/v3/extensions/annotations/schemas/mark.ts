/**
 * Annotation System - IntentMark Schema
 *
 * The inline ProseMirror mark that wraps text with visual styling
 * and semantic intent. This is the primary annotation primitive.
 *
 * @module editor/v3/extensions/annotations/schemas/mark
 */

import { Option, Schema } from 'effect';
import {
  AnnotationId,
  VisualStyle,
  CreationSource,
  generateAnnotationId,
  VisualStylePresets,
} from './primitives';
import { IntentPayload, Intent } from './intent';

// =============================================================================
// IntentMark Entity
// =============================================================================

/**
 * Intent Mark - Inline annotation mark
 *
 * A ProseMirror mark that combines:
 * - Visual styling (how it looks)
 * - Semantic intent (what it does)
 * - Filtering tags (how to query it)
 * - Graph references (what it links to)
 *
 * @example
 * ```typescript
 * const mark = new IntentMark({
 *   id: generateAnnotationId(),
 *   visualStyle: VisualStylePresets.pill,
 *   intent: Intent.popover(annotationId, 'hover'),
 *   tags: ['important', 'review-needed'],
 *   createdAt: new Date(),
 *   createdBy: 'manual',
 *   references: Option.none(),
 * });
 * ```
 */
export class IntentMark extends Schema.TaggedClass<IntentMark>()('IntentMark', {
  /** Unique identifier */
  id: AnnotationId,

  /** Visual rendering configuration */
  visualStyle: VisualStyle,

  /** Semantic intent (what happens on activation) */
  intent: IntentPayload,

  /** Freeform tags for filtering */
  tags: Schema.Array(Schema.String),

  /** Creation timestamp */
  createdAt: Schema.DateFromSelf,

  /** How this mark was created */
  createdBy: CreationSource,

  /** Outgoing references to other annotations (graph edges) */
  references: Schema.OptionFromNullOr(Schema.Array(AnnotationId)),
}) {
  // ===========================================================================
  // Convenience Getters
  // ===========================================================================

  /** Check if mark has any tags */
  get hasTags(): boolean {
    return this.tags.length > 0;
  }

  /** Check if mark has outgoing references */
  get hasReferences(): boolean {
    return Option.isSome(this.references) && Option.getOrElse(this.references, () => []).length > 0;
  }

  /** Get intent type for filtering */
  get intentType(): string {
    return this.intent._tag;
  }

  /** Get visual type for filtering */
  get visualType(): string {
    return this.visualStyle.type;
  }

  // ===========================================================================
  // Immutable Updates
  // ===========================================================================

  /** Update visual style */
  withVisualStyle(visualStyle: VisualStyle): IntentMark {
    return new IntentMark({ ...this, visualStyle });
  }

  /** Update intent */
  withIntent(intent: IntentPayload): IntentMark {
    return new IntentMark({ ...this, intent });
  }

  /** Add tags */
  withTags(...newTags: string[]): IntentMark {
    const uniqueTags = Array.from(new Set([...this.tags, ...newTags]));
    return new IntentMark({ ...this, tags: uniqueTags });
  }

  /** Remove tags */
  withoutTags(...tagsToRemove: string[]): IntentMark {
    const removeSet = new Set(tagsToRemove);
    return new IntentMark({
      ...this,
      tags: this.tags.filter((t) => !removeSet.has(t)),
    });
  }

  /** Add reference to another annotation */
  withReference(annotationId: AnnotationId): IntentMark {
    const existing = Option.getOrElse(this.references, () => [] as AnnotationId[]);
    if (existing.includes(annotationId)) return this;
    return new IntentMark({
      ...this,
      references: Option.some([...existing, annotationId]),
    });
  }

  /** Remove reference */
  withoutReference(annotationId: AnnotationId): IntentMark {
    const existing = Option.getOrElse(this.references, () => [] as AnnotationId[]);
    const filtered = existing.filter((id) => id !== annotationId);
    return new IntentMark({
      ...this,
      references: filtered.length > 0 ? Option.some(filtered) : Option.none(),
    });
  }
}

// =============================================================================
// Mark Factory
// =============================================================================

/**
 * Factory functions for creating IntentMarks
 */
export const IntentMarkFactory = {
  /**
   * Create a basic highlight mark
   */
  highlight: (options?: {
    color?: string;
    tags?: string[];
  }): IntentMark =>
    new IntentMark({
      id: generateAnnotationId(),
      visualStyle: {
        type: 'highlight',
        color: options?.color ?? 'accent.yellow',
        effect: 'none',
        animated: false,
      },
      intent: { _tag: 'Note', annotationId: generateAnnotationId(), category: 'comment' },
      tags: options?.tags ?? [],
      createdAt: new Date(),
      createdBy: 'manual',
      references: Option.none(),
    }),

  /**
   * Create a pill mark with popover
   */
  pill: (
    annotationId: AnnotationId,
    options?: {
      color?: string;
      interaction?: 'hover' | 'click';
      tags?: string[];
    }
  ): IntentMark =>
    new IntentMark({
      id: generateAnnotationId(),
      visualStyle: {
        type: 'pill',
        color: options?.color ?? 'accent.cyan',
        effect: 'none',
        animated: false,
      },
      intent: Intent.popover(annotationId, options?.interaction ?? 'hover'),
      tags: options?.tags ?? [],
      createdAt: new Date(),
      createdBy: 'manual',
      references: Option.some([annotationId]),
    }),

  /**
   * Create a hyperlink mark
   */
  link: (
    href: string,
    options?: {
      color?: string;
      target?: '_blank' | '_self';
      tags?: string[];
    }
  ): IntentMark =>
    new IntentMark({
      id: generateAnnotationId(),
      visualStyle: {
        type: 'underline',
        color: options?.color ?? 'accent.blue',
        effect: 'none',
        animated: false,
      },
      intent: Intent.hyperlink(href, options?.target),
      tags: options?.tags ?? [],
      createdAt: new Date(),
      createdBy: 'manual',
      references: Option.none(),
    }),

  /**
   * Create a warning squiggle mark
   */
  warning: (
    annotationId: AnnotationId,
    options?: {
      animated?: boolean;
      tags?: string[];
    }
  ): IntentMark =>
    new IntentMark({
      id: generateAnnotationId(),
      visualStyle: {
        type: 'squiggle',
        color: 'status.error',
        effect: options?.animated ? 'animate' : 'none',
        animated: options?.animated ?? false,
      },
      intent: Intent.popover(annotationId, 'hover'),
      tags: ['warning', ...(options?.tags ?? [])],
      createdAt: new Date(),
      createdBy: 'system',
      references: Option.some([annotationId]),
    }),

  /**
   * Create an action mark
   */
  action: (
    registryKey: string,
    params?: unknown,
    options?: {
      visualStyle?: VisualStyle;
      tags?: string[];
    }
  ): IntentMark =>
    new IntentMark({
      id: generateAnnotationId(),
      visualStyle: options?.visualStyle ?? VisualStylePresets.pill,
      intent: Intent.action(registryKey, params),
      tags: ['action', ...(options?.tags ?? [])],
      createdAt: new Date(),
      createdBy: 'manual',
      references: Option.none(),
    }),

  /**
   * Create a citation mark
   */
  citation: (
    annotationId: AnnotationId,
    citationKey?: string,
    options?: {
      tags?: string[];
    }
  ): IntentMark =>
    new IntentMark({
      id: generateAnnotationId(),
      visualStyle: {
        type: 'underline',
        color: 'accent.purple',
        effect: 'none',
        animated: false,
      },
      intent: Intent.citation(annotationId, citationKey),
      tags: ['citation', ...(options?.tags ?? [])],
      createdAt: new Date(),
      createdBy: 'manual',
      references: Option.some([annotationId]),
    }),

  /**
   * Create from raw config (for agent use)
   */
  fromConfig: (config: {
    visualStyle: VisualStyle;
    intent: IntentPayload;
    tags?: string[];
    createdBy?: CreationSource;
  }): IntentMark =>
    new IntentMark({
      id: generateAnnotationId(),
      visualStyle: config.visualStyle,
      intent: config.intent,
      tags: config.tags ?? [],
      createdAt: new Date(),
      createdBy: config.createdBy ?? 'agent',
      references: Option.none(),
    }),
} as const;

// =============================================================================
// Serialization (for ProseMirror mark attributes)
// =============================================================================

/**
 * Serialized mark attributes for ProseMirror storage
 *
 * Complex objects are JSON stringified for HTML attribute storage.
 */
export const IntentMarkAttrs = Schema.Struct({
  id: Schema.String,
  visualStyle: Schema.String, // JSON
  intent: Schema.String, // JSON
  tags: Schema.String, // JSON array
  createdAt: Schema.String, // ISO string
  createdBy: Schema.String,
  references: Schema.NullOr(Schema.String), // JSON array or null
});
export type IntentMarkAttrs = typeof IntentMarkAttrs.Type;

/**
 * Encode IntentMark to ProseMirror attributes
 */
export const encodeMarkAttrs = (mark: IntentMark): IntentMarkAttrs => ({
  id: mark.id,
  visualStyle: JSON.stringify(mark.visualStyle),
  intent: JSON.stringify(mark.intent),
  tags: JSON.stringify(mark.tags),
  createdAt: mark.createdAt.toISOString(),
  createdBy: mark.createdBy,
  references: Option.isSome(mark.references)
    ? JSON.stringify(Option.getOrThrow(mark.references))
    : null,
});

/**
 * Decode ProseMirror attributes to IntentMark
 */
export const decodeMarkAttrs = (attrs: IntentMarkAttrs): IntentMark =>
  new IntentMark({
    id: attrs.id as AnnotationId,
    visualStyle: JSON.parse(attrs.visualStyle) as VisualStyle,
    intent: JSON.parse(attrs.intent) as IntentPayload,
    tags: JSON.parse(attrs.tags) as string[],
    createdAt: new Date(attrs.createdAt),
    createdBy: attrs.createdBy as CreationSource,
    references: attrs.references
      ? Option.some(JSON.parse(attrs.references) as AnnotationId[])
      : Option.none(),
  });
