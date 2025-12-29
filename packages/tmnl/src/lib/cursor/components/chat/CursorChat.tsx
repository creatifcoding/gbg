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
 * - Zoom: Cmd/Ctrl + scroll or +/-
 */

import { useCallback, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { UIMessage } from 'ai'

import { CursorConversation } from './CursorConversation'
import { CursorPromptInput } from './CursorPromptInput'
import { Loader } from '@/components/ai-elements/loader'
import { XIcon, ZoomInIcon, ZoomOutIcon } from 'lucide-react'
import type { CursorAttachment } from '../../atoms'

const ZOOM_MIN = 0.75
const ZOOM_MAX = 1.5
const ZOOM_STEP = 0.1

interface CursorChatProps {
  messages: UIMessage[]
  status: 'awaiting_message' | 'streaming' | 'in_progress' | 'submitted' | 'ready' | 'error'
  onSend: (content: string, attachments?: CursorAttachment[]) => Promise<void>
  onCollapse: () => void
}

export function CursorChat({ messages, status, onSend, onCollapse }: CursorChatProps) {
  const isStreaming = status === 'streaming' || status === 'in_progress' || status === 'submitted'
  const [zoom, setZoom] = useState(1)

  // Handle send with attachments
  const handleSend = useCallback(
    async (content: string, attachments?: CursorAttachment[]) => {
      if ((!content.trim() && (!attachments || attachments.length === 0)) || isStreaming) return
      await onSend(content, attachments)
    },
    [isStreaming, onSend]
  )

  // Zoom handlers
  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))
  }, [])

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))
  }, [])

  const resetZoom = useCallback(() => {
    setZoom(1)
  }, [])

  // Keyboard zoom: Cmd/Ctrl + Plus/Minus/0
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return

      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '-') {
        e.preventDefault()
        zoomOut()
      } else if (e.key === '0') {
        e.preventDefault()
        resetZoom()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zoomIn, zoomOut, resetZoom])

  // Wheel zoom: Cmd/Ctrl + scroll
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return

      e.preventDefault()
      if (e.deltaY < 0) {
        zoomIn()
      } else {
        zoomOut()
      }
    },
    [zoomIn, zoomOut]
  )

  return (
    <motion.div
      className="flex h-full w-full flex-col overflow-hidden pointer-events-auto"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onWheel={handleWheel}
      style={{
        background: 'oklch(0.03 0 0)',
        borderRadius: 16,
        border: '1px solid oklch(0.15 0 0)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: '1px solid oklch(0.12 0 0)' }}
      >
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <Loader size={8} className="text-white/40" />
          ) : (
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: 'oklch(0.25 0 0)' }}
            />
          )}
          <span className="font-mono text-sm" style={{ color: 'oklch(0.5 0 0)' }}>
            {isStreaming ? 'thinking...' : 'cursor'}
          </span>
        </div>

        {/* Zoom controls + close */}
        <div className="flex items-center gap-1">
          {zoom !== 1 && (
            <span
              className="font-mono text-xs px-1 cursor-pointer hover:opacity-80"
              style={{ color: 'oklch(0.4 0 0)' }}
              onClick={resetZoom}
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </span>
          )}
          <button
            onClick={zoomOut}
            className="rounded p-1 transition-colors hover:bg-white/5"
            style={{ color: 'oklch(0.4 0 0)' }}
            title="Zoom out (Cmd -)"
          >
            <ZoomOutIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={zoomIn}
            className="rounded p-1 transition-colors hover:bg-white/5"
            style={{ color: 'oklch(0.4 0 0)' }}
            title="Zoom in (Cmd +)"
          >
            <ZoomInIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onCollapse}
            className="rounded p-1 transition-colors hover:bg-white/5"
            style={{ color: 'oklch(0.4 0 0)' }}
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Conversation with zoom */}
      <CursorConversation messages={messages} isStreaming={isStreaming} zoom={zoom} />

      {/* Separator */}
      <div
        className="mx-4 flex-shrink-0"
        style={{
          height: 1,
          background: 'linear-gradient(90deg, transparent, oklch(0.2 0 0), transparent)',
        }}
      />

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
