/**
 * RvnButton (Base UI) - Brutalist Button Component
 *
 * Wraps Base UI Button with RVN styling:
 * - 3px border
 * - 4px 4px shadow
 * - Press: remove shadow, translate(4px, 4px)
 * - Uppercase text
 *
 * This is the Base UI version. The native version is at ../primitives/RvnButton.tsx
 *
 * @example
 * ```tsx
 * <RvnButton onClick={handleClick}>Deploy Unit</RvnButton>
 *
 * <RvnButton variant="primary">Confirm Action</RvnButton>
 *
 * <RvnButton variant="ghost">Cancel</RvnButton>
 * ```
 */

import * as React from 'react'
import { Button, type ButtonProps } from '@base-ui-components/react/button'
import {
  RVN_COLORS,
  RVN_BORDERS,
  RVN_SHADOWS,
  RVN_PRESS_TRANSFORM,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_SPACING,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type RvnButtonVariant = 'default' | 'primary' | 'ghost'
export type RvnButtonSize = 'sm' | 'md' | 'lg'

export interface RvnButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  /** Button visual variant */
  variant?: RvnButtonVariant
  /** Button size */
  size?: RvnButtonSize
  /** Full width button */
  fullWidth?: boolean
  /** Whether the button should ignore user interaction */
  disabled?: boolean
  /** Children content */
  children?: React.ReactNode
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const sizeStyles: Record<RvnButtonSize, React.CSSProperties> = {
  sm: {
    padding: '8px 16px',
    fontSize: RVN_FONT_SIZES.label,
  },
  md: {
    padding: '12px 24px',
    fontSize: RVN_FONT_SIZES.label,
  },
  lg: {
    padding: '16px 32px',
    fontSize: RVN_FONT_SIZES.heading,
  },
}

const getBaseStyle = (
  variant: RvnButtonVariant,
  size: RvnButtonSize,
  isPressed: boolean,
  isHovered: boolean,
  disabled: boolean,
  fullWidth: boolean
): React.CSSProperties => {
  const isPrimary = variant === 'primary'
  const isGhost = variant === 'ghost'

  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: RVN_SPACING.xs,
    background: 'transparent',
    border: RVN_BORDERS.primary,
    color: RVN_COLORS.textMain,
    fontFamily: RVN_FONTS.sans,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    borderRadius: RVN_BORDERS.radius,
    boxShadow: RVN_SHADOWS.default,
    transform: 'translate(0, 0)',
    width: fullWidth ? '100%' : 'auto',
    letterSpacing: '0.05em',
    ...sizeStyles[size],
  }

  // Primary variant
  if (isPrimary) {
    base.background = RVN_COLORS.black
    base.color = RVN_COLORS.white
  }

  // Ghost variant
  if (isGhost) {
    base.border = 'none'
    base.boxShadow = 'none'
    base.background = 'transparent'
  }

  // Hover state (only if not pressed, not disabled)
  if (isHovered && !isPressed && !disabled && !isGhost) {
    base.background = RVN_COLORS.black
    base.color = RVN_COLORS.white
  }

  // Pressed state
  if (isPressed && !disabled) {
    base.boxShadow = RVN_SHADOWS.pressed
    base.transform = RVN_PRESS_TRANSFORM.transform
  }

  // Disabled state
  if (disabled) {
    base.opacity = RVN_COLORS.disabledOpacity
    base.cursor = 'not-allowed'
  }

  return base
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const RvnButton = React.forwardRef<HTMLButtonElement, RvnButtonProps>(
  (
    {
      variant = 'default',
      size = 'md',
      fullWidth = false,
      disabled = false,
      style,
      onMouseDown,
      onMouseUp,
      onMouseLeave,
      onMouseEnter,
      ...props
    },
    ref
  ) => {
    const [isPressed, setIsPressed] = React.useState(false)
    const [isHovered, setIsHovered] = React.useState(false)

    const handleMouseDown = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!disabled) {
          setIsPressed(true)
        }
        onMouseDown?.(e)
      },
      [disabled, onMouseDown]
    )

    const handleMouseUp = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        setIsPressed(false)
        onMouseUp?.(e)
      },
      [onMouseUp]
    )

    const handleMouseLeave = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        setIsPressed(false)
        setIsHovered(false)
        onMouseLeave?.(e)
      },
      [onMouseLeave]
    )

    const handleMouseEnter = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!disabled) {
          setIsHovered(true)
        }
        onMouseEnter?.(e)
      },
      [disabled, onMouseEnter]
    )

    const buttonStyle = getBaseStyle(
      variant,
      size,
      isPressed,
      isHovered,
      !!disabled,
      fullWidth
    )

    return (
      <Button
        ref={ref}
        disabled={disabled}
        style={{ ...buttonStyle, ...style }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
        data-variant={variant}
        data-pressed={isPressed || undefined}
        {...props}
      />
    )
  }
)

RvnButton.displayName = 'RvnButton'

export { RvnButton as RvnButtonBaseUI }
