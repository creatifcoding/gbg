/**
 * RLM History & Context — Unit Tests
 *
 * Tests the extracted history manager and context builder from history.ts.
 * These are pure functions — no pi dependency, no bun:sqlite.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createHistoryManager,
  buildContext,
  HISTORY_CUSTOM_TYPE,
  RESULT_TRUNCATE_LENGTH,
  type HistoryManager,
  type SessionEntry,
  type ProjectContext,
} from '../src/history.js'

// ─── History Manager ─────────────────────────────────────────

describe('HistoryManager', () => {
  let hm: HistoryManager

  beforeEach(() => {
    hm = createHistoryManager()
  })

  describe('record', () => {
    it('records a history entry with code, result, and timestamp', () => {
      const entry = hm.record('ms.discover()', '[{name:"foo"}]')
      expect(entry.code).toBe('ms.discover()')
      expect(entry.result).toBe('[{name:"foo"}]')
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('truncates result longer than RESULT_TRUNCATE_LENGTH', () => {
      const longResult = 'x'.repeat(600)
      const entry = hm.record('big()', longResult)
      expect(entry.result.length).toBe(RESULT_TRUNCATE_LENGTH)
      expect(entry.result.endsWith('...')).toBe(true)
    })

    it('does not truncate result at exactly RESULT_TRUNCATE_LENGTH', () => {
      const exactResult = 'y'.repeat(RESULT_TRUNCATE_LENGTH)
      const entry = hm.record('exact()', exactResult)
      expect(entry.result.length).toBe(RESULT_TRUNCATE_LENGTH)
      expect(entry.result.endsWith('...')).toBe(false)
    })

    it('does not truncate result shorter than RESULT_TRUNCATE_LENGTH', () => {
      const shortResult = 'hello'
      const entry = hm.record('small()', shortResult)
      expect(entry.result).toBe('hello')
    })

    it('increments count after each record', () => {
      expect(hm.count()).toBe(0)
      hm.record('a()', 'r1')
      expect(hm.count()).toBe(1)
      hm.record('b()', 'r2')
      expect(hm.count()).toBe(2)
    })
  })

  describe('get', () => {
    it('returns empty array when no history', () => {
      expect(hm.get()).toEqual([])
    })

    it('returns all entries when count <= n', () => {
      hm.record('a()', 'r1')
      hm.record('b()', 'r2')
      const result = hm.get(10)
      expect(result).toHaveLength(2)
      expect(result[0].code).toBe('a()')
      expect(result[1].code).toBe('b()')
    })

    it('returns last N entries when count > n', () => {
      hm.record('a()', 'r1')
      hm.record('b()', 'r2')
      hm.record('c()', 'r3')
      hm.record('d()', 'r4')
      const result = hm.get(2)
      expect(result).toHaveLength(2)
      expect(result[0].code).toBe('c()')
      expect(result[1].code).toBe('d()')
    })

    it('defaults to 10 when n not specified', () => {
      for (let i = 0; i < 15; i++) {
        hm.record(`fn${i}()`, `r${i}`)
      }
      const result = hm.get()
      expect(result).toHaveLength(10)
      expect(result[0].code).toBe('fn5()')
      expect(result[9].code).toBe('fn14()')
    })
  })

  describe('reconstruct', () => {
    it('reconstructs from session entries with correct customType', () => {
      const entries: SessionEntry[] = [
        { type: 'message' },
        { type: 'custom', customType: HISTORY_CUSTOM_TYPE, data: { code: 'a()', result: 'r1', timestamp: '2026-01-01T00:00:00Z' } },
        { type: 'custom', customType: 'other-ext', data: { foo: 'bar' } },
        { type: 'custom', customType: HISTORY_CUSTOM_TYPE, data: { code: 'b()', result: 'r2', timestamp: '2026-01-01T00:01:00Z' } },
        { type: 'message' },
      ]

      hm.reconstruct(entries)
      expect(hm.count()).toBe(2)

      const result = hm.get()
      expect(result[0].code).toBe('a()')
      expect(result[1].code).toBe('b()')
    })

    it('skips entries without code field', () => {
      const entries: SessionEntry[] = [
        { type: 'custom', customType: HISTORY_CUSTOM_TYPE, data: { result: 'orphan' } },
        { type: 'custom', customType: HISTORY_CUSTOM_TYPE, data: { code: 'valid()', result: 'ok', timestamp: 'T' } },
      ]

      hm.reconstruct(entries)
      expect(hm.count()).toBe(1)
      expect(hm.get()[0].code).toBe('valid()')
    })

    it('skips entries with undefined data', () => {
      const entries: SessionEntry[] = [
        { type: 'custom', customType: HISTORY_CUSTOM_TYPE },
        { type: 'custom', customType: HISTORY_CUSTOM_TYPE, data: null },
      ]

      hm.reconstruct(entries)
      expect(hm.count()).toBe(0)
    })

    it('clears existing history before reconstructing', () => {
      hm.record('old()', 'old-result')
      expect(hm.count()).toBe(1)

      const entries: SessionEntry[] = [
        { type: 'custom', customType: HISTORY_CUSTOM_TYPE, data: { code: 'new()', result: 'new-result', timestamp: 'T' } },
      ]

      hm.reconstruct(entries)
      expect(hm.count()).toBe(1)
      expect(hm.get()[0].code).toBe('new()')
    })

    it('handles empty entry list', () => {
      hm.record('old()', 'r')
      hm.reconstruct([])
      expect(hm.count()).toBe(0)
    })

    it('ignores non-custom entry types', () => {
      const entries: SessionEntry[] = [
        { type: 'message' },
        { type: 'compaction' },
        { type: 'model_change' },
        { type: 'branch_summary' },
      ]

      hm.reconstruct(entries)
      expect(hm.count()).toBe(0)
    })
  })

  describe('clear', () => {
    it('removes all entries', () => {
      hm.record('a()', 'r1')
      hm.record('b()', 'r2')
      expect(hm.count()).toBe(2)
      hm.clear()
      expect(hm.count()).toBe(0)
      expect(hm.get()).toEqual([])
    })
  })
})

// ─── Context Builder ─────────────────────────────────────────

describe('buildContext', () => {
  it('returns correct shape with skills and collections', () => {
    const ctx: ProjectContext = buildContext(
      '/home/user/project',
      () => ['metaskill', 'nx-workspace', 'effect-v4-schema'],
      () => [{ name: 'research', count: 5 }, { name: 'decisions', count: 2 }],
    )

    expect(ctx.skills.count).toBe(3)
    expect(ctx.skills.names).toEqual(['metaskill', 'nx-workspace', 'effect-v4-schema'])
    expect(ctx.collections).toHaveLength(2)
    expect(ctx.collections[0]).toEqual({ name: 'research', count: 5 })
    expect(ctx.cwd).toBe('/home/user/project')
    expect(ctx.project).toBe('project')
  })

  it('handles empty skills and collections', () => {
    const ctx = buildContext('/root', () => [], () => [])
    expect(ctx.skills.count).toBe(0)
    expect(ctx.skills.names).toEqual([])
    expect(ctx.collections).toEqual([])
  })

  it('extracts project name from cwd', () => {
    expect(buildContext('/a/b/tmnl', () => [], () => []).project).toBe('tmnl')
    expect(buildContext('/single', () => [], () => []).project).toBe('single')
  })

  it('handles root directory cwd', () => {
    const ctx = buildContext('/', () => [], () => [])
    expect(ctx.project).toBe('')
    expect(ctx.cwd).toBe('/')
  })

  it('handles cwd without slashes', () => {
    const ctx = buildContext('project', () => [], () => [])
    expect(ctx.project).toBe('project')
  })
})

// ─── Constants ───────────────────────────────────────────────

describe('Constants', () => {
  it('HISTORY_CUSTOM_TYPE is cm-history', () => {
    expect(HISTORY_CUSTOM_TYPE).toBe('cm-history')
  })

  it('RESULT_TRUNCATE_LENGTH is 500', () => {
    expect(RESULT_TRUNCATE_LENGTH).toBe(500)
  })
})
