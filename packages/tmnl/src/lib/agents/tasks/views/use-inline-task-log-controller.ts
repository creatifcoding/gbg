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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Atom } from '@effect-atom/atom'
import {
  filteredLogBufferFamily,
  hydrateWindowTrigger,
  hydrationErrorFamily,
  hydrationLoadingFamily,
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
} from '@/lib/scroll'

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
  readonly hydrationLoading: boolean
  readonly hydrationError: string | null
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

/** Top-threshold proximity (px) used to probe hydration while inspecting. */
const HYDRATION_HEAD_PROXIMITY_PX = 32

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
  const hydrationLoading = useAtomValue(
    (atoms?.hydrationLoadingFamily ?? hydrationLoadingFamily)(taskId),
  )
  const hydrationError = useAtomValue((atoms?.hydrationErrorFamily ?? hydrationErrorFamily)(taskId))

  const setStreamTrigger = useAtomSet(atoms?.logStreamTrigger ?? logStreamTrigger)
  const setHydrateWindowTrigger = useAtomSet(
    atoms?.hydrateWindowTrigger ?? hydrateWindowTrigger,
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const lastEntryCountRef = useRef(0)
  const lastTriggeredKeyRef = useRef<string | null>(null)
  const lastScrollTopRef = useRef(0)
  const lastDownwardScrollAtRef = useRef(0)
  const [nearHeadProximity, setNearHeadProximity] = useState(false)
  const hydrationProbeArmedRef = useRef(false)

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
    console.log(`[controller] calling setStreamTrigger(${taskId}) triggerMode=${triggerMode} key=${triggerKey}`)
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
  // Inspect near-head hydration probe (AH1-T12)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (tailMode !== 'inspect') {
      hydrationProbeArmedRef.current = false
      return
    }

    const nearHead = head.isVisible || nearHeadProximity
    if (!nearHead) {
      hydrationProbeArmedRef.current = false
      return
    }

    if (hydrationLoading || hydrationProbeArmedRef.current) {
      return
    }

    hydrationProbeArmedRef.current = true
    const centerOffset = Math.max(entries.length - 1, 0)
    void setHydrateWindowTrigger({ taskId, centerOffset })
  }, [
    entries.length,
    head.isVisible,
    hydrationLoading,
    nearHeadProximity,
    setHydrateWindowTrigger,
    tailMode,
    taskId,
  ])

  // -------------------------------------------------------------------------
  // Tail interrupt + re-engagement handlers
  // -------------------------------------------------------------------------

  const interruptTail = useCallback(() => {
    if (tailMode !== 'tail') return
    setTailMode('inspect')
  }, [tailMode, setTailMode])

  // Tail-distance fallback for environments where IntersectionObserver precision
  // is limited (notably jsdom): combine reverse-scroll and standard-scroll math.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const scrollTop = el.scrollTop
    const prevScrollTop = lastScrollTopRef.current
    lastScrollTopRef.current = scrollTop

    const maxScrollable = Math.max(el.scrollHeight - el.clientHeight, 0)
    const nearHeadNow =
      scrollTop <= HYDRATION_HEAD_PROXIMITY_PX ||
      Math.abs(maxScrollable - scrollTop) <= HYDRATION_HEAD_PROXIMITY_PX
    setNearHeadProximity((prev) => (prev === nearHeadNow ? prev : nearHeadNow))

    const distanceFromTail = (top: number) => {
      const reverseDistance = Math.abs(top)
      const standardDistance = Math.abs(el.scrollHeight - (top + el.clientHeight))
      return Math.min(reverseDistance, standardDistance)
    }

    const prevDistanceFromTail = distanceFromTail(prevScrollTop)
    const nextDistanceFromTail = distanceFromTail(scrollTop)

    if (nextDistanceFromTail > prevDistanceFromTail) {
      // User moved away from tail.
      interruptTail()
      return
    }

    if (nextDistanceFromTail < prevDistanceFromTail) {
      // User moved toward tail.
      lastDownwardScrollAtRef.current = Date.now()
    }

    if (tailMode === 'inspect' && nextDistanceFromTail <= TAIL_PROXIMITY_PX) {
      setTailMode('tail')
      setUnreadCount(0)
    }
  }, [interruptTail, setTailMode, setUnreadCount, tailMode])

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
    hydrationLoading,
    hydrationError,
    scrollRef,
    head,
    tail,
    pointer,
    tailInterruptProps,
    interruptTail,
    jumpToLatest,
  }
}
