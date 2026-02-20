/**
 * TreeCache — prompt-hash → UITree LRU cache
 *
 * Before hitting the network in useUIStream.send(), hash the prompt + context.
 * If a cached tree exists and is fresh, return it immediately.
 *
 * Uses a simple Map with TTL eviction. No external dependencies.
 *
 * @module genifer/react/tree-cache
 */

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

type CacheEntry = {
  tree: UITree
  createdAt: number
  hits: number
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
// TreeCache
// =============================================================================

export class TreeCache {
  private cache = new Map<string, CacheEntry>()
  private readonly maxEntries: number
  private readonly ttlMs: number

  constructor(options?: TreeCacheOptions) {
    this.maxEntries = options?.maxEntries ?? 50
    this.ttlMs = options?.ttlMs ?? 5 * 60 * 1000 // 5 minutes
  }

  /**
   * Get a cached tree if it exists and is fresh.
   */
  get(key: string): UITree | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    // Check TTL
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key)
      return undefined
    }

    entry.hits++
    return entry.tree
  }

  /**
   * Store a tree in the cache.
   */
  set(key: string, tree: UITree): void {
    // Evict if at capacity (LRU: delete oldest first)
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, {
      tree,
      createdAt: Date.now(),
      hits: 0,
    })
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
    this.cache.clear()
  }

  /**
   * Number of cached entries.
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Evict stale entries (entries past TTL).
   */
  evictStale(): number {
    const now = Date.now()
    let evicted = 0
    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > this.ttlMs) {
        this.cache.delete(key)
        evicted++
      }
    }
    return evicted
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
