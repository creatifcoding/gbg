/**
 * CursorConversation Component
 *
 * Wrapper around AI Elements Conversation with auto-scroll.
 * Renders messages with support for all part types.
 */

import { useRef, useEffect, useCallback } from 'react'
import type { UIMessage } from 'ai'

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { CursorMessage } from './CursorMessage'
import { MessageCircleIcon } from 'lucide-react'

interface CursorConversationProps {
  messages: UIMessage[]
  isStreaming?: boolean
  zoom?: number
  onRetry?: (messageId: string) => void
  onLike?: (messageId: string) => void
  onDislike?: (messageId: string) => void
}

export function CursorConversation({
  messages,
  isStreaming = false,
  zoom = 1,
  onRetry,
  onLike,
  onDislike,
}: CursorConversationProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Determine if a specific message is the last one and currently streaming
  const isMessageStreaming = useCallback(
    (index: number) => isStreaming && index === messages.length - 1,
    [isStreaming, messages.length]
  )

  return (
    <Conversation className="flex-1 min-h-0">
      <ConversationContent
        className="gap-4 p-4"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          width: `${100 / zoom}%`,
        }}
      >
        {messages.length === 0 ? (
          <ConversationEmptyState
            title="Say something..."
            description="Start a conversation with the AI assistant"
            icon={<MessageCircleIcon className="h-8 w-8" />}
            className="text-white/30"
          />
        ) : (
          messages.map((message, index) => (
            <CursorMessage
              key={message.id}
              message={message}
              isStreaming={isMessageStreaming(index)}
              onRetry={onRetry ? () => onRetry(message.id) : undefined}
              onLike={onLike ? () => onLike(message.id) : undefined}
              onDislike={onDislike ? () => onDislike(message.id) : undefined}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}

export default CursorConversation
