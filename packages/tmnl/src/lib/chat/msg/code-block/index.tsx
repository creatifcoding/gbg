/**
 * ChatCodeBlock — Compound component for syntax-highlighted code display.
 *
 * Compound usage:
 *   <ChatCodeBlock.Root code="const x = 1" language="typescript">
 *     <ChatCodeBlock.Header />
 *     <ChatCodeBlock.CopyButton />
 *   </ChatCodeBlock.Root>
 *
 * Convenience wrapper:
 *   <ChatCodeBlock code="const x = 1" language="typescript" />
 *
 * @module chat/msg/code-block
 */

import type { ReactElement } from 'react'
import { ChatCodeBlockRoot, type ChatCodeBlockRootProps } from './code-block-root'
import { ChatCodeBlockHeader, type ChatCodeBlockHeaderProps } from './code-block-header'
import { ChatCodeBlockCopyButton, type ChatCodeBlockCopyButtonProps } from './code-block-copy-button'

// =============================================================================
// Convenience wrapper
// =============================================================================

export interface ChatCodeBlockProps extends ChatCodeBlockRootProps {
  /** Show language/filename header. Default: true when language !== 'text' */
  showHeader?: boolean
  /** Show copy button on hover. Default: true */
  showCopy?: boolean
  /** Copy callbacks */
  onCopy?: () => void
  onCopyError?: (error: Error) => void
}

function ChatCodeBlockConvenience({
  children,
  showHeader,
  showCopy = true,
  onCopy,
  onCopyError,
  ...rootProps
}: ChatCodeBlockProps): ReactElement {
  // Compound mode
  if (children) {
    return <ChatCodeBlockRoot {...rootProps}>{children}</ChatCodeBlockRoot>
  }
  // Convenience: auto-compose Header + CopyButton
  const shouldShowHeader = showHeader ?? (rootProps.language !== 'text' && rootProps.language != null)
  return (
    <ChatCodeBlockRoot {...rootProps}>
      {shouldShowHeader && <ChatCodeBlockHeader />}
      {showCopy && <ChatCodeBlockCopyButton onCopy={onCopy} onError={onCopyError} />}
    </ChatCodeBlockRoot>
  )
}

ChatCodeBlockConvenience.displayName = 'ChatCodeBlock'

// =============================================================================
// Compound namespace
// =============================================================================

interface ChatCodeBlockComponent {
  (props: ChatCodeBlockProps): ReactElement
  displayName?: string
  Root: typeof ChatCodeBlockRoot
  Header: typeof ChatCodeBlockHeader
  CopyButton: typeof ChatCodeBlockCopyButton
}

const ChatCodeBlock = ChatCodeBlockConvenience as unknown as ChatCodeBlockComponent
ChatCodeBlock.Root = ChatCodeBlockRoot
ChatCodeBlock.Header = ChatCodeBlockHeader
ChatCodeBlock.CopyButton = ChatCodeBlockCopyButton

export { ChatCodeBlock }
export { useChatCodeBlock } from './code-block-context'
export type {
  ChatCodeBlockRootProps,
  ChatCodeBlockHeaderProps,
  ChatCodeBlockCopyButtonProps,
}
