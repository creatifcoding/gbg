import type { CSSProperties } from 'react'
import { color, font, fontSize, fontWeight, radius, duration, easing, space } from '../tokens'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  label: string
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  error?: string
  hint?: string
  placeholder?: string
}

export function Select({ label, options, value, onChange, required, disabled, error, hint, placeholder }: SelectProps) {
  const labelS: CSSProperties = { fontFamily: font.mono, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: color.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: space[1] }
  const selectS: CSSProperties = {
    fontFamily: font.sans, fontSize: fontSize.base, color: color.text, background: color.surfaceAlt,
    border: `1px solid ${error ? color.red : color.border}`, borderRadius: radius.md,
    padding: `${space[2]} ${space[3]}`, width: '100%', outline: 'none', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%237a8599'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: `right ${space[3]} center`,
    paddingRight: space[8], cursor: 'pointer',
    transition: `border-color ${duration.normal} ${easing.default}`,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={labelS}>{label}{required && ' *'}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} style={selectS}>
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <span style={{ fontFamily: font.sans, fontSize: fontSize.xs, color: color.red, marginTop: space[1] }}>{error}</span>}
      {!error && hint && <span style={{ fontFamily: font.sans, fontSize: fontSize.xs, color: color.textMuted, marginTop: space[1] }}>{hint}</span>}
    </div>
  )
}
