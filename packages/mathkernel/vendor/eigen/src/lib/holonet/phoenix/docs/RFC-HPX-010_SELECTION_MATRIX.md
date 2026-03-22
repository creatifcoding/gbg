# RFC-HPX-010: Architecture Selection Matrix + Phased Recommendation

```text
RFC:           RFC-HPX-010
Status:        DRAFT
Track:         Variant S (Synthesis)
Created:       2026-02-10
Depends On:    RFC-HPX-003..009
```

## Intent

Synthesize all variant RFC findings into a scored recommendation and phased AVA execution plan.

## Inputs

- RFC-HPX-003 (Transport SDK Family)
- RFC-HPX-004 (AVA Vertical SDK)
- RFC-HPX-005 (Protocol-first Codegen)
- RFC-HPX-006 (Dual-plane)
- RFC-HPX-007 (Offline/resilient)
- RFC-HPX-008 (Pluggable bridge)
- RFC-HPX-009 (Edge gateway)

## Scoring Dimensions

1. Correctness / protocol safety
2. Runtime performance and throughput headroom
3. Operational complexity
4. Migration risk and rollback quality
5. Reuse potential across non-AVA Elixir apps
6. Tooling burden and team maintainability

## Non-negotiable Filters

- atom-backed React-consumed state
- bounded high-volume ingress strategy
- replay ack gating invariant
- explicit reconnect + manual override
- observability baseline compliance

## Draft Output Shape

- per-variant scorecards
- recommendation for Phase 1 / Phase 2 / Phase 3
- kill criteria and fallback path per phase
- decision log with assumptions and unknowns

## Provisional Weighted Matrix (Initial)

Weights (v0):

- correctness / protocol safety: **25**
- performance headroom: **20**
- migration risk / rollback quality: **20**
- operational complexity: **15**
- reuse potential: **10**
- tooling burden: **10**

> Note: final numeric scores require evidence completion in RFC-003..009.

## Provisional Recommendation (v0)

### Phase 1 (Execute First)

- **Primary path**: Variant A (Transport SDK Family) + Variant B (AVA Vertical SDK)
- **Why**: balances immediate delivery and boundary clarity while preserving long-term reuse.
- **Must include**: replay-ack gate, atom-backed UI projections, bounded ingress policy.

### Phase 2 (Conditional Expansion)

- **Introduce selectively**: Variant D (Dual-plane) for heavy AVA payload flows.
- **Optional hardening**: Variant C (Protocol-first codegen) where contract churn/drift becomes operationally expensive.

### Phase 3 (Advanced / Optional)

- Variant G (Edge gateway) for proven hot-path pressure.
- Variant E (offline/resilient sync) for offline-critical operators.
- Variant F (pluggable bridge) only after at least two adapters provide measurable value.

## Kill Criteria and Fallback (v0)

### K1 — Correctness breach

If no-live-before-ack invariant fails in conformance tests, pause rollout.

Fallback: revert to existing stable transport path while preserving telemetry.

### K2 — Operational instability

If reconnect/replay error rates exceed agreed threshold during soak, stop phase advancement.

Fallback: disable advanced variant toggles and continue with A+B baseline.

### K3 — Complexity overrun

If variant introduces unresolved checklist gaps (C/D/E/G/H/J) by phase gate, reject variant from next phase.

Fallback: keep baseline architecture, log deferred variant with remediation prerequisites.

## Evidence Register (Required for Final Scoring)

For each variant (003..009), final scoring MUST cite:

- normative doc evidence (Phoenix/Effect references),
- repo-grounded evidence (existing module paths and migration targets),
- conformance evidence (tests/checks for replay/overflow/observability).

Until evidence rows are filled, recommendation remains provisional.

## Phase Advancement Gates

A phase is eligible only if:

1. no-live-before-ack conformance passes,
2. high-volume overflow policy tests pass,
3. observability map is implemented and measurable,
4. rollback route is rehearsed and documented.

## Conformance Mapping (Checklist IDs)

- A Canonical references: **covered (portfolio-level; per-variant evidence still required)**
- B Boundary/topology: **covered**
- C React state provisions: **covered (as non-negotiable filter)**
- D High-volume handling: **covered (as non-negotiable filter + gate)**
- E Replay/session correctness: **covered (as non-negotiable filter + gate)**
- F Reconnect/auth: **covered (required per variant)**
- G Observability: **covered (as phase gate)**
- H Migration/rollout: **covered**
- I Variant governance: **covered**
- J Evidence quality: **in progress (evidence register pending fill)**

## Evidence Completion Requirement

Before final ratification:

1. each variant RFC must include conformance mapping and citations,
2. `RFC_VALIDATION_MATRIX.md` risk status must be reduced from critical/high to acceptable,
3. weighted scores must be evidence-backed, not assumption-only.
