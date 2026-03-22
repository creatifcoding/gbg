/**
 * RvnSwitch - Brutalist Toggle Switch (Base UI)
 *
 * Wraps Base UI Switch with RVN styling.
 *
 * Features:
 * - 3px border track
 * - Black thumb (rectangular)
 * - Monospace label
 * - No border-radius (brutalist)
 */

import * as React from 'react'
import { Switch as BaseSwitch } from '@base-ui-components/react/switch'
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

export interface RvnSwitchProps {
  /** Controlled checked state */
  checked?: boolean
  /** Default checked state (uncontrolled) */
  defaultChecked?: boolean
  /** Change handler */
  onCheckedChange?: (checked: boolean) => void
  /** Switch label */
  label?: ReactNode
  /** Label position */
  labelPosition?: 'left' | 'right'
  /** Disabled state */
  disabled?: boolean
  /** Name for form submission */
  name?: string
  /** Additional class name */
  className?: string
  /** Additional style overrides */
  style?: CSSProperties
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const TRACK_WIDTH = 44
const TRACK_HEIGHT = 24
const THUMB_SIZE = 16
const THUMB_OFFSET = 3
const BORDER_WIDTH = 3

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const containerStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: RVN_SPACING.s,
  cursor: 'pointer',
  userSelect: 'none',
}

const trackStyles: CSSProperties = {
  position: 'relative',
  width: `${TRACK_WIDTH}px`,
  height: `${TRACK_HEIGHT}px`,
  border: RVN_BORDERS.primary,
  borderRadius: RVN_BORDERS.radius,
  background: RVN_COLORS.surface,
  transition: 'background 100ms ease-out',
}

const trackCheckedStyles: CSSProperties = {
  background: RVN_COLORS.black,
}

const thumbStyles = (checked: boolean): CSSProperties => ({
  position: 'absolute',
  top: '50%',
  left: checked
    ? `${TRACK_WIDTH - THUMB_SIZE - THUMB_OFFSET - BORDER_WIDTH * 2}px`
    : `${THUMB_OFFSET}px`,
  transform: 'translateY(-50%)',
  width: `${THUMB_SIZE}px`,
  height: `${THUMB_SIZE}px`,
  background: checked ? RVN_COLORS.white : RVN_COLORS.black,
  borderRadius: RVN_BORDERS.radius, // 0px - square thumb
  transition: 'left 100ms ease-out, background 100ms ease-out',
})

const labelStyles: CSSProperties = {
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label, // 12px - THE FLOOR
  fontWeight: RVN_FONT_WEIGHTS.semibold,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: RVN_COLORS.textMain,
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function RvnSwitch({
  checked,
  defaultChecked,
  onCheckedChange,
  label,
  labelPosition = 'right',
  disabled = false,
  name,
  className,
  style,
}: RvnSwitchProps) {
  // Handle controlled/uncontrolled state
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked ?? false)
  const isControlled = checked !== undefined
  const isChecked = isControlled ? checked : internalChecked

  const handleChange = (newChecked: boolean) => {
    if (!isControlled) {
      setInternalChecked(newChecked)
    }
    onCheckedChange?.(newChecked)
  }

  const containerStyle: CSSProperties = {
    ...containerStyles,
    flexDirection: labelPosition === 'left' ? 'row-reverse' : 'row',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? RVN_COLORS.disabledOpacity : 1,
    ...style,
  }

  return (
    <BaseSwitch.Root
      className={clsx('rvn-switch', className)}
      checked={isChecked}
      onCheckedChange={handleChange}
      disabled={disabled}
      name={name}
      style={containerStyle}
    >
      <BaseSwitch.Thumb
        style={{
          ...trackStyles,
          ...(isChecked && trackCheckedStyles),
        }}
      >
        <span style={thumbStyles(isChecked)} />
      </BaseSwitch.Thumb>
      {label && <span style={labelStyles}>{label}</span>}
    </BaseSwitch.Root>
  )
}
