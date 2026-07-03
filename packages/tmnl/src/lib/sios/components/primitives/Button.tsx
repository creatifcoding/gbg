import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize as fs, fontWeight, radius, duration, easing, space, type SemanticColor, semanticColorValue, semanticColorDim } from '../tokens'

export interface ButtonProps {
  children?: ReactNode
  onClick?: () => void
  variant?: 'solid' | 'outline' | 'ghost'
  color?: SemanticColor
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  icon?: ReactNode
  iconOnly?: boolean
  arrow?: boolean
  fullWidth?: boolean
  type?: 'button' | 'submit'
}

const sizeConfig = {
  sm: { fontSize: fs.sm, padding: `${space[1]} ${space[2]}`, height: '28px' },
  md: { fontSize: fs.md, padding: `${space[2]} ${space[4]}`, height: '34px' },
  lg: { fontSize: fs.base, padding: `${space[2]} ${space[5]}`, height: '40px' },
} as const

export function Button({
  children,
  onClick,
  variant = 'solid',
  color: colorProp = 'cyan',
  size = 'md',
  disabled,
  loading,
  icon,
  iconOnly,
  arrow,
  fullWidth,
  type = 'button',
}: ButtonProps) {
  const c = semanticColorValue[colorProp]
  const dim = semanticColorDim[colorProp]
  const sc = sizeConfig[size]
  const isDisabled = disabled || loading

  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: space[2],
    fontFamily: font.sans, fontSize: sc.fontSize, fontWeight: fontWeight.semibold,
    borderRadius: radius.md, cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1, border: 'none', outline: 'none',
    transition: `all ${duration.normal} ${easing.default}`,
    height: sc.height, width: fullWidth ? '100%' : iconOnly ? sc.height : undefined,
    padding: iconOnly ? '0' : sc.padding,
    whiteSpace: 'nowrap',
  }

  const variantStyle: CSSProperties = variant === 'solid'
    ? { background: c, color: '#fff' }
    : variant === 'outline'
    ? { background: 'transparent', color: c, border: `1px solid ${c}66` }
    : { background: dim, color: c }

  const content = (
    <>
      {loading && <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>}
      {!loading && icon}
      {!iconOnly && children}
      {!iconOnly && arrow && ' →'}
    </>
  )

  return (
    <button type={type} onClick={isDisabled ? undefined : onClick} disabled={isDisabled} style={{ ...base, ...variantStyle }}>
      {content}
    </button>
  )
}
