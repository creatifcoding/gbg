import { useCallback, useEffect, useMemo } from 'react'
import { useAtom, useAtomValue } from '@effect-atom/atom-react'
import { morphChatRegistry } from '../atoms/registry'
import {
  archiveSessionOp$,
  deleteSessionOp$,
  fetchSessionsOp$,
  forkSessionOp$,
  renameSessionOp$,
  sessionError$,
  sessionList$,
  sessionLoading$,
  sessionOperation$,
  sessionQuery$,
  starSessionOp$,
  type SessionManagerFilter,
  type SessionManagerQuery,
  type SessionOperationState,
} from '../atoms/session-manager'
import type { SessionListItem } from '@/lib/harness/HarnessRuntime'

export interface UseSessionManagerResult {
  readonly sessions: ReadonlyArray<SessionListItem>
  readonly totalSessions: number
  readonly loading: boolean
  readonly error: string | null
  readonly operation: SessionOperationState
  readonly query: SessionManagerQuery
  readonly setSearch: (search: string) => void
  readonly setFilter: (filter: SessionManagerFilter) => void
  readonly rename: (sessionId: string, name: string) => void
  readonly star: (sessionId: string) => void
  readonly archive: (sessionId: string) => void
  readonly deleteSession: (sessionId: string) => void
  readonly fork: (sessionId: string, atSeq?: number) => void
  readonly refresh: () => void
}

export function useSessionManager(instanceId: string): UseSessionManagerResult {
  const [, fetchSessions] = useAtom(fetchSessionsOp$)
  const [, renameFn] = useAtom(renameSessionOp$)
  const [, starFn] = useAtom(starSessionOp$)
  const [, archiveFn] = useAtom(archiveSessionOp$)
  const [, deleteFn] = useAtom(deleteSessionOp$)
  const [, forkFn] = useAtom(forkSessionOp$)

  const allSessions = useAtomValue(sessionList$(instanceId))
  const query = useAtomValue(sessionQuery$(instanceId))
  const loading = useAtomValue(sessionLoading$(instanceId))
  const error = useAtomValue(sessionError$(instanceId))
  const operation = useAtomValue(sessionOperation$(instanceId))

  const filteredSessions = useMemo(() => {
    const normalizedSearch = query.search.trim().toLowerCase()

    return [...allSessions]
      .filter((session) => {
        if (query.filter === 'starred' && !session.starred) return false
        if (query.filter === 'archived' && session.status !== 'archived') return false

        if (!normalizedSearch) return true

        const haystack = [
          session.name,
          session.autoTitle,
          session.previewSnippet,
          session.provider,
          session.modelId,
          ...session.tags,
        ]
          .join(' ')
          .toLowerCase()

        return haystack.includes(normalizedSearch)
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [allSessions, query.filter, query.search])

  const setSearch = useCallback((search: string) => {
    const current = morphChatRegistry.get(sessionQuery$(instanceId))
    morphChatRegistry.set(sessionQuery$(instanceId), {
      ...current,
      search,
    })
  }, [instanceId])

  const setFilter = useCallback((filter: SessionManagerFilter) => {
    const current = morphChatRegistry.get(sessionQuery$(instanceId))
    morphChatRegistry.set(sessionQuery$(instanceId), {
      ...current,
      filter,
    })
  }, [instanceId])

  const rename = useCallback((sessionId: string, name: string) => {
    renameFn({ instanceId, sessionId, name })
  }, [instanceId, renameFn])

  const star = useCallback((sessionId: string) => {
    starFn({ instanceId, sessionId })
  }, [instanceId, starFn])

  const archive = useCallback((sessionId: string) => {
    archiveFn({ instanceId, sessionId })
  }, [instanceId, archiveFn])

  const deleteSession = useCallback((sessionId: string) => {
    deleteFn({ instanceId, sessionId })
  }, [deleteFn, instanceId])

  const fork = useCallback((sessionId: string, atSeq?: number) => {
    forkFn({ instanceId, sessionId, atSeq })
  }, [forkFn, instanceId])

  const refresh = useCallback(() => {
    fetchSessions({ instanceId })
  }, [fetchSessions, instanceId])

  useEffect(() => {
    refresh()
  }, [instanceId, refresh])

  return {
    sessions: filteredSessions,
    totalSessions: allSessions.length,
    loading,
    error,
    operation,
    query,
    setSearch,
    setFilter,
    rename,
    star,
    archive,
    deleteSession,
    fork,
    refresh,
  }
}
