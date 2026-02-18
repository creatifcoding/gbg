import { createContext, useContext } from 'react'

export interface ChatMessageAttachmentLaneContextValue {
  readonly messageAnchorId: string
}

export const ChatMessageAttachmentLaneContext =
  createContext<ChatMessageAttachmentLaneContextValue | null>(null)

export function useChatMessageAttachmentLaneContext(componentName: string) {
  const context = useContext(ChatMessageAttachmentLaneContext)
  if (!context) {
    throw new Error(`${componentName} must be used within ChatMessage.AttachmentLane.Root`)
  }
  return context
}

export function normalizeMessageAnchorId(messageAnchorId: string): string {
  const normalized = messageAnchorId.trim()
  if (normalized.length === 0) {
    throw new Error('ChatMessage.AttachmentLane.Root requires a non-empty messageAnchorId')
  }
  return normalized
}
