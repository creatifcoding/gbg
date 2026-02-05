/**
 * RvnToggle - Brutalist Toggle Button (Base UI)
 *
 * Wraps Base UI Toggle with RVN styling.
 *
 * Features:
 * - 3px black border
 * - Inverted on pressed
 * - 4px shadow (removed on press)
 */

import * as React from 'react'
import { Toggle as BaseToggle } from '@base-ui-components/react/toggle'
import { clsx } from 'clsx'
import type { CSSProperties, ReactNode } from 'react'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_BORDERS,
  RVN_COLORS,
  RVN_SHADOWS,
  RVN_SPACING,
  RVN_PRESS_TRANSFORM,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnToggleProps {
  /** Controlled pressed state */
  pressed?: boolean
  /** Default pressed state (uncontrolled) */
  defaultPressed?: boolean
  /** Change handler */
  onPressedChange?: (pressed: boolean) => void
  /** Toggle content */
  children: ReactNode
  /** Disabled state */
  disabled?: boolean
  /** Additional class name */
  className?: string
  /** Additional style overrides */
  style?: CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const baseStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: RVN_SPACING.buttonPadding,
  fontFamily: RVN_FONTS.sans,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.bold,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  border: RVN_BORDERS.primary,
  borderRadius: RVN_BORDERS.radius,
  background: RVN_COLORS.surface,
  color: RVN_COLORS.textMain,
  boxShadow: RVN_SHADOWS.default,
  cursor: 'pointer',
  outline: 'none',
  transition: 'all 100ms ease-out',
}

const pressedStyles: CSSProperties = {
  background: RVN_COLORS.black,
  color: RVN_COLORS.white,
  boxShadow: RVN_SHADOWS.pressed,
  transform: RVN_PRESS_TRANSFORM.transform,
}

const disabledStyles: CSSProperties = {
  opacity: RVN_COLORS.disabledOpacity,
  cursor: 'not-allowed',
  boxShadow: 'none',
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function RvnToggle({
  pressed,
  defaultPressed,
  onPressedChange,
  children,
  disabled = false,
  className,
  style,
}: RvnToggleProps) {
  const [internalPressed, setInternalPressed] = React.useState(defaultPressed ?? false)
  const isControlled = pressed !== undefined
  const isPressed = isControlled ? pressed : internalPressed

  const handleChange = (newPressed: boolean) => {
    if (!isControlled) {
      setInternalPressed(newPressed)
    }
    onPressedChange?.(newPressed)
  }

  const computedStyle: CSSProperties = {
    ...baseStyles,
    ...(isPressed && pressedStyles),
    ...(disabled && disabledStyles),
    ...style,
  }

  return (
    <BaseToggle
      className={clsx('rvn-toggle', className)}
      pressed={isPressed}
      onPressedChange={handleChange}
      disabled={disabled}
      style={computedStyle}
    >
      {children}
    </BaseToggle>
  )
}
