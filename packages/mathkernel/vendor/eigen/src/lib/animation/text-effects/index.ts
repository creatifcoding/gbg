/**
 * Text Effects - Animated text transitions
 *
 * Provides scramble text animations with pre-configured presets
 * for the TMNL design system.
 *
 * @example
 * ```tsx
 * import { useScrambleText, useCyberScramble } from '@/lib/animation/text-effects'
 *
 * // With preset
 * const { ref } = useScrambleText({ text: 'Hello', preset: 'cyber' })
 *
 * // Convenience hook
 * const { ref } = useCyberScramble('Hello')
 * ```
 *
 * @module animation/text-effects
 */

// Main hook
export {
  useScrambleText,
  useCyberScramble,
  useTypewriterScramble,
  useGlitchScramble,
  useTerminalScramble,
  useMatrixScramble,
  type UseScrambleTextOptions,
  type UseScrambleTextResult,
} from './useScrambleText'

// Presets
export {
  type ScrambleConfig,
  type ScramblePreset,
  SCRAMBLE_PRESETS,
  getScramblePreset,
  extendPreset,
  // Individual presets
  cyberPreset,
  typewriterPreset,
  glitchPreset,
  matrixPreset,
  terminalPreset,
  smoothPreset,
  rapidPreset,
  dramaticPreset,
} from './presets'
