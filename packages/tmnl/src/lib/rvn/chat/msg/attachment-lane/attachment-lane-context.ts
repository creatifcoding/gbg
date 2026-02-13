import { createContext, useContext } from 'react'

export interface RvnChatMessageAttachmentLaneContextValue {
  readonly messageAnchorId: string
}

export const RvnChatMessageAttachmentLaneContext =
  createContext<RvnChatMessageAttachmentLaneContextValue | null>(null)

export function useRvnChatMessageAttachmentLaneContext(componentName: string) {
  const context = useContext(RvnChatMessageAttachmentLaneContext)
  if (!context) {
    throw new Error(`${componentName} must be used within RvnChatMessage.AttachmentLane.Root`)
  }
  return context
}

export function normalizeMessageAnchorId(messageAnchorId: string): string {
  const normalized = messageAnchorId.trim()
  if (normalized.length === 0) {
    throw new Error('RvnChatMessage.AttachmentLane.Root requires a non-empty messageAnchorId')
  }
  return normalized
}
