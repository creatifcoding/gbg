export { ChatShell } from './shell-root'
export type { ChatShellRootProps } from './shell-root'

export { ChatHeaderBand } from './header-band'
export type {
  ChatHeaderBandProps,
  ChatHeaderLeftSlotProps,
  ChatHeaderCenterSlotProps,
  ChatHeaderRightSlotProps,
  ChatHeaderTitleSlotProps,
  ChatHeaderSubtitleSlotProps,
  ChatHeaderBadgesSlotProps,
  ChatHeaderControlsProps,
  ChatHeaderAgentSelectorProps,
  ChatHeaderSessionClusterProps,
  ChatHeaderConnectionBadgeProps,
  ChatHeaderConnectionBadgeDetails,
  ChatConnectionState,
} from './header-band'

export { ChatCommandBand } from './command-band'
export type { ChatCommandBandProps } from './command-band'

export { ChatThreadBand, useChatThreadTail } from './thread-band'
export type { ChatThreadBandProps, ChatThreadAutoScrollMode, ChatThreadTailContext } from './thread-band'

export { ChatComposerBand } from './composer-band'
export type { ChatComposerBandProps } from './composer-band'

export { ChatShellOverlayLayer } from './overlay-layer'
export type { ChatShellOverlayLayerProps } from './overlay-layer'

export { ChatShellOrnamentLayer } from './ornament-layer'
export type { ChatShellOrnamentLayerProps } from './ornament-layer'

export {
  CHAT_SHELL_GEOMETRY_CONTRACT,
  resolveChatShellGeometry,
} from './geometry-contract'
export type {
  ChatShellExpansionLevel,
  ResolveChatShellGeometryOptions,
  ChatShellGeometryStyle,
} from './geometry-contract'

export {
  CHAT_SHELL_SCROLL_CONTRACT,
  resolveChatShellThreadScrollStyle,
  resolveChatShellComposerScrollStyle,
} from './scroll-contract'

export {
  CHAT_SHELL_REQUIRED_BANDS,
  collectChatShellBandSlots,
  evaluateChatShellSlotGuards,
  useChatShellSlotGuards,
  ChatShellSlotGuards,
} from './slot-guards'
export type {
  ChatShellRequiredBandSlot,
  ChatShellSlotGuardMode,
  UseChatShellSlotGuardsOptions,
  ChatShellSlotGuardsProps,
} from './slot-guards'

export type { ChatShellBand, ChatShellContextValue } from './shell-context'
export { useChatShellContext } from './shell-context'
