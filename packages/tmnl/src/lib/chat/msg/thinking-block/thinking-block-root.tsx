/**
 * ChatThinkingBlock.Root — Compound root with collapsible state.
 *
 * Manages open/close, auto-close after streaming completes,
 * duration tracking, and context provision for sub-components.
 *
 * Pattern: components.build compound root with context.
 * Mirrors AI Elements' Reasoning component but TMNL-styled.
 *
 * @module chat/msg/thinking-block
 */

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import { ChatThinkingBlockContext, type ChatThinkingBlockContextValue } from './thinking-block-context'

// =============================================================================
// Constants
// =============================================================================

/** Delay before auto-closing after streaming ends (ms) */
const AUTO_CLOSE_DELAY = 1200

const MS_IN_S = 1000

// =============================================================================
// Props
// =============================================================================

export interface ChatThinkingBlockRootProps extends ComponentPropsWithoutRef<'div'> {
  /** Whether thinking is currently streaming */
  isStreaming?: boolean
  /** Controlled open state */
  open?: boolean
  /** Default open state (uncontrolled) */
  defaultOpen?: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
  /** Pre-computed duration in ms (from adapter) */
  durationMs?: number
  children?: ReactNode
}

// =============================================================================
// Component
// =============================================================================

export const ChatThinkingBlockRoot = memo(forwardRef<HTMLDivElement, ChatThinkingBlockRootProps>(
  (
    {
      isStreaming = false,
      open: controlledOpen,
      defaultOpen = true,
      onOpenChange,
      durationMs: durationMsProp,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    // ── State ────────────────────────────────────────────
    const [internalOpen, setInternalOpen] = useState(defaultOpen)
    const isOpen = controlledOpen ?? internalOpen
    const setIsOpen = useCallback((next: boolean) => {
      setInternalOpen(next)
      onOpenChange?.(next)
    }, [onOpenChange])

    // ── Duration tracking ────────────────────────────────
    const [durationSec, setDurationSec] = useState<number | undefined>(
      durationMsProp != null ? Math.ceil(durationMsProp / MS_IN_S) : undefined,
    )
    const startTimeRef = useRef<number | null>(null)
    const hasAutoClosedRef = useRef(false)

    // Track streaming start/end for duration
    useEffect(() => {
      if (isStreaming) {
        if (startTimeRef.current === null) {
          startTimeRef.current = Date.now()
        }
      } else if (startTimeRef.current !== null) {
        // Streaming just ended — compute duration
        const elapsed = Math.ceil((Date.now() - startTimeRef.current) / MS_IN_S)
        setDurationSec(elapsed)
        startTimeRef.current = null
      }
    }, [isStreaming])

    // Sync external durationMs prop
    useEffect(() => {
      if (durationMsProp != null) {
        setDurationSec(Math.ceil(durationMsProp / MS_IN_S))
      }
    }, [durationMsProp])

    // ── Auto-close after streaming ends ──────────────────
    useEffect(() => {
      if (defaultOpen && !isStreaming && isOpen && !hasAutoClosedRef.current) {
        const timer = setTimeout(() => {
          setIsOpen(false)
          hasAutoClosedRef.current = true
        }, AUTO_CLOSE_DELAY)
        return () => clearTimeout(timer)
      }
    }, [isStreaming, isOpen, defaultOpen, setIsOpen])

    // ── Context ──────────────────────────────────────────
    const ctx: ChatThinkingBlockContextValue = {
      isStreaming,
      isOpen,
      setIsOpen,
      durationSec,
    }

    return (
      <ChatThinkingBlockContext.Provider value={ctx}>
        <div
          ref={ref}
          data-slot="tmnl-chat-thinking-block"
          data-state={isOpen ? 'open' : 'closed'}
          data-streaming={isStreaming || undefined}
          className={cn(
            'rounded border my-1.5 transition-colors duration-200',
            'border-violet-500/20 bg-violet-500/[0.03]',
            'hover:border-violet-500/30 hover:bg-violet-500/[0.06]',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </ChatThinkingBlockContext.Provider>
    )
  },
))

ChatThinkingBlockRoot.displayName = 'ChatThinkingBlock.Root'
