/**
 * Animation Library v2 - XState Machine
 *
 * State machine for animation lifecycle management.
 * Handles state transitions, guards, and side effects.
 */

import { createMachine, assign, type MachineConfig } from 'xstate'
import type { AnimationValue, AnimationContext, AnimationEvent } from './types'

// =============================================================================
// MACHINE CONTEXT FACTORY
// =============================================================================

/** Create initial context for a given value type */
export function createInitialContext<T extends AnimationValue>(
  initial: T,
  duration: number = 300,
  ease: string = 'power2.out'
): AnimationContext<T> {
  return {
    current: initial,
    target: initial,
    from: initial,
    progress: 1,
    duration,
    ease,
    startTime: null,
    cancel: null,
  }
}

// =============================================================================
// MACHINE DEFINITION
// =============================================================================

/**
 * Animation state machine.
 *
 * States:
 * - idle: No animation running, value is stable
 * - running: Animation in progress, receiving TICK events
 * - paused: Animation paused, can resume or cancel
 * - completed: Animation finished, can start new animation
 *
 * Events:
 * - START: Begin animating to a new target
 * - TICK: Update current value (from animation driver)
 * - PAUSE: Pause the current animation
 * - RESUME: Resume a paused animation
 * - COMPLETE: Animation finished naturally
 * - CANCEL: Stop animation and reset
 * - SNAP: Immediately set value without animation
 */
export function createAnimationMachine<T extends AnimationValue>(
  initial: T,
  options: { duration?: number; ease?: string } = {}
) {
  const { duration = 300, ease = 'power2.out' } = options

  return createMachine({
    id: 'animation',
    initial: 'idle',
    context: createInitialContext(initial, duration, ease),

    states: {
      idle: {
        on: {
          START: {
            target: 'running',
            actions: assign(({ context, event }) => ({
              from: context.current,
              target: (event as Extract<AnimationEvent<T>, { type: 'START' }>).to,
              duration: (event as Extract<AnimationEvent<T>, { type: 'START' }>).duration ?? context.duration,
              ease: (event as Extract<AnimationEvent<T>, { type: 'START' }>).ease ?? context.ease,
              progress: 0,
              startTime: performance.now(),
            })),
          },
          SNAP: {
            actions: assign(({ event }) => {
              const snapEvent = event as Extract<AnimationEvent<T>, { type: 'SNAP' }>
              return {
                current: snapEvent.value,
                target: snapEvent.value,
                from: snapEvent.value,
                progress: 1,
              }
            }),
          },
        },
      },

      running: {
        on: {
          TICK: {
            actions: assign(({ event }) => {
              const tickEvent = event as Extract<AnimationEvent<T>, { type: 'TICK' }>
              return {
                current: tickEvent.value,
                progress: tickEvent.progress,
              }
            }),
          },
          PAUSE: {
            target: 'paused',
            actions: assign(({ context }) => {
              // Call cancel to stop the animation driver
              context.cancel?.()
              return { cancel: null }
            }),
          },
          COMPLETE: {
            target: 'completed',
            actions: assign(({ context }) => ({
              current: context.target,
              progress: 1,
              cancel: null,
            })),
          },
          CANCEL: {
            target: 'idle',
            actions: assign(({ context }) => {
              context.cancel?.()
              return {
                target: context.current, // Keep current value
                progress: 1,
                cancel: null,
              }
            }),
          },
          // Allow starting a new animation while one is running
          START: {
            target: 'running',
            actions: assign(({ context, event }) => {
              // Cancel current animation
              context.cancel?.()
              const startEvent = event as Extract<AnimationEvent<T>, { type: 'START' }>
              return {
                from: context.current, // Start from current interpolated position
                target: startEvent.to,
                duration: startEvent.duration ?? context.duration,
                ease: startEvent.ease ?? context.ease,
                progress: 0,
                startTime: performance.now(),
                cancel: null,
              }
            }),
          },
          SNAP: {
            target: 'idle',
            actions: assign(({ context, event }) => {
              context.cancel?.()
              const snapEvent = event as Extract<AnimationEvent<T>, { type: 'SNAP' }>
              return {
                current: snapEvent.value,
                target: snapEvent.value,
                from: snapEvent.value,
                progress: 1,
                cancel: null,
              }
            }),
          },
        },
      },

      paused: {
        on: {
          RESUME: {
            target: 'running',
            actions: assign(() => ({
              startTime: performance.now(),
            })),
          },
          CANCEL: {
            target: 'idle',
            actions: assign(({ context }) => ({
              target: context.current,
              progress: 1,
            })),
          },
          START: {
            target: 'running',
            actions: assign(({ context, event }) => {
              const startEvent = event as Extract<AnimationEvent<T>, { type: 'START' }>
              return {
                from: context.current,
                target: startEvent.to,
                duration: startEvent.duration ?? context.duration,
                ease: startEvent.ease ?? context.ease,
                progress: 0,
                startTime: performance.now(),
              }
            }),
          },
          SNAP: {
            target: 'idle',
            actions: assign(({ event }) => {
              const snapEvent = event as Extract<AnimationEvent<T>, { type: 'SNAP' }>
              return {
                current: snapEvent.value,
                target: snapEvent.value,
                from: snapEvent.value,
                progress: 1,
              }
            }),
          },
        },
      },

      completed: {
        on: {
          START: {
            target: 'running',
            actions: assign(({ context, event }) => {
              const startEvent = event as Extract<AnimationEvent<T>, { type: 'START' }>
              return {
                from: context.current,
                target: startEvent.to,
                duration: startEvent.duration ?? context.duration,
                ease: startEvent.ease ?? context.ease,
                progress: 0,
                startTime: performance.now(),
              }
            }),
          },
          SNAP: {
            target: 'idle',
            actions: assign(({ event }) => {
              const snapEvent = event as Extract<AnimationEvent<T>, { type: 'SNAP' }>
              return {
                current: snapEvent.value,
                target: snapEvent.value,
                from: snapEvent.value,
                progress: 1,
              }
            }),
          },
        },
      },
    },
  })
}

// =============================================================================
// TYPE HELPERS
// =============================================================================

/** Extract the state value from a machine state */
export type AnimationMachineState = 'idle' | 'running' | 'paused' | 'completed'

/** Type for the machine returned by createAnimationMachine */
export type AnimationMachine<T extends AnimationValue> = ReturnType<
  typeof createAnimationMachine<T>
>
