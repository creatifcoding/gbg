import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { color, radius, duration, easing } from '../tokens'

export interface OverlayProps {
  children: ReactNode
  open: boolean
  onClose?: () => void
  width?: 'sm' | 'md' | 'lg'
}

const widthMap = { sm: 360, md: 480, lg: 640 } as const

export function Overlay({ children, open, onClose, width = 'md' }: OverlayProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const backdropStyle: CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    animation: `sios-overlay-fade ${duration.normal} ${easing.default}`,
  }

  const panelStyle: CSSProperties = {
    background: color.surface, border: `1px solid ${color.borderBright}`,
    borderRadius: radius.xl, width: widthMap[width], maxWidth: '90vw', maxHeight: '85vh',
    overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    animation: `sios-overlay-scale ${duration.normal} ${easing.spring}`,
  }

  return (
    <>
      <style>{`
        @keyframes sios-overlay-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sios-overlay-scale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      <div style={backdropStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
        <div style={panelStyle}>{children}</div>
      </div>
    </>
  )
}
