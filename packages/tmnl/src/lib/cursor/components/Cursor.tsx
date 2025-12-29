/**
 * Cursor Component
 *
 * Global AI-controlled Dynamic Island overlay.
 * Integrates:
 * - AI SDK 6 useChat hook with Claude Code provider
 * - effect-atom state management
 * - Position control via natural language intent parsing
 * - Pill ↔ Chat state transitions
 */

import { useRef, useEffect, useCallback, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useAtomValue } from '@effect-atom/atom-react'
import { AnimatePresence } from 'framer-motion'
import {
  cursorRegistry,
  CursorRegistryProvider,
  positionAtom,
  boundsAtom,
  cursorStateAtom,
  messagesAtom,
  statusAtom,
  sizeKeyAtom,
  cursorOps,
  hasBoundsAtom,
} from '../atoms'
import { DynamicIsland, DynamicIslandProvider, useDynamicIsland } from './DynamicIsland'
import { CursorChat } from './chat'
import { PillIndicator } from './PillIndicator'
import { useCursorPersistence } from '../hooks/useCursorPersistence'
import { parseIntent } from '../services/IntentParser'
import * as Option from 'effect/Option'
import type { IslandSize } from '../schemas/position'

// -----------------------------------------------------------------------------
// Size Configuration
// -----------------------------------------------------------------------------

const SIZE_PRESETS: Record<string, IslandSize> = {
  minimal: { width: 120, height: 40 },
  compact: { width: 200, height: 48 },
  default: { width: 360, height: 400 },
  expanded: { width: 480, height: 560 },
}

const getIslandSize = (sizeKey: string): IslandSize =>
  SIZE_PRESETS[sizeKey] ?? SIZE_PRESETS.minimal

// -----------------------------------------------------------------------------
// Dynamic Island Configuration
// -----------------------------------------------------------------------------

const ISLAND_CONFIG = {
  sizes: SIZE_PRESETS,
  defaultSize: 'minimal' as const,
  physics: {
    mass: 1,
    tension: 280,
    friction: 24,
    velocity: 0,
  },
  drag: {
    enabled: true,
    elastic: 0.5,
    momentum: true,
  },
}

// -----------------------------------------------------------------------------
// Inner Component (has access to DynamicIsland context)
// -----------------------------------------------------------------------------

function CursorInner() {
  const position = useAtomValue(positionAtom)
  const bounds = useAtomValue(boundsAtom)
  const cursorState = useAtomValue(cursorStateAtom)
  const sizeKey = useAtomValue(sizeKeyAtom)
  const hasBounds = useAtomValue(hasBoundsAtom)

  // Get DynamicIsland context for size transitions
  const { transition } = useDynamicIsland()

  const islandSize = useMemo(() => getIslandSize(sizeKey), [sizeKey])

  // Sync sizeKey atom → DynamicIsland internal state
  useEffect(() => {
    transition(sizeKey)
  }, [sizeKey, transition])

  // AI SDK useChat integration (v5.0+: sendMessage replaces append, transport replaces api)
  // NOTE: Claude Code provider does NOT support AI SDK's custom tools interface.
  // Position/visibility intents are parsed from the AI's natural language response.
  const { messages, status, sendMessage, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: 'http://localhost:7682/chat',
    }),
    onFinish: ({ message }) => {
      cursorRegistry.set(statusAtom, 'idle')

      // Parse AI response for semantic position/visibility intents
      // AI SDK 5.0+: message.parts replaces message.content
      const textContent = message.parts
        ?.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map((part) => part.text)
        .join('') ?? ''

      if (textContent) {
        const intent = parseIntent(textContent)
        if (Option.isSome(intent)) {
          const { value } = intent
          if (value._tag === 'move') {
            // Auto-reposition based on AI's semantic intent
            cursorOps.moveTo({ position: value.corner, islandSize })
          } else if (value._tag === 'minimize') {
            cursorOps.collapse()
          } else if (value._tag === 'expand') {
            cursorOps.expand()
          }
        }
      }
    },
    onError: (error) => {
      console.error('[Cursor] Chat error:', error)
      cursorRegistry.set(statusAtom, 'idle')
    },
  })

  // Sync AI SDK messages → effect-atom
  useEffect(() => {
    cursorRegistry.set(messagesAtom, messages)
  }, [messages])

  // Sync AI SDK status → effect-atom
  useEffect(() => {
    if (status === 'streaming') {
      cursorRegistry.set(statusAtom, 'streaming')
    } else if (status === 'submitted') {
      cursorRegistry.set(statusAtom, 'thinking')
    }
  }, [status])

  // Initialize position when bounds are ready
  useEffect(() => {
    if (hasBounds) {
      cursorOps.initializeToBottomRight({ islandSize })
    }
  }, [hasBounds, islandSize])

  // Handle pill click → expand
  const handlePillClick = useCallback(() => {
    cursorOps.expand()
  }, [])

  // Handle drag end
  const handleDragEnd = useCallback((pos: { x: number; y: number }) => {
    cursorOps.updatePosition({ position: pos })
  }, [])

  // Handle send message (AI SDK 5.0+: sendMessage({ text }) replaces append)
  // Supports optional attachments for future Claude Code file API
  const handleSend = useCallback(
    async (content: string, attachments?: Array<{ id: string; type: 'file'; url?: string; mediaType?: string; filename?: string }>) => {
      if (!content.trim() && (!attachments || attachments.length === 0)) return
      cursorRegistry.set(statusAtom, 'thinking')
      // TODO: When Claude Code API supports files, convert attachments to AI SDK format
      // For now, just send the text content
      await sendMessage({ text: content })
    },
    [sendMessage]
  )

  // Handle collapse
  const handleCollapse = useCallback(() => {
    cursorOps.collapse()
  }, [])

  // Compute drag constraints from bounds
  const dragConstraints = useMemo(
    () => ({
      left: 16,
      right: Math.max(0, bounds.width - islandSize.width - 16),
      top: 16,
      bottom: Math.max(0, bounds.height - islandSize.height - 16),
    }),
    [bounds.width, bounds.height, islandSize.width, islandSize.height]
  )

  return (
    <DynamicIsland
      position={position}
      draggable
      onDragEnd={handleDragEnd}
      dragConstraints={dragConstraints}
    >
      <AnimatePresence mode="wait">
        {cursorState === 'pill' ? (
          <PillIndicator
            key="pill"
            status={status}
            messageCount={messages.length}
            onClick={handlePillClick}
          />
        ) : (
          <CursorChat
            key="chat"
            messages={messages}
            status={status}
            onSend={handleSend}
            onCollapse={handleCollapse}
          />
        )}
      </AnimatePresence>
    </DynamicIsland>
  )
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function Cursor() {
  const containerRef = useRef<HTMLDivElement>(null)

  // Enable localStorage persistence for corner preference
  useCursorPersistence()

  // Measure content area bounds on mount/resize
  useEffect(() => {
    const updateBounds = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        cursorOps.updateBounds({ bounds: { width: rect.width, height: rect.height } })
      }
    }

    updateBounds()
    window.addEventListener('resize', updateBounds)
    return () => window.removeEventListener('resize', updateBounds)
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      data-cursor-container
    >
      <CursorRegistryProvider>
        <DynamicIslandProvider config={ISLAND_CONFIG}>
          <CursorInner />
        </DynamicIslandProvider>
      </CursorRegistryProvider>
    </div>
  )
}

export default Cursor
