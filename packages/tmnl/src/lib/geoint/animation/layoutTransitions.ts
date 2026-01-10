/**
 * GEOINT Layout Transitions
 *
 * anime.js timeline orchestrations for smooth layout transitions:
 * - Command ↔ Focus: Panel collapse/expand with floating panel emergence
 * - Command ↔ Analytics: Grid reconfiguration
 * - Focus ↔ Analytics: Floating panels dock to grid
 *
 * Uses anime.js v4 timeline for choreographed sequences.
 *
 * @module geoint/animation/layoutTransitions
 */

import { createTimeline, animate, stagger, type Timeline } from 'animejs'
import { type LayoutMode } from '../atoms/layoutAtoms'
import { TIMING, EASING, ANIMATIONS, PANEL_DIMENSIONS } from '../tokens'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Internal transition phase for animation orchestration.
 * More granular than the layout atom's AnimationPhase.
 */
export type TransitionPhase =
  | 'idle'
  | 'exit_panels'
  | 'transition_layout'
  | 'enter_panels'
  | 'complete'

/**
 * Layout transition configuration.
 */
export interface LayoutTransitionConfig {
  readonly from: LayoutMode
  readonly to: LayoutMode
  readonly containerRef: HTMLElement
  readonly onPhaseChange?: (phase: TransitionPhase) => void
  readonly onComplete?: () => void
}

/**
 * Panel elements for animation targeting.
 */
export interface LayoutPanelRefs {
  readonly sidebar?: HTMLElement | null
  readonly intel?: HTMLElement | null
  readonly timeline?: HTMLElement | null
  readonly map?: HTMLElement | null
  readonly header?: HTMLElement | null
  readonly floatingPanels?: HTMLElement[]
}

/**
 * Animation handle for cancellation.
 */
export interface TransitionHandle {
  readonly cancel: () => void
  readonly complete: Promise<void>
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert readonly preset to mutable for anime.js.
 */
const toMutable = <T extends Record<string, unknown>>(preset: T): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(preset)) {
    if (Array.isArray(value)) {
      result[key] = [...value]
    } else if (value && typeof value === 'object' && !('then' in value)) {
      result[key] = toMutable(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Get panel refs from container.
 */
export function getLayoutPanelRefs(container: HTMLElement): LayoutPanelRefs {
  const floatingPanelNodes = container.querySelectorAll<HTMLElement>('[data-floating-panel]')
  return {
    sidebar: container.querySelector<HTMLElement>('[data-layout-panel="sidebar"]'),
    intel: container.querySelector<HTMLElement>('[data-layout-panel="intel"]'),
    timeline: container.querySelector<HTMLElement>('[data-layout-panel="timeline"]'),
    map: container.querySelector<HTMLElement>('[data-layout-panel="map"]'),
    header: container.querySelector<HTMLElement>('[data-layout-panel="header"]'),
    floatingPanels: Array.from(floatingPanelNodes),
  }
}

/**
 * Add a phase marker to timeline (no-op animation just for timing callbacks).
 */
function addPhaseMarker(
  tl: Timeline,
  phase: TransitionPhase,
  onPhaseChange: ((phase: TransitionPhase) => void) | undefined,
  position: number
): void {
  tl.add({ duration: 1, onBegin: () => onPhaseChange?.(phase) }, position)
}

// =============================================================================
// TRANSITION: COMMAND → FOCUS
// =============================================================================

/**
 * Animate transition from Command Center to Focus Mode.
 *
 * Sequence:
 * 1. Exit panels (sidebar + intel collapse in parallel)
 * 2. Map expands to full screen
 * 3. Floating panels emerge with stagger
 */
export function transitionCommandToFocus(
  panels: LayoutPanelRefs,
  config: Omit<LayoutTransitionConfig, 'from' | 'to' | 'containerRef'>
): TransitionHandle {
  const { onPhaseChange, onComplete } = config
  let cancelled = false

  const completePromise = new Promise<void>((resolve) => {
    // Phase 1: Exit panels
    onPhaseChange?.('exit_panels')

    const tl = createTimeline({
      defaults: { easing: EASING.anime.out },
      onComplete: () => {
        if (!cancelled) {
          onPhaseChange?.('complete')
          onComplete?.()
          resolve()
        }
      },
    })

    // Collapse sidebar
    if (panels.sidebar) {
      tl.add(panels.sidebar, {
        width: [PANEL_DIMENSIONS.sidebar.default, 0],
        opacity: [1, 0],
        duration: TIMING.panel,
      }, 0)
    }

    // Collapse intel panel
    if (panels.intel) {
      tl.add(panels.intel, {
        width: [PANEL_DIMENSIONS.intelPanel.default, 0],
        opacity: [1, 0],
        duration: TIMING.panel,
      }, 0)
    }

    // Collapse timeline drawer
    if (panels.timeline) {
      tl.add(panels.timeline, {
        height: [PANEL_DIMENSIONS.drawer.default, 0],
        opacity: [1, 0],
        duration: TIMING.panel,
      }, 0)
    }

    // Phase 2: Layout transition callback
    addPhaseMarker(tl, 'transition_layout', onPhaseChange, TIMING.panel * 0.5)

    // Phase 3: Enter floating panels
    addPhaseMarker(tl, 'enter_panels', onPhaseChange, TIMING.panel)

    // Floating panels emerge with stagger
    if (panels.floatingPanels && panels.floatingPanels.length > 0) {
      tl.add(panels.floatingPanels, {
        translateY: [20, 0],
        opacity: [0, 1],
        scale: [0.95, 1],
        duration: TIMING.normal,
        delay: stagger(TIMING.stagger),
      }, TIMING.panel)
    }
  })

  return {
    cancel: () => { cancelled = true },
    complete: completePromise,
  }
}

// =============================================================================
// TRANSITION: FOCUS → COMMAND
// =============================================================================

/**
 * Animate transition from Focus Mode to Command Center.
 *
 * Sequence:
 * 1. Floating panels exit with stagger
 * 2. Map contracts
 * 3. Panels reveal (sidebar + intel expand)
 */
export function transitionFocusToCommand(
  panels: LayoutPanelRefs,
  config: Omit<LayoutTransitionConfig, 'from' | 'to' | 'containerRef'>
): TransitionHandle {
  const { onPhaseChange, onComplete } = config
  let cancelled = false

  const completePromise = new Promise<void>((resolve) => {
    // Phase 1: Exit floating panels
    onPhaseChange?.('exit_panels')

    const floatingCount = panels.floatingPanels?.length ?? 0
    const floatingExitDuration = TIMING.fast + floatingCount * TIMING.stagger

    const tl = createTimeline({
      defaults: { easing: EASING.anime.out },
      onComplete: () => {
        if (!cancelled) {
          onPhaseChange?.('complete')
          onComplete?.()
          resolve()
        }
      },
    })

    // Exit floating panels with reverse stagger
    if (panels.floatingPanels && panels.floatingPanels.length > 0) {
      tl.add(panels.floatingPanels, {
        translateY: [0, 20],
        opacity: [1, 0],
        scale: [1, 0.95],
        duration: TIMING.fast,
        delay: stagger(TIMING.stagger, { reversed: true }),
      }, 0)
    }

    // Phase 2: Layout transition
    addPhaseMarker(tl, 'transition_layout', onPhaseChange, floatingExitDuration)

    // Phase 3: Enter panels
    addPhaseMarker(tl, 'enter_panels', onPhaseChange, floatingExitDuration + TIMING.fast)

    // Expand sidebar
    if (panels.sidebar) {
      tl.add(panels.sidebar, {
        width: [0, PANEL_DIMENSIONS.sidebar.default],
        opacity: [0, 1],
        duration: TIMING.panel,
      }, floatingExitDuration + TIMING.fast)
    }

    // Expand intel panel
    if (panels.intel) {
      tl.add(panels.intel, {
        width: [0, PANEL_DIMENSIONS.intelPanel.default],
        opacity: [0, 1],
        duration: TIMING.panel,
      }, floatingExitDuration + TIMING.fast)
    }

    // Expand timeline drawer
    if (panels.timeline) {
      tl.add(panels.timeline, {
        height: [0, PANEL_DIMENSIONS.drawer.default],
        opacity: [0, 1],
        duration: TIMING.panel,
      }, floatingExitDuration + TIMING.fast + TIMING.stagger)
    }
  })

  return {
    cancel: () => { cancelled = true },
    complete: completePromise,
  }
}

// =============================================================================
// TRANSITION: COMMAND → ANALYTICS
// =============================================================================

/**
 * Animate transition from Command Center to Analytics Dashboard.
 */
export function transitionCommandToAnalytics(
  panels: LayoutPanelRefs,
  config: Omit<LayoutTransitionConfig, 'from' | 'to' | 'containerRef'>
): TransitionHandle {
  const { onPhaseChange, onComplete } = config
  let cancelled = false

  const completePromise = new Promise<void>((resolve) => {
    onPhaseChange?.('exit_panels')

    const tl = createTimeline({
      defaults: { easing: EASING.anime.out },
      onComplete: () => {
        if (!cancelled) {
          onPhaseChange?.('complete')
          onComplete?.()
          resolve()
        }
      },
    })

    // Fade out sidebar and intel
    if (panels.sidebar) {
      tl.add(panels.sidebar, {
        opacity: [1, 0],
        duration: TIMING.fast,
      }, 0)
    }

    if (panels.intel) {
      tl.add(panels.intel, {
        opacity: [1, 0],
        duration: TIMING.fast,
      }, 0)
    }

    // Phase transitions
    addPhaseMarker(tl, 'transition_layout', onPhaseChange, TIMING.fast)
    addPhaseMarker(tl, 'enter_panels', onPhaseChange, TIMING.fast + TIMING.stagger)
  })

  return {
    cancel: () => { cancelled = true },
    complete: completePromise,
  }
}

// =============================================================================
// TRANSITION: ANALYTICS → COMMAND
// =============================================================================

/**
 * Animate transition from Analytics Dashboard to Command Center.
 */
export function transitionAnalyticsToCommand(
  panels: LayoutPanelRefs,
  config: Omit<LayoutTransitionConfig, 'from' | 'to' | 'containerRef'>
): TransitionHandle {
  const { onPhaseChange, onComplete } = config
  let cancelled = false

  const completePromise = new Promise<void>((resolve) => {
    onPhaseChange?.('exit_panels')

    const tl = createTimeline({
      defaults: { easing: EASING.anime.out },
      onComplete: () => {
        if (!cancelled) {
          onPhaseChange?.('complete')
          onComplete?.()
          resolve()
        }
      },
    })

    // Phase transitions
    addPhaseMarker(tl, 'transition_layout', onPhaseChange, TIMING.fast)
    addPhaseMarker(tl, 'enter_panels', onPhaseChange, TIMING.fast + TIMING.stagger)

    // Expand panels
    if (panels.sidebar) {
      tl.add(panels.sidebar, {
        width: [0, PANEL_DIMENSIONS.sidebar.default],
        opacity: [0, 1],
        duration: TIMING.panel,
      }, TIMING.fast + TIMING.stagger)
    }

    if (panels.intel) {
      tl.add(panels.intel, {
        width: [0, PANEL_DIMENSIONS.intelPanel.default],
        opacity: [0, 1],
        duration: TIMING.panel,
      }, TIMING.fast + TIMING.stagger)
    }
  })

  return {
    cancel: () => { cancelled = true },
    complete: completePromise,
  }
}

// =============================================================================
// TRANSITION: FOCUS ↔ ANALYTICS
// =============================================================================

/**
 * Animate transition from Focus to Analytics.
 */
export function transitionFocusToAnalytics(
  panels: LayoutPanelRefs,
  config: Omit<LayoutTransitionConfig, 'from' | 'to' | 'containerRef'>
): TransitionHandle {
  const { onPhaseChange, onComplete } = config
  let cancelled = false

  const completePromise = new Promise<void>((resolve) => {
    onPhaseChange?.('exit_panels')

    const tl = createTimeline({
      defaults: { easing: EASING.anime.out },
      onComplete: () => {
        if (!cancelled) {
          onPhaseChange?.('complete')
          onComplete?.()
          resolve()
        }
      },
    })

    // Exit floating panels
    if (panels.floatingPanels && panels.floatingPanels.length > 0) {
      tl.add(panels.floatingPanels, {
        opacity: [1, 0],
        scale: [1, 0.9],
        duration: TIMING.fast,
        delay: stagger(TIMING.stagger / 2),
      }, 0)
    }

    // Phase transitions
    addPhaseMarker(tl, 'transition_layout', onPhaseChange, TIMING.fast)
    addPhaseMarker(tl, 'enter_panels', onPhaseChange, TIMING.fast + TIMING.stagger)
  })

  return {
    cancel: () => { cancelled = true },
    complete: completePromise,
  }
}

/**
 * Animate transition from Analytics to Focus.
 */
export function transitionAnalyticsToFocus(
  panels: LayoutPanelRefs,
  config: Omit<LayoutTransitionConfig, 'from' | 'to' | 'containerRef'>
): TransitionHandle {
  const { onPhaseChange, onComplete } = config
  let cancelled = false

  const completePromise = new Promise<void>((resolve) => {
    onPhaseChange?.('exit_panels')

    const tl = createTimeline({
      defaults: { easing: EASING.anime.out },
      onComplete: () => {
        if (!cancelled) {
          onPhaseChange?.('complete')
          onComplete?.()
          resolve()
        }
      },
    })

    // Phase transitions
    addPhaseMarker(tl, 'transition_layout', onPhaseChange, TIMING.fast)
    addPhaseMarker(tl, 'enter_panels', onPhaseChange, TIMING.fast + TIMING.stagger)

    // Enter floating panels
    if (panels.floatingPanels && panels.floatingPanels.length > 0) {
      tl.add(panels.floatingPanels, {
        translateY: [20, 0],
        opacity: [0, 1],
        scale: [0.95, 1],
        duration: TIMING.normal,
        delay: stagger(TIMING.stagger),
      }, TIMING.fast + TIMING.stagger)
    }
  })

  return {
    cancel: () => { cancelled = true },
    complete: completePromise,
  }
}

// =============================================================================
// UNIFIED TRANSITION ORCHESTRATOR
// =============================================================================

type TransitionFn = (
  panels: LayoutPanelRefs,
  config: Omit<LayoutTransitionConfig, 'from' | 'to' | 'containerRef'>
) => TransitionHandle

/**
 * Transition matrix for layout changes.
 */
const TRANSITION_MAP: Record<`${LayoutMode}_${LayoutMode}`, TransitionFn> = {
  'command_focus': transitionCommandToFocus,
  'focus_command': transitionFocusToCommand,
  'command_analytics': transitionCommandToAnalytics,
  'analytics_command': transitionAnalyticsToCommand,
  'focus_analytics': transitionFocusToAnalytics,
  'analytics_focus': transitionAnalyticsToFocus,
  // No-op for same layout
  'command_command': (_, config) => ({
    cancel: () => {},
    complete: Promise.resolve().then(() => config.onComplete?.()),
  }),
  'focus_focus': (_, config) => ({
    cancel: () => {},
    complete: Promise.resolve().then(() => config.onComplete?.()),
  }),
  'analytics_analytics': (_, config) => ({
    cancel: () => {},
    complete: Promise.resolve().then(() => config.onComplete?.()),
  }),
}

/**
 * Execute layout transition with appropriate animation sequence.
 */
export function executeLayoutTransition(
  from: LayoutMode,
  to: LayoutMode,
  container: HTMLElement,
  config: Omit<LayoutTransitionConfig, 'from' | 'to' | 'containerRef'>
): TransitionHandle {
  const panels = getLayoutPanelRefs(container)
  const key = `${from}_${to}` as keyof typeof TRANSITION_MAP
  const transitionFn = TRANSITION_MAP[key]

  if (!transitionFn) {
    console.warn(`[layoutTransitions] Unknown transition: ${key}`)
    return {
      cancel: () => {},
      complete: Promise.resolve().then(() => config.onComplete?.()),
    }
  }

  return transitionFn(panels, config)
}

// =============================================================================
// PANEL ANIMATIONS
// =============================================================================

/**
 * Animate panel expand.
 */
export function animatePanelExpand(
  panel: HTMLElement,
  targetWidth: number,
  onComplete?: () => void
): ReturnType<typeof animate> {
  return animate(panel, {
    width: targetWidth,
    opacity: 1,
    duration: TIMING.panel,
    easing: EASING.anime.out,
    ...(onComplete && { onComplete }),
  })
}

/**
 * Animate panel collapse.
 */
export function animatePanelCollapse(
  panel: HTMLElement,
  collapsedWidth: number,
  onComplete?: () => void
): ReturnType<typeof animate> {
  return animate(panel, {
    width: collapsedWidth,
    opacity: 0.8,
    duration: TIMING.panel,
    easing: EASING.anime.in,
    ...(onComplete && { onComplete }),
  })
}

/**
 * Animate drawer open.
 */
export function animateDrawerOpen(
  drawer: HTMLElement,
  targetHeight: number,
  onComplete?: () => void
): ReturnType<typeof animate> {
  return animate(drawer, {
    height: targetHeight,
    translateY: 0,
    opacity: 1,
    duration: TIMING.panel,
    easing: EASING.anime.out,
    ...(onComplete && { onComplete }),
  })
}

/**
 * Animate drawer close.
 */
export function animateDrawerClose(
  drawer: HTMLElement,
  onComplete?: () => void
): ReturnType<typeof animate> {
  return animate(drawer, {
    height: PANEL_DIMENSIONS.drawer.collapsed,
    translateY: 0,
    opacity: 0.8,
    duration: TIMING.panel,
    easing: EASING.anime.in,
    ...(onComplete && { onComplete }),
  })
}

// =============================================================================
// RESULT LIST ANIMATIONS
// =============================================================================

/**
 * Animate result list items entering.
 */
export function animateResultsEnter(
  items: HTMLElement[] | NodeListOf<Element>,
  onComplete?: () => void
): ReturnType<typeof animate> {
  return animate(items, {
    translateX: [-20, 0],
    opacity: [0, 1],
    duration: TIMING.normal,
    delay: stagger(TIMING.stagger),
    easing: EASING.anime.out,
    ...(onComplete && { onComplete }),
  })
}

/**
 * Animate result list items exiting.
 */
export function animateResultsExit(
  items: HTMLElement[] | NodeListOf<Element>,
  onComplete?: () => void
): ReturnType<typeof animate> {
  return animate(items, {
    translateX: [0, 20],
    opacity: [1, 0],
    duration: TIMING.fast,
    delay: stagger(TIMING.stagger / 2, { from: 'last' }),
    easing: EASING.anime.in,
    ...(onComplete && { onComplete }),
  })
}

/**
 * Animate single result selection.
 */
export function animateResultSelect(item: HTMLElement): ReturnType<typeof animate> {
  return animate(item, {
    ...toMutable(ANIMATIONS.highlight),
    backgroundColor: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0)'],
  })
}

// =============================================================================
// FLOATING PANEL ANIMATIONS
// =============================================================================

/**
 * Animate floating panel appear.
 */
export function animateFloatingPanelAppear(
  panel: HTMLElement,
  onComplete?: () => void
): ReturnType<typeof animate> {
  return animate(panel, {
    translateY: [20, 0],
    opacity: [0, 1],
    scale: [0.95, 1],
    duration: TIMING.normal,
    easing: EASING.anime.bounce,
    ...(onComplete && { onComplete }),
  })
}

/**
 * Animate floating panel disappear.
 */
export function animateFloatingPanelDisappear(
  panel: HTMLElement,
  onComplete?: () => void
): ReturnType<typeof animate> {
  return animate(panel, {
    translateY: [0, 20],
    opacity: [1, 0],
    scale: [1, 0.95],
    duration: TIMING.fast,
    easing: EASING.anime.in,
    ...(onComplete && { onComplete }),
  })
}

/**
 * Animate floating panel minimize.
 */
export function animateFloatingPanelMinimize(
  panel: HTMLElement,
  targetPosition: { x: number; y: number },
  onComplete?: () => void
): ReturnType<typeof animate> {
  return animate(panel, {
    scale: [1, 0.5, 0],
    opacity: [1, 1, 0],
    left: targetPosition.x,
    top: targetPosition.y,
    duration: TIMING.normal,
    easing: EASING.anime.in,
    ...(onComplete && { onComplete }),
  })
}

/**
 * Animate floating panel restore from minimized.
 */
export function animateFloatingPanelRestore(
  panel: HTMLElement,
  targetPosition: { x: number; y: number },
  targetSize: { width: number; height: number },
  onComplete?: () => void
): ReturnType<typeof animate> {
  return animate(panel, {
    scale: [0, 0.5, 1],
    opacity: [0, 1, 1],
    left: targetPosition.x,
    top: targetPosition.y,
    width: targetSize.width,
    height: targetSize.height,
    duration: TIMING.normal,
    easing: EASING.anime.bounce,
    ...(onComplete && { onComplete }),
  })
}

// =============================================================================
// ENTITY SELECTION ANIMATION
// =============================================================================

/**
 * Animate entity selection with ring effect.
 */
export function animateEntitySelect(
  ringElement: HTMLElement,
  onComplete?: () => void
): ReturnType<typeof animate> {
  return animate(ringElement, {
    ...toMutable(ANIMATIONS.selectionRing),
    ...(onComplete && { onComplete }),
  })
}

/**
 * Animate entity deselection.
 */
export function animateEntityDeselect(
  ringElement: HTMLElement,
  onComplete?: () => void
): ReturnType<typeof animate> {
  return animate(ringElement, {
    scale: [1, 0.8],
    opacity: [1, 0],
    duration: TIMING.fast,
    easing: EASING.anime.in,
    ...(onComplete && { onComplete }),
  })
}
