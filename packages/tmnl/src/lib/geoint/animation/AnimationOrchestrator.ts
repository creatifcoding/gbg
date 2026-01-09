/**
 * GEOINT Animation Orchestrator
 *
 * Effect-based service for coordinating animations across the GEOINT dashboard.
 * Integrates with the existing animation system, deck.gl transitions, and GEOINT tokens.
 *
 * Key responsibilities:
 * - Map viewport animations (fly-to, zoom transitions)
 * - Entity lifecycle animations (appear, update, disappear)
 * - Panel transitions (expand, collapse, slide)
 * - Search result stagger animations
 * - Selection feedback animations
 *
 * @module geoint/animation/AnimationOrchestrator
 */

import { Effect, Context, Layer, Ref } from 'effect'
import { animate, type AnimationParams } from 'animejs'
import { gsap } from 'gsap'
import { TIMING, EASING, ANIMATIONS } from '../tokens'
import type { ViewportState } from '../atoms'

/**
 * Deep clone animation preset to convert readonly arrays to mutable.
 * anime.js requires mutable arrays for keyframe values.
 */
const toMutablePreset = <T extends Record<string, unknown>>(preset: T): AnimationParams => {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(preset)) {
    if (Array.isArray(value)) {
      result[key] = [...value]
    } else if (value && typeof value === 'object' && !('then' in value)) {
      result[key] = toMutablePreset(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result as AnimationParams
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Viewport transition configuration for map animations.
 */
export interface ViewportTransition {
  readonly target: Partial<ViewportState>
  readonly duration: number
  readonly easing: string
  readonly curve?: 'flyTo' | 'linear' | 'ease'
}

/**
 * Entity animation configuration.
 */
export interface EntityAnimation {
  readonly entityId: string
  readonly type: 'appear' | 'update' | 'disappear' | 'highlight' | 'select'
  readonly element?: HTMLElement | null
  readonly properties?: Record<string, unknown>
}

/**
 * Panel animation configuration.
 */
export interface PanelAnimation {
  readonly panelId: string
  readonly type: 'expand' | 'collapse' | 'slide' | 'fade'
  readonly element: HTMLElement
  readonly targetState?: 'default' | 'expanded' | 'collapsed'
}

/**
 * Stagger animation configuration for lists/grids.
 */
export interface StaggerAnimation {
  readonly elements: HTMLElement[] | NodeListOf<Element>
  readonly type: 'list' | 'grid' | 'radial'
  readonly preset: keyof typeof ANIMATIONS
  readonly staggerMs?: number
}

/**
 * Animation result with cleanup function.
 */
export interface AnimationHandle {
  readonly id: string
  readonly cancel: () => void
  readonly promise: Promise<void>
}

/**
 * Animation queue entry.
 */
export interface QueuedAnimation {
  readonly id: string
  readonly type: 'viewport' | 'entity' | 'panel' | 'stagger'
  readonly config: ViewportTransition | EntityAnimation | PanelAnimation | StaggerAnimation
  readonly priority: number
}

// =============================================================================
// SERVICE DEFINITION
// =============================================================================

/**
 * AnimationOrchestrator service interface.
 */
export interface AnimationOrchestrator {
  /**
   * Animate map viewport with smooth transition.
   */
  readonly animateViewport: (
    transition: ViewportTransition,
    onUpdate: (state: Partial<ViewportState>) => void
  ) => Effect.Effect<void, AnimationError>

  /**
   * Animate entity lifecycle (appear, update, disappear).
   */
  readonly animateEntity: (
    config: EntityAnimation
  ) => Effect.Effect<AnimationHandle, AnimationError>

  /**
   * Animate panel transition.
   */
  readonly animatePanel: (
    config: PanelAnimation
  ) => Effect.Effect<AnimationHandle, AnimationError>

  /**
   * Animate list/grid elements with stagger.
   */
  readonly animateStagger: (
    config: StaggerAnimation
  ) => Effect.Effect<AnimationHandle, AnimationError>

  /**
   * Queue an animation for sequential execution.
   */
  readonly queueAnimation: (
    animation: QueuedAnimation
  ) => Effect.Effect<void, AnimationError>

  /**
   * Cancel all running animations.
   */
  readonly cancelAll: () => Effect.Effect<void>

  /**
   * Get count of active animations.
   */
  readonly getActiveCount: () => Effect.Effect<number>
}

// =============================================================================
// ERROR TYPE
// =============================================================================

export class AnimationError {
  readonly _tag = 'AnimationError'
  constructor(
    readonly message: string,
    readonly cause?: unknown
  ) {}
}

// =============================================================================
// SERVICE TAG
// =============================================================================

export class AnimationOrchestratorTag extends Context.Tag('geoint/AnimationOrchestrator')<
  AnimationOrchestratorTag,
  AnimationOrchestrator
>() {}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Internal state for tracking animations.
 */
interface OrchestratorState {
  readonly activeAnimations: Map<string, AnimationHandle>
  readonly animationQueue: QueuedAnimation[]
  nextId: number
}

/**
 * Create the AnimationOrchestrator service implementation.
 */
const makeAnimationOrchestrator = Effect.gen(function* () {
  // Initialize state
  const stateRef = yield* Ref.make<OrchestratorState>({
    activeAnimations: new Map(),
    animationQueue: [],
    nextId: 1,
  })

  // Generate unique animation ID
  const generateId = Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    yield* Ref.set(stateRef, { ...state, nextId: state.nextId + 1 })
    return `anim-${state.nextId}`
  })

  // Register active animation
  const registerAnimation = (handle: AnimationHandle) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      state.activeAnimations.set(handle.id, handle)
    })

  // Unregister animation on completion
  const unregisterAnimation = (id: string) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      state.activeAnimations.delete(id)
    })

  // ─── Viewport Animation ──────────────────────────────────────────────────────

  const animateViewport: AnimationOrchestrator['animateViewport'] = (
    transition,
    onUpdate
  ) =>
    Effect.async<void, AnimationError>((resume) => {
      try {
        // Use GSAP for precise viewport interpolation
        const dummy = { progress: 0 }

        const tween = gsap.to(dummy, {
          progress: 1,
          duration: transition.duration / 1000, // GSAP uses seconds
          ease: transition.easing === 'cubic-bezier(0.33, 1, 0.68, 1)'
            ? 'power2.out'
            : transition.easing,
          onUpdate: () => {
            // Interpolate viewport properties - spread target to get mutable object
            const interpolated: Partial<ViewportState> = { ...transition.target }
            onUpdate(interpolated)
          },
          onComplete: () => resume(Effect.succeed(undefined)),
        })

        // Return cancellation effect
        return Effect.sync(() => tween.kill())
      } catch (error) {
        resume(Effect.fail(new AnimationError('Viewport animation failed', error)))
        return Effect.void
      }
    })

  // ─── Entity Animation ────────────────────────────────────────────────────────

  const animateEntity: AnimationOrchestrator['animateEntity'] = (config) =>
    Effect.gen(function* () {
      const id = yield* generateId

      if (!config.element) {
        // No element - just track state
        const handle: AnimationHandle = {
          id,
          cancel: () => {},
          promise: Promise.resolve(),
        }
        return handle
      }

      const preset = (() => {
        switch (config.type) {
          case 'appear':
            return ANIMATIONS.entityAppear
          case 'disappear':
            return ANIMATIONS.scaleOut
          case 'highlight':
            return ANIMATIONS.highlight
          case 'select':
            return ANIMATIONS.selectionRing
          case 'update':
            return ANIMATIONS.entityMove
        }
      })()

      let cancelled = false
      const promise = new Promise<void>((resolve, reject) => {
        try {
          const animation = animate(config.element!, {
            ...toMutablePreset(preset),
            ...config.properties,
            onComplete: () => {
              if (!cancelled) resolve()
            },
          })

          // Handle cancellation
          if (cancelled) {
            animation.pause()
            resolve()
          }
        } catch (error) {
          reject(error)
        }
      })

      const handle: AnimationHandle = {
        id,
        cancel: () => {
          cancelled = true
        },
        promise,
      }

      yield* registerAnimation(handle)

      // Auto-cleanup on completion
      promise.finally(() => {
        Effect.runSync(unregisterAnimation(id))
      })

      return handle
    })

  // ─── Panel Animation ─────────────────────────────────────────────────────────

  const animatePanel: AnimationOrchestrator['animatePanel'] = (config) =>
    Effect.gen(function* () {
      const id = yield* generateId

      const preset = (() => {
        switch (config.type) {
          case 'expand':
            return ANIMATIONS.panelExpand
          case 'collapse':
            return ANIMATIONS.panelCollapse
          case 'slide':
            return ANIMATIONS.slideInRight
          case 'fade':
            return ANIMATIONS.fadeIn
        }
      })()

      let cancelled = false
      const promise = new Promise<void>((resolve, reject) => {
        try {
          const animation = animate(config.element, {
            ...toMutablePreset(preset),
            onComplete: () => {
              if (!cancelled) resolve()
            },
          })

          if (cancelled) {
            animation.pause()
            resolve()
          }
        } catch (error) {
          reject(error)
        }
      })

      const handle: AnimationHandle = {
        id,
        cancel: () => {
          cancelled = true
        },
        promise,
      }

      yield* registerAnimation(handle)

      promise.finally(() => {
        Effect.runSync(unregisterAnimation(id))
      })

      return handle
    })

  // ─── Stagger Animation ───────────────────────────────────────────────────────

  const animateStagger: AnimationOrchestrator['animateStagger'] = (config) =>
    Effect.gen(function* () {
      const id = yield* generateId
      const elements = Array.from(config.elements)

      if (elements.length === 0) {
        return {
          id,
          cancel: () => {},
          promise: Promise.resolve(),
        }
      }

      const basePreset = ANIMATIONS[config.preset]
      const staggerMs = config.staggerMs ?? TIMING.stagger

      // Calculate stagger delay based on type
      const getDelay = (i: number, total: number) => {
        switch (config.type) {
          case 'list':
            return i * staggerMs
          case 'grid': {
            const cols = Math.ceil(Math.sqrt(total))
            const row = Math.floor(i / cols)
            const col = i % cols
            return (row + col) * staggerMs
          }
          case 'radial': {
            // Radial pattern from center
            const center = Math.floor(total / 2)
            const distance = Math.abs(i - center)
            return distance * staggerMs
          }
        }
      }

      let cancelled = false
      const animations: ReturnType<typeof animate>[] = []

      const promise = new Promise<void>((resolve) => {
        let completed = 0

        elements.forEach((el, i) => {
          const delay = getDelay(i, elements.length)

          setTimeout(() => {
            if (cancelled) {
              completed++
              if (completed === elements.length) resolve()
              return
            }

            const anim = animate(el as HTMLElement, {
              ...toMutablePreset(basePreset),
              onComplete: () => {
                completed++
                if (completed === elements.length) resolve()
              },
            })
            animations.push(anim)
          }, delay)
        })
      })

      const handle: AnimationHandle = {
        id,
        cancel: () => {
          cancelled = true
          animations.forEach((a) => a.pause())
        },
        promise,
      }

      yield* registerAnimation(handle)

      promise.finally(() => {
        Effect.runSync(unregisterAnimation(id))
      })

      return handle
    })

  // ─── Queue Management ────────────────────────────────────────────────────────

  const queueAnimation: AnimationOrchestrator['queueAnimation'] = (animation) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const queue = [...state.animationQueue, animation]
      // Sort by priority (higher first)
      queue.sort((a, b) => b.priority - a.priority)
      yield* Ref.set(stateRef, { ...state, animationQueue: queue })
    })

  // ─── Cancel All ──────────────────────────────────────────────────────────────

  const cancelAll: AnimationOrchestrator['cancelAll'] = () =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      for (const [, handle] of state.activeAnimations) {
        handle.cancel()
      }
      state.activeAnimations.clear()
      yield* Ref.set(stateRef, { ...state, animationQueue: [] })
    })

  // ─── Get Active Count ────────────────────────────────────────────────────────

  const getActiveCount: AnimationOrchestrator['getActiveCount'] = () =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return state.activeAnimations.size
    })

  // Return service implementation
  return {
    animateViewport,
    animateEntity,
    animatePanel,
    animateStagger,
    queueAnimation,
    cancelAll,
    getActiveCount,
  } satisfies AnimationOrchestrator
})

// =============================================================================
// LAYER
// =============================================================================

/**
 * Live layer for AnimationOrchestrator service.
 */
export const AnimationOrchestratorLive = Layer.effect(
  AnimationOrchestratorTag,
  makeAnimationOrchestrator
)

// =============================================================================
// CONVENIENCE HELPERS
// =============================================================================

/**
 * Create a fly-to animation config with sensible defaults.
 */
export const flyToConfig = (
  longitude: number,
  latitude: number,
  zoom?: number,
  options?: Partial<Omit<ViewportTransition, 'target'>>
): ViewportTransition => ({
  target: {
    longitude,
    latitude,
    ...(zoom !== undefined && { zoom }),
  },
  duration: options?.duration ?? TIMING.slow,
  easing: options?.easing ?? EASING.out,
  curve: options?.curve ?? 'flyTo',
})

/**
 * Create entity appear animation config.
 */
export const entityAppearConfig = (
  entityId: string,
  element?: HTMLElement | null
): EntityAnimation => ({
  entityId,
  type: 'appear',
  element,
})

/**
 * Create entity disappear animation config.
 */
export const entityDisappearConfig = (
  entityId: string,
  element?: HTMLElement | null
): EntityAnimation => ({
  entityId,
  type: 'disappear',
  element,
})

/**
 * Create panel expand animation config.
 */
export const panelExpandConfig = (
  panelId: string,
  element: HTMLElement
): PanelAnimation => ({
  panelId,
  type: 'expand',
  element,
  targetState: 'expanded',
})

/**
 * Create panel collapse animation config.
 */
export const panelCollapseConfig = (
  panelId: string,
  element: HTMLElement
): PanelAnimation => ({
  panelId,
  type: 'collapse',
  element,
  targetState: 'collapsed',
})

/**
 * Create list stagger animation config.
 */
export const listStaggerConfig = (
  elements: HTMLElement[] | NodeListOf<Element>,
  preset: keyof typeof ANIMATIONS = 'slideInUp'
): StaggerAnimation => ({
  elements,
  type: 'list',
  preset,
  staggerMs: TIMING.stagger,
})

/**
 * Create grid stagger animation config.
 */
export const gridStaggerConfig = (
  elements: HTMLElement[] | NodeListOf<Element>,
  preset: keyof typeof ANIMATIONS = 'scaleIn'
): StaggerAnimation => ({
  elements,
  type: 'grid',
  preset,
  staggerMs: TIMING.stagger,
})
