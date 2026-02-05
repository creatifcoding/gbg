/**
 * RvnIconButton - Square Icon Button (Base UI)
 *
 * 44x44px square button for icon-only interactions.
 * Wraps Base UI Button for accessibility.
 * Touch-friendly, minimum 44px tap target.
 *
 * @example
 * ```tsx
 * <RvnIconButton onClick={handleClose} title="Close">
 *   <CloseIcon />
 * </RvnIconButton>
 * ```
 */

import * as React from 'react'
import { useState, useCallback, forwardRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Button } from '@base-ui-components/react/button'
import {
  RVN_BORDERS,
  RVN_SHADOWS,
  RVN_COLORS,
  RVN_PRESS_TRANSFORM,
} from '../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type RvnIconButtonSize = 'sm' | 'md' | 'lg'
export type RvnIconButtonVariant = 'default' | 'primary' | 'ghost'

export interface RvnIconButtonProps extends Omit<React.ComponentProps<typeof Button>, 'children'> {
  /** Icon element to render */
  children: ReactNode
  /** Button size (44px default for touch targets) */
  size?: RvnIconButtonSize
  /** Button variant */
  variant?: RvnIconButtonVariant
  /** Controlled pressed state */
  pressed?: boolean
  /** Accessible title/label */
  title: string
  /** Additional style overrides */
  style?: CSSProperties
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SIZE_MAP: Record<RvnIconButtonSize, number> = {
  sm: 32,
  md: 44, // Touch-friendly default
  lg: 56,
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const RvnIconButton = forwardRef<HTMLButtonElement, RvnIconButtonProps>(
  function RvnIconButton(
    {
      children,
      size = 'md',
      variant = 'default',
      pressed: controlledPressed,
      title,
      disabled = false,
      style,
      onMouseDown,
      onMouseUp,
      onMouseLeave,
      onMouseEnter,
      ...rest
    },
    ref
  ) {
    const [internalPressed, setInternalPressed] = useState(false)
    const [isHovered, setIsHovered] = useState(false)

    const isPressed = controlledPressed ?? internalPressed
    const dimension = SIZE_MAP[size]
    const isPrimary = variant === 'primary'
    const isGhost = variant === 'ghost'

    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!disabled) {
          setInternalPressed(true)
        }
        onMouseDown?.(e)
      },
      [disabled, onMouseDown]
    )

    const handleMouseUp = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        setInternalPressed(false)
        onMouseUp?.(e)
      },
      [onMouseUp]
    )

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        setInternalPressed(false)
        setIsHovered(false)
        onMouseLeave?.(e)
      },
      [onMouseLeave]
    )

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!disabled) {
          setIsHovered(true)
        }
        onMouseEnter?.(e)
      },
      [disabled, onMouseEnter]
    )

    // Base style
    const buttonStyle: CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: `${dimension}px`,
      height: `${dimension}px`,
      padding: 0,
      background: isPrimary ? RVN_COLORS.black : 'transparent',
      border: isGhost ? 'none' : RVN_BORDERS.primary,
      color: isPrimary ? RVN_COLORS.white : RVN_COLORS.textMain,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.2s',
      borderRadius: RVN_BORDERS.radius,
      boxShadow: isGhost ? 'none' : RVN_SHADOWS.default,
      transform: 'translate(0, 0)',
    }

    // Hover state
    if (isHovered && !isPressed && !disabled && !isGhost) {
      buttonStyle.background = RVN_COLORS.black
      buttonStyle.color = RVN_COLORS.white
    }

    // Pressed state
    if (isPressed && !disabled && !isGhost) {
      buttonStyle.boxShadow = RVN_SHADOWS.pressed
      buttonStyle.transform = RVN_PRESS_TRANSFORM.transform
    }

    // Disabled state
    if (disabled) {
      buttonStyle.opacity = RVN_COLORS.disabledOpacity
      buttonStyle.cursor = 'not-allowed'
    }

    return (
      <Button
        ref={ref}
        disabled={disabled}
        title={title}
        aria-label={title}
        style={{ ...buttonStyle, ...style }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
        data-variant={variant}
        data-pressed={isPressed || undefined}
        {...rest}
      >
        {children}
      </Button>
    )
  }
)
