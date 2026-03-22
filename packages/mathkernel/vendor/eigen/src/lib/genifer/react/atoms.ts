/**
 * @fileoverview Atom-based state for genifer React integration
 *
 * Uses effect-atom for:
 * - Reactive UI tree state (replaces useState)
 * - Streaming status tracking
 * - Error state management
 * - Data model and auth state
 * - Confirmation dialog state via Deferred
 *
 * Pattern: Module-level atoms + Registry.make() + useAtomValue()
 */

import { Atom } from "@effect-atom/atom-react"
import { Deferred, Option, Fiber } from "effect"
import type { UITree, AuthState, DataModel, Action, JsonRenderDecodeError } from "../core/schemas"
import { UITree as UITreeClass } from "../core/schemas"
import type { ResolvedAction, ActionHandler } from "../core/actions"

// =============================================================================
// Core State Atoms
// =============================================================================

/**
 * Current UI tree being rendered
 * Starts empty, populated by streaming patches
 */
export const treeAtom = Atom.make<UITree>(UITreeClass.empty()).pipe(
  Atom.keepAlive
)

/**
 * Whether a stream is currently in progress
 */
export const isStreamingAtom = Atom.make(false).pipe(
  Atom.keepAlive
)

/**
 * Current streaming error (if any)
 */
export const errorAtom = Atom.make<Option.Option<Error>>(Option.none()).pipe(
  Atom.keepAlive
)

/**
 * Whether to use hybrid mode (Tree Worker for off-main-thread processing)
 * Used for A/B testing worker vs main thread performance
 */
export const hybridModeAtom = Atom.make(false).pipe(
  Atom.keepAlive
)

// =============================================================================
// Data Context Atoms
// =============================================================================

/**
 * Data model for dynamic value resolution and visibility evaluation
 */
export const dataModelAtom = Atom.make<DataModel>({}).pipe(
  Atom.keepAlive
)

/**
 * Authentication state for visibility conditions
 */
export const authStateAtom = Atom.make<AuthState>({ isSignedIn: false }).pipe(
  Atom.keepAlive
)

// =============================================================================
// Action State Atoms
// =============================================================================

/**
 * Registered action handlers
 */
export const actionHandlersAtom = Atom.make<Record<string, ActionHandler>>({}).pipe(
  Atom.keepAlive
)

/**
 * Set of currently executing action names (for loading states)
 */
export const loadingActionsAtom = Atom.make<Set<string>>(new Set<string>()).pipe(
  Atom.keepAlive
)

/**
 * Pending confirmation state
 * Uses Effect.Deferred for suspension until user confirms/cancels
 */
export interface PendingConfirmation {
  /** The resolved action awaiting confirmation */
  readonly action: ResolvedAction
  /** The action handler to execute on confirm */
  readonly handler: ActionHandler
  /** Deferred that resolves true on confirm, false on cancel */
  readonly deferred: Deferred.Deferred<boolean>
}

export const pendingConfirmationAtom = Atom.make<Option.Option<PendingConfirmation>>(
  Option.none()
).pipe(Atom.keepAlive)

// =============================================================================
// Stream Control Atoms (Singleton — LEGACY, prefer stream families below)
// =============================================================================

/**
 * Current streaming fiber (for cancellation via Fiber.interrupt)
 * @deprecated Use streamFiberFamily(streamId) instead for concurrent safety
 */
export const streamFiberAtom = Atom.make<Option.Option<Fiber.RuntimeFiber<void, Error>>>(
  Option.none()
).pipe(Atom.keepAlive)

// =============================================================================
// Stream Atom Families (Concurrent-Safe, keyed by stream ID)
// =============================================================================

/**
 * Stream ID type — caller-provided key that isolates all stream state.
 *
 * Convention:
 *   - HTTP mode:    `"ui-stream:http:<api>"`  or caller's own ID
 *   - Cluster mode: `"ui-stream:cluster:<cardId>"`
 *   - Custom:       any unique string
 */
export type StreamId = string

/** Tree state per stream */
export const streamTreeFamily = Atom.family(
  (_streamId: StreamId) => Atom.make<UITree>(UITreeClass.empty())
)

/** Streaming status per stream */
export const streamIsStreamingFamily = Atom.family(
  (_streamId: StreamId) => Atom.make<boolean>(false)
)

/** Error state per stream */
export const streamErrorFamily = Atom.family(
  (_streamId: StreamId) => Atom.make<Option.Option<Error>>(Option.none())
)

/** Fiber ref per stream (for cancellation) */
export const streamFiberFamily = Atom.family(
  (_streamId: StreamId) =>
    Atom.make<Option.Option<Fiber.RuntimeFiber<void, Error>>>(Option.none())
)

/**
 * Bundle of atoms for a specific stream instance.
 * Every field is stream-scoped — two streams never touch each other.
 */
export interface StreamAtoms {
  readonly tree: Atom.Writable<UITree>
  readonly isStreaming: Atom.Writable<boolean>
  readonly error: Atom.Writable<Option.Option<Error>>
  readonly fiber: Atom.Writable<Option.Option<Fiber.RuntimeFiber<void, Error>>>
  readonly decodeErrors: Atom.Writable<Array<DecodeErrorEntry>>
}

/**
 * Get all atoms for a specific stream.
 *
 * @example
 * ```ts
 * const atoms = getStreamAtoms('my-stream')
 * registry.set(atoms.isStreaming, true)
 * const tree = registry.get(atoms.tree)
 * ```
 */
export function getStreamAtoms(streamId: StreamId): StreamAtoms {
  return {
    tree: streamTreeFamily(streamId),
    isStreaming: streamIsStreamingFamily(streamId),
    error: streamErrorFamily(streamId),
    fiber: streamFiberFamily(streamId),
    decodeErrors: decodeErrorsFamily(streamId),
  }
}

// =============================================================================
// Decode Error Atoms (per stream + aggregated)
// =============================================================================

export type DecodeErrorEntry = JsonRenderDecodeError

export const decodeErrorStreamIdsAtom = Atom.make<Set<string>>(new Set()).pipe(
  Atom.keepAlive
)

export const decodeErrorsFamily = Atom.family(
  (_streamId: string) => Atom.make<Array<DecodeErrorEntry>>([])
)

export const decodeErrorsAtom = Atom.make((get) => {
  const ids = Array.from(get(decodeErrorStreamIdsAtom))
  const errors: Array<DecodeErrorEntry> = []
  for (const id of ids) {
    for (const entry of get(decodeErrorsFamily(id))) {
      errors.push(entry)
    }
  }
  return errors
})

export const registerDecodeErrorStreamId = (ids: Set<string>, streamId: string) => {
  const next = new Set(ids)
  next.add(streamId)
  return next
}

// =============================================================================
// GenerativeContainer Atom Families (Per-Container Isolation)
// =============================================================================

/**
 * Container ID type for GenerativeContainer instances
 */
export type GenerativeContainerId = string

/**
 * Tree state per GenerativeContainer
 *
 * Each container gets its own tree, preventing nested containers
 * from overwriting parent state.
 *
 * @example
 * const tree = registry.get(containerTreeFamily(containerId))
 */
export const containerTreeFamily = Atom.family(
  (_containerId: GenerativeContainerId) =>
    Atom.make<{ root: string | null; elements: Record<string, unknown> }>({
      root: null,
      elements: {},
    })
)

/**
 * Streaming status per GenerativeContainer
 */
export const containerIsStreamingFamily = Atom.family(
  (_containerId: GenerativeContainerId) => Atom.make<boolean>(false)
)

/**
 * Error state per GenerativeContainer
 */
export const containerErrorFamily = Atom.family(
  (_containerId: GenerativeContainerId) =>
    Atom.make<Option.Option<Error>>(Option.none())
)

/**
 * Bundle of atoms for a specific GenerativeContainer instance
 */
export interface ContainerAtoms {
  readonly tree: Atom.Writable<{ root: string | null; elements: Record<string, unknown> }>
  readonly isStreaming: Atom.Writable<boolean>
  readonly error: Atom.Writable<Option.Option<Error>>
}

/**
 * Get all atoms for a specific GenerativeContainer instance
 *
 * @example
 * const atoms = getContainerAtoms(containerId)
 * registry.set(atoms.isStreaming, true)
 * const tree = registry.get(atoms.tree)
 */
export function getContainerAtoms(containerId: GenerativeContainerId): ContainerAtoms {
  return {
    tree: containerTreeFamily(containerId),
    isStreaming: containerIsStreamingFamily(containerId),
    error: containerErrorFamily(containerId),
  }
}

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Derived: visibility evaluation context
 */
export const visibilityContextAtom = Atom.make((get) => ({
  dataModel: get(dataModelAtom),
  authState: get(authStateAtom)
}))

/**
 * Derived: has error
 */
export const hasErrorAtom = Atom.make((get) =>
  Option.isSome(get(errorAtom))
)

/**
 * Derived: has pending confirmation
 */
export const hasPendingConfirmationAtom = Atom.make((get) =>
  Option.isSome(get(pendingConfirmationAtom))
)

/**
 * Check if a specific action is loading
 * Note: Use registry.get(loadingActionsAtom).has(name) directly in components
 * as family atoms with derived state can be complex
 */
export const checkActionLoading = (
  loadingActions: Set<string>,
  actionName: string
): boolean => loadingActions.has(actionName)

// =============================================================================
// Type Exports
// =============================================================================

export type {
  UITree,
  AuthState,
  DataModel,
  Action,
  ResolvedAction,
  ActionHandler
}
