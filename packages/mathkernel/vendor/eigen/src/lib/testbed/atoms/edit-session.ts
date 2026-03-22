/**
 * Edit Session Atoms
 *
 * Reactive state for component editing sessions.
 * Bridges Effect services to React via effect-atom.
 *
 * @example
 * ```tsx
 * import { useAtomValue } from '@effect-atom/atom-react'
 * import { activeSessionAtom, acceptedChangesAtom } from '@/lib/testbed/atoms/edit-session'
 *
 * function SessionStatus() {
 *   const session = useAtomValue(activeSessionAtom)
 *   const acceptedChanges = useAtomValue(acceptedChangesAtom)
 *
 *   if (!session) return <div>No active session</div>
 *
 *   return (
 *     <div>
 *       <p>Session: {session.id}</p>
 *       <p>Accepted: {acceptedChanges.length}</p>
 *     </div>
 *   )
 * }
 * ```
 */

import { Atom, Registry } from '@effect-atom/atom'
import { Effect, Layer, Option } from 'effect'
import {
  EditSessionService,
  EditSessionServiceLive,
  WorktreeManagerDefault,
  DevServerManagerDefault,
  type EditSession,
  type PendingChange,
} from '../services'

// =============================================================================
// REGISTRY
// =============================================================================

/**
 * Registry for edit session atoms
 */
export const editSessionRegistry = Registry.make()

// =============================================================================
// STATE ATOMS
// =============================================================================

/**
 * Active edit session (if any)
 */
export const activeSessionAtom = Atom.make<EditSession | null>(null)

/**
 * All pending changes in current session
 */
export const pendingChangesAtom = Atom.make<readonly PendingChange[]>([])

/**
 * Whether an edit session is active
 */
export const hasActiveSessionAtom = Atom.make((get) => get(activeSessionAtom) !== null)

/**
 * Dev server port for preview iframe
 */
export const previewPortAtom = Atom.make((get) => {
  const session = get(activeSessionAtom)
  return session?.devServerPort ?? null
})

/**
 * Worktree path for the session
 */
export const worktreePathAtom = Atom.make((get) => {
  const session = get(activeSessionAtom)
  return session?.worktreePath ?? null
})

/**
 * Session status
 */
export const sessionStatusAtom = Atom.make((get) => {
  const session = get(activeSessionAtom)
  return session?.status ?? 'closed'
})

// =============================================================================
// DERIVED ATOMS
// =============================================================================

/**
 * Accepted changes only
 */
export const acceptedChangesAtom = Atom.make((get) => {
  const changes = get(pendingChangesAtom)
  return changes.filter((c) => c.status === 'accepted')
})

/**
 * Declined changes only
 */
export const declinedChangesAtom = Atom.make((get) => {
  const changes = get(pendingChangesAtom)
  return changes.filter((c) => c.status === 'declined')
})

/**
 * Pending (unreviewed) changes only
 */
export const unreviewedChangesAtom = Atom.make((get) => {
  const changes = get(pendingChangesAtom)
  return changes.filter((c) => c.status === 'pending')
})

/**
 * Count of accepted changes
 */
export const acceptedCountAtom = Atom.make((get) => {
  const accepted = get(acceptedChangesAtom)
  return accepted.length
})

/**
 * Whether there are unsaved accepted changes
 */
export const hasUnsavedChangesAtom = Atom.make((get) => {
  const accepted = get(acceptedChangesAtom)
  return accepted.length > 0
})

/**
 * Whether there are pending changes to review
 */
export const hasPendingReviewAtom = Atom.make((get) => {
  const unreviewed = get(unreviewedChangesAtom)
  return unreviewed.length > 0
})

// =============================================================================
// RUNTIME
// =============================================================================

/**
 * Full layer for edit session services
 */
export const EditSessionLayerFull = EditSessionServiceLive.pipe(
  Layer.provideMerge(WorktreeManagerDefault),
  Layer.provideMerge(DevServerManagerDefault)
)

/**
 * Runtime atom for edit session operations
 */
export const editSessionRuntimeAtom = Atom.runtime(EditSessionLayerFull)

// =============================================================================
// OPERATIONS
// =============================================================================

/**
 * Operation atoms for edit session actions.
 *
 * Note: These operations update atoms via ctx.set() which requires
 * synchronous access. For atoms that need get(), we pass them as args.
 */
export const editSessionOps = {
  /**
   * Start a new edit session
   */
  startSession: editSessionRuntimeAtom.fn<string>()((componentId, ctx) =>
    Effect.gen(function* () {
      const service = yield* EditSessionService
      const session = yield* service.startSession(componentId)

      ctx.set(activeSessionAtom, session)
      ctx.set(pendingChangesAtom, session.changes)

      return session
    })
  ),

  /**
   * Apply a file change
   */
  applyChange: editSessionRuntimeAtom.fn<{
    sessionId: string
    filePath: string
    newContent: string
    originalContent: string
    currentChanges: readonly PendingChange[]
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* EditSessionService
      const change = yield* service.applyChange(
        args.sessionId,
        args.filePath,
        args.newContent,
        args.originalContent
      )

      // Update pending changes
      ctx.set(pendingChangesAtom, [...args.currentChanges, change])

      return change
    })
  ),

  /**
   * Accept a pending change
   */
  acceptChange: editSessionRuntimeAtom.fn<{
    sessionId: string
    changeId: string
    currentChanges: readonly PendingChange[]
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* EditSessionService
      yield* service.acceptChange(args.sessionId, args.changeId)

      // Update pending changes
      ctx.set(
        pendingChangesAtom,
        args.currentChanges.map((c) =>
          c.id === args.changeId ? { ...c, status: 'accepted' as const } : c
        )
      )
    })
  ),

  /**
   * Decline a pending change
   */
  declineChange: editSessionRuntimeAtom.fn<{
    sessionId: string
    changeId: string
    currentChanges: readonly PendingChange[]
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* EditSessionService
      yield* service.declineChange(args.sessionId, args.changeId)

      // Update pending changes
      ctx.set(
        pendingChangesAtom,
        args.currentChanges.map((c) =>
          c.id === args.changeId ? { ...c, status: 'declined' as const } : c
        )
      )
    })
  ),

  /**
   * Undo last action
   */
  undo: editSessionRuntimeAtom.fn<{ sessionId: string }>()((args, _ctx) =>
    Effect.gen(function* () {
      const service = yield* EditSessionService
      yield* service.undo(args.sessionId)

      // Refresh session state from service
      const updatedSession = yield* service.getSession(args.sessionId)
      if (Option.isSome(updatedSession)) {
        // Note: This won't work with ctx.set - need to return and handle in caller
        return updatedSession.value
      }
      return null
    })
  ),

  /**
   * Save session (commit accepted changes)
   */
  saveSession: editSessionRuntimeAtom.fn<{
    sessionId: string
    commitMessage?: string
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* EditSessionService
      const sha = yield* service.saveSession(args.sessionId, args.commitMessage)

      // Clear state
      ctx.set(activeSessionAtom, null)
      ctx.set(pendingChangesAtom, [])

      return sha
    })
  ),

  /**
   * Discard session
   */
  discardSession: editSessionRuntimeAtom.fn<{ sessionId: string }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* EditSessionService
      yield* service.discardSession(args.sessionId)

      // Clear state
      ctx.set(activeSessionAtom, null)
      ctx.set(pendingChangesAtom, [])
    })
  ),

  /**
   * Get diff for review
   */
  getSessionDiff: editSessionRuntimeAtom.fn<{ sessionId: string }>()(
    (args, _ctx) =>
      Effect.gen(function* () {
        const service = yield* EditSessionService
        return yield* service.getSessionDiff(args.sessionId)
      })
  ),
}

// =============================================================================
// EXPORTS
// =============================================================================

export const EditSessionAtoms = {
  // Registry
  registry: editSessionRegistry,
  // State
  activeSession: activeSessionAtom,
  pendingChanges: pendingChangesAtom,
  hasActiveSession: hasActiveSessionAtom,
  previewPort: previewPortAtom,
  worktreePath: worktreePathAtom,
  sessionStatus: sessionStatusAtom,
  // Derived
  acceptedChanges: acceptedChangesAtom,
  declinedChanges: declinedChangesAtom,
  unreviewedChanges: unreviewedChangesAtom,
  acceptedCount: acceptedCountAtom,
  hasUnsavedChanges: hasUnsavedChangesAtom,
  hasPendingReview: hasPendingReviewAtom,
  // Runtime
  runtime: editSessionRuntimeAtom,
  // Operations
  ops: editSessionOps,
}
