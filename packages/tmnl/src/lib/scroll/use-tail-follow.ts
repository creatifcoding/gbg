/**
 * useTailFollow — auto-scroll-to-bottom for streaming chat messages.
 *
 * Inspired by Vercel's ai-chatbot `useScrollToBottom`:
 *   - MutationObserver + ResizeObserver for reliable DOM-change detection
 *   - Works for streaming deltas (characterData), new messages (childList),
 *     and growing elements (ResizeObserver)
 *   - Simple isAtBottom check — no IntersectionObserver complexity
 *   - User scroll detection prevents disruptive auto-scroll
 *
 * Previous implementation relied on `useEffect([itemCount])` which missed
 * streaming character-by-character updates within the same message element.
 *
 * @module scroll/use-tail-follow
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TailMode = 'tail' | 'inspect'

export interface TailFollowConfig {
  /** How close to the bottom (px) counts as "at tail". Default: 100 */
  readonly proximityPx?: number
  /** Start in tail mode? Default: 'tail' */
  readonly initialTailMode?: TailMode
}

/** Event props to spread on the scroll container for tail-interrupt detection. */
export interface TailInterruptProps {
  readonly onScroll: React.UIEventHandler<HTMLDivElement>
  readonly onWheel: React.WheelEventHandler<HTMLDivElement>
  readonly onMouseDown: React.MouseEventHandler<HTMLDivElement>
  readonly onTouchStart: React.TouchEventHandler<HTMLDivElement>
  readonly onKeyDown: React.KeyboardEventHandler<HTMLDivElement>
}

export interface TailFollowHandle {
  /** Current mode: 'tail' (auto-follow) or 'inspect' (paused) */
  readonly tailMode: TailMode
  /** Number of items appended since user left tail */
  readonly unreadCount: number
  /** Attach to scroll container */
  readonly scrollRef: React.RefObject<HTMLDivElement | null>
  /** Sentinel ref — place a <div ref={endRef} /> at the bottom of content */
  readonly endRef: React.RefObject<HTMLDivElement | null>
  /** Spread on the scroll container — handles all interrupt events */
  readonly tailInterruptProps: TailInterruptProps
  /** Imperatively break tail mode */
  readonly interruptTail: () => void
  /** Jump to latest + resume tail mode + clear unread */
  readonly jumpToLatest: () => void
  /** Scroll to bottom explicitly */
  readonly scrollToBottom: (behavior?: ScrollBehavior) => void
  /** Set tail mode explicitly */
  readonly setTailMode: (mode: TailMode) => void
  /** Reset unread counter */
  readonly clearUnread: () => void
  /** Whether the scroll container is currently at the bottom */
  readonly isAtBottom: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INTERRUPT_KEYS: ReadonlySet<string> = new Set(['ArrowUp', 'PageUp', 'Home'])

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Auto-scroll-to-bottom with streaming support.
 *
 * ```tsx
 * const tf = useTailFollow({ proximityPx: 100 })
 *
 * <div className="relative flex-1">
 *   <div ref={tf.scrollRef} {...tf.tailInterruptProps} className="overflow-y-auto absolute inset-0">
 *     {messages.map(msg => <Message key={msg.id} ... />)}
 *     <div ref={tf.endRef} className="h-px shrink-0" />
 *   </div>
 *   {!tf.isAtBottom && (
 *     <button onClick={tf.jumpToLatest}>↓ Jump to latest</button>
 *   )}
 * </div>
 * ```
 */
export const useTailFollow = (
  _itemCount?: number, // kept for backward compat but no longer drives scroll
  config: TailFollowConfig = {},
): TailFollowHandle => {
  const {
    proximityPx = 100,
    initialTailMode = 'tail',
  } = config

  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const isAtBottomRef = useRef(true)
  const isUserScrollingRef = useRef(false)
  const [tailMode, setTailMode] = useState<TailMode>(initialTailMode)
  const [unreadCount, setUnreadCount] = useState(0)

  // Keep ref in sync with state
  useEffect(() => {
    isAtBottomRef.current = isAtBottom
  }, [isAtBottom])

  // ── Core scroll helpers ─────────────────────────────────

  const checkIfAtBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollTop + el.clientHeight >= el.scrollHeight - proximityPx
  }, [proximityPx])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  // ── Scroll event handling ───────────────────────────────

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    let scrollTimeout: ReturnType<typeof setTimeout>

    const handleScroll = () => {
      isUserScrollingRef.current = true
      clearTimeout(scrollTimeout)

      const atBottom = checkIfAtBottom()
      setIsAtBottom(atBottom)
      isAtBottomRef.current = atBottom

      if (atBottom) {
        setTailMode('tail')
        setUnreadCount(0)
      } else {
        setTailMode('inspect')
      }

      // Reset user scrolling flag after scroll ends
      scrollTimeout = setTimeout(() => {
        isUserScrollingRef.current = false
      }, 150)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [checkIfAtBottom])

  // ── Auto-scroll on DOM mutations (the key to streaming) ──

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const scrollIfNeeded = () => {
      // Only auto-scroll if user was at bottom and isn't actively scrolling
      if (isAtBottomRef.current && !isUserScrollingRef.current) {
        requestAnimationFrame(() => {
          const el = scrollRef.current
          if (!el) return
          el.scrollTo({ top: el.scrollHeight, behavior: 'instant' })
          setIsAtBottom(true)
          isAtBottomRef.current = true
        })
      }
    }

    // Watch for DOM changes — catches streaming deltas (characterData),
    // new messages (childList), and any subtree mutations
    const mutationObserver = new MutationObserver(scrollIfNeeded)
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    // Watch for size changes — catches element growth from content
    const resizeObserver = new ResizeObserver(scrollIfNeeded)
    resizeObserver.observe(container)

    // Also observe direct children for size changes
    for (const child of container.children) {
      resizeObserver.observe(child)
    }

    // Initial scroll-to-bottom: the MutationObserver misses children
    // already in the DOM at mount time (effects run AFTER first commit).
    // If we're starting in tail mode and there's content to scroll, snap now.
    if (isAtBottomRef.current && container.scrollHeight > container.clientHeight) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'instant' })
    }

    return () => {
      mutationObserver.disconnect()
      resizeObserver.disconnect()
    }
  }, [])

  // ── Interrupt helpers ───────────────────────────────────

  const interruptTail = useCallback(() => {
    setTailMode('inspect')
    setIsAtBottom(false)
    isAtBottomRef.current = false
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.deltaY < 0) interruptTail()
    },
    [interruptTail],
  )

  const handleMouseDown = useCallback(() => {
    // Don't interrupt — user clicking on a message shouldn't break tail mode
  }, [])

  const handleTouchStart = useCallback(() => {
    // Touch start alone shouldn't interrupt — scroll handler will detect direction
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (INTERRUPT_KEYS.has(e.key)) interruptTail()
    },
    [interruptTail],
  )

  // Compose onScroll — the scroll event handler does double duty
  const handleScroll = useCallback(
    (_e: React.UIEvent<HTMLDivElement>) => {
      // Already handled by the passive listener above
    },
    [],
  )

  const tailInterruptProps: TailInterruptProps = {
    onScroll: handleScroll,
    onWheel: handleWheel,
    onMouseDown: handleMouseDown,
    onTouchStart: handleTouchStart,
    onKeyDown: handleKeyDown,
  }

  const jumpToLatest = useCallback(() => {
    setTailMode('tail')
    setUnreadCount(0)
    setIsAtBottom(true)
    isAtBottomRef.current = true
    scrollToBottom('smooth')
  }, [scrollToBottom])

  const clearUnread = useCallback(() => setUnreadCount(0), [])

  // ── Backward compat shims ──────────────────────────────

  // head/tail refs — endRef replaces tail.ref. head is rarely used.
  const head = { ref: useRef<HTMLDivElement>(null), visible: false }
  const tail = { ref: endRef, visible: isAtBottom }

  return {
    tailMode,
    unreadCount,
    scrollRef,
    endRef,
    tailInterruptProps,
    interruptTail,
    jumpToLatest,
    scrollToBottom,
    setTailMode,
    clearUnread,
    isAtBottom,
    // Backward compat
    head: head as any,
    tail: tail as any,
  }
}
