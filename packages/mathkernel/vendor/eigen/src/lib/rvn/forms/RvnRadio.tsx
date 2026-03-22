/**
 * RvnRadio - Brutalist Radio Button (Base UI)
 *
 * Wraps Base UI Radio and RadioGroup with RVN styling.
 *
 * Features:
 * - 16px circle with 3px border
 * - Black dot on select
 * - Monospace labels (12px - THE FLOOR)
 * - Vertical/horizontal layout
 */

import * as React from 'react'
import { Radio as BaseRadio } from '@base-ui-components/react/radio'
import { RadioGroup as BaseRadioGroup } from '@base-ui-components/react/radio-group'
import { clsx } from 'clsx'
import type { CSSProperties, ReactNode } from 'react'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_BORDERS,
  RVN_COLORS,
  RVN_SPACING,
} from '../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnRadioOption {
  value: string
  label: string
  disabled?: boolean
}

export interface RvnRadioProps {
  /** Radio value */
  value: string
  /** Radio label */
  label?: ReactNode
  /** Disabled state */
  disabled?: boolean
  /** Additional class name */
  className?: string
  /** Additional style overrides */
  style?: CSSProperties
}

export interface RvnRadioGroupProps {
  /** Controlled selected value */
  value?: string
  /** Default selected value (uncontrolled) */
  defaultValue?: string
  /** Change handler */
  onValueChange?: (value: string) => void
  /** Layout direction */
  direction?: 'horizontal' | 'vertical'
  /** Group label */
  label?: ReactNode
  /** Disabled state for entire group */
  disabled?: boolean
  /** Radio group name */
  name?: string
  /** Children (RvnRadio components) */
  children: ReactNode
  /** Additional class name */
  className?: string
  /** Additional style overrides */
  style?: CSSProperties
}

// Legacy props for backward compatibility
export interface RvnRadioItemProps {
  name: string
  value: string
  label: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const radioContainerStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: RVN_SPACING.s,
  cursor: 'pointer',
  userSelect: 'none',
}

const circleStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '16px',
  height: '16px',
  minWidth: '16px',
  border: RVN_BORDERS.primary,
  borderRadius: '50%', // Exception for radio semantics
  background: RVN_COLORS.surface,
  transition: 'background 100ms ease-out',
}

const dotStyles: CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: RVN_COLORS.black,
}

const labelStyles: CSSProperties = {
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label, // 12px - THE FLOOR
  fontWeight: RVN_FONT_WEIGHTS.semibold,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: RVN_COLORS.textMain,
}

const groupContainerStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: RVN_SPACING.s,
}

const groupLabelStyles: CSSProperties = {
  fontFamily: RVN_FONTS.sans,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.bold,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: RVN_COLORS.textMain,
  marginBottom: RVN_SPACING.xs,
}

// -----------------------------------------------------------------------------
// RvnRadio Component (individual radio button)
// -----------------------------------------------------------------------------

export function RvnRadio({
  value,
  label,
  disabled = false,
  className,
  style,
}: RvnRadioProps) {
  const containerStyle: CSSProperties = {
    ...radioContainerStyles,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? RVN_COLORS.disabledOpacity : 1,
    ...style,
  }

  return (
    <BaseRadio.Root
      value={value}
      disabled={disabled}
      className={clsx('rvn-radio', className)}
      style={containerStyle}
    >
      <BaseRadio.Indicator style={circleStyles}>
        <span style={dotStyles} />
      </BaseRadio.Indicator>
      {label && <span style={labelStyles}>{label}</span>}
    </BaseRadio.Root>
  )
}

// -----------------------------------------------------------------------------
// RvnRadioGroup Component
// -----------------------------------------------------------------------------

export function RvnRadioGroup({
  value,
  defaultValue,
  onValueChange,
  direction = 'vertical',
  label,
  disabled = false,
  name,
  children,
  className,
  style,
}: RvnRadioGroupProps) {
  const groupStyles: CSSProperties = {
    display: 'flex',
    flexDirection: direction === 'horizontal' ? 'row' : 'column',
    gap: direction === 'horizontal' ? RVN_SPACING.m : RVN_SPACING.s,
    flexWrap: direction === 'horizontal' ? 'wrap' : undefined,
  }

  return (
    <div
      className={clsx('rvn-radio-group', className)}
      style={{ ...groupContainerStyles, ...style }}
    >
      {label && <div style={groupLabelStyles}>{label}</div>}
      <BaseRadioGroup
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
        name={name}
        style={groupStyles}
      >
        {children}
      </BaseRadioGroup>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Legacy RvnRadioItem for backward compatibility
// -----------------------------------------------------------------------------

export function RvnRadioItem({
  name,
  value,
  label,
  checked,
  disabled = false,
  onChange,
}: RvnRadioItemProps) {
  const containerStyle: CSSProperties = {
    ...radioContainerStyles,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? RVN_COLORS.disabledOpacity : 1,
  }

  return (
    <label style={containerStyle}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{
          position: 'absolute',
          opacity: 0,
          width: 0,
          height: 0,
          pointerEvents: 'none',
        }}
      />
      <span style={circleStyles}>
        {checked && <span style={dotStyles} />}
      </span>
      <span style={labelStyles}>{label}</span>
    </label>
  )
}
