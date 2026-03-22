/**
 * TMNL Chat Module
 *
 * Phase 1: Composer — decomposed compound component with TMNL aesthetics.
 * Phase 2: Shell, Frame, Message rendering — full parity with RVN chat.
 *
 * @module chat
 */

// ---------------------------------------------------------------------------
// Composer (Phase 1)
// ---------------------------------------------------------------------------
export { Composer, useComposer } from './composer'
export type {
  ComposerProps,
  ComposerContextValue,
  ComposerRootProps,
} from './composer'

export type {
  ChatMode,
  ThinkingLevel,
  ContextChip,
  ComposerSubmitParams,
  ThinkingAnimationPreset,
  ThinkingLevelOption,
  ShadowLayer,
} from './composer'

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------
export { CHAT_TOKENS } from './tokens'

// ---------------------------------------------------------------------------
// Shell (Phase 2)
// ---------------------------------------------------------------------------
export { ChatShell } from './shell'
export type { ChatShellRootProps, ChatShellExpansionLevel, ChatShellBand } from './shell'
export { ChatHeaderBand, ChatCommandBand, ChatThreadBand, ChatComposerBand, useChatThreadTail } from './shell'
export { ModelSelector, type ModelOption, type ModelSelectorRootProps } from './shell/header-band'
export { ChatShellOverlayLayer, ChatShellOrnamentLayer } from './shell'
export { useChatShellContext } from './shell'
export {
  CHAT_SHELL_GEOMETRY_CONTRACT, resolveChatShellGeometry,
  CHAT_SHELL_SCROLL_CONTRACT, resolveChatShellThreadScrollStyle, resolveChatShellComposerScrollStyle,
} from './shell'

// ---------------------------------------------------------------------------
// Frame (Phase 2)
// ---------------------------------------------------------------------------
export { ChatFrameCorners } from './frame'
export type { ChatFrameCornersProps } from './frame'

// ---------------------------------------------------------------------------
// Message Rendering (Phase 2)
// ---------------------------------------------------------------------------
export * from './msg'

// ---------------------------------------------------------------------------
// Root Components (Phase 2)
// ---------------------------------------------------------------------------
export { ChatMessage } from './ChatMessage'
export type {
  ChatMessageRootProps,
  ChatMessageMetaProps,
  ChatMessageBodyProps,
  ChatMessageFooterProps,
} from './ChatMessage'

export { ChatStatusChip } from './StatusChip'
export type { ChatStatusChipProps, ChatStatusChipState } from './StatusChip'

export { ChatIsolated } from './ChatIsolated'
export type { ChatIsolatedProps } from './ChatIsolated'

// ---------------------------------------------------------------------------
// Buttons (Phase 2)
// ---------------------------------------------------------------------------
export { ChatCommandBtn, ChatTransportBtn, ChatSendBtn, ChatPauseBtn, ChatReconnectBtn } from './btn'
export type { ChatCommandBtnProps, ChatTransportBtnProps, ChatTransportVariant } from './btn'

// ---------------------------------------------------------------------------
// Selector (Phase 2)
// ---------------------------------------------------------------------------
export { ChatAgentSelector } from './selector'
export type { ChatAgentSelectorRootProps, ChatAgentOption } from './selector'

// ---------------------------------------------------------------------------
// Card (Phase 2)
// ---------------------------------------------------------------------------
export { ChatArtifactCard } from './card'
export type { ChatArtifactCardRootProps } from './card'

// ---------------------------------------------------------------------------
// Status (Phase 2)
// ---------------------------------------------------------------------------
export { ChatConnectionBadge, ChatTelemetryPill, ChatErrorDetailsModal } from './status'
export type {
  ChatConnectionBadgeProps,
  ChatTelemetryPillProps,
  ChatErrorDetailsModalProps,
  ChatErrorModalSeverity,
  ChatErrorModalViewVariant,
  ChatErrorModalAdapterVariant,
} from './status'

// ---------------------------------------------------------------------------
// Banner + Empty (Phase 2)
// ---------------------------------------------------------------------------
export { ChatInterruptionBanner } from './banner'
export type { ChatInterruptionBannerProps } from './banner'

export { ChatEmptyState } from './empty'
export type { ChatEmptyStateProps } from './empty'
