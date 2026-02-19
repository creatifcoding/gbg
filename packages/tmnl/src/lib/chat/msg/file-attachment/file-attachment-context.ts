/**
 * ChatFileAttachment Context — shared state for compound sub-components.
 *
 * @module chat/msg/file-attachment
 */

import { createContext, useContext } from 'react'

export interface ChatFileAttachmentContextValue {
  /** File URL */
  readonly url: string
  /** MIME type */
  readonly mediaType: string
  /** Display filename (derived from URL if not provided) */
  readonly filename: string
  /** File size in bytes */
  readonly size?: number
  /** Whether this is an image that can be previewed inline */
  readonly isImage: boolean
}

export const ChatFileAttachmentContext = createContext<ChatFileAttachmentContextValue | null>(null)

export function useChatFileAttachment(): ChatFileAttachmentContextValue {
  const ctx = useContext(ChatFileAttachmentContext)
  if (!ctx) {
    throw new Error('ChatFileAttachment sub-components must be used within ChatFileAttachment.Root')
  }
  return ctx
}
