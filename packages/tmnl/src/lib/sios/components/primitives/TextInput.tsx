import type { CSSProperties } from 'react'
import { color, font, fontSize, fontWeight, radius, duration, easing, space } from '../tokens'

export interface TextInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  error?: string
  hint?: string
  placeholder?: string
  maxLength?: number
  type?: 'text' | 'email' | 'password'
}

const labelStyle: CSSProperties = { fontFamily: font.mono, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: color.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: space[1] }
const inputStyle = (hasError: boolean): CSSProperties => ({
  fontFamily: font.sans, fontSize: fontSize.base, color: color.text, background: color.surfaceAlt, border: `1px solid ${hasError ? color.red : color.border}`,
  borderRadius: radius.md, padding: `${space[2]} ${space[3]}`, width: '100%', outline: 'none', transition: `border-color ${duration.normal} ${easing.default}`,
})
const metaStyle = (isError: boolean): CSSProperties => ({ fontFamily: font.sans, fontSize: fontSize.xs, color: isError ? color.red : color.textMuted, marginTop: space[1] })

export function TextInput({ label, value, onChange, required, disabled, error, hint, placeholder, maxLength, type = 'text' }: TextInputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={labelStyle}>{label}{required && ' *'}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} disabled={disabled}
        style={inputStyle(!!error)} onFocus={(e) => { e.target.style.borderColor = error ? color.red : color.cyan }} onBlur={(e) => { e.target.style.borderColor = error ? color.red : color.border }} />
      {error && <span style={metaStyle(true)}>{error}</span>}
      {!error && hint && <span style={metaStyle(false)}>{hint}</span>}
    </div>
  )
}
