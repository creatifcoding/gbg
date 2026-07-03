import type { CSSProperties, ReactNode } from 'react'
import { color, fontSize, fontWeight, font, textVariantDefaults, type TextVariant, type FontSize, type FontWeight, type SemanticColor, semanticColorValue } from '../tokens'

export interface TextProps {
  children: ReactNode
  variant?: TextVariant
  size?: FontSize
  weight?: FontWeight
  color?: SemanticColor | 'text' | 'dim' | 'muted'
  mono?: boolean
  uppercase?: boolean
  truncate?: boolean
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'div' | 'label'
  className?: string
  style?: CSSProperties
}

const colorMap: Record<string, string> = {
  text: color.text,
  dim: color.textDim,
  muted: color.textMuted,
}

export function Text({
  children,
  variant = 'body',
  size: sizeProp,
  weight: weightProp,
  color: colorProp,
  mono,
  uppercase,
  truncate,
  as: Tag = 'span',
  className,
  style: styleProp,
}: TextProps) {
  const defaults = textVariantDefaults[variant]

  const resolvedColor = colorProp
    ? (colorMap[colorProp] ?? semanticColorValue[colorProp as SemanticColor])
    : defaults.color

  const style: CSSProperties = {
    fontFamily: mono ? font.mono : defaults.fontFamily,
    fontSize: sizeProp ? fontSize[sizeProp] : defaults.fontSize,
    fontWeight: weightProp ? fontWeight[weightProp] : defaults.fontWeight,
    color: resolvedColor,
    lineHeight: defaults.lineHeight,
    letterSpacing: defaults.letterSpacing,
    textTransform: uppercase ? 'uppercase' : defaults.textTransform as any,
    margin: 0,
    ...(truncate ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}),
    ...styleProp,
  }

  return <Tag className={className} style={style}>{children}</Tag>
}
