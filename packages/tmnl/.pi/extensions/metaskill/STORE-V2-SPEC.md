# RLM Store v2 — Domain-Agnostic Knowledge Persistence SDK

## Architecture

Effect v4 `ServiceMap.Service` internals. Plain `ms.*` surface for eval sandbox.
Effect runtime resolved ONCE at extension init, then ms methods are plain sync/async functions.

### Service Graph

```
StoreConfig ─────┐
                  ├──→ Store ──→ DomainRegistry
SqliteClient ────┘       │
                         └──→ SearchIndex (FTS5)
```

### Import Convention

```ts
// Effect v4 is aliased in @tmnl/* packages:
import { ServiceMap, Effect, Layer, Schema } from "effect-v4"

// In the metaskill extension (runs under Node 24, not in @tmnl/* packages):
// We use effect (v3 in root) — BUT the store-v2 schemas/services
// should be written as PURE TypeScript with no Effect dependency
// because the extension runs in Node 24's new Function() sandbox.
//
// DECISION: The Effect Service architecture is the DESIGN PATTERN,
// but implementation uses plain TypeScript classes/functions because
// the metaskill extension cannot import effect (it's a pi extension,
// not a @tmnl/* package). The ServiceMap.Service pattern informs
// the DI structure (constructor injection, interface segregation).
```

## Track 1: Schema Layer

Files: `.pi/extensions/metaskill/store/schemas.ts`

### ObjectMeta

```ts
interface ObjectMeta {
  /** REQUIRED — one-line description of what this object IS */
  summary: string
  /** Where the data came from */
  source?: string
  /** Why it was stored — the goal driving collection */
  intent?: string
  /** Structure version tag */
  schema?: string
  /** Open bag — domain-specific fields */
  [key: string]: unknown
}
```

Validation: `summary` must be non-empty string. All other fields optional.

### Namespace

Pattern: `/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){0,2}$/`

- 1-3 dot-separated segments
- Each segment: lowercase kebab-case, starts with letter
- Reserved prefix: `_system` (internal use)

Examples: `osint.scans.mil`, `finance.tickers`, `scratch`

### Key Format

Two modes, detected by presence of `--`:

**Temporal**: `{prefix}--{YYYYMMDDTHHMMSS}`
- prefix: kebab-case noun phrase
- suffix: ISO compact timestamp
- Example: `mil-theater-scan--20260304T033932`

**Canonical**: `{name}` (plain kebab-case, no `--`)
- Reference/config data, overwrite-in-place
- Example: `forte-target-profile`

Validation: `/^[a-z][a-z0-9-]*(?:--\d{8}T\d{6})?$/`

### DomainConfig

```ts
interface DomainConfig {
  description: string
  collections: Record<string, {
    description: string
    icon?: string
    retention?: string  // 'forever' | '30d' | '7d' etc.
  }>
  meta: {
    required: string[]      // minimum: ['summary']
    recommended?: string[]  // steering suggests these
  }
}
```

Stored in `_system.domains` collection. Key = domain name.

## Track 2: Service Layer

Files: `.pi/extensions/metaskill/store/sqlite.ts`, `.pi/extensions/metaskill/store/service.ts`, `.pi/extensions/metaskill/store/search.ts`, `.pi/extensions/metaskill/store/domains.ts`

### SqliteClient

Wraps `node:sqlite` DatabaseSync (with `bun:sqlite` fallback).
Existing runtime-adaptive import pattern from current `store.ts`.

### StoreConfig

```ts
interface StoreConfig {
  dbPath: string
  defaultMetaRequired: string[]  // ['summary']
}
```

### Store Service

Core operations, all validate via schemas before SQLite write:

- `put(ns, key, data, opts?)` — validate ns/key/meta, store with envelope
- `putNow(ns, prefix, data, opts?)` — auto-timestamp key
- `get(ns, key)` — return data WITHOUT `_meta`
- `getRaw(ns, key)` — return data WITH `_meta`
- `delete(ns, key)` — remove
- `clear(ns)` — wipe collection
- `keys(ns)` — list keys
- `query(ns, filter?)` — by tags / JSON path (existing logic)
- `describe(ns, key)` — return only `_meta`
- `catalog(nsGlob?)` — all entries with summaries
- `collections(glob?)` — list collections, optional glob filter
- `vars()` — full inventory

### SQLite Schema (v2 migration)

```sql
-- Add summary/intent columns for FTS indexing
ALTER TABLE objects ADD COLUMN summary TEXT;
ALTER TABLE objects ADD COLUMN intent TEXT;
ALTER TABLE objects ADD COLUMN source TEXT;

-- FTS5 virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS objects_fts USING fts5(
  summary, intent, source,
  content=objects,
  content_rowid=rowid
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS objects_ai AFTER INSERT ON objects BEGIN
  INSERT INTO objects_fts(rowid, summary, intent, source)
  VALUES (new.rowid, new.summary, new.intent, new.source);
END;

CREATE TRIGGER IF NOT EXISTS objects_ad AFTER DELETE ON objects BEGIN
  INSERT INTO objects_fts(objects_fts, rowid, summary, intent, source)
  VALUES ('delete', old.rowid, old.summary, old.intent, old.source);
END;

CREATE TRIGGER IF NOT EXISTS objects_au AFTER UPDATE ON objects BEGIN
  INSERT INTO objects_fts(objects_fts, rowid, summary, intent, source)
  VALUES ('delete', old.rowid, old.summary, old.intent, old.source);
  INSERT INTO objects_fts(rowid, summary, intent, source)
  VALUES (new.rowid, new.summary, new.intent, new.source);
END;
```

### SearchIndex Service

- `search(text, nsGlob?)` — FTS5 MATCH query, returns ranked catalog entries
- Auto-maintained via triggers
- Scoped by namespace glob (optional)

### DomainRegistry Service

- `register(name, config)` — store in `_system.domains`
- `list()` — return all registered domains
- `getConfig(ns)` — look up domain config for a namespace (strips sub-segments)
- Used by Store.put() to validate meta requirements per domain

## Track 3: Fluent Builders

Files: `.pi/extensions/metaskill/store/query-builder.ts`, `.pi/extensions/metaskill/store/put-builder.ts`

### QueryBuilder (ms.from)

```ts
class QueryBuilder {
  constructor(private store: StoreService, private ns: string) {}

  tagged(...tags: string[]): this          // add tag filter
  where(path: string, value: any): this    // JSON path filter
  search(text: string): this               // FTS5 filter
  limit(n: number): this                   // max results
  after(isoDate: string): this             // temporal filter

  // Terminals
  keys(): string[]                         // just keys
  entries(): StoredObject[]                // full objects (data only, no _meta)
  summaries(): CatalogEntry[]              // collection + key + _meta fields
  count(): number                          // count matching
}
```

### PutBuilder (ms.into)

```ts
class PutBuilder {
  constructor(private store: StoreService, private ns: string) {}

  key(k: string): this                     // set key
  timestamped(): this                      // append --ISO to key
  data(d: any): this                       // set payload
  meta(m: ObjectMeta): this                // set _meta
  tags(...t: string[]): this               // set tags

  // Terminal
  put(): { ns: string, key: string }       // validate + store
}
```

### Inline Factory Pattern (for complex batch ops)

```ts
// Agent can define reusable factories in eval:
const scanPut = (prefix, data, summary, source) =>
  ms.into('osint.scans')
    .key(prefix).timestamped()
    .data(data)
    .meta({ summary, source })
    .tags('live', 'military')
    .put()

// Use in batch:
results.forEach(r => scanPut('mil-scan', r, `Scan at ${r.ts}`, 'adsb.lol'))
```

## Track 4: API Facade

File: `.pi/extensions/metaskill/store/api.ts` (new), wired in `index.ts`

Resolves Effect-style service graph once, exports plain functions.
Backward-compatible: `ms.store()` remains as alias to `ms.put()`.

## Track 5: Steering & Tool Guide

### Steering Rules

- ⚠️ `put()` without meta → "Add meta: { summary: '...' } for discoverability"
- ⚠️ bad namespace format → "Namespace must be dot-separated kebab: domain.category"
- ⚠️ non-kebab key → "Keys must be kebab-case, optionally --YYYYMMDDTHHMMSS"
- 💡 3+ query() calls in one eval → "Try ms.from(ns).tagged(...).entries() for cleaner queries"
- 💡 domain not registered → "Register with ms.domain('name', config) for validation"

### Tool Guide (progressive disclosure)

**Section 1 — Basic (always shown)**:
put, putNow, get, search, collections, catalog

**Section 2 — Intermediate (shown after first domain registration or 10+ stored objects)**:
describe, getRaw, domain, domains, query with filters

**Section 3 — Advanced (shown after first from()/into() usage)**:
from().tagged().search().entries(), into().key().timestamped().put(), inline factory patterns

## Track 6: Tests

- `store-v2.schema.test.ts` — Schema validation (~20 tests)
- `store-v2.bun.test.ts` — Service integration with SQLite (~30 tests)
- `store-v2.fluent.test.ts` — Query/Put builders (~15 tests)
- `store-v2.compat.test.ts` — Backward compatibility (~10 tests)

Total: ~75 new tests + 39 existing = ~114 store tests
