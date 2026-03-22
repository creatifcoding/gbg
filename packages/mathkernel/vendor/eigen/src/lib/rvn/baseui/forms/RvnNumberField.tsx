/**
 * RvnNumberField - Brutalist Number Input (Base UI)
 *
 * Wraps Base UI NumberField with RVN styling.
 *
 * Features:
 * - Monospace numbers
 * - +/- buttons with 3px borders
 * - Spin controls
 */

import * as React from 'react'
import { NumberField as BaseNumberField } from '@base-ui-components/react/number-field'
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
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnNumberFieldProps {
  /** Controlled value */
  value?: number | null
  /** Default value (uncontrolled) */
  defaultValue?: number
  /** Change handler */
  onValueChange?: (value: number | null) => void
  /** Minimum value */
  min?: number
  /** Maximum value */
  max?: number
  /** Step increment */
  step?: number
  /** Large step (shift+click) */
  largeStep?: number
  /** Show spin buttons */
  showButtons?: boolean
  /** Optional label */
  label?: ReactNode
  /** Disabled state */
  disabled?: boolean
  /** Full width */
  fullWidth?: boolean
  /** Additional class name */
  className?: string
  /** Additional style overrides */
  style?: CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const containerStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: RVN_SPACING.xs,
}

const labelStyles: CSSProperties = {
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.bold,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: RVN_COLORS.textMain,
}

const groupStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
}

const inputStyles: CSSProperties = {
  flex: 1,
  minWidth: '80px',
  height: '40px',
  padding: '8px 12px',
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.body,
  fontWeight: RVN_FONT_WEIGHTS.bold,
  textAlign: 'center',
  border: RVN_BORDERS.primary,
  borderRadius: RVN_BORDERS.radius,
  background: RVN_COLORS.surface,
  color: RVN_COLORS.textMain,
  outline: 'none',
}

const inputFocusStyles: CSSProperties = {
  background: RVN_COLORS.black,
  color: RVN_COLORS.white,
}

const buttonStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  border: RVN_BORDERS.primary,
  borderRadius: RVN_BORDERS.radius,
  background: RVN_COLORS.surface,
  color: RVN_COLORS.textMain,
  fontFamily: RVN_FONTS.mono,
  fontSize: '18px',
  fontWeight: RVN_FONT_WEIGHTS.bold,
  cursor: 'pointer',
  outline: 'none',
  transition: 'all 100ms ease-out',
}

const buttonDecrementStyles: CSSProperties = {
  ...buttonStyles,
  marginRight: '-3px',
  borderTopRightRadius: 0,
  borderBottomRightRadius: 0,
}

const buttonIncrementStyles: CSSProperties = {
  ...buttonStyles,
  marginLeft: '-3px',
  borderTopLeftRadius: 0,
  borderBottomLeftRadius: 0,
}

const buttonHoverStyles: CSSProperties = {
  background: RVN_COLORS.black,
  color: RVN_COLORS.white,
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function RvnNumberField({
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  step = 1,
  largeStep = 10,
  showButtons = true,
  label,
  disabled = false,
  fullWidth = false,
  className,
  style,
}: RvnNumberFieldProps) {
  const [isFocused, setIsFocused] = React.useState(false)
  const [isDecrementHovered, setIsDecrementHovered] = React.useState(false)
  const [isIncrementHovered, setIsIncrementHovered] = React.useState(false)

  const containerStyle: CSSProperties = {
    ...containerStyles,
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? RVN_COLORS.disabledOpacity : 1,
    ...style,
  }

  return (
    <BaseNumberField.Root
      className={clsx('rvn-number-field', className)}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
      largeStep={largeStep}
      disabled={disabled}
      style={containerStyle}
    >
      {label && (
        <BaseNumberField.ScrubArea>
          <span style={labelStyles}>{label}</span>
        </BaseNumberField.ScrubArea>
      )}
      <BaseNumberField.Group style={groupStyles}>
        {showButtons && (
          <BaseNumberField.Decrement
            style={{
              ...buttonDecrementStyles,
              ...(isDecrementHovered && !disabled && buttonHoverStyles),
            }}
            onMouseEnter={() => setIsDecrementHovered(true)}
            onMouseLeave={() => setIsDecrementHovered(false)}
          >
            -
          </BaseNumberField.Decrement>
        )}
        <BaseNumberField.Input
          style={{
            ...inputStyles,
            ...(isFocused && inputFocusStyles),
            ...(showButtons && { borderRadius: 0 }),
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {showButtons && (
          <BaseNumberField.Increment
            style={{
              ...buttonIncrementStyles,
              ...(isIncrementHovered && !disabled && buttonHoverStyles),
            }}
            onMouseEnter={() => setIsIncrementHovered(true)}
            onMouseLeave={() => setIsIncrementHovered(false)}
          >
            +
          </BaseNumberField.Increment>
        )}
      </BaseNumberField.Group>
    </BaseNumberField.Root>
  )
}
