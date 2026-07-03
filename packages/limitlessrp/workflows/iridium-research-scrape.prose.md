---
prose-version: 0.1
template: limitlessrp-agentic-scrape
status: draft
package: "@gbg/limitlessrp"
commodity: iridium
routine: source-grounded-scraping-and-audit
---

# Iridium Research Scrape and Agent Dispatch Workflow

## Goal

Refresh and audit source-grounded iridium commodity research facts for `@gbg/limitlessrp` by dispatching specialized Pi-based research agents, scraping/fetching source classes, extracting structured facts, and writing citation-ready artifacts. This workflow must never fabricate market data and must distinguish observed facts from inferred implications.

## Agent Roles

| Agent | Mission | Inputs | Output |
|---|---|---|---|
| market-data-researcher | Scrape price/benchmark/source metadata and current public price context. | Source registry entries with `sourceClass=price-benchmark`. | `pricingFacts[]` with units, form, date, source, limitations. |
| supply-demand-researcher | Extract supply/demand and PGM market context from reports and statistical agencies. | Market report and statistical-agency sources. | `marketContextFacts[]` with cited report/table references. |
| compliance-provenance-researcher | Extract responsible-sourcing, chain-of-custody, refiner/accreditation, and KYC/sanctions diligence vocabulary. | Responsible-sourcing and chain-of-custody sources. | `complianceFacts[]` and required due-diligence document checklist. |
| logistics-custody-researcher | Extract physical form, delivery, custody, assay, warehouse/refinery, and settlement considerations. | Trading pages plus industry custody sources. | `custodyFacts[]` and operational risk checklist. |
| source-quality-auditor | Verify every fact has citation, source class, timestamp, trust tier, and limitation note. | Outputs from all other agents. | `auditFindings[]`, rejected claims, and refresh recommendations. |

## Steps

- [load-source-registry] Read `packages/limitlessrp/data/sources/iridium.sources.json` and group sources by sourceClass, trustTier, and refreshCadence.
- [plan-agent-dispatch] Create a dispatch plan assigning each source group to the specialist agents defined above. Include source URLs, extraction fields, and stop conditions.
- [dispatch-market-data-agent] Dispatch `market-data-researcher` with price-benchmark sources; require units, form, date, pricing basis, and limitation notes.
- [dispatch-supply-demand-agent] Dispatch `supply-demand-researcher` with Johnson Matthey and USGS report sources; require table/page references where available.
- [dispatch-compliance-agent] Dispatch `compliance-provenance-researcher` with LPPM and RJC sources; require due-diligence document and audit-control language.
- [dispatch-logistics-agent] Dispatch `logistics-custody-researcher` with trading/custody sources; require physical form, chain-of-custody, assay, delivery, and settlement facts.
- [merge-agent-results] Merge all agent outputs into a draft extraction bundle. Preserve source IDs and do not deduplicate away conflicting facts.
- [audit-citations] Dispatch or run `source-quality-auditor`; reject uncited facts, stale facts, unparseable claims, and claims with ambiguous units/forms.
- [write-research-cache] Write audited results to `packages/limitlessrp/data/cache/iridium.research-cache.json` with generatedAt timestamp and source registry version.
- [write-refresh-report] Write a markdown refresh report under `packages/limitlessrp/docs/research/iridium-refresh-report.md` summarizing facts, rejected claims, source gaps, and recommended next scrape targets.

## Commands

```prose
run load-source-registry
run plan-agent-dispatch
run dispatch-market-data-agent
run dispatch-supply-demand-agent
run dispatch-compliance-agent
run dispatch-logistics-agent
run merge-agent-results
run audit-citations
run write-research-cache
run write-refresh-report
```

## Dispatch Template

When Pi subagent dispatch is available, use this structure for each specialist:

```ts
await subagent({
  agent: "research-agent",
  task: `You are the <agent-role> for LimitlessRP iridium research. Read only the assigned sources. Extract only cited facts for the requested fields. Return JSON with facts[], limitations[], rejectedClaims[], and recommendedRefreshCadence. Do not make trade recommendations.`,
  output: "packages/limitlessrp/data/cache/<agent-role>.json",
  outputMode: "file-only"
})
```

For parallel source-class dispatch, use:

```ts
await subagent({
  tasks: [
    { agent: "research-agent", task: "market-data-researcher ...", output: "packages/limitlessrp/data/cache/market-data-researcher.json", outputMode: "file-only" },
    { agent: "research-agent", task: "supply-demand-researcher ...", output: "packages/limitlessrp/data/cache/supply-demand-researcher.json", outputMode: "file-only" },
    { agent: "research-agent", task: "compliance-provenance-researcher ...", output: "packages/limitlessrp/data/cache/compliance-provenance-researcher.json", outputMode: "file-only" },
    { agent: "research-agent", task: "logistics-custody-researcher ...", output: "packages/limitlessrp/data/cache/logistics-custody-researcher.json", outputMode: "file-only" }
  ],
  concurrency: 4
})
```

## Extraction Contract

Each agent returns JSON:

```json
{
  "agentRole": "market-data-researcher",
  "generatedAt": "ISO-8601",
  "sourcesRead": ["source-id"],
  "facts": [
    {
      "id": "stable-fact-id",
      "sourceId": "johnson-matthey-pgm-management",
      "kind": "observed",
      "claim": "short factual claim",
      "field": "pricingBasis",
      "unit": "USD/troy oz",
      "asOf": "date or unknown",
      "citation": { "url": "https://...", "quote": "verbatim or close snippet", "page": "optional" },
      "limitations": ["OTC quote, not guaranteed executable"],
      "confidence": "high|medium|low"
    }
  ],
  "rejectedClaims": [
    { "claim": "...", "reason": "uncited|ambiguous-unit|stale|not-source-supported" }
  ],
  "limitations": ["..."],
  "recommendedRefreshCadence": "daily|weekly|monthly|annual|on-demand"
}
```

## Guardrails

- Prefer primary or industry sources over SEO summaries.
- Use licensed/paywalled source metadata only as metadata unless the user provides authorized access.
- For PDFs, preserve page/table context and units.
- Do not turn source context into a buy/sell/hold recommendation.
- Do not infer current prices from old historical pages.
- Every extracted fact must include a source ID and URL.
- If source extraction fails, record the failure and continue with other sources.
