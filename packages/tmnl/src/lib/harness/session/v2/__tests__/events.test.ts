/**
 * Session Event Schema Tests
 *
 * Unit: each domain event validates correctly
 * Behavior: union discriminates all event types
 * Integration: JSON round-trip for EventLog persistence simulation
 */

import { describe, it, expect } from '@effect/vitest'
import { Schema } from 'effect'
import {
  SessionCreated,
  SessionResumed,
  EntryAppended,
  BranchCreated,
  CompactionPerformed,
  SessionForked,
  SessionDisposed,
  MetadataUpdated,
  SessionEvent,
  SESSION_EVENT_TAGS,
} from '../events'

// =============================================================================
// Fixtures
// =============================================================================

const TS = '2026-02-28T14:00:00.000Z'
const SID = 'session-001'
const EID = 'entry-001'

// =============================================================================
// Unit: Individual event types
// =============================================================================

describe('Session Events — Unit', () => {
  describe('SessionCreated', () => {
    it('accepts valid creation event', () => {
      const result = Schema.decodeUnknownSync(SessionCreated)({
        _tag: 'SessionCreated',
        sessionId: SID,
        timestamp: TS,
        cwd: '/home/user/project',
      })
      expect(result._tag).toBe('SessionCreated')
      expect(result.sessionId).toBe(SID)
      expect(result.cwd).toBe('/home/user/project')
    })

    it('rejects empty sessionId', () => {
      expect(() =>
        Schema.decodeUnknownSync(SessionCreated)({
          _tag: 'SessionCreated',
          sessionId: '',
          timestamp: TS,
          cwd: '/tmp',
        }),
      ).toThrow()
    })
  })

  describe('SessionResumed', () => {
    it('accepts valid resume event', () => {
      const result = Schema.decodeUnknownSync(SessionResumed)({
        _tag: 'SessionResumed',
        sessionId: SID,
        timestamp: TS,
        entryCount: 150,
      })
      expect(result.entryCount).toBe(150)
    })

    it('rejects negative entryCount', () => {
      expect(() =>
        Schema.decodeUnknownSync(SessionResumed)({
          _tag: 'SessionResumed',
          sessionId: SID,
          timestamp: TS,
          entryCount: -5,
        }),
      ).toThrow()
    })
  })

  describe('EntryAppended', () => {
    it('accepts valid append event', () => {
      const result = Schema.decodeUnknownSync(EntryAppended)({
        _tag: 'EntryAppended',
        sessionId: SID,
        entryId: EID,
        entryTag: 'MessageEntry',
        parentId: null,
        timestamp: TS,
      })
      expect(result.entryTag).toBe('MessageEntry')
      expect(result.parentId).toBeNull()
    })

    it('accepts append with parentId', () => {
      const result = Schema.decodeUnknownSync(EntryAppended)({
        _tag: 'EntryAppended',
        sessionId: SID,
        entryId: 'entry-002',
        entryTag: 'MessageEntry',
        parentId: EID,
        timestamp: TS,
      })
      expect(result.parentId).toBe(EID)
    })
  })

  describe('BranchCreated', () => {
    it('accepts valid branch event', () => {
      const result = Schema.decodeUnknownSync(BranchCreated)({
        _tag: 'BranchCreated',
        sessionId: SID,
        fromEntryId: 'entry-005',
        timestamp: TS,
      })
      expect(result.fromEntryId).toBe('entry-005')
    })
  })

  describe('CompactionPerformed', () => {
    it('accepts valid compaction event', () => {
      const result = Schema.decodeUnknownSync(CompactionPerformed)({
        _tag: 'CompactionPerformed',
        sessionId: SID,
        compactionEntryId: 'entry-010',
        firstKeptEntryId: 'entry-007',
        tokensBefore: 95000,
        timestamp: TS,
      })
      expect(result.tokensBefore).toBe(95000)
      expect(result.compactionEntryId).toBe('entry-010')
    })

    it('rejects negative tokensBefore', () => {
      expect(() =>
        Schema.decodeUnknownSync(CompactionPerformed)({
          _tag: 'CompactionPerformed',
          sessionId: SID,
          compactionEntryId: 'e-1',
          firstKeptEntryId: 'e-2',
          tokensBefore: -100,
          timestamp: TS,
        }),
      ).toThrow()
    })
  })

  describe('SessionForked', () => {
    it('accepts valid fork event', () => {
      const result = Schema.decodeUnknownSync(SessionForked)({
        _tag: 'SessionForked',
        sourceSessionId: 'session-001',
        targetSessionId: 'session-002',
        forkEntryId: 'entry-015',
        timestamp: TS,
      })
      expect(result.sourceSessionId).toBe('session-001')
      expect(result.targetSessionId).toBe('session-002')
      expect(result.forkEntryId).toBe('entry-015')
    })
  })

  describe('SessionDisposed', () => {
    it('accepts dispose with reason', () => {
      const result = Schema.decodeUnknownSync(SessionDisposed)({
        _tag: 'SessionDisposed',
        sessionId: SID,
        reason: 'user closed panel',
        timestamp: TS,
      })
      expect(result.reason).toBe('user closed panel')
    })

    it('accepts dispose without reason', () => {
      const result = Schema.decodeUnknownSync(SessionDisposed)({
        _tag: 'SessionDisposed',
        sessionId: SID,
        timestamp: TS,
      })
      expect(result.reason).toBeUndefined()
    })
  })

  describe('MetadataUpdated', () => {
    it('accepts valid metadata update', () => {
      const result = Schema.decodeUnknownSync(MetadataUpdated)({
        _tag: 'MetadataUpdated',
        sessionId: SID,
        field: 'title',
        timestamp: TS,
      })
      expect(result.field).toBe('title')
    })
  })
})

// =============================================================================
// Behavior: Union discrimination
// =============================================================================

describe('SessionEvent Union — Behavior', () => {
  it('discriminates all 8 event types by _tag', () => {
    const events = [
      { _tag: 'SessionCreated', sessionId: SID, timestamp: TS, cwd: '/tmp' },
      { _tag: 'SessionResumed', sessionId: SID, timestamp: TS, entryCount: 10 },
      { _tag: 'EntryAppended', sessionId: SID, entryId: EID, entryTag: 'MessageEntry', parentId: null, timestamp: TS },
      { _tag: 'BranchCreated', sessionId: SID, fromEntryId: EID, timestamp: TS },
      { _tag: 'CompactionPerformed', sessionId: SID, compactionEntryId: EID, firstKeptEntryId: EID, tokensBefore: 100, timestamp: TS },
      { _tag: 'SessionForked', sourceSessionId: SID, targetSessionId: 'session-002', forkEntryId: EID, timestamp: TS },
      { _tag: 'SessionDisposed', sessionId: SID, timestamp: TS },
      { _tag: 'MetadataUpdated', sessionId: SID, field: 'title', timestamp: TS },
    ]

    for (const event of events) {
      const result = Schema.decodeUnknownSync(SessionEvent)(event)
      expect(result._tag).toBe(event._tag)
    }
  })

  it('rejects unknown _tag', () => {
    expect(() =>
      Schema.decodeUnknownSync(SessionEvent)({
        _tag: 'SessionDeleted',
        sessionId: SID,
        timestamp: TS,
      }),
    ).toThrow()
  })

  it('SESSION_EVENT_TAGS has all 8 event tags', () => {
    expect(SESSION_EVENT_TAGS).toHaveLength(8)
    expect(SESSION_EVENT_TAGS).toContain('SessionCreated')
    expect(SESSION_EVENT_TAGS).toContain('CompactionPerformed')
    expect(SESSION_EVENT_TAGS).toContain('SessionForked')
    expect(SESSION_EVENT_TAGS).toContain('MetadataUpdated')
  })
})

// =============================================================================
// Integration: JSON round-trip (EventLog persistence simulation)
// =============================================================================

describe('SessionEvent — Integration (JSON round-trip)', () => {
  it('all event types survive JSON serialization', () => {
    const events = [
      { _tag: 'SessionCreated', sessionId: SID, timestamp: TS, cwd: '/home/user' },
      { _tag: 'EntryAppended', sessionId: SID, entryId: EID, entryTag: 'CompactionEntry', parentId: 'entry-000', timestamp: TS },
      { _tag: 'SessionForked', sourceSessionId: 'src', targetSessionId: 'tgt', forkEntryId: EID, timestamp: TS },
    ]

    for (const raw of events) {
      const decoded = Schema.decodeUnknownSync(SessionEvent)(raw)
      const json = JSON.stringify(decoded)
      const reDecoded = Schema.decodeUnknownSync(SessionEvent)(JSON.parse(json))
      expect(reDecoded._tag).toBe(decoded._tag)
    }
  })

  it('CompactionPerformed preserves numeric fields through JSON', () => {
    const raw = {
      _tag: 'CompactionPerformed',
      sessionId: SID,
      compactionEntryId: 'c-1',
      firstKeptEntryId: 'k-1',
      tokensBefore: 128000,
      timestamp: TS,
    }
    const decoded = Schema.decodeUnknownSync(CompactionPerformed)(raw)
    const json = JSON.stringify(decoded)
    const reDecoded = Schema.decodeUnknownSync(CompactionPerformed)(JSON.parse(json))
    expect(reDecoded.tokensBefore).toBe(128000)
  })
})
