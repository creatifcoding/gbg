import type { ReactElement } from 'react'
import { ChatHeaderBandRoot, type ChatHeaderBandProps } from './header-band-root'
import { ChatHeaderLeftSlot, type ChatHeaderLeftSlotProps } from './header-left-slot'
import { ChatHeaderCenterSlot, type ChatHeaderCenterSlotProps } from './header-center-slot'
import { ChatHeaderRightSlot, type ChatHeaderRightSlotProps } from './header-right-slot'
import { ChatHeaderTitleSlot, type ChatHeaderTitleSlotProps } from './title-slot'
import { ChatHeaderSubtitleSlot, type ChatHeaderSubtitleSlotProps } from './subtitle-slot'
import { ChatHeaderBadgesSlot, type ChatHeaderBadgesSlotProps } from './badges-slot'
import { ChatHeaderControls, type ChatHeaderControlsProps } from './controls-root'
import { ChatHeaderAgentSelector, type ChatHeaderAgentSelectorProps } from './agent-selector-root'
import { ChatHeaderSessionCluster, type ChatHeaderSessionClusterProps } from './session-cluster-root'
import {
  ChatHeaderConnectionBadge,
  type ChatHeaderConnectionBadgeProps,
  type ChatHeaderConnectionBadgeDetails,
  type ChatConnectionState,
} from './connection-badge-root'

interface ChatHeaderBandComponent {
  (props: ChatHeaderBandProps): ReactElement
  displayName?: string
  Left: typeof ChatHeaderLeftSlot
  Center: typeof ChatHeaderCenterSlot
  Right: typeof ChatHeaderRightSlot
  Title: typeof ChatHeaderTitleSlot
  Subtitle: typeof ChatHeaderSubtitleSlot
  Badges: typeof ChatHeaderBadgesSlot
  Controls: typeof ChatHeaderControls
  AgentSelector: typeof ChatHeaderAgentSelector
  SessionCluster: typeof ChatHeaderSessionCluster
  ConnectionBadge: typeof ChatHeaderConnectionBadge
}

const HeaderBand = ChatHeaderBandRoot as unknown as ChatHeaderBandComponent
HeaderBand.Left = ChatHeaderLeftSlot
HeaderBand.Center = ChatHeaderCenterSlot
HeaderBand.Right = ChatHeaderRightSlot
HeaderBand.Title = ChatHeaderTitleSlot
HeaderBand.Subtitle = ChatHeaderSubtitleSlot
HeaderBand.Badges = ChatHeaderBadgesSlot
HeaderBand.Controls = ChatHeaderControls
HeaderBand.AgentSelector = ChatHeaderAgentSelector
HeaderBand.SessionCluster = ChatHeaderSessionCluster
HeaderBand.ConnectionBadge = ChatHeaderConnectionBadge

export { HeaderBand as ChatHeaderBand }
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
}
