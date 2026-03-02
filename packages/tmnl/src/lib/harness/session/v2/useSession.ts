/**
 * useSession — React Hook for Session V2
 *
 * Typed consumer API for session state and operations.
 * Subscribes to atoms directly — no intermediate refs.
 *
 * Usage:
 *   const session = useSession()          // global (active session)
 *   const session = useSession(sessionId) // specific session
 *
 * @module harness/session/v2/useSession
 */

import { useMemo, useCallback } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import {
  activeSessionId$,
  sessionList$,
  sessionLoading$,
  sessionTree$,
  sessionBranch$,
  sessionContext$,
  sessionMeta$,
  sessionDirty$,
  createSession,
  resumeSession,
  appendMessage,
  appendRawEntry,
  branchSession,
  compactSession,
  disposeSession,
  exportSession,
  importSession,
  refreshSessionList,
  flushSession,
} from './atoms'
import type { HarnessSessionId, EntryId } from './identity'
import type { SessionMessage, SessionEntry } from './entries'
import type { SessionTree } from './tree'
import type { SessionMetadata } from './metadata'
import type { ContextMessage } from './tree-ops'

// =============================================================================
// Hook return type
// =============================================================================

export interface UseSessionResult {
  // -- State (reactive) ------------------------------------------------------

  /** Currently active session ID */
  readonly activeId: HarnessSessionId | null
  /** Whether a session operation is in progress */
  readonly isLoading: boolean
  /** All known sessions (metadata only) */
  readonly sessions: ReadonlyArray<SessionMetadata>

  // -- Per-session state (reactive, null if no session loaded) ----------------

  /** Full session tree */
  readonly tree: SessionTree | null
  /** Current branch entries (root → leaf) */
  readonly branch: ReadonlyArray<SessionEntry>
  /** Context projection for LLM */
  readonly context: ReadonlyArray<ContextMessage>
  /** Session metadata */
  readonly meta: SessionMetadata | null
  /** Whether session has unsaved changes */
  readonly isDirty: boolean

  // -- Operations ------------------------------------------------------------

  /** Create a new session, returns its ID */
  readonly create: (opts: { cwd: string; parentSession?: HarnessSessionId }) => HarnessSessionId
  /** Resume a session from storage */
  readonly resume: (id: HarnessSessionId) => Promise<boolean>
  /** Append a message to the session */
  readonly append: (message: SessionMessage) => EntryId | null
  /** Append a raw entry */
  readonly appendEntry: (entry: SessionEntry) => boolean
  /** Branch from an entry */
  readonly branch_: (fromEntryId: EntryId) => boolean
  /** Compact current branch */
  readonly compact: (summary: string, firstKeptEntryId: EntryId, tokensBefore: number) => EntryId | null
  /** Dispose (delete) a session */
  readonly dispose: (id?: HarnessSessionId) => Promise<void>
  /** Export session as JSONL */
  readonly export_: (id?: HarnessSessionId) => Promise<string | null>
  /** Import session from JSONL */
  readonly import_: (jsonl: string) => Promise<HarnessSessionId | null>
  /** Refresh session list from storage */
  readonly refresh: () => void
  /** Manually flush session to storage */
  readonly flush: () => void
}

// =============================================================================
// Hook
// =============================================================================

/**
 * React hook for session management.
 *
 * Without args: uses the active session.
 * With sessionId: targets a specific session.
 *
 * All state is reactive via atom subscriptions.
 * Operations mutate atoms directly — instant UI.
 * Persistence is fire-and-forget in the background.
 */
export function useSession(sessionId?: HarnessSessionId): UseSessionResult {
  // Global state
  const activeId = useAtomValue(activeSessionId$)
  const isLoading = useAtomValue(sessionLoading$)
  const sessions = useAtomValue(sessionList$)

  // Resolve which session we're targeting
  const targetId = sessionId ?? activeId

  // Per-session state (null-safe via family default)
  const tree = useAtomValue(sessionTree$(targetId ?? ''))
  const branch = useAtomValue(sessionBranch$(targetId ?? ''))
  const context = useAtomValue(sessionContext$(targetId ?? ''))
  const meta = useAtomValue(sessionMeta$(targetId ?? ''))
  const isDirty = useAtomValue(sessionDirty$(targetId ?? ''))

  // Memoized operations
  const create = useCallback(
    (opts: { cwd: string; parentSession?: HarnessSessionId }) =>
      createSession(opts),
    [],
  )

  const resume = useCallback(
    (id: HarnessSessionId) => resumeSession(id),
    [],
  )

  const append = useCallback(
    (message: SessionMessage) => {
      if (!targetId) return null
      return appendMessage(targetId, message)
    },
    [targetId],
  )

  const appendEntryFn = useCallback(
    (entry: SessionEntry) => {
      if (!targetId) return false
      return appendRawEntry(targetId, entry)
    },
    [targetId],
  )

  const branchFn = useCallback(
    (fromEntryId: EntryId) => {
      if (!targetId) return false
      return branchSession(targetId, fromEntryId)
    },
    [targetId],
  )

  const compact = useCallback(
    (summary: string, firstKeptEntryId: EntryId, tokensBefore: number) => {
      if (!targetId) return null
      return compactSession(targetId, summary, firstKeptEntryId, tokensBefore)
    },
    [targetId],
  )

  const dispose = useCallback(
    async (id?: HarnessSessionId) => {
      const resolvedId = id ?? targetId
      if (!resolvedId) return
      return disposeSession(resolvedId)
    },
    [targetId],
  )

  const exportFn = useCallback(
    async (id?: HarnessSessionId) => {
      const resolvedId = id ?? targetId
      if (!resolvedId) return null
      return exportSession(resolvedId)
    },
    [targetId],
  )

  const importFn = useCallback(
    (jsonl: string) => importSession(jsonl),
    [],
  )

  const refresh = useCallback(() => refreshSessionList(), [])
  const flush = useCallback(() => {
    if (targetId) flushSession(targetId)
  }, [targetId])

  return useMemo(
    () => ({
      // State
      activeId,
      isLoading,
      sessions,
      tree,
      branch,
      context,
      meta,
      isDirty,
      // Operations
      create,
      resume,
      append,
      appendEntry: appendEntryFn,
      branch_: branchFn,
      compact,
      dispose,
      export_: exportFn,
      import_: importFn,
      refresh,
      flush,
    }),
    [
      activeId, isLoading, sessions,
      tree, branch, context, meta, isDirty,
      create, resume, append, appendEntryFn,
      branchFn, compact, dispose, exportFn, importFn,
      refresh, flush,
    ],
  )
}
