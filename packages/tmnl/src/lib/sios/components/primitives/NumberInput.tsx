import type { CSSProperties } from 'react'
import { color, font, fontSize, fontWeight, radius, duration, easing, space } from '../tokens'

export interface NumberInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  required?: boolean
  disabled?: boolean
  error?: string
  hint?: string
  min?: number
  max?: number
  step?: number
  unit?: string
}

const labelStyle: CSSProperties = { fontFamily: font.mono, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: color.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: space[1] }

export function NumberInput({ label, value, onChange, required, disabled, error, hint, min, max, step, unit }: NumberInputProps) {
  const inputS: CSSProperties = {
    fontFamily: font.mono, fontSize: fontSize.base, color: color.text, background: color.surfaceAlt,
    border: `1px solid ${error ? color.red : color.border}`, borderRadius: radius.md,
    padding: `${space[2]} ${space[3]}`, paddingRight: unit ? space[8] : space[3],
    width: '100%', outline: 'none', transition: `border-color ${duration.normal} ${easing.default}`,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={labelStyle}>{label}{required && ' *'}</label>
      <div style={{ position: 'relative' }}>
        <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} min={min} max={max} step={step} disabled={disabled}
          style={inputS} onFocus={(e) => { e.target.style.borderColor = error ? color.red : color.cyan }} onBlur={(e) => { e.target.style.borderColor = error ? color.red : color.border }} />
        {unit && <span style={{ position: 'absolute', right: space[3], top: '50%', transform: 'translateY(-50%)', fontFamily: font.mono, fontSize: fontSize.sm, color: color.textMuted }}>{unit}</span>}
      </div>
      {error && <span style={{ fontFamily: font.sans, fontSize: fontSize.xs, color: color.red, marginTop: space[1] }}>{error}</span>}
      {!error && hint && <span style={{ fontFamily: font.sans, fontSize: fontSize.xs, color: color.textMuted, marginTop: space[1] }}>{hint}</span>}
    </div>
  )
}
