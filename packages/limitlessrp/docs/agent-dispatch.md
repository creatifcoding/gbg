# LimitlessRP Pi-Agent Dispatch Strategy

`workflows/iridium-research-scrape.prose.md` treats scraping as an agentic workflow. The orchestrator remains responsible for source selection, merge, and audit; specialist agents only extract cited facts from assigned source classes.

## Roles

| Role | Source class | Required output |
|---|---|---|
| `market-data-researcher` | `price-benchmark` | price/benchmark metadata, units, date, form, source limitation |
| `supply-demand-researcher` | `market-report`, `statistical-agency` | supply/demand facts, table/page anchors, market drivers |
| `compliance-provenance-researcher` | `responsible-sourcing`, `chain-of-custody` | due-diligence controls, required docs, audit language |
| `logistics-custody-researcher` | `market-context`, custody/logistics sources | physical form, assay, delivery, custody, transfer/settlement concerns |
| `source-quality-auditor` | merged outputs | rejected claims, citation gaps, stale data, unit ambiguity |

## Dispatch Pattern

Use the `subagent` tool after `subagent({ action: "list" })` confirms available agents. Prefer `researcher` or `delegate` when no domain-specific agent exists.

```ts
await subagent({
  tasks: [
    {
      agent: "researcher",
      task: "Act as market-data-researcher for @gbg/limitlessrp iridium. Read only assigned source URLs from data/sources/iridium.sources.json. Extract cited facts as JSON. No trade recommendations.",
      output: "packages/limitlessrp/data/cache/market-data-researcher.json",
      outputMode: "file-only"
    },
    {
      agent: "researcher",
      task: "Act as supply-demand-researcher for @gbg/limitlessrp iridium. Extract report/table facts with citation URLs/pages. No trade recommendations.",
      output: "packages/limitlessrp/data/cache/supply-demand-researcher.json",
      outputMode: "file-only"
    },
    {
      agent: "researcher",
      task: "Act as compliance-provenance-researcher for @gbg/limitlessrp iridium. Extract responsible-sourcing and chain-of-custody controls with citations.",
      output: "packages/limitlessrp/data/cache/compliance-provenance-researcher.json",
      outputMode: "file-only"
    },
    {
      agent: "researcher",
      task: "Act as logistics-custody-researcher for @gbg/limitlessrp iridium. Extract physical form, custody, assay, delivery, and settlement facts with citations.",
      output: "packages/limitlessrp/data/cache/logistics-custody-researcher.json",
      outputMode: "file-only"
    }
  ],
  concurrency: 4,
  cwd: "/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg"
})
```

## Merge Rules

1. Preserve every source ID and URL.
2. Keep conflicting facts instead of silently deduplicating.
3. Reject facts without citations.
4. Reject numerical claims with ambiguous unit, form, or date.
5. Separate observed facts from inferred implications.
6. Never emit buy/sell/hold guidance.

## Audit Output

The final audit should write:

- `packages/limitlessrp/data/cache/iridium.research-cache.json`
- `packages/limitlessrp/docs/research/iridium-refresh-report.md`

Both artifacts must include generation timestamp, source registry version, source limitations, rejected claims, and next refresh recommendations.
