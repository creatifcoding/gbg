/**
 * EditSessionService
 *
 * Effect.Service that orchestrates component editing sessions.
 * Combines WorktreeManager and DevServerManager for Cursor-style editing.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const editSession = yield* EditSessionService
 *
 *   // Start a session
 *   const session = yield* editSession.startSession('my-component')
 *
 *   // Make changes, preview in iframe at localhost:${session.devServerPort}
 *
 *   // Accept/decline changes, then save or discard
 *   yield* editSession.saveSession(session.id)
 * })
 * ```
 */

import { Context, Effect, Layer, Schema, Option, Ref, PubSub, Stream } from 'effect'
import { WorktreeManager, WorktreeCreateOptions, WorktreeError } from './WorktreeManager'
import { DevServerManager, DevServerError } from './DevServerManager'

// =============================================================================
// SCHEMAS
// =============================================================================

/**
 * Edit session status
 */
export const SessionStatus = Schema.Literal('active', 'saving', 'discarding', 'closed')
export type SessionStatus = typeof SessionStatus.Type

/**
 * Pending change in a session
 */
export class PendingChange extends Schema.Class<PendingChange>('PendingChange')({
  /** Unique change ID */
  id: Schema.String,
  /** File path (relative to worktree) */
  filePath: Schema.String,
  /** Original content */
  originalContent: Schema.String,
  /** New content */
  newContent: Schema.String,
  /** Change status */
  status: Schema.Literal('pending', 'accepted', 'declined'),
  /** When the change was detected */
  createdAt: Schema.Number,
}) {}

/**
 * Undo entry for reverting changes
 */
export class UndoEntry extends Schema.Class<UndoEntry>('UndoEntry')({
  /** Change ID */
  changeId: Schema.String,
  /** Previous status */
  previousStatus: Schema.Literal('pending', 'accepted', 'declined'),
}) {}

/**
 * Edit session state
 */
export class EditSession extends Schema.Class<EditSession>('EditSession')({
  /** Session ID */
  id: Schema.String,
  /** Component being edited */
  componentId: Schema.String,
  /** Worktree path */
  worktreePath: Schema.String,
  /** Dev server port */
  devServerPort: Schema.Number,
  /** Session status */
  status: SessionStatus,
  /** When session started */
  startedAt: Schema.Number,
  /** Pending changes */
  changes: Schema.Array(PendingChange),
  /** Undo stack */
  undoStack: Schema.Array(UndoEntry),
}) {}

/**
 * Session event for reactive updates
 */
export const SessionEvent = Schema.Union(
  Schema.TaggedStruct('SessionStarted', {
    sessionId: Schema.String,
    session: EditSession,
  }),
  Schema.TaggedStruct('ChangeDetected', {
    sessionId: Schema.String,
    change: PendingChange,
  }),
  Schema.TaggedStruct('ChangeAccepted', {
    sessionId: Schema.String,
    changeId: Schema.String,
  }),
  Schema.TaggedStruct('ChangeDeclined', {
    sessionId: Schema.String,
    changeId: Schema.String,
  }),
  Schema.TaggedStruct('SessionSaved', {
    sessionId: Schema.String,
    commitSha: Schema.String,
  }),
  Schema.TaggedStruct('SessionDiscarded', {
    sessionId: Schema.String,
  }),
  Schema.TaggedStruct('SessionClosed', {
    sessionId: Schema.String,
  })
)
export type SessionEvent = typeof SessionEvent.Type

// =============================================================================
// ERRORS
// =============================================================================

/**
 * Edit session error
 */
export class EditSessionError extends Schema.TaggedError<EditSessionError>()(
  'EditSessionError',
  {
    message: Schema.String,
    operation: Schema.String,
    sessionId: Schema.optionalWith(Schema.String, { as: 'Option' }),
    cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  }
) {}

// =============================================================================
// SERVICE SHAPE
// =============================================================================

/**
 * EditSessionService shape
 */
export interface EditSessionServiceShape {
  /**
   * Start a new editing session
   */
  readonly startSession: (componentId: string) => Effect.Effect<
    EditSession,
    EditSessionError | WorktreeError | DevServerError
  >

  /**
   * Get active session (if any)
   */
  readonly getSession: (sessionId: string) => Effect.Effect<Option.Option<EditSession>>

  /**
   * Get current active session
   */
  readonly getActiveSession: () => Effect.Effect<Option.Option<EditSession>>

  /**
   * Apply a file change to the session
   */
  readonly applyChange: (
    sessionId: string,
    filePath: string,
    newContent: string,
    originalContent: string
  ) => Effect.Effect<PendingChange, EditSessionError>

  /**
   * Accept a pending change
   */
  readonly acceptChange: (
    sessionId: string,
    changeId: string
  ) => Effect.Effect<void, EditSessionError>

  /**
   * Decline a pending change (revert in worktree)
   */
  readonly declineChange: (
    sessionId: string,
    changeId: string
  ) => Effect.Effect<void, EditSessionError>

  /**
   * Undo last accept/decline
   */
  readonly undo: (sessionId: string) => Effect.Effect<void, EditSessionError>

  /**
   * Save session (commit and merge accepted changes)
   */
  readonly saveSession: (
    sessionId: string,
    commitMessage?: string
  ) => Effect.Effect<string, EditSessionError | WorktreeError | DevServerError>

  /**
   * Discard session (cleanup without saving)
   */
  readonly discardSession: (
    sessionId: string
  ) => Effect.Effect<void, EditSessionError | WorktreeError | DevServerError>

  /**
   * Get accepted changes for review
   */
  readonly getAcceptedChanges: (
    sessionId: string
  ) => Effect.Effect<readonly PendingChange[], EditSessionError>

  /**
   * Get diff for session
   */
  readonly getSessionDiff: (
    sessionId: string
  ) => Effect.Effect<string, EditSessionError | WorktreeError>

  /**
   * Subscribe to session events
   */
  readonly events: Stream.Stream<SessionEvent>
}

// =============================================================================
// SERVICE DEFINITION
// =============================================================================

/**
 * EditSessionService Tag
 */
export class EditSessionService extends Context.Tag('tmnl/testbed/EditSessionService')<
  EditSessionService,
  EditSessionServiceShape
>() {}

// =============================================================================
// INTERNAL STATE
// =============================================================================

interface SessionState {
  sessions: Map<string, EditSession>
  activeSessionId: string | null
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Generate session ID
 */
const generateSessionId = (): string =>
  `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

/**
 * Generate change ID
 */
const generateChangeId = (): string =>
  `change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

/**
 * Create EditSessionService implementation
 */
const createEditSessionServiceShape = (
  worktree: typeof WorktreeManager.Service,
  devServer: typeof DevServerManager.Service,
  stateRef: Ref.Ref<SessionState>,
  pubsub: PubSub.PubSub<SessionEvent>
): EditSessionServiceShape => ({
  startSession: (componentId) =>
    Effect.gen(function* () {
      const sessionId = generateSessionId()

      // Create worktree
      const worktreePath = yield* worktree.create(
        new WorktreeCreateOptions({
          sessionId,
          baseBranch: 'HEAD',
        })
      ).pipe(
        Effect.mapError((e) =>
          new EditSessionError({
            message: `Failed to create worktree: ${e.message}`,
            operation: 'startSession',
            sessionId: Option.some(sessionId),
            cause: Option.some(e),
          })
        )
      )

      // Spawn dev server
      const port = yield* devServer.spawn(worktreePath).pipe(
        Effect.mapError((e) =>
          new EditSessionError({
            message: `Failed to spawn dev server: ${e.message}`,
            operation: 'startSession',
            sessionId: Option.some(sessionId),
            cause: Option.some(e),
          })
        )
      )

      // Create session
      const session = new EditSession({
        id: sessionId,
        componentId,
        worktreePath,
        devServerPort: port,
        status: 'active',
        startedAt: Date.now(),
        changes: [],
        undoStack: [],
      })

      // Store session
      yield* Ref.update(stateRef, (s) => ({
        sessions: new Map(s.sessions).set(sessionId, session),
        activeSessionId: sessionId,
      }))

      // Publish event
      yield* PubSub.publish(pubsub, {
        _tag: 'SessionStarted' as const,
        sessionId,
        session,
      })

      return session
    }),

  getSession: (sessionId) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const session = state.sessions.get(sessionId)
      return session ? Option.some(session) : Option.none()
    }),

  getActiveSession: () =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (!state.activeSessionId) return Option.none()
      const session = state.sessions.get(state.activeSessionId)
      return session ? Option.some(session) : Option.none()
    }),

  applyChange: (sessionId, filePath, newContent, originalContent) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const session = state.sessions.get(sessionId)

      if (!session) {
        yield* Effect.fail(
          new EditSessionError({
            message: `Session not found: ${sessionId}`,
            operation: 'applyChange',
            sessionId: Option.some(sessionId),
            cause: Option.none(),
          })
        )
        // TypeScript doesn't know this is unreachable
        throw new Error('unreachable')
      }

      const change = new PendingChange({
        id: generateChangeId(),
        filePath,
        originalContent,
        newContent,
        status: 'pending',
        createdAt: Date.now(),
      })

      // Update session with new change
      const updatedSession = new EditSession({
        ...session,
        changes: [...session.changes, change],
      })

      yield* Ref.update(stateRef, (s) => ({
        ...s,
        sessions: new Map(s.sessions).set(sessionId, updatedSession),
      }))

      // Publish event
      yield* PubSub.publish(pubsub, {
        _tag: 'ChangeDetected' as const,
        sessionId,
        change,
      })

      return change
    }),

  acceptChange: (sessionId, changeId) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const session = state.sessions.get(sessionId)

      if (!session) {
        yield* Effect.fail(
          new EditSessionError({
            message: `Session not found: ${sessionId}`,
            operation: 'acceptChange',
            sessionId: Option.some(sessionId),
            cause: Option.none(),
          })
        )
        return
      }

      const changeIndex = session.changes.findIndex((c) => c.id === changeId)
      if (changeIndex === -1) {
        yield* Effect.fail(
          new EditSessionError({
            message: `Change not found: ${changeId}`,
            operation: 'acceptChange',
            sessionId: Option.some(sessionId),
            cause: Option.none(),
          })
        )
        return
      }

      const change = session.changes[changeIndex]
      const undoEntry = new UndoEntry({
        changeId,
        previousStatus: change.status,
      })

      // Update change status
      const updatedChanges = [...session.changes]
      updatedChanges[changeIndex] = new PendingChange({
        ...change,
        status: 'accepted',
      })

      const updatedSession = new EditSession({
        ...session,
        changes: updatedChanges,
        undoStack: [...session.undoStack, undoEntry],
      })

      yield* Ref.update(stateRef, (s) => ({
        ...s,
        sessions: new Map(s.sessions).set(sessionId, updatedSession),
      }))

      yield* PubSub.publish(pubsub, {
        _tag: 'ChangeAccepted' as const,
        sessionId,
        changeId,
      })
    }),

  declineChange: (sessionId, changeId) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const session = state.sessions.get(sessionId)

      if (!session) {
        yield* Effect.fail(
          new EditSessionError({
            message: `Session not found: ${sessionId}`,
            operation: 'declineChange',
            sessionId: Option.some(sessionId),
            cause: Option.none(),
          })
        )
        return
      }

      const changeIndex = session.changes.findIndex((c) => c.id === changeId)
      if (changeIndex === -1) {
        yield* Effect.fail(
          new EditSessionError({
            message: `Change not found: ${changeId}`,
            operation: 'declineChange',
            sessionId: Option.some(sessionId),
            cause: Option.none(),
          })
        )
        return
      }

      const change = session.changes[changeIndex]
      const undoEntry = new UndoEntry({
        changeId,
        previousStatus: change.status,
      })

      // TODO: Revert file in worktree to originalContent
      // This would trigger HMR to show the reverted state

      // Update change status
      const updatedChanges = [...session.changes]
      updatedChanges[changeIndex] = new PendingChange({
        ...change,
        status: 'declined',
      })

      const updatedSession = new EditSession({
        ...session,
        changes: updatedChanges,
        undoStack: [...session.undoStack, undoEntry],
      })

      yield* Ref.update(stateRef, (s) => ({
        ...s,
        sessions: new Map(s.sessions).set(sessionId, updatedSession),
      }))

      yield* PubSub.publish(pubsub, {
        _tag: 'ChangeDeclined' as const,
        sessionId,
        changeId,
      })
    }),

  undo: (sessionId) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const session = state.sessions.get(sessionId)

      if (!session || session.undoStack.length === 0) {
        yield* Effect.fail(
          new EditSessionError({
            message: 'Nothing to undo',
            operation: 'undo',
            sessionId: Option.some(sessionId),
            cause: Option.none(),
          })
        )
        return
      }

      const undoEntry = session.undoStack[session.undoStack.length - 1]
      const changeIndex = session.changes.findIndex((c) => c.id === undoEntry.changeId)

      if (changeIndex === -1) return

      // Restore previous status
      const updatedChanges = [...session.changes]
      updatedChanges[changeIndex] = new PendingChange({
        ...session.changes[changeIndex],
        status: undoEntry.previousStatus,
      })

      const updatedSession = new EditSession({
        ...session,
        changes: updatedChanges,
        undoStack: session.undoStack.slice(0, -1),
      })

      yield* Ref.update(stateRef, (s) => ({
        ...s,
        sessions: new Map(s.sessions).set(sessionId, updatedSession),
      }))
    }),

  saveSession: (sessionId, commitMessage) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const session = state.sessions.get(sessionId)

      if (!session) {
        yield* Effect.fail(
          new EditSessionError({
            message: `Session not found: ${sessionId}`,
            operation: 'saveSession',
            sessionId: Option.some(sessionId),
            cause: Option.none(),
          })
        )
        // TypeScript doesn't know this is unreachable
        throw new Error('unreachable')
      }

      // Update status to saving
      yield* Ref.update(stateRef, (s) => ({
        ...s,
        sessions: new Map(s.sessions).set(
          sessionId,
          new EditSession({ ...session, status: 'saving' })
        ),
      }))

      // Commit changes
      const message = commitMessage ?? `Component edits: ${session.componentId}`
      const commitSha = yield* worktree.commit(session.worktreePath, message)

      // Merge to main
      yield* worktree.mergeToMain(session.worktreePath)

      // Cleanup
      yield* devServer.kill(session.worktreePath)
      yield* worktree.remove(session.worktreePath)

      // Update state
      yield* Ref.update(stateRef, (s) => {
        const newSessions = new Map(s.sessions)
        newSessions.delete(sessionId)
        return {
          sessions: newSessions,
          activeSessionId: s.activeSessionId === sessionId ? null : s.activeSessionId,
        }
      })

      yield* PubSub.publish(pubsub, {
        _tag: 'SessionSaved' as const,
        sessionId,
        commitSha,
      })

      return commitSha
    }),

  discardSession: (sessionId) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const session = state.sessions.get(sessionId)

      if (!session) return

      // Update status
      yield* Ref.update(stateRef, (s) => ({
        ...s,
        sessions: new Map(s.sessions).set(
          sessionId,
          new EditSession({ ...session, status: 'discarding' })
        ),
      }))

      // Cleanup
      yield* devServer.kill(session.worktreePath)
      yield* worktree.remove(session.worktreePath)

      // Remove from state
      yield* Ref.update(stateRef, (s) => {
        const newSessions = new Map(s.sessions)
        newSessions.delete(sessionId)
        return {
          sessions: newSessions,
          activeSessionId: s.activeSessionId === sessionId ? null : s.activeSessionId,
        }
      })

      yield* PubSub.publish(pubsub, {
        _tag: 'SessionDiscarded' as const,
        sessionId,
      })
    }),

  getAcceptedChanges: (sessionId) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const session = state.sessions.get(sessionId)

      if (!session) {
        yield* Effect.fail(
          new EditSessionError({
            message: `Session not found: ${sessionId}`,
            operation: 'getAcceptedChanges',
            sessionId: Option.some(sessionId),
            cause: Option.none(),
          })
        )
        // TypeScript doesn't know this is unreachable
        throw new Error('unreachable')
      }

      return session.changes.filter((c) => c.status === 'accepted')
    }),

  getSessionDiff: (sessionId) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const session = state.sessions.get(sessionId)

      if (!session) {
        yield* Effect.fail(
          new EditSessionError({
            message: `Session not found: ${sessionId}`,
            operation: 'getSessionDiff',
            sessionId: Option.some(sessionId),
            cause: Option.none(),
          })
        )
        // TypeScript doesn't know this is unreachable
        throw new Error('unreachable')
      }

      return yield* worktree.getDiff(session.worktreePath)
    }),

  events: Stream.fromPubSub(pubsub),
})

// =============================================================================
// LAYERS
// =============================================================================

/**
 * EditSessionService layer requiring dependencies
 */
export const EditSessionServiceLive = Layer.effect(
  EditSessionService,
  Effect.gen(function* () {
    const worktreeService = yield* WorktreeManager
    const devServerService = yield* DevServerManager

    const stateRef = yield* Ref.make<SessionState>({
      sessions: new Map(),
      activeSessionId: null,
    })

    const pubsub = yield* PubSub.unbounded<SessionEvent>()

    return createEditSessionServiceShape(
      worktreeService,
      devServerService,
      stateRef,
      pubsub
    )
  })
)

// =============================================================================
// EXPORTS
// =============================================================================

export const EditSessionServiceBundle = {
  Live: EditSessionServiceLive,
}
