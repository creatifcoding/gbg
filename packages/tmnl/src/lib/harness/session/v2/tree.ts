/**
 * Session Tree Aggregate Schema
 *
 * The in-memory representation of a full session:
 * header + entries + byId index + leafId pointer.
 *
 * This is what Ref<SessionTree> holds in the service.
 * Pure data — operations are in Phase 2.
 *
 * @module harness/session/v2/tree
 */

import { Schema } from 'effect'
import { HarnessSessionId, EntryId } from './identity'
import { SessionHeader } from './header'
import { SessionEntry } from './entries'

// =============================================================================
// Session Tree — the aggregate
// =============================================================================

/**
 * Complete session tree — the root aggregate.
 *
 * In JSONL:
 * - Line 1: SessionHeader
 * - Lines 2+: SessionEntry (append-only)
 *
 * In memory:
 * - entries: ordered array (append-only)
 * - leafId: current tip of active branch (mutable pointer)
 *
 * The byId index is computed, not serialized.
 */
export const SessionTree = Schema.Struct({
  /** Session file header */
  header: SessionHeader,
  /** All entries in append order */
  entries: Schema.Array(SessionEntry),
  /** Current tip of the active branch (null = empty session) */
  leafId: Schema.NullOr(EntryId),
})
export type SessionTree = typeof SessionTree.Type

// =============================================================================
// Factory helpers — pure constructors
// =============================================================================

/**
 * Create an empty session tree.
 */
export function makeSessionTree(opts: {
  id: HarnessSessionId
  cwd: string
  parentSession?: HarnessSessionId
}): SessionTree {
  return {
    header: {
      _tag: 'SessionHeader',
      version: 1,
      id: opts.id,
      timestamp: new Date().toISOString(),
      cwd: opts.cwd,
      ...(opts.parentSession ? { parentSession: opts.parentSession } : {}),
    },
    entries: [],
    leafId: null,
  }
}

/**
 * Count entries by tag in a session tree.
 */
export function countEntriesByTag(tree: SessionTree): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const entry of tree.entries) {
    counts[entry._tag] = (counts[entry._tag] ?? 0) + 1
  }
  return counts
}
