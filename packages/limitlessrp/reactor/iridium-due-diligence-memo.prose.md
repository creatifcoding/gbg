---
name: iridium_due_diligence_memo
kind: responsibility
---

### Goal

The iridium due-diligence memo reflects the latest audited research cache and the current intake state, while preserving unknowns and avoiding trade recommendations.

### Requires

- the `pricing_context`, `supply_demand_context`, `custody_compliance_context`, and `rejected_claims` facets from `iridium_research_cache`
- `packages/limitlessrp/workflows/iridium-commodity-trade-analysis.prose.md`
- an iridium intake payload supplied by a user or approved operator

### Maintains

A non-advisory iridium due-diligence memo. Material: executive summary, collected facts, missing details, normalized economics assumptions, market context, operational/custody risk, counterparty/compliance risk, red flags, next due-diligence actions, and non-advisory notice. Immaterial: formatting-only changes, run IDs, local cache paths, and diagnostic logs.

#### missing_details

The fields still marked `unknown`, grouped by objective, instrument, commercial terms, custody/logistics, counterparty/compliance, and risk controls.

#### red_flag_register

Risk flags with severity, trigger, evidence, and required action. Assay, title, chain of custody, KYC/sanctions, and pricing-basis unknowns are critical until resolved.

#### memo_markdown

The rendered markdown memo matching the output contract in `iridium-commodity-trade-analysis.prose.md`.

### Continuity

- input-driven: re-render when audited research cache facets move or when the intake payload changes.
- self-driven: if pricing context becomes stale, preserve the memo but mark market context stale and request a source-refresh arrival.

### Execution

Load the current intake payload and audited research cache. Use TypeScript helpers from `@gbg/limitlessrp` for unknown-field collection, red-flag generation, and memo rendering. Use Rust normalization helpers for payable-metal unit conversions when numeric quantity and purity fields are available. Use Python registry helpers to validate source registry references. Write or update `packages/limitlessrp/docs/research/iridium-due-diligence-memo.md` only if postconditions pass.

### Invariants

- Unknowns remain explicit; do not silently assume missing transaction facts.
- Do not recommend buy/sell/hold or personalized trade action.
- Do not write private counterparty data into committed repo artifacts.
- Every market-context claim in the memo must trace to an accepted research-cache fact or be marked unknown.
