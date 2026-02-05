/**
 * Color Gradient Interpolation System
 *
 * Provides smooth color transitions for animated bars.
 * Supports multi-stop gradients with customizable color spaces.
 *
 * @example Basic gradient (green → yellow → red)
 * ```ts
 * const gradient = createGradient([
 *   { stop: 0, color: '#22c55e' },   // green
 *   { stop: 50, color: '#eab308' },  // yellow
 *   { stop: 100, color: '#ef4444' }, // red
 * ])
 *
 * const color = gradient.at(75) // Interpolated orange
 * ```
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface GradientStop {
  /** Position in gradient (0-100) */
  stop: number
  /** Hex color at this stop */
  color: string
}

export interface GradientConfig {
  /** Array of color stops */
  stops: GradientStop[]
  /** Interpolation mode (default: 'rgb') */
  mode?: 'rgb' | 'hsl'
}

export interface Gradient {
  /** Get interpolated color at a position (0-100) */
  at: (position: number) => string
  /** Get all stops */
  stops: GradientStop[]
}

// -----------------------------------------------------------------------------
// Preset Gradients
// -----------------------------------------------------------------------------

/**
 * Pre-built gradient configurations for common use cases.
 */
export const GRADIENT_PRESETS = {
  /** Traffic light: green → yellow → red */
  traffic: [
    { stop: 0, color: '#22c55e' },
    { stop: 50, color: '#eab308' },
    { stop: 100, color: '#ef4444' },
  ],

  /** Inverse traffic: red → yellow → green */
  trafficInverse: [
    { stop: 0, color: '#ef4444' },
    { stop: 50, color: '#eab308' },
    { stop: 100, color: '#22c55e' },
  ],

  /** Heat: blue → cyan → green → yellow → red */
  heat: [
    { stop: 0, color: '#3b82f6' },
    { stop: 25, color: '#06b6d4' },
    { stop: 50, color: '#22c55e' },
    { stop: 75, color: '#eab308' },
    { stop: 100, color: '#ef4444' },
  ],

  /** Cool: deep blue → cyan → white */
  cool: [
    { stop: 0, color: '#1e3a8a' },
    { stop: 50, color: '#06b6d4' },
    { stop: 100, color: '#f0f9ff' },
  ],

  /** Warm: orange → red → magenta */
  warm: [
    { stop: 0, color: '#f97316' },
    { stop: 50, color: '#ef4444' },
    { stop: 100, color: '#ec4899' },
  ],

  /** Monochrome: light gray → black */
  mono: [
    { stop: 0, color: '#d4d4d4' },
    { stop: 100, color: '#000000' },
  ],

  /** Brutalist: white → black (RVN default) */
  brutalist: [
    { stop: 0, color: '#ffffff' },
    { stop: 100, color: '#000000' },
  ],

  /** Alert: green → amber → red (thresholds at 60/80) */
  alert: [
    { stop: 0, color: '#22c55e' },
    { stop: 60, color: '#22c55e' },
    { stop: 70, color: '#f59e0b' },
    { stop: 80, color: '#f59e0b' },
    { stop: 90, color: '#ef4444' },
    { stop: 100, color: '#ef4444' },
  ],

  /** CPU/Memory style: blue → green → yellow → red */
  system: [
    { stop: 0, color: '#3b82f6' },
    { stop: 40, color: '#22c55e' },
    { stop: 70, color: '#eab308' },
    { stop: 90, color: '#ef4444' },
    { stop: 100, color: '#dc2626' },
  ],

  /** Cyberpunk: cyan → magenta */
  cyber: [
    { stop: 0, color: '#06b6d4' },
    { stop: 50, color: '#8b5cf6' },
    { stop: 100, color: '#ec4899' },
  ],

  /** Terminal: black → green (matrix style) */
  terminal: [
    { stop: 0, color: '#052e16' },
    { stop: 100, color: '#22c55e' },
  ],
} as const satisfies Record<string, GradientStop[]>

export type GradientPreset = keyof typeof GRADIENT_PRESETS

// -----------------------------------------------------------------------------
// Color Utilities
// -----------------------------------------------------------------------------

/**
 * Parse hex color to RGB components
 */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const bigint = parseInt(clean, 16)
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) {
    return [0, 0, l]
  }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h = 0
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6
      break
    case g:
      h = ((b - r) / d + 2) / 6
      break
    case b:
      h = ((r - g) / d + 4) / 6
      break
  }

  return [h, s, l]
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const gray = Math.round(l * 255)
    return [gray, gray, gray]
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ]
}

/**
 * Interpolate between two colors in RGB space
 */
function interpolateRgb(color1: string, color2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(color1)
  const [r2, g2, b2] = hexToRgb(color2)

  return rgbToHex(
    r1 + (r2 - r1) * t,
    g1 + (g2 - g1) * t,
    b1 + (b2 - b1) * t
  )
}

/**
 * Interpolate between two colors in HSL space (smoother for hue shifts)
 */
function interpolateHsl(color1: string, color2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(color1)
  const [r2, g2, b2] = hexToRgb(color2)

  const [h1, s1, l1] = rgbToHsl(r1, g1, b1)
  const [h2, s2, l2] = rgbToHsl(r2, g2, b2)

  // Handle hue wrapping (take shortest path)
  let hDiff = h2 - h1
  if (hDiff > 0.5) hDiff -= 1
  if (hDiff < -0.5) hDiff += 1

  const h = (h1 + hDiff * t + 1) % 1
  const s = s1 + (s2 - s1) * t
  const l = l1 + (l2 - l1) * t

  const [r, g, b] = hslToRgb(h, s, l)
  return rgbToHex(r, g, b)
}

// -----------------------------------------------------------------------------
// Gradient Factory
// -----------------------------------------------------------------------------

/**
 * Create a gradient interpolator from stops.
 *
 * @example
 * ```ts
 * const gradient = createGradient([
 *   { stop: 0, color: '#00ff00' },
 *   { stop: 100, color: '#ff0000' },
 * ])
 *
 * gradient.at(50) // '#808000' (yellow-ish)
 * ```
 */
export function createGradient(
  stops: GradientStop[],
  mode: 'rgb' | 'hsl' = 'rgb'
): Gradient {
  // Sort stops by position
  const sortedStops = [...stops].sort((a, b) => a.stop - b.stop)

  // Ensure we have at least 2 stops
  if (sortedStops.length < 2) {
    throw new Error('Gradient requires at least 2 color stops')
  }

  const interpolate = mode === 'hsl' ? interpolateHsl : interpolateRgb

  return {
    stops: sortedStops,
    at(position: number): string {
      // Clamp position
      const pos = Math.max(0, Math.min(100, position))

      // Find surrounding stops
      let lower = sortedStops[0]
      let upper = sortedStops[sortedStops.length - 1]

      for (let i = 0; i < sortedStops.length - 1; i++) {
        if (pos >= sortedStops[i].stop && pos <= sortedStops[i + 1].stop) {
          lower = sortedStops[i]
          upper = sortedStops[i + 1]
          break
        }
      }

      // Handle edge cases
      if (pos <= lower.stop) return lower.color
      if (pos >= upper.stop) return upper.color

      // Calculate interpolation factor
      const range = upper.stop - lower.stop
      const t = range === 0 ? 0 : (pos - lower.stop) / range

      return interpolate(lower.color, upper.color, t)
    },
  }
}

/**
 * Get gradient from preset name or config
 */
export function resolveGradient(
  gradient: GradientPreset | GradientStop[] | GradientConfig
): Gradient {
  if (typeof gradient === 'string') {
    return createGradient(GRADIENT_PRESETS[gradient])
  }

  if (Array.isArray(gradient)) {
    return createGradient(gradient)
  }

  return createGradient(gradient.stops, gradient.mode)
}
