/**
 * useAiCoreChatSession Hook
 *
 * React hook for managing a single chat session.
 * Provides operations for the active session (save, rename, fork, delete).
 *
 * @example
 * ```tsx
 * function ChatHeader() {
 *   const { session, rename, fork, delete: deleteSession } = useAiCoreChatSession()
 *
 *   if (!session) return <div>No session selected</div>
 *
 *   return (
 *     <div>
 *       <h1>{session.title}</h1>
 *       <button onClick={() => rename('New Title')}>Rename</button>
 *       <button onClick={() => fork()}>Fork</button>
 *       <button onClick={() => deleteSession()}>Delete</button>
 *     </div>
 *   )
 * }
 * ```
 */

import { useAtomValue } from '@effect-atom/atom-react'
import { useCallback } from 'react'
import { Effect } from 'effect'
import {
  activeSessionAtom,
  setActiveSession,
  updateActiveSession,
  updateSessionInIndex,
  removeSessionFromIndex,
  addSessionToIndex,
} from '../atoms/sessions'
import { SessionService, SessionServiceLive } from '../services/SessionService'
import { SessionStorageLocalLive } from '../services/SessionStorageLocal'
import { toMetadata, type Session } from '../schemas/session'

// =============================================================================
// Effect Runner
// =============================================================================

/**
 * Run session effect with default layers
 */
const runSessionEffect = <A>(
  effect: Effect.Effect<A, never, SessionService>
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(SessionServiceLive),
      Effect.provide(SessionStorageLocalLive)
    )
  )

// =============================================================================
// Types
// =============================================================================

export interface UseAiCoreChatSessionResult {
  /** Current active session (null if none) */
  session: Session | null

  /**
   * Save current session state
   * Use after making local changes to sync to storage
   */
  save: () => Promise<void>

  /**
   * Rename the session
   */
  rename: (title: string) => Promise<void>

  /**
   * Fork session (create copy)
   * Returns the new forked session
   */
  fork: () => Promise<Session | null>

  /**
   * Delete the session
   * Clears active session after deletion
   */
  delete: () => Promise<void>

  /**
   * Append a message to the session
   * Also triggers auto-title if first message
   */
  appendMessage: (message: unknown) => Promise<void>

  /**
   * Update session with new messages
   * Use for replacing entire message history
   */
  updateMessages: (messages: unknown[]) => Promise<void>

  /**
   * Export session as JSON string
   */
  exportJson: () => Promise<string | null>
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for managing the active chat session
 */
export function useAiCoreChatSession(): UseAiCoreChatSessionResult {
  const session = useAtomValue(activeSessionAtom)

  const save = useCallback(async () => {
    if (!session) return

    await runSessionEffect(
      Effect.gen(function* () {
        const svc = yield* SessionService
        yield* svc.update(session.id, {
          title: session.title,
          messages: session.messages,
          systemPrompt: session.systemPrompt,
          model: session.model,
          temperature: session.temperature,
          toolsEnabled: session.toolsEnabled,
        })
      })
    )
  }, [session])

  const rename = useCallback(
    async (title: string) => {
      if (!session) return

      const updated = await runSessionEffect(
        Effect.gen(function* () {
          const svc = yield* SessionService
          return yield* svc.rename(session.id, title)
        })
      )

      if (updated) {
        updateActiveSession(updated)
        updateSessionInIndex(toMetadata(updated))
      }
    },
    [session]
  )

  const fork = useCallback(async () => {
    if (!session) return null

    const forked = await runSessionEffect(
      Effect.gen(function* () {
        const svc = yield* SessionService
        return yield* svc.fork(session.id)
      })
    )

    if (forked) {
      setActiveSession(forked)
      addSessionToIndex(toMetadata(forked))
    }

    return forked
  }, [session])

  const deleteSession = useCallback(async () => {
    if (!session) return

    await runSessionEffect(
      Effect.gen(function* () {
        const svc = yield* SessionService
        yield* svc.delete(session.id)
      })
    )

    removeSessionFromIndex(session.id)
    setActiveSession(null)
  }, [session])

  const appendMessage = useCallback(
    async (message: unknown) => {
      if (!session) return

      const updated = await runSessionEffect(
        Effect.gen(function* () {
          const svc = yield* SessionService
          const withMessage = yield* svc.appendMessage(session.id, message)
          if (withMessage) {
            // Auto-generate title after first message
            yield* svc.generateTitle(session.id)
          }
          // Reload to get potentially updated title
          return yield* svc.open(session.id)
        })
      )

      if (updated) {
        setActiveSession(updated)
        updateSessionInIndex(toMetadata(updated))
      }
    },
    [session]
  )

  const updateMessages = useCallback(
    async (messages: unknown[]) => {
      if (!session) return

      const updated = await runSessionEffect(
        Effect.gen(function* () {
          const svc = yield* SessionService
          return yield* svc.update(session.id, { messages })
        })
      )

      if (updated) {
        updateActiveSession(updated)
        updateSessionInIndex(toMetadata(updated))
      }
    },
    [session]
  )

  const exportJson = useCallback(async () => {
    if (!session) return null

    return runSessionEffect(
      Effect.gen(function* () {
        const svc = yield* SessionService
        return yield* svc.export(session.id)
      })
    )
  }, [session])

  return {
    session,
    save,
    rename,
    fork,
    delete: deleteSession,
    appendMessage,
    updateMessages,
    exportJson,
  }
}
