import type { CSSProperties, ReactNode } from 'react'
import { font, fontSize as fs, fontWeight, letterSpacing, radius, type SemanticColor, semanticColorValue, semanticColorDim } from '../tokens'

export interface BadgeProps {
  children: ReactNode
  color: SemanticColor
  variant?: 'solid' | 'outline' | 'ghost'
  size?: 'sm' | 'md'
}

export function Badge({ children, color: colorProp, variant = 'ghost', size = 'md' }: BadgeProps) {
  const c = semanticColorValue[colorProp]
  const dim = semanticColorDim[colorProp]

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: font.mono,
    fontSize: size === 'sm' ? fs.xs : fs.sm,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.wide,
    textTransform: 'uppercase',
    borderRadius: radius.sm,
    padding: size === 'sm' ? '1px 6px' : '2px 8px',
    lineHeight: '1.4',
    whiteSpace: 'nowrap',
    ...(variant === 'solid' ? { backgroundColor: c, color: '#fff', border: 'none' } :
      variant === 'outline' ? { backgroundColor: 'transparent', color: c, border: `1px solid ${c}66` } :
      { backgroundColor: dim, color: c, border: 'none' }),
  }

  return <span style={style}>{children}</span>
}
