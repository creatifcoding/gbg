/**
 * Annotation System - Primitive Schemas
 *
 * Branded types and foundational schemas for the annotation system.
 * These are the building blocks for IntentMark and AnnotationNode.
 *
 * @module editor/v3/extensions/annotations/schemas/primitives
 */

import { Schema } from 'effect';

// =============================================================================
// Branded IDs
// =============================================================================

/**
 * Unique annotation identifier
 *
 * Format: `ann_` prefix + 12 alphanumeric characters
 *
 * @example
 * ```typescript
 * const id = 'ann_abc123def456' as AnnotationId;
 * ```
 */
export const AnnotationId = Schema.String.pipe(
  Schema.pattern(/^ann_[a-zA-Z0-9]{12}$/),
  Schema.brand('AnnotationId')
);
export type AnnotationId = typeof AnnotationId.Type;

/**
 * Document identifier for cross-document linking
 */
export const DocumentId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('DocumentId')
);
export type DocumentId = typeof DocumentId.Type;

// =============================================================================
// ID Generation
// =============================================================================

/**
 * Generate a new AnnotationId
 *
 * Uses crypto.randomUUID() truncated to 12 chars with ann_ prefix
 */
export const generateAnnotationId = (): AnnotationId => {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `ann_${random}` as AnnotationId;
};

// =============================================================================
// Visual Style Types
// =============================================================================

/**
 * Visual mark type - how the annotation renders
 */
export const VisualStyleType = Schema.Literal(
  'highlight', // Background color fill
  'pill', // Rounded container with background
  'squiggle', // Wavy underline
  'underline', // Solid/dotted underline
  'none' // Invisible (intent-only, no visual)
);
export type VisualStyleType = typeof VisualStyleType.Type;

/**
 * Visual effect overlays
 */
export const VisualEffect = Schema.Literal(
  'none', // No effect
  'grain', // Subtle texture overlay (cybergrain)
  'glow', // Soft glow edges
  'animate' // Animated (squiggle crawl, pulse)
);
export type VisualEffect = typeof VisualEffect.Type;

/**
 * Complete visual style configuration
 *
 * Determines how the mark renders in the editor.
 */
export const VisualStyle = Schema.Struct({
  /** Base visual type */
  type: VisualStyleType,

  /** TMNL color token (e.g., "accent.cyan", "status.warning") */
  color: Schema.String,

  /** Optional visual effect */
  effect: Schema.optionalWith(VisualEffect, { default: () => 'none' as const }),

  /** Whether the effect animates */
  animated: Schema.optionalWith(Schema.Boolean, { default: () => false }),
});
export type VisualStyle = typeof VisualStyle.Type;

// =============================================================================
// Interaction Modes
// =============================================================================

/**
 * How the user interacts with the mark to trigger its intent
 */
export const InteractionMode = Schema.Literal(
  'hover', // Popover on hover
  'click', // Popover on click
  'expand', // Inline expansion below text
  'drawer', // Side drawer panel
  'navigate', // Navigate to target (links)
  'execute' // Run Effect program
);
export type InteractionMode = typeof InteractionMode.Type;

// =============================================================================
// Creation Source
// =============================================================================

/**
 * How the annotation was created
 */
export const CreationSource = Schema.Literal(
  'manual', // User created via UI
  'agent', // Created by AI agent
  'system' // Created by system (auto-detection, import)
);
export type CreationSource = typeof CreationSource.Type;

// =============================================================================
// Presets - Common Visual Styles
// =============================================================================

/**
 * Preset visual styles for common use cases
 */
export const VisualStylePresets = {
  /** Standard yellow highlight */
  highlight: {
    type: 'highlight',
    color: 'accent.yellow',
    effect: 'none',
    animated: false,
  } satisfies VisualStyle,

  /** Cyan pill for linked content */
  pill: {
    type: 'pill',
    color: 'accent.cyan',
    effect: 'none',
    animated: false,
  } satisfies VisualStyle,

  /** Red squiggle for warnings */
  warningSquiggle: {
    type: 'squiggle',
    color: 'status.error',
    effect: 'animate',
    animated: true,
  } satisfies VisualStyle,

  /** Blue squiggle for info */
  infoSquiggle: {
    type: 'squiggle',
    color: 'accent.blue',
    effect: 'none',
    animated: false,
  } satisfies VisualStyle,

  /** Invisible intent-only mark */
  invisible: {
    type: 'none',
    color: 'transparent',
    effect: 'none',
    animated: false,
  } satisfies VisualStyle,

  /** Grain-textured highlight */
  grainHighlight: {
    type: 'highlight',
    color: 'accent.cyan',
    effect: 'grain',
    animated: false,
  } satisfies VisualStyle,
} as const;
