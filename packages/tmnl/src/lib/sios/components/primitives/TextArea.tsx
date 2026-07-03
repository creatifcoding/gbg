import type { CSSProperties } from 'react'
import { color, font, fontSize, fontWeight, radius, duration, easing, space } from '../tokens'

export interface TextAreaProps {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  error?: string
  hint?: string
  rows?: number
  placeholder?: string
  maxLength?: number
}

export function TextArea({ label, value, onChange, required, disabled, error, hint, rows = 3, placeholder, maxLength }: TextAreaProps) {
  const labelS: CSSProperties = { fontFamily: font.mono, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: color.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: space[1] }
  const taS: CSSProperties = {
    fontFamily: font.sans, fontSize: fontSize.base, color: color.text, background: color.surfaceAlt,
    border: `1px solid ${error ? color.red : color.border}`, borderRadius: radius.md,
    padding: `${space[2]} ${space[3]}`, width: '100%', resize: 'vertical', outline: 'none',
    transition: `border-color ${duration.normal} ${easing.default}`, lineHeight: '1.5',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={labelS}>{label}{required && ' *'}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} maxLength={maxLength} disabled={disabled}
        style={taS} onFocus={(e) => { e.target.style.borderColor = error ? color.red : color.cyan }} onBlur={(e) => { e.target.style.borderColor = error ? color.red : color.border }} />
      {error && <span style={{ fontFamily: font.sans, fontSize: fontSize.xs, color: color.red, marginTop: space[1] }}>{error}</span>}
      {!error && hint && <span style={{ fontFamily: font.sans, fontSize: fontSize.xs, color: color.textMuted, marginTop: space[1] }}>{hint}</span>}
    </div>
  )
}
