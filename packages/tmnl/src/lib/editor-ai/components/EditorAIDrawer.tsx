/**
 * EditorAIDrawer Component
 *
 * Split-pane AI chat drawer for editor panels.
 * Slides in from the right, provides chat interface with editor tools.
 *
 * Architecture:
 * - Reuses AI Elements (CursorConversation, CursorPromptInput)
 * - Panel-scoped atoms for chat state (no global pollution)
 * - Wires EditorAI tools for this specific editor
 * - Supports streaming AI responses
 *
 * @module editor-ai/components/EditorAIDrawer
 */

import { useRef, useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChat, type UIMessage } from '@ai-sdk/react'
import type { EditorId } from '../schemas/editor'
import { useEditorAI } from '../hooks'
import { XIcon, MessageSquareIcon, SparklesIcon } from 'lucide-react'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input'
import { SendIcon } from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

export interface EditorAIDrawerProps {
  /** Editor ID this drawer is attached to */
  editorId: EditorId
  /** Whether drawer is open */
  isOpen: boolean
  /** Close handler */
  onClose: () => void
  /** Width of the drawer (default 360) */
  width?: number
  /** API endpoint for chat (default '/api/editor-ai/chat') */
  apiEndpoint?: string
}

// =============================================================================
// Message Component (simplified from CursorMessage)
// =============================================================================

interface DrawerMessageProps {
  message: UIMessage
  isStreaming?: boolean
}

function DrawerMessage({ message, isStreaming = false }: DrawerMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className="flex gap-3"
      style={{
        flexDirection: isUser ? 'row-reverse' : 'row',
      }}
    >
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{
          background: isUser
            ? 'oklch(0.7 0.15 160 / 0.2)'
            : 'oklch(0.15 0 0)',
        }}
      >
        {isUser ? (
          <span
            className="text-xs font-medium"
            style={{ color: 'oklch(0.7 0.15 160)' }}
          >
            U
          </span>
        ) : (
          <SparklesIcon
            className="w-3.5 h-3.5"
            style={{ color: 'oklch(0.6 0 0)' }}
          />
        )}
      </div>

      {/* Content */}
      <div
        className="flex-1 min-w-0 rounded-lg px-3 py-2"
        style={{
          background: isUser ? 'oklch(0.12 0 0)' : 'oklch(0.08 0 0)',
          maxWidth: '85%',
        }}
      >
        {/* Text content */}
        {message.parts?.map((part, i) => {
          if (part.type === 'text') {
            return (
              <p
                key={i}
                className="text-sm whitespace-pre-wrap"
                style={{
                  color: 'oklch(0.85 0 0)',
                  lineHeight: 1.5,
                }}
              >
                {part.text}
                {isStreaming && i === message.parts!.length - 1 && (
                  <span
                    className="inline-block w-1.5 h-4 ml-0.5 animate-pulse"
                    style={{ background: 'oklch(0.7 0.15 160)' }}
                  />
                )}
              </p>
            )
          }
          return null
        })}

        {/* Fallback to content string if no parts */}
        {!message.parts && message.content && (
          <p
            className="text-sm whitespace-pre-wrap"
            style={{
              color: 'oklch(0.85 0 0)',
              lineHeight: 1.5,
            }}
          >
            {typeof message.content === 'string' ? message.content : ''}
            {isStreaming && (
              <span
                className="inline-block w-1.5 h-4 ml-0.5 animate-pulse"
                style={{ background: 'oklch(0.7 0.15 160)' }}
              />
            )}
          </p>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function EditorAIDrawer({
  editorId,
  isOpen,
  onClose,
  width = 360,
  apiEndpoint = '/api/editor-ai/chat',
}: EditorAIDrawerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const editorAI = useEditorAI()

  // AI SDK chat hook - scoped to this editor
  const {
    messages,
    status,
    input,
    setInput,
    append,
    isLoading,
  } = useChat({
    api: apiEndpoint,
    body: { editorId }, // Server knows which editor
    id: `editor-ai-${editorId}`, // Unique chat ID per editor
  })

  const isStreaming = status === 'streaming' || isLoading

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [isOpen])

  // Handle message send
  const handleSend = useCallback(async () => {
    const content = (input ?? '').trim()
    if (!content || isStreaming) return

    // Clear input immediately
    setInput('')

    // Add context about the current editor state
    const context = await editorAI.getContext().catch(() => null)

    // Append user message with context
    await append({
      role: 'user',
      content: context
        ? `[Context: Editing "${context.title || 'Untitled'}", ${context.wordCount} words, cursor at position ${context.cursorPosition}${context.selectedText ? `, selected: "${context.selectedText.slice(0, 50)}${context.selectedText.length > 50 ? '...' : ''}"` : ''}]\n\n${content}`
        : content,
    })
  }, [input, setInput, append, isStreaming, editorAI])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      // Enter to send (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [onClose, handleSend]
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 40,
          }}
          className="h-full flex flex-col overflow-hidden flex-shrink-0"
          style={{
            background: 'oklch(0.04 0 0)',
            borderLeft: '1px solid oklch(0.12 0 0)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{
              borderBottom: '1px solid oklch(0.1 0 0)',
              background: 'oklch(0.05 0 0)',
            }}
          >
            <div className="flex items-center gap-2">
              <MessageSquareIcon
                className="w-4 h-4"
                style={{ color: 'oklch(0.5 0 0)' }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: 'oklch(0.7 0 0)' }}
              >
                AI Assistant
              </span>
              {isStreaming && (
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'oklch(0.7 0.15 160)' }}
                />
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded transition-colors hover:bg-white/5"
              style={{ color: 'oklch(0.5 0 0)' }}
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-4 space-y-4">
              {messages.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-12 text-center"
                  style={{ color: 'oklch(0.4 0 0)' }}
                >
                  <SparklesIcon className="w-8 h-8 mb-3 opacity-50" />
                  <p className="text-sm font-medium mb-1">
                    Start a conversation
                  </p>
                  <p className="text-xs opacity-70 max-w-[200px]">
                    Ask me to help write, edit, or improve your document
                  </p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <DrawerMessage
                    key={message.id}
                    message={message}
                    isStreaming={
                      isStreaming && index === messages.length - 1
                    }
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div
            className="flex-shrink-0 p-3"
            style={{
              borderTop: '1px solid oklch(0.1 0 0)',
              background: 'oklch(0.03 0 0)',
            }}
          >
            <div
              className="rounded-lg overflow-hidden"
              style={{
                background: 'oklch(0.07 0 0)',
                border: '1px solid oklch(0.12 0 0)',
              }}
            >
              <textarea
                ref={inputRef}
                value={input ?? ''}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isStreaming ? 'Thinking...' : 'Ask about your document...'}
                disabled={isStreaming}
                className="w-full px-3 py-2.5 text-sm bg-transparent resize-none outline-none"
                style={{
                  color: 'oklch(0.88 0 0)',
                  minHeight: 60,
                  maxHeight: 120,
                }}
                rows={2}
              />

              <div
                className="flex items-center justify-end px-2 py-1.5"
                style={{ background: 'oklch(0.05 0 0)' }}
              >
                <button
                  onClick={handleSend}
                  disabled={isStreaming || !(input ?? '').trim()}
                  className="p-1.5 rounded transition-all"
                  style={{
                    background:
                      (input ?? '').trim() && !isStreaming
                        ? 'oklch(0.7 0.15 160)'
                        : 'oklch(0.15 0 0)',
                    color:
                      (input ?? '').trim() && !isStreaming
                        ? 'oklch(0.1 0 0)'
                        : 'oklch(0.4 0 0)',
                    cursor:
                      isStreaming || !(input ?? '').trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  <SendIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Keyboard hint */}
            <div
              className="flex items-center justify-center gap-2 mt-2 text-xs"
              style={{ color: 'oklch(0.35 0 0)' }}
            >
              <span>
                <kbd className="px-1 py-0.5 rounded bg-white/5">Enter</kbd> to
                send
              </span>
              <span>•</span>
              <span>
                <kbd className="px-1 py-0.5 rounded bg-white/5">Shift+Enter</kbd>{' '}
                for newline
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default EditorAIDrawer
