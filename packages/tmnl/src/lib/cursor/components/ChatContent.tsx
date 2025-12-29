/**
 * ChatContent Component
 *
 * Expanded cursor state - full chat interface.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { UIMessage } from 'ai'

interface ChatContentProps {
  messages: UIMessage[]
  status: 'awaiting_message' | 'streaming' | 'in_progress' | 'submitted' | 'ready' | 'error'
  onSend: (content: string) => Promise<void>
  onCollapse: () => void
}

export function ChatContent({ messages, status, onSend, onCollapse }: ChatContentProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isStreaming = status === 'streaming' || status === 'in_progress' || status === 'submitted'

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!input.trim() || isStreaming) return

      const content = input
      setInput('')
      await onSend(content)
    },
    [input, isStreaming, onSend]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCollapse()
      }
    },
    [onCollapse]
  )

  return (
    <motion.div
      className="w-full h-full flex flex-col pointer-events-auto"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      style={{
        background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.98), rgba(25, 25, 25, 0.95))',
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div className="flex items-center gap-2">
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{
              background: isStreaming
                ? 'linear-gradient(135deg, #60f0a0, #30d080)'
                : 'rgba(100, 100, 100, 0.5)',
              boxShadow: isStreaming ? '0 0 8px rgba(96, 240, 160, 0.5)' : 'none',
            }}
            animate={
              isStreaming
                ? { scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }
                : {}
            }
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span
            className="font-mono text-xs"
            style={{ color: 'rgba(255, 255, 255, 0.5)' }}
          >
            {isStreaming ? 'thinking...' : 'cursor'}
          </span>
        </div>
        <button
          onClick={onCollapse}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          style={{ color: 'rgba(255, 255, 255, 0.4)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 7h10M7 2v10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              transform="rotate(45 7 7)"
            />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 ? (
          <div
            className="text-center py-8"
            style={{ color: 'rgba(255, 255, 255, 0.3)' }}
          >
            <span className="font-mono text-sm">Say something...</span>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[85%] px-3 py-2 rounded-lg"
                style={{
                  background:
                    message.role === 'user'
                      ? 'linear-gradient(135deg, rgba(60, 60, 60, 0.8), rgba(50, 50, 50, 0.6))'
                      : 'rgba(40, 40, 40, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <p
                  className="text-sm whitespace-pre-wrap"
                  style={{
                    color: 'rgba(255, 255, 255, 0.85)',
                    lineHeight: 1.5,
                  }}
                >
                  {typeof message.content === 'string'
                    ? message.content
                    : message.content
                        .filter((part) => part.type === 'text')
                        .map((part) => (part as { type: 'text'; text: string }).text)
                        .join('')}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3"
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Thinking...' : 'Type a message...'}
            disabled={isStreaming}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{
              color: 'rgba(255, 255, 255, 0.9)',
              caretColor: '#60f0a0',
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="p-1.5 rounded transition-colors"
            style={{
              background: input.trim() && !isStreaming
                ? 'linear-gradient(135deg, #60f0a0, #30d080)'
                : 'rgba(100, 100, 100, 0.3)',
              color: input.trim() && !isStreaming ? '#000' : 'rgba(255, 255, 255, 0.3)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M1 7h12M8 2l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </form>
    </motion.div>
  )
}

export default ChatContent
