/**
 * LatencySparkline — Tufte word-sized graphic.
 *
 * 32×8px SVG polyline from a ring buffer of latency readings.
 * Endpoint dot colored to the smart-dot quality color.
 * No axes, no labels, no chrome. Just the data.
 *
 * @module connection-capsule/latency-sparkline
 */

import { memo } from 'react'

interface SparklineProps {
  readings: readonly number[]
  color: string
  width?: number
  height?: number
}

export const LatencySparkline = memo(function LatencySparkline({
  readings, color, width = 32, height = 8,
}: SparklineProps) {
  if (readings.length < 2) return null

  const min = 0
  const max = Math.max(200, ...readings)
  const padY = 1

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
