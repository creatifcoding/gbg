/**
 * Transfer v2 — Overlay
 *
 * Renders a floating drag label following the pointer.
 * Reads from bus activeDragAtom — no stx dependency.
 *
 * @since v2
 */
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { activeDragAtom } from '../TransferBus'
import type { TransferToken, TransferSession } from '../schemas'

// ── Types ────────────────────────────────────────────────────

export interface TransferOverlayProps {
  readonly zIndex?: number
  readonly render?: (state: OverlayState) => ReactNode
}

export interface OverlayState {
  readonly session: TransferSession
  readonly pointer: { x: number; y: number }
  readonly label: string
}

// ── Helpers ──────────────────────────────────────────────────

function formatLabel(tokens: ReadonlyArray<TransferToken>): string {
  if (tokens.length === 0) return 'ref'
  if (tokens.length === 1) {
    const ref = tokens[0].ref
    return ref._tag === 'TaskRef'
      ? ref.label ?? `task ${ref.taskId}`
      : ref.label ?? `${ref.taskIds.length} tasks`
  }
  const taskCount = tokens.filter((t) => t.ref._tag === 'TaskRef').length
  const clusterCount = tokens.length - taskCount
  if (clusterCount === 0) return `${taskCount} task refs`
  return `${tokens.length} refs`
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  transform: 'translate(12px, 12px)',
  pointerEvents: 'none',
  fontFamily: 'var(--font-data, "Share Tech Mono", monospace)',
  fontSize: 'var(--tmnl-text-xs, 12px)',
  borderRadius: '3px',
  padding: '3px 8px',
  border: '1px solid rgba(0, 229, 255, 0.3)',
  background: 'rgba(17, 17, 17, 0.9)',
  color: '#c8e4d8',
  whiteSpace: 'nowrap',
  zIndex: 1,
}

// ── Component ────────────────────────────────────────────────

export function TransferOverlay({ zIndex = 1200, render }: TransferOverlayProps) {
  const session = useAtomValue(activeDragAtom)
  const [pointer, setPointer] = useState({ x: 0, y: 0 })

  // Track pointer during drag
  useEffect(() => {
    if (!session) return

    const onMove = (e: PointerEvent) => {
      setPointer({ x: e.clientX, y: e.clientY })
    }

    setPointer(session.pointer)
    document.addEventListener('pointermove', onMove)
    return () => document.removeEventListener('pointermove', onMove)
  }, [session])

  if (!session) return null

  const state: OverlayState = {
    session,
    pointer,
    label: formatLabel(session.tokens),
  }

  return (
    <div
      style={{ position: 'fixed', left: pointer.x, top: pointer.y, zIndex, pointerEvents: 'none' }}
      aria-hidden
    >
      {render ? (
        render(state)
      ) : (
        <div style={overlayStyle}>↗ {state.label}</div>
      )}
    </div>
  )
}
