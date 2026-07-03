import type { CSSProperties } from 'react'
import { color, font, fontSize as fs, fontWeight, radius, duration, easing, space, type SemanticColor, semanticColorValue, semanticColorDim } from '../tokens'

export interface ToggleOption {
  key: string
  label: string
  color?: SemanticColor
  count?: number
}

export interface ToggleGroupProps {
  options: ToggleOption[]
  active: string | string[]
  onChange: (key: string) => void
  size?: 'sm' | 'md'
}

export function ToggleGroup({ options, active, onChange, size = 'md' }: ToggleGroupProps) {
  const activeKeys = Array.isArray(active) ? active : [active]

  return (
    <div style={{ display: 'inline-flex', gap: space[1], borderRadius: radius.md, padding: space[1], background: color.surfaceAlt }}>
      {options.map((o) => {
        const isActive = activeKeys.includes(o.key)
        const c = o.color ?? 'cyan'
        const cv = semanticColorValue[c]
        const cd = semanticColorDim[c]

        const style: CSSProperties = {
          fontFamily: font.sans,
          fontSize: size === 'sm' ? fs.xs : fs.sm,
          fontWeight: fontWeight.medium,
          padding: size === 'sm' ? `${space[1]} ${space[2]}` : `${space[1]} ${space[3]}`,
          borderRadius: radius.sm,
          border: 'none',
          cursor: 'pointer',
          transition: `all ${duration.normal} ${easing.default}`,
          background: isActive ? cd : 'transparent',
          color: isActive ? cv : color.textDim,
          display: 'inline-flex',
          alignItems: 'center',
          gap: space[1],
          whiteSpace: 'nowrap',
        }

        return (
          <button key={o.key} onClick={() => onChange(o.key)} style={style}>
            {o.label}
            {o.count !== undefined && (
              <span style={{
                fontFamily: font.mono, fontSize: fs.xs, fontWeight: fontWeight.semibold,
                background: isActive ? `${cv}33` : color.border, color: isActive ? cv : color.textMuted,
                borderRadius: radius.full, padding: '0 5px', minWidth: '18px', textAlign: 'center',
              }}>
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
