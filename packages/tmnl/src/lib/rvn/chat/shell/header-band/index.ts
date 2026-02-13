import type { ReactElement } from 'react'
import { RvnChatHeaderBand, type RvnChatHeaderBandProps } from './header-band-root'
import { RvnChatHeaderLeftSlot, type RvnChatHeaderLeftSlotProps } from './header-left-slot'
import { RvnChatHeaderCenterSlot, type RvnChatHeaderCenterSlotProps } from './header-center-slot'
import { RvnChatHeaderRightSlot, type RvnChatHeaderRightSlotProps } from './header-right-slot'
import { RvnChatHeaderTitleSlot, type RvnChatHeaderTitleSlotProps } from './title-slot'
import { RvnChatHeaderSubtitleSlot, type RvnChatHeaderSubtitleSlotProps } from './subtitle-slot'
import { RvnChatHeaderBadgesSlot, type RvnChatHeaderBadgesSlotProps } from './badges-slot'
import { RvnChatHeaderControls, type RvnChatHeaderControlsProps } from './controls-root'
import {
  RvnChatHeaderAgentSelector,
  type RvnChatHeaderAgentSelectorProps,
} from './agent-selector-root'
import {
  RvnChatHeaderSessionCluster,
  type RvnChatHeaderSessionClusterProps,
} from './session-cluster-root'
import {
  RvnChatHeaderConnectionBadge,
  type RvnChatHeaderConnectionBadgeProps,
  type RvnChatHeaderConnectionBadgeDetails,
} from './connection-badge-root'

interface RvnChatHeaderBandComponent {
  (props: RvnChatHeaderBandProps): ReactElement
  displayName?: string
  Left: typeof RvnChatHeaderLeftSlot
  Center: typeof RvnChatHeaderCenterSlot
  Right: typeof RvnChatHeaderRightSlot
  Title: typeof RvnChatHeaderTitleSlot
  Subtitle: typeof RvnChatHeaderSubtitleSlot
  Badges: typeof RvnChatHeaderBadgesSlot
  Controls: typeof RvnChatHeaderControls
  AgentSelector: typeof RvnChatHeaderAgentSelector
  SessionCluster: typeof RvnChatHeaderSessionCluster
  ConnectionBadge: typeof RvnChatHeaderConnectionBadge
}

const HeaderBand = RvnChatHeaderBand as RvnChatHeaderBandComponent
HeaderBand.Left = RvnChatHeaderLeftSlot
HeaderBand.Center = RvnChatHeaderCenterSlot
HeaderBand.Right = RvnChatHeaderRightSlot
HeaderBand.Title = RvnChatHeaderTitleSlot
HeaderBand.Subtitle = RvnChatHeaderSubtitleSlot
HeaderBand.Badges = RvnChatHeaderBadgesSlot
HeaderBand.Controls = RvnChatHeaderControls
HeaderBand.AgentSelector = RvnChatHeaderAgentSelector
HeaderBand.SessionCluster = RvnChatHeaderSessionCluster
HeaderBand.ConnectionBadge = RvnChatHeaderConnectionBadge

export { HeaderBand as RvnChatHeaderBand }
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
}
