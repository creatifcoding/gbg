---
name: iridium_source_refresh
kind: gateway
---

### Goal

Accept source-refresh arrivals for LimitlessRP iridium commodity intelligence and expose the source registry revision as a materialized set other responsibilities can subscribe to.

### Maintains

The set of iridium source-refresh arrivals. Material: each arrival's stable `id`, `sourceRegistryPath`, `sourceRegistrySha`, `requestedAt`, and `refreshReason`. Immaterial: local run IDs, operator names, log timestamps, and transient scraper telemetry.

#### source_refreshes

The accepted source-refresh set, folded from external arrivals staged at the edge. Each item points to `packages/limitlessrp/data/sources/iridium.sources.json` or a later source-registry revision.

### Continuity

- external-driven: wake when a user, scheduler, webhook, or file watcher submits a new source-refresh arrival.
- self-driven: if no source refresh arrives for seven days, emit a stale-source warning receipt rather than fabricating fresh market context.

### Invariants

- Do not mutate source registry contents directly.
- Do not ingest private counterparty documents into the durable reactor state.
- Every arrival must preserve `sourceRegistryPath` and a source-registry fingerprint.
