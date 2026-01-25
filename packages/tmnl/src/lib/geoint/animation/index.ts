/**
 * GEOINT Animation Module
 *
 * Effect-based animation orchestration for the GEOINT dashboard.
 *
 * @example
 * ```typescript
 * import { AnimationOrchestratorTag, flyToConfig } from '@/lib/geoint/animation'
 *
 * const program = Effect.gen(function* () {
 *   const animator = yield* AnimationOrchestratorTag
 *   yield* animator.animateViewport(
 *     flyToConfig(-122.42, 37.78, 14),
 *     (state) => setViewport(state)
 *   )
 * })
 * ```
 *
 * @module geoint/animation
 */

export {
  // Service
  AnimationOrchestratorTag,
  AnimationOrchestratorLive,
  type AnimationOrchestrator,

  // Error
  AnimationError,

  // Types
  type ViewportTransition,
  type EntityAnimation,
  type PanelAnimation,
  type StaggerAnimation,
  type AnimationHandle,
  type QueuedAnimation,

  // Helpers
  flyToConfig,
  entityAppearConfig,
  entityDisappearConfig,
  panelExpandConfig,
  panelCollapseConfig,
  listStaggerConfig,
  gridStaggerConfig,
} from './AnimationOrchestrator'

// Layout Transitions
export {
  // Types
  type TransitionPhase,
  type LayoutTransitionConfig,
  type LayoutPanelRefs,
  type TransitionHandle,

  // Layout Transitions
  executeLayoutTransition,
  getLayoutPanelRefs,
  transitionCommandToFocus,
  transitionFocusToCommand,
  transitionCommandToAnalytics,
  transitionAnalyticsToCommand,
  transitionFocusToAnalytics,
  transitionAnalyticsToFocus,

  // Panel Animations
  animatePanelExpand,
  animatePanelCollapse,
  animateDrawerOpen,
  animateDrawerClose,

  // Result List Animations
  animateResultsEnter,
  animateResultsExit,
  animateResultSelect,

  // Floating Panel Animations
  animateFloatingPanelAppear,
  animateFloatingPanelDisappear,
  animateFloatingPanelMinimize,
  animateFloatingPanelRestore,

  // Entity Selection Animations
  animateEntitySelect,
  animateEntityDeselect,
} from './layoutTransitions'
