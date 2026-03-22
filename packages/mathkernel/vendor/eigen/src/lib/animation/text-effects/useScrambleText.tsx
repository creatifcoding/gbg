/**
 * useScrambleText - TMNL Text Scramble Animation Hook
 *
 * A React hook for animated text transitions with scramble effects.
 * Wraps use-scramble with TMNL-specific presets and sensible defaults.
 *
 * Features:
 * - Pre-configured presets (cyber, typewriter, glitch, etc.)
 * - Automatic reduced-motion respect
 * - Type-safe configuration
 * - Callback hooks for animation lifecycle
 *
 * @example
 * ```tsx
 * // Basic usage with preset
 * const { ref } = useScrambleText({ text: 'Hello', preset: 'cyber' })
 * return <span ref={ref} />
 *
 * // With custom config
 * const { ref, replay } = useScrambleText({
 *   text: status,
 *   preset: 'terminal',
 *   speed: 0.8,
 *   onAnimationEnd: () => console.log('done'),
 * })
 *
 * // Extend a preset
 * const { ref } = useScrambleText({
 *   text: 'Alert!',
 *   preset: 'glitch',
 *   scramble: 12, // Override preset value
 * })
 * ```
 *
 * @module animation/text-effects/useScrambleText
 */

import { useMemo } from 'react'
import { useScramble, type UseScrambleProps } from 'use-scramble'
import {
  type ScrambleConfig,
  type ScramblePreset,
  SCRAMBLE_PRESETS,
} from './presets'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for useScrambleText hook
 */
export interface UseScrambleTextOptions extends Partial<ScrambleConfig> {
  /** The text to display and animate */
  text: string
  /** Preset configuration to use as base */
  preset?: ScramblePreset
  /** Callback when animation starts */
  onAnimationStart?: () => void
  /** Callback on each animation frame with current text */
  onAnimationFrame?: (result: string) => void
  /** Callback when animation completes */
  onAnimationEnd?: () => void
}

/**
 * Return type for useScrambleText hook
 */
export interface UseScrambleTextResult {
  /** Ref to attach to the target element */
  ref: React.RefObject<HTMLElement>
  /** Function to manually replay the animation */
  replay: () => void
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * TMNL text scramble animation hook.
 *
 * Provides scramble text effects with pre-configured presets and
 * sensible defaults for the TMNL design system.
 *
 * @param options - Configuration options
 * @returns Ref and replay function
 *
 * @example
 * ```tsx
 * function StatusBadge({ status }: { status: string }) {
 *   const { ref } = useScrambleText({
 *     text: status,
 *     preset: 'terminal',
 *   })
 *
 *   return <span ref={ref} className="font-mono" />
 * }
 * ```
 */
export function useScrambleText(options: UseScrambleTextOptions): UseScrambleTextResult {
  const {
    text,
    preset = 'cyber',
    onAnimationStart,
    onAnimationFrame,
    onAnimationEnd,
    // Extract individual config overrides
    speed,
    tick,
    step,
    scramble,
    seed,
    chance,
    range,
    overdrive,
    overflow,
    ignore,
    playOnMount,
  } = options

  // Get base preset config
  const baseConfig = SCRAMBLE_PRESETS[preset]

  // Build final config with overrides
  const config = useMemo<UseScrambleProps>(() => {
    const merged: UseScrambleProps = {
      text,
      // Apply base preset values
      speed: speed ?? baseConfig.speed,
      tick: tick ?? baseConfig.tick,
      step: step ?? baseConfig.step,
      scramble: scramble ?? baseConfig.scramble,
      seed: seed ?? baseConfig.seed,
      chance: chance ?? baseConfig.chance,
      overdrive: overdrive ?? baseConfig.overdrive,
      overflow: overflow ?? baseConfig.overflow,
      playOnMount: playOnMount ?? baseConfig.playOnMount,
      // Callbacks
      onAnimationStart,
      onAnimationFrame,
      onAnimationEnd,
    }

    // Only add range if specified (use-scramble has default)
    if (range ?? baseConfig.range) {
      merged.range = range ?? baseConfig.range
    }

    // Only add ignore if specified
    if (ignore ?? baseConfig.ignore) {
      merged.ignore = ignore ?? baseConfig.ignore
    }

    return merged
  }, [
    text,
    baseConfig,
    speed,
    tick,
    step,
    scramble,
    seed,
    chance,
    range,
    overdrive,
    overflow,
    ignore,
    playOnMount,
    onAnimationStart,
    onAnimationFrame,
    onAnimationEnd,
  ])

  // Call the underlying hook
  const { ref, replay } = useScramble(config)

  return { ref, replay }
}

// =============================================================================
// CONVENIENCE HOOKS
// =============================================================================

/**
 * Cyber-style scramble - Classic hacker aesthetic
 *
 * @example
 * ```tsx
 * const { ref } = useCyberScramble('SYSTEM ONLINE')
 * ```
 */
export function useCyberScramble(
  text: string,
  overrides?: Partial<Omit<UseScrambleTextOptions, 'text' | 'preset'>>
): UseScrambleTextResult {
  return useScrambleText({ text, preset: 'cyber', ...overrides })
}

/**
 * Typewriter effect - Character-by-character reveal
 *
 * @example
 * ```tsx
 * const { ref } = useTypewriterScramble('Loading...')
 * ```
 */
export function useTypewriterScramble(
  text: string,
  overrides?: Partial<Omit<UseScrambleTextOptions, 'text' | 'preset'>>
): UseScrambleTextResult {
  return useScrambleText({ text, preset: 'typewriter', ...overrides })
}

/**
 * Glitch effect - Aggressive visual distortion
 *
 * @example
 * ```tsx
 * const { ref } = useGlitchScramble('ERROR')
 * ```
 */
export function useGlitchScramble(
  text: string,
  overrides?: Partial<Omit<UseScrambleTextOptions, 'text' | 'preset'>>
): UseScrambleTextResult {
  return useScrambleText({ text, preset: 'glitch', ...overrides })
}

/**
 * Terminal effect - Clean monospace transition
 *
 * @example
 * ```tsx
 * const { ref } = useTerminalScramble('STATUS: OK')
 * ```
 */
export function useTerminalScramble(
  text: string,
  overrides?: Partial<Omit<UseScrambleTextOptions, 'text' | 'preset'>>
): UseScrambleTextResult {
  return useScrambleText({ text, preset: 'terminal', ...overrides })
}

/**
 * Matrix effect - Green rain aesthetic
 *
 * @example
 * ```tsx
 * const { ref } = useMatrixScramble('WAKE UP')
 * ```
 */
export function useMatrixScramble(
  text: string,
  overrides?: Partial<Omit<UseScrambleTextOptions, 'text' | 'preset'>>
): UseScrambleTextResult {
  return useScrambleText({ text, preset: 'matrix', ...overrides })
}
