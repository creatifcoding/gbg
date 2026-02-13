import type { CSSProperties, ReactNode } from 'react'
import { useSelector } from '@/lib/stx'
import { getTransferStx } from '../transfer-stx'
import type { TransferDropDecision, TransferReferenceToken } from '../types'

export interface TransferOverlayRenderState {
  token: TransferReferenceToken
  tokens: ReadonlyArray<TransferReferenceToken>
  pointer: { x: number; y: number }
  decision: TransferDropDecision | null
}

export interface TransferOverlayProps {
  zIndex?: number
  render?: (state: TransferOverlayRenderState) => ReactNode
}

function formatOverlayLabel(tokens: ReadonlyArray<TransferReferenceToken>): string {
  if (tokens.length <= 1) {
    const first = tokens[0]
    if (!first) {
      return 'task ref'
    }

    if (first.reference.kind === 'task') {
      return `task ref ${first.reference.taskId}`
    }

    return `cluster ref ${first.reference.clusterId}`
  }

  const taskCount = tokens.filter((entry) => entry.reference.kind === 'task').length
  const clusterCount = tokens.length - taskCount

  if (clusterCount === 0) {
    return `${taskCount} task refs`
  }

  return `${tokens.length} refs`
}

function defaultOverlayStyle(decision: TransferDropDecision | null): CSSProperties {
  const base: CSSProperties = {
    position: 'fixed',
    transform: 'translate(10px, 10px)',
    pointerEvents: 'none',
    fontFamily: 'var(--font-data, "Share Tech Mono", monospace)',
    fontSize: 'var(--tmnl-text-xs, 12px)',
    borderRadius: 0,
    padding: '2px 6px',
    border: '1px solid #2f2f2f',
    background: '#111',
    color: '#f1f1f1',
  }

  if (!decision) {
    return base
  }

  if (decision._tag === 'TransferDropAccept') {
    return {
      ...base,
      border: '1px solid #31d0aa',
      color: '#c7fff0',
    }
  }

  return {
    ...base,
    border: '1px solid #ff5f5f',
    color: '#ffd4d4',
  }
}

export function TransferOverlay({ zIndex = 1200, render }: TransferOverlayProps) {
  const stx = getTransferStx()

  const session = useSelector(stx.data.activeSession, (value) => value)
  const decision = useSelector(stx.data.hoverDecision, (value) => value)

  if (!session) {
    return null
  }

  const tokens = session.tokens && session.tokens.length > 0 ? session.tokens : [session.token]

  const renderState: TransferOverlayRenderState = {
    token: session.token,
    tokens,
    pointer: session.pointer,
    decision,
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: session.pointer.x,
        top: session.pointer.y,
        zIndex,
        pointerEvents: 'none',
      }}
      aria-hidden
    >
      {render ? (
        render(renderState)
      ) : (
        <div style={defaultOverlayStyle(decision)}>
          {decision?._tag === 'TransferDropReject'
            ? `↗ ${formatOverlayLabel(renderState.tokens)} · reject: ${decision.reason}`
            : `↗ ${formatOverlayLabel(renderState.tokens)}`}
        </div>
      )}
    </div>
  )
}
