# Prospect Pipeline — Architecture (Ratified)

**Status:** Ratified v1
**Date:** 2026-03-31
**Infrastructure:** PostgreSQL + Effect Cluster + Effect Workflow

---

## Topology

```
                    ┌─────────────────────────────────────────┐
                    │           EFFECT CLUSTER                │
                    │                                         │
  Connectors        │  ┌──────────────────────────────────┐  │
  (pure fetchers)   │  │       WORKFLOW ENGINE             │  │
                    │  │                                    │  │
  ┌───────────┐     │  │  HarvestWorkflow                  │  │
  │ SEC EDGAR │────▶│  │    Activity: dedup                │  │
  ├───────────┤     │  │    Activity: ingest  ──────────┐  │  │
  │USASpending│────▶│  │    Activity: signals            │  │  │
  ├───────────┤     │  │    Activity: decision_makers    │  │  │
  │  State    │────▶│  │    Activity: score              │  │  │
  │ Registry  │     │  │    Activity: report             │  │  │
  ├───────────┤     │  │                                 │  │  │
  │Crunchbase │────▶│  └─────────────────────────────────│──┘  │
  ├───────────┤     │                                    │     │
  │Job Posts  │────▶│  ┌─────────────────────────────────▼──┐  │
  └───────────┘     │  │          ENTITY ACTORS             │  │
                    │  │                                     │  │
                    │  │  CompanyEntity ────────────┐        │  │
                    │  │  DecisionMakerEntity ──────┤        │  │
                    │  │  SignalEntity ─────────────┤        │  │
                    │  │  ProposalEntity ───────────┤        │  │
                    │  │  OutreachEntity ───────────┘        │  │
                    │  │         │                           │  │
                    │  │         │ (every RPC handler)       │  │
                    │  │         ▼                           │  │
                    │  │  ┌──────────────────────┐          │  │
                    │  │  │  PROVENANCE WRITE    │          │  │
                    │  │  │  (baked into entity  │          │  │
                    │  │  │   behavior, not a    │          │  │
                    │  │  │   separate service)  │          │  │
                    │  │  └──────────┬───────────┘          │  │
                    │  └─────────────│───────────────────────┘  │
                    │               │                          │
                    └───────────────│──────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────────┐
                    │          POSTGRESQL               │
                    │                                   │
                    │  prospects schema                 │
                    │  ├── companies                    │
                    │  ├── decision_makers              │
                    │  ├── signals                      │
                    │  ├── proposals                    │
                    │  ├── outreach                     │
                    │  ├── field_provenance (current)   │
                    │  ├── field_changelog  (deltas)    │
                    │  ├── harvest_batches              │
                    │  └── enrichments                  │
                    │                                   │
                    │  effect_cluster schema            │
                    │  ├── workflow journal             │
                    │  ├── entity state                 │
                    │  ├── durable queues               │
                    │  └── activity results             │
                    │                                   │
                    │  effect_sql_migrations            │
                    └──────────────────────────────────┘
```

---

## Layer 1: Connectors (Pure Fetchers)

Connectors are **stateless, pure fetchers**. They return `HarvestCompanyRecord[]`.
They do NOT write to the database. They do NOT call entity RPCs.
They are the input to the Workflow.

| Connector | Source | Auth | Status |
|-----------|--------|------|--------|
| SEC EDGAR | efts.sec.gov | None | ✅ Working (90 companies) |
| USASpending | api.usaspending.gov | None | ✅ Working (297 companies) |
| State Registry | Socrata SODA API (10 states) | None | ✅ Working (2,972 companies) |
| Crunchbase | api.crunchbase.com | API key (free) | 🔑 Needs key |
| Job Postings | Google CSE | API key (free) | 🔑 Needs key |
| Web Scraper | Thomasnet, ENR | Scraping | ⚠️ Blocked |

---

## Layer 2: Workflow (Durable Pipeline)

The `HarvestWorkflow` is the single entrypoint for all data ingestion.
Defined via `Workflow.make` with `Activity` steps.
Registered with `ClusterWorkflowEngine` on cluster startup.

### Activities (Durable Steps)

Each Activity's result is persisted. On retry, completed Activities replay their result.

| Activity | Input | Output | Entity RPCs Called |
|----------|-------|--------|--------------------|
| **dedup** | raw records | { new: Record[], existing: Record[] } | none (read-only SQL) |
| **ingest** | new records | company IDs | CompanyEntity.Create × N |
| **enrich** | existing records | enrichment count | CompanyEntity.Enrich × N |
| **signals** | all records with signals | signal IDs | SignalEntity.Create × N |
| **decision_makers** | records with DMs | DM IDs | DecisionMakerEntity.Create × N |
| **score** | — | CIP scores | DecisionMakerEntity.RecalculateCIP × N |
| **report** | — | summary stats | none (read-only SQL) |

### Failure Semantics

- If `signals` fails → `dedup` and `ingest` don't re-run (Activity results persisted)
- If `score` fails → all prior steps don't re-run
- Each Activity has `Activity.retry({ times: 3 })` for transient failures
- `DurableClock.sleep` between steps for rate limiting

---

## Layer 3: Entity Actors (Durable State)

Entities are the mutation interface. ALL writes go through entity RPCs.
No raw SQL inserts in the harvest service — entity handlers own the writes.

### Entity Behavior Pattern

```typescript
// Inside CompanyEntity handler for Create RPC:
Effect.gen(function* () {
  // 1. Write the company row
  yield* sql`INSERT INTO companies (...) VALUES (...)`

  // 2. Write provenance for EVERY field — in parallel
  yield* Effect.forEach(fieldWrites, (fw) =>
    provenanceWrite(fw),
    { concurrency: 10, discard: true }
  )

  // 3. Return the created company
  return companyView
})
```

Provenance is NOT a separate service call. It's baked into the entity handler.
The entity knows which connector populated which field because the RPC payload carries that metadata.

---

## Layer 4: Provenance (Two-Table Model)

Inspired by OpenMetadata's lineage storage. 86% storage reduction vs naive append-only.

### `field_provenance` (Current State)

One row per entity + field. Upserted on every write.

```sql
CREATE TABLE field_provenance (
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  field_name    TEXT NOT NULL,
  value         TEXT,
  source_json   JSONB NOT NULL,     -- {connector, dataset, query, batchId, url}
  transform_json JSONB,             -- {function, inputs, version}
  confidence    REAL NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (entity_type, entity_id, field_name)
);
```

### `field_changelog` (Deltas Only)

Appended ONLY when a value actually changes. Not on redundant refreshes.

```sql
CREATE TABLE field_changelog (
  id            SERIAL PRIMARY KEY,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  field_name    TEXT NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  source_json   JSONB NOT NULL,
  transform_json JSONB,
  confidence    REAL NOT NULL,
  changed_at    TIMESTAMPTZ NOT NULL
);
```

### Storage Estimate (50K companies, 1 year)

| Approach | Entries | Storage |
|----------|---------|---------|
| Naive append-only | 13.5M | 4.4 GB |
| Current + changelog | 1.9M | 641 MB |
| **Savings** | | **86%** |

---

## Layer 5: HTTP API (Entity-Derived)

`EntityProxy.toHttpApiGroup` derives HTTP endpoints from Entity RPCs.
Hand-wired groups for batch operations (harvest) and aggregates (pipeline stats).

Swagger at `/docs`.

---

## Infrastructure: PostgreSQL

Single PostgreSQL instance hosts both:
- `prospects` schema — all pipeline tables
- `effect_cluster` schema — workflow journal, entity state, activity results

The switch from SQLite is a Layer change:
```typescript
// Before:
const DbLayer = ProspectDbLayer() // SqliteClient

// After:
const DbLayer = PgClient.layer({
  host: 'localhost', port: 5432,
  database: 'prospects', username: 'prospects',
  password: Redacted.make('...')
})
```

DDL adjustments: `DATETIME → TIMESTAMPTZ`, `TEXT → JSONB` for JSON columns,
`INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY`.

---

## Build Order (from here)

| Step | What | Depends On |
|------|------|-----------|
| 1 | PG migration of DDL (SQLite → PG syntax) | Docker compose for PG |
| 2 | Provenance tables DDL + ProvenanceService | PG |
| 3 | Entity behaviors (handlers that write data + provenance) | Provenance |
| 4 | HarvestWorkflow with Activity steps | Entity behaviors |
| 5 | Wire connectors → Workflow.execute | Workflow |
| 6 | Schedule registration (daily/weekly cron) | Workflow |
| 7 | State Registry → all 50 states (add more SODA sources) | Connectors |
| 8 | Enrichment workflow (cross-source field filling) | Provenance + entities |
| 9 | CIP scoring as Workflow Activity | Enrichment |
| 10 | HTTP API via EntityProxy.toHttpApiGroup | All |

---

*Architecture ratified 2026-03-31. Val.*
