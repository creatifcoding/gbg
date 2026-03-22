/**
 * TreeCache Tests — HashMap + SortedMap LRU
 *
 * Tests:
 *   1. Basic set/get
 *   2. TTL expiry
 *   3. LRU eviction at capacity
 *   4. Key overwrite
 *   5. Clear
 *   6. Stats
 *   7. generateCacheKey determinism
 *   8. evictStale
 *
 * @module genifer/__tests__/tree-cache.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HashMap } from 'effect'
import { TreeCache, generateCacheKey } from '../react/tree-cache'
import type { UITree } from '../core/schemas'

// =============================================================================
// Helpers
// =============================================================================

function makeTree(root: string, size = 1): UITree {
  let elements = HashMap.empty<string, any>()
  elements = HashMap.set(elements, root, {
    key: root,
    type: 'Box',
    props: {},
    children: [],
  })
  return { root, elements, size } as UITree
}

describe('TreeCache (HashMap + SortedMap)', () => {
  let cache: TreeCache

  beforeEach(() => {
    cache = new TreeCache({ maxEntries: 5, ttlMs: 1000 })
  })

  // ===========================================================================
  // Basic
  // ===========================================================================

  describe('basic operations', () => {
    it('set and get returns the tree', () => {
      const tree = makeTree('root')
      cache.set('key1', tree)
      const result = cache.get('key1')
      expect(result).toBeDefined()
      expect(result!.root).toBe('root')
    })

    it('get returns undefined for missing key', () => {
      expect(cache.get('nonexistent')).toBeUndefined()
    })

    it('has returns true for existing key', () => {
      cache.set('key1', makeTree('root'))
      expect(cache.has('key1')).toBe(true)
    })

    it('has returns false for missing key', () => {
      expect(cache.has('nonexistent')).toBe(false)
    })

    it('size reflects entry count', () => {
      expect(cache.size).toBe(0)
      cache.set('a', makeTree('a'))
      expect(cache.size).toBe(1)
      cache.set('b', makeTree('b'))
      expect(cache.size).toBe(2)
    })

    it('contains checks without TTL eviction', () => {
      cache.set('key1', makeTree('root'))
      expect(cache.contains('key1')).toBe(true)
      expect(cache.contains('nope')).toBe(false)
    })
  })

  // ===========================================================================
  // TTL
  // ===========================================================================

  describe('TTL expiry', () => {
    it('get returns undefined after TTL expires', () => {
      const shortCache = new TreeCache({ maxEntries: 10, ttlMs: 50 })
      shortCache.set('key1', makeTree('root'))
      expect(shortCache.get('key1')).toBeDefined()

      // Wait for TTL to expire
      vi.useFakeTimers()
      vi.advanceTimersByTime(60)
      expect(shortCache.get('key1')).toBeUndefined()
      vi.useRealTimers()
    })

    it('has returns false after TTL expires', () => {
      const shortCache = new TreeCache({ maxEntries: 10, ttlMs: 50 })
      shortCache.set('key1', makeTree('root'))

      vi.useFakeTimers()
      vi.advanceTimersByTime(60)
      expect(shortCache.has('key1')).toBe(false)
      vi.useRealTimers()
    })
  })

  // ===========================================================================
  // LRU Eviction
  // ===========================================================================

  describe('LRU eviction', () => {
    it('evicts oldest entry when capacity exceeded', () => {
      // Capacity = 5
      cache.set('a', makeTree('a'))
      cache.set('b', makeTree('b'))
      cache.set('c', makeTree('c'))
      cache.set('d', makeTree('d'))
      cache.set('e', makeTree('e'))
      expect(cache.size).toBe(5)

      // Adding 6th should evict 'a' (oldest)
      cache.set('f', makeTree('f'))
      expect(cache.size).toBe(5)
      expect(cache.get('a')).toBeUndefined() // evicted
      expect(cache.get('f')).toBeDefined() // newest
    })

    it('accessing an entry promotes it in LRU', () => {
      cache.set('a', makeTree('a'))
      cache.set('b', makeTree('b'))
      cache.set('c', makeTree('c'))
      cache.set('d', makeTree('d'))
      cache.set('e', makeTree('e'))

      // Access 'a' to promote it
      cache.get('a')

      // Add 'f' — should evict 'b' (now oldest), not 'a'
      cache.set('f', makeTree('f'))
      expect(cache.get('a')).toBeDefined() // promoted, survived
      expect(cache.get('b')).toBeUndefined() // evicted
    })

    it('overwriting a key does not increase size', () => {
      cache.set('a', makeTree('v1'))
      cache.set('a', makeTree('v2'))
      expect(cache.size).toBe(1)
      expect(cache.get('a')!.root).toBe('v2')
    })
  })

  // ===========================================================================
  // Clear & EvictStale
  // ===========================================================================

  describe('clear and evictStale', () => {
    it('clear removes all entries', () => {
      cache.set('a', makeTree('a'))
      cache.set('b', makeTree('b'))
      cache.clear()
      expect(cache.size).toBe(0)
      expect(cache.get('a')).toBeUndefined()
    })

    it('evictStale removes expired entries', () => {
      const shortCache = new TreeCache({ maxEntries: 10, ttlMs: 50 })
      shortCache.set('a', makeTree('a'))
      shortCache.set('b', makeTree('b'))

      vi.useFakeTimers()
      vi.advanceTimersByTime(60)

      // Add a fresh entry
      shortCache.set('c', makeTree('c'))

      const evicted = shortCache.evictStale()
      expect(evicted).toBe(2) // a and b expired
      expect(shortCache.size).toBe(1) // only c remains
      vi.useRealTimers()
    })
  })

  // ===========================================================================
  // Stats
  // ===========================================================================

  describe('stats', () => {
    it('tracks hits and misses', () => {
      cache.set('a', makeTree('a'))
      cache.get('a') // hit
      cache.get('a') // hit
      cache.get('missing') // miss

      const s = cache.stats
      expect(s.hits).toBe(2)
      expect(s.misses).toBe(1)
      expect(s.size).toBe(1)
    })
  })

  // ===========================================================================
  // generateCacheKey
  // ===========================================================================

  describe('generateCacheKey', () => {
    it('is deterministic', () => {
      const a = generateCacheKey('hello', 'gpt-4o')
      const b = generateCacheKey('hello', 'gpt-4o')
      expect(a).toBe(b)
    })

    it('differs for different prompts', () => {
      const a = generateCacheKey('hello')
      const b = generateCacheKey('world')
      expect(a).not.toBe(b)
    })

    it('differs for different models', () => {
      const a = generateCacheKey('hello', 'gpt-4o')
      const b = generateCacheKey('hello', 'claude')
      expect(a).not.toBe(b)
    })

    it('returns a string', () => {
      const key = generateCacheKey('test prompt', 'model', 'context')
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThan(0)
    })
  })
})
