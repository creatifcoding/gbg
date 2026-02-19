/**
 * ChatTokenUsage — Compound component for token usage and cost display.
 *
 * Compound usage:
 *   <ChatTokenUsage.Root inputTokens={1200} outputTokens={340} maxTokens={128000}>
 *     <ChatTokenUsage.Ring />
 *     <ChatTokenUsage.Detail />
 *     <ChatTokenUsage.Cost />
 *   </ChatTokenUsage.Root>
 *
 * Badge usage (compact ring + percent for header band):
 *   <ChatTokenUsage inputTokens={1200} outputTokens={340} maxTokens={128000} />
 *
 * @module chat/msg/token-usage
 */

import type { ReactElement } from 'react'
import { ChatTokenUsageRoot, type ChatTokenUsageRootProps } from './token-usage-root'
import { ChatTokenUsageRing, type ChatTokenUsageRingProps } from './token-usage-ring'
import { ChatTokenUsageDetail, type ChatTokenUsageDetailProps } from './token-usage-detail'
import { ChatTokenUsageCost, type ChatTokenUsageCostProps } from './token-usage-cost'

// =============================================================================
// Convenience wrapper — compact badge: ring + percent label
// =============================================================================

export interface ChatTokenUsageProps extends ChatTokenUsageRootProps {}

function ChatTokenUsageConvenience({
  children,
  ...rootProps
}: ChatTokenUsageProps): ReactElement {
  // Compound mode
  if (children) {
    return <ChatTokenUsageRoot {...rootProps}>{children}</ChatTokenUsageRoot>
  }
  // Convenience: compact badge with ring + label
  return (
    <ChatTokenUsageRoot className="gap-1.5" {...rootProps}>
      <ChatTokenUsageRing size={14} />
    </ChatTokenUsageRoot>
  )
}

ChatTokenUsageConvenience.displayName = 'ChatTokenUsage'

// =============================================================================
// Compound namespace
// =============================================================================

interface ChatTokenUsageComponent {
  (props: ChatTokenUsageProps): ReactElement
  displayName?: string
  Root: typeof ChatTokenUsageRoot
  Ring: typeof ChatTokenUsageRing
  Detail: typeof ChatTokenUsageDetail
  Cost: typeof ChatTokenUsageCost
}

const ChatTokenUsage = ChatTokenUsageConvenience as unknown as ChatTokenUsageComponent
ChatTokenUsage.Root = ChatTokenUsageRoot
ChatTokenUsage.Ring = ChatTokenUsageRing
ChatTokenUsage.Detail = ChatTokenUsageDetail
ChatTokenUsage.Cost = ChatTokenUsageCost

export { ChatTokenUsage }
export { useChatTokenUsage } from './token-usage-context'
export type {
  ChatTokenUsageRootProps,
  ChatTokenUsageRingProps,
  ChatTokenUsageDetailProps,
  ChatTokenUsageCostProps,
}
export type { TokenUsageData } from './token-usage-context'
