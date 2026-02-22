/**
 * Chrome Button — MorphChat DNA
 *
 * Reusable button primitive for panel title bar controls.
 *   - Idle: muted text, transparent bg
 *   - Hover: brighter text + subtle bg surface
 *   - Press: scale(0.97) micro-feedback
 *   - Transition: 200ms ease-out
 *
 * @module
 */

import { memo, type ReactNode } from 'react'
import { PANEL } from '../tokens'

export interface ChromeBtnProps {
  onClick: (e: React.MouseEvent) => void
  label: string
  children: ReactNode
}

export const chromeBtnBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 22,
  borderRadius: 4,
  border: 'none',
  background: 'transparent',
  color: PANEL.btnIdle,
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
  transition: PANEL.chromeTransition,
}

export const ChromeBtn = memo(function ChromeBtn({ onClick, label, children }: ChromeBtnProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="fp-chrome-btn"
      style={chromeBtnBase}
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
})
