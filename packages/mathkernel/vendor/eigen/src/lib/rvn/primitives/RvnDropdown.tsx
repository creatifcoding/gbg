/**
 * RvnDropdown - Brutalist Select/Dropdown (Base UI)
 *
 * Wraps Base UI Select with RVN styling.
 *
 * Features:
 * - 3px solid black border
 * - 4px 4px shadow on trigger
 * - Custom dropdown arrow
 * - Monospace font for data
 * - Uppercase options
 * - Hover/highlight states
 * - Fixed-width indicator column
 */

import * as React from 'react'
import { useState, useCallback, forwardRef } from 'react'
import type { CSSProperties } from 'react'
import { Select as BaseSelect } from '@base-ui-components/react/select'
import { clsx } from 'clsx'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_BORDERS,
  RVN_COLORS,
  RVN_SHADOWS,
} from '../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnDropdownOption {
  value: string
  label: string
  disabled?: boolean
}

export interface RvnDropdownProps {
  /** Options array */
  options: RvnDropdownOption[]
  /** Controlled value */
  value?: string
  /** Default value (uncontrolled) */
  defaultValue?: string
  /** Value change handler (Base UI style) */
  onValueChange?: (value: string) => void
  /** Legacy onChange handler for form compatibility */
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  /** Placeholder text (first option, disabled) */
  placeholder?: string
  /** Full width */
  fullWidth?: boolean
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
  transition: 'box-shadow 100ms ease-out',
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

const itemStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 0,
  padding: '10px 12px',
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.semibold,
  textTransform: 'uppercase',
  color: RVN_COLORS.white,
  cursor: 'pointer',
  outline: 'none',
  transition: 'background-color 80ms ease-out, color 80ms ease-out',
}

const itemHighlightStyles: CSSProperties = {
  background: RVN_COLORS.white,
  color: RVN_COLORS.black,
}

const indicatorStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  flexShrink: 0,
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
}

const itemTextStyles: CSSProperties = {
  flex: 1,
}

// -----------------------------------------------------------------------------
// Item Component (handles hover state)
// -----------------------------------------------------------------------------

interface RvnDropdownItemProps {
  value: string
  disabled?: boolean
  children: React.ReactNode
  isSelected?: boolean
}

function RvnDropdownItem({ value, disabled, children, isSelected }: RvnDropdownItemProps) {
  const [isHighlighted, setIsHighlighted] = useState(false)

  const itemStyle: CSSProperties = {
    ...itemStyles,
    ...(isHighlighted && itemHighlightStyles),
    ...(isSelected && { fontWeight: RVN_FONT_WEIGHTS.bold }),
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
      <BaseSelect.ItemIndicator style={indicatorStyles}>
        ✓
      </BaseSelect.ItemIndicator>
      <BaseSelect.ItemText style={itemTextStyles}>
        {children}
      </BaseSelect.ItemText>
    </BaseSelect.Item>
  )
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const RvnDropdown = forwardRef<HTMLButtonElement, RvnDropdownProps>(
  function RvnDropdown(
    {
      options,
      value,
      defaultValue,
      onValueChange,
      onChange,
      placeholder,
      fullWidth = false,
      disabled = false,
      className,
      style,
    },
    ref
  ) {
    const [isFocused, setIsFocused] = useState(false)

    const handleValueChange = useCallback(
      (newValue: string | null) => {
        if (newValue === null) return
        onValueChange?.(newValue)
        // Emit synthetic event for onChange compatibility
        if (onChange) {
          const syntheticEvent = {
            target: {
              value: newValue,
              options: options.map((o) => ({ value: o.value, label: o.label })),
            },
          } as unknown as React.ChangeEvent<HTMLSelectElement>
          onChange(syntheticEvent)
        }
      },
      [onValueChange, onChange, options]
    )

    const triggerStyle: CSSProperties = {
      ...triggerStyles,
      ...(isFocused && triggerFocusStyles),
      width: fullWidth ? '100%' : 'auto',
      opacity: disabled ? RVN_COLORS.disabledOpacity : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      ...style,
    }

    // Find label for current value
    const selectedOption = options.find((o) => o.value === value)
    const displayValue = selectedOption
      ? selectedOption.label.toUpperCase()
      : placeholder?.toUpperCase() ?? ''

    return (
      <BaseSelect.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <BaseSelect.Trigger
          ref={ref}
          className={clsx('rvn-dropdown-trigger', className)}
          style={triggerStyle}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        >
          <BaseSelect.Value>{displayValue}</BaseSelect.Value>
          <span style={arrowStyles} aria-hidden="true">
            &#9660;
          </span>
        </BaseSelect.Trigger>
        <BaseSelect.Portal>
          <BaseSelect.Positioner>
            <BaseSelect.Popup style={popupStyles}>
              {options.map((option) => (
                <RvnDropdownItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  isSelected={option.value === value}
                >
                  {option.label.toUpperCase()}
                </RvnDropdownItem>
              ))}
            </BaseSelect.Popup>
          </BaseSelect.Positioner>
        </BaseSelect.Portal>
      </BaseSelect.Root>
    )
  }
)
