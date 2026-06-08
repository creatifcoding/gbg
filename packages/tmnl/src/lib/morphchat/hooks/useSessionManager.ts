import { useCallback, useEffect } from 'react'
import { useAtom, useAtomValue } from '@effect-atom/atom-react'
import { morphChatRegistry } from '../atoms/registry'
import {
  archiveSessionOp$,
  deleteSessionOp$,
  drawerSessionList$,
  ensureSessionV2AtomBridge,
  filteredDrawerSessionList$,
  forkSessionOp$,
  refreshSessionSourcesOp$,
  renameSessionOp$,
  sessionError$,
  sessionFetchDiagnostics$,
  sessionLoading$,
  sessionOperation$,
  sessionQuery$,
  starSessionOp$,
  upsertDrawerSessionAnnotation,
  v2SessionDiagnostics$,
  type DrawerSessionListItem,
  type SessionFetchDiagnostics,
  type SessionManagerFilter,
  type SessionManagerQuery,
  type SessionOperationState,
  type SessionV2Diagnostics,
} from '../atoms/session-manager'

export type { DrawerSessionListItem } from '../atoms/session-manager'

export interface UseSessionManagerResult {
  readonly sessions: ReadonlyArray<DrawerSessionListItem>
  readonly allSessions: ReadonlyArray<DrawerSessionListItem>
  readonly totalSessions: number
  readonly visibleSessions: number
  readonly loading: boolean
  readonly error: string | null
  readonly operation: SessionOperationState
  readonly diagnostics: SessionFetchDiagnostics
  readonly v2Diagnostics: SessionV2Diagnostics
  readonly piSessionCount: number
  readonly query: SessionManagerQuery
  readonly setSearch: (search: string) => void
  readonly setFilter: (filter: SessionManagerFilter) => void
  readonly rename: (sessionId: string, name: string) => void
  readonly star: (sessionId: string) => void
  readonly enrich: (sessionId: string, patch: { readonly description?: string; readonly tags?: ReadonlyArray<string> }) => void
  readonly archive: (sessionId: string) => void
  readonly deleteSession: (sessionId: string) => void
  readonly fork: (sessionId: string, atSeq?: number) => void
  readonly refresh: () => void
}

/**
 * Session drawer state hook.
 *
 * Dataflow is intentionally atom-native:
 *   runtime.fn refresh → source atoms → derived drawer/filter atoms → dumb UI.
 * The hook owns command callbacks only. It does not merge lists or subscribe to
 * sidecar registries with React state.
 */
export function useSessionManager(instanceId: string): UseSessionManagerResult {
  const [, refreshSources] = useAtom(refreshSessionSourcesOp$)
  const [, renameFn] = useAtom(renameSessionOp$)
  const [, starFn] = useAtom(starSessionOp$)
  const [, archiveFn] = useAtom(archiveSessionOp$)
  const [, deleteFn] = useAtom(deleteSessionOp$)
  const [, forkFn] = useAtom(forkSessionOp$)

  useEffect(() => ensureSessionV2AtomBridge(), [])

  const allSessions = useAtomValue(drawerSessionList$(instanceId))
  const sessions = useAtomValue(filteredDrawerSessionList$(instanceId))
  const query = useAtomValue(sessionQuery$(instanceId))
  const loading = useAtomValue(sessionLoading$(instanceId))
  const error = useAtomValue(sessionError$(instanceId))
  const operation = useAtomValue(sessionOperation$(instanceId))
  const diagnostics = useAtomValue(sessionFetchDiagnostics$(instanceId))
  const v2Diagnostics = useAtomValue(v2SessionDiagnostics$)

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

  const findSession = useCallback((sessionId: string) =>
    morphChatRegistry
      .get(drawerSessionList$(instanceId))
      .find((session) => session.sessionId === sessionId), [instanceId])

  const rename = useCallback((sessionId: string, name: string) => {
    const target = findSession(sessionId)
    if (!target) return

    if (target.sourceKind === 'pi-cli' || target.sourceKind === 'local') {
      upsertDrawerSessionAnnotation({ ref: target.sourceRef, name })
      return
    }

    renameFn({ instanceId, sessionId, name })
  }, [findSession, instanceId, renameFn])

  const star = useCallback((sessionId: string) => {
    const target = findSession(sessionId)
    if (!target) return

    if (target.sourceKind === 'pi-cli' || target.sourceKind === 'local') {
      upsertDrawerSessionAnnotation({ ref: target.sourceRef, blessed: !target.starred })
      return
    }

    starFn({ instanceId, sessionId })
  }, [findSession, instanceId, starFn])

  const enrich = useCallback((sessionId: string, patch: { readonly description?: string; readonly tags?: ReadonlyArray<string> }) => {
    const target = findSession(sessionId)
    if (!target) return

    upsertDrawerSessionAnnotation({
      ref: target.sourceRef,
      description: patch.description,
      tags: patch.tags,
    })
  }, [findSession])

  const archive = useCallback((sessionId: string) => {
    const target = findSession(sessionId)
    if (!target || target.sourceKind !== 'harness') return
    archiveFn({ instanceId, sessionId })
  }, [archiveFn, findSession, instanceId])

  const deleteSession = useCallback((sessionId: string) => {
    const target = findSession(sessionId)
    if (!target || target.sourceKind !== 'harness') return
    deleteFn({ instanceId, sessionId })
  }, [deleteFn, findSession, instanceId])

  const fork = useCallback((sessionId: string, atSeq?: number) => {
    const target = findSession(sessionId)
    if (!target || target.sourceKind !== 'harness') return
    forkFn({ instanceId, sessionId, atSeq })
  }, [findSession, forkFn, instanceId])

  const refresh = useCallback(() => {
    // `refreshSessionSourcesOp$` is the correct drawer command: one operation
    // envelope, two source atoms.
    refreshSources({
      instanceId,
      piOptions: {
        scope: 'current-plus-all',
        limit: 500,
      },
    })
  }, [refreshSources, instanceId])

  useEffect(() => {
    refresh()
  }, [instanceId, refresh])

  return {
    sessions,
    allSessions,
    totalSessions: allSessions.length,
    visibleSessions: sessions.length,
    loading,
    error,
    operation,
    diagnostics,
    v2Diagnostics,
    piSessionCount: allSessions.filter((session) => session.sourceKind === 'pi-cli').length,
    query,
    setSearch,
    setFilter,
    rename,
    star,
    enrich,
    archive,
    deleteSession,
    fork,
    refresh,
  }
}
