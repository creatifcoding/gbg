/**
 * TreeCache — prompt-hash → UITree LRU cache
 *
 * REWRITE: HashMap<string, CacheEntry> + SortedMap<number, string> for LRU.
 *
 * Why not Effect.Cache?
 *   - Effect.Cache requires a lookup function (we only do manual set/get)
 *   - Effect.Cache's getOption doesn't reliably trigger LRU eviction
 *   - We need explicit control over eviction ordering
 *   - HashMap + SortedMap are the Effect-canonical immutable collections
 *
 * Architecture:
 *   - `_entries`: HashMap<string, CacheEntry> — O(1) key→value lookup
 *   - `_lru`: SortedMap<number, string> — sorted by accessTime (oldest first)
 *   - On get: update accessTime in both structures
 *   - On set: insert + evict if over capacity (pop oldest from SortedMap)
 *   - TTL checked on get — stale entries return undefined and are removed
 *
 * All operations are synchronous and immutable (COW on mutation).
 *
 * @module genifer/react/tree-cache
 */

import { HashMap, Option, Order, SortedMap } from 'effect'
import type { UITree } from '../core/schemas.js'

// =============================================================================
// Types
// =============================================================================

export type TreeCacheOptions = {
  /** Max number of cached entries (default: 50) */
  maxEntries?: number
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttlMs?: number
}

interface CacheEntry {
  readonly tree: UITree
  readonly createdAt: number
  readonly accessTime: number
}

// =============================================================================
// Hash Function (FNV-1a, fast for strings)
// =============================================================================

function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash.toString(36)
}

/**
 * Generate a cache key from prompt + optional context.
 */
export function generateCacheKey(prompt: string, model?: string, context?: string): string {
  const parts = [prompt]
  if (model) parts.push(model)
  if (context) parts.push(context)
  return fnv1aHash(parts.join('|'))
}

// =============================================================================
// LRU Ordering — SortedMap key = accessTime (monotonic counter)
// =============================================================================

/** Numeric order for SortedMap keys (oldest = smallest = evicted first) */
const NumberOrder: Order.Order<number> = Order.number

// =============================================================================
// TreeCache — HashMap + SortedMap
// =============================================================================

/**
 * TreeCache: immutable HashMap for O(1) lookup, SortedMap for LRU eviction.
 *
 * Public API is identical to the previous Effect.Cache version.
 */
export class TreeCache {
  private readonly _capacity: number
  private readonly _ttlMs: number

  /** Key → CacheEntry (O(1) lookup) */
  private _entries: HashMap.HashMap<string, CacheEntry>

  /** accessTime → key (sorted oldest-first for LRU eviction) */
  private _lru: SortedMap.SortedMap<number, string>

  /** Monotonic counter — ensures unique SortedMap keys even at same ms */
  private _tick = 0

  /** Stats */
  private _hits = 0
  private _misses = 0

  constructor(options?: TreeCacheOptions) {
    this._capacity = options?.maxEntries ?? 50
    this._ttlMs = options?.ttlMs ?? 5 * 60 * 1000 // 5 minutes
    this._entries = HashMap.empty()
    this._lru = SortedMap.empty(NumberOrder)
  }

  private nextTick(): number {
    return ++this._tick
  }

  /**
   * Get a cached tree if it exists and is fresh.
   * Updates accessTime on hit (promotes in LRU).
   */
  get(key: string): UITree | undefined {
    const entry = Option.getOrUndefined(HashMap.get(this._entries, key))
    if (!entry) {
      this._misses++
      return undefined
    }

    // TTL check
    const now = Date.now()
    if (now - entry.createdAt > this._ttlMs) {
      // Expired — evict
      this._remove(key, entry.accessTime)
      this._misses++
      return undefined
    }

    // Promote in LRU: remove old accessTime, insert new
    const newAccessTime = this.nextTick()
    this._lru = SortedMap.remove(this._lru, entry.accessTime)
    this._lru = SortedMap.set(this._lru, newAccessTime, key)
    this._entries = HashMap.set(this._entries, key, {
      ...entry,
      accessTime: newAccessTime,
    })

    this._hits++
    return entry.tree
  }

  /**
   * Store a tree in the cache.
   * Evicts oldest entry if over capacity.
   */
  set(key: string, tree: UITree): void {
    const now = Date.now()
    const accessTime = this.nextTick()

    // If key already exists, remove old LRU entry
    const existing = Option.getOrUndefined(HashMap.get(this._entries, key))
    if (existing) {
      this._lru = SortedMap.remove(this._lru, existing.accessTime)
    }

    // Insert
    this._entries = HashMap.set(this._entries, key, {
      tree,
      createdAt: now,
      accessTime,
    })
    this._lru = SortedMap.set(this._lru, accessTime, key)

    // Evict if over capacity
    while (HashMap.size(this._entries) > this._capacity) {
      const oldest = SortedMap.headOption(this._lru)
      if (Option.isNone(oldest)) break
      const [oldestTime, oldestKey] = oldest.value
      this._remove(oldestKey, oldestTime)
    }
  }

  /**
   * Check if a fresh entry exists for the given key.
   */
  has(key: string): boolean {
    const entry = Option.getOrUndefined(HashMap.get(this._entries, key))
    if (!entry) return false
    if (Date.now() - entry.createdAt > this._ttlMs) {
      this._remove(key, entry.accessTime)
      return false
    }
    return true
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this._entries = HashMap.empty()
    this._lru = SortedMap.empty(NumberOrder)
    this._tick = 0
  }

  /**
   * Number of cached entries.
   */
  get size(): number {
    return HashMap.size(this._entries)
  }

  /**
   * Evict stale entries.
   * Returns the count of entries that were expired.
   */
  evictStale(): number {
    const now = Date.now()
    let evicted = 0
    const keysToRemove: Array<[string, number]> = []

    for (const [key, entry] of HashMap.toEntries(this._entries)) {
      if (now - entry.createdAt > this._ttlMs) {
        keysToRemove.push([key, entry.accessTime])
      }
    }

    for (const [key, accessTime] of keysToRemove) {
      this._remove(key, accessTime)
      evicted++
    }

    return evicted
  }

  /**
   * Get cache statistics: hits, misses, current size.
   */
  get stats(): { hits: number; misses: number; size: number } {
    return { hits: this._hits, misses: this._misses, size: this.size }
  }

  /**
   * Check if cache contains a key (without triggering TTL eviction).
   */
  contains(key: string): boolean {
    return HashMap.has(this._entries, key)
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private _remove(key: string, accessTime: number): void {
    this._entries = HashMap.remove(this._entries, key)
    this._lru = SortedMap.remove(this._lru, accessTime)
  }
}

// =============================================================================
// Singleton
// =============================================================================

let _instance: TreeCache | null = null

export function getTreeCache(options?: TreeCacheOptions): TreeCache {
  if (!_instance) {
    _instance = new TreeCache(options)
  }
  return _instance
}
