/**
 * Chrome Button
 *
 * Reusable button primitive for floating panel title bar controls.
 * Zero animation — CSS hover only via .fp-chrome-btn class.
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
  width: 22,
  height: 20,
  borderRadius: 2,
  border: '1px solid transparent',
  background: 'transparent',
  color: PANEL.btnIdle,
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
}

export const ChromeBtn = memo(function ChromeBtn({ onClick, label, children }: ChromeBtnProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="fp-chrome-btn"
      style={chromeBtnBase}
    >
      {children}
    </button>
  )
})
