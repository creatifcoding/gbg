/**
 * @fileoverview Effect-native React hooks for genifer
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
  decodeErrorStreamIdsAtom,
  decodeErrorsFamily,
  registerDecodeErrorStreamId,
  getStreamAtoms,
  type StreamAtoms,
  type StreamId,
  type PendingConfirmation
} from "./atoms"

import { Action, UITree } from "../core/schemas"
import type { DataModel, AuthState, VisibilityCondition } from "../core/schemas"
import { evaluateVisibilitySync } from "../core/visibility"
import { streamFromFetchProgressive, processPatches, streamHybrid } from "../core/streaming"
import { resolveAction, type ActionHandler, ResolvedAction } from "../core/actions"
import { TreeWorkerPoolAuto } from "../workers"

// =============================================================================
// useUIStream - Stream-based UI rendering (Atom.family isolated)
// =============================================================================

export interface UseUIStreamOptions {
  /** API endpoint for streaming */
  api: string
  /**
   * Stream isolation key. Every distinct streamId gets its own tree, fiber,
   * error, and streaming-status atoms. Two components with different streamIds
   * never interfere. Defaults to `"ui-stream:http:<api>"`.
   */
  streamId?: StreamId
  /** Callback when stream completes */
  onComplete?: (tree: UITree) => void
  /** Callback on error */
  onError?: (error: Error) => void
  /**
   * Use hybrid mode (Tree Worker for near-zero main thread blocking)
   * @default false
   */
  hybrid?: boolean
  /**
   * Batch size for tree worker (only applies when hybrid=true)
   * @default 10
   */
  batchSize?: number
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
  /** The stream atoms bundle for this instance (for advanced usage) */
  atoms: StreamAtoms
}

/**
 * Hook for streaming UI generation — concurrent-safe via Atom.family.
 *
 * Each call site gets its own isolated state keyed by `streamId`.
 * Two useUIStream instances with different streamIds operate independently:
 * their trees, fibers, errors, and streaming flags never collide.
 *
 * Architecture:
 * - State: Atom.family keyed by streamId (not module-level singletons)
 * - Cancellation: Fiber.interrupt per-stream fiber
 * - Processing: Effect.Stream for backpressure-aware patch processing
 * - Yielding: setTimeout(0) macrotask between tree updates for React 18 batching
 */
export function useUIStream({
  api,
  streamId: explicitStreamId,
  onComplete,
  onError,
  hybrid = false,
  batchSize = 1,
}: UseUIStreamOptions): UseUIStreamReturn {
  const registry = useContext(RegistryContext)
  const streamId = explicitStreamId ?? `ui-stream:http:${api}`

  // Resolve the atom family bundle for this stream — stable across renders
  const atoms = useMemo(() => getStreamAtoms(streamId), [streamId])

  // Read reactive state from family atoms (NOT singletons)
  const tree = useAtomValue(atoms.tree)
  const isStreaming = useAtomValue(atoms.isStreaming)
  const error = useAtomValue(atoms.error)

  /**
   * Interrupt the fiber for THIS stream only. Other streams untouched.
   */
  const interruptFiber = useCallback(() => {
    const existingFiber = registry.get(atoms.fiber) as Option.Option<RuntimeFiber<void, Error>>
    if (Option.isSome(existingFiber)) {
      Effect.runFork(Fiber.interrupt(existingFiber.value))
    }
  }, [registry, atoms.fiber])

  /**
   * Send a prompt and stream UI updates.
   *
   * All state mutations target THIS stream's family atoms.
   */
  const send = useCallback(
    (prompt: string, context?: Record<string, unknown>) => {
      // Cancel any existing stream for THIS streamId
      interruptFiber()

      // Reset THIS stream's state
      registry.set(atoms.tree, UITree.empty())
      registry.set(atoms.isStreaming, true)
      registry.set(atoms.error, Option.none())
      registry.set(atoms.decodeErrors, [])

      // Register decode error stream ID (global, used for aggregation)
      registry.set(decodeErrorStreamIdsAtom, registerDecodeErrorStreamId(
        registry.get(decodeErrorStreamIdsAtom) as Set<string>,
        streamId
      ))

      const abortController = new AbortController()

      const streamEffect = Effect.gen(function* () {
        let treeStream: Stream.Stream<UITree, Error>

        const errorTracking = {
          streamId,
          context: { prompt, transport: "http" as const, api },
          onDecodeError: (decodeError: any) =>
            Effect.sync(() => {
              const current = registry.get(atoms.decodeErrors) as Array<any>
              registry.set(atoms.decodeErrors, [...current, decodeError])
            }),
        }

        if (hybrid) {
          treeStream = yield* streamHybrid(
            api,
            { prompt, context, currentTree: UITree.empty() },
            { batchSize },
            abortController.signal,
            errorTracking,
          )
        } else {
          const patchStream = yield* streamFromFetchProgressive(
            api,
            { prompt, context, currentTree: UITree.empty() },
            abortController.signal,
            errorTracking,
          )
          treeStream = processPatches(patchStream)
        }

        // Update THIS stream's tree atom on each update
        yield* pipe(
          treeStream,
          Stream.runForEach((newTree) =>
            Effect.gen(function* () {
              registry.set(atoms.tree, newTree)
              yield* Effect.promise(() => new Promise<void>(r => setTimeout(r, 0)))
            })
          )
        )

        const finalTree = registry.get(atoms.tree) as UITree
        onComplete?.(finalTree)
      }).pipe(
        Effect.catchAll((err) =>
          Effect.sync(() => {
            const e = err instanceof Error ? err : new Error(String(err))
            registry.set(atoms.error, Option.some(e))
            onError?.(e)
          })
        ),
        Effect.ensuring(
          Effect.sync(() => {
            registry.set(atoms.isStreaming, false)
            registry.set(atoms.fiber, Option.none())
          })
        ),
        Effect.provide(TreeWorkerPoolAuto)
      )

      const fiber = Effect.runFork(streamEffect) as RuntimeFiber<void, Error>
      registry.set(atoms.fiber, Option.some(fiber))
    },
    [api, streamId, atoms, onComplete, onError, registry, hybrid, batchSize, interruptFiber]
  )

  const clear = useCallback(() => {
    interruptFiber()
    registry.set(atoms.tree, UITree.empty())
    registry.set(atoms.error, Option.none())
    registry.set(atoms.fiber, Option.none())
  }, [registry, atoms, interruptFiber])

  const cancel = useCallback(() => {
    interruptFiber()
    registry.set(atoms.isStreaming, false)
    registry.set(atoms.fiber, Option.none())
  }, [registry, atoms, interruptFiber])

  // Cleanup THIS stream's fiber on unmount
  useEffect(() => {
    return () => {
      const existingFiber = registry.get(atoms.fiber) as Option.Option<RuntimeFiber<void, Error>>
      if (Option.isSome(existingFiber)) {
        Effect.runFork(Fiber.interrupt(existingFiber.value))
      }
    }
  }, [registry, atoms.fiber])

  return { tree, isStreaming, error, send, clear, cancel, atoms }
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
