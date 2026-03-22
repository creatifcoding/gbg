/**
 * Idle Detection Service
 *
 * Monitors user activity and triggers lock screen after configurable timeout.
 * Uses Effect for lifecycle management and atoms for reactive state.
 *
 * @module
 */

import { Context, Effect, Layer, Stream, Scope } from "effect"
import { Atom } from "@effect-atom/atom"

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

export interface IdleConfig {
  /** Timeout in milliseconds before triggering idle (default: 5 minutes) */
  readonly timeout: number
  /** Events to monitor for activity */
  readonly events: ReadonlyArray<string>
  /** Debounce time for activity events in ms */
  readonly debounce: number
}

export class IdleConfigTag extends Context.Tag("tmnl/splash/IdleConfig")<
  IdleConfigTag,
  IdleConfig
>() {
  static Default = Layer.succeed(this, {
    timeout: 5 * 60 * 1000, // 5 minutes
    events: ["mousemove", "keydown", "scroll", "touchstart", "click"],
    debounce: 100,
  })

  static Custom = (config: Partial<IdleConfig>) =>
    Layer.succeed(this, {
      timeout: config.timeout ?? 5 * 60 * 1000,
      events: config.events ?? ["mousemove", "keydown", "scroll", "touchstart", "click"],
      debounce: config.debounce ?? 100,
    })

  /** Short timeout for development/testing */
  static Development = Layer.succeed(this, {
    timeout: 30 * 1000, // 30 seconds
    events: ["mousemove", "keydown", "scroll", "touchstart", "click"],
    debounce: 100,
  })
}

// ─────────────────────────────────────────────────────────────
// State Atoms
// ─────────────────────────────────────────────────────────────

export const idleStateAtom = Atom.make<"active" | "idle">("active")
export const lastActivityAtom = Atom.make<number>(Date.now())
export const remainingTimeAtom = Atom.make<number>(0)

/**
 * Force lock atom - set to true by system.lockScreen command
 * LockScreenController watches this and transitions to 'locked' state
 */
export const forceLockAtom = Atom.make<boolean>(false)

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

export interface IdleDetectionServiceShape {
  /** Start monitoring for idle */
  readonly start: () => Effect.Effect<void, never, Scope.Scope>

  /** Stop monitoring */
  readonly stop: () => Effect.Effect<void>

  /** Reset the idle timer (user activity detected) */
  readonly resetTimer: () => Effect.Effect<void>

  /** Force idle state (e.g., manual lock) */
  readonly forceIdle: () => Effect.Effect<void>

  /** Stream of idle events */
  readonly onIdle: Stream.Stream<void>

  /** Stream of active events (user returned from idle) */
  readonly onActive: Stream.Stream<void>

  /** Get current idle state */
  readonly isIdle: () => Effect.Effect<boolean>

  /** Get remaining time until idle (ms) */
  readonly getRemainingTime: () => Effect.Effect<number>
}

// ─────────────────────────────────────────────────────────────
// Service Implementation
// ─────────────────────────────────────────────────────────────

export class IdleDetectionService extends Context.Tag(
  "tmnl/splash/IdleDetectionService"
)<IdleDetectionService, IdleDetectionServiceShape>() {
  static Default = Layer.effect(
    this,
    Effect.gen(function* () {
      const config = yield* IdleConfigTag

      // Internal state
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      let intervalId: ReturnType<typeof setInterval> | null = null
      let lastDebounce = 0

      // Event emitters
      const idleEmitter = {
        listeners: new Set<() => void>(),
        emit: () => idleEmitter.listeners.forEach((l) => l()),
      }
      const activeEmitter = {
        listeners: new Set<() => void>(),
        emit: () => activeEmitter.listeners.forEach((l) => l()),
      }

      // Activity handler
      const handleActivity = () => {
        const now = Date.now()

        // Debounce
        if (now - lastDebounce < config.debounce) return
        lastDebounce = now

        // Update state
        Atom.set(lastActivityAtom, now)
        Atom.set(remainingTimeAtom, config.timeout)

        // If was idle, emit active event
        if (Atom.get(idleStateAtom) === "idle") {
          Atom.set(idleStateAtom, "active")
          activeEmitter.emit()
        }

        // Reset timeout
        if (timeoutId) clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          Atom.set(idleStateAtom, "idle")
          Atom.set(remainingTimeAtom, 0)
          idleEmitter.emit()
        }, config.timeout)
      }

      // Remaining time updater
      const startRemainingTimeUpdater = () => {
        intervalId = setInterval(() => {
          const lastActivity = Atom.get(lastActivityAtom)
          const elapsed = Date.now() - lastActivity
          const remaining = Math.max(0, config.timeout - elapsed)
          Atom.set(remainingTimeAtom, remaining)
        }, 1000)
      }

      const service: IdleDetectionServiceShape = {
        start: () =>
          Effect.acquireRelease(
            Effect.sync(() => {
              // Attach event listeners
              config.events.forEach((event) => {
                window.addEventListener(event, handleActivity, { passive: true })
              })

              // Start timeout
              timeoutId = setTimeout(() => {
                Atom.set(idleStateAtom, "idle")
                idleEmitter.emit()
              }, config.timeout)

              // Start remaining time updater
              startRemainingTimeUpdater()

              Atom.set(lastActivityAtom, Date.now())
              Atom.set(remainingTimeAtom, config.timeout)
            }),
            () =>
              Effect.sync(() => {
                // Cleanup on scope close
                config.events.forEach((event) => {
                  window.removeEventListener(event, handleActivity)
                })
                if (timeoutId) clearTimeout(timeoutId)
                if (intervalId) clearInterval(intervalId)
              })
          ),

        stop: () =>
          Effect.sync(() => {
            config.events.forEach((event) => {
              window.removeEventListener(event, handleActivity)
            })
            if (timeoutId) clearTimeout(timeoutId)
            if (intervalId) clearInterval(intervalId)
            timeoutId = null
            intervalId = null
          }),

        resetTimer: () =>
          Effect.sync(() => {
            handleActivity()
          }),

        forceIdle: () =>
          Effect.sync(() => {
            if (timeoutId) clearTimeout(timeoutId)
            Atom.set(idleStateAtom, "idle")
            Atom.set(remainingTimeAtom, 0)
            idleEmitter.emit()
          }),

        onIdle: Stream.async<void>((emit) => {
          const listener = () => emit.single(undefined)
          idleEmitter.listeners.add(listener)
          return Effect.sync(() => {
            idleEmitter.listeners.delete(listener)
          })
        }),

        onActive: Stream.async<void>((emit) => {
          const listener = () => emit.single(undefined)
          activeEmitter.listeners.add(listener)
          return Effect.sync(() => {
            activeEmitter.listeners.delete(listener)
          })
        }),

        isIdle: () => Effect.sync(() => Atom.get(idleStateAtom) === "idle"),

        getRemainingTime: () => Effect.sync(() => Atom.get(remainingTimeAtom)),
      }

      return service
    })
  ).pipe(Layer.provide(IdleConfigTag.Default))

  /** Development layer with short timeout */
  static Development = Layer.effect(
    this,
    Effect.gen(function* () {
      const config = yield* IdleConfigTag
      // Same implementation, just different config
      // ... (reuse Default implementation logic)
      return yield* IdleDetectionService
    })
  ).pipe(Layer.provide(IdleConfigTag.Development))
}

// ─────────────────────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────────────────────

/**
 * Hook for using idle detection in React components
 *
 * @example
 * ```tsx
 * const { isIdle, remainingTime, resetTimer } = useIdleDetection()
 *
 * useEffect(() => {
 *   if (isIdle) {
 *     showLockScreen()
 *   }
 * }, [isIdle])
 * ```
 */
export const useIdleDetection = () => {
  // This would use useAtomValue from effect-atom
  // Implementation depends on how atoms are wired in the app
  return {
    isIdle: false, // useAtomValue(idleStateAtom) === "idle"
    remainingTime: 0, // useAtomValue(remainingTimeAtom)
    lastActivity: Date.now(), // useAtomValue(lastActivityAtom)
    resetTimer: () => {}, // Effect.runSync(service.resetTimer())
    forceIdle: () => {}, // Effect.runSync(service.forceIdle())
  }
}
