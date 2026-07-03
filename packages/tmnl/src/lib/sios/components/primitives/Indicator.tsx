import type { CSSProperties } from 'react'
import { color, radius, duration, easing, type SemanticColor, semanticColorValue } from '../tokens'

export interface IndicatorProps {
  value: number // 0-1
  color?: SemanticColor
  height?: number
  rounded?: boolean
  animate?: boolean
}

export function Indicator({ value, color: colorProp = 'cyan', height = 4, rounded = true, animate = true }: IndicatorProps) {
  const c = semanticColorValue[colorProp]
  const clamped = Math.max(0, Math.min(1, value))

  const trackStyle: CSSProperties = {
    width: '100%',
    height,
    backgroundColor: color.border,
    borderRadius: rounded ? radius.full : 0,
    overflow: 'hidden',
  }

  const fillStyle: CSSProperties = {
    width: `${clamped * 100}%`,
    height: '100%',
    backgroundColor: c,
    borderRadius: rounded ? radius.full : 0,
    transition: animate ? `width ${duration.slow} ${easing.default}` : undefined,
  }

  return (
    <div style={trackStyle}>
      <div style={fillStyle} />
    </div>
  )
}
