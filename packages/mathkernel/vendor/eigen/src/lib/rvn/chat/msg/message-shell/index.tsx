import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactElement,
} from 'react'
import {
  RvnChatMessageAttachmentLane,
  type RvnChatMessageAttachmentLaneRootProps,
} from '../attachment-lane'
import {
  RvnChatMessageBodyContent,
  type RvnChatMessageBodyContentRootProps,
} from '../body-content'
import {
  RvnChatMessageFooterActions,
  type RvnChatMessageFooterActionsRootProps,
} from '../footer-actions'
import {
  RvnChatMessageHeaderCluster,
  type RvnChatMessageHeaderClusterRootProps,
} from '../header-cluster'
import {
  RvnChatMessageSeverityRails,
  type RvnChatMessageSeverityRailsRootProps,
} from '../severity-rails'
import { RvnChatMessageShellRoot, type RvnChatMessageShellRootProps } from './message-shell-root'
import { useRvnChatMessageShellContext } from './message-shell-context'

export type RvnChatMessageShellHeaderClusterRootProps =
  ComponentPropsWithoutRef<'header'>

const RvnChatMessageShellHeaderClusterRoot = forwardRef<
  HTMLElement,
  RvnChatMessageShellHeaderClusterRootProps
>(({ ...props }, ref) => {
  useRvnChatMessageShellContext('RvnChatMessageShell.HeaderCluster.Root')
  return <RvnChatMessageHeaderCluster.Root ref={ref} {...props} />
})

RvnChatMessageShellHeaderClusterRoot.displayName =
  'RvnChatMessageShell.HeaderCluster.Root'

export interface RvnChatMessageShellBodyContentRootProps
  extends Omit<RvnChatMessageBodyContentRootProps, 'streaming'> {
  streaming?: boolean
}

const RvnChatMessageShellBodyContentRoot = forwardRef<
  HTMLDivElement,
  RvnChatMessageShellBodyContentRootProps
>(({ streaming, ...props }, ref) => {
  const shell = useRvnChatMessageShellContext('RvnChatMessageShell.BodyContent.Root')
  return (
    <RvnChatMessageBodyContent.Root
      ref={ref}
      streaming={streaming ?? shell.streaming}
      {...props}
    />
  )
})

RvnChatMessageShellBodyContentRoot.displayName =
  'RvnChatMessageShell.BodyContent.Root'

export interface RvnChatMessageShellAttachmentLaneRootProps
  extends Omit<RvnChatMessageAttachmentLaneRootProps, 'messageAnchorId'> {
  messageAnchorId?: string
}

const RvnChatMessageShellAttachmentLaneRoot = forwardRef<
  HTMLElement,
  RvnChatMessageShellAttachmentLaneRootProps
>(({ messageAnchorId, ...props }, ref) => {
  const shell = useRvnChatMessageShellContext('RvnChatMessageShell.AttachmentLane.Root')
  const resolvedMessageAnchorId = messageAnchorId ?? shell.messageAnchorId

  if (!resolvedMessageAnchorId) {
    throw new Error(
      'RvnChatMessageShell.AttachmentLane.Root requires messageAnchorId via prop or RvnChatMessageShell.Root',
    )
  }

  return (
    <RvnChatMessageAttachmentLane.Root
      ref={ref}
      messageAnchorId={resolvedMessageAnchorId}
      {...props}
    />
  )
})

RvnChatMessageShellAttachmentLaneRoot.displayName =
  'RvnChatMessageShell.AttachmentLane.Root'

export type RvnChatMessageShellFooterActionsRootProps =
  RvnChatMessageFooterActionsRootProps

const RvnChatMessageShellFooterActionsRoot = forwardRef<
  HTMLElement,
  RvnChatMessageShellFooterActionsRootProps
>(({ ...props }, ref) => {
  useRvnChatMessageShellContext('RvnChatMessageShell.FooterActions.Root')
  return <RvnChatMessageFooterActions.Root ref={ref} {...props} />
})

RvnChatMessageShellFooterActionsRoot.displayName =
  'RvnChatMessageShell.FooterActions.Root'

export interface RvnChatMessageShellSeverityRailsRootProps
  extends Omit<RvnChatMessageSeverityRailsRootProps, 'role'> {
  role?: RvnChatMessageSeverityRailsRootProps['role']
}

const RvnChatMessageShellSeverityRailsRoot = forwardRef<
  HTMLDivElement,
  RvnChatMessageShellSeverityRailsRootProps
>(({ role, ...props }, ref) => {
  const shell = useRvnChatMessageShellContext('RvnChatMessageShell.SeverityRails.Root')
  return <RvnChatMessageSeverityRails.Root ref={ref} role={role ?? shell.role} {...props} />
})

RvnChatMessageShellSeverityRailsRoot.displayName =
  'RvnChatMessageShell.SeverityRails.Root'

interface RvnChatMessageShellHeaderClusterComponent {
  (props: RvnChatMessageHeaderClusterRootProps): ReactElement
  displayName?: string
  Root: typeof RvnChatMessageShellHeaderClusterRoot
  Role: typeof RvnChatMessageHeaderCluster.Role
  Timestamp: typeof RvnChatMessageHeaderCluster.Timestamp
  StreamingMarker: typeof RvnChatMessageHeaderCluster.StreamingMarker
  RoleBadge: typeof RvnChatMessageHeaderCluster.RoleBadge
  StreamingBadge: typeof RvnChatMessageHeaderCluster.StreamingBadge
}

const ShellHeaderCluster =
  RvnChatMessageShellHeaderClusterRoot as RvnChatMessageShellHeaderClusterComponent
ShellHeaderCluster.Root = RvnChatMessageShellHeaderClusterRoot
ShellHeaderCluster.Role = RvnChatMessageHeaderCluster.Role
ShellHeaderCluster.Timestamp = RvnChatMessageHeaderCluster.Timestamp
ShellHeaderCluster.StreamingMarker = RvnChatMessageHeaderCluster.StreamingMarker
ShellHeaderCluster.RoleBadge = RvnChatMessageHeaderCluster.RoleBadge
ShellHeaderCluster.StreamingBadge = RvnChatMessageHeaderCluster.StreamingBadge

interface RvnChatMessageShellBodyContentComponent {
  (props: RvnChatMessageShellBodyContentRootProps): ReactElement
  displayName?: string
  Root: typeof RvnChatMessageShellBodyContentRoot
  StreamCursor: typeof RvnChatMessageBodyContent.StreamCursor
}

const ShellBodyContent =
  RvnChatMessageShellBodyContentRoot as RvnChatMessageShellBodyContentComponent
ShellBodyContent.Root = RvnChatMessageShellBodyContentRoot
ShellBodyContent.StreamCursor = RvnChatMessageBodyContent.StreamCursor

interface RvnChatMessageShellAttachmentLaneComponent {
  (props: RvnChatMessageShellAttachmentLaneRootProps): ReactElement
  displayName?: string
  Root: typeof RvnChatMessageShellAttachmentLaneRoot
  InlineTaskThread: typeof RvnChatMessageAttachmentLane.InlineTaskThread
  ArtifactCard: typeof RvnChatMessageAttachmentLane.ArtifactCard
  StatusBadges: typeof RvnChatMessageAttachmentLane.StatusBadges
  CollapseControls: typeof RvnChatMessageAttachmentLane.CollapseControls
  TelemetryBadge: typeof RvnChatMessageAttachmentLane.TelemetryBadge
}

const ShellAttachmentLane =
  RvnChatMessageShellAttachmentLaneRoot as RvnChatMessageShellAttachmentLaneComponent
ShellAttachmentLane.Root = RvnChatMessageShellAttachmentLaneRoot
ShellAttachmentLane.InlineTaskThread = RvnChatMessageAttachmentLane.InlineTaskThread
ShellAttachmentLane.ArtifactCard = RvnChatMessageAttachmentLane.ArtifactCard
ShellAttachmentLane.StatusBadges = RvnChatMessageAttachmentLane.StatusBadges
ShellAttachmentLane.CollapseControls = RvnChatMessageAttachmentLane.CollapseControls
ShellAttachmentLane.TelemetryBadge = RvnChatMessageAttachmentLane.TelemetryBadge

interface RvnChatMessageShellFooterActionsComponent {
  (props: RvnChatMessageFooterActionsRootProps): ReactElement
  displayName?: string
  Root: typeof RvnChatMessageShellFooterActionsRoot
  Group: typeof RvnChatMessageFooterActions.Group
}

const ShellFooterActions =
  RvnChatMessageShellFooterActionsRoot as RvnChatMessageShellFooterActionsComponent
ShellFooterActions.Root = RvnChatMessageShellFooterActionsRoot
ShellFooterActions.Group = RvnChatMessageFooterActions.Group

interface RvnChatMessageShellSeverityRailsComponent {
  (props: RvnChatMessageShellSeverityRailsRootProps): ReactElement
  displayName?: string
  Root: typeof RvnChatMessageShellSeverityRailsRoot
  RoleRail: typeof RvnChatMessageSeverityRails.RoleRail
  RoleIconRail: typeof RvnChatMessageSeverityRails.RoleIconRail
}

const ShellSeverityRails =
  RvnChatMessageShellSeverityRailsRoot as RvnChatMessageShellSeverityRailsComponent
ShellSeverityRails.Root = RvnChatMessageShellSeverityRailsRoot
ShellSeverityRails.RoleRail = RvnChatMessageSeverityRails.RoleRail
ShellSeverityRails.RoleIconRail = RvnChatMessageSeverityRails.RoleIconRail

interface RvnChatMessageShellComponent {
  (props: RvnChatMessageShellRootProps): ReactElement
  displayName?: string
  Root: typeof RvnChatMessageShellRoot
  HeaderCluster: RvnChatMessageShellHeaderClusterComponent
  BodyContent: RvnChatMessageShellBodyContentComponent
  AttachmentLane: RvnChatMessageShellAttachmentLaneComponent
  FooterActions: RvnChatMessageShellFooterActionsComponent
  SeverityRails: RvnChatMessageShellSeverityRailsComponent
}

const MessageShell = RvnChatMessageShellRoot as RvnChatMessageShellComponent
MessageShell.Root = RvnChatMessageShellRoot
MessageShell.HeaderCluster = ShellHeaderCluster
MessageShell.BodyContent = ShellBodyContent
MessageShell.AttachmentLane = ShellAttachmentLane
MessageShell.FooterActions = ShellFooterActions
MessageShell.SeverityRails = ShellSeverityRails

export { MessageShell as RvnChatMessageShell }

export type {
  RvnChatMessageShellRootProps,
  RvnChatMessageShellHeaderClusterRootProps,
  RvnChatMessageShellBodyContentRootProps,
  RvnChatMessageShellAttachmentLaneRootProps,
  RvnChatMessageShellFooterActionsRootProps,
  RvnChatMessageShellSeverityRailsRootProps,
}
