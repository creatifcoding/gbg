/**
 * Animation Library v2 - Effect-Atom Integration
 *
 * Properly integrates with effect-atom's Registry system.
 * Uses XState for lifecycle, GSAP for execution.
 */

import { Atom } from '@effect-atom/atom-react'
import { createActor } from 'xstate'
import type {
  AnimationValue,
  AnimationState,
  AnimationOptions,
  AnimateToOptions,
  AnimationDriver,
} from './types'
import { createAnimationMachine } from './machine'
import { gsapDriver } from './drivers/gsap'

// =============================================================================
// DRIVER MANAGEMENT
// =============================================================================

/** Current driver - can be swapped for testing */
let currentDriver: AnimationDriver = gsapDriver

/** Set the animation driver */
export function setDriver(driver: AnimationDriver): void {
  currentDriver = driver
}

/** Get the current driver */
export function getDriver(): AnimationDriver {
  return currentDriver
}

// =============================================================================
// ANIMATION ATOM FACTORY
// =============================================================================

/**
 * Create an animation atom.
 *
 * This creates a set of atoms that track animation state,
 * with an XState machine managing the lifecycle and
 * GSAP (or other driver) executing the animations.
 *
 * @example
 * ```tsx
 * // Create the atom (outside component)
 * const opacityAnimation = createAnimation(1, { duration: 300 })
 *
 * // In component
 * function MyComponent() {
 *   const opacity = useAnimation(opacityAnimation)
 *
 *   return (
 *     <div style={{ opacity: opacity.value }}>
 *       <button onClick={() => opacity.to(0)}>Fade Out</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function createAnimation<T extends AnimationValue>(
  initial: T,
  options: AnimationOptions = {}
): AnimationAtom<T> {
  const { duration = 300, ease = 'power2.out', onTick, onComplete, onCancel } = options

  // Create the XState machine
  const machine = createAnimationMachine(initial, { duration, ease: ease as string })

  // Create the actor (interpreter)
  const actor = createActor(machine)

  // Start the actor
  actor.start()

  // ==========================================================================
  // STATE ATOMS
  // ==========================================================================

  // Main state atom - stores the machine's snapshot
  const snapshotAtom = Atom.make(() => actor.getSnapshot()).pipe(Atom.keepAlive)

  // Subscribe actor to update the atom
  // This is the key integration point - actor updates propagate to React
  let unsubscribe: (() => void) | null = null

  const setupSubscription = (registry: { set: (atom: unknown, value: unknown) => void }) => {
    if (unsubscribe) return

    unsubscribe = actor.subscribe((snapshot) => {
      registry.set(snapshotAtom, snapshot)
    })
  }

  // Derived atoms for individual properties
  const valueAtom = Atom.make((get) => {
    const snapshot = get(snapshotAtom)
    return snapshot.context.current
  })

  const stateAtom = Atom.make((get) => {
    const snapshot = get(snapshotAtom)
    return snapshot.value as AnimationState
  })

  const progressAtom = Atom.make((get) => {
    const snapshot = get(snapshotAtom)
    return snapshot.context.progress
  })

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  /** Animate to a new value */
  function to(target: T, opts?: AnimateToOptions): void {
    const snapshot = actor.getSnapshot()

    // If already at target, no-op
    if (snapshot.context.current === target && snapshot.value === 'idle') {
      return
    }

    // Cancel any existing animation
    snapshot.context.cancel?.()

    // Start the animation via driver
    const cancel = currentDriver.run({
      from: snapshot.context.current,
      to: target,
      duration: opts?.duration ?? snapshot.context.duration,
      ease: opts?.ease ?? snapshot.context.ease,
      onTick: (value, progress) => {
        actor.send({ type: 'TICK', value, progress })
        onTick?.(value, progress)
      },
      onComplete: () => {
        actor.send({ type: 'COMPLETE' })
        onComplete?.()
      },
    })

    // Send START event with cancel function attached
    actor.send({ type: 'START', to: target, ...opts })

    // Store cancel function in context (hacky but necessary)
    const currentSnapshot = actor.getSnapshot()
    ;(currentSnapshot.context as { cancel: (() => void) | null }).cancel = cancel
  }

  /** Snap immediately to a value */
  function snap(value: T): void {
    const snapshot = actor.getSnapshot()
    snapshot.context.cancel?.()
    actor.send({ type: 'SNAP', value })
  }

  /** Pause the animation */
  function pause(): void {
    actor.send({ type: 'PAUSE' })
  }

  /** Resume the animation */
  function resume(): void {
    const snapshot = actor.getSnapshot()
    if (snapshot.value !== 'paused') return

    // Resume from current position
    const remaining = (1 - snapshot.context.progress) * snapshot.context.duration

    const cancel = currentDriver.run({
      from: snapshot.context.current,
      to: snapshot.context.target,
      duration: remaining,
      ease: snapshot.context.ease,
      onTick: (value, progress) => {
        // Adjust progress to account for where we paused
        const totalProgress = snapshot.context.progress + progress * (1 - snapshot.context.progress)
        actor.send({ type: 'TICK', value, progress: totalProgress })
        onTick?.(value, totalProgress)
      },
      onComplete: () => {
        actor.send({ type: 'COMPLETE' })
        onComplete?.()
      },
    })

    actor.send({ type: 'RESUME' })
    ;(actor.getSnapshot().context as { cancel: (() => void) | null }).cancel = cancel
  }

  /** Cancel the animation */
  function cancelAnimation(): void {
    const snapshot = actor.getSnapshot()
    snapshot.context.cancel?.()
    actor.send({ type: 'CANCEL' })
    onCancel?.()
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  /** Stop the actor and clean up */
  function dispose(): void {
    unsubscribe?.()
    actor.stop()
  }

  // ==========================================================================
  // RETURN ANIMATION ATOM
  // ==========================================================================

  return {
    // Atoms for reading
    value$: valueAtom,
    state$: stateAtom,
    progress$: progressAtom,
    snapshot$: snapshotAtom,

    // Actions
    to,
    snap,
    pause,
    resume,
    cancel: cancelAnimation,

    // Lifecycle
    dispose,
    _setupSubscription: setupSubscription,
    _actor: actor,
  }
}

// =============================================================================
// TYPES
// =============================================================================

/** The animation atom interface */
export interface AnimationAtom<T extends AnimationValue> {
  // Read atoms
  readonly value$: Atom.Atom<T>
  readonly state$: Atom.Atom<AnimationState>
  readonly progress$: Atom.Atom<number>
  readonly snapshot$: Atom.Atom<unknown>

  // Actions
  readonly to: (target: T, options?: AnimateToOptions) => void
  readonly snap: (value: T) => void
  readonly pause: () => void
  readonly resume: () => void
  readonly cancel: () => void

  // Lifecycle
  readonly dispose: () => void
  readonly _setupSubscription: (registry: { set: (atom: unknown, value: unknown) => void }) => void
  readonly _actor: unknown
}

// =============================================================================
// EXPORTS
// =============================================================================

export { gsapDriver } from './drivers/gsap'
