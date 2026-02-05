/**
 * useAiCoreChatSessions Hook
 *
 * React hook for managing the session list.
 * Provides operations for creating, opening, listing, and importing sessions.
 *
 * @example
 * ```tsx
 * function SessionList() {
 *   const { sessions, filteredSessions, createNew, open, setSearchQuery } = useAiCoreChatSessions()
 *
 *   return (
 *     <div>
 *       <input
 *         type="search"
 *         onChange={(e) => setSearchQuery(e.target.value)}
 *         placeholder="Search sessions..."
 *       />
 *       <button onClick={() => createNew()}>New Chat</button>
 *       <ul>
 *         {filteredSessions.map((s) => (
 *           <li key={s.id} onClick={() => open(s.id)}>
 *             {s.title}
 *           </li>
 *         ))}
 *       </ul>
 *     </div>
 *   )
 * }
 * ```
 */

import { useAtomValue } from '@effect-atom/atom-react'
import { useCallback, useEffect } from 'react'
import { Effect } from 'effect'
import {
  sessionsIndexAtom,
  filteredSessionsAtom,
  sessionSearchQueryAtom,
  sessionSidebarExpandedAtom,
  activeSessionIdAtom,
  setSessionsIndex,
  setActiveSession,
  addSessionToIndex,
  setSearchQuery as setSearchQueryAtom,
  clearSearchQuery,
  toggleSidebar as toggleSidebarAtom,
  setSidebarExpanded,
} from '../atoms/sessions'
import { SessionService, SessionServiceLive } from '../services/SessionService'
import { SessionStorageLocalLive } from '../services/SessionStorageLocal'
import { toMetadata, type Session, type SessionMetadata, type SessionConfigType } from '../schemas/session'

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

export interface UseAiCoreChatSessionsResult {
  /** All sessions (metadata only) */
  sessions: SessionMetadata[]

  /** Sessions filtered by search query */
  filteredSessions: SessionMetadata[]

  /** Current search query */
  searchQuery: string

  /** Whether sidebar is expanded */
  sidebarExpanded: boolean

  /** Currently active session ID */
  activeSessionId: string | null

  /**
   * Create a new session
   * Sets it as active
   */
  createNew: (config?: SessionConfigType) => Promise<Session>

  /**
   * Open a session by ID
   * Sets it as active
   */
  open: (id: string) => Promise<Session | null>

  /**
   * Import session from JSON
   * Creates new session with imported data
   */
  importJson: (json: string) => Promise<Session>

  /**
   * Set search query for filtering
   */
  setSearchQuery: (query: string) => void

  /**
   * Clear search query
   */
  clearSearch: () => void

  /**
   * Toggle sidebar visibility
   */
  toggleSidebar: () => void

  /**
   * Set sidebar expanded state
   */
  setExpanded: (expanded: boolean) => void

  /**
   * Reload sessions from storage
   * Call after external changes
   */
  refresh: () => Promise<void>
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for managing the session list
 */
export function useAiCoreChatSessions(): UseAiCoreChatSessionsResult {
  const sessions = useAtomValue(sessionsIndexAtom)
  const filteredSessions = useAtomValue(filteredSessionsAtom)
  const searchQuery = useAtomValue(sessionSearchQueryAtom)
  const sidebarExpanded = useAtomValue(sessionSidebarExpandedAtom)
  const activeSessionId = useAtomValue(activeSessionIdAtom)

  // Load sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      const [sessionList, activeSession] = await runSessionEffect(
        Effect.gen(function* () {
          const svc = yield* SessionService
          const list = yield* svc.list()
          const active = yield* svc.getActive()
          return [list, active] as const
        })
      )

      setSessionsIndex(sessionList)
      if (activeSession) {
        setActiveSession(activeSession)
      }
    }

    loadSessions()
  }, [])

  const createNew = useCallback(async (config?: SessionConfigType) => {
    const session = await runSessionEffect(
      Effect.gen(function* () {
        const svc = yield* SessionService
        return yield* svc.create(config)
      })
    )

    setActiveSession(session)
    addSessionToIndex(toMetadata(session))
    return session
  }, [])

  const open = useCallback(async (id: string) => {
    const session = await runSessionEffect(
      Effect.gen(function* () {
        const svc = yield* SessionService
        return yield* svc.open(id)
      })
    )

    if (session) {
      setActiveSession(session)
    }

    return session
  }, [])

  const importJson = useCallback(async (json: string) => {
    const session = await runSessionEffect(
      Effect.gen(function* () {
        const svc = yield* SessionService
        return yield* svc.import(json)
      })
    )

    setActiveSession(session)
    addSessionToIndex(toMetadata(session))
    return session
  }, [])

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryAtom(query)
  }, [])

  const clearSearch = useCallback(() => {
    clearSearchQuery()
  }, [])

  const toggleSidebar = useCallback(() => {
    toggleSidebarAtom()
  }, [])

  const setExpanded = useCallback((expanded: boolean) => {
    setSidebarExpanded(expanded)
  }, [])

  const refresh = useCallback(async () => {
    const sessionList = await runSessionEffect(
      Effect.gen(function* () {
        const svc = yield* SessionService
        return yield* svc.list()
      })
    )

    setSessionsIndex(sessionList)
  }, [])

  return {
    sessions,
    filteredSessions,
    searchQuery,
    sidebarExpanded,
    activeSessionId,
    createNew,
    open,
    importJson,
    setSearchQuery,
    clearSearch,
    toggleSidebar,
    setExpanded,
    refresh,
  }
}
