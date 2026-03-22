/**
 * AnimatedItem Component
 *
 * Stagger animation wrapper for items within a MorphCard.
 * Provides coordinated entrance animations with configurable styles.
 *
 * @module morph-card/components/AnimatedItem
 */

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { ItemAnimationConfig, ItemAnimationStyle, ItemAnimationDirection } from '../schemas';
import { ITEM_STYLE_VARIANTS, DEFAULT_ITEM_CONFIG } from '../schemas/animation-config';

// =============================================================================
// Props
// =============================================================================

export interface AnimatedItemProps {
  /** Content to animate */
  children: ReactNode;
  /** Index for stagger delay calculation */
  index?: number;
  /** Animation configuration */
  config?: ItemAnimationConfig;
  /** Additional className */
  className?: string;
}

// =============================================================================
// Direction Offsets
// =============================================================================

const DIRECTION_OFFSETS: Record<ItemAnimationDirection, { x?: number; y?: number }> = {
  left: { x: -12 },
  right: { x: 12 },
  top: { y: -12 },
  bottom: { y: 12 },
};

// =============================================================================
// Component
// =============================================================================

/**
 * AnimatedItem - Stagger animation wrapper
 *
 * @example
 * ```tsx
 * <AnimatedItem index={0} config={{ style: 'slide', from: 'top' }}>
 *   <span>First item</span>
 * </AnimatedItem>
 * <AnimatedItem index={1} config={{ style: 'slide', from: 'top', stagger: 0.08 }}>
 *   <span>Second item (appears 80ms later)</span>
 * </AnimatedItem>
 * ```
 */
export function AnimatedItem({
  children,
  index = 0,
  config = {},
  className,
}: AnimatedItemProps) {
  const {
    stagger = DEFAULT_ITEM_CONFIG.stagger ?? 0.05,
    style = DEFAULT_ITEM_CONFIG.style ?? 'fade',
    from,
    duration = DEFAULT_ITEM_CONFIG.duration ?? 0.3,
  } = config;

  // Get base variants for the style
  let variants = ITEM_STYLE_VARIANTS[style] || ITEM_STYLE_VARIANTS.fade;

  // Apply directional override for slide animations
  if (style === 'slide' && from) {
    const offset = DIRECTION_OFFSETS[from];
    variants = {
      initial: { opacity: 0, ...offset },
      animate: { opacity: 1, x: 0, y: 0 },
    };
  }

  return (
    <motion.div
      className={className}
      initial={variants.initial as any}
      animate={variants.animate as any}
      transition={{
        duration,
        delay: index * stagger,
      }}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// Preset Configurations
// =============================================================================

/**
 * Common animation presets for quick use
 */
export const ANIMATION_PRESETS = {
  /** Subtle fade-in */
  subtle: { style: 'fade' as ItemAnimationStyle, duration: 0.2, stagger: 0.03 },
  /** Standard slide from top */
  slideDown: { style: 'slide' as ItemAnimationStyle, from: 'top' as ItemAnimationDirection, stagger: 0.05 },
  /** Standard slide from left */
  slideRight: { style: 'slide' as ItemAnimationStyle, from: 'left' as ItemAnimationDirection, stagger: 0.05 },
  /** Pop-in scale effect */
  pop: { style: 'scale' as ItemAnimationStyle, duration: 0.25, stagger: 0.04 },
  /** Blur reveal */
  reveal: { style: 'blur' as ItemAnimationStyle, duration: 0.35, stagger: 0.06 },
  /** Cyberpunk glitch */
  cyber: { style: 'glitch' as ItemAnimationStyle, duration: 0.2, stagger: 0.02 },
} as const;

export default AnimatedItem;
