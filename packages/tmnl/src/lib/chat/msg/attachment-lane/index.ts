import type { ReactElement } from 'react'
import { ChatMessageAttachmentLaneRoot, type ChatMessageAttachmentLaneRootProps } from './attachment-lane-root'
import { ChatMessageInlineTaskThreadSlot, type ChatMessageInlineTaskThreadSlotProps } from './inline-task-thread-slot'
import { ChatMessageArtifactCardSlot, type ChatMessageArtifactCardSlotProps } from './artifact-card-slot'
import { ChatMessageStatusBadgesSlot, type ChatMessageStatusBadgesSlotProps } from './status-badges-slot'
import { ChatMessageCollapseControlsSlot, type ChatMessageCollapseControlsSlotProps } from './collapse-controls-slot'
import { ChatMessageTelemetryBadgeSlot, type ChatMessageTelemetryBadgeSlotProps } from './telemetry-badge-slot'
import { normalizeMessageAnchorId } from './attachment-lane-context'

interface ChatMessageAttachmentLaneComponent {
  (props: ChatMessageAttachmentLaneRootProps): ReactElement
  displayName?: string
  Root: typeof ChatMessageAttachmentLaneRoot
  InlineTaskThread: typeof ChatMessageInlineTaskThreadSlot
  ArtifactCard: typeof ChatMessageArtifactCardSlot
  StatusBadges: typeof ChatMessageStatusBadgesSlot
  CollapseControls: typeof ChatMessageCollapseControlsSlot
  TelemetryBadge: typeof ChatMessageTelemetryBadgeSlot
}

const AttachmentLane = ChatMessageAttachmentLaneRoot as unknown as ChatMessageAttachmentLaneComponent
AttachmentLane.Root = ChatMessageAttachmentLaneRoot
AttachmentLane.InlineTaskThread = ChatMessageInlineTaskThreadSlot
AttachmentLane.ArtifactCard = ChatMessageArtifactCardSlot
AttachmentLane.StatusBadges = ChatMessageStatusBadgesSlot
AttachmentLane.CollapseControls = ChatMessageCollapseControlsSlot
AttachmentLane.TelemetryBadge = ChatMessageTelemetryBadgeSlot

export { AttachmentLane as ChatMessageAttachmentLane, normalizeMessageAnchorId }
export type {
  ChatMessageAttachmentLaneRootProps,
  ChatMessageInlineTaskThreadSlotProps,
  ChatMessageArtifactCardSlotProps,
  ChatMessageStatusBadgesSlotProps,
  ChatMessageCollapseControlsSlotProps,
  ChatMessageTelemetryBadgeSlotProps,
}
