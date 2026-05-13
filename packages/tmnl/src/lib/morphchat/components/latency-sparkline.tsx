/**
 * LatencySparkline — Tufte word-sized graphic.
 * 32×8px SVG polyline from a ring buffer of latency readings.
 * Endpoint dot colored to the smart-dot quality color.
 *
 * @module morphchat/components/latency-sparkline
 */

import * as React from 'react'

// ─── Quality color interpolation ─────────────────────────────────────────────

const QUALITY_STOPS: Array<[number, string]> = [
  [0,    '#34d399'],  // bright green
  [50,   '#34d399'],  // bright green
  [100,  '#86efac'],  // green-yellow
  [200,  '#fbbf24'],  // amber
  [500,  '#ea580c'],  // dark orange (NOT red — red is error-only)
  [1000, '#c2410c'],  // deep orange
]

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

// ─── Sparkline ───────────────────────────────────────────────────────────────

interface SparklineProps {
  readings: readonly number[]
  color: string
  width?: number
  height?: number
}

export const LatencySparkline = React.memo(function LatencySparkline({
  readings, color, width = 32, height = 8,
}: SparklineProps) {
  if (readings.length < 2) return null

  // Auto-scale Y: clamp to reasonable range
  const min = 0
  const max = Math.max(200, ...readings)
  const padY = 1 // 1px padding top/bottom

  const points = readings.map((v, i) => {
    const x = (i / (readings.length - 1)) * width
    const y = padY + ((1 - Math.min(v, max) / max) * (height - padY * 2))
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const lastX = width
  const lastY = padY + ((1 - Math.min(readings[readings.length - 1], max) / max) * (height - padY * 2))

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke="#525252"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={1.5} fill={color} />
    </svg>
  )
})
