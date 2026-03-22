/**
 * RvnCombobox - Brutalist Combobox/Autocomplete (Base UI)
 *
 * Wraps Base UI Select with search functionality and RVN styling.
 * This serves as both Combobox and Autocomplete.
 *
 * Features:
 * - 3px border input
 * - Black dropdown with monospace options
 * - 12px minimum font
 * - Searchable options
 */

import * as React from 'react'
import { Select as BaseSelect } from '@base-ui-components/react/select'
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

export interface RvnComboboxOption {
  value: string
  label: string
  disabled?: boolean
}

export interface RvnComboboxProps {
  /** Options array */
  options: RvnComboboxOption[]
  /** Controlled value */
  value?: string
  /** Default value (uncontrolled) */
  defaultValue?: string
  /** Change handler - receives value and event details */
  onValueChange?: (value: string | null, eventDetails: { event: Event }) => void
  /** Placeholder text */
  placeholder?: string
  /** Allow custom values */
  allowCustom?: boolean
  /** Disabled state */
  disabled?: boolean
  /** Full width */
  fullWidth?: boolean
  /** Additional class name */
  className?: string
  /** Additional style overrides */
  style?: CSSProperties
}

// Also export as Autocomplete for semantic naming
export type RvnAutocompleteProps = RvnComboboxProps
export type RvnAutocompleteOption = RvnComboboxOption

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const containerStyles: CSSProperties = {
  position: 'relative',
  display: 'inline-block',
}

const triggerStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  minWidth: '200px',
  height: '40px',
  padding: '8px 36px 8px 12px',
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.semibold,
  textTransform: 'uppercase',
  border: RVN_BORDERS.primary,
  borderRadius: RVN_BORDERS.radius,
  background: RVN_COLORS.surface,
  color: RVN_COLORS.textMain,
  boxShadow: RVN_SHADOWS.default,
  cursor: 'pointer',
  outline: 'none',
}

const triggerFocusStyles: CSSProperties = {
  background: RVN_COLORS.black,
  color: RVN_COLORS.white,
}

const arrowStyles: CSSProperties = {
  position: 'absolute',
  right: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
  pointerEvents: 'none',
}

const popupStyles: CSSProperties = {
  background: RVN_COLORS.black,
  border: RVN_BORDERS.primary,
  borderRadius: RVN_BORDERS.radius,
  boxShadow: RVN_SHADOWS.default,
  minWidth: '200px',
  maxHeight: '300px',
  overflow: 'auto',
  zIndex: 1000,
}

const searchInputStyles: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
  border: 'none',
  borderBottom: `2px solid ${RVN_COLORS.white}`,
  background: RVN_COLORS.black,
  color: RVN_COLORS.white,
  outline: 'none',
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

const optionHighlightStyles: CSSProperties = {
  background: RVN_COLORS.white,
  color: RVN_COLORS.black,
}

const noResultsStyles: CSSProperties = {
  padding: '12px',
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
  color: RVN_COLORS.textMuted,
  textAlign: 'center',
  textTransform: 'uppercase',
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function RvnCombobox({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = 'Select...',
  allowCustom = false,
  disabled = false,
  fullWidth = false,
  className,
  style,
}: RvnComboboxProps) {
  const [isFocused, setIsFocused] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [options, searchQuery])

  const containerStyle: CSSProperties = {
    ...containerStyles,
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? RVN_COLORS.disabledOpacity : 1,
    ...style,
  }

  const triggerStyle: CSSProperties = {
    ...triggerStyles,
    ...(isFocused && triggerFocusStyles),
    width: fullWidth ? '100%' : 'auto',
  }

  return (
    <BaseSelect.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <div className={clsx('rvn-combobox', className)} style={containerStyle}>
        <BaseSelect.Trigger
          style={triggerStyle}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        >
          <BaseSelect.Value>
            {value ? options.find(o => o.value === value)?.label.toUpperCase() : placeholder.toUpperCase()}
          </BaseSelect.Value>
          <span style={{ ...arrowStyles, color: isFocused ? RVN_COLORS.white : RVN_COLORS.textMain }}>
            &#9660;
          </span>
        </BaseSelect.Trigger>
      </div>
      <BaseSelect.Portal>
        <BaseSelect.Positioner>
          <BaseSelect.Popup style={popupStyles}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SEARCH..."
              style={searchInputStyles}
              onClick={(e) => e.stopPropagation()}
            />
            {filteredOptions.length === 0 ? (
              <div style={noResultsStyles}>No results</div>
            ) : (
              filteredOptions.map((option) => (
                <BaseSelect.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  style={optionStyles}
                >
                  <BaseSelect.ItemIndicator />
                  <BaseSelect.ItemText>
                    {option.label.toUpperCase()}
                  </BaseSelect.ItemText>
                </BaseSelect.Item>
              ))
            )}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}

// Alias for semantic naming
export const RvnAutocomplete = RvnCombobox
