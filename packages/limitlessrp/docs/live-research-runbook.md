# LimitlessRP Live Research Runbook

Use this runbook before refreshing iridium source facts with web scraping or Pi-agent dispatch.

## Preconditions

- The requester authorizes live web research for the commodity/source set.
- Source registry is valid: `bun -e 'JSON.parse(await Bun.file("packages/limitlessrp/data/sources/iridium.sources.json").text())'`.
- No private counterparty documents, credentials, banking details, or regulated advice requests are included in agent prompts.

## Tool Order

1. `web_search` with 2–4 varied queries for discovery and freshness.
2. `fetch_content` for known source URLs and PDFs.
3. `subagent` dispatch for parallel specialist extraction if source volume is high.
4. Manual audit / `source-quality-auditor` pass before writing cache artifacts.

## Source Trust Tiers

| Tier | Examples | Use |
|---|---|---|
| primary | USGS, LPPM, RJC standards | government/statistical/compliance baseline |
| industry | Johnson Matthey, Umicore | PGM market, price, form, trading context |
| secondary | aggregators, historical market pages | context only unless independently verified |
| unknown | blogs, unsourced pages | discovery only; do not cite as decision evidence |

## Refresh Cadence

- Price/benchmark pages: daily or per analysis run.
- Market reports: annual plus ad hoc event refresh.
- Responsible-sourcing and chain-of-custody standards: annual or when a new version is published.
- Counterparty-specific facts: per transaction; do not cache private identifiers in repo artifacts.

## Stop Conditions

Stop and escalate if:

- The user asks for a buy/sell/hold or personalized trading recommendation.
- Sanctions, customs, legal, tax, or regulated investment interpretation is required.
- A numerical price claim lacks date, unit, currency, or physical/economic form.
- Assay/title/custody evidence is missing for a real transaction under consideration.
- A source requires licensed access not available in the current environment.

## Required Artifact Fields

Every extracted fact must include:

- `sourceId`
- `kind`: observed/provided/calculated/inferred/unknown
- `claim`
- `field`
- `citation.url`
- `asOf` or explicit `unknown`
- `limitations[]`
- `confidence`

## Non-Advisory Boundary

LimitlessRP produces factual research and operational risk analysis. It does not recommend whether to buy, sell, hold, finance, hedge, or otherwise trade iridium.
