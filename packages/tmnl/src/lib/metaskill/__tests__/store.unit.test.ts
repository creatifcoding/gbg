/**
 * RLM Store — Unit Tests
 *
 * Tests the persistent state layer (store.ts) — bun:sqlite collections
 * that survive across sessions. Uses temp directories for isolation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { openStore, type StoreAPI } from '../../../../.pi/extensions/metaskill/store.ts'

describe('RLM Store', () => {
  let tempDir: string
  let store: StoreAPI

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rlm-test-'))
    store = openStore(tempDir)
  })

  afterEach(() => {
    store.close()
    rmSync(tempDir, { recursive: true, force: true })
  })

  // ── store + get round-trip ──────────────────────────────

  describe('store + get', () => {
    it('stores and retrieves an object', () => {
      store.store('research', 'finding-1', { text: 'v4 removes _tag', confidence: 0.9 })
      const result = store.get('research', 'finding-1')
      expect(result).toEqual({ text: 'v4 removes _tag', confidence: 0.9 })
    })

    it('stores primitives (string, number, boolean, null)', () => {
      store.store('data', 'str', 'hello')
      store.store('data', 'num', 42)
      store.store('data', 'bool', true)
      store.store('data', 'nil', null)

      expect(store.get('data', 'str')).toBe('hello')
      expect(store.get('data', 'num')).toBe(42)
      expect(store.get('data', 'bool')).toBe(true)
      expect(store.get('data', 'nil')).toBeNull()
    })

    it('stores arrays', () => {
      store.store('data', 'list', [1, 2, 3])
      expect(store.get('data', 'list')).toEqual([1, 2, 3])
    })

    it('stores nested objects', () => {
      const nested = { a: { b: { c: [1, 2] } } }
      store.store('data', 'deep', nested)
      expect(store.get('data', 'deep')).toEqual(nested)
    })

    it('returns null for missing key', () => {
      expect(store.get('research', 'nonexistent')).toBeNull()
    })

    it('returns null for missing collection', () => {
      expect(store.get('nonexistent', 'key')).toBeNull()
    })
  })

  // ── upsert ──────────────────────────────────────────────

  describe('upsert', () => {
    it('overwrites existing key', () => {
      store.store('research', 'x', { v: 1 })
      store.store('research', 'x', { v: 2 })
      expect(store.get('research', 'x')).toEqual({ v: 2 })
    })

    it('preserves other keys on upsert', () => {
      store.store('research', 'a', { v: 1 })
      store.store('research', 'b', { v: 2 })
      store.store('research', 'a', { v: 99 })

      expect(store.get('research', 'a')).toEqual({ v: 99 })
      expect(store.get('research', 'b')).toEqual({ v: 2 })
    })
  })

  // ── tags ────────────────────────────────────────────────

  describe('tags', () => {
    it('stores tags with object', () => {
      store.store('research', 'x', { text: 'hello' }, ['effect', 'v4'])
      const results = store.query('research', { tags: 'effect' })
      expect(results).toHaveLength(1)
      expect(results[0].key).toBe('x')
      expect(results[0].tags).toEqual(['effect', 'v4'])
    })

    it('defaults to empty tags', () => {
      store.store('research', 'x', { text: 'hello' })
      const results = store.query('research')
      expect(results[0].tags).toEqual([])
    })

    it('updates tags on upsert', () => {
      store.store('research', 'x', { v: 1 }, ['old'])
      store.store('research', 'x', { v: 1 }, ['new', 'updated'])
      const results = store.query('research', { tags: 'new' })
      expect(results).toHaveLength(1)
      expect(results[0].tags).toEqual(['new', 'updated'])
    })
  })

  // ── query ───────────────────────────────────────────────

  describe('query', () => {
    beforeEach(() => {
      store.store('research', 'a', { type: 'schema', breaking: true }, ['effect', 'v4', 'breaking'])
      store.store('research', 'b', { type: 'service', breaking: false }, ['effect', 'v4'])
      store.store('research', 'c', { type: 'atom', breaking: true }, ['effect', 'v4', 'breaking'])
      store.store('other', 'd', { type: 'unrelated' }, ['misc'])
    })

    it('returns all objects when no filter', () => {
      const results = store.query('research')
      expect(results).toHaveLength(3)
    })

    it('filters by single tag', () => {
      const results = store.query('research', { tags: 'breaking' })
      expect(results).toHaveLength(2)
      expect(results.map(r => r.key).sort()).toEqual(['a', 'c'])
    })

    it('filters by multiple tags (AND)', () => {
      const results = store.query('research', { tags: ['v4', 'breaking'] })
      expect(results).toHaveLength(2)
    })

    it('returns empty for unmatched tags', () => {
      const results = store.query('research', { tags: 'nonexistent' })
      expect(results).toHaveLength(0)
    })

    it('filters by JSON path', () => {
      const results = store.query('research', { type: 'schema' })
      expect(results).toHaveLength(1)
      expect(results[0].key).toBe('a')
    })

    it('filters by JSON path + tags combined', () => {
      const results = store.query('research', { tags: 'breaking', type: 'atom' })
      expect(results).toHaveLength(1)
      expect(results[0].key).toBe('c')
    })

    it('scopes to collection', () => {
      const results = store.query('other', { tags: 'effect' })
      expect(results).toHaveLength(0)
    })

    it('returns empty for missing collection', () => {
      const results = store.query('nonexistent')
      expect(results).toHaveLength(0)
    })

    it('result includes data, tags, timestamps', () => {
      const results = store.query('research', { tags: 'breaking' })
      const first = results[0]
      expect(first).toHaveProperty('key')
      expect(first).toHaveProperty('data')
      expect(first).toHaveProperty('tags')
      expect(first).toHaveProperty('created')
      expect(first).toHaveProperty('updated')
      expect(typeof first.data).toBe('object')
      expect(Array.isArray(first.tags)).toBe(true)
    })
  })

  // ── keys ────────────────────────────────────────────────

  describe('keys', () => {
    it('lists all keys in a collection', () => {
      store.store('research', 'b', { v: 2 })
      store.store('research', 'a', { v: 1 })
      store.store('research', 'c', { v: 3 })
      expect(store.keys('research')).toEqual(['a', 'b', 'c'])
    })

    it('returns empty for missing collection', () => {
      expect(store.keys('nonexistent')).toEqual([])
    })
  })

  // ── delete ──────────────────────────────────────────────

  describe('delete', () => {
    it('removes an object', () => {
      store.store('research', 'x', { v: 1 })
      expect(store.delete('research', 'x')).toBe(true)
      expect(store.get('research', 'x')).toBeNull()
    })

    it('returns false for missing key', () => {
      expect(store.delete('research', 'nonexistent')).toBe(false)
    })

    it('does not affect other keys', () => {
      store.store('research', 'a', { v: 1 })
      store.store('research', 'b', { v: 2 })
      store.delete('research', 'a')
      expect(store.get('research', 'b')).toEqual({ v: 2 })
    })
  })

  // ── collections ─────────────────────────────────────────

  describe('collections', () => {
    it('lists collections with counts', () => {
      store.store('research', 'a', { v: 1 })
      store.store('research', 'b', { v: 2 })
      store.store('decisions', 'x', { v: 3 })

      const cols = store.collections()
      expect(cols).toHaveLength(2)

      const research = cols.find(c => c.name === 'research')
      expect(research?.count).toBe(2)

      const decisions = cols.find(c => c.name === 'decisions')
      expect(decisions?.count).toBe(1)
    })

    it('returns empty when no collections', () => {
      expect(store.collections()).toEqual([])
    })

    it('has updated timestamp', () => {
      store.store('research', 'a', { v: 1 })
      const cols = store.collections()
      expect(cols[0].updated).toBeTruthy()
    })
  })

  // ── clear ───────────────────────────────────────────────

  describe('clear', () => {
    it('deletes all objects in collection', () => {
      store.store('research', 'a', { v: 1 })
      store.store('research', 'b', { v: 2 })
      store.store('research', 'c', { v: 3 })

      const deleted = store.clear('research')
      expect(deleted).toBe(3)
      expect(store.keys('research')).toEqual([])
    })

    it('does not affect other collections', () => {
      store.store('research', 'a', { v: 1 })
      store.store('decisions', 'x', { v: 2 })

      store.clear('research')
      expect(store.get('decisions', 'x')).toEqual({ v: 2 })
    })

    it('returns 0 for empty collection', () => {
      expect(store.clear('nonexistent')).toBe(0)
    })

    it('removes collection from collections list', () => {
      store.store('research', 'a', { v: 1 })
      store.clear('research')
      const cols = store.collections()
      expect(cols.find(c => c.name === 'research')).toBeUndefined()
    })
  })

  // ── vars ────────────────────────────────────────────────

  describe('vars', () => {
    it('returns metadata for all stored objects', () => {
      store.store('research', 'finding', { text: 'hello world', confidence: 0.9 }, ['v4'])
      store.store('decisions', 'choice', 'npm-alias')

      const v = store.vars()
      expect(v).toHaveLength(2)

      const finding = v.find(x => x.key === 'finding')!
      expect(finding.collection).toBe('research')
      expect(finding.type).toBe('object')
      expect(finding.tags).toEqual(['v4'])
      expect(finding.size).toBeGreaterThan(0)
      expect(finding.preview).toContain('hello world')
      expect(finding.updated).toBeTruthy()

      const choice = v.find(x => x.key === 'choice')!
      expect(choice.collection).toBe('decisions')
      expect(choice.type).toBe('string')
    })

    it('truncates preview to 120 chars', () => {
      const longText = 'x'.repeat(200)
      store.store('data', 'big', longText)

      const v = store.vars()
      const item = v.find(x => x.key === 'big')!
      expect(item.preview.length).toBeLessThanOrEqual(120)
      expect(item.preview.endsWith('...')).toBe(true)
    })

    it('returns empty for no stored objects', () => {
      expect(store.vars()).toEqual([])
    })

    it('classifies array type correctly', () => {
      store.store('data', 'list', [1, 2, 3])
      const v = store.vars()
      expect(v[0].type).toBe('array')
    })
  })

  // ── directory auto-creation ─────────────────────────────

  describe('auto-creation', () => {
    it('creates .pi/rlm/ directory', () => {
      const { existsSync } = require('node:fs')
      expect(existsSync(join(tempDir, '.pi', 'rlm'))).toBe(true)
    })

    it('creates store.db file', () => {
      const { existsSync } = require('node:fs')
      // Force a write to ensure DB file is created
      store.store('test', 'x', 1)
      expect(existsSync(join(tempDir, '.pi', 'rlm', 'store.db'))).toBe(true)
    })
  })

  // ── persistence across reopen ───────────────────────────

  describe('persistence', () => {
    it('survives close + reopen', () => {
      store.store('research', 'finding', { text: 'persisted' }, ['v4'])
      store.close()

      // Reopen same database
      const store2 = openStore(tempDir)
      const result = store2.get('research', 'finding')
      expect(result).toEqual({ text: 'persisted' })

      const v = store2.vars()
      expect(v).toHaveLength(1)
      expect(v[0].tags).toEqual(['v4'])

      store2.close()

      // Prevent afterEach from double-closing
      store = openStore(tempDir)
    })
  })
})
