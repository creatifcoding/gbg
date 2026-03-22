import type { ReactElement } from 'react'
import {
  RvnChatMessageAttachmentLaneRoot,
  type RvnChatMessageAttachmentLaneRootProps,
} from './attachment-lane-root'
import {
  RvnChatMessageInlineTaskThreadSlot,
  type RvnChatMessageInlineTaskThreadSlotProps,
} from './inline-task-thread-slot'
import {
  RvnChatMessageArtifactCardSlot,
  type RvnChatMessageArtifactCardSlotProps,
} from './artifact-card-slot'
import {
  RvnChatMessageStatusBadgesSlot,
  type RvnChatMessageStatusBadgesSlotProps,
} from './status-badges-slot'
import {
  RvnChatMessageCollapseControlsSlot,
  type RvnChatMessageCollapseControlsSlotProps,
} from './collapse-controls-slot'
import {
  RvnChatMessageTelemetryBadgeSlot,
  type RvnChatMessageTelemetryBadgeSlotProps,
} from './telemetry-badge-slot'
import { normalizeMessageAnchorId } from './attachment-lane-context'

interface RvnChatMessageAttachmentLaneComponent {
  (props: RvnChatMessageAttachmentLaneRootProps): ReactElement
  displayName?: string
  Root: typeof RvnChatMessageAttachmentLaneRoot
  InlineTaskThread: typeof RvnChatMessageInlineTaskThreadSlot
  ArtifactCard: typeof RvnChatMessageArtifactCardSlot
  StatusBadges: typeof RvnChatMessageStatusBadgesSlot
  CollapseControls: typeof RvnChatMessageCollapseControlsSlot
  TelemetryBadge: typeof RvnChatMessageTelemetryBadgeSlot
}

const AttachmentLane = RvnChatMessageAttachmentLaneRoot as RvnChatMessageAttachmentLaneComponent
AttachmentLane.Root = RvnChatMessageAttachmentLaneRoot
AttachmentLane.InlineTaskThread = RvnChatMessageInlineTaskThreadSlot
AttachmentLane.ArtifactCard = RvnChatMessageArtifactCardSlot
AttachmentLane.StatusBadges = RvnChatMessageStatusBadgesSlot
AttachmentLane.CollapseControls = RvnChatMessageCollapseControlsSlot
AttachmentLane.TelemetryBadge = RvnChatMessageTelemetryBadgeSlot

export { AttachmentLane as RvnChatMessageAttachmentLane, normalizeMessageAnchorId }
export type {
  RvnChatMessageAttachmentLaneRootProps,
  RvnChatMessageInlineTaskThreadSlotProps,
  RvnChatMessageArtifactCardSlotProps,
  RvnChatMessageStatusBadgesSlotProps,
  RvnChatMessageCollapseControlsSlotProps,
  RvnChatMessageTelemetryBadgeSlotProps,
}
