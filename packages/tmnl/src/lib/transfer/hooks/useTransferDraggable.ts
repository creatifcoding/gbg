import { useCallback } from 'react'
import type { DragEvent, DragEventHandler } from 'react'
import {
  TRANSFER_REFERENCE_MIME,
  encodeTransferToken,
  toReferenceClipboardText,
  toReferenceClipboardTextList,
} from '../codec'
import {
  copyTransferToken,
  copyTransferTokens,
  finishTransferSession,
  startTransferSession,
  updateTransferPointer,
} from '../transfer-stx'
import type { TransferReferenceToken } from '../types'

export interface UseTransferDraggableOptions {
  token: TransferReferenceToken
  tokens?: ReadonlyArray<TransferReferenceToken>
  enabled?: boolean
  sourceSelectionIds?: ReadonlyArray<string>
  onDragStateChange?: (dragging: boolean) => void
}

export interface UseTransferDraggableResult {
  draggableProps: {
    draggable: boolean
    onDragStart: DragEventHandler<HTMLElement>
    onDragEnd: DragEventHandler<HTMLElement>
    onDrag: DragEventHandler<HTMLElement>
  }
  copyReference: () => Promise<void>
}

function formatDragLabel(tokens: ReadonlyArray<TransferReferenceToken>): string {
  if (tokens.length <= 1) {
    const first = tokens[0]
    if (!first) return 'task ref'
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

function applyDragImage(event: DragEvent<HTMLElement>, label: string) {
  if (typeof document === 'undefined') {
    return
  }

  const badge = document.createElement('div')
  badge.textContent = `↗ ${label}`
  badge.style.position = 'fixed'
  badge.style.top = '-9999px'
  badge.style.left = '-9999px'
  badge.style.padding = '2px 6px'
  badge.style.border = '1px solid #2f2f2f'
  badge.style.background = '#111'
  badge.style.color = '#f1f1f1'
  badge.style.fontFamily = 'var(--font-data, "Share Tech Mono", monospace)'
  badge.style.fontSize = '12px'
  badge.style.whiteSpace = 'nowrap'
  badge.style.pointerEvents = 'none'

  document.body.appendChild(badge)
  event.dataTransfer.setDragImage(badge, 12, 10)

  requestAnimationFrame(() => {
    badge.remove()
  })
}

export function useTransferDraggable({
  token,
  tokens,
  enabled = true,
  sourceSelectionIds = [],
  onDragStateChange,
}: UseTransferDraggableOptions): UseTransferDraggableResult {
  const onDragStart = useCallback<DragEventHandler<HTMLElement>>(
    (event) => {
      if (!enabled) {
        event.preventDefault()
        return
      }

      const resolvedTokens = tokens && tokens.length > 0 ? tokens : [token]
      const payload =
        resolvedTokens.length === 1
          ? encodeTransferToken(resolvedTokens[0])
          : JSON.stringify(resolvedTokens)

      const dragLabel = formatDragLabel(resolvedTokens)

      event.dataTransfer.setData(TRANSFER_REFERENCE_MIME, payload)
      event.dataTransfer.setData('application/json', payload)
      event.dataTransfer.effectAllowed = 'copy'

      applyDragImage(event, dragLabel)

      startTransferSession(
        resolvedTokens[0],
        { x: event.clientX, y: event.clientY },
        resolvedTokens,
      )
      onDragStateChange?.(true)
    },
    [enabled, onDragStateChange, token, tokens],
  )

  const onDrag = useCallback<DragEventHandler<HTMLElement>>((event) => {
    updateTransferPointer({ x: event.clientX, y: event.clientY })
  }, [])

  const onDragEnd = useCallback<DragEventHandler<HTMLElement>>(
    () => {
      finishTransferSession()
      onDragStateChange?.(false)
    },
    [onDragStateChange],
  )

  const copyReference = useCallback(async () => {
    const resolvedTokens = tokens && tokens.length > 0 ? tokens : [token]

    if (resolvedTokens.length === 1) {
      copyTransferToken(resolvedTokens[0], sourceSelectionIds)
    } else {
      copyTransferTokens(resolvedTokens, sourceSelectionIds)
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return
    }

    try {
      const text =
        resolvedTokens.length === 1
          ? toReferenceClipboardText(resolvedTokens[0])
          : toReferenceClipboardTextList(resolvedTokens)
      await navigator.clipboard.writeText(text)
    } catch {
      // Clipboard permission failure is non-fatal; in-memory clipboard still works.
    }
  }, [sourceSelectionIds, token, tokens])

  return {
    draggableProps: {
      draggable: enabled,
      onDragStart,
      onDragEnd,
      onDrag,
    },
    copyReference,
  }
}
