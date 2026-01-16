/**
 * @fileoverview Effect-native React hooks for json-render
 *
 * Provides:
 * - useUIStream: Stream JSON patches → reactive UITree
 * - useAction: Execute actions with confirmation support
 * - useActions: Register action handlers
 * - useConfirmation: Handle confirmation dialogs
 * - useVisibility: Evaluate visibility conditions
 * - useData: Access/mutate data model
 *
 * Pattern: useAtomValue for reads, registry.set for writes
 */

"use client"

import { useCallback, useEffect, useContext, useMemo } from "react"
import { useAtomValue, RegistryContext } from "@effect-atom/atom-react"
import { Effect, Fiber, Option, Deferred, pipe, Stream } from "effect"
import type { RuntimeFiber } from "effect/Fiber"

import {
  treeAtom,
  isStreamingAtom,
  errorAtom,
  dataModelAtom,
  authStateAtom,
  streamFiberAtom,
  visibilityContextAtom,
  actionHandlersAtom,
  loadingActionsAtom,
  pendingConfirmationAtom,
  type PendingConfirmation
} from "./atoms"

import { Action, UITree } from "../core/schemas"
import type { DataModel, AuthState, VisibilityCondition } from "../core/schemas"
import { evaluateVisibilitySync } from "../core/visibility"
import { streamFromFetchProgressive, processPatches } from "../core/streaming"
import { resolveAction, type ActionHandler, ResolvedAction } from "../core/actions"

// =============================================================================
// useUIStream - Stream-based UI rendering
// =============================================================================

export interface UseUIStreamOptions {
  /** API endpoint for streaming */
  api: string
  /** Callback when stream completes */
  onComplete?: (tree: UITree) => void
  /** Callback on error */
  onError?: (error: Error) => void
}

export interface UseUIStreamReturn {
  /** Current UI tree */
  tree: UITree
  /** Whether currently streaming */
  isStreaming: boolean
  /** Error if any */
  error: Option.Option<Error>
  /** Send a prompt to generate UI */
  send: (prompt: string, context?: Record<string, unknown>) => void
  /** Clear the current tree */
  clear: () => void
  /** Cancel current stream */
  cancel: () => void
}

/**
 * Hook for streaming UI generation
 *
 * Effect-native alternative to original useUIStream:
 * - Uses Atom for reactive state (not useState)
 * - Uses Fiber.interrupt for cancellation (not AbortController)
 * - Uses Effect.Stream for processing (not manual buffer)
 */
export function useUIStream({
  api,
  onComplete,
  onError
}: UseUIStreamOptions): UseUIStreamReturn {
  const registry = useContext(RegistryContext)

  // Read reactive state via atoms
  const tree = useAtomValue(treeAtom)
  const isStreaming = useAtomValue(isStreamingAtom)
  const error = useAtomValue(errorAtom)

  /**
   * Send a prompt and stream UI updates
   *
   * Uses Queue-based progressive streaming (Stream.fromQueue) which processes
   * items immediately as they arrive, unlike Stream.asyncPush which buffers.
   */
  const send = useCallback(
    (prompt: string, context?: Record<string, unknown>) => {
      // Cancel any existing stream
      const existingFiber = registry.get(streamFiberAtom) as Option.Option<RuntimeFiber<void, Error>>
      if (Option.isSome(existingFiber)) {
        Effect.runFork(Fiber.interrupt(existingFiber.value))
      }

      // Reset state
      registry.set(treeAtom, UITree.empty())
      registry.set(isStreamingAtom, true)
      registry.set(errorAtom, Option.none())

      // Create AbortController for fetch cancellation
      const abortController = new AbortController()

      // Create the stream processing effect
      const streamEffect = Effect.gen(function* () {
        // Get progressive stream (this also starts the producer fiber)
        // Uses Queue.fromQueue internally for true progressive processing
        const patchStream = yield* streamFromFetchProgressive(
          api,
          { prompt, context, currentTree: UITree.empty() },
          abortController.signal
        )

        // Process patches and update atom on each tree update
        // Items are processed immediately as they arrive from the queue!
        yield* pipe(
          processPatches(patchStream),
          Stream.runForEach((newTree) =>
            Effect.gen(function* () {
              yield* Effect.log(`[useUIStream] updating tree, elements: ${Object.keys(newTree.elements).length}`)
              registry.set(treeAtom, newTree)
              yield* Effect.yieldNow()  // Yield to allow React to re-render
            })
          )
        )

        // Get final tree for callback
        const finalTree = registry.get(treeAtom) as UITree
        onComplete?.(finalTree)
      }).pipe(
        Effect.catchAll((err) =>
          Effect.sync(() => {
            const e = err instanceof Error ? err : new Error(String(err))
            registry.set(errorAtom, Option.some(e))
            onError?.(e)
          })
        ),
        Effect.ensuring(
          Effect.sync(() => {
            registry.set(isStreamingAtom, false)
            registry.set(streamFiberAtom, Option.none())
          })
        )
      )

      // Fork the stream processing
      const fiber = Effect.runFork(streamEffect) as RuntimeFiber<void, Error>
      registry.set(streamFiberAtom, Option.some(fiber))
    },
    [api, onComplete, onError, registry]
  )

  /**
   * Clear the current tree
   */
  const clear = useCallback(() => {
    const existingFiber = registry.get(streamFiberAtom) as Option.Option<RuntimeFiber<void, Error>>
    if (Option.isSome(existingFiber)) {
      Effect.runFork(Fiber.interrupt(existingFiber.value))
    }

    registry.set(treeAtom, UITree.empty())
    registry.set(errorAtom, Option.none())
    registry.set(streamFiberAtom, Option.none())
  }, [registry])

  /**
   * Cancel current stream
   */
  const cancel = useCallback(() => {
    const existingFiber = registry.get(streamFiberAtom) as Option.Option<RuntimeFiber<void, Error>>
    if (Option.isSome(existingFiber)) {
      Effect.runFork(Fiber.interrupt(existingFiber.value))
    }
    registry.set(isStreamingAtom, false)
    registry.set(streamFiberAtom, Option.none())
  }, [registry])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const existingFiber = registry.get(streamFiberAtom) as Option.Option<RuntimeFiber<void, Error>>
      if (Option.isSome(existingFiber)) {
        Effect.runFork(Fiber.interrupt(existingFiber.value))
      }
    }
  }, [registry])

  return {
    tree,
    isStreaming,
    error,
    send,
    clear,
    cancel
  }
}

// =============================================================================
// useVisibility - Visibility evaluation
// =============================================================================

/**
 * Hook to check if a visibility condition is met
 */
export function useIsVisible(condition: VisibilityCondition | undefined): boolean {
  const ctx = useAtomValue(visibilityContextAtom)
  return evaluateVisibilitySync(condition, ctx)
}

/**
 * Hook to get visibility evaluation function
 */
export function useVisibility() {
  const ctx = useAtomValue(visibilityContextAtom)

  const isVisible = useCallback(
    (condition: VisibilityCondition | undefined) =>
      evaluateVisibilitySync(condition, ctx),
    [ctx]
  )

  return { isVisible, ctx }
}

// =============================================================================
// useData - Data model access
// =============================================================================

export interface UseDataReturn {
  /** Current data model */
  data: DataModel
  /** Auth state */
  authState: AuthState
  /** Set data model value */
  set: (path: string, value: unknown) => void
  /** Set entire data model */
  setData: (data: DataModel) => void
  /** Set auth state */
  setAuthState: (authState: AuthState) => void
}

/**
 * Hook to access data model
 */
export function useData(): UseDataReturn {
  const registry = useContext(RegistryContext)
  const data = useAtomValue(dataModelAtom)
  const authState = useAtomValue(authStateAtom)

  const set = useCallback(
    (path: string, value: unknown) => {
      const current = registry.get(dataModelAtom) as DataModel
      const segments = path.startsWith("/") ? path.slice(1).split("/") : path.split("/")
      const key = segments[0]
      if (key) {
        registry.set(dataModelAtom, { ...current, [key]: value })
      }
    },
    [registry]
  )

  const setData = useCallback(
    (newData: DataModel) => {
      registry.set(dataModelAtom, newData)
    },
    [registry]
  )

  const setAuthState = useCallback(
    (newAuthState: AuthState) => {
      registry.set(authStateAtom, newAuthState)
    },
    [registry]
  )

  return { data, authState, set, setData, setAuthState }
}

// =============================================================================
// useActions - Register action handlers
// =============================================================================

export interface UseActionsReturn {
  /** Register a single action handler */
  register: (name: string, handler: ActionHandler) => void
  /** Register multiple action handlers */
  registerAll: (handlers: Record<string, ActionHandler>) => void
  /** Unregister an action handler */
  unregister: (name: string) => void
  /** Get registered handlers */
  handlers: Record<string, ActionHandler>
}

/**
 * Hook to register action handlers
 */
export function useActions(): UseActionsReturn {
  const registry = useContext(RegistryContext)
  const handlers = useAtomValue(actionHandlersAtom)

  const register = useCallback(
    (name: string, handler: ActionHandler) => {
      const current = registry.get(actionHandlersAtom) as Record<string, ActionHandler>
      registry.set(actionHandlersAtom, { ...current, [name]: handler })
    },
    [registry]
  )

  const registerAll = useCallback(
    (newHandlers: Record<string, ActionHandler>) => {
      const current = registry.get(actionHandlersAtom) as Record<string, ActionHandler>
      registry.set(actionHandlersAtom, { ...current, ...newHandlers })
    },
    [registry]
  )

  const unregister = useCallback(
    (name: string) => {
      const current = registry.get(actionHandlersAtom) as Record<string, ActionHandler>
      const { [name]: _, ...rest } = current
      registry.set(actionHandlersAtom, rest)
    },
    [registry]
  )

  return { register, registerAll, unregister, handlers }
}

// =============================================================================
// useAction - Execute actions with Effect
// =============================================================================

export interface UseActionReturn {
  /** Execute an action */
  execute: (action: Action) => void
  /** Check if an action is loading */
  isLoading: (name: string) => boolean
  /** All loading action names */
  loadingActions: Set<string>
}

/**
 * Hook to execute actions
 *
 * Uses Fiber for cancellation and Deferred for confirmation dialogs.
 */
export function useAction(): UseActionReturn {
  const registry = useContext(RegistryContext)
  const data = useAtomValue(dataModelAtom)
  const loadingActions = useAtomValue(loadingActionsAtom)

  const execute = useCallback(
    (action: Action) => {
      // Create the execution effect
      const executeEffect = Effect.gen(function* () {
        // Resolve dynamic values
        const resolved = yield* resolveAction(action, data)

        // Get handler
        const handlers = registry.get(actionHandlersAtom) as Record<string, ActionHandler>
        const handler = handlers[resolved.name]
        if (!handler) {
          console.warn(`No handler registered for action: ${resolved.name}`)
          return
        }

        // Handle confirmation if needed
        if (resolved.confirm) {
          const deferred = yield* Deferred.make<boolean>()
          const confirmation: PendingConfirmation = {
            action: resolved,
            handler,
            deferred
          }
          registry.set(pendingConfirmationAtom, Option.some(confirmation))

          // Wait for user response
          const confirmed = yield* Deferred.await(deferred)
          registry.set(pendingConfirmationAtom, Option.none())

          if (!confirmed) {
            return // User cancelled
          }
        }

        // Mark as loading
        const currentLoading = registry.get(loadingActionsAtom) as Set<string>
        registry.set(loadingActionsAtom, new Set([...currentLoading, resolved.name]))

        try {
          // Execute handler
          yield* handler(resolved.params)
        } finally {
          // Unmark loading
          const afterLoading = registry.get(loadingActionsAtom) as Set<string>
          const newLoading = new Set(afterLoading)
          newLoading.delete(resolved.name)
          registry.set(loadingActionsAtom, newLoading)
        }
      })

      // Fork and fire
      Effect.runFork(executeEffect)
    },
    [registry, data]
  )

  const isLoading = useCallback(
    (name: string) => loadingActions.has(name),
    [loadingActions]
  )

  return { execute, isLoading, loadingActions }
}

// =============================================================================
// useConfirmation - Handle confirmation dialogs
// =============================================================================

export interface UseConfirmationReturn {
  /** Whether there's a pending confirmation */
  isPending: boolean
  /** The pending action (if any) */
  pendingAction: Option.Option<ResolvedAction>
  /** Confirm the pending action */
  confirm: () => void
  /** Cancel the pending action */
  cancel: () => void
}

/**
 * Hook to handle confirmation dialogs
 *
 * Uses Deferred for suspension until user confirms/cancels.
 */
export function useConfirmation(): UseConfirmationReturn {
  const pending = useAtomValue(pendingConfirmationAtom)

  const isPending = Option.isSome(pending)
  const pendingAction = useMemo(
    () => Option.map(pending, (p) => p.action),
    [pending]
  )

  const confirm = useCallback(() => {
    if (Option.isSome(pending)) {
      Effect.runFork(Deferred.succeed(pending.value.deferred, true))
    }
  }, [pending])

  const cancel = useCallback(() => {
    if (Option.isSome(pending)) {
      Effect.runFork(Deferred.succeed(pending.value.deferred, false))
    }
  }, [pending])

  return { isPending, pendingAction, confirm, cancel }
}
