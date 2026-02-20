/**
 * TreeCache — prompt-hash → UITree LRU cache
 *
 * Built on Effect.Cache for:
 * - Automatic LRU eviction at capacity
 * - TTL-based expiry (entries become stale after timeToLive)
 * - Concurrent safety (fiber-safe internal state)
 * - Built-in CacheStats (hits, misses, size)
 *
 * Usage:
 * ```ts
 * const cache = new TreeCache({ maxEntries: 50, ttlMs: 300_000 })
 * cache.set(key, tree)
 * const hit = cache.get(key) // UITree | undefined
 * ```
 *
 * Internally uses:
 * - `Cache.getOption` — returns cached value without triggering lookup on miss
 * - `Cache.set` — manually stores externally computed values
 * - `Cache.invalidate` / `Cache.invalidateAll` — for clear/eviction
 * - `Effect.runSync` at the boundary — all Cache ops are synchronous
 *
 * @module genifer/react/tree-cache
 */

import { Cache, Duration, Effect, Option } from 'effect'
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
// TreeCache — Effect.Cache backed
// =============================================================================

/**
 * TreeCache wraps Effect.Cache with a synchronous API.
 *
 * Effect.Cache provides:
 * - Capacity-bound LRU eviction (automatic, fiber-safe)
 * - TTL-based expiry (per-entry, checked on access)
 * - CacheStats (hits, misses, size) built-in
 * - Concurrent safety via internal MutableHashMap + Deferred
 *
 * The lookup function always fails — we only use manual set() + getOption().
 * This means Cache.get() would trigger a miss and call lookup (which fails),
 * so we exclusively use Cache.getOption() which returns Option.none on miss.
 */
export class TreeCache {
  private readonly _cache: Cache.Cache<string, UITree, never>

  constructor(options?: TreeCacheOptions) {
    const capacity = options?.maxEntries ?? 50
    const ttlMs = options?.ttlMs ?? 5 * 60 * 1000 // 5 minutes

    // Create the Effect.Cache synchronously.
    // Lookup function is a no-op (always fail) — we only use set() + getOption().
    // Effect.Cache requires a lookup, so we provide one that returns Effect.die.
    // It will never be called because we use getOption (not get).
    this._cache = Effect.runSync(
      Cache.make({
        capacity,
        timeToLive: Duration.millis(ttlMs),
        lookup: (_key: string): Effect.Effect<UITree, never> =>
          Effect.die('TreeCache: lookup should never be called — use set() to populate'),
      })
    )
  }

  /**
   * Get a cached tree if it exists and is fresh.
   * Uses Cache.getOption — returns Option.none on miss without triggering lookup.
   * TTL checked automatically by Effect.Cache internals.
   */
  get(key: string): UITree | undefined {
    const result = Effect.runSync(this._cache.getOption(key))
    return Option.getOrUndefined(result)
  }

  /**
   * Store a tree in the cache.
   * Uses Cache.set — manually associates value with key.
   *
   * Note: Cache.set does NOT call trackAccess internally, so LRU eviction
   * won't fire from set alone. We follow set with getOption to trigger
   * trackAccess → eviction when capacity is exceeded.
   */
  set(key: string, tree: UITree): void {
    Effect.runSync(this._cache.set(key, tree))
    // Trigger trackAccess → LRU eviction by touching the key
    Effect.runSync(this._cache.getOption(key))
  }

  /**
   * Check if a fresh entry exists for the given key.
   */
  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    Effect.runSync(this._cache.invalidateAll)
  }

  /**
   * Number of cached entries (approximate — Effect.Cache.size is O(1)).
   */
  get size(): number {
    return Effect.runSync(this._cache.size)
  }

  /**
   * Evict stale entries.
   *
   * Effect.Cache handles TTL lazily (on access), so there's no built-in
   * "evict all stale" method. We iterate keys and check each — if getOption
   * returns None, it was already expired and removed by the check.
   *
   * Returns the count of entries that were expired.
   */
  evictStale(): number {
    const keys = Effect.runSync(this._cache.keys)
    const sizeBefore = Effect.runSync(this._cache.size)
    for (const key of keys) {
      // getOption triggers TTL check — expired entries get removed
      Effect.runSync(this._cache.getOption(key))
    }
    const sizeAfter = Effect.runSync(this._cache.size)
    return sizeBefore - sizeAfter
  }

  /**
   * Get cache statistics: hits, misses, current size.
   */
  get stats(): { hits: number; misses: number; size: number } {
    const s = Effect.runSync(this._cache.cacheStats)
    return { hits: s.hits, misses: s.misses, size: s.size }
  }

  /**
   * Check if cache contains a key (without triggering TTL eviction).
   */
  contains(key: string): boolean {
    return Effect.runSync(this._cache.contains(key))
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
