/**
 * ChatToolBlock — Compound component for tool invocation display.
 *
 * Compound usage:
 *   <ChatToolBlock.Root toolCallId="..." toolName="..." state="completed" input={...} output={...}>
 *     <ChatToolBlock.Header />
 *     <ChatToolBlock.Content>
 *       <ChatToolBlock.Input />
 *       <ChatToolBlock.Output />
 *       <ChatToolBlock.Approval onApprove={...} onDeny={...} />
 *     </ChatToolBlock.Content>
 *   </ChatToolBlock.Root>
 *
 * Convenience wrapper:
 *   <ChatToolBlock toolCallId="..." toolName="..." state="completed" input={...} output={...} />
 *
 * @module chat/msg/tool-block
 */

import type { ReactElement } from 'react'
import { ChatToolBlockRoot, type ChatToolBlockRootProps } from './tool-block-root'
import { ChatToolBlockHeader, type ChatToolBlockHeaderProps } from './tool-block-header'
import { ChatToolBlockContent, type ChatToolBlockContentProps } from './tool-block-content'
import { ChatToolBlockInput, type ChatToolBlockInputProps } from './tool-block-input'
import { ChatToolBlockOutput, type ChatToolBlockOutputProps } from './tool-block-output'
import { ChatToolBlockApproval, type ChatToolBlockApprovalProps } from './tool-block-approval'

// =============================================================================
// Convenience wrapper
// =============================================================================

export interface ChatToolBlockProps extends ChatToolBlockRootProps {
  /** Approval callbacks (only rendered when state === 'approval-required') */
  onApprove?: (toolCallId: string) => void
  onDeny?: (toolCallId: string) => void
}

function ChatToolBlockConvenience({
  children,
  onApprove,
  onDeny,
  ...rootProps
}: ChatToolBlockProps): ReactElement {
  // If children provided, use compound pattern
  if (children) {
    return <ChatToolBlockRoot {...rootProps}>{children}</ChatToolBlockRoot>
  }
  // Otherwise, render the standard layout
  return (
    <ChatToolBlockRoot {...rootProps}>
      <ChatToolBlockHeader />
      <ChatToolBlockContent>
        <ChatToolBlockInput />
        <ChatToolBlockOutput />
        <ChatToolBlockApproval onApprove={onApprove} onDeny={onDeny} />
      </ChatToolBlockContent>
    </ChatToolBlockRoot>
  )
}

ChatToolBlockConvenience.displayName = 'ChatToolBlock'

// =============================================================================
// Compound namespace
// =============================================================================

interface ChatToolBlockComponent {
  (props: ChatToolBlockProps): ReactElement
  displayName?: string
  Root: typeof ChatToolBlockRoot
  Header: typeof ChatToolBlockHeader
  Content: typeof ChatToolBlockContent
  Input: typeof ChatToolBlockInput
  Output: typeof ChatToolBlockOutput
  Approval: typeof ChatToolBlockApproval
}

const ChatToolBlock = ChatToolBlockConvenience as unknown as ChatToolBlockComponent
ChatToolBlock.Root = ChatToolBlockRoot
ChatToolBlock.Header = ChatToolBlockHeader
ChatToolBlock.Content = ChatToolBlockContent
ChatToolBlock.Input = ChatToolBlockInput
ChatToolBlock.Output = ChatToolBlockOutput
ChatToolBlock.Approval = ChatToolBlockApproval

export { ChatToolBlock }
export { useChatToolBlock } from './tool-block-context'
export type {
  ChatToolBlockRootProps,
  ChatToolBlockHeaderProps,
  ChatToolBlockContentProps,
  ChatToolBlockInputProps,
  ChatToolBlockOutputProps,
  ChatToolBlockApprovalProps,
}
