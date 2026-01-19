/**
 * Animation Configuration Schemas
 *
 * Effect Schema definitions for AnimatedItem and reticle configuration.
 *
 * @module morph-card/schemas/animation-config
 */

import { Schema } from 'effect';

// =============================================================================
// Item Animation Style
// =============================================================================

/**
 * Animation styles for individual items within a card
 */
export const ItemAnimationStyle = Schema.Literal(
  'fade',
  'slide',
  'scale',
  'blur',
  'glitch'
);
export type ItemAnimationStyle = Schema.Schema.Type<typeof ItemAnimationStyle>;

/**
 * Direction for directional item animations
 */
export const ItemAnimationDirection = Schema.Literal(
  'left',
  'right',
  'top',
  'bottom'
);
export type ItemAnimationDirection = Schema.Schema.Type<typeof ItemAnimationDirection>;

// =============================================================================
// Item Animation Config
// =============================================================================

/**
 * Configuration for AnimatedItem component
 */
export const ItemAnimationConfig = Schema.Struct({
  /** Delay between staggered items in seconds */
  stagger: Schema.optional(Schema.Number),
  /** Animation style */
  style: Schema.optional(ItemAnimationStyle),
  /** Direction for slide animations */
  from: Schema.optional(ItemAnimationDirection),
  /** Animation duration in seconds */
  duration: Schema.optional(Schema.Number),
});
export type ItemAnimationConfig = Schema.Schema.Type<typeof ItemAnimationConfig>;

/**
 * Default item animation configuration
 */
export const DEFAULT_ITEM_CONFIG: ItemAnimationConfig = {
  stagger: 0.05,
  style: 'fade',
  duration: 0.3,
};

// =============================================================================
// Item Style Variants
// =============================================================================

/**
 * Framer Motion variants for each item animation style
 */
export const ITEM_STYLE_VARIANTS: Record<
  ItemAnimationStyle,
  { initial: object; animate: object }
> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  },
  slide: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
  },
  blur: {
    initial: { opacity: 0, filter: 'blur(4px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
  },
  glitch: {
    initial: { opacity: 0, x: -3, filter: 'hue-rotate(90deg)' },
    animate: { opacity: 1, x: 0, filter: 'hue-rotate(0deg)' },
  },
};

// =============================================================================
// Reticle Variants
// =============================================================================

/**
 * Visual feedback overlay variants during transitions
 */
export const ReticleVariant = Schema.Literal(
  'none',
  'corners',
  'crosshair',
  'scan',
  'pulse',
  'diamond',
  'hexagon',
  'brackets',
  'targeting',
  'orbital',
  'grid',
  'dashed',
  'radar',
  'chevron',
  'triangles',
  'ring',
  'segments',
  'parallax',
  'vortex',
  'matrix',
  'circuit',
  'sine',
  'binary',
  'glitch'
);
export type ReticleVariant = Schema.Schema.Type<typeof ReticleVariant>;

// =============================================================================
// Card Config
// =============================================================================

/**
 * Complete configuration for a MorphCard
 */
export const MorphCardConfig = Schema.Struct({
  /** Border radius in pixels */
  borderRadius: Schema.optional(Schema.Number),
  /** Border intensity (0-1) */
  borderIntensity: Schema.optional(Schema.Number),
  /** Spring animation configuration */
  spring: Schema.optional(
    Schema.Struct({
      stiffness: Schema.Number,
      damping: Schema.Number,
      mass: Schema.Number,
    })
  ),
  /** Reticle variant for transition feedback */
  reticle: Schema.optional(ReticleVariant),
  /** Reticle color */
  reticleColor: Schema.optional(Schema.String),
  /** Enable motion blur during transitions */
  motionBlur: Schema.optional(Schema.Boolean),
  /** Default item animation configuration */
  itemAnimation: Schema.optional(ItemAnimationConfig),
});
export type MorphCardConfig = Schema.Schema.Type<typeof MorphCardConfig>;

/**
 * Default MorphCard configuration
 */
export const DEFAULT_CARD_CONFIG: Required<MorphCardConfig> = {
  borderRadius: 16,
  borderIntensity: 0.15,
  spring: {
    stiffness: 400,
    damping: 30,
    mass: 0.8,
  },
  reticle: 'corners',
  reticleColor: 'rgba(255,255,255,0.3)',
  motionBlur: true,
  itemAnimation: DEFAULT_ITEM_CONFIG,
};
