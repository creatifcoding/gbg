---
name: iridium_research_cache
kind: responsibility
---

### Goal

The iridium research cache is source-grounded, citation-audited, and fresh enough for non-advisory commodity due-diligence analysis.

### Requires

- the `source_refreshes` facet from the `iridium_source_refresh` gateway
- `packages/limitlessrp/data/sources/iridium.sources.json`
- `packages/limitlessrp/workflows/iridium-research-scrape.prose.md`
- source fetch outputs from specialist Pi research agents when live research is authorized

### Maintains

An audited iridium research cache. Material: source IDs, claims, evidence kind, citation URL/page/quote, `asOf`, field classification, source limitations, rejected claims, and refresh timestamp. Immaterial: scrape order, worker IDs, raw HTML noise, request IDs, and progress logs.

#### pricing_context

Cited price/benchmark metadata with explicit units, date, physical form, economic form, and source limitation notes.

#### supply_demand_context

Cited supply/demand and market-report facts, preserving report/table/page references and distinguishing PGM aggregate context from iridium-specific facts.

#### custody_compliance_context

Cited responsible-sourcing, chain-of-custody, assay, custody, delivery, and settlement facts relevant to due diligence.

#### rejected_claims

Claims rejected by the source-quality auditor because they are uncited, stale, ambiguous, unavailable, paywalled without licensed access, or missing unit/form/date context.

### Continuity

- input-driven: re-render when the source-refresh gateway receives a materially new source registry fingerprint.
- self-driven: pricing context older than one business day is stale for live analysis; market reports and standards older than their refresh cadence remain usable but must be marked with their `asOf` date.

### Execution

Use `workflows/iridium-research-scrape.prose.md` as the authored scraping routine. Dispatch specialist Pi agents only when live research is authorized. Merge results, run a source-quality audit, then write `packages/limitlessrp/data/cache/iridium.research-cache.json` and `packages/limitlessrp/docs/research/iridium-refresh-report.md`.

### Invariants

- Never fabricate prices, quantities, supply/demand figures, counterparty facts, assay results, or compliance documents.
- Every accepted fact must include a source ID and citation URL.
- Do not make buy/sell/hold, legal, tax, sanctions, customs, or investment recommendations.
- If live research is not authorized or a source is inaccessible, preserve existing cache facts and emit a stale or blocked receipt.
