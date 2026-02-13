/**
 * useDragHandlers — Drag start/end handlers for transfer tokens.
 *
 * Manages the session atom and HTML drag events.
 *
 * @since v2
 */
import { useCallback, useRef } from 'react'
import { encodeTokensText } from '../codec'
import type { TransferToken, TransferSession } from '../schemas'

const TRANSFER_MIME = 'application/x-transfer-token'

interface DragHandlersInput {
  readonly setSession: (session: TransferSession | null) => void
}

export function useDragHandlers({ setSession }: DragHandlersInput) {
  const dragTokensRef = useRef<ReadonlyArray<TransferToken>>([])

  const startDrag = useCallback(
    (e: React.DragEvent, tokens: ReadonlyArray<TransferToken>) => {
      if (tokens.length === 0) return

      dragTokensRef.current = tokens
      const encoded = encodeTokensText(tokens)

      e.dataTransfer.setData('text/plain', encoded)
      e.dataTransfer.setData(TRANSFER_MIME, encoded)
      e.dataTransfer.effectAllowed = 'copyMove'

      // Drag label
      const label = tokens.length === 1
        ? tokens[0].ref.label ?? 'task'
        : `${tokens.length} tasks`

      const ghost = document.createElement('div')
      ghost.textContent = label
      ghost.style.cssText =
        'position:fixed;top:-9999px;left:-9999px;padding:4px 10px;' +
        'background:rgba(0,229,255,0.15);border:1px solid rgba(0,229,255,0.3);' +
        'border-radius:4px;font-size:12px;font-family:monospace;color:#c8e4d8;' +
        'pointer-events:none;white-space:nowrap;'
      document.body.appendChild(ghost)
      e.dataTransfer.setDragImage(ghost, 0, 0)
      requestAnimationFrame(() => ghost.remove())

      setSession({
        id: `drag-${Date.now()}`,
        tokens,
        pointer: { x: e.clientX, y: e.clientY },
        startedAt: Date.now(),
      })
    },
    [setSession],
  )

  const endDrag = useCallback(() => {
    dragTokensRef.current = []
    setSession(null)
  }, [setSession])

  return { startDrag, endDrag, dragTokensRef }
}
