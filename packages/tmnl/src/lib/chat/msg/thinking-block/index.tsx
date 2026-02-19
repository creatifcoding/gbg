/**
 * ChatThinkingBlock — Compound component for reasoning/thinking display.
 *
 * Usage:
 *   <ChatThinkingBlock isStreaming={part.isStreaming} durationMs={part.durationMs}>
 *     <ChatThinkingBlock.Trigger />
 *     <ChatThinkingBlock.Content content={part.content} />
 *   </ChatThinkingBlock>
 *
 * Or with the convenience wrapper:
 *   <ChatThinkingBlock content="..." isStreaming={false} durationMs={2100} />
 *
 * @module chat/msg/thinking-block
 */

import type { ReactElement } from 'react'
import { ChatThinkingBlockRoot, type ChatThinkingBlockRootProps } from './thinking-block-root'
import { ChatThinkingBlockTrigger, type ChatThinkingBlockTriggerProps } from './thinking-block-trigger'
import { ChatThinkingBlockContent, type ChatThinkingBlockContentProps } from './thinking-block-content'

// =============================================================================
// Convenience wrapper — renders Root + Trigger + Content as a single call
// =============================================================================

export interface ChatThinkingBlockProps extends ChatThinkingBlockRootProps {
  /** Thinking text content (convenience: renders Trigger + Content automatically) */
  content?: string
}

function ChatThinkingBlockConvenience({
  content,
  children,
  ...rootProps
}: ChatThinkingBlockProps): ReactElement {
  // If children provided, use compound pattern
  if (children) {
    return <ChatThinkingBlockRoot {...rootProps}>{children}</ChatThinkingBlockRoot>
  }
  // Otherwise, render the standard Trigger + Content layout
  return (
    <ChatThinkingBlockRoot {...rootProps}>
      <ChatThinkingBlockTrigger />
      <ChatThinkingBlockContent content={content} />
    </ChatThinkingBlockRoot>
  )
}

ChatThinkingBlockConvenience.displayName = 'ChatThinkingBlock'

// =============================================================================
// Compound namespace
// =============================================================================

interface ChatThinkingBlockComponent {
  (props: ChatThinkingBlockProps): ReactElement
  displayName?: string
  Root: typeof ChatThinkingBlockRoot
  Trigger: typeof ChatThinkingBlockTrigger
  Content: typeof ChatThinkingBlockContent
}

const ChatThinkingBlock = ChatThinkingBlockConvenience as unknown as ChatThinkingBlockComponent
ChatThinkingBlock.Root = ChatThinkingBlockRoot
ChatThinkingBlock.Trigger = ChatThinkingBlockTrigger
ChatThinkingBlock.Content = ChatThinkingBlockContent

export { ChatThinkingBlock }
export { useChatThinkingBlock } from './thinking-block-context'
export type {
  ChatThinkingBlockRootProps,
  ChatThinkingBlockTriggerProps,
  ChatThinkingBlockContentProps,
}
