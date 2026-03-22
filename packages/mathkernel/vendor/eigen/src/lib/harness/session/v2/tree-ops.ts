/**
 * Session Tree Operations — Pure Functions
 *
 * Append-only tree manipulation. All functions are pure:
 * they take a SessionTree and return a new SessionTree.
 * No service infrastructure — compose with pipe, test directly.
 *
 * Reference: pi's SessionManager (append-only tree with parentId chains)
 *
 * @module harness/session/v2/tree-ops
 */

import type { EntryId } from './identity'
import type { SessionEntry, SessionMessage, MessageEntry, CompactionEntry } from './entries'
import type { SessionTree } from './tree'

// =============================================================================
// Core Operations
// =============================================================================

/**
 * Append an entry to the session tree.
 *
 * - Adds entry to the entries array
 * - Updates leafId to the new entry
 * - Entry's parentId should point to the current leafId (caller responsibility)
 *
 * Returns a new tree — does NOT mutate the input.
 */
export function appendEntry(tree: SessionTree, entry: SessionEntry): SessionTree {
  return {
    ...tree,
    entries: [...tree.entries, entry],
    leafId: entry.id,
  }
}

/**
 * Create a branch from a specific entry in the tree.
 *
 * Moves the leafId pointer to the branch point.
 * The next appendEntry will fork from there.
 *
 * Returns a new tree with updated leafId.
 */
export function branchFrom(tree: SessionTree, fromEntryId: EntryId): SessionTree {
  const exists = tree.entries.some((e) => e.id === fromEntryId)
  if (!exists) {
    throw new Error(`Cannot branch from non-existent entry: ${fromEntryId}`)
  }
  return {
    ...tree,
    leafId: fromEntryId,
  }
}

/**
 * Get the current branch — walk parentId chain from leafId to root.
 *
 * Returns entries in chronological order (root → leaf).
 * This is the active conversation path.
 */
export function getBranch(tree: SessionTree): ReadonlyArray<SessionEntry> {
  if (tree.leafId === null) return []

  // Build byId index for O(1) lookup
  const byId = new Map<string, SessionEntry>()
  for (const entry of tree.entries) {
    byId.set(entry.id, entry)
  }

  // Walk parentId chain from leaf to root
  const chain: SessionEntry[] = []
  let current: SessionEntry | undefined = byId.get(tree.leafId)
  while (current) {
    chain.push(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }

  // Reverse for chronological order
  return chain.reverse()
}

/**
 * Get a specific entry by ID.
 */
export function getEntry(tree: SessionTree, entryId: EntryId): SessionEntry | undefined {
  return tree.entries.find((e) => e.id === entryId)
}

/**
 * Get all children of a specific entry.
 */
export function getChildren(tree: SessionTree, parentId: EntryId): ReadonlyArray<SessionEntry> {
  return tree.entries.filter((e) => e.parentId === parentId)
}

/**
 * Get branch points — entries with more than one child.
 */
export function getBranchPoints(tree: SessionTree): ReadonlyArray<EntryId> {
  const childCount = new Map<string, number>()
  for (const entry of tree.entries) {
    if (entry.parentId) {
      childCount.set(entry.parentId, (childCount.get(entry.parentId) ?? 0) + 1)
    }
  }
  const points: EntryId[] = []
  for (const [id, count] of childCount) {
    if (count > 1) points.push(id as EntryId)
  }
  return points
}

// =============================================================================
// Context Projection — buildContext for LLM
// =============================================================================

/**
 * Build LLM context from the current branch.
 *
 * Walks the branch and extracts messages the LLM should see:
 * - MessageEntry → include
 * - CompactionEntry → include summary as system message
 * - CustomMessageEntry → include if display=true
 * - ThinkingLevelChangeEntry, ModelChangeEntry → skip (metadata only)
 * - CustomEntry → skip (not for LLM)
 * - LabelEntry, SessionInfoEntry → skip (UI only)
 * - BranchSummaryEntry → include summary as system message
 *
 * Returns messages in chronological order ready for the LLM prompt.
 */
export interface ContextMessage {
  readonly role: 'user' | 'assistant' | 'system' | 'tool'
  readonly content: string | ReadonlyArray<unknown>
}

export function buildContext(tree: SessionTree): ReadonlyArray<ContextMessage> {
  const branch = getBranch(tree)
  const messages: ContextMessage[] = []

  for (const entry of branch) {
    switch (entry._tag) {
      case 'MessageEntry':
        messages.push({
          role: entry.message.role,
          content: entry.message.content,
        })
        break

      case 'CompactionEntry':
        messages.push({
          role: 'system',
          content: `[Context Summary] ${entry.summary}`,
        })
        break

      case 'BranchSummaryEntry':
        messages.push({
          role: 'system',
          content: `[Branch Summary] ${entry.summary}`,
        })
        break

      case 'CustomMessageEntry':
        if (entry.display) {
          messages.push({
            role: 'system',
            content: typeof entry.content === 'string'
              ? entry.content
              : JSON.stringify(entry.content),
          })
        }
        break

      // Metadata entries — not sent to LLM
      case 'ThinkingLevelChangeEntry':
      case 'ModelChangeEntry':
      case 'CustomEntry':
      case 'LabelEntry':
      case 'SessionInfoEntry':
        break
    }
  }

  return messages
}

// =============================================================================
// Entry Factories — create entries with proper wiring
// =============================================================================

let _entryCounter = 0

/** Generate a unique entry ID. Simple counter for now — can be replaced with nanoid. */
export function generateEntryId(): EntryId {
  return `entry-${Date.now()}-${++_entryCounter}` as EntryId
}

/** Reset the entry counter (for testing). */
export function resetEntryCounter(): void {
  _entryCounter = 0
}

/** Create a MessageEntry wired to the tree's current leaf. */
export function makeMessageEntry(
  tree: SessionTree,
  message: SessionMessage,
): MessageEntry {
  return {
    _tag: 'MessageEntry',
    id: generateEntryId(),
    parentId: tree.leafId,
    timestamp: new Date().toISOString(),
    message,
  } as MessageEntry
}

/** Create a CompactionEntry wired to the tree's current leaf. */
export function makeCompactionEntry(
  tree: SessionTree,
  summary: string,
  firstKeptEntryId: EntryId,
  tokensBefore: number,
): CompactionEntry {
  return {
    _tag: 'CompactionEntry',
    id: generateEntryId(),
    parentId: tree.leafId,
    timestamp: new Date().toISOString(),
    summary,
    firstKeptEntryId,
    tokensBefore,
  } as CompactionEntry
}
