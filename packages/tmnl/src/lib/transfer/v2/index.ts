/**
 * Transfer v2 — Public API
 *
 * @since v2
 */

// ── Schemas ──────────────────────────────────────────────────
export {
  TransferKind,
  TransferInsertMode,
  TaskRef,
  ClusterRef,
  TransferRef,
  TransferToken,
  TransferAccept,
  TransferReject,
  TransferResult,
  TransferSession,
  TransferClipboardEntry,
  TransferFeedbackEvent,
} from './schemas'

// ── Errors ───────────────────────────────────────────────────
export {
  TransferRejectError,
  TransferDecodeError,
  TransferScopeNotFoundError,
} from './errors'

// ── Codec ────────────────────────────────────────────────────
export {
  encodeTokenText,
  encodeTokensText,
  decodeTokensText,
  decodeTokensTextOrEmpty,
  REF_PREFIX,
  REFSET_PREFIX,
} from './codec'

// ── Factory ──────────────────────────────────────────────────
export {
  makeTaskToken,
  makeClusterToken,
  type TransferSurfaceConfig,
} from './factory'

// ── Scope (atom families) ────────────────────────────────────
export {
  sessionFamily,
  selectionFamily,
  clipboardFamily,
  createScopeHandle,
  type TransferScopeConfig,
  type TransferScopeHandle,
} from './TransferScope'

// ── Bus (singleton atoms) ────────────────────────────────────
export {
  activeDragAtom,
  registeredSurfacesAtom,
} from './TransferBus'

// ── Traits ───────────────────────────────────────────────────
export {
  TransferSourceTrait,
  TransferTargetTrait,
  TransferFeedbackTrait,
  type TransferSourceSlot,
  type TransferTargetSlot,
  type TransferFeedbackSlot,
} from './traits'

// ── Feedback (anime.js scoped) ───────────────────────────────
export {
  useTransferFeedbackScope,
  useTransferLayout,
  type TransferFeedbackScope,
} from './feedback'

// ── Hooks ────────────────────────────────────────────────────
export {
  useInlineTaskTransfer,
  useTransferDroppable,
  useTransferScope,
  type InlineTaskTransferConfig,
  type InlineTaskTransferHandle,
  type InlineTaskRowTransferProps,
} from './hooks'

// ── Registry ─────────────────────────────────────────────────
export {
  transferRegistry,
  TransferRegistryProvider,
} from './registry'

// ── React Integration ────────────────────────────────────────
export {
  TransferBusProvider,
  useTransferBus,
} from './TransferBusProvider'

export { TransferOverlay } from './overlay/TransferOverlay'
