import type { CSSProperties, ReactNode } from 'react'
import { color, duration, easing, type SemanticColor, semanticColorValue } from '../tokens'

export interface RingProps {
  value: number // 0-1
  size?: number
  strokeWidth?: number
  color?: SemanticColor
  trackColor?: string
  children?: ReactNode
  animate?: boolean
}

export function Ring({
  value,
  size = 80,
  strokeWidth = 6,
  color: colorProp = 'cyan',
  trackColor = color.border,
  children,
  animate = true,
}: RingProps) {
  const c = semanticColorValue[colorProp]
  const clamped = Math.max(0, Math.min(1, value))
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - clamped)

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: size,
    height: size,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const svgStyle: CSSProperties = {
    position: 'absolute',
    transform: 'rotate(-90deg)',
  }

  return (
    <div style={containerStyle}>
      <svg width={size} height={size} style={svgStyle}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={c} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: animate ? `stroke-dashoffset ${duration.gauge} ${easing.out}` : undefined }}
        />
      </svg>
      {children && <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>}
    </div>
  )
}
