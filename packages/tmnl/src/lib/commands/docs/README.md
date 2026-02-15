# Commands Docs — `nu-cmdk` Refactor (Document-Led)

**Status:** Planning / docs-first  
**Date:** 2026-02-13  
**Scope:** `src/lib/commands/integrate/nu-cmdk.tsx` modernization into reusable shell/band architecture.

---

## Why this folder exists

`nu-cmdk.tsx` is currently a monolithic demo-style palette. This docs set defines the migration path to a production-grade, reusable command palette that:

- actually uses `cmdk` primitives as first-class architecture,
- supports heterogeneous result rows via Effect Schema,
- composes as a shell + bands + slots pattern,
- integrates with existing `commands` / `minibuffer` / `overlays` seams,
- avoids UI churn while improving internal structure.

---

## Document Map

## Research

- [`research/cmdk-effect-research.md`](./research/cmdk-effect-research.md)
  - Current-state audit
  - External research findings (cmdk + Effect Schema)
  - Constraints from internal cycle-seam contracts
  - Architecture option comparison

- [`research/nu-cmdk-questionnaire-results.md`](./research/nu-cmdk-questionnaire-results.md)
  - User-aligned architecture gate decisions
  - Full search capability requirements
  - Concise aligned-model synthesis

- [`research/nu-cmdk-design-log.md`](./research/nu-cmdk-design-log.md)
  - Proposal → objection → counter-proposal audit trail
  - Open ambiguities list for next iterations

- [`research/effect-http-layer-router-internal-notes.md`](./research/effect-http-layer-router-internal-notes.md)
  - Submodule-backed research notes from Effect `HttpLayerRouter` and `internal/httpRouter`
  - API/middleware design primitives extracted for NuCmdk parity design

## Architecture / Spec

- [`arch/nu-cmdk-shell-band-spec.md`](./arch/nu-cmdk-shell-band-spec.md)
  - Shell decomposition
  - Band responsibilities
  - Compound API surface
  - Adapter seam boundaries

- [`arch/nu-cmdk-result-schema-spec.md`](./arch/nu-cmdk-result-schema-spec.md)
  - Effect Schema model for heterogeneous result rows
  - Normalization + ranking pipeline
  - Slot rendering contracts

- [`arch/nu-cmdk-cmdk-baseline.md`](./arch/nu-cmdk-cmdk-baseline.md)
  - cmdk as baseline, not strict lock
  - Extension policy for TMNL shell/ranking/schema layers
  - Interaction invariants we still keep

- [`arch/nu-cmdk-delta-from-cmdk.md`](./arch/nu-cmdk-delta-from-cmdk.md)
  - Explicit keep-vs-extend matrix from upstream cmdk
  - Product-specific deltas for TMNL search/ranking/provider federation

- [`arch/nu-cmdk-provider-contract-proposals.md`](./arch/nu-cmdk-provider-contract-proposals.md)
  - Provider artifact shape variants + recommendation
  - Execution resolver and renderer-token contract proposals

- [`arch/nu-cmdk-provider-adapter-layer-router-decision.md`](./arch/nu-cmdk-provider-adapter-layer-router-decision.md)
  - Design decision + rationale for `HttpLayerRouter`-parity provider/adapter router + middleware
  - N+1 dispatch efficiency model (parse-once, bounded scheduling, composable middleware)

- [`arch/nu-cmdk-query-middleware-spec.md`](./arch/nu-cmdk-query-middleware-spec.md)
  - Canonical middleware specification (scope, ordering, lifecycle, failure semantics)
  - Execution parity rules for global + adapter-local middleware in router dispatch

- [`arch/nu-cmdk-provider-onboarding-checklist.md`](./arch/nu-cmdk-provider-onboarding-checklist.md)
  - Design efficacy preamble (provider abstraction first principles)
  - Deterministic checklist for typed-emits adapters and broker-safe onboarding

- [`arch/nu-cmdk-search-broker-service-spec.md`](./arch/nu-cmdk-search-broker-service-spec.md)
  - Dedicated broker service architecture
  - RPC/HTTP/FS/vector/DB lane choreography + cache/failure policies

- [`arch/nu-cmdk-registry-object-shapes.md`](./arch/nu-cmdk-registry-object-shapes.md)
  - Exact manifest/chunk/row/registry object contracts
  - Incremental ranking + categorization on row updates

- [`arch/nu-cmdk-decision-lock.md`](./arch/nu-cmdk-decision-lock.md)
  - Locked architecture decisions from alignment session
  - Non-negotiable invariants and follow-up lock dependencies

- [`arch/nu-cmdk-renderer-token-namespace-lock.md`](./arch/nu-cmdk-renderer-token-namespace-lock.md)
  - Locked renderer token format and resolution rules

- [`arch/nu-cmdk-resolver-allowlist-matrix.md`](./arch/nu-cmdk-resolver-allowlist-matrix.md)
  - Scope-by-resolver execution policy and capability gates

- [`arch/nu-cmdk-sqlite-cache-migration-policy.md`](./arch/nu-cmdk-sqlite-cache-migration-policy.md)
  - SQLite L2 schema, migration/versioning, and WAL/checkpoint policy

- [`arch/nu-cmdk-redteam-simulation-matrix.md`](./arch/nu-cmdk-redteam-simulation-matrix.md)
  - Adversarial simulation matrix (attack vectors, pass/fail containment, hardening targets)

- [`arch/nu-cmdk-search-resolution-metrics-spec.md`](./arch/nu-cmdk-search-resolution-metrics-spec.md)
  - Time-to-resolution primary metrics, objective score, and SLO framing

- [`arch/nu-cmdk-hillclimb-optimization-spec.md`](./arch/nu-cmdk-hillclimb-optimization-spec.md)
  - Constrained hillclimb loop for safe performance tuning

- [`arch/nu-cmdk-query-session-actor-effect-spec.md`](./arch/nu-cmdk-query-session-actor-effect-spec.md)
  - Effect-native per-query actor definition (mailbox loop + scoped lifecycle + atom state)

- [`arch/ascii/`](./arch/ascii)
  - Section-split ASCII deep dives (11 docs)
  - Runtime topology, variant C protocol, registries, update loops, ranking, categories,
    lane states, failure isolation, resolver safety, cache behavior, query planner
  - Includes decision traceability map: [`arch/ascii/traceability-index.md`](./arch/ascii/traceability-index.md)

## Implementation

- [`impl/nu-cmdk-phased-plan.md`](./impl/nu-cmdk-phased-plan.md)
  - Phased migration plan (no-code to cutover)
  - Validation gates
  - Risk controls + rollback plan

- [`impl/spike/nu-cmdk-spike-testing-runbook.md`](./impl/spike/nu-cmdk-spike-testing-runbook.md)
  - Spike execution protocol for TTR optimization and hillclimb acceptance/rejection logging

- [`impl/spike/logs/README.md`](./impl/spike/logs/README.md)
  - Append-only run index for spike logs

- Runtime slice modules (implementation spike backing):
  - `src/lib/commands/nu-cmdk/slices/`
  - Includes QuerySession actor slice, policy/renderer/cache slices, and metrics scoring

---

## Rules for this effort

1. **Document-led first** (no architecture drift-by-coding).
2. **No UI churn** during seam extraction.
3. **Use cmdk primitives directly** for palette semantics.
4. **Use Effect Schema for domain/result models** (no raw type-only payload contracts).
5. **Respect interactive cycle seams** documented in:
   - `docs/adapters/cycle-seams.md`
   - `docs/systems/interactive-surface.md`
   - `docs/contracts/{commands,minibuffer,hotkeys,overlays}.md`
