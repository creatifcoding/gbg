/**
 * Session Tree Operations Tests
 *
 * Unit: pure function correctness
 * Behavior: branch walking, context projection, entry factories
 * Integration: multi-branch trees, compaction + context building
 */

import { describe, it, expect } from '@effect/vitest'
import { beforeEach } from 'vitest'
import { Schema } from 'effect'
import {
  appendEntry,
  branchFrom,
  getBranch,
  getEntry,
  getChildren,
  getBranchPoints,
  buildContext,
  makeMessageEntry,
  makeCompactionEntry,
  generateEntryId,
  resetEntryCounter,
} from '../tree-ops'
import { makeSessionTree } from '../tree'
import { SessionEntry } from '../entries'
import type { SessionTree } from '../tree'
import type { EntryId, HarnessSessionId } from '../identity'

// =============================================================================
// Helpers
// =============================================================================

const TEST_ID = 'test-session' as HarnessSessionId

function makeRawEntry(tag: string, id: string, parentId: string | null, extra: Record<string, any> = {}): SessionEntry {
  return Schema.decodeUnknownSync(SessionEntry)({
    _tag: tag,
    id,
    parentId,
    timestamp: '2026-02-28T14:00:00.000Z',
    ...extra,
  })
}

function emptyTree(): SessionTree {
  return makeSessionTree({ id: TEST_ID, cwd: '/tmp' })
}

// =============================================================================
// Unit: appendEntry
// =============================================================================

describe('appendEntry — Unit', () => {
  it('adds entry and updates leafId', () => {
    const tree = emptyTree()
    const entry = makeRawEntry('MessageEntry', 'e-1', null, {
      message: { role: 'user', content: 'hello' },
    })

    const result = appendEntry(tree, entry)

    expect(result.entries).toHaveLength(1)
    expect(result.leafId).toBe('e-1')
    // Original tree unchanged (immutable)
    expect(tree.entries).toHaveLength(0)
    expect(tree.leafId).toBeNull()
  })

  it('chains appends correctly', () => {
    let tree = emptyTree()
    const e1 = makeRawEntry('MessageEntry', 'e-1', null, {
      message: { role: 'user', content: 'first' },
    })
    const e2 = makeRawEntry('MessageEntry', 'e-2', 'e-1', {
      message: { role: 'assistant', content: 'second' },
    })

    tree = appendEntry(tree, e1)
    tree = appendEntry(tree, e2)

    expect(tree.entries).toHaveLength(2)
    expect(tree.leafId).toBe('e-2')
  })
})

// =============================================================================
// Unit: branchFrom
// =============================================================================

describe('branchFrom — Unit', () => {
  it('moves leafId to branch point', () => {
    let tree = emptyTree()
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-1', null, {
      message: { role: 'user', content: 'first' },
    }))
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-2', 'e-1', {
      message: { role: 'assistant', content: 'second' },
    }))

    const branched = branchFrom(tree, 'e-1' as EntryId)
    expect(branched.leafId).toBe('e-1')
    // Entries unchanged
    expect(branched.entries).toHaveLength(2)
  })

  it('throws for non-existent entry', () => {
    const tree = emptyTree()
    expect(() => branchFrom(tree, 'nonexistent' as EntryId)).toThrow('non-existent')
  })
})

// =============================================================================
// Behavior: getBranch
// =============================================================================

describe('getBranch — Behavior', () => {
  it('returns empty for empty tree', () => {
    expect(getBranch(emptyTree())).toEqual([])
  })

  it('returns linear chain in chronological order', () => {
    let tree = emptyTree()
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-1', null, {
      message: { role: 'user', content: 'first' },
    }))
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-2', 'e-1', {
      message: { role: 'assistant', content: 'second' },
    }))
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-3', 'e-2', {
      message: { role: 'user', content: 'third' },
    }))

    const branch = getBranch(tree)
    expect(branch).toHaveLength(3)
    expect(branch[0].id).toBe('e-1')
    expect(branch[1].id).toBe('e-2')
    expect(branch[2].id).toBe('e-3')
  })

  it('follows correct branch after fork', () => {
    let tree = emptyTree()
    // Main branch: e-1 → e-2 → e-3
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-1', null, {
      message: { role: 'user', content: 'root' },
    }))
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-2', 'e-1', {
      message: { role: 'assistant', content: 'main path' },
    }))
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-3', 'e-2', {
      message: { role: 'user', content: 'main continues' },
    }))

    // Fork from e-1: e-1 → e-4
    tree = branchFrom(tree, 'e-1' as EntryId)
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-4', 'e-1', {
      message: { role: 'assistant', content: 'alt path' },
    }))

    const branch = getBranch(tree)
    expect(branch).toHaveLength(2) // e-1 → e-4
    expect(branch[0].id).toBe('e-1')
    expect(branch[1].id).toBe('e-4')
  })
})

// =============================================================================
// Behavior: getBranchPoints
// =============================================================================

describe('getBranchPoints — Behavior', () => {
  it('returns empty for linear tree', () => {
    let tree = emptyTree()
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-1', null, {
      message: { role: 'user', content: 'a' },
    }))
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-2', 'e-1', {
      message: { role: 'assistant', content: 'b' },
    }))

    expect(getBranchPoints(tree)).toEqual([])
  })

  it('detects fork point', () => {
    let tree = emptyTree()
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-1', null, {
      message: { role: 'user', content: 'root' },
    }))
    // Two children of e-1
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-2', 'e-1', {
      message: { role: 'assistant', content: 'path A' },
    }))
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-3', 'e-1', {
      message: { role: 'assistant', content: 'path B' },
    }))

    const points = getBranchPoints(tree)
    expect(points).toHaveLength(1)
    expect(points[0]).toBe('e-1')
  })
})

// =============================================================================
// Behavior: buildContext
// =============================================================================

describe('buildContext — Behavior', () => {
  it('returns empty for empty tree', () => {
    expect(buildContext(emptyTree())).toEqual([])
  })

  it('includes message entries', () => {
    let tree = emptyTree()
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-1', null, {
      message: { role: 'user', content: 'What is Effect?' },
    }))
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-2', 'e-1', {
      message: { role: 'assistant', content: 'A TypeScript library.' },
    }))

    const ctx = buildContext(tree)
    expect(ctx).toHaveLength(2)
    expect(ctx[0]).toEqual({ role: 'user', content: 'What is Effect?' })
    expect(ctx[1]).toEqual({ role: 'assistant', content: 'A TypeScript library.' })
  })

  it('includes compaction summary as system message', () => {
    let tree = emptyTree()
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-1', null, {
      message: { role: 'user', content: 'old message' },
    }))
    tree = appendEntry(tree, makeRawEntry('CompactionEntry', 'e-2', 'e-1', {
      summary: 'User discussed session architecture.',
      firstKeptEntryId: 'e-1',
      tokensBefore: 50000,
    }))
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-3', 'e-2', {
      message: { role: 'user', content: 'new message' },
    }))

    const ctx = buildContext(tree)
    expect(ctx).toHaveLength(3)
    expect(ctx[1]).toEqual({
      role: 'system',
      content: '[Context Summary] User discussed session architecture.',
    })
  })

  it('skips metadata-only entries', () => {
    let tree = emptyTree()
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-1', null, {
      message: { role: 'user', content: 'hi' },
    }))
    tree = appendEntry(tree, makeRawEntry('ThinkingLevelChangeEntry', 'e-2', 'e-1', {
      thinkingLevel: 'high',
    }))
    tree = appendEntry(tree, makeRawEntry('ModelChangeEntry', 'e-3', 'e-2', {
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-20250514',
    }))
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-4', 'e-3', {
      message: { role: 'assistant', content: 'response' },
    }))

    const ctx = buildContext(tree)
    expect(ctx).toHaveLength(2) // Only the two messages
    expect(ctx[0].content).toBe('hi')
    expect(ctx[1].content).toBe('response')
  })

  it('includes BranchSummaryEntry as system message', () => {
    let tree = emptyTree()
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-1', null, {
      message: { role: 'user', content: 'root' },
    }))
    tree = appendEntry(tree, makeRawEntry('BranchSummaryEntry', 'e-2', 'e-1', {
      fromId: 'e-1',
      summary: 'Explored RSC approach but abandoned.',
    }))
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-3', 'e-2', {
      message: { role: 'user', content: 'new approach' },
    }))

    const ctx = buildContext(tree)
    expect(ctx[1]).toEqual({
      role: 'system',
      content: '[Branch Summary] Explored RSC approach but abandoned.',
    })
  })
})

// =============================================================================
// Unit: Entry factories
// =============================================================================

describe('Entry Factories — Unit', () => {
  beforeEach(() => resetEntryCounter())

  it('makeMessageEntry creates entry wired to leaf', () => {
    let tree = emptyTree()
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-1', null, {
      message: { role: 'user', content: 'setup' },
    }))

    const entry = makeMessageEntry(tree, {
      role: 'assistant',
      content: 'response',
    })

    expect(entry._tag).toBe('MessageEntry')
    expect(entry.parentId).toBe('e-1') // Wired to current leaf
    expect(entry.message.role).toBe('assistant')
    expect(entry.id).toBeTruthy()
  })

  it('makeCompactionEntry creates entry with metadata', () => {
    let tree = emptyTree()
    tree = appendEntry(tree, makeRawEntry('MessageEntry', 'e-1', null, {
      message: { role: 'user', content: 'old' },
    }))

    const entry = makeCompactionEntry(tree, 'Summary text', 'e-1' as EntryId, 48000)

    expect(entry._tag).toBe('CompactionEntry')
    expect(entry.parentId).toBe('e-1')
    expect(entry.summary).toBe('Summary text')
    expect(entry.tokensBefore).toBe(48000)
  })

  it('generateEntryId produces unique IDs', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateEntryId())
    }
    expect(ids.size).toBe(100)
  })
})
