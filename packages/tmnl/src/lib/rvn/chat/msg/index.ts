export { RvnChatMessage } from '../RvnChatMessage'
export type {
  RvnChatMessageRole,
  RvnChatMessageRootProps,
  RvnChatMessageMetaProps,
  RvnChatMessageBodyProps,
  RvnChatMessageFooterProps,
} from '../RvnChatMessage'

export { RvnChatMessageRoleRail } from './msg-role-rail'
export type { RvnChatMessageRoleRailProps } from './msg-role-rail'

export { RvnChatMessageShell } from './message-shell'
export type {
  RvnChatMessageShellRootProps,
  RvnChatMessageShellHeaderClusterRootProps,
  RvnChatMessageShellBodyContentRootProps,
  RvnChatMessageShellAttachmentLaneRootProps,
  RvnChatMessageShellFooterActionsRootProps,
  RvnChatMessageShellSeverityRailsRootProps,
} from './message-shell'

export { RvnChatInlineTaskThread } from './inline-task-thread'
export type {
  RvnChatInlineTaskThreadProps,
  RvnChatInlineTaskRowProps,
  RvnChatInlineTaskLogProps,
  RvnChatInlineTaskLogEntry,
  RvnChatInlineTaskExpandControlProps,
  RvnChatInlineTaskVirtualizedListProps,
  RvnChatInlineTaskItem,
  RvnChatInlineTaskMetadata,
  RvnChatInlineTaskPhase,
  RvnChatInlineTaskStatus,
  InlineTaskDetailRootProps,
  InlineTaskDetailFieldsProps,
  InlineTaskBadgeProps,
} from './inline-task-thread'

export {
  AgentTask,
  AgentTaskThread,
  AgentTaskSchema,
  AgentTaskThreadSchema,
  RvnChatInlineTaskStatusSchema,
  RvnChatInlineTaskPhaseSchema,
  RvnChatInlineTaskMetadataSchema,
  RvnChatInlineTaskItemSchema,
} from './inline-task-types'

export { RvnChatMessageHeaderCluster } from './header-cluster'
export type {
  RvnChatMessageHeaderClusterRootProps,
  RvnChatMessageHeaderRoleProps,
  RvnChatMessageHeaderTimestampProps,
  RvnChatMessageHeaderStreamingMarkerProps,
  RvnChatMessageHeaderRoleBadgeProps,
  RvnChatMessageHeaderStreamingBadgeProps,
} from './header-cluster'

export { RvnChatMessageBodyContent } from './body-content'
export type {
  RvnChatMessageBodyContentRootProps,
  RvnChatMessageStreamCursorProps,
} from './body-content'

export { RvnChatMessageFooterActions } from './footer-actions'
export type {
  RvnChatMessageFooterActionsRootProps,
  RvnChatMessageActionsGroupProps,
} from './footer-actions'

export { RvnChatMessageSeverityRails } from './severity-rails'
export type {
  RvnChatMessageSeverityRailsRootProps,
  RvnChatMessageRoleIconRailProps,
} from './severity-rails'

export {
  RvnChatMessageAttachmentLane,
  normalizeMessageAnchorId,
} from './attachment-lane'
export type {
  RvnChatMessageAttachmentLaneRootProps,
  RvnChatMessageInlineTaskThreadSlotProps,
  RvnChatMessageArtifactCardSlotProps,
  RvnChatMessageStatusBadgesSlotProps,
  RvnChatMessageCollapseControlsSlotProps,
  RvnChatMessageTelemetryBadgeSlotProps,
} from './attachment-lane'

export {
  RVN_CHAT_ROLE_ICON_MAP,
  RVN_CHAT_ICON_PRECISION,
  RVN_CHAT_ICON_STROKE_WIDTH,
  RVN_CHAT_ROLE_ICON_SIZE,
  RVN_CHAT_UTILITY_ICON_SIZE,
  getRvnChatRoleIcon,
  normalizeRvnChatRole,
  getRvnChatIconPrecision,
} from './iconography'
export type {
  RvnChatRawRole,
  RvnChatSemanticRole,
  RvnChatIconPrecision,
  RvnChatIconPrecisionKind,
} from './iconography'
