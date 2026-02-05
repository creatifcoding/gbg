/**
 * RvnSlider - Brutalist Slider (Base UI)
 *
 * Wraps Base UI Slider with RVN styling.
 *
 * Features:
 * - 3px track border
 * - Black thumb with white dot
 * - Monospace value display
 * - Optional label
 */

import * as React from 'react'
import { Slider as BaseSlider } from '@base-ui-components/react/slider'
import { clsx } from 'clsx'
import type { CSSProperties, ReactNode } from 'react'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_BORDERS,
  RVN_COLORS,
  RVN_SPACING,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnSliderProps {
  /** Controlled value */
  value?: number | number[]
  /** Default value (uncontrolled) */
  defaultValue?: number | number[]
  /** Change handler */
  onValueChange?: (value: number | number[]) => void
  /** Minimum value */
  min?: number
  /** Maximum value */
  max?: number
  /** Step increment */
  step?: number
  /** Show current value */
  showValue?: boolean
  /** Value formatter */
  formatValue?: (value: number) => string
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
// Constants
// -----------------------------------------------------------------------------

const TRACK_HEIGHT = 8
const THUMB_SIZE = 20

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const containerStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: RVN_SPACING.xs,
  minWidth: '200px',
}

const headerStyles: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const labelStyles: CSSProperties = {
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.semibold,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: RVN_COLORS.textMain,
}

const valueStyles: CSSProperties = {
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.bold,
  color: RVN_COLORS.textMain,
  minWidth: '40px',
  textAlign: 'right',
}

const trackContainerStyles: CSSProperties = {
  position: 'relative',
  height: `${TRACK_HEIGHT + 6}px`,
  display: 'flex',
  alignItems: 'center',
}

const trackStyles: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: `${TRACK_HEIGHT}px`,
  border: RVN_BORDERS.primary,
  borderRadius: RVN_BORDERS.radius,
  background: RVN_COLORS.surface,
  overflow: 'hidden',
}

const rangeStyles: CSSProperties = {
  position: 'absolute',
  height: '100%',
  background: RVN_COLORS.black,
}

const thumbStyles: CSSProperties = {
  position: 'absolute',
  width: `${THUMB_SIZE}px`,
  height: `${THUMB_SIZE}px`,
  background: RVN_COLORS.black,
  border: 'none',
  borderRadius: RVN_BORDERS.radius,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transform: 'translateX(-50%)',
  outline: 'none',
}

const thumbDotStyles: CSSProperties = {
  width: '6px',
  height: '6px',
  background: RVN_COLORS.white,
  borderRadius: '50%',
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function RvnSlider({
  value,
  defaultValue = 0,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  showValue = true,
  formatValue,
  label,
  disabled = false,
  fullWidth = false,
  className,
  style,
}: RvnSliderProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue

  const handleChange = (newValue: number | number[]) => {
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onValueChange?.(newValue)
  }

  const displayValue = React.useMemo(() => {
    const val = Array.isArray(currentValue) ? currentValue[0] : currentValue
    if (formatValue) {
      return formatValue(val)
    }
    if (step < 1) {
      const decimals = String(step).split('.')[1]?.length || 2
      return val.toFixed(decimals)
    }
    return String(val)
  }, [currentValue, formatValue, step])

  const containerStyle: CSSProperties = {
    ...containerStyles,
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? RVN_COLORS.disabledOpacity : 1,
    ...style,
  }

  return (
    <div className={clsx('rvn-slider', className)} style={containerStyle}>
      {(label || showValue) && (
        <div style={headerStyles}>
          {label && <span style={labelStyles}>{label}</span>}
          {showValue && <span style={valueStyles}>{displayValue}</span>}
        </div>
      )}
      <BaseSlider.Root
        value={Array.isArray(currentValue) ? currentValue : [currentValue]}
        onValueChange={(v) => handleChange(v.length === 1 ? v[0] : v)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        style={trackContainerStyles}
      >
        <BaseSlider.Control style={trackStyles}>
          <BaseSlider.Track>
            <BaseSlider.Indicator style={rangeStyles} />
          </BaseSlider.Track>
          <BaseSlider.Thumb style={thumbStyles}>
            <span style={thumbDotStyles} />
          </BaseSlider.Thumb>
        </BaseSlider.Control>
      </BaseSlider.Root>
    </div>
  )
}
