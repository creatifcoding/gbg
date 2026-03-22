/**
 * Transfer v2 — React Hooks barrel
 *
 * @since v2
 */

// ── Compound Hook (the one consumers use) ────────────────────
export {
  useInlineTaskTransfer,
  type InlineTaskTransferConfig,
  type InlineTaskTransferHandle,
  type InlineTaskRowTransferProps,
} from './useInlineTaskTransfer'

// ── Target Hook (standalone, for drop zones) ─────────────────
export { useTransferDroppable } from './useTransferDroppable'

// ── Bridge Hooks (internal, but exported for advanced use) ───
export { useTransferScope } from './useTransferScope'
export { useTokenMap } from './useTokenMap'
export { useDragHandlers } from './useDragHandlers'
export { useClipboardHandlers } from './useClipboardHandlers'
export { useKeyboardBindings } from './useKeyboardBindings'
