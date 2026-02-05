/**
 * RvnButton - Brutalist Button Component (Base UI)
 *
 * Wraps Base UI Button with RVN styling.
 *
 * Features:
 * - 3px solid black border
 * - 4px 4px box-shadow, removed on press
 * - Press state with translate(4px, 4px)
 * - Hover inverts to black bg / white text
 * - Primary variant (filled black)
 * - Compound pattern with Icon/Label slots
 */

import * as React from 'react'
import { createContext, useContext, useState, useCallback, forwardRef } from 'react'
import type { CSSProperties, ReactNode, ButtonHTMLAttributes } from 'react'
import { Button } from '@base-ui-components/react/button'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_BORDERS,
  RVN_SHADOWS,
  RVN_COLORS,
  RVN_PRESS_TRANSFORM,
  RVN_SPACING,
} from '../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type RvnButtonVariant = 'default' | 'primary' | 'ghost'
export type RvnButtonSize = 'sm' | 'md' | 'lg'

export interface RvnButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button visual variant */
  variant?: RvnButtonVariant
  /** Button size */
  size?: RvnButtonSize
  /** Controlled pressed state */
  pressed?: boolean
  /** Full width */
  fullWidth?: boolean
  /** Additional style overrides */
  style?: CSSProperties
  children?: ReactNode
}

export interface RvnButtonIconProps {
  children: ReactNode
  style?: CSSProperties
}

export interface RvnButtonLabelProps {
  children: ReactNode
  style?: CSSProperties
}

// -----------------------------------------------------------------------------
// Context (for compound pattern)
// -----------------------------------------------------------------------------

interface RvnButtonContextValue {
  isPressed: boolean
  isHovered: boolean
  variant: RvnButtonVariant
  size: RvnButtonSize
}

const RvnButtonContext = createContext<RvnButtonContextValue | null>(null)

function useRvnButtonContext() {
  const ctx = useContext(RvnButtonContext)
  if (!ctx) {
    throw new Error('RvnButton compound components must be used within RvnButton')
  }
  return ctx
}

// -----------------------------------------------------------------------------
// Style Builders
// -----------------------------------------------------------------------------

const SIZE_STYLES: Record<RvnButtonSize, CSSProperties> = {
  sm: {
    padding: '8px 16px',
    fontSize: RVN_FONT_SIZES.label, // 12px - THE FLOOR
  },
  md: {
    padding: '12px 24px',
    fontSize: RVN_FONT_SIZES.label, // 12px
  },
  lg: {
    padding: '16px 32px',
    fontSize: RVN_FONT_SIZES.heading, // 14px
  },
}

function getBaseStyle(
  variant: RvnButtonVariant,
  size: RvnButtonSize,
  isPressed: boolean,
  isHovered: boolean,
  disabled: boolean,
  fullWidth: boolean
): CSSProperties {
  const isPrimary = variant === 'primary'
  const isGhost = variant === 'ghost'

  // Base style from source
  const base: CSSProperties = {
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
    borderRadius: RVN_BORDERS.radius, // 0px
    boxShadow: RVN_SHADOWS.default,
    transform: 'translate(0, 0)',
    width: fullWidth ? '100%' : 'auto',
    letterSpacing: '0.05em',
    ...SIZE_STYLES[size],
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
// Compound Components
// -----------------------------------------------------------------------------

/**
 * RvnButton.Icon - Icon slot for button
 *
 * @example
 * ```tsx
 * <RvnButton>
 *   <RvnButton.Icon><PlusIcon /></RvnButton.Icon>
 *   <RvnButton.Label>Add Unit</RvnButton.Label>
 * </RvnButton>
 * ```
 */
function RvnButtonIcon({ children, style }: RvnButtonIconProps) {
  // Context usage kept for future enhancements
  useRvnButtonContext()

  const iconStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...style,
  }

  return <span style={iconStyle}>{children}</span>
}

/**
 * RvnButton.Label - Text label slot for button
 *
 * @example
 * ```tsx
 * <RvnButton>
 *   <RvnButton.Label>Deploy</RvnButton.Label>
 * </RvnButton>
 * ```
 */
function RvnButtonLabel({ children, style }: RvnButtonLabelProps) {
  // Context usage kept for future enhancements
  useRvnButtonContext()

  const labelStyle: CSSProperties = {
    display: 'inline-block',
    ...style,
  }

  return <span style={labelStyle}>{children}</span>
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

/**
 * RvnButton - Brutalist button component (Base UI)
 *
 * Supports compound pattern with Icon and Label slots.
 * Wraps Base UI Button for accessibility and keyboard handling.
 *
 * @example Basic usage
 * ```tsx
 * <RvnButton onClick={handleClick}>Deploy Unit</RvnButton>
 * ```
 *
 * @example Primary variant
 * ```tsx
 * <RvnButton variant="primary">Confirm Action</RvnButton>
 * ```
 *
 * @example Compound pattern
 * ```tsx
 * <RvnButton>
 *   <RvnButton.Icon><DeployIcon /></RvnButton.Icon>
 *   <RvnButton.Label>Deploy TX-99</RvnButton.Label>
 * </RvnButton>
 * ```
 */
const RvnButtonRoot = forwardRef<HTMLButtonElement, RvnButtonProps>(
  function RvnButtonRoot(
    {
      variant = 'default',
      size = 'md',
      pressed: controlledPressed,
      fullWidth = false,
      disabled = false,
      style,
      children,
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

    const buttonStyle = {
      ...getBaseStyle(variant, size, isPressed, isHovered, !!disabled, fullWidth),
      ...style,
    }

    const contextValue: RvnButtonContextValue = {
      isPressed,
      isHovered,
      variant,
      size,
    }

    return (
      <RvnButtonContext.Provider value={contextValue}>
        <Button
          ref={ref}
          disabled={disabled}
          style={buttonStyle}
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
      </RvnButtonContext.Provider>
    )
  }
)

// -----------------------------------------------------------------------------
// Compound Component Export
// -----------------------------------------------------------------------------

export const RvnButton = Object.assign(RvnButtonRoot, {
  Icon: RvnButtonIcon,
  Label: RvnButtonLabel,
})

export type { RvnButtonContextValue }
