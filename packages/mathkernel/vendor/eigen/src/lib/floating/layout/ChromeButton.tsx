/**
 * Chrome button — scale(0.97) press, hover glow (MorphChat DNA).
 *
 * @module floating/layout/ChromeButton
 */

import type { ReactNode } from 'react'
import { PANEL } from '../tokens'

export function ChromeButton({
  title,
  onClick,
  children,
}: {
  title: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'transparent',
        color: PANEL.btnIdle,
        cursor: 'pointer',
        borderRadius: 4,
        padding: 0,
        transition: PANEL.chromeTransition,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.color = PANEL.btnHover
        el.style.background = PANEL.btnHoverBg
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.color = PANEL.btnIdle
        el.style.background = 'transparent'
        el.style.transform = ''
      }}
      onMouseDown={(e) => {
        ;(e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'
      }}
      onMouseUp={(e) => {
        ;(e.currentTarget as HTMLElement).style.transform = ''
      }}
    >
      {children}
    </button>
  )
}
