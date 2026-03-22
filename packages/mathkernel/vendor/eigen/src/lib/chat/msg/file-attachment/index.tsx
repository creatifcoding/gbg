/**
 * ChatFileAttachment — Compound component for file/image attachment display.
 *
 * Compound usage:
 *   <ChatFileAttachment.Root url="..." mediaType="image/png" filename="screenshot.png">
 *     <ChatFileAttachment.Icon />
 *     <ChatFileAttachment.Name />
 *     <ChatFileAttachment.Size />
 *     <ChatFileAttachment.Preview />
 *   </ChatFileAttachment.Root>
 *
 * Convenience wrapper:
 *   <ChatFileAttachment url="..." mediaType="application/pdf" filename="report.pdf" size={42000} />
 *
 * @module chat/msg/file-attachment
 */

import type { ReactElement } from 'react'
import { ChatFileAttachmentRoot, type ChatFileAttachmentRootProps } from './file-attachment-root'
import { ChatFileAttachmentIcon, type ChatFileAttachmentIconProps } from './file-attachment-icon'
import { ChatFileAttachmentName, type ChatFileAttachmentNameProps } from './file-attachment-name'
import { ChatFileAttachmentSize, type ChatFileAttachmentSizeProps } from './file-attachment-size'
import { ChatFileAttachmentPreview, type ChatFileAttachmentPreviewProps } from './file-attachment-preview'

// =============================================================================
// Convenience wrapper
// =============================================================================

export interface ChatFileAttachmentProps extends ChatFileAttachmentRootProps {}

function ChatFileAttachmentConvenience({
  children,
  ...rootProps
}: ChatFileAttachmentProps): ReactElement {
  if (children) {
    return <ChatFileAttachmentRoot {...rootProps}>{children}</ChatFileAttachmentRoot>
  }
  return (
    <ChatFileAttachmentRoot {...rootProps}>
      <ChatFileAttachmentIcon />
      <ChatFileAttachmentName />
      <ChatFileAttachmentSize />
    </ChatFileAttachmentRoot>
  )
}

ChatFileAttachmentConvenience.displayName = 'ChatFileAttachment'

// =============================================================================
// Compound namespace
// =============================================================================

interface ChatFileAttachmentComponent {
  (props: ChatFileAttachmentProps): ReactElement
  displayName?: string
  Root: typeof ChatFileAttachmentRoot
  Icon: typeof ChatFileAttachmentIcon
  Name: typeof ChatFileAttachmentName
  Size: typeof ChatFileAttachmentSize
  Preview: typeof ChatFileAttachmentPreview
}

const ChatFileAttachment = ChatFileAttachmentConvenience as unknown as ChatFileAttachmentComponent
ChatFileAttachment.Root = ChatFileAttachmentRoot
ChatFileAttachment.Icon = ChatFileAttachmentIcon
ChatFileAttachment.Name = ChatFileAttachmentName
ChatFileAttachment.Size = ChatFileAttachmentSize
ChatFileAttachment.Preview = ChatFileAttachmentPreview

export { ChatFileAttachment }
export { useChatFileAttachment } from './file-attachment-context'
export type {
  ChatFileAttachmentRootProps,
  ChatFileAttachmentIconProps,
  ChatFileAttachmentNameProps,
  ChatFileAttachmentSizeProps,
  ChatFileAttachmentPreviewProps,
}
