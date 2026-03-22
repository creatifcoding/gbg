export { RvnChatShell } from './shell-root'
export type { RvnChatShellRootProps } from './shell-root'

export { RvnChatHeaderBand } from './header-band'
export type {
  RvnChatHeaderBandProps,
  RvnChatHeaderLeftSlotProps,
  RvnChatHeaderCenterSlotProps,
  RvnChatHeaderRightSlotProps,
  RvnChatHeaderTitleSlotProps,
  RvnChatHeaderSubtitleSlotProps,
  RvnChatHeaderBadgesSlotProps,
  RvnChatHeaderControlsProps,
  RvnChatHeaderAgentSelectorProps,
  RvnChatHeaderSessionClusterProps,
  RvnChatHeaderConnectionBadgeProps,
  RvnChatHeaderConnectionBadgeDetails,
} from './header-band'

export { RvnChatCommandBand } from './command-band'
export type { RvnChatCommandBandProps } from './command-band'

export { RvnChatThreadBand } from './thread-band'
export type { RvnChatThreadBandProps } from './thread-band'

export { RvnChatComposerBand } from './composer-band'
export type { RvnChatComposerBandProps } from './composer-band'

export { RvnChatShellOverlayLayer } from './overlay-layer'
export type { RvnChatShellOverlayLayerProps } from './overlay-layer'

export { RvnChatShellOrnamentLayer } from './ornament-layer'
export type { RvnChatShellOrnamentLayerProps } from './ornament-layer'

export {
  RVN_CHAT_SHELL_GEOMETRY_CONTRACT,
  resolveRvnChatShellGeometry,
} from './geometry-contract'
export type {
  RvnChatShellExpansionLevel,
  ResolveRvnChatShellGeometryOptions,
  RvnChatShellGeometryStyle,
} from './geometry-contract'

export {
  RVN_CHAT_SHELL_SCROLL_CONTRACT,
  resolveRvnChatShellThreadScrollStyle,
  resolveRvnChatShellComposerScrollStyle,
} from './scroll-contract'

export {
  RVN_CHAT_SHELL_REQUIRED_BANDS,
  collectRvnChatShellBandSlots,
  evaluateRvnChatShellSlotGuards,
  useRvnChatShellSlotGuards,
  RvnChatShellSlotGuards,
} from './slot-guards'
export type {
  RvnChatShellRequiredBandSlot,
  RvnChatShellSlotGuardMode,
  UseRvnChatShellSlotGuardsOptions,
  RvnChatShellSlotGuardsProps,
} from './slot-guards'
