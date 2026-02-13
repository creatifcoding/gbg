/**
 * useTransferDroppable — Target-side drop hook.
 *
 * Handles dragover/drop events, decodes tokens, calls evaluate + lower.
 * Stays standalone — not part of the source compound hook.
 *
 * @since v2
 */
import { useCallback, useState, type RefObject, useEffect } from 'react'
import { decodeTokensTextOrEmpty } from '../codec'
import type { TransferToken, TransferResult, TransferInsertMode, TransferFeedbackEvent } from '../schemas'

const TRANSFER_MIME = 'application/x-transfer-token'

interface TransferDroppableConfig {
  /** Ref to the drop zone element */
  readonly dropRef: RefObject<HTMLElement | null>

  /** Insert mode for dropped tokens */
  readonly insertMode: TransferInsertMode

  /** Evaluate whether a token is acceptable */
  readonly evaluate: (token: TransferToken) => TransferResult

  /** Handle accepted tokens */
  readonly onAccept: (tokens: ReadonlyArray<TransferToken>, mode: TransferInsertMode) => void

  /** Optional: feedback callback */
  readonly onFeedback?: (event: TransferFeedbackEvent) => void
}

interface TransferDroppableHandle {
  readonly isOver: boolean
  readonly canAccept: boolean
}

export function useTransferDroppable(config: TransferDroppableConfig): TransferDroppableHandle {
  const [isOver, setIsOver] = useState(false)
  const [canAccept, setCanAccept] = useState(false)

  const extractTokens = useCallback(
    (dt: DataTransfer): ReadonlyArray<TransferToken> => {
      const mimeData = dt.getData(TRANSFER_MIME)
      if (mimeData) return decodeTokensTextOrEmpty(mimeData)

      const textData = dt.getData('text/plain')
      if (textData) return decodeTokensTextOrEmpty(textData)

      return []
    },
    [],
  )

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault()

      const tokens = extractTokens(e.dataTransfer!)
      if (tokens.length === 0) {
        // Can't inspect during dragover in some browsers — assume acceptable
        setIsOver(true)
        setCanAccept(true)
        e.dataTransfer!.dropEffect = 'copy'
        return
      }

      const results = tokens.map(config.evaluate)
      const allAccepted = results.every((r) => r._tag === 'TransferAccept')
      setIsOver(true)
      setCanAccept(allAccepted)
      e.dataTransfer!.dropEffect = allAccepted ? 'copy' : 'none'
    },
    [config.evaluate, extractTokens],
  )

  const handleDragLeave = useCallback((e: DragEvent) => {
    // Only handle if leaving the actual drop zone, not child elements
    const el = config.dropRef.current
    if (el && !el.contains(e.relatedTarget as Node)) {
      setIsOver(false)
      setCanAccept(false)
    }
  }, [config.dropRef])

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setIsOver(false)
      setCanAccept(false)

      const tokens = extractTokens(e.dataTransfer!)
      if (tokens.length === 0) return

      const accepted = tokens.filter((t) => config.evaluate(t)._tag === 'TransferAccept')
      const rejected = tokens.filter((t) => config.evaluate(t)._tag === 'TransferReject')

      if (accepted.length > 0) {
        config.onAccept(accepted, config.insertMode)
        config.onFeedback?.({
          _tag: 'Accepted',
          tokenCount: accepted.length,
          targetId: config.dropRef.current?.id ?? 'drop-zone',
        })
      }

      if (rejected.length > 0) {
        const rejectResult = config.evaluate(rejected[0])
        config.onFeedback?.({
          _tag: 'Rejected',
          reason: rejectResult._tag === 'TransferReject' ? rejectResult.reason : 'unknown',
          targetId: config.dropRef.current?.id ?? 'drop-zone',
        })
      }
    },
    [config.evaluate, config.onAccept, config.onFeedback, config.insertMode, config.dropRef, extractTokens],
  )

  useEffect(() => {
    const el = config.dropRef.current
    if (!el) return

    el.addEventListener('dragover', handleDragOver)
    el.addEventListener('dragleave', handleDragLeave)
    el.addEventListener('drop', handleDrop)

    return () => {
      el.removeEventListener('dragover', handleDragOver)
      el.removeEventListener('dragleave', handleDragLeave)
      el.removeEventListener('drop', handleDrop)
    }
  }, [config.dropRef, handleDragOver, handleDragLeave, handleDrop])

  return { isOver, canAccept }
}
