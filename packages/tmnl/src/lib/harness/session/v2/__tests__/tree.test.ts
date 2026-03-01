/**
 * Session Tree Schema Tests
 *
 * Unit: tree construction, factory helpers
 * Behavior: tree invariants, entry counting
 * Integration: full tree serialization round-trip (JSONL simulation)
 */

import { describe, it, expect } from '@effect/vitest'
import { Schema } from 'effect'
import {
  SessionTree,
  makeSessionTree,
  countEntriesByTag,
} from '../tree'
import { SessionHeader, SESSION_SCHEMA_VERSION } from '../header'
import { SessionEntry, MessageEntry, CompactionEntry } from '../entries'
import type { HarnessSessionId, EntryId } from '../identity'

// =============================================================================
// Helpers
// =============================================================================

const TEST_ID = 'test-session-001' as HarnessSessionId

function makeEntry(tag: string, id: string, parentId: string | null, extra: Record<string, any> = {}): any {
  return {
    _tag: tag,
    id,
    parentId,
    timestamp: '2026-02-28T14:00:00.000Z',
    ...extra,
  }
}

// =============================================================================
// Unit: makeSessionTree
// =============================================================================

describe('makeSessionTree — Unit', () => {
  it('creates empty tree with correct header', () => {
    const tree = makeSessionTree({ id: TEST_ID, cwd: '/home/user/project' })

    expect(tree.header._tag).toBe('SessionHeader')
    expect(tree.header.id).toBe(TEST_ID)
    expect(tree.header.cwd).toBe('/home/user/project')
    expect(tree.header.version).toBe(SESSION_SCHEMA_VERSION)
    expect(tree.entries).toHaveLength(0)
    expect(tree.leafId).toBeNull()
  })

  it('creates tree with parentSession for forks', () => {
    const parent = 'parent-session-001' as HarnessSessionId
    const tree = makeSessionTree({
      id: TEST_ID,
      cwd: '/home/user/project',
      parentSession: parent,
    })

    expect(tree.header.parentSession).toBe(parent)
  })

  it('timestamp is valid ISO string', () => {
    const tree = makeSessionTree({ id: TEST_ID, cwd: '/tmp' })
    const parsed = new Date(tree.header.timestamp)
    expect(parsed.getTime()).not.toBeNaN()
  })
})

// =============================================================================
// Unit: countEntriesByTag
// =============================================================================

describe('countEntriesByTag — Unit', () => {
  it('returns empty object for empty tree', () => {
    const tree = makeSessionTree({ id: TEST_ID, cwd: '/tmp' })
    expect(countEntriesByTag(tree)).toEqual({})
  })

  it('counts entries by tag correctly', () => {
    const tree: SessionTree = {
      ...makeSessionTree({ id: TEST_ID, cwd: '/tmp' }),
      entries: [
        Schema.decodeUnknownSync(SessionEntry)(
          makeEntry('MessageEntry', 'e-1', null, { message: { role: 'user', content: 'hi' } }),
        ),
        Schema.decodeUnknownSync(SessionEntry)(
          makeEntry('MessageEntry', 'e-2', 'e-1', { message: { role: 'assistant', content: 'hello' } }),
        ),
        Schema.decodeUnknownSync(SessionEntry)(
          makeEntry('ModelChangeEntry', 'e-3', 'e-2', { provider: 'openai', modelId: 'gpt-4' }),
        ),
      ],
      leafId: 'e-3' as EntryId,
    }

    const counts = countEntriesByTag(tree)
    expect(counts['MessageEntry']).toBe(2)
    expect(counts['ModelChangeEntry']).toBe(1)
    expect(counts['CompactionEntry']).toBeUndefined()
  })
})

// =============================================================================
// Behavior: SessionTree schema validation
// =============================================================================

describe('SessionTree Schema — Behavior', () => {
  it('validates a well-formed tree', () => {
    const raw = {
      header: {
        _tag: 'SessionHeader',
        version: 1,
        id: 'session-valid',
        timestamp: '2026-02-28T14:00:00.000Z',
        cwd: '/home/user',
      },
      entries: [
        makeEntry('MessageEntry', 'e-1', null, {
          message: { role: 'user', content: 'Hello' },
        }),
        makeEntry('MessageEntry', 'e-2', 'e-1', {
          message: { role: 'assistant', content: 'Hi there' },
        }),
      ],
      leafId: 'e-2',
    }

    const tree = Schema.decodeUnknownSync(SessionTree)(raw)
    expect(tree.header.id).toBe('session-valid')
    expect(tree.entries).toHaveLength(2)
    expect(tree.leafId).toBe('e-2')
  })

  it('accepts tree with null leafId (empty session)', () => {
    const raw = {
      header: {
        _tag: 'SessionHeader',
        version: 1,
        id: 'session-empty',
        timestamp: '2026-02-28T14:00:00.000Z',
        cwd: '/tmp',
      },
      entries: [],
      leafId: null,
    }

    const tree = Schema.decodeUnknownSync(SessionTree)(raw)
    expect(tree.leafId).toBeNull()
    expect(tree.entries).toHaveLength(0)
  })

  it('rejects tree with invalid header', () => {
    expect(() =>
      Schema.decodeUnknownSync(SessionTree)({
        header: { _tag: 'SessionHeader', version: -1, id: '', timestamp: '', cwd: '' },
        entries: [],
        leafId: null,
      }),
    ).toThrow()
  })

  it('rejects tree with invalid entry in entries array', () => {
    expect(() =>
      Schema.decodeUnknownSync(SessionTree)({
        header: {
          _tag: 'SessionHeader',
          version: 1,
          id: 'valid',
          timestamp: '2026-01-01T00:00:00Z',
          cwd: '/tmp',
        },
        entries: [{ _tag: 'BogusEntry', id: 'x', parentId: null, timestamp: 'now' }],
        leafId: null,
      }),
    ).toThrow()
  })
})

// =============================================================================
// Integration: JSONL simulation (line-by-line serialize/deserialize)
// =============================================================================

describe('SessionTree — Integration (JSONL round-trip)', () => {
  it('serializes to JSONL lines and deserializes back', () => {
    // Build a tree with mixed entry types
    const tree = makeSessionTree({ id: TEST_ID, cwd: '/home/user/project' })
    const entries = [
      Schema.decodeUnknownSync(SessionEntry)(
        makeEntry('MessageEntry', 'e-1', null, { message: { role: 'user', content: 'Start session' } }),
      ),
      Schema.decodeUnknownSync(SessionEntry)(
        makeEntry('MessageEntry', 'e-2', 'e-1', { message: { role: 'assistant', content: 'Ready.' } }),
      ),
      Schema.decodeUnknownSync(SessionEntry)(
        makeEntry('ThinkingLevelChangeEntry', 'e-3', 'e-2', { thinkingLevel: 'high' }),
      ),
      Schema.decodeUnknownSync(SessionEntry)(
        makeEntry('MessageEntry', 'e-4', 'e-3', { message: { role: 'user', content: 'Deep question' } }),
      ),
    ]

    const fullTree: SessionTree = {
      ...tree,
      entries,
      leafId: 'e-4' as EntryId,
    }

    // Serialize to JSONL (line per entry, header first)
    const lines: string[] = [
      JSON.stringify(fullTree.header),
      ...fullTree.entries.map((e) => JSON.stringify(e)),
      // leafId as metadata line
      JSON.stringify({ _meta: 'leafId', value: fullTree.leafId }),
    ]
    const jsonl = lines.join('\n')

    // Deserialize from JSONL
    const parsed = jsonl.split('\n').filter(Boolean).map((line) => JSON.parse(line))

    // Header
    const header = Schema.decodeUnknownSync(SessionHeader)(parsed[0])
    expect(header.id).toBe(TEST_ID)

    // Entries
    const restoredEntries = parsed.slice(1, -1).map((raw) =>
      Schema.decodeUnknownSync(SessionEntry)(raw),
    )
    expect(restoredEntries).toHaveLength(4)
    expect(restoredEntries[0]._tag).toBe('MessageEntry')
    expect(restoredEntries[2]._tag).toBe('ThinkingLevelChangeEntry')

    // Leaf
    const meta = parsed[parsed.length - 1]
    expect(meta.value).toBe('e-4')
  })

  it('tree with compaction + branch survives full round-trip', () => {
    const entries = [
      makeEntry('MessageEntry', 'e-1', null, { message: { role: 'user', content: 'First' } }),
      makeEntry('MessageEntry', 'e-2', 'e-1', { message: { role: 'assistant', content: 'Response 1' } }),
      makeEntry('MessageEntry', 'e-3', 'e-2', { message: { role: 'user', content: 'Second' } }),
      makeEntry('CompactionEntry', 'e-4', 'e-3', {
        summary: 'User started a conversation.',
        firstKeptEntryId: 'e-3',
        tokensBefore: 5000,
      }),
      makeEntry('MessageEntry', 'e-5', 'e-4', { message: { role: 'user', content: 'Third' } }),
      // Branch from e-2
      makeEntry('BranchSummaryEntry', 'e-6', 'e-2', {
        fromId: 'e-2',
        summary: 'Original path explored alternative.',
      }),
      makeEntry('MessageEntry', 'e-7', 'e-6', { message: { role: 'user', content: 'Alt path' } }),
    ].map((raw) => Schema.decodeUnknownSync(SessionEntry)(raw))

    const tree: SessionTree = {
      header: {
        _tag: 'SessionHeader' as const,
        version: 1,
        id: 'branch-test' as HarnessSessionId,
        timestamp: '2026-02-28T14:00:00.000Z',
        cwd: '/tmp',
      },
      entries,
      leafId: 'e-7' as EntryId,
    }

    // Full round-trip
    const encoded = Schema.encodeSync(SessionTree)(tree)
    const json = JSON.stringify(encoded)
    const decoded = Schema.decodeUnknownSync(SessionTree)(JSON.parse(json))

    expect(decoded.entries).toHaveLength(7)
    expect(decoded.leafId).toBe('e-7')

    const counts = countEntriesByTag(decoded)
    expect(counts['MessageEntry']).toBe(5)
    expect(counts['CompactionEntry']).toBe(1)
    expect(counts['BranchSummaryEntry']).toBe(1)
  })
})
