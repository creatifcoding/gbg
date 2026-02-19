// ---------------------------------------------------------------------------
// Iconography
// ---------------------------------------------------------------------------
export {
  CHAT_ROLE_ICON_MAP, getChatRoleIcon, normalizeChatRole,
  CHAT_ICON_PRECISION, CHAT_ICON_STROKE_WIDTH, CHAT_ROLE_ICON_SIZE, CHAT_UTILITY_ICON_SIZE,
  getChatIconPrecision,
} from './iconography'
export type { ChatRawRole, ChatSemanticRole, ChatIconPrecision, ChatIconPrecisionKind } from './iconography'

// ---------------------------------------------------------------------------
// Role Rail
// ---------------------------------------------------------------------------
export { ChatMessageRoleRail } from './msg-role-rail'
export type { ChatMessageRole, ChatMessageRoleRailProps } from './msg-role-rail'

// ---------------------------------------------------------------------------
// Inline Task Types (Effect Schema)
// ---------------------------------------------------------------------------
export {
  AgentTask, AgentTaskSchema, AgentTaskThread, AgentTaskThreadSchema,
  AgentTaskStatusSchema, AgentTaskAssignmentModeSchema, AgentTaskPhaseSchema,
  AgentTaskMetadataSchema, AgentTaskThreadTransferModeSchema, AgentTaskThreadClusterSchema,
  ChatInlineTaskStatusSchema, ChatInlineTaskPhaseSchema,
  ChatInlineTaskMetadataSchema, ChatInlineTaskItemSchema,
} from './inline-task-types'
export type {
  AgentTaskStatus, AgentTaskAssignmentMode, AgentTaskPhase, AgentTaskMetadata,
  AgentTaskThreadTransferMode, AgentTaskThreadCluster,
  ChatInlineTaskStatus, ChatInlineTaskPhase, ChatInlineTaskMetadata, ChatInlineTaskItem,
} from './inline-task-types'

// ---------------------------------------------------------------------------
// Message Shell
// ---------------------------------------------------------------------------
export { ChatMessageShellRoot, useChatMessageShellContext } from './message-shell'
export type { ChatMessageShellRootProps, ChatMessageShellContextValue } from './message-shell'

// ---------------------------------------------------------------------------
// Header Cluster
// ---------------------------------------------------------------------------
export { ChatMessageHeaderCluster } from './header-cluster'
export type {
  ChatMessageHeaderClusterRootProps, ChatMessageHeaderRoleProps,
  ChatMessageHeaderTimestampProps, ChatMessageHeaderStreamingMarkerProps,
  ChatMessageHeaderRoleBadgeProps, ChatMessageHeaderStreamingBadgeProps,
} from './header-cluster'

// ---------------------------------------------------------------------------
// Body Content
// ---------------------------------------------------------------------------
export { ChatMessageBodyContent } from './body-content'
export type { ChatMessageBodyContentRootProps, ChatMessageStreamCursorProps } from './body-content'

// ---------------------------------------------------------------------------
// Thinking Block (Phase A — minimal; Phase B will add compound sub-components)
// ---------------------------------------------------------------------------
export { ChatThinkingBlock } from './thinking-block'
export type { ChatThinkingBlockProps } from './thinking-block'

// ---------------------------------------------------------------------------
// Tool Block (Phase A — minimal; Phase B will add compound sub-components)
// ---------------------------------------------------------------------------
export { ChatToolBlock } from './tool-block'
export type { ChatToolBlockProps } from './tool-block'

// ---------------------------------------------------------------------------
// Footer Actions
// ---------------------------------------------------------------------------
export { ChatMessageFooterActions } from './footer-actions'
export type { ChatMessageFooterActionsRootProps, ChatMessageActionsGroupProps } from './footer-actions'

// ---------------------------------------------------------------------------
// Severity Rails
// ---------------------------------------------------------------------------
export { ChatMessageSeverityRails } from './severity-rails'
export type { ChatMessageSeverityRailsRootProps, ChatMessageRoleIconRailProps } from './severity-rails'

// ---------------------------------------------------------------------------
// Attachment Lane
// ---------------------------------------------------------------------------
export { ChatMessageAttachmentLane, normalizeMessageAnchorId } from './attachment-lane'
export type {
  ChatMessageAttachmentLaneRootProps, ChatMessageInlineTaskThreadSlotProps,
  ChatMessageArtifactCardSlotProps, ChatMessageStatusBadgesSlotProps,
  ChatMessageCollapseControlsSlotProps, ChatMessageTelemetryBadgeSlotProps,
} from './attachment-lane'

// ---------------------------------------------------------------------------
// Inline Task Detail
// ---------------------------------------------------------------------------
export { InlineTaskDetail, InlineTaskBadge, InlineTaskDetailFields, InlineTaskDetailFieldStatus, InlineTaskDetailFieldDeps } from './inline-task-detail'
export { AGENT_TASK_FIELD_DESCRIPTORS, SPECIALIZED_FIELD_KEYS, DEFAULT_HIDDEN_FIELDS } from './inline-task-detail'
export type { InlineTaskDetailRootProps, InlineTaskBadgeProps, InlineTaskFieldRenderer, InlineTaskFieldDescriptor } from './inline-task-detail'

// ---------------------------------------------------------------------------
// Inline Task Shell
// ---------------------------------------------------------------------------
export { InlineTaskShell, useInlineTaskShellContext } from './inline-task-shell'
export type {
  InlineTaskShellRootProps, InlineTaskShellContextValue, InlineTaskShellMetrics,
  ExpandBandProps, MetricsBandProps, MetricCellProps,
  ThreadBandProps, SearchBandProps,
  InlineTaskRowActionBtnProps, InlineTaskRowProgressProps, InlineTaskRowToolbarProps,
  InlineTaskRowAction,
} from './inline-task-shell'

// ---------------------------------------------------------------------------
// Root-level components
// ---------------------------------------------------------------------------
export { ChatInlineTaskExpandControl } from './inline-task-expand-control'
export type { ChatInlineTaskExpandControlProps } from './inline-task-expand-control'

export { ChatInlineTaskLog } from './inline-task-log'
export type { ChatInlineTaskLogProps, ChatInlineTaskLogEntry } from './inline-task-log'

export { ChatInlineTaskRow } from './inline-task-row'
export type { ChatInlineTaskRowProps } from './inline-task-row'

export { ChatInlineTaskVirtualizedList } from './inline-task-virtualized-list'
export type { ChatInlineTaskVirtualizedListProps } from './inline-task-virtualized-list'

export { ChatInlineTaskThread } from './inline-task-thread'
export type { ChatInlineTaskThreadProps } from './inline-task-thread'
