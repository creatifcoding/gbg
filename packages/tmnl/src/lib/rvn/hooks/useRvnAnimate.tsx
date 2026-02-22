/**
 * useRvnAnimate
 *
 * Raw anime.js animation hook for RVN components.
 * Provides imperative control over preset-based animations.
 *
 * @example
 * ```tsx
 * function AlertBanner() {
 *   const { ref, play, stop } = useRvnAnimate<HTMLDivElement>('slideInTop')
 *
 *   useEffect(() => {
 *     play()
 *   }, [])
 *
 *   return <div ref={ref}>ALERT: System Critical</div>
 * }
 * ```
 *
 * @example with custom options
 * ```tsx
 * const { ref, play } = useRvnAnimate<HTMLButtonElement>('pulse', {
 *   duration: 300,
 *   loop: true,
 * })
 * ```
 */

import { useRef, useCallback, useEffect } from 'react'
import { animate, type JSAnimation, type AnimationParams } from 'animejs'
import { RVN_PRESETS, type RvnPresetName } from '../animation/presets'

export interface UseRvnAnimateOptions extends Partial<AnimationParams> {
  /** Auto-play animation on mount */
  autoPlay?: boolean
  /** Callback when animation completes */
  onComplete?: () => void
  /** Callback on each animation frame */
  onUpdate?: () => void
}

export interface UseRvnAnimateResult<T extends HTMLElement> {
  /** Ref to attach to the animated element */
  ref: React.RefObject<T | null>
  /** Play the animation */
  play: () => JSAnimation | undefined
  /** Stop/pause the animation */
  stop: () => void
  /** Reverse the animation */
  reverse: () => void
  /** Seek to a specific time (ms) */
  seek: (time: number) => void
  /** Reset the animation to initial state */
  reset: () => void
}

/**
 * Hook for animating RVN components with preset or custom animations.
 *
 * @param preset - Name of the RVN animation preset
 * @param options - Optional overrides and callbacks
 * @returns Animation controls and ref
 */
export function useRvnAnimate<T extends HTMLElement>(
  preset: RvnPresetName,
  options: UseRvnAnimateOptions = {}
): UseRvnAnimateResult<T> {
  const ref = useRef<T | null>(null)
  const animationRef = useRef<JSAnimation | null>(null)

  const { autoPlay = false, onComplete, onUpdate, ...overrides } = options

  /**
   * Build the animation config by merging preset with overrides.
   */
  const getConfig = useCallback((): AnimationParams => {
    const presetConfig = RVN_PRESETS[preset]

    // Handle function presets vs static presets
    const baseConfig =
      typeof presetConfig === 'function'
        ? presetConfig(overrides)
        : { ...presetConfig }

    // Merge with overrides
    const config: AnimationParams = {
      ...baseConfig,
      ...overrides,
    }

    // Add callbacks if provided
    if (onComplete) {
      config.onComplete = onComplete
    }
    if (onUpdate) {
      config.onUpdate = onUpdate
    }

    return config
  }, [preset, onComplete, onUpdate, overrides])

  /**
   * Play the animation.
   */
  const play = useCallback(() => {
    if (!ref.current) return undefined

    // Stop any existing animation
    if (animationRef.current) {
      animationRef.current.pause()
    }

    const config = getConfig()
    animationRef.current = animate(ref.current, config)

    return animationRef.current
  }, [getConfig])

  /**
   * Stop/pause the animation.
   */
  const stop = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.pause()
    }
  }, [])

  /**
   * Reverse the animation direction.
   */
  const reverse = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.reverse()
    }
  }, [])

  /**
   * Seek to a specific time in the animation.
   */
  const seek = useCallback((time: number) => {
    if (animationRef.current) {
      animationRef.current.seek(time)
    }
  }, [])

  /**
   * Reset the animation to its initial state.
   */
  const reset = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.pause()
      animationRef.current.seek(0)
    }
  }, [])

  // Auto-play on mount if requested
  useEffect(() => {
    if (autoPlay && ref.current) {
      play()
    }

    // Cleanup on unmount
    return () => {
      if (animationRef.current) {
        animationRef.current.pause()
        animationRef.current = null
      }
    }
  }, [autoPlay, play])

  return {
    ref,
    play,
    stop,
    reverse,
    seek,
    reset,
  }
}
