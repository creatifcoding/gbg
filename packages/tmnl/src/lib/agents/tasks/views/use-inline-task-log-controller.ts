/**
 * useInlineTaskLogController — tail-follow controller for the inline log view.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  ARCHITECTURE                                               │
 * │                                                             │
 * │  Scroll Anchor System (head / tail / pointer)               │
 * │  ─────────────────────────────────────────────────────────  │
 * │  Two fixed sentinels (1px divs) at head and tail of the     │
 * │  entries list. IntersectionObserver on each, rooted to the  │
 * │  scroll container, tracks visibility.                       │
 * │                                                             │
 * │  A movable pointer can target any entry by key, resolving   │
 * │  via data-entry-key attribute for container-scoped scroll.  │
 * │                                                             │
 * │  ┌─ <HeadAnchor ref={head.ref} /> ────── 1px ──────────┐  │
 * │  │  entry 0                                              │  │
 * │  │  entry 1  ← pointer.targetKey                         │  │
 * │  │  ...                                                  │  │
 * │  │  entry N                                              │  │
 * │  │  <Cursor />                                           │  │
 * │  └─ <TailAnchor ref={tail.ref} /> ────── 1px ──────────┘  │
 * │                                                             │
 * │  Tail Mode (source of truth: tail anchor observer)          │
 * │  ─────────────────────────────────────────────────────────  │
 * │    tail sentinel visible  → tailMode = 'tail'  (LIVE ●)    │
 * │    tail sentinel hidden   → tailMode = 'inspect'            │
 * │                                                             │
 * │  rootMargin extends tail detection 24px so re-engagement    │
 * │  feels responsive ("close enough" = tail).                  │
 * │                                                             │
 * │  Re-engagement guard: observer only flips to tail if there  │
 * │  was recent downward scroll/wheel activity (< 500ms).       │
 * │  Prevents false positives from content shrink (filter),     │
 * │  retention eviction, or window resize.                      │
 * │                                                             │
 * │  Scroll-to-tail                                             │
 * │  ─────────────────────────────────────────────────────────  │
 * │  container.scrollTo({ top: scrollHeight }) — scoped, no     │
 * │  ancestor leak. Reduced-motion aware.                       │
 * │                                                             │
 * │  Tail Interrupt (sync, ahead of async observer)             │
 * │  ─────────────────────────────────────────────────────────  │
 * │  tailInterruptProps: spread on scroll container.            │
 * │                                                             │
 * │  INTERRUPTS:                                                │
 * │    onScroll    — scrollTop ↓ = user scrolling up            │
 * │    onWheel     — deltaY < 0 = wheel up                     │
 * │    onMouseDown — user clicked into the view to inspect      │
 * │    onTouchStart— mobile: user grabbing to scroll            │
 * │    onKeyDown   — ArrowUp / PageUp / Home                   │
 * │                                                             │
 * │  NON-interrupts: wheel-down, ↓/PageDown/End                │
 * │                                                             │
 * │  interruptTail() — imperative escape hatch for custom use.  │
 * │                                                             │
 * │  Wiring                                                     │
 * │  ─────────────────────────────────────────────────────────  │
 * │  Scroll container:  <div ref={scrollRef}                    │
 * │                           {...tailInterruptProps}>           │
 * │  Head sentinel:      <HeadAnchor ref={head.ref} />          │
 * │  Tail sentinel:      <TailAnchor ref={tail.ref} />          │
 * │  Entry rows:         <div data-entry-key={entry.key} />     │
 * └─────────────────────────────────────────────────────────────┘
 *
 * @module agent-task/views/use-inline-task-log-controller
 */

import { useAtom, useAtomSet, useAtomValue } from '@effect-atom/atom-react'
import * as AtomResult from '@effect-atom/atom/Result'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Atom } from '@effect-atom/atom'
import {
  filteredLogBufferFamily,
  logStreamTrigger,
  tailModeFamily,
  unreadCountFamily,
  type AgentTaskLogAtomSurfaceAtoms,
} from '../atoms'
import type { AssembledLogEntry } from '../services/CodecService'
import {
  useScrollAnchor,
  useScrollPointer,
  type ScrollAnchorHandle,
  type ScrollPointerHandle,
} from './scroll-anchors'

export interface UseInlineTaskLogControllerOptions {
  readonly taskId: string
  readonly atomSurfaceAtom: Atom.Atom<AgentTaskLogAtomSurfaceAtoms>
}

/** Event props to spread on the scroll container for tail-interrupt detection. */
export interface TailInterruptProps {
  readonly onScroll: React.UIEventHandler<HTMLDivElement>
  readonly onWheel: React.WheelEventHandler<HTMLDivElement>
  readonly onMouseDown: React.MouseEventHandler<HTMLDivElement>
  readonly onTouchStart: React.TouchEventHandler<HTMLDivElement>
  readonly onKeyDown: React.KeyboardEventHandler<HTMLDivElement>
}

export interface InlineTaskLogController {
  readonly atoms?: AgentTaskLogAtomSurfaceAtoms
  readonly entries: ReadonlyArray<AssembledLogEntry>
  readonly tailMode: 'tail' | 'inspect'
  readonly unreadCount: number
  /** Attach to scroll container */
  readonly scrollRef: React.RefObject<HTMLDivElement | null>
  /** Fixed anchor at the head of entries */
  readonly head: ScrollAnchorHandle
  /** Fixed anchor at the tail of entries */
  readonly tail: ScrollAnchorHandle
  /** Movable pointer — targets any entry by key */
  readonly pointer: ScrollPointerHandle
  /** Spread on the scroll container — handles all tail-interrupt events */
  readonly tailInterruptProps: TailInterruptProps
  /** Imperatively break tail mode (for custom interrupt triggers) */
  readonly interruptTail: () => void
  readonly jumpToLatest: () => void
}

// ---------------------------------------------------------------------------
// Module-level constants
// ---------------------------------------------------------------------------

const PREFERS_REDUCED_MOTION =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

/** Keys that signal user navigating away from tail. */
const INTERRUPT_KEYS: ReadonlySet<string> = new Set(['ArrowUp', 'PageUp', 'Home'])

/**
 * How close to the bottom (px) the tail detection zone extends.
 * "Close enough" to the bottom = tail.
 */
const TAIL_PROXIMITY_PX = 24

/**
 * How recently (ms) the user must have scrolled downward for the observer
 * to re-engage tail mode. Prevents false re-engagement from content shrink
 * (filter changes, retention eviction, resize).
 */
const REENGAGEMENT_RECENCY_MS = 500

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export const useInlineTaskLogController = ({
  taskId,
  atomSurfaceAtom,
}: UseInlineTaskLogControllerOptions): InlineTaskLogController => {
  const atomSurfaceResult = useAtomValue(atomSurfaceAtom)
  const atomSurfaceReady = AtomResult.isSuccess(atomSurfaceResult)
  const atomSurfaceFailed = AtomResult.isFailure(atomSurfaceResult)
  const atoms = atomSurfaceReady ? atomSurfaceResult.value : undefined

  const entries = useAtomValue(
    (atoms?.filteredLogBufferFamily ?? filteredLogBufferFamily)(taskId),
  )
  const [tailMode, setTailMode] = useAtom((atoms?.tailModeFamily ?? tailModeFamily)(taskId))
  const [unreadCount, setUnreadCount] = useAtom(
    (atoms?.unreadCountFamily ?? unreadCountFamily)(taskId),
  )
  const setStreamTrigger = useAtomSet(atoms?.logStreamTrigger ?? logStreamTrigger)

  const scrollRef = useRef<HTMLDivElement>(null)
  const lastEntryCountRef = useRef(0)
  const lastTriggeredKeyRef = useRef<string | null>(null)
  const lastScrollTopRef = useRef(0)
  const lastDownwardScrollAtRef = useRef(0)

  // -------------------------------------------------------------------------
  // Scroll anchors — head, tail, pointer
  // -------------------------------------------------------------------------

  const head = useScrollAnchor({
    scrollRef,
    rootMargin: '0px',
  })

  const tail = useScrollAnchor({
    scrollRef,
    rootMargin: `0px 0px ${TAIL_PROXIMITY_PX}px 0px`,
    onVisibilityChange: useCallback(
      (visible: boolean) => {
        if (visible) {
          const recentActivity =
            Date.now() - lastDownwardScrollAtRef.current < REENGAGEMENT_RECENCY_MS
          if (recentActivity) {
            setTailMode('tail')
            setUnreadCount(0)
          }
        } else {
          setTailMode('inspect')
        }
      },
      [setTailMode, setUnreadCount],
    ),
  })

  const pointer = useScrollPointer({ scrollRef })

  // -------------------------------------------------------------------------
  // Scroll-to-tail — scoped to our scroll container only (no ancestor leak).
  // -------------------------------------------------------------------------

  // With column-reverse, scrollTop 0 = bottom (tail). Scroll to 0 = go to tail.
  const scrollToTail = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      const container = scrollRef.current
      if (!container) return
      lastDownwardScrollAtRef.current = Date.now()
      container.scrollTo({
        top: 0,
        behavior: PREFERS_REDUCED_MOTION ? 'auto' : behavior,
      })
    },
    [],
  )

  // -------------------------------------------------------------------------
  // Stream trigger — fires on task switch or surface readiness change
  // -------------------------------------------------------------------------

  useEffect(() => {
    const triggerMode = atomSurfaceReady ? 'surface' : atomSurfaceFailed ? 'fallback' : 'pending'
    if (triggerMode === 'pending') return

    const triggerKey = `${taskId}:${triggerMode}`
    if (lastTriggeredKeyRef.current === triggerKey) return

    lastTriggeredKeyRef.current = triggerKey
    lastEntryCountRef.current = 0
    lastDownwardScrollAtRef.current = Date.now()
    setTailMode('tail')
    setUnreadCount(0)
    setStreamTrigger(taskId)
  }, [
    taskId,
    atomSurfaceReady,
    atomSurfaceFailed,
    setStreamTrigger,
    setTailMode,
    setUnreadCount,
  ])

  // -------------------------------------------------------------------------
  // Auto-follow — scroll to tail when new entries arrive in tail mode
  // -------------------------------------------------------------------------

  useEffect(() => {
    const appended = Math.max(entries.length - lastEntryCountRef.current, 0)
    if (appended === 0) {
      lastEntryCountRef.current = entries.length
      return
    }

    if (tailMode === 'tail') {
      scrollToTail()
      setUnreadCount(0)
    } else {
      setUnreadCount((prev) => prev + appended)
    }

    lastEntryCountRef.current = entries.length
  }, [
    entries,
    tailMode,
    scrollToTail,
    setUnreadCount,
  ])

  // -------------------------------------------------------------------------
  // Tail interrupt + re-engagement handlers
  // -------------------------------------------------------------------------

  const interruptTail = useCallback(() => {
    if (tailMode !== 'tail') return
    setTailMode('inspect')
  }, [tailMode, setTailMode])

  // column-reverse inverts scrollTop: 0 = bottom, negative = scrolled up.
  // delta > 0 (toward 0 / less negative) = scrolling DOWN toward tail.
  // delta < 0 (more negative) = scrolling UP away from tail.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const scrollTop = el.scrollTop
    const delta = scrollTop - lastScrollTopRef.current
    lastScrollTopRef.current = scrollTop

    if (delta < 0) {
      // Scrolling UP (away from tail) — more negative scrollTop
      interruptTail()
    } else if (delta > 0) {
      // Scrolling DOWN (toward tail) — toward 0
      lastDownwardScrollAtRef.current = Date.now()
    }
  }, [interruptTail])

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

  const handleMouseDown = useCallback(() => {
    interruptTail()
  }, [interruptTail])

  const handleTouchStart = useCallback(() => {
    interruptTail()
  }, [interruptTail])

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
    setUnreadCount(0)
    scrollToTail('smooth')
  }, [setUnreadCount, scrollToTail])

  return {
    atoms,
    entries,
    tailMode,
    unreadCount,
    scrollRef,
    head,
    tail,
    pointer,
    tailInterruptProps,
    interruptTail,
    jumpToLatest,
  }
}
