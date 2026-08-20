import type { ReactNode } from 'react'
import { VANTA_COLORS, VANTA_TYPOGRAPHY, VANTA_BORDERS } from '~/components/portal'

export function Badge({
  children,
  accent = 'neutral',
}: {
  children: ReactNode
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'neutral'
}) {
  const colors = {
    cyan: VANTA_COLORS.accent.cyan,
    emerald: VANTA_COLORS.accent.emerald,
    amber: VANTA_COLORS.accent.amber,
    rose: VANTA_COLORS.accent.rose,
    neutral: VANTA_COLORS.text.secondary,
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        border: `1px solid ${colors[accent]}`,
        background: VANTA_COLORS.surface.elevated,
        color: colors[accent],
        borderRadius: VANTA_BORDERS.radius.sm,
        padding: '0.15rem 0.45rem',
        ...VANTA_TYPOGRAPHY.preset.label,
      }}
    >
      {children}
    </span>
  )
}
