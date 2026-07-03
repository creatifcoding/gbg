import type { CSSProperties } from 'react'
import { color, font, fontSize, fontWeight, duration, easing, type SemanticColor, semanticColorValue } from '../tokens'

export interface GaugeThreshold {
  at: number
  color: SemanticColor
}

export interface GaugeProps {
  value: number
  min?: number
  max?: number
  thresholds: GaugeThreshold[]
  size?: number
  label?: string
  animate?: boolean
}

export function Gauge({ value, min = 0, max = 2, thresholds, size = 120, label, animate = true }: GaugeProps) {
  const clamped = Math.max(min, Math.min(max, value))
  const fraction = (clamped - min) / (max - min)
  const needleAngle = -90 + fraction * 180 // -90 to 90 degrees

  // Determine current zone color
  let zoneColor: SemanticColor = thresholds[0]?.color ?? 'muted'
  for (const t of thresholds) {
    if (clamped >= t.at) zoneColor = t.color
  }

  const cx = size / 2
  const cy = size * 0.65
  const r = size * 0.4
  const strokeW = size * 0.06

  // Build arc segments for threshold zones
  const arcs: JSX.Element[] = []
  for (let i = 0; i < thresholds.length; i++) {
    const start = (thresholds[i].at - min) / (max - min)
    const end = i < thresholds.length - 1 ? (thresholds[i + 1].at - min) / (max - min) : 1
    const startAngle = Math.PI + start * Math.PI
    const endAngle = Math.PI + end * Math.PI
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
    arcs.push(
      <path
        key={i}
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
        fill="none"
        stroke={semanticColorValue[thresholds[i].color]}
        strokeWidth={strokeW}
        strokeLinecap="round"
        opacity={0.4}
      />
    )
  }

  const needleLen = r * 0.85

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size * 0.7} viewBox={`0 0 ${size} ${size * 0.7}`}>
        {/* Track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke={color.border} strokeWidth={strokeW} strokeLinecap="round"
        />
        {/* Threshold zones */}
        {arcs}
        {/* Needle */}
        <line
          x1={cx} y1={cy}
          x2={cx + needleLen * Math.cos(Math.PI + (fraction * Math.PI))}
          y2={cy + needleLen * Math.sin(Math.PI + (fraction * Math.PI))}
          stroke={semanticColorValue[zoneColor]}
          strokeWidth={2}
          strokeLinecap="round"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transition: animate ? `all ${duration.gauge} ${easing.out}` : undefined,
          }}
        />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={3} fill={semanticColorValue[zoneColor]} />
        {/* Value text */}
        <text x={cx} y={cy - 10} textAnchor="middle" fill={semanticColorValue[zoneColor]}
          style={{ fontFamily: font.mono, fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>
          {value.toFixed(2)}
        </text>
      </svg>
      {label && (
        <span style={{ fontFamily: font.mono, fontSize: fontSize.xs, color: color.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
      )}
    </div>
  )
}
