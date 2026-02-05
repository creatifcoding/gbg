/**
 * RVN Animation Orchestration
 *
 * Timeline helpers and stagger utilities for coordinated animations.
 *
 * Usage:
 * ```ts
 * import { createRvnTimeline, staggerGrid, staggerList } from './orchestration'
 *
 * const tl = createRvnTimeline()
 * tl.add('.header', RVN_PRESETS.tacticalFadeIn)
 *   .add('.items', { ...RVN_PRESETS.listReveal, delay: staggerList() })
 * tl.play()
 * ```
 */

import {
  createTimeline,
  stagger,
  type AnimeParams,
  type Timeline,
  type Stagger,
} from 'animejs'

// =============================================================================
// TIMELINE FACTORY
// =============================================================================

/**
 * RVN timeline configuration.
 */
export interface RvnTimelineConfig {
  /** Autoplay on creation */
  autoplay?: boolean
  /** Loop the timeline */
  loop?: boolean | number
  /** Direction: normal, reverse, alternate */
  direction?: 'normal' | 'reverse' | 'alternate'
  /** Callback on timeline complete */
  onComplete?: () => void
  /** Callback on each frame */
  onUpdate?: (progress: number) => void
}

/**
 * Create a pre-configured RVN timeline.
 *
 * @example
 * ```ts
 * const tl = createRvnTimeline({ autoplay: false })
 * tl.add('.header', { opacity: [0, 1], duration: 300 })
 *   .add('.content', { opacity: [0, 1], duration: 300 }, '-=150')
 * tl.play()
 * ```
 */
export function createRvnTimeline(
  config: RvnTimelineConfig = {}
): Timeline {
  const {
    autoplay = false,
    loop = false,
    direction = 'normal',
    onComplete,
    onUpdate,
  } = config

  return createTimeline({
    autoplay,
    loop,
    alternate: direction === 'alternate',
    reversed: direction === 'reverse',
    onComplete,
    onUpdate: onUpdate
      ? (anim) => onUpdate(anim.progress)
      : undefined,
  })
}

/**
 * Create a one-shot entrance timeline.
 * Plays immediately, cleans up on complete.
 */
export function createEntranceTimeline(
  onComplete?: () => void
): Timeline {
  return createRvnTimeline({
    autoplay: true,
    onComplete,
  })
}

/**
 * Create a looping ambient timeline.
 * For background animations.
 */
export function createAmbientTimeline(): Timeline {
  return createRvnTimeline({
    autoplay: true,
    loop: true,
    direction: 'alternate',
  })
}

// =============================================================================
// STAGGER UTILITIES
// =============================================================================

/**
 * Grid stagger configuration.
 */
export interface GridStaggerConfig {
  /** Grid columns */
  cols?: number
  /** Grid rows */
  rows?: number
  /** Delay between items (ms) */
  delay?: number
  /** Origin point */
  from?: 'center' | 'first' | 'last' | 'edges' | number
}

/**
 * Create a grid-aware stagger configuration.
 *
 * @example
 * ```ts
 * const gridDelay = staggerGrid({ cols: 4, rows: 3, delay: 30 })
 * anime('.grid-item', { ...RVN_PRESETS.gridReveal, delay: gridDelay })
 * ```
 */
export function staggerGrid(config: GridStaggerConfig = {}): Stagger {
  const {
    cols = 4,
    rows = 4,
    delay = 50,
    from = 'center',
  } = config

  return stagger(delay, {
    grid: [rows, cols],
    from,
  })
}

/**
 * List stagger configuration.
 */
export interface ListStaggerConfig {
  /** Delay between items (ms) */
  delay?: number
  /** Starting delay (ms) */
  start?: number
  /** Origin: first or last */
  from?: 'first' | 'last'
}

/**
 * Create a list stagger configuration.
 *
 * @example
 * ```ts
 * const listDelay = staggerList({ delay: 40, from: 'first' })
 * anime('.list-item', { ...RVN_PRESETS.listReveal, delay: listDelay })
 * ```
 */
export function staggerList(config: ListStaggerConfig = {}): Stagger {
  const {
    delay = 40,
    start = 0,
    from = 'first',
  } = config

  return stagger(delay, {
    start,
    from: from === 'last' ? 'last' : 'first',
  })
}

/**
 * Create a wave stagger (sinusoidal timing).
 */
export function staggerWave(delay: number = 100): Stagger {
  return stagger(delay, {
    from: 'center',
    direction: 'normal',
  })
}

/**
 * Create a random stagger (shuffled order).
 */
export function staggerRandom(
  minDelay: number = 0,
  maxDelay: number = 100
): (el: Element, i: number) => number {
  return () => Math.random() * (maxDelay - minDelay) + minDelay
}

// =============================================================================
// SEQUENCE HELPERS
// =============================================================================

/**
 * Animation step in a sequence.
 */
export interface SequenceStep {
  /** CSS selector or element */
  target: string | Element | Element[]
  /** Animation configuration */
  animation: AnimeParams
  /** Timeline offset: absolute (number) or relative (string like '-=100') */
  offset?: number | string
  /** Label for this step */
  label?: string
}

/**
 * Build a timeline from a sequence of steps.
 *
 * @example
 * ```ts
 * const tl = buildSequence([
 *   { target: '.header', animation: RVN_PRESETS.tacticalFadeIn },
 *   { target: '.nav', animation: RVN_PRESETS.slideInLeft, offset: '-=150' },
 *   { target: '.content', animation: RVN_PRESETS.tacticalFadeIn, offset: '-=100' },
 * ])
 * tl.play()
 * ```
 */
export function buildSequence(
  steps: SequenceStep[],
  config?: RvnTimelineConfig
): Timeline {
  const tl = createRvnTimeline(config)

  steps.forEach((step) => {
    tl.add(step.target, step.animation, step.offset)
  })

  return tl
}

/**
 * Create a staggered entrance for multiple element groups.
 * Each group animates after the previous completes partially.
 */
export function staggeredEntrance(
  groups: Array<{
    target: string | Element | Element[]
    animation: AnimeParams
    overlap?: number // ms to overlap with previous
  }>
): Timeline {
  const tl = createRvnTimeline({ autoplay: true })

  let offset = 0
  groups.forEach((group, i) => {
    if (i > 0) {
      const prevDuration = (groups[i - 1].animation.duration as number) ?? 300
      const overlap = group.overlap ?? 150
      offset += prevDuration - overlap
    }

    tl.add(group.target, group.animation, offset)
  })

  return tl
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Wait for a timeline to complete.
 */
export function waitForTimeline(timeline: Timeline): Promise<void> {
  return new Promise((resolve) => {
    const originalComplete = (timeline as unknown as { onComplete?: () => void }).onComplete

    ;(timeline as unknown as { onComplete: () => void }).onComplete = () => {
      originalComplete?.()
      resolve()
    }
  })
}

/**
 * Chain multiple timelines sequentially.
 */
export async function chainTimelines(
  timelines: Timeline[]
): Promise<void> {
  for (const tl of timelines) {
    tl.play()
    await waitForTimeline(tl)
  }
}

/**
 * Play multiple timelines in parallel.
 */
export function parallelTimelines(
  timelines: Timeline[]
): Promise<void[]> {
  return Promise.all(
    timelines.map((tl) => {
      tl.play()
      return waitForTimeline(tl)
    })
  )
}

/**
 * Create a delay promise.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Run animation only if element is visible.
 */
export function animateIfVisible(
  target: string | Element,
  animation: AnimeParams,
  config?: RvnTimelineConfig
): Timeline | null {
  const element =
    typeof target === 'string'
      ? document.querySelector(target)
      : target

  if (!element) return null

  const rect = element.getBoundingClientRect()
  const isVisible =
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0

  if (!isVisible) return null

  const tl = createRvnTimeline(config)
  tl.add(element, animation)
  tl.play()
  return tl
}

// =============================================================================
// PAGE TRANSITION HELPERS
// =============================================================================

/**
 * Standard page entrance animation.
 * Header -> Nav -> Content cascade.
 */
export function pageEntrance(selectors?: {
  header?: string
  nav?: string
  content?: string
}): Timeline {
  const {
    header = '.page-header',
    nav = '.page-nav',
    content = '.page-content',
  } = selectors ?? {}

  return buildSequence([
    {
      target: header,
      animation: {
        opacity: [0, 1],
        translateY: [-20, 0],
        duration: 300,
        easing: 'easeOutQuad',
      },
    },
    {
      target: nav,
      animation: {
        opacity: [0, 1],
        translateX: [-30, 0],
        duration: 300,
        easing: 'easeOutQuad',
      },
      offset: '-=200',
    },
    {
      target: content,
      animation: {
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 400,
        easing: 'easeOutQuad',
      },
      offset: '-=200',
    },
  ])
}

/**
 * Standard page exit animation.
 * Reverse of entrance.
 */
export function pageExit(selectors?: {
  header?: string
  nav?: string
  content?: string
}): Timeline {
  const {
    header = '.page-header',
    nav = '.page-nav',
    content = '.page-content',
  } = selectors ?? {}

  return buildSequence([
    {
      target: content,
      animation: {
        opacity: [1, 0],
        translateY: [0, 10],
        duration: 200,
        easing: 'easeInQuad',
      },
    },
    {
      target: nav,
      animation: {
        opacity: [1, 0],
        translateX: [0, -20],
        duration: 200,
        easing: 'easeInQuad',
      },
      offset: '-=100',
    },
    {
      target: header,
      animation: {
        opacity: [1, 0],
        translateY: [0, -10],
        duration: 200,
        easing: 'easeInQuad',
      },
      offset: '-=100',
    },
  ])
}
