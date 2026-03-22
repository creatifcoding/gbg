/**
 * Scramble Text Presets
 *
 * Pre-configured scramble animation styles for different use cases.
 * Each preset defines timing, character ranges, and visual characteristics.
 *
 * @module animation/text-effects/presets
 */

/**
 * Configuration options for useScramble hook
 * @see https://github.com/tol-is/use-scramble
 */
export interface ScrambleConfig {
  /** Internal clock framerate. 1 = 60fps. Range: 0-1 */
  speed?: number
  /** Redraw frequency multiplier. Works with speed for pace control */
  tick?: number
  /** Characters to advance per redraw */
  step?: number
  /** Randomization iterations per character. 0 = typewriter effect */
  scramble?: number
  /** Random characters ahead of animation step */
  seed?: number
  /** Chance of scrambling a character. Range: 0-1 */
  chance?: number
  /** Unicode character range [start, end] */
  range?: [number, number]
  /** Trailing character. true = underscore (95), or custom unicode value */
  overdrive?: boolean | number
  /** Whether animation replaces previous text or resets */
  overflow?: boolean
  /** Characters to ignore when animating */
  ignore?: string[]
  /** Skip animation on first mount */
  playOnMount?: boolean
}

/**
 * Preset names available in TMNL
 */
export type ScramblePreset =
  | 'cyber'
  | 'typewriter'
  | 'glitch'
  | 'matrix'
  | 'terminal'
  | 'smooth'
  | 'rapid'
  | 'dramatic'

/**
 * Cyber preset - Classic hacker-style scramble
 *
 * Fast scramble with high randomization, good for UI transitions.
 */
export const cyberPreset: ScrambleConfig = {
  speed: 0.6,
  tick: 1,
  step: 1,
  scramble: 3,
  seed: 2,
  chance: 0.8,
  overdrive: true,
  overflow: false,
  playOnMount: false,
}

/**
 * Typewriter preset - Character-by-character reveal
 *
 * No scramble, just sequential character appearance.
 */
export const typewriterPreset: ScrambleConfig = {
  speed: 0.5,
  tick: 1,
  step: 1,
  scramble: 0, // No scramble = typewriter effect
  seed: 0,
  chance: 1,
  overdrive: false,
  overflow: false,
  playOnMount: false,
}

/**
 * Glitch preset - Aggressive visual distortion
 *
 * High scramble count with extended character range for chaotic effect.
 */
export const glitchPreset: ScrambleConfig = {
  speed: 0.8,
  tick: 1,
  step: 2,
  scramble: 8,
  seed: 4,
  chance: 0.95,
  range: [33, 126], // Full ASCII printable range
  overdrive: 9608, // Unicode block character █
  overflow: true,
  playOnMount: false,
}

/**
 * Matrix preset - Green rain aesthetic
 *
 * Slower reveal with katakana-inspired range.
 */
export const matrixPreset: ScrambleConfig = {
  speed: 0.4,
  tick: 2,
  step: 1,
  scramble: 5,
  seed: 3,
  chance: 0.7,
  range: [0x30a0, 0x30ff], // Katakana range
  overdrive: true,
  overflow: false,
  playOnMount: false,
}

/**
 * Terminal preset - Clean monospace transition
 *
 * Minimal scramble, feels like a command-line update.
 */
export const terminalPreset: ScrambleConfig = {
  speed: 0.7,
  tick: 1,
  step: 1,
  scramble: 1,
  seed: 1,
  chance: 0.5,
  range: [65, 90], // Uppercase letters only
  overdrive: 95, // Underscore
  overflow: false,
  playOnMount: false,
}

/**
 * Smooth preset - Subtle, professional transition
 *
 * Low scramble, fast speed. Good for status indicators.
 */
export const smoothPreset: ScrambleConfig = {
  speed: 0.8,
  tick: 1,
  step: 2,
  scramble: 2,
  seed: 1,
  chance: 0.6,
  overdrive: false,
  overflow: false,
  playOnMount: false,
}

/**
 * Rapid preset - Quick scramble for instant feedback
 *
 * High speed, minimal duration. Good for button labels.
 */
export const rapidPreset: ScrambleConfig = {
  speed: 1,
  tick: 1,
  step: 3,
  scramble: 2,
  seed: 1,
  chance: 0.9,
  overdrive: true,
  overflow: false,
  playOnMount: false,
}

/**
 * Dramatic preset - Slow, cinematic reveal
 *
 * Extended scramble duration for emphasis.
 */
export const dramaticPreset: ScrambleConfig = {
  speed: 0.3,
  tick: 2,
  step: 1,
  scramble: 6,
  seed: 3,
  chance: 0.8,
  overdrive: true,
  overflow: false,
  playOnMount: false,
}

/**
 * Map of preset names to configurations
 */
export const SCRAMBLE_PRESETS: Record<ScramblePreset, ScrambleConfig> = {
  cyber: cyberPreset,
  typewriter: typewriterPreset,
  glitch: glitchPreset,
  matrix: matrixPreset,
  terminal: terminalPreset,
  smooth: smoothPreset,
  rapid: rapidPreset,
  dramatic: dramaticPreset,
}

/**
 * Get a preset configuration by name
 */
export function getScramblePreset(name: ScramblePreset): ScrambleConfig {
  return SCRAMBLE_PRESETS[name]
}

/**
 * Merge a preset with custom overrides
 */
export function extendPreset(
  preset: ScramblePreset | ScrambleConfig,
  overrides?: Partial<ScrambleConfig>
): ScrambleConfig {
  const base = typeof preset === 'string' ? SCRAMBLE_PRESETS[preset] : preset
  return { ...base, ...overrides }
}
