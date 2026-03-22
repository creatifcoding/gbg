/**
 * Transition Grammar Schemas
 *
 * Effect Schema definitions for animation vocabulary.
 * Adapted from dynamic island's TransitionGrammar system.
 *
 * @module morph-card/schemas/transition-grammar
 */

import { Schema } from 'effect';

// =============================================================================
// Transition Verbs
// =============================================================================

/**
 * Animation verbs - the "what" of a transition
 *
 * - morph: Smooth shape transformation with blur
 * - snap: Quick, crisp transition
 * - expand: Growth animation from smaller state
 * - collapse: Shrinkage animation to smaller state
 * - slide: Horizontal/vertical movement
 * - fade: Opacity-only transition
 * - glitch: Cyberpunk-style distortion
 * - shutter: Vertical wipe effect
 * - cascade: Falling card effect
 * - teleport: Scale-out, scale-in effect
 * - elastic: Bouncy spring animation
 * - cinematic: Dramatic zoom with brightness
 */
export const TransitionVerb = Schema.Literal(
  'morph',
  'snap',
  'expand',
  'collapse',
  'slide',
  'fade',
  'glitch',
  'shutter',
  'cascade',
  'teleport',
  'elastic',
  'cinematic'
);
export type TransitionVerb = Schema.Schema.Type<typeof TransitionVerb>;

// =============================================================================
// Transition Modifiers
// =============================================================================

/**
 * Animation modifiers - the "how" of a transition
 */
export const TransitionModifier = Schema.Literal(
  'fast',
  'slow',
  'smooth',
  'bounce',
  'sharp'
);
export type TransitionModifier = Schema.Schema.Type<typeof TransitionModifier>;

// =============================================================================
// Direction
// =============================================================================

/**
 * Directional hint for directional animations
 */
export const TransitionDirection = Schema.Literal(
  'left',
  'right',
  'up',
  'down'
);
export type TransitionDirection = Schema.Schema.Type<typeof TransitionDirection>;

// =============================================================================
// Transition Grammar
// =============================================================================

/**
 * Complete transition grammar specification
 */
export const TransitionGrammar = Schema.Struct({
  /** The animation verb */
  verb: TransitionVerb,
  /** Optional modifier for timing/easing */
  modifier: Schema.optional(TransitionModifier),
  /** Optional direction for directional animations */
  direction: Schema.optional(TransitionDirection),
});
export type TransitionGrammar = Schema.Schema.Type<typeof TransitionGrammar>;

// =============================================================================
// Default Transitions
// =============================================================================

/**
 * Default transition grammar
 */
export const DEFAULT_TRANSITION: TransitionGrammar = {
  verb: 'morph',
  modifier: 'smooth',
};

// =============================================================================
// Verb Variants - Framer Motion configurations
// =============================================================================

/**
 * Animation variants for each verb
 * Maps to Framer Motion initial/animate/exit configurations
 */
export const VERB_VARIANTS: Record<
  TransitionVerb,
  { initial: object; animate: object; exit: object }
> = {
  morph: {
    initial: { opacity: 0, scale: 0.95, filter: 'blur(4px)' },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, scale: 1.02, filter: 'blur(4px)' },
  },
  snap: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  },
  expand: {
    initial: { opacity: 0, scale: 0.8, y: -10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.85, y: 5 },
  },
  collapse: {
    initial: { opacity: 0, scale: 1.1, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.9, y: -5 },
  },
  slide: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  glitch: {
    initial: { opacity: 0, x: -5, filter: 'blur(8px) hue-rotate(90deg)' },
    animate: { opacity: 1, x: 0, filter: 'blur(0px) hue-rotate(0deg)' },
    exit: { opacity: 0, x: 5, filter: 'blur(8px) hue-rotate(-90deg)' },
  },
  shutter: {
    initial: { opacity: 0, scaleY: 0, originY: 0 },
    animate: { opacity: 1, scaleY: 1 },
    exit: { opacity: 0, scaleY: 0, originY: 1 },
  },
  cascade: {
    initial: { opacity: 0, y: 30, rotateX: -15 },
    animate: { opacity: 1, y: 0, rotateX: 0 },
    exit: { opacity: 0, y: -20, rotateX: 10 },
  },
  teleport: {
    initial: { opacity: 0, scale: 0, filter: 'blur(20px)' },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, scale: 2, filter: 'blur(20px)' },
  },
  elastic: {
    initial: { opacity: 0, scale: 0.5, rotate: -5 },
    animate: { opacity: 1, scale: 1, rotate: 0 },
    exit: { opacity: 0, scale: 0.8, rotate: 5 },
  },
  cinematic: {
    initial: { opacity: 0, scale: 1.1, filter: 'blur(10px) brightness(2)' },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px) brightness(1)' },
    exit: { opacity: 0, scale: 0.95, filter: 'blur(10px) brightness(0.5)' },
  },
};

// =============================================================================
// Modifier Timing
// =============================================================================

/**
 * Duration in seconds for each modifier
 */
export const MODIFIER_TIMING: Record<TransitionModifier, number> = {
  fast: 0.12,
  slow: 0.5,
  smooth: 0.3,
  bounce: 0.4,
  sharp: 0.15,
};

// =============================================================================
// Easing Curves
// =============================================================================

/**
 * Cubic bezier easing curves
 */
export const EASING = {
  snap: [0.2, 0, 0, 1] as const,
  smooth: [0.4, 0, 0.2, 1] as const,
  bounce: [0.34, 1.56, 0.64, 1] as const,
  sharp: [0.4, 0, 0.6, 1] as const,
} as const;

// =============================================================================
// Grammar Parser
// =============================================================================

/**
 * Parse a grammar string or object into TransitionGrammar
 *
 * @example
 * parseGrammar('morph:fast') // { verb: 'morph', modifier: 'fast' }
 * parseGrammar('slide:smooth:left') // { verb: 'slide', modifier: 'smooth', direction: 'left' }
 */
export function parseGrammar(grammar: string | TransitionGrammar): TransitionGrammar {
  if (typeof grammar === 'object') return grammar;

  const parts = grammar.toLowerCase().split(':');
  return {
    verb: (parts[0] as TransitionVerb) || 'morph',
    modifier: parts[1] as TransitionModifier | undefined,
    direction: parts[2] as TransitionDirection | undefined,
  };
}

// =============================================================================
// Delta-Based Heuristic
// =============================================================================

export interface SizeDeltaInput {
  readonly from: { width: number; height: number };
  readonly to: { width: number; height: number };
}

export function deriveGrammarByDelta(input: SizeDeltaInput): TransitionGrammar {
  const delta =
    Math.abs(input.to.width - input.from.width) +
    Math.abs(input.to.height - input.from.height);
  if (delta < 40) {
    return { verb: 'snap', modifier: 'fast' };
  }
  if (delta < 140) {
    return { verb: 'morph', modifier: 'smooth' };
  }
  if (delta < 260) {
    return {
      verb: 'slide',
      modifier: 'smooth',
      direction: input.to.height >= input.from.height ? 'up' : 'down',
    };
  }
  if (delta < 380) {
    return { verb: 'cinematic', modifier: 'slow' };
  }
  return { verb: 'teleport', modifier: 'bounce' };
}

/**
 * Convert grammar to Framer Motion variants
 */
export function grammarToVariants(grammar: TransitionGrammar) {
  const base = VERB_VARIANTS[grammar.verb] || VERB_VARIANTS.morph;
  const duration = grammar.modifier
    ? MODIFIER_TIMING[grammar.modifier]
    : 0.2;

  const ease =
    grammar.modifier === 'bounce'
      ? EASING.bounce
      : grammar.modifier === 'sharp'
        ? EASING.sharp
        : EASING.smooth;

  const directionalSlide =
    grammar.verb === 'slide' && grammar.direction
      ? (() => {
          switch (grammar.direction) {
            case 'up':
              return { initial: { y: 20, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: -20, opacity: 0 } };
            case 'down':
              return { initial: { y: -20, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: 20, opacity: 0 } };
            case 'left':
              return { initial: { x: 20, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: -20, opacity: 0 } };
            case 'right':
              return { initial: { x: -20, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: 20, opacity: 0 } };
          }
          return null;
        })()
      : null;

  const resolved = directionalSlide ?? base;

  const animate = { ...resolved.animate } as Record<string, unknown>;
  const exit = { ...resolved.exit } as Record<string, unknown>;

  if (animate.filter == null) animate.filter = 'blur(0px)';
  if (exit.filter == null) exit.filter = 'blur(0px)';

  return {
    initial: resolved.initial,
    animate: {
      ...animate,
      transition: { duration, ease },
    },
    exit: {
      ...exit,
      transition: { duration: duration * 0.8, ease: EASING.snap },
    },
  };
}
