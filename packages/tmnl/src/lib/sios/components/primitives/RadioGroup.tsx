import type { CSSProperties } from 'react'
import { color, font, fontSize, fontWeight, space } from '../tokens'

export interface RadioOption {
  value: string
  label: string
  description?: string
}

export interface RadioGroupProps {
  label: string
  options: RadioOption[]
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  direction?: 'row' | 'column'
}

export function RadioGroup({ label, options, value, onChange, required, disabled, direction = 'column' }: RadioGroupProps) {
  const labelS: CSSProperties = { fontFamily: font.mono, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: color.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: space[2] }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={labelS}>{label}{required && ' *'}</span>
      <div style={{ display: 'flex', flexDirection: direction, gap: direction === 'row' ? space[4] : space[2] }}>
        {options.map((o) => (
          <label key={o.value} style={{ display: 'flex', alignItems: 'flex-start', gap: space[2], cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
            <input type="radio" name={label} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} disabled={disabled}
              style={{ accentColor: color.cyan, marginTop: '3px', cursor: 'inherit' }} />
            <div>
              <span style={{ fontFamily: font.sans, fontSize: fontSize.base, color: color.text }}>{o.label}</span>
              {o.description && <span style={{ display: 'block', fontFamily: font.sans, fontSize: fontSize.sm, color: color.textDim }}>{o.description}</span>}
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
