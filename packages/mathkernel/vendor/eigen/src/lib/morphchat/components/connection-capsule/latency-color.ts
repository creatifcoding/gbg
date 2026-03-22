/**
 * Latency → Quality Color
 *
 * Continuous interpolation across quality stops.
 * green → green-yellow → amber → dark orange → deep orange.
 * NO RED — red is reserved for error phase in the chrome.
 *
 * @module connection-capsule/latency-color
 */

const QUALITY_STOPS: ReadonlyArray<readonly [number, string]> = [
  [0,    '#34d399'],  // bright green
  [50,   '#34d399'],  // bright green
  [100,  '#86efac'],  // green-yellow
  [200,  '#fbbf24'],  // amber
  [500,  '#ea580c'],  // dark orange
  [1000, '#c2410c'],  // deep orange
] as const

/** Map latency ms → quality hex color. Continuous interpolation. */
export function latencyColor(ms: number | undefined | null): string {
  if (ms == null || ms <= 0) return '#34d399'
  for (let i = 1; i < QUALITY_STOPS.length; i++) {
    const [lo, cLo] = QUALITY_STOPS[i - 1]
    const [hi, cHi] = QUALITY_STOPS[i]
    if (ms <= hi) {
      const t = (ms - lo) / (hi - lo)
      return lerpHex(cLo, cHi, t)
    }
  }
  return QUALITY_STOPS[QUALITY_STOPS.length - 1][1]
}

/** Map latency → glow shadow string */
export function latencyGlow(ms: number | undefined | null): string {
  const c = latencyColor(ms)
  return `0 0 4px ${c}80`
}

// ─── Color math ──────────────────────────────────────────────────────────────

function lerpHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexRgb(a)
  const [r2, g2, b2] = hexRgb(b)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const bl = Math.round(b1 + (b2 - b1) * t)
  return `#${hex(r)}${hex(g)}${hex(bl)}`
}

function hexRgb(h: string): [number, number, number] {
  const s = h.replace('#', '')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}

function hex(n: number): string { return n.toString(16).padStart(2, '0') }
