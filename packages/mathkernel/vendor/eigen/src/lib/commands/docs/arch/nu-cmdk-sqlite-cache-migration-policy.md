# NuCmdk SQLite Cache Schema + Migration Policy

**Status:** Locked  
**Date:** 2026-02-13

---

## Goal

Define stable SQLite persistence policy for NuCmdk L2 warm cache, including:

- schema structure,
- migration/versioning,
- WAL/checkpoint policy,
- compatibility guards.

---

## Storage engine posture

- SQLite as persisted warm cache backend.
- WAL mode enabled for concurrency and write/read overlap.
- Cache correctness over indefinite retention: stale entries are acceptable only with explicit staleness metadata.

---

## Core tables

## `cache_entries`

```sql
CREATE TABLE IF NOT EXISTS cache_entries (
  cache_key TEXT PRIMARY KEY,
  query_prefix TEXT NOT NULL,
  mode TEXT NOT NULL,
  lane_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  schema_epoch INTEGER NOT NULL,
  manifest_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  meta_json TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL
);
```

## `cache_meta`

```sql
CREATE TABLE IF NOT EXISTS cache_meta (
  meta_key TEXT PRIMARY KEY,
  meta_value TEXT NOT NULL
);
```

Required meta keys:

- `cache_schema_version`
- `cache_schema_epoch`
- `last_migration_id`

## `cache_events` (optional audit/debug)

```sql
CREATE TABLE IF NOT EXISTS cache_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_ms INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  cache_key TEXT,
  details_json TEXT
);
```

---

## Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_cache_entries_prefix_mode
  ON cache_entries(query_prefix, mode);

CREATE INDEX IF NOT EXISTS idx_cache_entries_expiry
  ON cache_entries(expires_at_ms);

CREATE INDEX IF NOT EXISTS idx_cache_entries_lane_provider
  ON cache_entries(lane_id, provider_id);
```

---

## Migration model

Migration identifiers are monotonic:

```text
M0001_init
M0002_add_manifest_hash
M0003_add_meta_json
...
```

Rules:

1. Migrations are append-only.
2. Each migration runs in a transaction.
3. Migration failure => rollback and keep previous schema intact.
4. Startup blocks cache usage if migration status is unknown.

---

## Versioning semantics

- `cache_schema_version`: structural schema version.
- `cache_schema_epoch`: compatibility epoch tied to row/manifest contracts.

Invalidation rules:

1. If `cache_schema_version` mismatches current binary expectation and no migration exists -> clear cache safely.
2. If `cache_schema_epoch` mismatches -> selective invalidation by epoch (preferred) or full clear fallback.
3. If `manifest_hash` mismatches for entry lane/provider -> invalidate entry.

---

## WAL + checkpoint policy

On DB init:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA wal_autocheckpoint = 1000;
```

Operational guidance:

- keep transactions small/batched (write coalescing)
- run explicit checkpoint during idle windows when WAL grows
- avoid long-lived read transactions that starve checkpoints

---

## Data retention policy

- expired rows are lazy-pruned on read and proactively pruned periodically.
- maximum retained entries per `(mode, query_prefix)` window is bounded.
- prune strategy should preserve recent/high-hit entries first.

---

## Startup health checks

At broker startup:

1. open DB
2. validate/initialize meta
3. run pending migrations
4. verify required tables/indexes
5. emit cache readiness event

If any check fails:

- degrade to in-memory-only cache mode
- emit critical diagnostic
- keep search operational

---

## Example migration runner contract

```ts
type Migration = {
  id: string
  upSql: ReadonlyArray<string>
}

type MigrationRunner = {
  currentVersion: number
  loadApplied: () => Promise<ReadonlyArray<string>>
  apply: (migration: Migration) => Promise<void>
}
```

---

## Relationship to decision lock

This document resolves Decision Lock follow-up item:

- "SQLite persisted cache schema + migration/versioning format"

and is normative for cache persistence implementation.
