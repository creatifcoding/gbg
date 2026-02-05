/**
 * RvnSelect - Brutalist Select Dropdown (Base UI)
 *
 * Wraps Base UI Select with RVN styling.
 *
 * Features:
 * - 3px border trigger
 * - Black dropdown popup
 * - Inverted hover on items
 * - Monospace font
 * - No border-radius (brutalist)
 */

import * as React from 'react'
import { Select as BaseSelect } from '@base-ui-components/react/select'
import { clsx } from 'clsx'
import type { CSSProperties } from 'react'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_BORDERS,
  RVN_COLORS,
  RVN_SHADOWS,
  RVN_SPACING,
} from '../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface RvnSelectProps {
  /** Options array */
  options: RvnSelectOption[]
  /** Controlled value */
  value?: string
  /** Default value (uncontrolled) */
  defaultValue?: string
  /** Change handler */
  onValueChange?: (value: string) => void
  /** Placeholder text */
  placeholder?: string
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

const triggerStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  minWidth: '120px',
  height: '40px',
  padding: '8px 36px 8px 12px',
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.bold,
  textTransform: 'uppercase',
  border: RVN_BORDERS.primary,
  borderRadius: RVN_BORDERS.radius,
  background: RVN_COLORS.surface,
  color: RVN_COLORS.textMain,
  boxShadow: RVN_SHADOWS.default,
  cursor: 'pointer',
  outline: 'none',
  position: 'relative',
}

const triggerFocusStyles: CSSProperties = {
  outline: `2px solid ${RVN_COLORS.black}`,
  outlineOffset: '2px',
}

const arrowStyles: CSSProperties = {
  position: 'absolute',
  right: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.bold,
  color: RVN_COLORS.textMain,
  pointerEvents: 'none',
}

const popupStyles: CSSProperties = {
  background: RVN_COLORS.black,
  border: RVN_BORDERS.primary,
  borderRadius: RVN_BORDERS.radius,
  boxShadow: RVN_SHADOWS.default,
  minWidth: '120px',
  maxHeight: '300px',
  overflow: 'auto',
  zIndex: 1000,
}

const optionStyles: CSSProperties = {
  padding: '10px 12px',
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.semibold,
  textTransform: 'uppercase',
  color: RVN_COLORS.white,
  cursor: 'pointer',
  outline: 'none',
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function RvnSelect({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  disabled = false,
  fullWidth = false,
  className,
  style,
}: RvnSelectProps) {
  const [isFocused, setIsFocused] = React.useState(false)

  // Find the label for the current value
  const selectedOption = React.useMemo(() => {
    const val = value ?? defaultValue
    return val ? options.find(o => o.value === val) : null
  }, [value, defaultValue, options])

  const triggerStyle: CSSProperties = {
    ...triggerStyles,
    ...(isFocused && triggerFocusStyles),
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? RVN_COLORS.disabledOpacity : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    ...style,
  }

  return (
    <BaseSelect.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <BaseSelect.Trigger
        className={clsx('rvn-select-trigger', className)}
        style={triggerStyle}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      >
        <BaseSelect.Value placeholder={placeholder?.toUpperCase()}>
          {selectedOption?.label.toUpperCase()}
        </BaseSelect.Value>
        <span style={arrowStyles} aria-hidden="true">
          &#9660;
        </span>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner>
          <BaseSelect.Popup style={popupStyles}>
            {options.map((option) => (
              <RvnSelectItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label.toUpperCase()}
              </RvnSelectItem>
            ))}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}

// -----------------------------------------------------------------------------
// Select Item with hover state
// -----------------------------------------------------------------------------

interface RvnSelectItemProps {
  value: string
  disabled?: boolean
  children: React.ReactNode
}

function RvnSelectItem({ value, disabled, children }: RvnSelectItemProps) {
  const [isHighlighted, setIsHighlighted] = React.useState(false)

  const itemStyle: CSSProperties = {
    ...optionStyles,
    ...(isHighlighted && {
      background: RVN_COLORS.white,
      color: RVN_COLORS.black,
    }),
    ...(disabled && {
      opacity: RVN_COLORS.disabledOpacity,
      cursor: 'not-allowed',
    }),
  }

  return (
    <BaseSelect.Item
      value={value}
      disabled={disabled}
      style={itemStyle}
      onMouseEnter={() => setIsHighlighted(true)}
      onMouseLeave={() => setIsHighlighted(false)}
    >
      <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
    </BaseSelect.Item>
  )
}
