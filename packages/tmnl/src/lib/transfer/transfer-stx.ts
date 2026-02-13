/**
 * @deprecated Use `@/lib/transfer/v2` instead.
 * This module uses stx-based global mutable state.
 * v2 uses atom-family scoped state with anime.js feedback.
 */
import { nanoid } from 'nanoid'
import { stxData } from '@/lib/stx'
import type {
  TransferClipboardEntry,
  TransferDropDecision,
  TransferDropIntent,
  TransferPointer,
  TransferReferenceToken,
  TransferRuntimeState,
} from './types'

const initialTransferState: TransferRuntimeState = {
  activeSession: null,
  hoverDecision: null,
  clipboard: null,
}

let _transferStx: ReturnType<typeof stxData<TransferRuntimeState>> | null = null

export function getTransferStx() {
  if (!_transferStx) {
    _transferStx = stxData<TransferRuntimeState>(initialTransferState)
  }
  return _transferStx
}

export function resetTransferStx() {
  getTransferStx().data.set({
    activeSession: null,
    hoverDecision: null,
    clipboard: null,
  })
}

export function startTransferSession(
  token: TransferReferenceToken,
  pointer: TransferPointer,
  tokens: ReadonlyArray<TransferReferenceToken> = [token],
) {
  const transfer = getTransferStx()
  transfer.data.activeSession.set({
    sessionId: nanoid(),
    token,
    tokens: [...tokens],
    pointer,
    hoverTargetId: undefined,
    startedAt: Date.now(),
  })
  transfer.data.hoverDecision.set(null)
}

export function updateTransferPointer(pointer: TransferPointer) {
  const transfer = getTransferStx()
  if (!transfer.data.activeSession.get()) {
    return
  }
  transfer.data.activeSession.pointer.set(pointer)
}

export function setTransferHover(targetId: string, decision: TransferDropDecision | null) {
  const transfer = getTransferStx()
  if (!transfer.data.activeSession.get()) {
    return
  }
  transfer.data.activeSession.hoverTargetId.set(targetId)
  transfer.data.hoverDecision.set(decision)
}

export function clearTransferHover() {
  const transfer = getTransferStx()
  if (!transfer.data.activeSession.get()) {
    return
  }
  transfer.data.activeSession.hoverTargetId.set(undefined)
  transfer.data.hoverDecision.set(null)
}

export function finishTransferSession() {
  const transfer = getTransferStx()
  transfer.data.activeSession.set(null)
  transfer.data.hoverDecision.set(null)
}

export function cancelTransferSession() {
  finishTransferSession()
}

export function copyTransferToken(token: TransferReferenceToken, sourceSelectionIds: ReadonlyArray<string> = []) {
  const transfer = getTransferStx()
  const entry: TransferClipboardEntry = {
    token,
    tokens: [token],
    copiedAt: Date.now(),
    sourceSelectionIds: [...sourceSelectionIds],
  }
  transfer.data.clipboard.set(entry)
}

export function copyTransferTokens(tokens: ReadonlyArray<TransferReferenceToken>, sourceSelectionIds: ReadonlyArray<string> = []) {
  if (tokens.length === 0) {
    return
  }

  const transfer = getTransferStx()
  const entry: TransferClipboardEntry = {
    token: tokens[0],
    tokens: [...tokens],
    copiedAt: Date.now(),
    sourceSelectionIds: [...sourceSelectionIds],
  }
  transfer.data.clipboard.set(entry)
}

export function clearTransferClipboard() {
  getTransferStx().data.clipboard.set(null)
}

export function getTransferClipboardToken(): TransferReferenceToken | null {
  return getTransferStx().data.clipboard.get()?.token ?? null
}

export function getTransferClipboardTokens(): ReadonlyArray<TransferReferenceToken> {
  const entry = getTransferStx().data.clipboard.get()
  if (!entry) {
    return []
  }
  if (entry.tokens && entry.tokens.length > 0) {
    return entry.tokens
  }
  return [entry.token]
}

export function getActiveTransferTokens(): ReadonlyArray<TransferReferenceToken> {
  const session = getTransferStx().data.activeSession.get()
  if (!session) {
    return []
  }
  if (session.tokens && session.tokens.length > 0) {
    return session.tokens
  }
  return [session.token]
}

export function defaultTransferGuard(token: TransferReferenceToken, intent: TransferDropIntent): TransferDropDecision {
  const kind = token.reference.kind
  if (!intent.acceptedKinds.includes(kind)) {
    return {
      _tag: 'TransferDropReject',
      targetId: intent.targetId,
      reason: `target does not accept ${kind} references`,
    }
  }

  return {
    _tag: 'TransferDropAccept',
    targetId: intent.targetId,
    insertMode: intent.insertMode,
  }
}
