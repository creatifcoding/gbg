import {
  useCallback,
  useRef,
  type KeyboardEventHandler,
  type PointerEventHandler,
  type TouchEventHandler,
  type UIEventHandler,
  type WheelEventHandler,
} from 'react'

export interface ProgrammaticScrollGuardOptions {
  /**
   * Release strategy for programmatic-scroll guard.
   * - scrollend: release on native `scrollend` when available, fallback to timeout
   * - timeout: release after timeoutMs
   * - next-frame: release after two RAFs (legacy behavior)
   * - manual: caller must invoke returned release function
   */
  readonly until?: 'scrollend' | 'timeout' | 'next-frame' | 'manual'
  /** Timeout fallback for guard release (ms). */
  readonly timeoutMs?: number
}

export interface UseNestedScrollControllerOptions<TElement extends HTMLElement = HTMLElement> {
  /** Whether user-originated scroll should break follow mode. */
  readonly breakFollowOnUserScroll?: boolean
  /** Current follow mode state (true = following latest). */
  readonly isFollowing?: boolean
  /** Called when user scroll should break follow mode. */
  readonly onBreakFollow?: () => void
  /** Optional scroll element getter for robust programmatic guards. */
  readonly getScrollElement?: () => TElement | null
  /** Time window to correlate scroll events with explicit user intent. */
  readonly userIntentWindowMs?: number
  /** Preserve legacy behavior: break follow even when scroll source is unknown. */
  readonly breakOnUnknownScroll?: boolean
}

export interface NestedScrollController<TElement extends HTMLElement> {
  /**
   * Legacy alias. Prefer beginProgrammaticScroll/withProgrammaticScroll.
   */
  readonly suppressNextUserScroll: () => void
  /** Start programmatic-scroll guard and return release function. */
  readonly beginProgrammaticScroll: (
    options?: ProgrammaticScrollGuardOptions,
  ) => () => void
  /** Run a synchronous programmatic scroll under guard. */
  readonly withProgrammaticScroll: <T>(
    run: () => T,
    options?: ProgrammaticScrollGuardOptions,
  ) => T
  readonly onScroll: UIEventHandler<TElement>
  readonly onWheelCapture: WheelEventHandler<TElement>
  readonly onTouchStartCapture: TouchEventHandler<TElement>
  readonly onPointerDownCapture: PointerEventHandler<TElement>
  readonly onKeyDownCapture: KeyboardEventHandler<TElement>
}

const canConsumeWheel = (node: HTMLElement, deltaY: number): boolean => {
  if (Math.abs(deltaY) < 0.5) return false
  if (node.scrollHeight <= node.clientHeight + 1) return false

  const atTop = node.scrollTop <= 0
  const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1

  if (deltaY < 0) return !atTop
  if (deltaY > 0) return !atBottom
  return false
}

const SCROLL_INTENT_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
])

const now = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now()

/**
 * Generic nested-scroll mediator.
 *
 * - Stops wheel propagation while the current container can consume the wheel.
 * - Lets wheel bubble to parent once this container hits a boundary.
 * - Correlates user intent (wheel/pointer/touch/scroll keys) with scroll events.
 * - Provides robust programmatic scroll guards with `scrollend` fallback.
 */
export function useNestedScrollController<TElement extends HTMLElement>(
  options: UseNestedScrollControllerOptions<TElement>,
): NestedScrollController<TElement> {
  const lastScrollNodeRef = useRef<TElement | null>(null)
  const lastUserIntentAtRef = useRef<number>(-Infinity)
  const programmaticDepthRef = useRef(0)

  const userIntentWindowMs = options.userIntentWindowMs ?? 420
  const breakOnUnknownScroll = options.breakOnUnknownScroll ?? true

  const markUserIntent = useCallback(() => {
    lastUserIntentAtRef.current = now()
  }, [])

  const beginProgrammaticScroll = useCallback(
    (guardOptions: ProgrammaticScrollGuardOptions = {}) => {
      const strategy = guardOptions.until ?? 'scrollend'
      const timeoutMs = guardOptions.timeoutMs ?? 260

      programmaticDepthRef.current += 1

      const node = options.getScrollElement?.() ?? lastScrollNodeRef.current
      let released = false
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      let removeScrollEnd: (() => void) | null = null

      const release = () => {
        if (released) return
        released = true

        if (timeoutId !== null) {
          clearTimeout(timeoutId)
          timeoutId = null
        }

        removeScrollEnd?.()
        removeScrollEnd = null

        programmaticDepthRef.current = Math.max(0, programmaticDepthRef.current - 1)
      }

      if (strategy === 'next-frame') {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            release()
          })
        })
        return release
      }

      if (strategy === 'timeout') {
        timeoutId = setTimeout(release, timeoutMs)
        return release
      }

      if (strategy === 'scrollend') {
        if (node && 'onscrollend' in node) {
          const onScrollEnd = () => release()
          node.addEventListener('scrollend' as any, onScrollEnd as EventListener, {
            once: true,
          })
          removeScrollEnd = () => {
            node.removeEventListener('scrollend' as any, onScrollEnd as EventListener)
          }
        }

        // Always include timeout fallback to avoid sticky guards.
        timeoutId = setTimeout(release, timeoutMs)
        return release
      }

      return release
    },
    [options.getScrollElement],
  )

  const withProgrammaticScroll = useCallback(
    <T,>(run: () => T, guardOptions: ProgrammaticScrollGuardOptions = {}): T => {
      const release = beginProgrammaticScroll(guardOptions)
      try {
        return run()
      } finally {
        // If caller asked for manual in this convenience helper, fail-safe release.
        if ((guardOptions.until ?? 'scrollend') === 'manual') {
          release()
        }
      }
    },
    [beginProgrammaticScroll],
  )

  const suppressNextUserScroll = useCallback(() => {
    beginProgrammaticScroll({ until: 'next-frame' })
  }, [beginProgrammaticScroll])

  const onScroll = useCallback<UIEventHandler<TElement>>(
    (event) => {
      lastScrollNodeRef.current = event.currentTarget

      if (programmaticDepthRef.current > 0) return
      if (!options.breakFollowOnUserScroll || !options.isFollowing) return

      const hasRecentUserIntent = now() - lastUserIntentAtRef.current <= userIntentWindowMs

      if (hasRecentUserIntent || breakOnUnknownScroll) {
        options.onBreakFollow?.()
      }
    },
    [
      options.breakFollowOnUserScroll,
      options.isFollowing,
      options.onBreakFollow,
      userIntentWindowMs,
      breakOnUnknownScroll,
    ],
  )

  const onWheelCapture = useCallback<WheelEventHandler<TElement>>(
    (event) => {
      markUserIntent()

      const node = event.currentTarget
      if (canConsumeWheel(node, event.deltaY)) {
        event.stopPropagation()
      }
    },
    [markUserIntent],
  )

  const onTouchStartCapture = useCallback<TouchEventHandler<TElement>>(() => {
    markUserIntent()
  }, [markUserIntent])

  const onPointerDownCapture = useCallback<PointerEventHandler<TElement>>(() => {
    markUserIntent()
  }, [markUserIntent])

  const onKeyDownCapture = useCallback<KeyboardEventHandler<TElement>>(
    (event) => {
      if (SCROLL_INTENT_KEYS.has(event.key)) {
        markUserIntent()
      }
    },
    [markUserIntent],
  )

  return {
    suppressNextUserScroll,
    beginProgrammaticScroll,
    withProgrammaticScroll,
    onScroll,
    onWheelCapture,
    onTouchStartCapture,
    onPointerDownCapture,
    onKeyDownCapture,
  }
}
