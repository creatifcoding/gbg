import { DateTime } from 'effect'
import { describe, expect, it } from 'vitest'

import { HydrationSlice, HydrationWindow } from '../../schemas'
import type { AgentTaskLogEntry } from '../../schemas'
import {
  DEFAULT_HYDRATION_CACHE_POLICY,
  hydrationWindowCacheKey,
  pruneHydrationCacheEntries,
  upsertHydrationCacheEntry,
  type HydrationCacheEntry,
} from '../surface'

const now = DateTime.unsafeNow()

const emptyEntries: ReadonlyArray<AgentTaskLogEntry> = []

const makeWindow = (fromOffset: number, toOffset: number) =>
  new HydrationWindow({
    taskId: 'task-hydration',
    anchor: 'newest-first',
    centerOffset: fromOffset,
    beforeCount: 500,
    afterCount: 500,
    fromOffset,
    toOffset,
    cacheTtlMs: DEFAULT_HYDRATION_CACHE_POLICY.cacheTtlMs,
    requestedAt: now,
  })

const makeEntry = (
  key: string,
  touchedAtEpochMs: number,
  expiresAtEpochMs: number,
): HydrationCacheEntry => {
  const window = makeWindow(Number(key.split(':')[0] ?? 0), Number(key.split(':')[1] ?? 0))

  const slice = new HydrationSlice({
    taskId: 'task-hydration',
    window,
    source: 'archive',
    mergedEntries: emptyEntries,
    mergedEntryCount: 0,
    hasOlder: false,
    hasNewer: false,
    hydratedAt: now,
  })

  return {
    key,
    fromOffset: window.fromOffset,
    toOffset: window.toOffset,
    source: 'archive',
    slice,
    touchedAtEpochMs,
    expiresAtEpochMs,
  }
}

describe('hydration cache helpers', () => {
  it('builds deterministic cache key from hydration window offsets', () => {
    const window = makeWindow(10, 40)
    expect(hydrationWindowCacheKey(window)).toBe('newest-first:10:40')
  })

  it('prunes expired cache entries by TTL timestamp', () => {
    const entries = [
      makeEntry('0:10', 100, 200),
      makeEntry('11:20', 150, 50),
      makeEntry('21:30', 170, 500),
    ]

    const pruned = pruneHydrationCacheEntries(entries, 120)

    expect(pruned.map((entry) => entry.key)).toEqual(['0:10', '21:30'])
  })

  it('upserts windows and evicts least-recently-touched beyond cap', () => {
    const policy = {
      ...DEFAULT_HYDRATION_CACHE_POLICY,
      maxWindowsPerTask: 2,
    }

    const initial = [
      makeEntry('0:10', 100, 1_000),
      makeEntry('11:20', 200, 1_000),
    ]

    const replaced = upsertHydrationCacheEntry(
      initial,
      makeEntry('11:20', 250, 2_000),
      policy,
    )

    expect(replaced).toHaveLength(2)
    expect(replaced.find((entry) => entry.key === '11:20')?.expiresAtEpochMs).toBe(2_000)

    const evicted = upsertHydrationCacheEntry(
      replaced,
      makeEntry('21:30', 300, 3_000),
      policy,
    )

    expect(evicted.map((entry) => entry.key).sort()).toEqual(['11:20', '21:30'])
  })
})
