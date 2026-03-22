/**
 * Modifier Keys Stream
 *
 * Effect Stream-based tracking of modifier key state with backpressure.
 * Exposes state via effect-atom for React consumption.
 *
 * @module
 */

import { Effect, Stream, Queue, Fiber, Scope } from "effect"
import { Atom } from "@effect-atom/atom"

// =============================================================================
// Types
// =============================================================================

export interface ModifierState {
  readonly alt: boolean
  readonly shift: boolean
  readonly ctrl: boolean
  readonly meta: boolean
}

const INITIAL_STATE: ModifierState = {
  alt: false,
  shift: false,
  ctrl: false,
  meta: false,
}

// =============================================================================
// Atoms
// =============================================================================

/** Current modifier key state */
export const modifierState$ = Atom.make<ModifierState>(INITIAL_STATE)

/** Convenience selector for Alt key */
export const altPressed$ = Atom.make((get) => get(modifierState$).alt)

// =============================================================================
// Stream Setup
// =============================================================================

type KeyEvent = { type: "down" | "up"; event: KeyboardEvent }

/**
 * Create a bounded queue for keyboard events with backpressure.
 * Dropping strategy prevents memory buildup if consumer is slow.
 */
const createKeyEventQueue = Effect.gen(function* () {
  return yield* Queue.dropping<KeyEvent>(16)
})

/**
 * Stream keyboard events into the queue.
 * Uses Effect.async for proper resource management.
 */
const subscribeToKeyEvents = (queue: Queue.Queue<KeyEvent>) =>
  Effect.async<never, never, never>((resume) => {
    const onKeyDown = (e: KeyboardEvent) => {
      Effect.runSync(Queue.offer(queue, { type: "down", event: e }))
    }
    const onKeyUp = (e: KeyboardEvent) => {
      Effect.runSync(Queue.offer(queue, { type: "up", event: e }))
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)

    // Cleanup on fiber interruption
    return Effect.sync(() => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    })
  })

/**
 * Process keyboard events and update modifier state atom.
 */
const processKeyEvents = (queue: Queue.Queue<KeyEvent>) =>
  Stream.fromQueue(queue).pipe(
    Stream.tap((keyEvent) =>
      Effect.sync(() => {
        const e = keyEvent.event
        Atom.set(modifierState$, {
          alt: e.altKey,
          shift: e.shiftKey,
          ctrl: e.ctrlKey,
          meta: e.metaKey,
        })
      })
    ),
    Stream.runDrain
  )

// =============================================================================
// Lifecycle
// =============================================================================

let runningFiber: Fiber.RuntimeFiber<never, never> | null = null

/**
 * Start the modifier key tracking stream.
 * Idempotent - safe to call multiple times.
 */
export const startModifierTracking = Effect.gen(function* () {
  if (runningFiber) return // Already running

  const queue = yield* createKeyEventQueue

  // Fork the event subscription (runs forever until interrupted)
  const subFiber = yield* Effect.fork(subscribeToKeyEvents(queue))

  // Fork the event processor
  const procFiber = yield* Effect.fork(processKeyEvents(queue))

  // Combine fibers for unified interruption
  runningFiber = yield* Effect.fork(
    Effect.all([Fiber.join(subFiber), Fiber.join(procFiber)], {
      concurrency: 2,
    })
  )
})

/**
 * Stop the modifier key tracking stream.
 */
export const stopModifierTracking = Effect.gen(function* () {
  if (!runningFiber) return

  yield* Fiber.interrupt(runningFiber)
  runningFiber = null
  Atom.set(modifierState$, INITIAL_STATE)
})

/**
 * Run the tracking stream. Call once at app init.
 */
export const runModifierTracking = () => {
  Effect.runFork(startModifierTracking)
}
