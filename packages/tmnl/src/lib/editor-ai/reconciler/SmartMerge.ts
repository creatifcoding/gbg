/**
 * Smart Merge Algorithm
 *
 * LCS-based differ for ProseMirror documents.
 * Computes minimal edit operations to transform old document → new document.
 *
 * Strategy:
 * 1. Block-level LCS: Find common blocks that don't need mutation
 * 2. Content-level LCS: For modified blocks, find common text spans
 * 3. Generate MergeOps: INSERT, DELETE, UPDATE, MOVE operations
 *
 * Key insight: Block identity is determined by content hash + type.
 * This allows detecting moves vs insert/delete pairs.
 *
 * @module editor-ai/reconciler/SmartMerge
 */

import type { JSONNode, JSONDocument } from './types'

// =============================================================================
// Merge Operation Types
// =============================================================================

/**
 * Operations the merger can emit
 */
export type MergeOp =
  | { readonly type: 'INSERT'; readonly node: JSONNode; readonly index: number }
  | { readonly type: 'DELETE'; readonly index: number }
  | {
      readonly type: 'UPDATE'
      readonly index: number
      readonly from: JSONNode
      readonly to: JSONNode
    }
  | {
      readonly type: 'MOVE'
      readonly fromIndex: number
      readonly toIndex: number
    }
  | { readonly type: 'NOOP'; readonly index: number }

/**
 * Result of merge computation
 */
export interface MergeResult {
  readonly ops: readonly MergeOp[]
  readonly stats: MergeStats
}

export interface MergeStats {
  readonly inserted: number
  readonly deleted: number
  readonly updated: number
  readonly moved: number
  readonly unchanged: number
}

// =============================================================================
// Block Identity
// =============================================================================

/**
 * Compute a stable identity hash for a JSONNode.
 * Used to detect same blocks across positions.
 */
function computeBlockHash(node: JSONNode): string {
  // For text nodes, hash is type + text content
  if (node.type === 'text' && node.text) {
    return `text:${node.text}`
  }

  // For container nodes, include type + attrs + shallow content hash
  const attrsHash = node.attrs ? JSON.stringify(node.attrs) : ''
  const contentHash = node.content
    ? node.content.map((c) => c.type).join(',')
    : ''

  return `${node.type}:${attrsHash}:${contentHash}`
}

/**
 * Deep equality check for JSONNode
 */
function nodesEqual(a: JSONNode, b: JSONNode): boolean {
  if (a.type !== b.type) return false
  if (a.text !== b.text) return false

  // Compare attrs
  const attrsA = JSON.stringify(a.attrs ?? {})
  const attrsB = JSON.stringify(b.attrs ?? {})
  if (attrsA !== attrsB) return false

  // Compare marks
  const marksA = JSON.stringify(a.marks ?? [])
  const marksB = JSON.stringify(b.marks ?? [])
  if (marksA !== marksB) return false

  // Compare content recursively
  const contentA = a.content ?? []
  const contentB = b.content ?? []
  if (contentA.length !== contentB.length) return false

  for (let i = 0; i < contentA.length; i++) {
    if (!nodesEqual(contentA[i]!, contentB[i]!)) return false
  }

  return true
}

// =============================================================================
// LCS Algorithm
// =============================================================================

interface LCSEntry {
  readonly oldIndex: number
  readonly newIndex: number
}

/**
 * Compute Longest Common Subsequence of two node arrays.
 * Uses dynamic programming with O(n*m) time and space.
 */
function computeLCS(
  oldNodes: readonly JSONNode[],
  newNodes: readonly JSONNode[]
): readonly LCSEntry[] {
  const n = oldNodes.length
  const m = newNodes.length

  // Build hash maps for quick lookup
  const oldHashes = oldNodes.map(computeBlockHash)
  const newHashes = newNodes.map(computeBlockHash)

  // DP table for LCS length
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0)
  )

  // Fill DP table
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldHashes[i - 1] === newHashes[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
      }
    }
  }

  // Backtrack to find LCS
  const lcs: LCSEntry[] = []
  let i = n
  let j = m

  while (i > 0 && j > 0) {
    if (oldHashes[i - 1] === newHashes[j - 1]) {
      lcs.unshift({ oldIndex: i - 1, newIndex: j - 1 })
      i--
      j--
    } else if (dp[i - 1]![j]! > dp[i]![j - 1]!) {
      i--
    } else {
      j--
    }
  }

  return lcs
}

// =============================================================================
// Merge Algorithm
// =============================================================================

/**
 * Compute merge operations to transform oldNodes → newNodes.
 *
 * Algorithm:
 * 1. Compute LCS to find stable anchors
 * 2. Walk both arrays with LCS as guide
 * 3. Emit DELETE for old nodes not in LCS
 * 4. Emit INSERT for new nodes not in LCS
 * 5. Emit UPDATE for LCS nodes that differ in details
 * 6. Detect MOVEs by finding matching hashes in different positions
 */
export function computeMergeOps(
  oldNodes: readonly JSONNode[],
  newNodes: readonly JSONNode[]
): MergeResult {
  const lcs = computeLCS(oldNodes, newNodes)
  const ops: MergeOp[] = []

  const stats: MergeStats = {
    inserted: 0,
    deleted: 0,
    updated: 0,
    moved: 0,
    unchanged: 0,
  }

  // Build sets for quick LCS membership check
  const lcsOldIndices = new Set(lcs.map((e) => e.oldIndex))
  const lcsNewIndices = new Set(lcs.map((e) => e.newIndex))

  // Track which old nodes were matched (for move detection)
  const oldMatched = new Set<number>()
  const newMatched = new Set<number>()

  // Phase 1: Mark LCS matches
  for (const entry of lcs) {
    oldMatched.add(entry.oldIndex)
    newMatched.add(entry.newIndex)

    const oldNode = oldNodes[entry.oldIndex]!
    const newNode = newNodes[entry.newIndex]!

    if (nodesEqual(oldNode, newNode)) {
      ops.push({ type: 'NOOP', index: entry.newIndex })
      ;(stats as { unchanged: number }).unchanged++
    } else {
      ops.push({
        type: 'UPDATE',
        index: entry.newIndex,
        from: oldNode,
        to: newNode,
      })
      ;(stats as { updated: number }).updated++
    }
  }

  // Phase 2: Find deletions (old nodes not in LCS)
  const deletions: number[] = []
  for (let i = 0; i < oldNodes.length; i++) {
    if (!lcsOldIndices.has(i)) {
      deletions.push(i)
    }
  }

  // Phase 3: Find insertions (new nodes not in LCS)
  const insertions: number[] = []
  for (let i = 0; i < newNodes.length; i++) {
    if (!lcsNewIndices.has(i)) {
      insertions.push(i)
    }
  }

  // Phase 4: Detect moves (matching hashes in different positions)
  // A move is when a deletion and insertion have matching hashes
  const oldHashMap = new Map<string, number>()
  for (const oldIdx of deletions) {
    const hash = computeBlockHash(oldNodes[oldIdx]!)
    oldHashMap.set(hash, oldIdx)
  }

  const moves: Array<{ from: number; to: number }> = []
  const movedInsertions = new Set<number>()

  for (const newIdx of insertions) {
    const hash = computeBlockHash(newNodes[newIdx]!)
    if (oldHashMap.has(hash)) {
      const oldIdx = oldHashMap.get(hash)!
      moves.push({ from: oldIdx, to: newIdx })
      movedInsertions.add(newIdx)
      oldHashMap.delete(hash) // Each old node can only match once
    }
  }

  // Phase 5: Emit operations
  // Deletions (excluding moves)
  for (const oldIdx of deletions) {
    const isMove = moves.some((m) => m.from === oldIdx)
    if (!isMove) {
      ops.push({ type: 'DELETE', index: oldIdx })
      ;(stats as { deleted: number }).deleted++
    }
  }

  // Moves
  for (const move of moves) {
    ops.push({ type: 'MOVE', fromIndex: move.from, toIndex: move.to })
    ;(stats as { moved: number }).moved++
  }

  // Insertions (excluding moves)
  for (const newIdx of insertions) {
    if (!movedInsertions.has(newIdx)) {
      ops.push({ type: 'INSERT', node: newNodes[newIdx]!, index: newIdx })
      ;(stats as { inserted: number }).inserted++
    }
  }

  // Sort operations for deterministic application order
  ops.sort((a, b) => {
    // Process in order: DELETE, MOVE, INSERT, UPDATE, NOOP
    const order = { DELETE: 0, MOVE: 1, INSERT: 2, UPDATE: 3, NOOP: 4 }
    const orderDiff = order[a.type] - order[b.type]
    if (orderDiff !== 0) return orderDiff

    // Within same type, sort by index
    const indexA = 'index' in a ? a.index : 'toIndex' in a ? a.toIndex : 0
    const indexB = 'index' in b ? b.index : 'toIndex' in b ? b.toIndex : 0
    return indexA - indexB
  })

  return { ops, stats }
}

// =============================================================================
// Document-Level Merge
// =============================================================================

/**
 * Merge two JSON documents, computing minimal operations.
 */
export function mergeDocuments(
  oldDoc: JSONDocument,
  newDoc: JSONDocument
): MergeResult {
  const oldContent = oldDoc.content ?? []
  const newContent = newDoc.content ?? []

  return computeMergeOps(oldContent, newContent)
}

// =============================================================================
// Content-Level Merge (for text within blocks)
// =============================================================================

/**
 * Compute text diff for inline content.
 * Uses character-level LCS for fine-grained updates.
 */
export function computeTextDiff(
  oldText: string,
  newText: string
): readonly TextOp[] {
  // Simple Myers-like diff for text
  const ops: TextOp[] = []

  // Quick check for identical
  if (oldText === newText) {
    return [{ type: 'RETAIN', length: oldText.length }]
  }

  // Quick check for append
  if (newText.startsWith(oldText)) {
    return [
      { type: 'RETAIN', length: oldText.length },
      { type: 'INSERT', text: newText.slice(oldText.length) },
    ]
  }

  // Quick check for prepend
  if (newText.endsWith(oldText)) {
    return [
      { type: 'INSERT', text: newText.slice(0, newText.length - oldText.length) },
      { type: 'RETAIN', length: oldText.length },
    ]
  }

  // Full diff using simple algorithm
  // Find longest common prefix
  let prefixLen = 0
  while (
    prefixLen < oldText.length &&
    prefixLen < newText.length &&
    oldText[prefixLen] === newText[prefixLen]
  ) {
    prefixLen++
  }

  // Find longest common suffix (after prefix)
  let suffixLen = 0
  while (
    suffixLen < oldText.length - prefixLen &&
    suffixLen < newText.length - prefixLen &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++
  }

  if (prefixLen > 0) {
    ops.push({ type: 'RETAIN', length: prefixLen })
  }

  const deleteLen = oldText.length - prefixLen - suffixLen
  const insertText = newText.slice(prefixLen, newText.length - suffixLen)

  if (deleteLen > 0) {
    ops.push({ type: 'DELETE', length: deleteLen })
  }

  if (insertText.length > 0) {
    ops.push({ type: 'INSERT', text: insertText })
  }

  if (suffixLen > 0) {
    ops.push({ type: 'RETAIN', length: suffixLen })
  }

  return ops
}

export type TextOp =
  | { readonly type: 'RETAIN'; readonly length: number }
  | { readonly type: 'INSERT'; readonly text: string }
  | { readonly type: 'DELETE'; readonly length: number }

// =============================================================================
// Exports
// =============================================================================

export { computeBlockHash, nodesEqual, computeLCS }
