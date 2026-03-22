/**
 * Session Atoms
 *
 * Atom-as-State for session management.
 * Uses the aiCoreRegistry for synchronous state mutations.
 *
 * These atoms track:
 * - Session index (metadata for fast listing)
 * - Active session (full data)
 * - UI state (sidebar expanded, search query)
 */

import { Atom } from '@effect-atom/atom-react'
import type { Session, SessionMetadata } from '../schemas/session'
import { aiCoreRegistry } from './index'

// =============================================================================
// State Atoms
// =============================================================================

/**
 * Session index (metadata only, for fast listing)
 * Sorted by updatedAt descending
 */
export const sessionsIndexAtom = Atom.make<SessionMetadata[]>([])

/**
 * Currently active session (full data including messages)
 * null when no session is selected
 */
export const activeSessionAtom = Atom.make<Session | null>(null)

/**
 * Sidebar expanded/collapsed state
 */
export const sessionSidebarExpandedAtom = Atom.make(false)

/**
 * Search query for filtering sessions
 */
export const sessionSearchQueryAtom = Atom.make('')

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Filtered sessions based on search query
 * Case-insensitive partial match on title
 */
export const filteredSessionsAtom = Atom.make((get) => {
  const sessions = get(sessionsIndexAtom)
  const query = get(sessionSearchQueryAtom).toLowerCase().trim()

  if (!query) return sessions
  return sessions.filter((s) => s.title.toLowerCase().includes(query))
})

/**
 * Whether any session is active
 */
export const hasActiveSessionAtom = Atom.make((get) => {
  return get(activeSessionAtom) !== null
})

/**
 * Active session ID (derived for comparison)
 */
export const activeSessionIdAtom = Atom.make((get) => {
  return get(activeSessionAtom)?.id ?? null
})

/**
 * Number of sessions
 */
export const sessionCountAtom = Atom.make((get) => {
  return get(sessionsIndexAtom).length
})

// =============================================================================
// Direct State Manipulation
// =============================================================================

/**
 * Set sessions index (after loading from storage)
 */
export const setSessionsIndex = (sessions: SessionMetadata[]): void => {
  aiCoreRegistry.set(sessionsIndexAtom, sessions)
}

/**
 * Set active session
 */
export const setActiveSession = (session: Session | null): void => {
  aiCoreRegistry.set(activeSessionAtom, session)
}

/**
 * Update active session (if session matches active)
 * Useful for optimistic updates after mutations
 */
export const updateActiveSession = (session: Session): void => {
  const current = aiCoreRegistry.get(activeSessionAtom)
  if (current?.id === session.id) {
    aiCoreRegistry.set(activeSessionAtom, session)
  }
}

/**
 * Add session to index (at front for new sessions)
 */
export const addSessionToIndex = (metadata: SessionMetadata): void => {
  aiCoreRegistry.update(sessionsIndexAtom, (sessions) => [metadata, ...sessions])
}

/**
 * Update session in index
 */
export const updateSessionInIndex = (metadata: SessionMetadata): void => {
  aiCoreRegistry.update(sessionsIndexAtom, (sessions) =>
    sessions.map((s) => (s.id === metadata.id ? metadata : s))
  )
}

/**
 * Remove session from index
 */
export const removeSessionFromIndex = (id: string): void => {
  aiCoreRegistry.update(sessionsIndexAtom, (sessions) =>
    sessions.filter((s) => s.id !== id)
  )
}

/**
 * Toggle sidebar expanded state
 */
export const toggleSidebar = (): void => {
  aiCoreRegistry.update(sessionSidebarExpandedAtom, (expanded) => !expanded)
}

/**
 * Set sidebar expanded state
 */
export const setSidebarExpanded = (expanded: boolean): void => {
  aiCoreRegistry.set(sessionSidebarExpandedAtom, expanded)
}

/**
 * Set search query
 */
export const setSearchQuery = (query: string): void => {
  aiCoreRegistry.set(sessionSearchQueryAtom, query)
}

/**
 * Clear search query
 */
export const clearSearchQuery = (): void => {
  aiCoreRegistry.set(sessionSearchQueryAtom, '')
}

// =============================================================================
// Bulk Operations
// =============================================================================

/**
 * Clear all session state (for cleanup)
 */
export const clearSessionState = (): void => {
  aiCoreRegistry.set(sessionsIndexAtom, [])
  aiCoreRegistry.set(activeSessionAtom, null)
  aiCoreRegistry.set(sessionSidebarExpandedAtom, false)
  aiCoreRegistry.set(sessionSearchQueryAtom, '')
}
