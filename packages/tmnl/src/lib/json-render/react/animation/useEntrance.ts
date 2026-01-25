'use client'

/**
 * @fileoverview React hook for entrance animations
 *
 * Resolves animation tokens to anime.js values and executes the animation.
 * Handles:
 * - Token resolution (duration, easing, property states)
 * - Stagger delays for sibling elements
 * - Animation lifecycle (set initial, animate to final, cleanup)
 *
 * @module json-render/react/animation/useEntrance
 */

import { useRef, useLayoutEffect } from 'react'
import { animate } from 'animejs'
import type { EntranceAnimation } from '../../core/animation-schema'
import {
  DURATION_MS,
  EASING_ANIMEJS,
  PROPERTY_STATES,
  STAGGER_DELAY,
} from './tokens'

// =============================================================================
// Types
// =============================================================================

export interface UseEntranceOptions {
  /** Animation configuration (from element.entrance or catalog default) */
  animation?: EntranceAnimation
  /** Sibling index for stagger calculation */
  index?: number
  /** Disable animation (e.g., for reduced motion) */
  disabled?: boolean
}

export interface UseEntranceReturn {
  /** Ref to attach to the animated element */
  ref: React.RefObject<HTMLDivElement | null>
  /** Initial styles to apply (prevents flash of content) */
  initialStyle: React.CSSProperties
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook that applies entrance animations to an element
 *
 * Resolves typed animation tokens to concrete anime.js values and
 * executes the animation on mount.
 *
 * @example
 * ```tsx
 * function MyComponent({ animation, index }) {
 *   const { ref, initialStyle } = useEntrance({ animation, index })
 *   return <div ref={ref} style={initialStyle}>Content</div>
 * }
 * ```
 */
export function useEntrance({
  animation,
  index = 0,
  disabled = false,
}: UseEntranceOptions): UseEntranceReturn {
  const ref = useRef<HTMLDivElement>(null)

  // Compute initial styles to prevent flash of content
  const initialStyle: React.CSSProperties = !disabled && animation
    ? {
        opacity: PROPERTY_STATES[animation.property].initial['opacity'] ?? 1,
        transform: buildTransformString(PROPERTY_STATES[animation.property].initial),
      }
    : {}

  // Use useLayoutEffect to run animation before paint
  useLayoutEffect(() => {
    // Skip if disabled, no animation config, or no element
    if (disabled || !animation || !ref.current) {
      return
    }

    const el = ref.current

    // Resolve tokens to concrete values
    const states = PROPERTY_STATES[animation.property]
    const duration = DURATION_MS[animation.duration]
    const easing = EASING_ANIMEJS[animation.easing]

    // Calculate total delay (stagger + custom)
    const staggerDelay = animation.stagger ? index * STAGGER_DELAY : 0
    const customDelay = animation.delay ?? 0
    const totalDelay = staggerDelay + customDelay

    // Skip animation if instant duration
    if (duration === 0) {
      // Just set final state immediately
      el.style.opacity = '1'
      el.style.transform = 'none'
      return
    }

    // Build animation config object
    // Using any to work with anime.js v4's flexible API
    const animConfig: any = {
      duration,
      easing,
      delay: totalDelay,
    }

    // Add property animations using keyframe syntax [from, to]
    if (states.initial['opacity'] !== undefined) {
      animConfig.opacity = [states.initial['opacity'], states.final['opacity']]
    }
    if (states.initial['translateY'] !== undefined) {
      animConfig.translateY = [states.initial['translateY'], states.final['translateY']]
    }
    if (states.initial['translateX'] !== undefined) {
      animConfig.translateX = [states.initial['translateX'], states.final['translateX']]
    }
    if (states.initial['scale'] !== undefined) {
      animConfig.scale = [states.initial['scale'], states.final['scale']]
    }

    // Animate to final state using anime.js v4 keyframe syntax
    const anim = animate(el, animConfig)

    // Cleanup: pause animation on unmount
    return () => {
      anim.pause()
    }
  }, [animation, index, disabled])

  return { ref, initialStyle }
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Build CSS transform string from animation state
 */
function buildTransformString(state: Record<string, number>): string {
  const transforms: string[] = []

  if (state['translateX'] !== undefined) {
    transforms.push(`translateX(${state['translateX']}px)`)
  }
  if (state['translateY'] !== undefined) {
    transforms.push(`translateY(${state['translateY']}px)`)
  }
  if (state['scale'] !== undefined) {
    transforms.push(`scale(${state['scale']})`)
  }

  return transforms.join(' ') || 'none'
}
