import './styles/tokens.css'
import './styles/shell.css'
import './styles/message.css'
import './styles/composer.css'
import './styles/status.css'
import './styles/selector.css'
import './styles/banner.css'
import './styles/card.css'
import './styles/empty.css'
import './styles/testbed.css'

import {
  RvnChatShell,
  RvnChatHeaderBand,
  RvnChatCommandBand,
  RvnChatThreadBand,
  RvnChatComposerBand,
  RvnChatShellOverlayLayer,
  RvnChatShellOrnamentLayer,
} from './shell'
import { RvnChatFrame, RvnChatFrameCorners } from './frame'
import { RvnChatMessageShell, RvnChatInlineTaskThread } from './msg'
import { RvnChatComposer } from './composer'
import {
  RvnStatusChip,
  RvnChatConnectionBadge,
  RvnChatTelemetryPill,
} from './status'
import {
  RvnChatCommandBtn,
  RvnChatTransportBtn,
  RvnChatSendBtn,
  RvnChatPauseBtn,
  RvnChatReconnectBtn,
} from './btn'
import { RvnChatAgentSelector } from './selector'
import { RvnChatInterruptionBanner } from './banner'
import { RvnChatArtifactCard } from './card'
import { RvnChatEmptyState } from './empty'
import { RvnChatIsolated } from './RvnChatIsolated'

// Core chat concerns
export * from './shell'
export * from './frame'
export * from './msg'
export * from './composer'
export * from './status'

// Design-basis extractions (scaffolded)
export * from './btn'
export * from './selector'
export * from './banner'
export * from './card'
export * from './empty'

// Backward compatibility exports during migration
export { RvnChatFrame } from './RvnChatFrame'
export { RvnStatusChip } from './RvnStatusChip'
export { RvnChatMessage } from './RvnChatMessage'
export { RvnComposerContentEditable } from './RvnComposerContentEditable'
export { RvnChatIsolated } from './RvnChatIsolated'
export type {
  RvnChatIsolatedProps,
  RvnChatIsolatedAgent,
  RvnChatIsolatedMessage,
  RvnChatIsolatedStatusRow,
  RvnChatIsolatedSendPayload,
} from './RvnChatIsolated'

/**
 * Canonical RVN chat namespace.
 * Leaf -> compound -> band -> root consumers should compose from here.
 */
export const RvnChat = {
  Shell: RvnChatShell,
  HeaderBand: RvnChatHeaderBand,
  CommandBand: RvnChatCommandBand,
  ThreadBand: RvnChatThreadBand,
  ComposerBand: RvnChatComposerBand,
  OverlayLayer: RvnChatShellOverlayLayer,
  OrnamentLayer: RvnChatShellOrnamentLayer,

  MessageShell: RvnChatMessageShell,
  InlineTaskThread: RvnChatInlineTaskThread,
  Composer: RvnChatComposer,

  Status: {
    Chip: RvnStatusChip,
    ConnectionBadge: RvnChatConnectionBadge,
    TelemetryPill: RvnChatTelemetryPill,
  },

  Button: {
    Command: RvnChatCommandBtn,
    Transport: RvnChatTransportBtn,
    Send: RvnChatSendBtn,
    Pause: RvnChatPauseBtn,
    Reconnect: RvnChatReconnectBtn,
  },

  Selector: RvnChatAgentSelector,

  Banner: {
    Interruption: RvnChatInterruptionBanner,
  },

  Card: {
    Artifact: RvnChatArtifactCard,
  },

  EmptyState: RvnChatEmptyState,
  Isolated: RvnChatIsolated,

  Frame: {
    Legacy: RvnChatFrame,
    Corners: RvnChatFrameCorners,
  },
} as const
