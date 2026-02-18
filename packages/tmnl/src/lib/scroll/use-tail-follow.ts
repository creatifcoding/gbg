/**
 * useTailFollow — generic tail-follow controller for scrollable lists.
 *
 * Extracted from agent-task log controller. Domain-agnostic: works with
 * any item count and scroll container. No atom dependencies — uses local
 * React state so consumers can bridge to whatever state system they want.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  ARCHITECTURE                                               │
 * │                                                             │
 * │  Two fixed sentinels (1px divs) at head and tail.           │
 * │  IntersectionObserver on tail sentinel, rooted to the       │
 * │  scroll container, tracks visibility.                       │
 * │                                                             │
 * │  ┌─ <div ref={head.ref} /> ────── 1px ──────────────────┐  │
 * │  │  item 0                                               │  │
 * │  │  item 1                                               │  │
 * │  │  ...                                                  │  │
 * │  │  item N                                               │  │
 * │  └─ <div ref={tail.ref} /> ────── 1px ──────────────────┘  │
 * │                                                             │
 * │  Tail Mode:                                                 │
 * │    tail sentinel visible  → tailMode = 'tail'  (LIVE)       │
 * │    tail sentinel hidden   → tailMode = 'inspect' (PAUSED)   │
 * │                                                             │
 * │  Re-engagement guard: observer only flips to tail if there  │
 * │  was recent downward scroll activity (< reengagementMs).    │
 * │  Prevents false positives from content shrink, filter, or   │
 * │  window resize.                                             │
 * │                                                             │
 * │  Tail Interrupts:                                           │
 * │    onScroll    — scrollTop moves away from tail             │
 * │    onWheel     — deltaY < 0 = wheel up                     │
 * │    onMouseDown — user clicked to inspect                    │
 * │    onTouchStart— mobile grab to scroll                      │
 * │    onKeyDown   — ArrowUp / PageUp / Home                   │
 * │                                                             │
 * │  Non-interrupts: wheel-down, ↓/PageDown/End                │
 * └─────────────────────────────────────────────────────────────┘
 *
 * @module scroll/use-tail-follow
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useScrollAnchor, type ScrollAnchorHandle } from './scroll-anchors'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TailMode = 'tail' | 'inspect'

export interface TailFollowConfig {
  /** How close to the bottom (px) counts as "at tail". Default: 24 */
  readonly proximityPx?: number
  /** How recently (ms) the user must have scrolled down for re-engagement. Default: 500 */
  readonly reengagementMs?: number
  /** Start in tail mode? Default: true */
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
  /** Fixed anchor at head of list */
  readonly head: ScrollAnchorHandle
  /** Fixed anchor at tail of list */
  readonly tail: ScrollAnchorHandle
  /** Spread on the scroll container — handles all interrupt events */
  readonly tailInterruptProps: TailInterruptProps
  /** Imperatively break tail mode */
  readonly interruptTail: () => void
  /** Jump to latest + resume tail mode + clear unread */
  readonly jumpToLatest: () => void
  /** Set tail mode explicitly */
  readonly setTailMode: (mode: TailMode) => void
  /** Reset unread counter */
  readonly clearUnread: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREFERS_REDUCED_MOTION =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

const INTERRUPT_KEYS: ReadonlySet<string> = new Set(['ArrowUp', 'PageUp', 'Home'])

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Generic tail-follow controller.
 *
 * ```tsx
 * const tf = useTailFollow(messages.length, { proximityPx: 20 })
 *
 * <div ref={tf.scrollRef} {...tf.tailInterruptProps} className="overflow-y-auto">
 *   <div ref={tf.head.ref} className="h-px" />
 *   {messages.map(msg => <Message key={msg.id} ... />)}
 *   <div ref={tf.tail.ref} className="h-px" />
 * </div>
 *
 * {tf.tailMode === 'inspect' && tf.unreadCount > 0 && (
 *   <button onClick={tf.jumpToLatest}>↓ {tf.unreadCount} new</button>
 * )}
 * ```
 */
export const useTailFollow = (
  itemCount: number,
  config: TailFollowConfig = {},
): TailFollowHandle => {
  const {
    proximityPx = 24,
    reengagementMs = 500,
    initialTailMode = 'tail',
  } = config

  const scrollRef = useRef<HTMLDivElement>(null)
  const [tailMode, setTailMode] = useState<TailMode>(initialTailMode)
  const [unreadCount, setUnreadCount] = useState(0)

  const lastItemCountRef = useRef(itemCount)
  const lastScrollTopRef = useRef(0)
  const lastDownwardScrollAtRef = useRef(Date.now())

  // ── Scroll anchors ──────────────────────────────────────

  const head = useScrollAnchor({
    scrollRef,
    rootMargin: '0px',
  })

  const tail = useScrollAnchor({
    scrollRef,
    rootMargin: `0px 0px ${proximityPx}px 0px`,
    onVisibilityChange: useCallback(
      (visible: boolean) => {
        if (visible) {
          const recentActivity =
            Date.now() - lastDownwardScrollAtRef.current < reengagementMs
          if (recentActivity) {
            setTailMode('tail')
            setUnreadCount(0)
          }
        } else {
          setTailMode('inspect')
        }
      },
      [reengagementMs],
    ),
  })

  // ── Scroll to tail (standard direction — scrollTop → max) ──

  const scrollToTail = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      const container = scrollRef.current
      if (!container) return
      lastDownwardScrollAtRef.current = Date.now()
      container.scrollTo({
        top: container.scrollHeight,
        behavior: PREFERS_REDUCED_MOTION ? 'auto' : behavior,
      })
    },
    [],
  )

  // ── Auto-follow on item count change ──────────────────────

  useEffect(() => {
    const appended = Math.max(itemCount - lastItemCountRef.current, 0)
    lastItemCountRef.current = itemCount

    if (appended === 0) return

    if (tailMode === 'tail') {
      // Schedule to next frame so DOM has updated
      requestAnimationFrame(() => scrollToTail())
      setUnreadCount(0)
    } else {
      setUnreadCount((prev) => prev + appended)
    }
  }, [itemCount, tailMode, scrollToTail])

  // ── Tail interrupt handler ────────────────────────────────

  const interruptTail = useCallback(() => {
    if (tailMode !== 'tail') return
    setTailMode('inspect')
  }, [tailMode])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const scrollTop = el.scrollTop
    const prevScrollTop = lastScrollTopRef.current
    lastScrollTopRef.current = scrollTop

    // Distance from bottom
    const distFromTail = el.scrollHeight - (scrollTop + el.clientHeight)
    const prevDistFromTail = el.scrollHeight - (prevScrollTop + el.clientHeight)

    if (distFromTail > prevDistFromTail) {
      // User moved away from tail
      interruptTail()
      return
    }

    if (distFromTail < prevDistFromTail) {
      // User moved toward tail
      lastDownwardScrollAtRef.current = Date.now()
    }

    // Re-engage if close enough to tail
    if (tailMode === 'inspect' && distFromTail <= proximityPx) {
      setTailMode('tail')
      setUnreadCount(0)
    }
  }, [interruptTail, tailMode, proximityPx])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.deltaY < 0) {
        interruptTail()
      } else if (e.deltaY > 0) {
        lastDownwardScrollAtRef.current = Date.now()
      }
    },
    [interruptTail],
  )

  const handleMouseDown = useCallback(() => interruptTail(), [interruptTail])
  const handleTouchStart = useCallback(() => interruptTail(), [interruptTail])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (INTERRUPT_KEYS.has(e.key)) interruptTail()
    },
    [interruptTail],
  )

  const tailInterruptProps = useMemo<TailInterruptProps>(
    () => ({
      onScroll: handleScroll,
      onWheel: handleWheel,
      onMouseDown: handleMouseDown,
      onTouchStart: handleTouchStart,
      onKeyDown: handleKeyDown,
    }),
    [handleScroll, handleWheel, handleMouseDown, handleTouchStart, handleKeyDown],
  )

  const jumpToLatest = useCallback(() => {
    setTailMode('tail')
    setUnreadCount(0)
    scrollToTail('smooth')
  }, [scrollToTail])

  const clearUnread = useCallback(() => setUnreadCount(0), [])

  return {
    tailMode,
    unreadCount,
    scrollRef,
    head,
    tail,
    tailInterruptProps,
    interruptTail,
    jumpToLatest,
    setTailMode,
    clearUnread,
  }
}
