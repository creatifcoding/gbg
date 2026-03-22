/**
 * EditableField Primitive
 *
 * Label + input/textarea for editable metadata.
 *
 * @module file-browser/primitives
 */

import { memo, useState, useCallback } from 'react'

import { DARK_SIDE } from '../tokens'

// =============================================================================
// Types
// =============================================================================

export interface EditableFieldProps {
  /** Field label */
  label: string
  /** Current value */
  value: string
  /** Multiline textarea mode */
  multiline?: boolean
  /** Called when value changes */
  onChange?: (value: string) => void
  /** Read-only mode */
  readOnly?: boolean
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Styles
// =============================================================================

const baseInputStyles: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: `1px solid ${DARK_SIDE.colors.border.default}`,
  color: DARK_SIDE.colors.text.secondary,
  fontSize: DARK_SIDE.typography.size.xs,
  fontFamily: DARK_SIDE.typography.family.mono,
  padding: `${DARK_SIDE.spacing['1']} 0`,
  outline: 'none',
  transition: `all ${DARK_SIDE.animation.duration.fast} ${DARK_SIDE.animation.easing.easeOut}`,
}

// =============================================================================
// Component
// =============================================================================

export const EditableField = memo(function EditableField({
  label,
  value,
  multiline = false,
  onChange,
  readOnly = false,
  className = '',
}: EditableFieldProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [localValue, setLocalValue] = useState(value)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value
      setLocalValue(newValue)
      onChange?.(newValue)
    },
    [onChange]
  )

  const inputStyles: React.CSSProperties = {
    ...baseInputStyles,
    borderBottomColor: isFocused
      ? DARK_SIDE.colors.accent.green
      : DARK_SIDE.colors.border.default,
    backgroundColor: isFocused ? 'rgba(0, 255, 65, 0.05)' : 'transparent',
  }

  const labelStyles: React.CSSProperties = {
    display: 'block',
    fontSize: '9px', // Exception for ultra-compact labels
    color: isFocused ? DARK_SIDE.colors.accent.green : DARK_SIDE.colors.text.tertiary,
    marginBottom: DARK_SIDE.spacing['1'],
    textTransform: 'uppercase',
    letterSpacing: DARK_SIDE.typography.letterSpacing.wide,
    transition: `color ${DARK_SIDE.animation.duration.fast} ${DARK_SIDE.animation.easing.easeOut}`,
  }

  return (
    <div
      className={`editable-field ${className}`}
      style={{ marginBottom: DARK_SIDE.spacing['3'] }}
    >
      <label style={labelStyles}>{label}</label>
      {multiline ? (
        <textarea
          value={localValue}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          readOnly={readOnly}
          style={{
            ...inputStyles,
            minHeight: '50px',
            resize: 'none',
          }}
        />
      ) : (
        <input
          type="text"
          value={localValue}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          readOnly={readOnly}
          style={inputStyles}
        />
      )}
    </div>
  )
})
