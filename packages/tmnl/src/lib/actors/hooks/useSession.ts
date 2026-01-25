/**
 * useSession Hook
 *
 * React hook for session service access.
 * Provides per-user tab/window state management via Effect-based persistence.
 *
 * @module lib/actors/hooks/useSession
 */

import { useMemo, useCallback, useState, useEffect } from 'react'
import { Effect } from 'effect'
import { useActorContext } from '../components/ActorProvider'
import type {
  TabId,
  WindowId,
  BufferId,
  UserId,
  SessionTab,
  SessionWindow,
  SessionState,
} from '../schemas'
import type { SessionServiceShape, UpdateTabOptions, UpdateWindowOptions } from '../services'

// =============================================================================
// Types
// =============================================================================

export interface UseSessionOptions {
  /** User ID for session isolation */
  userId: UserId
}

export interface UseSessionResult {
  /** Whether the session is ready */
  isReady: boolean

  // Tab operations
  /** Create a new tab */
  createTab: (name: string, options?: { layout?: unknown; isPinned?: boolean }) => Promise<SessionTab>
  /** Set active tab */
  setActiveTab: (tabId: TabId) => Promise<void>
  /** Close a tab */
  closeTab: (tabId: TabId) => Promise<void>
  /** Update tab properties */
  updateTab: (tabId: TabId, updates: UpdateTabOptions) => Promise<SessionTab>
  /** Reorder tabs */
  reorderTabs: (newOrder: readonly TabId[]) => Promise<void>

  // Window operations
  /** Create a window for a buffer */
  createWindow: (bufferId: BufferId, majorMode?: string) => Promise<SessionWindow>
  /** Focus a window */
  focusWindow: (windowId: WindowId) => Promise<void>
  /** Update window state */
  updateWindow: (windowId: WindowId, updates: UpdateWindowOptions) => Promise<SessionWindow>
  /** Close a window */
  closeWindow: (windowId: WindowId) => Promise<void>

  // Persistence
  /** Get session snapshot */
  getSnapshot: () => Promise<SessionState>
  /** Restore session from snapshot */
  restoreSnapshot: (snapshot: Partial<SessionState>) => Promise<void>
  /** Clear session */
  clear: () => Promise<void>
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for session service access.
 *
 * Uses Effect-based persistence via @effect/sql-sqlite-wasm.
 *
 * @example
 * ```tsx
 * function TabManager({ userId }: { userId: UserId }) {
 *   const { isReady, createTab, setActiveTab } = useSession({ userId })
 *
 *   const handleNewTab = async () => {
 *     const tab = await createTab('New Tab')
 *     await setActiveTab(tab.id)
 *   }
 *
 *   return <button onClick={handleNewTab} disabled={!isReady}>New Tab</button>
 * }
 * ```
 */
export function useSession({ userId }: UseSessionOptions): UseSessionResult {
  const { isReady: actorReady, getSession } = useActorContext()
  const [session, setSession] = useState<SessionServiceShape | null>(null)
  const [isReady, setIsReady] = useState(false)

  // Initialize session for user
  useEffect(() => {
    if (!actorReady) return

    let mounted = true

    getSession(userId)
      .then((s) => {
        if (mounted) {
          setSession(s)
          setIsReady(true)
        }
      })
      .catch((err) => {
        console.error('[useSession] Failed to get session:', err)
      })

    return () => {
      mounted = false
    }
  }, [actorReady, userId, getSession])

  // Tab operations
  const createTab = useCallback(
    async (name: string, options?: { layout?: unknown; isPinned?: boolean }): Promise<SessionTab> => {
      if (!session) throw new Error('Session not ready')
      return Effect.runPromise(session.createTab(name, options))
    },
    [session]
  )

  const setActiveTab = useCallback(
    async (tabId: TabId): Promise<void> => {
      if (!session) throw new Error('Session not ready')
      return Effect.runPromise(session.setActiveTab(tabId))
    },
    [session]
  )

  const closeTab = useCallback(
    async (tabId: TabId): Promise<void> => {
      if (!session) throw new Error('Session not ready')
      return Effect.runPromise(session.closeTab(tabId))
    },
    [session]
  )

  const updateTab = useCallback(
    async (tabId: TabId, updates: UpdateTabOptions): Promise<SessionTab> => {
      if (!session) throw new Error('Session not ready')
      return Effect.runPromise(session.updateTab(tabId, updates))
    },
    [session]
  )

  const reorderTabs = useCallback(
    async (newOrder: readonly TabId[]): Promise<void> => {
      if (!session) throw new Error('Session not ready')
      return Effect.runPromise(session.reorderTabs(newOrder))
    },
    [session]
  )

  // Window operations
  const createWindow = useCallback(
    async (bufferId: BufferId, majorMode?: string): Promise<SessionWindow> => {
      if (!session) throw new Error('Session not ready')
      return Effect.runPromise(session.createWindow(bufferId, majorMode))
    },
    [session]
  )

  const focusWindow = useCallback(
    async (windowId: WindowId): Promise<void> => {
      if (!session) throw new Error('Session not ready')
      return Effect.runPromise(session.focusWindow(windowId))
    },
    [session]
  )

  const updateWindow = useCallback(
    async (windowId: WindowId, updates: UpdateWindowOptions): Promise<SessionWindow> => {
      if (!session) throw new Error('Session not ready')
      return Effect.runPromise(session.updateWindow(windowId, updates))
    },
    [session]
  )

  const closeWindow = useCallback(
    async (windowId: WindowId): Promise<void> => {
      if (!session) throw new Error('Session not ready')
      return Effect.runPromise(session.closeWindow(windowId))
    },
    [session]
  )

  // Persistence
  const getSnapshot = useCallback(async (): Promise<SessionState> => {
    if (!session) throw new Error('Session not ready')
    return Effect.runPromise(session.getSnapshot)
  }, [session])

  const restoreSnapshot = useCallback(
    async (snapshot: Partial<SessionState>): Promise<void> => {
      if (!session) throw new Error('Session not ready')
      return Effect.runPromise(session.restoreSnapshot(snapshot))
    },
    [session]
  )

  const clear = useCallback(async (): Promise<void> => {
    if (!session) throw new Error('Session not ready')
    return Effect.runPromise(session.clear)
  }, [session])

  return useMemo(
    () => ({
      isReady,
      // Tab operations
      createTab,
      setActiveTab,
      closeTab,
      updateTab,
      reorderTabs,
      // Window operations
      createWindow,
      focusWindow,
      updateWindow,
      closeWindow,
      // Persistence
      getSnapshot,
      restoreSnapshot,
      clear,
    }),
    [
      isReady,
      createTab,
      setActiveTab,
      closeTab,
      updateTab,
      reorderTabs,
      createWindow,
      focusWindow,
      updateWindow,
      closeWindow,
      getSnapshot,
      restoreSnapshot,
      clear,
    ]
  )
}
