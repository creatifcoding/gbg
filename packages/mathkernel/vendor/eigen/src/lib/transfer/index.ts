/**
 * Transfer Library
 *
 * v2: Atom-family scoped, anime.js feedback, compound hook.
 * v1: Legacy stx-based runtime (deprecated, preserved for backward compat).
 *
 * New consumers should use `@/lib/transfer/v2`.
 */

// ── v2 re-export (preferred) ─────────────────────────────────
export * as v2 from './v2'

// ── v1 exports below (deprecated) ────────────────────────────

export {
  TransferReferenceKindSchema,
  TransferInsertModeSchema,
  TransferOriginSchema,
  TransferTaskReferenceSchema,
  TransferTaskClusterReferenceSchema,
  TransferReferenceSchema,
  TransferReferenceTokenSchema,
  TransferDropIntentSchema,
  TransferDropAcceptSchema,
  TransferDropRejectSchema,
  TransferDropDecisionSchema,
  TransferPointerSchema,
  TransferDragSessionSchema,
  TransferClipboardEntrySchema,
  TransferRuntimeStateSchema,
  type TransferReferenceKind,
  type TransferInsertMode,
  type TransferOrigin,
  type TransferTaskReference,
  type TransferTaskClusterReference,
  type TransferReference,
  type TransferReferenceToken,
  type TransferDropIntent,
  type TransferDropAccept,
  type TransferDropReject,
  type TransferDropDecision,
  type TransferPointer,
  type TransferDragSession,
  type TransferClipboardEntry,
  type TransferRuntimeState,
  type TransferGuard,
} from './types'

export {
  TRANSFER_REFERENCE_MIME,
  TRANSFER_REFERENCE_TEXT_PREFIX,
  TRANSFER_REFERENCE_SET_TEXT_PREFIX,
  encodeTransferToken,
  decodeTransferTokenOrNull,
  decodeTransferTokensOrNull,
  toReferenceClipboardText,
  fromReferenceClipboardText,
  toReferenceClipboardTextList,
  fromReferenceClipboardTextList,
} from './codec'

export {
  TransferSourceCapabilitySchema,
  TransferTargetCapabilitySchema,
  TransferFeedbackSlotSchema,
  TransferSourceTrait,
  TransferTargetTrait,
  TransferFeedbackTrait,
  type TransferSourceCapability,
  type TransferTargetCapability,
  type TransferFeedbackSlot,
  type TransferDropHandler,
} from './traits'

export {
  getTransferStx,
  resetTransferStx,
  startTransferSession,
  updateTransferPointer,
  setTransferHover,
  clearTransferHover,
  finishTransferSession,
  cancelTransferSession,
  getActiveTransferTokens,
  copyTransferToken,
  copyTransferTokens,
  clearTransferClipboard,
  getTransferClipboardToken,
  getTransferClipboardTokens,
  defaultTransferGuard,
} from './transfer-stx'

export { createTaskReferenceToken, createTaskClusterReferenceToken } from './factory'

export {
  useTransferDraggable,
  type UseTransferDraggableOptions,
  type UseTransferDraggableResult,
} from './hooks/useTransferDraggable'

export {
  useTransferDroppable,
  type UseTransferDroppableOptions,
  type UseTransferDroppableResult,
} from './hooks/useTransferDroppable'

export {
  useTransferClipboard,
  type UseTransferClipboardOptions,
  type UseTransferClipboardResult,
} from './hooks/useTransferClipboard'

export { useTransferRuntime } from './hooks/useTransferRuntime'

export {
  TransferOverlay,
  type TransferOverlayProps,
  type TransferOverlayRenderState,
} from './overlay/TransferOverlay'
