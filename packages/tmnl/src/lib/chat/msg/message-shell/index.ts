/**
 * ChatMessageShell — compound component that wraps all message sub-compounds.
 *
 * Full assembly (with HeaderCluster, BodyContent, FooterActions, SeverityRails,
 * AttachmentLane sub-compounds) will be wired once those modules are ported.
 * For now, exports Root + context.
 */
export { ChatMessageShellRoot } from './message-shell-root'
export type { ChatMessageShellRootProps } from './message-shell-root'
export { ChatMessageShellContext, useChatMessageShellContext } from './message-shell-context'
export type { ChatMessageShellContextValue } from './message-shell-context'
