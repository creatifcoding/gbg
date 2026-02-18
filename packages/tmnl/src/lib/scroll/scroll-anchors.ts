/**
 * Scroll Anchor System — reusable hooks for scroll-target management.
 *
 * Three primitives:
 *
 *   useScrollAnchor  — fixed sentinel (head / tail) with IntersectionObserver.
 *                      Returns { ref, isVisible, scrollTo }.
 *
 *   useScrollPointer — movable pointer that targets any entry by key.
 *                      Resolves key → DOM element via data-entry-key.
 *                      Returns { targetKey, setTarget, scrollTo, clear }.
 *
 *   scrollInContainer — container-scoped scroll to a child element.
 *                       No scrollIntoView (leaks to ancestor scrollables).
 *
 * Extracted from agent-task/views/scroll-anchors — domain-agnostic.
 *
 * @module scroll/scroll-anchors
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREFERS_REDUCED_MOTION =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

// ---------------------------------------------------------------------------
// Shared utility — container-scoped scroll to a child element
// ---------------------------------------------------------------------------

/**
 * Scroll a container so that a child element is visible.
 * Uses container.scrollTo — never scrollIntoView (ancestor leak).
 *
 * @param container  The scrollable parent
 * @param target     The child element to scroll to
 * @param block      'start' | 'center' | 'end' | 'nearest'
 * @param behavior   'auto' | 'smooth'
 */
export const scrollInContainer = (
  container: HTMLElement,
  target: HTMLElement,
  block: ScrollLogicalPosition = 'center',
  behavior: ScrollBehavior = 'smooth',
): void => {
  const containerRect = container.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()

  // Target's position relative to the container's visible area
  const relativeTop = targetRect.top - containerRect.top + container.scrollTop

  let scrollTop: number
  switch (block) {
    case 'start':
      scrollTop = relativeTop
      break
    case 'end':
      scrollTop = relativeTop - container.clientHeight + target.offsetHeight
      break
    case 'nearest': {
      const isAbove = targetRect.top < containerRect.top
      const isBelow = targetRect.bottom > containerRect.bottom
      if (!isAbove && !isBelow) return // already visible
      scrollTop = isAbove
        ? relativeTop
        : relativeTop - container.clientHeight + target.offsetHeight
      break
    }
    case 'center':
    default:
      scrollTop = relativeTop - container.clientHeight / 2 + target.offsetHeight / 2
      break
  }

  container.scrollTo({
    top: Math.max(0, scrollTop),
    behavior: PREFERS_REDUCED_MOTION ? 'auto' : behavior,
  })
}

// ---------------------------------------------------------------------------
// useScrollAnchor — fixed sentinel with IntersectionObserver
// ---------------------------------------------------------------------------

export interface ScrollAnchorOptions {
  /** The scroll container ref */
  readonly scrollRef: React.RefObject<HTMLElement | null>
  /** Observer root margin (default: '0px') */
  readonly rootMargin?: string
  /** Observer threshold (default: 0) */
  readonly threshold?: number
  /** Called when visibility changes */
  readonly onVisibilityChange?: (visible: boolean) => void
}

export interface ScrollAnchorHandle {
  /** Attach to the sentinel element */
  readonly ref: React.RefObject<HTMLDivElement | null>
  /** Whether the sentinel is currently visible in the scroll container */
  readonly isVisible: boolean
  /** Scroll the container to the sentinel position */
  readonly scrollTo: (block?: ScrollLogicalPosition, behavior?: ScrollBehavior) => void
}

export const useScrollAnchor = ({
  scrollRef,
  rootMargin = '0px',
  threshold = 0,
  onVisibilityChange,
}: ScrollAnchorOptions): ScrollAnchorHandle => {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const onVisibilityChangeRef = useRef(onVisibilityChange)
  onVisibilityChangeRef.current = onVisibilityChange

  useEffect(() => {
    const anchor = ref.current
    const root = scrollRef.current
    if (!anchor || !root) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting
        setIsVisible(visible)
        onVisibilityChangeRef.current?.(visible)
      },
      { root, threshold, rootMargin },
    )

    observer.observe(anchor)
    return () => observer.disconnect()
  }, [scrollRef, rootMargin, threshold])

  const scrollTo = useCallback(
    (block: ScrollLogicalPosition = 'end', behavior: ScrollBehavior = 'smooth') => {
      const container = scrollRef.current
      const anchor = ref.current
      if (!container || !anchor) return
      scrollInContainer(container, anchor, block, behavior)
    },
    [scrollRef],
  )

  return { ref, isVisible, scrollTo }
}

// ---------------------------------------------------------------------------
// useScrollPointer — movable pointer targeting entries by key
// ---------------------------------------------------------------------------

export interface ScrollPointerOptions {
  /** The scroll container ref */
  readonly scrollRef: React.RefObject<HTMLElement | null>
  /**
   * DOM selector for entry rows. Must contain `data-entry-key` attribute.
   * Default: '[data-entry-key]'
   */
  readonly entrySelector?: string
}

export interface ScrollPointerHandle {
  /** Currently targeted entry key, or null */
  readonly targetKey: string | null
  /** Move the pointer to a specific entry */
  readonly setTarget: (key: string | null) => void
  /** Scroll the targeted entry into view */
  readonly scrollTo: (block?: ScrollLogicalPosition, behavior?: ScrollBehavior) => void
  /** Focus the targeted entry element */
  readonly focus: () => void
  /** Clear the pointer (setTarget(null)) */
  readonly clear: () => void
}

export const useScrollPointer = ({
  scrollRef,
  entrySelector = '[data-entry-key]',
}: ScrollPointerOptions): ScrollPointerHandle => {
  const targetKeyRef = useRef<string | null>(null)
  const [targetKey, setTargetKeyState] = useState<string | null>(null)

  const resolveElement = useCallback((): HTMLElement | null => {
    const container = scrollRef.current
    const key = targetKeyRef.current
    if (!container || !key) return null
    return container.querySelector<HTMLElement>(
      `${entrySelector}[data-entry-key="${CSS.escape(key)}"]`,
    )
  }, [scrollRef, entrySelector])

  const setTarget = useCallback((key: string | null) => {
    targetKeyRef.current = key
    setTargetKeyState(key)
  }, [])

  const scrollTo = useCallback(
    (block: ScrollLogicalPosition = 'center', behavior: ScrollBehavior = 'smooth') => {
      const container = scrollRef.current
      const el = resolveElement()
      if (!container || !el) return
      scrollInContainer(container, el, block, behavior)
    },
    [scrollRef, resolveElement],
  )

  const focus = useCallback(() => {
    const el = resolveElement()
    if (!el) return
    el.focus({ preventScroll: true })
  }, [resolveElement])

  const clear = useCallback(() => {
    setTarget(null)
  }, [setTarget])

  return { targetKey, setTarget, scrollTo, focus, clear }
}
