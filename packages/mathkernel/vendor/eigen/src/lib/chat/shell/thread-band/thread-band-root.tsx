/**
 * ChatThreadBand — scroll container for the chat message thread.
 *
 * Three modes:
 *   - 'off'    — no auto-scroll, user controls everything
 *   - 'follow' — tail-follow with interrupt (scroll up pauses, jump-to-latest resumes)
 *   - 'lock'   — always pinned to bottom, no interrupt
 *
 * @module chat/shell/thread-band
 */

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type MutableRefObject,
  type Ref,
} from 'react'
import { cn } from '@/lib/utils'
import { useTailFollow, type TailMode } from '@/lib/scroll'
import { CHAT_SHELL_SCROLL_CONTRACT, resolveChatShellThreadScrollStyle } from '../scroll-contract'

// =============================================================================
// Types
// =============================================================================

export type ChatThreadAutoScrollMode = 'off' | 'follow' | 'lock'

export interface ChatThreadBandProps extends ComponentPropsWithoutRef<'div'> {
  /** Scroll behavior mode. Default: 'off' */
  autoScroll?: ChatThreadAutoScrollMode
  /** Proximity threshold (px) for tail detection. Default: 24 */
  bottomThreshold?: number
  /** Number of items in the thread (drives tail-follow). Default: 0 */
  itemCount?: number
  /**
   * Content rendered inside the tail-follow context scope but OUTSIDE
   * the scroll container. Use for tail controls (LIVE/PAUSED badge).
   * @deprecated Use renderFooterOverlay for non-layout-displacing overlays.
   */
  renderAfterScroll?: React.ReactNode
  /**
   * Footer overlay — absolute-positioned at bottom of the thread container.
   * Mirrors the header overlay pattern (StatusBannerView at top-0).
   * Rendered inside TailCtx scope, pointer-events-none container with auto children.
   *
   * Use for: scroll pills, streaming indicators, etc.
   */
  renderFooterOverlay?: React.ReactNode
}

// =============================================================================
// Context — expose tail-follow state to sibling components (e.g. tail controls)
// =============================================================================

export interface ChatThreadTailContext {
  readonly tailMode: TailMode
  readonly unreadCount: number
  readonly jumpToLatest: () => void
  readonly interruptTail: () => void
}

const ThreadTailCtx = createContext<ChatThreadTailContext | null>(null)

/** Read tail-follow state from the nearest ChatThreadBand. */
export const useChatThreadTail = (): ChatThreadTailContext | null =>
  useContext(ThreadTailCtx)

// =============================================================================
// Ref utility
// =============================================================================

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return
  if (typeof ref === 'function') {
    ref(value)
    return
  }
  ;(ref as MutableRefObject<T | null>).current = value
}

// =============================================================================
// Component
// =============================================================================

export const ChatThreadBand = forwardRef<HTMLDivElement, ChatThreadBandProps>(
  (
    {
      className,
      style,
      children,
      autoScroll = 'off',
      bottomThreshold = 24,
      itemCount = 0,
      renderAfterScroll,
      renderFooterOverlay,
      onScroll,
      ...props
    },
    ref,
  ) => {
    // ── Tail-follow ──────────────────────────────────────────
    const tf = useTailFollow(itemCount, {
      proximityPx: bottomThreshold,
      reengagementMs: 500,
      initialTailMode: autoScroll === 'off' ? 'inspect' : 'tail',
    })

    // Sync autoScroll prop changes
    useEffect(() => {
      if (autoScroll === 'off' && tf.tailMode === 'tail') {
        tf.setTailMode('inspect')
      } else if (autoScroll !== 'off' && tf.tailMode === 'inspect') {
        tf.setTailMode('tail')
      }
    }, [autoScroll]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Lock mode ────────────────────────────────────────────
    const isProgrammaticScrollRef = useRef(false)
    const localRef = useRef<HTMLDivElement | null>(null)

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        localRef.current = node
        assignRef(ref, node)
        ;(tf.scrollRef as MutableRefObject<HTMLDivElement | null>).current = node
      },
      [ref, tf.scrollRef],
    )

    // Lock mode: always scroll to bottom on content change
    useLayoutEffect(() => {
      if (autoScroll !== 'lock') return
      const node = localRef.current
      if (!node) return
      isProgrammaticScrollRef.current = true
      node.scrollTop = node.scrollHeight
      requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false
      })
    }, [autoScroll, children])

    // Lock mode: force back to bottom on any scroll
    useEffect(() => {
      if (autoScroll !== 'lock') return
      const node = localRef.current
      if (!node) return

      if (typeof ResizeObserver === 'undefined') return
      const observer = new ResizeObserver(() => {
        isProgrammaticScrollRef.current = true
        node.scrollTop = node.scrollHeight
        requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = false
        })
      })
      observer.observe(node)
      return () => observer.disconnect()
    }, [autoScroll])

    // ── Compose scroll handlers ──────────────────────────────
    // In follow mode, spread tailInterruptProps; in lock/off, use basic handler
    const composedOnScroll = useCallback(
      (e: React.UIEvent<HTMLDivElement>) => {
        if (autoScroll === 'follow') {
          tf.tailInterruptProps.onScroll(e)
        }
        onScroll?.(e)
      },
      [autoScroll, tf.tailInterruptProps, onScroll],
    )

    // Context value for siblings
    const tailCtx: ChatThreadTailContext = {
      tailMode: autoScroll === 'off' ? 'inspect' : tf.tailMode,
      unreadCount: tf.unreadCount,
      jumpToLatest: tf.jumpToLatest,
      interruptTail: tf.interruptTail,
    }

    // Build event handlers based on mode
    const interruptHandlers = autoScroll === 'follow'
      ? {
          onWheel: tf.tailInterruptProps.onWheel,
          onMouseDown: tf.tailInterruptProps.onMouseDown,
          onTouchStart: tf.tailInterruptProps.onTouchStart,
          onKeyDown: tf.tailInterruptProps.onKeyDown,
        }
      : {}

    return (
      <ThreadTailCtx.Provider value={tailCtx}>
        <div
          ref={setRefs}
          data-slot="tmnl-chat-shell-thread-band"
          data-scroll-contract={CHAT_SHELL_SCROLL_CONTRACT.id}
          data-tail-mode={tailCtx.tailMode}
          className={cn('flex-1 min-h-0 px-4 py-2', className)}
          style={resolveChatShellThreadScrollStyle(style)}
          onScroll={composedOnScroll}
          {...interruptHandlers}
          {...props}
        >
          {/* Head sentinel */}
          <div ref={tf.head.ref} className="h-px" aria-hidden="true" />

          {children}

          {/* Tail sentinel */}
          <div ref={tf.tail.ref} className="h-px" aria-hidden="true" />

          {/* Footer overlay — sticky bottom inside scroll container.
              Stays pinned at the viewport bottom as content scrolls.
              pointer-events-none container, auto on pill. */}
          {renderFooterOverlay && (
            <div className="sticky bottom-3 z-10 flex justify-center pointer-events-none">
              <div className="pointer-events-auto">
                {renderFooterOverlay}
              </div>
            </div>
          )}
        </div>
        {/* @deprecated — tail controls in normal flow, outside scroll */}
        {renderAfterScroll && !renderFooterOverlay && renderAfterScroll}
      </ThreadTailCtx.Provider>
    )
  },
)

ChatThreadBand.displayName = 'ChatShell.ThreadBand'
