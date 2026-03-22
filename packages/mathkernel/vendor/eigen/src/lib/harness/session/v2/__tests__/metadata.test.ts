/**
 * Session Metadata Schema Tests
 *
 * Unit: status validation, metadata field validation
 * Behavior: listing-view shape, two-store pattern fitness
 * Integration: JSON round-trip for IndexedDB storage simulation
 */

import { describe, it, expect } from '@effect/vitest'
import { Schema } from 'effect'
import { SessionStatus, SessionMetadata } from '../metadata'

// =============================================================================
// Fixtures
// =============================================================================

const VALID_METADATA = {
  _tag: 'SessionMetadata' as const,
  id: 'session-001',
  title: 'Architecture Review',
  createdAt: '2026-02-28T14:00:00.000Z',
  lastModified: '2026-02-28T15:30:00.000Z',
  messageCount: 42,
  preview: 'User: Let\'s review the session architecture...',
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  status: 'active' as const,
  tags: ['architecture', 'review'],
  tokenUsage: { input: 12000, output: 8000, total: 20000 },
}

// =============================================================================
// Unit: SessionStatus
// =============================================================================

describe('SessionStatus — Unit', () => {
  it('accepts all valid statuses', () => {
    for (const status of ['active', 'closed', 'failed', 'archived', 'starred']) {
      const result = Schema.decodeUnknownSync(SessionStatus)(status)
      expect(result).toBe(status)
    }
  })

  it('rejects invalid status', () => {
    expect(() => Schema.decodeUnknownSync(SessionStatus)('pending')).toThrow()
    expect(() => Schema.decodeUnknownSync(SessionStatus)('')).toThrow()
    expect(() => Schema.decodeUnknownSync(SessionStatus)(42)).toThrow()
  })
})

// =============================================================================
// Unit: SessionMetadata
// =============================================================================

describe('SessionMetadata — Unit', () => {
  it('accepts fully populated metadata', () => {
    const result = Schema.decodeUnknownSync(SessionMetadata)(VALID_METADATA)
    expect(result._tag).toBe('SessionMetadata')
    expect(result.id).toBe('session-001')
    expect(result.title).toBe('Architecture Review')
    expect(result.messageCount).toBe(42)
    expect(result.tags).toEqual(['architecture', 'review'])
  })

  it('accepts minimal metadata (optional fields omitted)', () => {
    const minimal = {
      _tag: 'SessionMetadata' as const,
      id: 'session-002',
      title: 'Quick Chat',
      createdAt: '2026-02-28T14:00:00.000Z',
      lastModified: '2026-02-28T14:00:00.000Z',
      messageCount: 0,
      preview: '',
      status: 'active' as const,
      tags: [],
    }
    const result = Schema.decodeUnknownSync(SessionMetadata)(minimal)
    expect(result.provider).toBeUndefined()
    expect(result.model).toBeUndefined()
    expect(result.tokenUsage).toBeUndefined()
    expect(result.nodeId).toBeUndefined()
    expect(result.role).toBeUndefined()
  })

  it('rejects empty id', () => {
    expect(() =>
      Schema.decodeUnknownSync(SessionMetadata)({ ...VALID_METADATA, id: '' }),
    ).toThrow()
  })

  it('rejects empty createdAt', () => {
    expect(() =>
      Schema.decodeUnknownSync(SessionMetadata)({ ...VALID_METADATA, createdAt: '' }),
    ).toThrow()
  })

  it('rejects negative messageCount', () => {
    expect(() =>
      Schema.decodeUnknownSync(SessionMetadata)({ ...VALID_METADATA, messageCount: -1 }),
    ).toThrow()
  })

  it('rejects non-integer messageCount', () => {
    expect(() =>
      Schema.decodeUnknownSync(SessionMetadata)({ ...VALID_METADATA, messageCount: 3.5 }),
    ).toThrow()
  })

  it('rejects negative tokenUsage values', () => {
    expect(() =>
      Schema.decodeUnknownSync(SessionMetadata)({
        ...VALID_METADATA,
        tokenUsage: { input: -1, output: 100, total: 99 },
      }),
    ).toThrow()
  })

  it('accepts metadata with nodeId and role (conductor panels)', () => {
    const result = Schema.decodeUnknownSync(SessionMetadata)({
      ...VALID_METADATA,
      nodeId: 'node-abc-123',
      role: 'architect',
    })
    expect(result.nodeId).toBe('node-abc-123')
    expect(result.role).toBe('architect')
  })
})

// =============================================================================
// Behavior: Two-store pattern fitness
// =============================================================================

describe('SessionMetadata — Behavior (two-store)', () => {
  it('is small enough for listing (no conversation content)', () => {
    const result = Schema.decodeUnknownSync(SessionMetadata)(VALID_METADATA)
    const json = JSON.stringify(result)
    // Metadata should be compact — under 1KB per session
    expect(json.length).toBeLessThan(1024)
  })

  it('preview field provides enough context for UI listing', () => {
    const result = Schema.decodeUnknownSync(SessionMetadata)(VALID_METADATA)
    expect(result.preview.length).toBeGreaterThan(0)
    expect(result.preview.length).toBeLessThan(500)
  })
})

// =============================================================================
// Integration: JSON round-trip (IndexedDB simulation)
// =============================================================================

describe('SessionMetadata — Integration (JSON round-trip)', () => {
  it('survives JSON.stringify → JSON.parse → decode', () => {
    const decoded = Schema.decodeUnknownSync(SessionMetadata)(VALID_METADATA)
    const json = JSON.stringify(decoded)
    const reDecoded = Schema.decodeUnknownSync(SessionMetadata)(JSON.parse(json))

    expect(reDecoded.id).toBe(decoded.id)
    expect(reDecoded.title).toBe(decoded.title)
    expect(reDecoded.messageCount).toBe(decoded.messageCount)
    expect(reDecoded.status).toBe(decoded.status)
    expect(reDecoded.tags).toEqual(decoded.tags)
    expect(reDecoded.tokenUsage).toEqual(decoded.tokenUsage)
  })

  it('minimal metadata round-trips cleanly', () => {
    const minimal = {
      _tag: 'SessionMetadata' as const,
      id: 'session-min',
      title: '',
      createdAt: '2026-01-01T00:00:00Z',
      lastModified: '2026-01-01T00:00:00Z',
      messageCount: 0,
      preview: '',
      status: 'closed' as const,
      tags: [],
    }
    const decoded = Schema.decodeUnknownSync(SessionMetadata)(minimal)
    const json = JSON.stringify(decoded)
    const reDecoded = Schema.decodeUnknownSync(SessionMetadata)(JSON.parse(json))
    expect(reDecoded.id).toBe('session-min')
    expect(reDecoded.status).toBe('closed')
  })
})
