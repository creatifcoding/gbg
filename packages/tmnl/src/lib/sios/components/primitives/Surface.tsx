import type { CSSProperties, ReactNode } from 'react'
import { color, space, radius, duration, easing, type Space, type SemanticColor, semanticColorValue } from '../tokens'

export interface SurfaceProps {
  children: ReactNode
  variant?: 'default' | 'ghost' | 'inset' | 'elevated'
  padding?: Space | [Space, Space]
  accent?: SemanticColor
  accentSide?: 'top' | 'bottom' | 'left'
  accentWeight?: 'thin' | 'thick'
  interactive?: boolean
  as?: keyof JSX.IntrinsicElements
  className?: string
  style?: CSSProperties
}

const variantStyles: Record<string, CSSProperties> = {
  default:  { background: color.surface, border: `1px solid ${color.border}` },
  ghost:    { background: 'transparent', border: 'none' },
  inset:    { background: color.surfaceAlt, border: `1px solid ${color.border}` },
  elevated: { background: color.surface, border: `1px solid ${color.borderBright}`, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' },
}

export function Surface({
  children,
  variant = 'default',
  padding,
  accent,
  accentSide = 'bottom',
  accentWeight = 'thin',
  interactive,
  as: Tag = 'div',
  className,
  style: styleProp,
}: SurfaceProps) {
  const pad = padding !== undefined
    ? Array.isArray(padding) ? `${space[padding[0]]} ${space[padding[1]]}` : space[padding]
    : undefined

  const accentWidth = accentWeight === 'thick' ? '4px' : '2px'
  const accentColor = accent ? semanticColorValue[accent] : undefined

  const accentBorder = accentColor ? {
    [`border${accentSide === 'top' ? 'Top' : accentSide === 'left' ? 'Left' : 'Bottom'}`]: `${accentWidth} solid ${accentColor}`,
  } : {}

  const style: CSSProperties = {
    ...variantStyles[variant],
    borderRadius: radius.lg,
    padding: pad,
    transition: interactive ? `border-color ${duration.normal} ${easing.default}, background ${duration.normal} ${easing.default}` : undefined,
    cursor: interactive ? 'pointer' : undefined,
    ...accentBorder,
    ...styleProp,
  }

  return <Tag className={className} style={style}>{children}</Tag>
}
