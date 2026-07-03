# RFC: Prospect Data Pipeline Architecture

**Status:** Draft v1
**Author:** Val (architectural layer)
**Date:** 2026-03-30
**Module:** `src/lib/prospects/`

---

## 1. Problem Statement

The prospect pipeline has entities (Company, DecisionMaker, Signal, Proposal, Outreach) and an ingestion API, but no automated data collection. Companies are manually scraped and seeded via CLI scripts. This doesn't scale.

We need a data pipeline that:
- **Harvests** from 6+ public data sources on a schedule
- **Enriches** harvested records with cross-source data
- **Scores** prospects via CIP (Capital × Interest × Power)
- **Refreshes** stale data automatically
- **Monitors** pipeline health, source availability, and data freshness

**Budget constraint:** $0/month — free-tier APIs and public data only.

**Infrastructure constraint:** Runs on Effect Cluster with Effect Workflow/Schedule. Hosted on a single VPS alongside the existing cluster infrastructure.

---

## 2. Source Connector Registry

Each source is an Effect.Service with a standard interface. Sources return `HarvestCompanyRecord[]` — the existing ingestion schema.

### Tier 1: Free Public REST APIs (MVP — build first)

| Source | API | Data Yield | Refresh |
|--------|-----|-----------|---------|
| **SAM.gov** | `api.sam.gov/opportunities/v2/search` | Government contract opportunities: company, NAICS code, set-aside, dollar range, agency | Daily |
| **SAM.gov Entities** | `api.sam.gov/entity-information/v3/entities` | Registered contractors: name, CAGE code, NAICS, size, address, POC | Weekly |
| **SEC EDGAR** | `efts.sec.gov/LATEST/search-index` | Public company filings: 10-K (capex/IT spend), proxy (exec comp), 8-K (M&A) | Monthly |
| **USPTO PatentsView** | `api.patentsview.org/patents/query` | Patent filings by assignee + CPC class: reveals R&D investment areas | Monthly |
| **Federal Procurement (FPDS)** | `www.fpds.gov/ezsearch` | Historical contract awards: who won what, dollar amounts, agencies | Weekly |
| **OpenCorporates** | `api.opencorporates.com` (free tier) | Company registry data: incorporation, officers, jurisdiction | On-demand |

### Tier 2: Structured Scraping (build second)

| Source | Method | Data Yield | Refresh |
|--------|--------|-----------|---------|
| **ENR Top Lists** | Scrape published HTML/PDF | Top 400 Contractors, revenue, specialties | Annually |
| **Trade Show Exhibitors** | Scrape exhibitor pages | Company, category, booth, website | Per-event |
| **ABC/AGC Member Directories** | Scrape member pages | Contractor name, location, specialties | Quarterly |
| **CEMA Members** | Scrape directory | Conveyor equipment companies | Quarterly |
| **State License Registries** | Scrape per-state | Licensed contractors by trade, location | Monthly |
| **Thomasnet** | Scrape category pages | Company, location, products, certifications | Weekly |

### Tier 3: Enrichment Sources (build third)

| Source | Method | Data Yield | Cost |
|--------|--------|-----------|------|
| **Clearbit Free** | API (limited) | Company domain → logo, industry, employee count | Free (50 req/mo) |
| **Hunter.io Free** | API | Domain → email pattern, verified emails | Free (25 req/mo) |
| **LinkedIn (public profiles)** | Scrape (careful) | Person title, tenure, connections | Free (risk) |
| **Google Search** | Custom search API or scrape | Company news, press releases, job postings | Free (100 req/day) |
| **GitHub** | API | Tech stack signals, open source activity | Free (5000 req/hr) |

---

## 3. Connector Interface Contract

Every source connector implements a single Effect.Service interface:

```typescript
/**
 * SourceConnector — standard interface for all data sources.
 *
 * Each source produces HarvestCompanyRecord[] that feeds
 * into HarvestService.ingestBatch().
 */
interface SourceConnectorShape {
  /** Unique identifier for this source */
  readonly sourceId: HarvestSource

  /** Human-readable name */
  readonly displayName: string

  /** Fetch a page of results for a given query/category */
  readonly fetch: (params: {
    readonly query?: string
    readonly category?: string
    readonly page?: number
    readonly limit?: number
  }) => Effect.Effect<{
    readonly records: ReadonlyArray<HarvestCompanyRecord>
    readonly totalAvailable: number
    readonly nextPage: number | null
  }, ConnectorError>

  /** Health check — is this source reachable? */
  readonly healthCheck: Effect.Effect<{
    readonly healthy: boolean
    readonly latencyMs: number
    readonly lastSuccessAt: string | null
  }, ConnectorError>
}
```

Each connector is an `Effect.Service`:

```typescript
class SAMGovConnector extends Effect.Service<SAMGovConnector>()(
  'prospects/connectors/SAMGov',
  { effect: Effect.gen(function* () { /* ... */ }) }
) {}
```

---

## 4. Pipeline Stages

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   HARVEST    │────▶│   DEDUP     │────▶│   ENRICH    │────▶│    SCORE     │
│              │     │             │     │             │     │              │
│ Source APIs  │     │ Slug match  │     │ Cross-ref   │     │ CIP calc     │
│ → raw records│     │ Merge/skip  │     │ Fill gaps   │     │ Tier assign  │
└─────────────┘     └─────────────┘     └─────────────┘     └──────────────┘
       │                                                           │
       │                   ┌──────────────┐                        │
       └──────────────────▶│   MONITOR    │◀───────────────────────┘
                           │              │
                           │ Health checks│
                           │ Freshness    │
                           │ Alert on fail│
                           └──────────────┘
```

### Stage 1: HARVEST
- Connector fetches from source API
- Returns `HarvestCompanyRecord[]`
- Logged in `harvest_batches` table with provenance

### Stage 2: DEDUP
- Slug-based deduplication (existing logic in HarvestService)
- New records inserted, existing records enriched if new data is richer
- Cross-source identity resolution: same company from SAM.gov + Thomasnet + ENR

### Stage 3: ENRICH
- Cross-reference harvested companies against enrichment sources
- Fill missing fields: employee count, revenue, website, description
- Log every enrichment in `enrichments` table with source + confidence

### Stage 4: SCORE
- Recalculate CIP for all decision makers affected by new data
- Auto-assign pipeline stage transitions (harvested → enriched → scored)
- Flag companies that crossed tier thresholds for attention

### Stage 5: MONITOR
- Track source health (is SAM.gov responding?)
- Track data freshness (when was each company last refreshed?)
- Alert on: source failure, stale data, anomalous batch sizes

---

## 5. Scheduling — Effect Workflow + Schedule

Using `@effect/cluster` Workflow for durable, resumable pipeline runs.

```typescript
import { Workflow } from '@effect/cluster'
import { Schedule } from 'effect'

/**
 * Daily harvest workflow — runs each Tier 1 connector.
 *
 * Durable: survives process restarts.
 * Idempotent: skips sources that already ran today.
 * Composable: each connector is an independent step.
 */
const DailyHarvestWorkflow = Workflow.make('prospects/DailyHarvest', {
  steps: [
    { id: 'sam-gov-opps', run: samGovOpportunities },
    { id: 'sam-gov-entities', run: samGovEntities },
    { id: 'fpds-awards', run: fpdsAwards },
    { id: 'enrich-pass', run: enrichmentSweep },
    { id: 'cip-recalc', run: cipRecalculation },
    { id: 'health-report', run: healthReport },
  ],
})

/**
 * Weekly harvest workflow — Tier 1 + Tier 2 sources.
 */
const WeeklyHarvestWorkflow = Workflow.make('prospects/WeeklyHarvest', {
  steps: [
    ...DailyHarvestWorkflow.steps,
    { id: 'sec-edgar', run: secEdgarScan },
    { id: 'uspto-patents', run: usptoPatentScan },
    { id: 'thomasnet-categories', run: thomasnetScrape },
    { id: 'state-licenses', run: stateLicenseScrape },
    { id: 'full-enrich', run: fullEnrichmentSweep },
    { id: 'full-cip-recalc', run: cipRecalculation },
  ],
})

/**
 * Schedule registration — runs on cluster startup.
 */
const PipelineSchedules = Effect.gen(function* () {
  yield* Workflow.schedule(DailyHarvestWorkflow, {
    schedule: Schedule.cron('0 6 * * *'), // 6 AM daily
  })
  yield* Workflow.schedule(WeeklyHarvestWorkflow, {
    schedule: Schedule.cron('0 4 * * 0'), // 4 AM Sunday
  })
})
```

### On-Demand Triggers

In addition to scheduled runs, the HTTP API exposes manual triggers:

```
POST /harvest/companies     — ad-hoc company batch
POST /harvest/signals       — ad-hoc signal batch
POST /harvest/trigger/daily — manually trigger daily workflow
POST /harvest/trigger/weekly — manually trigger weekly workflow
```

---

## 6. Free API Implementation Details

### SAM.gov Opportunities API

```
GET https://api.sam.gov/opportunities/v2/search
  ?api_key={key}           // free registration at sam.gov
  &postedFrom=2026-03-01
  &postedTo=2026-03-30
  &ncode=541512,541511     // NAICS: Computer Systems Design + Custom Programming
  &limit=100
  &offset=0
```

Response yields:
- `title` → Signal.title
- `department` → company context
- `naicsCode` → industry mapping
- `postedDate` → Signal.detectedAt
- `responseDeadLine` → Signal.expiresAt
- `uiLink` → Signal.sourceUrl
- `placeOfPerformance` → GeoLocation

### SEC EDGAR Full-Text Search

```
GET https://efts.sec.gov/LATEST/search-index
  ?q="SCADA" OR "digital transformation" OR "custom software"
  &dateRange=custom
  &startdt=2026-01-01
  &enddt=2026-03-30
  &forms=10-K,8-K
```

Response yields:
- Filing company → Company.name
- CIK → identifier for enrichment
- Filing text mentions → Signal (company discussing SCADA/DT in SEC filings = strong interest signal)

### USPTO PatentsView API

```
GET https://api.patentsview.org/patents/query
  ?q={"_and":[
    {"_gte":{"patent_date":"2025-01-01"}},
    {"_or":[
      {"_text_any":{"patent_abstract":"SCADA conveyor automation"}},
      {"assignee_organization":"vanderlande"}
    ]}
  ]}
  &f=["patent_number","patent_title","patent_date","assignee_organization","assignee_city","assignee_state"]
```

Response yields:
- `assignee_organization` → Company.name
- `assignee_city/state` → GeoLocation
- Patent filings → Signal (patent_filing type, weight 2)

---

## 7. Data Freshness Model

Every company gets a `lastRefreshedAt` timestamp per source. Data is considered:

| Age | Status | Action |
|-----|--------|--------|
| < 7 days | **Fresh** | No action |
| 7–30 days | **Aging** | Queue for next scheduled refresh |
| 30–90 days | **Stale** | Priority refresh on next run |
| > 90 days | **Expired** | Flag for manual review, may be defunct |

Freshness is tracked per-source per-company in the `enrichments` table.

---

## 8. Error Handling & Resilience

All connectors use Effect patterns:

- `Effect.retry(Schedule.exponential("1 second").pipe(Schedule.compose(Schedule.recurs(3))))` — retry with backoff
- `Effect.timeout(Duration.seconds(30))` — per-request timeout
- `Effect.catchTag("ConnectorError", ...)` — source-specific error handling
- Failed sources don't block the pipeline — other sources continue
- Failed batches logged in `harvest_batches` with `status: 'failed'` and error details

---

## 9. Build Order (Reordered: fastest-to-outreach first)

| Step | What | Why First | Estimated Effort |
|------|------|-----------|-----------------|
| 1 | `SourceConnector` interface + `ConnectorError` schema | Foundation for all connectors | 1 hour |
| 2 | **Job Posting Connector** (Indeed API + career page scrape) | Live budget + active pain + reachable hiring manager | 3 hours |
| 3 | **Crunchbase Connector** (free tier, 200 req/mo) | Recently funded = cash + building = need dev capacity | 2 hours |
| 4 | **SEC EDGAR Connector** (full-text search) | Exec-level commitment to spend, in writing, filed with SEC | 2 hours |
| 5 | Pipeline orchestrator (harvest → dedup → enrich → score) | Wires connectors into automated flow | 3 hours |
| 6 | Effect Schedule registration | Automates daily/weekly runs | 1 hour |
| 7 | Health check + monitoring | Operational awareness | 2 hours |
| 8 | SAM.gov Connector (Opportunities + Entities) | Government contracts — longer cycle but high value | 2 hours |
| 9 | USPTO PatentsView Connector | R&D investment signals | 1 hour |
| 10 | Thomasnet scraper (Tier 2) | Largest industrial company index | 3 hours |
| 11 | ENR + Trade show scrapers (Tier 2) | Ranked lists + event exhibitors | 3 hours |
| 12 | Enrichment sweep service | Cross-source data filling | 3 hours |

**Total estimated: ~26 hours of implementation.**
**First outreach-ready data: after steps 1-4 (~8 hours).**

---

## 10. Open Questions

1. **SAM.gov API key** — free but requires registration. Do we have one?
2. **VPS specs** — what's the target host? RAM/disk for SQLite + Effect Cluster?
3. **Identity resolution** — when SAM.gov and Thomasnet both have "Conveyor Specialties Inc", how aggressively do we merge? Slug-only, or also match on address/website?
4. **Workflow persistence** — Effect Workflow uses a journal. Same SQLite, or separate?
5. **Rate limiting strategy** — should connectors share a global rate limiter, or each manage their own?

---

*RFC v1 — awaiting ratification. Amendments expected on scheduling infrastructure, identity resolution, and connector priority order.*
