import type { ReactNode } from 'react'
import { VANTA_COLORS, VANTA_TYPOGRAPHY } from '~/components/portal'

export function SectionLabel({
  children,
}: {
  children: ReactNode
}) {
  return (
    <p
      style={{
        ...VANTA_TYPOGRAPHY.preset.label,
        color: VANTA_COLORS.accent.cyan,
        marginBottom: '12px',
      }}
    >
      {children}
    </p>
  )
}
