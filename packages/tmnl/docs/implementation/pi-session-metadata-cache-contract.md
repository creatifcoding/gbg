# Pi Session Metadata Cache Contract

**Feature:** #F1279 (EDIN / Design)  
**Tasks:** #4636 → #4640  
**Date:** 2026-06-08

---

## 1) Objective

Make pi session listing feel instant on warm starts without touching the slow pi CLI/SDK session loader.

The current bounded JSONL fast path is acceptable (~190–215ms for 436 sessions after dir de-dupe). The cache stack has two explicit layers:

1. **Effect Cache** is the computational cache. It owns per-file lookup dedupe, same-process hot reuse, and `cacheStats` diagnostics.
2. **Persistent JSON** is a warm-start/persisted metadata layer. It seeds the Effect Cache lookup for unchanged files and is rewritten from observed entries.

List flow:

1. read compact metadata cache into warm-start entries,
2. resolve/stat JSONL files,
3. use `Effect.Cache.get(path+size+mtime)` for every file,
4. classify lookup result as warm-start hit, parsed entry, invalid session, or lookup error,
5. render sorted rows,
6. atomically write observed valid entries.

Prime, this is a metadata cache, not a transcript hoard. We are not building a second swamp beside the first swamp.

---

## 2) Storage Location

Default path:

```text
~/.tmnl/pi-session-metadata-cache.v1.json
```

Rationale:
- `~/.tmnl` already hosts TMNL local state (`harness-sessions`, research DB).
- Single compact JSON is easy to inspect, delete, and recover.
- The cache is derived data; corruption must be non-fatal.

Optional override for tests/benchmarks:

```text
TMNL_PI_SESSION_CACHE_PATH=/tmp/...
```

---

## 3) Cache Identity

Each cache entry is keyed by absolute JSONL path.

Freshness fingerprint:

```ts
{
  path: string,
  size: number,
  mtimeMs: number,
  schemaVersion: 1,
}
```

A cache hit requires exact match for all fields. Anything else is stale and must be reparsed.

Why this fingerprint:
- `path` is the only stable handle for duplicate pi session ids.
- `size + mtimeMs` catches appends/rewrites cheaply.
- `schemaVersion` gives us a hard invalidation switch when list-item shape changes.

---

## 4) Cache File Shape

```ts
interface PiSessionMetadataCacheFileV1 {
  readonly _tag: 'PiSessionMetadataCacheFile'
  readonly schemaVersion: 1
  readonly generatedAt: number
  readonly entries: ReadonlyArray<PiSessionMetadataCacheEntryV1>
}

interface PiSessionMetadataCacheEntryV1 {
  readonly _tag: 'PiSessionMetadataCacheEntry'
  readonly path: string
  readonly size: number
  readonly mtimeMs: number
  readonly item: PiSessionListItem
}
```

Only `PiSessionListItem` metadata is cached:
- title/name
- createdAt/updatedAt
- messageCount from bounded parse
- preview
- optional `allMessagesText` as currently produced by bounded fast-list
- localProject/sourceRank is recomputed per request where needed

Do **not** cache full replay entries here.

---

## 5) Read Algorithm

For `PiSessionSource.list(options)`:

1. Resolve and de-dupe ranked dirs.
2. List JSONL files and stat each file.
3. Load cache file if present.
   - If missing: empty warm-start map.
   - If corrupt/wrong version: ignore, record diagnostic, continue.
4. Create/reuse module-local `Effect.Cache`:
   - key: JSON string containing `path`, `size`, `mtimeMs`, `birthtimeMs`,
   - value: discriminated lookup result, not nullable ambiguity.
5. For each file call `cache.get(key)`:
   - `WarmStartHit`: persistent JSON entry matched fingerprint,
   - `Parsed`: bounded parser produced fresh metadata,
   - `InvalidSession`: readable JSONL was not a pi session,
   - `LookupError`: lookup threw/read failed.
6. For valid entries, recompute request-local `sourceRank/localProject`.
7. Sort and limit exactly as current fast path.
8. Atomically persist observed valid entries.

---

## 6) Invalidation + Cleanup

Invalidation:
- stale when `size` or `mtimeMs` changes,
- stale when `schemaVersion` changes,
- stale when cached `item.ref.path !== path`,
- stale when decode/shape validation fails.

Cleanup:
- Entries for files not observed in the current scan may be dropped on write.
- This keeps cache bounded by current pi session files.

Corruption policy:
- Cache read failure is a warning/diagnostic, never a list failure.
- Rebuild cache from bounded JSONL scan.

Atomic write:

```text
write ~/.tmnl/pi-session-metadata-cache.v1.json.tmp-<pid>-<timestamp>
rename tmp → cache
```

---

## 7) Diagnostics

Extend `PiSessionListDiagnostics` with:

```ts
cacheEnabled: boolean
cachePath?: string
cacheReadMs: number
cacheWriteMs: number
cacheHits: number
cacheMisses: number
cacheStale: number
cacheEntriesLoaded: number
cacheEntriesWritten: number
cacheCorrupt: boolean
// Effect Cache / warm-start detail
 effectCacheHits: number
 effectCacheMisses: number
 effectCacheSize: number
 diskCacheHits: number
 cacheInvalidSessions: number
 cacheLookupErrors: number
```

The current diagnostics remain:
- dirsScanned
- filesScanned
- duplicateDirsSkipped
- duplicatePathsSkipped
- bytesPerFile
- discoverMs
- parseMs
- sortMs

Benchmark should report cold and warm paths separately.

---

## 8) Expected Performance Behavior

Current baseline after #4571:

```text
current-plus-all: ~191–214ms / 436 sessions
```

Targets:
- cold path remains <300ms on current corpus,
- warm path should be materially lower than 200ms,
- changed-file path should scale with stale count, not total corpus size.

This does not require true streaming. The first implementation can remain single-shot but should make warm single-shot fast. If later UX needs true stale-while-revalidate updates, define a second event/update path explicitly.

---

## 9) Tests Required

- cache miss creates entries,
- same-process Effect Cache hit avoids parsing unchanged files,
- cross-process warm-start hit avoids parsing unchanged files through persistent JSON,
- mtime change invalidates entry,
- size change invalidates entry,
- deleted files are removed from persisted cache,
- corrupt cache file falls back to bounded scan,
- readable non-session jsonl is classified as invalid, not lookup error,
- duplicate current/all dirs preserve source rank and do not double parse.

---

## 10) Acceptance for #4636

- [x] Cache storage location defined
- [x] Key/fingerprint defined
- [x] Cache file shape defined
- [x] Read/write/invalidation behavior defined
- [x] Diagnostics defined
- [x] Tests and benchmark expectations defined
