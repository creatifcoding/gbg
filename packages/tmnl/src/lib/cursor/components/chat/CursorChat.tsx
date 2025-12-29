/**
 * CursorChat Component
 *
 * Main chat container for the Dynamic Island expanded state.
 * Replaces the original ChatContent.tsx.
 *
 * Architecture:
 * - Uses AI Elements Conversation + Message components
 * - effect-atom for state (messagesAtom, statusAtom, attachmentsAtom)
 * - CursorPromptInput for rich input with attachments
 * - Keyboard: Escape → collapse, Enter → send
 */

import { useCallback } from 'react'
import { motion } from 'framer-motion'
import type { UIMessage } from 'ai'

import { CursorConversation } from './CursorConversation'
import { CursorPromptInput } from './CursorPromptInput'
import { Loader } from '@/components/ai-elements/loader'
import { XIcon } from 'lucide-react'
import type { CursorAttachment } from '../../atoms'

interface CursorChatProps {
  messages: UIMessage[]
  status: 'awaiting_message' | 'streaming' | 'in_progress' | 'submitted' | 'ready' | 'error'
  onSend: (content: string, attachments?: CursorAttachment[]) => Promise<void>
  onCollapse: () => void
}

export function CursorChat({ messages, status, onSend, onCollapse }: CursorChatProps) {
  const isStreaming = status === 'streaming' || status === 'in_progress' || status === 'submitted'

  // Handle send with attachments
  const handleSend = useCallback(
    async (content: string, attachments?: CursorAttachment[]) => {
      if ((!content.trim() && (!attachments || attachments.length === 0)) || isStreaming) return
      await onSend(content, attachments)
    },
    [isStreaming, onSend]
  )

  return (
    <motion.div
      className="flex h-full w-full flex-col overflow-hidden pointer-events-auto"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      style={{
        background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.98), rgba(25, 25, 25, 0.95))',
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <Loader size="sm" />
          ) : (
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: 'rgba(100, 100, 100, 0.5)' }}
            />
          )}
          <span className="font-mono text-xs" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
            {isStreaming ? 'thinking...' : 'cursor'}
          </span>
        </div>
        <button
          onClick={onCollapse}
          className="rounded p-1 transition-colors hover:bg-white/10"
          style={{ color: 'rgba(255, 255, 255, 0.4)' }}
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Conversation */}
      <CursorConversation messages={messages} isStreaming={isStreaming} />

      {/* Input */}
      <CursorPromptInput
        onSend={handleSend}
        onCollapse={onCollapse}
        isStreaming={isStreaming}
        placeholder={isStreaming ? 'Thinking...' : 'Type a message...'}
      />
    </motion.div>
  )
}

export default CursorChat
