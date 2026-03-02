/**
 * Session Atoms — React Bridge
 *
 * Atom-as-State pattern: Atom.make() IS the primary state.
 * Registry.make() for shared sync access.
 * registry.set(atom, value) for mutations — synchronous, no Effect.
 * React subscribes via useAtomValue inside RegistryContext.Provider.
 *
 * Architecture:
 *   - sessionRegistry: Registry.make() — shared mutable state
 *   - sessionRuntime: Atom.runtime for TierOrchestrator persistence
 *   - Per-session state: Atom.family keyed by HarnessSessionId
 *   - Global state: active session, session list
 *   - Mutation fns: create, resume, branch, compact, dispose
 *
 * @module harness/session/v2/atoms
 */

import { Atom, Registry, RegistryContext } from '@effect-atom/atom-react'
import { createElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { Effect, Layer, ManagedRuntime, Option } from 'effect'
import { KeyValueStore } from '@effect/platform'
import { BrowserKeyValueStore } from '@effect/platform-browser'
import { SessionTree, makeSessionTree } from './tree'
import { SessionMetadata } from './metadata'
import { SessionStore } from './session-store'
import { TierOrchestrator, makeTierOrchestratorLayer } from './tier-orchestrator'
import {
  appendEntry,
  makeMessageEntry,
  branchFrom,
  getBranch,
  buildContext,
  makeCompactionEntry,
  resetEntryCounter,
} from './tree-ops'
import { extractMetadata } from './serialization'
import type { HarnessSessionId, EntryId } from './identity'
import type { SessionMessage, SessionEntry } from './entries'
import type { ContextMessage } from './tree-ops'

// =============================================================================
// Registry — shared sync state for session atoms
// =============================================================================

/** Dedicated registry for all session v2 atoms */
export const sessionRegistry = Registry.make()

/**
 * Provider component — wrap subtrees that consume session state.
 *
 * ```tsx
 * <SessionRegistryProvider>
 *   <SessionPanel />
 * </SessionRegistryProvider>
 * ```
 */
export function SessionRegistryProvider({
  children,
}: {
  children: ReactNode
}): ReactElement {
  return createElement(
    RegistryContext.Provider,
    { value: sessionRegistry },
    children,
  )
}

// =============================================================================
// Runtime — Atom.runtime for persistence services
// =============================================================================

/**
 * Persistence runtime: TierOrchestrator + SessionStore + KVS.
 *
 * ManagedRuntime gives us .runPromise() for fire-and-forget persistence.
 * Swap the KVS layer for IndexedDB/SQLite by providing a different layer:
 *   sessionPersistenceRuntime = ManagedRuntime.make(makeTierOrchestratorLayer(mySqliteLayer))
 */
const defaultPersistenceLayer = makeTierOrchestratorLayer(
  KeyValueStore.layerMemory, // Memory for SSR/test safety; browser code provides localStorage
)
export const sessionPersistenceRuntime = ManagedRuntime.make(defaultPersistenceLayer)

/**
 * Helper: run a persistence effect (fire-and-forget, swallows errors).
 */
function persistEffect(
  effect: Effect.Effect<any, any, TierOrchestrator>,
): void {
  sessionPersistenceRuntime.runPromise(effect).catch(() => {})
}

/**
 * Helper: run a persistence effect and return the result.
 */
function runPersistence<A>(
  effect: Effect.Effect<A, any, TierOrchestrator>,
): Promise<A> {
  return sessionPersistenceRuntime.runPromise(effect)
}

// =============================================================================
// Global State Atoms
// =============================================================================

/** Currently active session ID (one per panel — plurality via panels, not concurrent streams) */
export const activeSessionId$ = Atom.make<HarnessSessionId | null>(null)

/** All known session metadata — lightweight listing view */
export const sessionList$ = Atom.make<ReadonlyArray<SessionMetadata>>([])

/** Loading state for session operations */
export const sessionLoading$ = Atom.make(false)

// =============================================================================
// Per-Session State — Atom.family keyed by session ID
// =============================================================================

/** Full session tree for a loaded session */
export const sessionTree$ = Atom.family((_id: string) =>
  Atom.make<SessionTree | null>(null),
)

/** Current branch entries (root → leaf path) for display */
export const sessionBranch$ = Atom.family((_id: string) =>
  Atom.make<ReadonlyArray<SessionEntry>>([]),
)

/** Context projection for LLM (messages + summaries) */
export const sessionContext$ = Atom.family((_id: string) =>
  Atom.make<ReadonlyArray<ContextMessage>>([]),
)

/** Session metadata (derived from tree on mutation) */
export const sessionMeta$ = Atom.family((_id: string) =>
  Atom.make<SessionMetadata | null>(null),
)

/** Whether this session has unsaved changes */
export const sessionDirty$ = Atom.family((_id: string) =>
  Atom.make(false),
)

// =============================================================================
// Internal helpers — update derived state from tree
// =============================================================================

function syncDerived(id: string, tree: SessionTree): void {
  sessionRegistry.set(sessionTree$(id), tree)
  sessionRegistry.set(sessionBranch$(id), getBranch(tree))
  sessionRegistry.set(sessionContext$(id), buildContext(tree))
  sessionRegistry.set(sessionMeta$(id), extractMetadata(tree) as SessionMetadata)
  sessionRegistry.set(sessionDirty$(id), true)
}

// =============================================================================
// Mutation Operations
// =============================================================================

/**
 * Create a new session and make it active.
 */
export function createSession(opts: {
  cwd: string
  parentSession?: HarnessSessionId
}): HarnessSessionId {
  resetEntryCounter()
  const id = crypto.randomUUID() as HarnessSessionId
  const tree = makeSessionTree({ id, cwd: opts.cwd, ...opts })

  syncDerived(id, tree)
  sessionRegistry.set(activeSessionId$, id)

  // Fire-and-forget persist
  persistEffect(
    Effect.gen(function* () {
      const orch = yield* TierOrchestrator
      yield* orch.persist(tree)
    }),
  )

  // Update session list
  refreshSessionList()

  return id
}

/**
 * Resume (hydrate) a session from storage.
 */
export async function resumeSession(
  id: HarnessSessionId,
): Promise<boolean> {
  sessionRegistry.set(sessionLoading$, true)
  try {
    const tree = await runPersistence(
      Effect.gen(function* () {
        const orch = yield* TierOrchestrator
        return yield* orch.hydrate(id)
      }),
    )

    if (Option.isNone(tree)) {
      sessionRegistry.set(sessionLoading$, false)
      return false
    }

    syncDerived(id, tree.value)
    sessionRegistry.set(activeSessionId$, id)
    sessionRegistry.set(sessionDirty$(id), false) // freshly loaded
    sessionRegistry.set(sessionLoading$, false)
    return true
  } catch {
    sessionRegistry.set(sessionLoading$, false)
    return false
  }
}

/**
 * Append a message to the active session.
 */
export function appendMessage(
  id: HarnessSessionId,
  message: SessionMessage,
): EntryId | null {
  const tree = sessionRegistry.get(sessionTree$(id))
  if (!tree) return null

  const entry = makeMessageEntry(tree, message)
  const newTree = appendEntry(tree, entry)
  syncDerived(id, newTree)

  // Fire-and-forget persist
  sessionPersistenceRuntime.runPromise(
    Effect.gen(function* () {
      const orch = yield* TierOrchestrator
      yield* orch.persist(newTree)
    }),
  )

  return entry.id
}

/**
 * Append a raw entry (non-message) to the session.
 */
export function appendRawEntry(
  id: HarnessSessionId,
  entry: SessionEntry,
): boolean {
  const tree = sessionRegistry.get(sessionTree$(id))
  if (!tree) return false

  const newTree = appendEntry(tree, entry)
  syncDerived(id, newTree)

  persistEffect(
    Effect.gen(function* () {
      const orch = yield* TierOrchestrator
      yield* orch.persist(newTree)
    }),
  )

  return true
}

/**
 * Branch from an entry — move the leaf pointer to create an alternate path.
 */
export function branchSession(
  id: HarnessSessionId,
  fromEntryId: EntryId,
): boolean {
  const tree = sessionRegistry.get(sessionTree$(id))
  if (!tree) return false

  try {
    const newTree = branchFrom(tree, fromEntryId)
    syncDerived(id, newTree)

    persistEffect(
      Effect.gen(function* () {
        const orch = yield* TierOrchestrator
        yield* orch.persist(newTree)
      }),
    )

    return true
  } catch {
    return false
  }
}

/**
 * Compact the current branch — append a CompactionEntry.
 */
export function compactSession(
  id: HarnessSessionId,
  summary: string,
  firstKeptEntryId: EntryId,
  tokensBefore: number,
): EntryId | null {
  const tree = sessionRegistry.get(sessionTree$(id))
  if (!tree) return null

  const entry = makeCompactionEntry(tree, summary, firstKeptEntryId, tokensBefore)
  const newTree = appendEntry(tree, entry)
  syncDerived(id, newTree)

  sessionPersistenceRuntime.runPromise(
    Effect.gen(function* () {
      const orch = yield* TierOrchestrator
      yield* orch.persist(newTree)
    }),
  )

  return entry.id
}

/**
 * Dispose (delete) a session from all tiers.
 */
export async function disposeSession(
  id: HarnessSessionId,
): Promise<void> {
  // Clear atoms
  sessionRegistry.set(sessionTree$(id), null)
  sessionRegistry.set(sessionBranch$(id), [])
  sessionRegistry.set(sessionContext$(id), [])
  sessionRegistry.set(sessionMeta$(id), null)
  sessionRegistry.set(sessionDirty$(id), false)

  // If this was active, clear it
  if (sessionRegistry.get(activeSessionId$) === id) {
    sessionRegistry.set(activeSessionId$, null)
  }

  // Purge from storage
  await runPersistence(
    Effect.gen(function* () {
      const orch = yield* TierOrchestrator
      yield* orch.purge(id)
    }),
  )

  refreshSessionList()
}

/**
 * Export session as JSONL string (frozen format).
 */
export async function exportSession(
  id: HarnessSessionId,
): Promise<string | null> {
  try {
    const result = await runPersistence(
      Effect.gen(function* () {
        const orch = yield* TierOrchestrator
        return yield* orch.exportJsonl(id)
      }),
    )
    return Option.isSome(result) ? result.value : null
  } catch {
    return null
  }
}

/**
 * Import session from JSONL string.
 */
export async function importSession(
  jsonl: string,
): Promise<HarnessSessionId | null> {
  try {
    const tree = await runPersistence(
      Effect.gen(function* () {
        const orch = yield* TierOrchestrator
        return yield* orch.importJsonl(jsonl)
      }),
    )
    syncDerived(tree.header.id, tree)
    refreshSessionList()
    return tree.header.id
  } catch {
    return null
  }
}

/**
 * Refresh the session list from cold storage.
 */
export function refreshSessionList(): void {
  sessionPersistenceRuntime.runPromise(
    Effect.gen(function* () {
      const orch = yield* TierOrchestrator
      const metas = yield* orch.listSessions()
      sessionRegistry.set(sessionList$, metas)
    }),
  )
}

/**
 * Save the current tree for a session (manual flush).
 */
export function flushSession(id: HarnessSessionId): void {
  const tree = sessionRegistry.get(sessionTree$(id))
  if (!tree) return

  persistEffect(
    Effect.gen(function* () {
      const orch = yield* TierOrchestrator
      yield* orch.persist(tree)
    }),
  )

  sessionRegistry.set(sessionDirty$(id), false)
}
