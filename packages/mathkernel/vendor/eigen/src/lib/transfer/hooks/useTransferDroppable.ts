import { useCallback, useState } from 'react'
import type { ClipboardEvent, DragEvent, DragEventHandler } from 'react'
import {
  TRANSFER_REFERENCE_MIME,
  decodeTransferTokenOrNull,
  decodeTransferTokensOrNull,
  fromReferenceClipboardTextList,
} from '../codec'
import {
  clearTransferHover,
  defaultTransferGuard,
  finishTransferSession,
  getActiveTransferTokens,
  getTransferClipboardTokens,
  setTransferHover,
} from '../transfer-stx'
import type {
  TransferDropDecision,
  TransferDropIntent,
  TransferReferenceToken,
} from '../types'

function decodeDragPayload(payload: string): ReadonlyArray<TransferReferenceToken> {
  try {
    const parsed = JSON.parse(payload)
    const single = decodeTransferTokenOrNull(parsed)
    if (single) {
      return [single]
    }
    const many = decodeTransferTokensOrNull(parsed)
    return many ?? []
  } catch {
    return []
  }
}

function readTransferTokens(event: DragEvent<HTMLElement>): {
  tokens: ReadonlyArray<TransferReferenceToken>
  hadPayload: boolean
} {
  const mimePayload = event.dataTransfer.getData(TRANSFER_REFERENCE_MIME)
  if (mimePayload) {
    const tokens = decodeDragPayload(mimePayload)
    return { tokens, hadPayload: true }
  }

  const jsonPayload = event.dataTransfer.getData('application/json')
  if (!jsonPayload) {
    return { tokens: [], hadPayload: false }
  }

  const tokens = decodeDragPayload(jsonPayload)
  return { tokens, hadPayload: true }
}

function resolveDragTokens(event: DragEvent<HTMLElement>): {
  tokens: ReadonlyArray<TransferReferenceToken>
  hadPayload: boolean
} {
  const fromActiveSession = getActiveTransferTokens()
  if (fromActiveSession.length > 0) {
    return {
      tokens: fromActiveSession,
      hadPayload: true,
    }
  }

  return readTransferTokens(event)
}

export interface UseTransferDroppableOptions {
  intent: TransferDropIntent
  enabled?: boolean
  guard?: (token: TransferReferenceToken, intent: TransferDropIntent) => TransferDropDecision
  onDropToken: (token: TransferReferenceToken, decision: TransferDropDecision) => void
  onRejected?: (token: TransferReferenceToken | null, reason: string) => void
}

export interface UseTransferDroppableResult {
  droppableProps: {
    onDragEnter: DragEventHandler<HTMLElement>
    onDragOver: DragEventHandler<HTMLElement>
    onDragLeave: DragEventHandler<HTMLElement>
    onDrop: DragEventHandler<HTMLElement>
    onPaste: (event: ClipboardEvent<HTMLElement>) => void
    'data-transfer-target': string
    'data-transfer-hover-state': 'idle' | 'accept' | 'reject'
  }
  hoverState: 'idle' | 'accept' | 'reject'
  pasteReference: () => void
}

export function useTransferDroppable({
  intent,
  enabled = true,
  guard = defaultTransferGuard,
  onDropToken,
  onRejected,
}: UseTransferDroppableOptions): UseTransferDroppableResult {
  const [hoverState, setHoverState] = useState<'idle' | 'accept' | 'reject'>('idle')

  const evaluate = useCallback(
    (token: TransferReferenceToken | null, hadPayload: boolean) => {
      if (!token) {
        return {
          _tag: 'TransferDropReject',
          targetId: intent.targetId,
          reason: hadPayload
            ? 'invalid transfer token payload'
            : 'missing transfer token payload',
        } as const
      }
      return guard(token, intent)
    },
    [guard, intent],
  )

  const evaluateTokens = useCallback(
    (tokens: ReadonlyArray<TransferReferenceToken>, hadPayload: boolean) => {
      if (tokens.length === 0) {
        const decision = evaluate(null, hadPayload)
        return {
          hoverDecision: decision,
          accepted: [] as Array<{ token: TransferReferenceToken; decision: TransferDropDecision }>,
          rejected: [decision],
        }
      }

      const accepted: Array<{ token: TransferReferenceToken; decision: TransferDropDecision }> = []
      const rejected: TransferDropDecision[] = []

      for (const token of tokens) {
        const decision = evaluate(token, true)
        if (decision._tag === 'TransferDropAccept') {
          accepted.push({ token, decision })
        } else {
          rejected.push(decision)
        }
      }

      return {
        hoverDecision: rejected[0] ?? accepted[0]?.decision ?? evaluate(null, hadPayload),
        accepted,
        rejected,
      }
    },
    [evaluate],
  )

  const onDragEnter = useCallback<DragEventHandler<HTMLElement>>(
    (event) => {
      if (!enabled) {
        return
      }
      const { tokens, hadPayload } = resolveDragTokens(event)
      const evaluation = evaluateTokens(tokens, hadPayload)
      setHoverState(evaluation.rejected.length === 0 ? 'accept' : 'reject')
      setTransferHover(intent.targetId, evaluation.hoverDecision)
    },
    [enabled, evaluateTokens, intent.targetId],
  )

  const onDragOver = useCallback<DragEventHandler<HTMLElement>>(
    (event) => {
      if (!enabled) {
        return
      }

      const { tokens, hadPayload } = resolveDragTokens(event)
      const evaluation = evaluateTokens(tokens, hadPayload)

      if (evaluation.rejected.length === 0 && evaluation.accepted.length > 0) {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }

      setHoverState(evaluation.rejected.length === 0 ? 'accept' : 'reject')
      setTransferHover(intent.targetId, evaluation.hoverDecision)
    },
    [enabled, evaluateTokens, intent.targetId],
  )

  const onDragLeave = useCallback<DragEventHandler<HTMLElement>>(() => {
    setHoverState('idle')
    clearTransferHover()
  }, [])

  const onDrop = useCallback<DragEventHandler<HTMLElement>>(
    (event) => {
      if (!enabled) {
        return
      }
      event.preventDefault()

      const { tokens, hadPayload } = resolveDragTokens(event)
      const evaluation = evaluateTokens(tokens, hadPayload)

      for (const entry of evaluation.accepted) {
        onDropToken(entry.token, entry.decision)
      }

      if (evaluation.accepted.length === 0) {
        const firstReject = evaluation.rejected[0]
        if (firstReject && firstReject._tag === 'TransferDropReject') {
          onRejected?.(null, firstReject.reason)
        }
      } else {
        for (const reject of evaluation.rejected) {
          if (reject._tag === 'TransferDropReject') {
            onRejected?.(null, reject.reason)
          }
        }
      }

      setHoverState('idle')
      finishTransferSession()
    },
    [enabled, evaluateTokens, onDropToken, onRejected],
  )

  const pasteReference = useCallback(() => {
    const tokens = getTransferClipboardTokens()

    if (tokens.length === 0) {
      const decision = evaluate(null, false)
      onRejected?.(null, decision.reason)
      return
    }

    for (const token of tokens) {
      const decision = evaluate(token, true)
      if (decision._tag === 'TransferDropAccept') {
        onDropToken(token, decision)
      } else {
        onRejected?.(token, decision.reason)
      }
    }
  }, [evaluate, onDropToken, onRejected])

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLElement>) => {
      if (!enabled) {
        return
      }

      const text = event.clipboardData.getData('text/plain')
      if (!text) {
        return
      }

      const tokens = fromReferenceClipboardTextList(text)
      if (tokens.length === 0) {
        return
      }

      event.preventDefault()

      for (const token of tokens) {
        const decision = evaluate(token, true)
        if (decision._tag === 'TransferDropAccept') {
          onDropToken(token, decision)
        } else {
          onRejected?.(token, decision.reason)
        }
      }
    },
    [enabled, evaluate, onDropToken, onRejected],
  )

  return {
    droppableProps: {
      onDragEnter,
      onDragOver,
      onDragLeave,
      onDrop,
      onPaste,
      'data-transfer-target': intent.targetId,
      'data-transfer-hover-state': hoverState,
    },
    hoverState,
    pasteReference,
  }
}
