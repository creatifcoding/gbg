/**
 * Cursor Component
 *
 * Global AI-controlled Dynamic Island overlay.
 * Integrates:
 * - AI SDK 6 useChat hook
 * - effect-atom state management
 * - Position control via AI tools
 * - Pill ↔ Chat state transitions
 */

import { useRef, useEffect, useCallback, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { useAtomValue } from '@effect-atom/atom-react'
import { Atom } from '@effect-atom/atom-react'
import { AnimatePresence } from 'framer-motion'
import {
  positionAtom,
  boundsAtom,
  cursorStateAtom,
  messagesAtom,
  statusAtom,
  currentCornerAtom,
  sizeKeyAtom,
  cursorOps,
  hasBoundsAtom,
} from '../atoms'
import { DynamicIsland, DynamicIslandProvider, useDynamicIsland } from './DynamicIsland'
import { ChatContent } from './ChatContent'
import { PillIndicator } from './PillIndicator'
import { useCursorPersistence } from '../hooks/useCursorPersistence'
import type { Position, IslandSize, CornerPreset } from '../schemas/position'

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

  const islandSize = useMemo(() => getIslandSize(sizeKey), [sizeKey])

  // AI SDK useChat integration
  const { messages, status, append, setMessages } = useChat({
    api: '/api/cursor/chat',
    onToolCall: async ({ toolCall }) => {
      // Handle position tools client-side
      if (toolCall.toolName === 'move_to') {
        const args = toolCall.args as { position: CornerPreset | Position }
        await cursorOps.moveTo({ position: args.position, islandSize })
        return { moved: true, position: args.position }
      }

      if (toolCall.toolName === 'minimize') {
        await cursorOps.collapse()
        return { minimized: true }
      }

      if (toolCall.toolName === 'expand') {
        await cursorOps.expand()
        return { expanded: true }
      }

      if (toolCall.toolName === 'get_bounds') {
        const currentBounds = Atom.get(boundsAtom)
        return { width: currentBounds.width, height: currentBounds.height }
      }

      return undefined
    },
    onFinish: () => {
      Atom.set(statusAtom, 'idle')
    },
    onError: (error) => {
      console.error('[Cursor] Chat error:', error)
      Atom.set(statusAtom, 'idle')
    },
  })

  // Sync AI SDK messages → effect-atom
  useEffect(() => {
    Atom.set(messagesAtom, messages)
  }, [messages])

  // Sync AI SDK status → effect-atom
  useEffect(() => {
    if (status === 'streaming') {
      Atom.set(statusAtom, 'streaming')
    } else if (status === 'submitted') {
      Atom.set(statusAtom, 'thinking')
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

  // Handle send message
  const handleSend = useCallback(
    async (content: string) => {
      if (!content.trim()) return
      Atom.set(statusAtom, 'thinking')
      await append({ role: 'user', content })
    },
    [append]
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
      x={position.x}
      y={position.y}
      draggable
      onDragEnd={handleDragEnd}
      dragConstraints={dragConstraints}
      sizeKey={sizeKey}
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
          <ChatContent
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
      <DynamicIslandProvider config={ISLAND_CONFIG}>
        <CursorInner />
      </DynamicIslandProvider>
    </div>
  )
}

export default Cursor
