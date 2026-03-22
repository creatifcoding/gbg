/**
 * useSessionBranch — Branch operations for thread view.
 *
 * Provides:
 *   - branchFromMessage(messageId): fork the conversation from a message
 *   - branchPoints: entry IDs that are fork points in the current session
 *   - messageToEntry: maps morphchat message IDs → v2 entry IDs
 *   - switchBranch(entryId): move leaf pointer to a different branch
 *   - getBranchesAt(entryId): list branches from a fork point
 *
 * @module harness/session/v2/useSessionBranch
 */

import { useMemo, useCallback } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import {
  sessionRegistry,
  sessionTree$,
  sessionBranch$,
} from './atoms'
import { branchSession } from './atoms'
import { getBranchPoints } from './tree-ops'
import { getSessionV2Id } from './facade'
import type { HarnessSessionId, EntryId } from './identity'
import type { SessionTree } from './tree'
import type { MessageEntry } from './entries'

// =============================================================================
// Types
// =============================================================================

export interface BranchInfo {
  /** Entry ID of the fork point */
  readonly entryId: EntryId
  /** Number of child branches from this point */
  readonly branchCount: number
  /** Provider message ID (morphchat ID) if available */
  readonly messageId: string | null
}

export interface BranchOption {
  /** Entry ID of the first message on this branch */
  readonly firstEntryId: EntryId
  /** Preview text from the first message */
  readonly preview: string
  /** Number of entries on this branch */
  readonly entryCount: number
  /** Whether this is the currently active branch */
  readonly isActive: boolean
}

export interface UseSessionBranchResult {
  /** Whether branching is available (v2 session wired) */
  readonly available: boolean
  /** Fork points in the current session tree */
  readonly branchPoints: ReadonlyArray<BranchInfo>
  /** Map from morphchat message ID → v2 entry ID */
  readonly messageToEntry: ReadonlyMap<string, EntryId>
  /** Check if a message ID corresponds to a branch point */
  readonly isBranchPoint: (messageId: string) => boolean
  /** Get branch info for a message ID (if it's a fork point) */
  readonly getBranchInfo: (messageId: string) => BranchInfo | null
  /** Get available branches at a fork point */
  readonly getBranchesAt: (messageId: string) => ReadonlyArray<BranchOption>
  /** Fork the conversation from a specific message */
  readonly branchFromMessage: (messageId: string) => boolean
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build a map from providerMessageId → entryId for all message entries.
 */
function buildMessageMap(tree: SessionTree | null): Map<string, EntryId> {
  const map = new Map<string, EntryId>()
  if (!tree) return map

  for (const entry of tree.entries) {
    if (entry._tag === 'MessageEntry' && entry.message.providerMessageId) {
      map.set(entry.message.providerMessageId, entry.id)
    }
  }

  return map
}

/**
 * Find children of a given entry (entries whose parentId matches).
 */
function getChildren(tree: SessionTree, parentId: EntryId): ReadonlyArray<typeof tree.entries[number]> {
  return tree.entries.filter((e) => e.parentId === parentId)
}

/**
 * Walk a branch from an entry, counting entries until a fork or leaf.
 */
function walkBranch(tree: SessionTree, startId: EntryId): { count: number; preview: string } {
  let current = tree.entries.find((e) => e.id === startId)
  let count = 0
  let preview = ''

  while (current) {
    count++
    if (!preview && current._tag === 'MessageEntry') {
      const content = current.message.content
      preview = typeof content === 'string'
        ? content.slice(0, 80) + (content.length > 80 ? '…' : '')
        : '(structured content)'
    }

    // Find next entry in this branch
    const children = tree.entries.filter((e) => e.parentId === current!.id)
    if (children.length !== 1) break // fork or leaf
    current = children[0]
  }

  return { count, preview: preview || 'Empty branch' }
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Branch operations for the thread view.
 *
 * @param instanceId - morphchat instance ID (panel ID)
 */
export function useSessionBranch(instanceId: string): UseSessionBranchResult {
  const sessionId = getSessionV2Id(instanceId)
  const tree = useAtomValue(sessionId ? sessionTree$(sessionId) : sessionTree$('__none__'))

  const messageMap = useMemo(() => buildMessageMap(tree), [tree])

  const branchPoints = useMemo((): BranchInfo[] => {
    if (!tree) return []

    const points = getBranchPoints(tree)
    return points.map((entryId) => {
      const entry = tree.entries.find((e) => e.id === entryId)
      const children = getChildren(tree, entryId)

      let messageId: string | null = null
      if (entry && entry._tag === 'MessageEntry' && entry.message.providerMessageId) {
        messageId = entry.message.providerMessageId
      }

      return {
        entryId,
        branchCount: children.length,
        messageId,
      }
    })
  }, [tree])

  const isBranchPoint = useCallback((messageId: string): boolean => {
    const entryId = messageMap.get(messageId)
    if (!entryId) return false
    return branchPoints.some((bp) => bp.entryId === entryId)
  }, [messageMap, branchPoints])

  const getBranchInfo = useCallback((messageId: string): BranchInfo | null => {
    const entryId = messageMap.get(messageId)
    if (!entryId) return null
    return branchPoints.find((bp) => bp.entryId === entryId) ?? null
  }, [messageMap, branchPoints])

  const getBranchesAt = useCallback((messageId: string): BranchOption[] => {
    if (!tree) return []
    const entryId = messageMap.get(messageId)
    if (!entryId) return []

    const children = getChildren(tree, entryId)
    if (children.length < 2) return [] // Not a fork

    // Determine which branch is active by checking if leafId descends from each child
    const activeBranch = tree.entries.find((e) => e.id === tree.leafId)

    return children.map((child) => {
      const { count, preview } = walkBranch(tree, child.id)

      // Check if current leaf is a descendant of this child
      let isActive = false
      let walk: string | null = tree.leafId
      while (walk) {
        if (walk === child.id) { isActive = true; break }
        const walkEntry = tree.entries.find((e) => e.id === walk)
        walk = walkEntry?.parentId ?? null
      }

      return {
        firstEntryId: child.id,
        preview,
        entryCount: count,
        isActive,
      }
    })
  }, [tree, messageMap])

  const branchFromMessage = useCallback((messageId: string): boolean => {
    if (!sessionId) return false
    const entryId = messageMap.get(messageId)
    if (!entryId) return false
    return branchSession(sessionId, entryId)
  }, [sessionId, messageMap])

  return {
    available: !!sessionId && !!tree,
    branchPoints,
    messageToEntry: messageMap,
    isBranchPoint,
    getBranchInfo,
    getBranchesAt,
    branchFromMessage,
  }
}
