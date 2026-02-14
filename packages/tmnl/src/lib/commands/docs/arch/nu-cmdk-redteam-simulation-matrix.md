# NuCmdk Red-Team Simulation Matrix (Round 4)

**Status:** Adversarial review artifact (implementation preflight)  
**Date:** 2026-02-13  
**Scope:** D01–D14 lock set stress testing before scaffold implementation

---

## Purpose

This document defines a concrete red-team simulation matrix to break the NuCmdk architecture at the seam boundaries most likely to fail in production:

1. trust boundaries (provider -> shell, resolver -> executor),
2. mixed-transport stream behavior,
3. cache durability + migration lifecycle,
4. ranking/categorization stability under hostile update patterns,
5. fallback behavior that can mask contract rot.

This is not a generic test list. It is a failure-induction plan with explicit pass/fail containment criteria.

---

## Harness topology

```text
┌─────────────────────────────────────────────────────────┐
│ ScenarioRunner                                          │
│  - loads ScenarioSpec                                   │
│  - injects faults / load profile                        │
│  - evaluates Assertions                                 │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ NuCmdkSearchBroker test harness                         │
│  lanes: [rpc, http, fs, semantic, custom]              │
│  policy: ResolverPolicyBundle                           │
│  registry: Variant/Renderer registry                    │
│  cache: sqlite + memory fallback                        │
└──────┬─────────────────────┬─────────────────────┬──────┘
       │                     │                     │
       ▼                     ▼                     ▼
  TelemetrySink         AuditEventSink       SnapshotSink
  (metrics/spans)       (allow/deny)         (rank/category)
```

---

## Simulation contract (schema-first)

```ts
import { Schema } from "effect"

const Severity = Schema.Literal("low", "medium", "high", "critical")
const DecisionId = Schema.Literal(
  "D01","D02","D03","D04","D05","D06","D07",
  "D08","D09","D10","D11","D12","D13","D14"
)

const Assertion = Schema.Struct({
  key: Schema.NonEmptyString,
  expectation: Schema.NonEmptyString,
})

export const ScenarioSpec = Schema.Struct({
  id: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  severity: Severity,
  attackVector: Schema.NonEmptyString,
  preconditions: Schema.Array(Schema.NonEmptyString),
  injectionSteps: Schema.Array(Schema.NonEmptyString),
  assertions: Schema.Array(Assertion),
  decisionCoverage: Schema.Array(DecisionId),
})
```

---

## Global pass/fail policy

A scenario is **PASS** only if all are true:

1. No unhandled exception reaches UI boundary.
2. No scope escalation occurs (especially modal/editor scope).
3. No invalid resolver dispatch executes.
4. No cross-lane corruption of ranking/categorization state.
5. Required audit + telemetry events emitted.

A scenario is **FAIL** if any of:

- unknown resolver executes,
- global fallback ratio exceeds threshold without escalation,
- cache migration enters unknown state with cache still enabled,
- selection identity drifts to wrong row without explicit selection action.

---

## Red-team scenarios

## Trust boundary attacks

### RTM-001 — Renderer token collision flood
- **Vector:** malicious provider emits near-collision tokens (`commands-a/...`) to exploit loose matching.
- **Decisions:** D04, D12
- **Assertions:**
  - only exact token regex matches resolve,
  - no prefix/substring resolution allowed,
  - drop + diagnostic emitted for invalid tokens.
- **Hardening target:** strict token parser + interned token map.

### RTM-002 — Renderer major downgrade confusion
- **Vector:** provider emits `@v3` where only `v2` exists; attempts compatibility downgrade.
- **Decisions:** D12
- **Assertions:**
  - compatibility map policy is explicit and deterministic,
  - if not allowed, lane-level degraded state emitted (not silent fallback-only).
- **Hardening target:** per-token compatibility matrix + fallback budget.

### RTM-003 — Fallback masking storm
- **Vector:** 80% rows intentionally invalid to force global fallback renderer.
- **Decisions:** D04, D05, D11, D12
- **Assertions:**
  - fallback ratio metric crosses threshold -> escalates lane health state,
  - shell does not present false “healthy” lane.
- **Hardening target:** fallback SLO budget + escalation policy.

### RTM-004 — Manifest split-brain
- **Vector:** stream chunks reference variant/version not in latest manifest (delayed manifest race).
- **Decisions:** D02, D03, D05, D09
- **Assertions:**
  - orphan chunks are quarantined or dropped,
  - no row assembled against stale variant contract.
- **Hardening target:** manifest epoch pin per query session.

---

## Resolver escalation attacks

### RTM-005 — ProviderCustomResolver privilege creep
- **Vector:** custom resolver id mimics approved resolver naming.
- **Decisions:** D06, D13
- **Assertions:**
  - resolverId exact match required against signed policy bundle,
  - no wildcard by prefix.
- **Hardening target:** canonical resolver identity (`providerId:resolverId@vN`).

### RTM-006 — HTTP resolver SSRF attempt
- **Vector:** endpoint with allowed host but redirected to internal host.
- **Decisions:** D06, D09, D13
- **Assertions:**
  - policy validates final resolved host after redirects,
  - non-allowlisted hop denies dispatch.
- **Hardening target:** redirect-aware domain gate + egress policy.

### RTM-007 — RPC method namespace escalation
- **Vector:** method `system.admin.delete` when only read methods allowed in modal.
- **Decisions:** D06, D13
- **Assertions:**
  - scope-aware method allowlist enforced,
  - deny emits `rpc-method-denied` with actor context.
- **Hardening target:** per-scope RPC capability sets.

### RTM-008 — File resolver destructive action probe
- **Vector:** action `delete` injected where only `open|reveal|diff` allowed.
- **Decisions:** D06, D13
- **Assertions:**
  - schema decode fails unknown action,
  - no fallback coercion to nearest action.
- **Hardening target:** closed tagged union, no stringly dispatch.

### RTM-009 — Scope confusion (modal -> global)
- **Vector:** lane emits resolver spec tagged `global` while query session is `modal`.
- **Decisions:** D06, D07, D13
- **Assertions:**
  - broker-bound active scope wins over payload scope claim,
  - deny on mismatch.
- **Hardening target:** broker-owned immutable scope context.

---

## Stream/order integrity attacks

### RTM-010 — Out-of-order chunk reorder storm
- **Vector:** chunks for same row arrive out-of-order with stale sequence ids.
- **Decisions:** D05, D07, D09, D10
- **Assertions:**
  - monotonic sequence guard per row/lane,
  - stale sequence ignored,
  - rank state remains stable.
- **Hardening target:** QuerySession sequence window + dedupe map.

### RTM-011 — Duplicate row-id oscillation
- **Vector:** repeated upserts with alternating payloads to induce ranking thrash.
- **Decisions:** D05, D10
- **Assertions:**
  - rank reorder threshold prevents jitter,
  - selected row identity is preserved unless invalidated.
- **Hardening target:** hysteresis in ranking engine.

### RTM-012 — Lane starvation flood
- **Vector:** one lane emits at 100x rate; others sparse.
- **Decisions:** D07, D09, D10
- **Assertions:**
  - fair merge policy keeps minority lane visible,
  - no starvation in publish loop.
- **Hardening target:** weighted round-robin merge budget.

### RTM-013 — Semantic fallback poisoning
- **Vector:** lexical lane returns adversarial high-score junk when semantic lane stalls.
- **Decisions:** D10, D11
- **Assertions:**
  - fallback quality gate clamps lexical-only confidence,
  - lane provenance visible in rank metadata.
- **Hardening target:** provenance-weighted rank composition.

---

## Cache/migration resilience attacks

### RTM-014 — Manifest-hash mismatch poisoning
- **Vector:** stale entry reintroduced with mismatched manifest hash.
- **Decisions:** D08, D14
- **Assertions:**
  - stale row invalidated before ranking publish,
  - mismatch metric increments.
- **Hardening target:** read-time integrity check before decode.

### RTM-015 — Cache stampede on hot prefix
- **Vector:** 500 concurrent same-prefix misses.
- **Decisions:** D07, D08, D10, D14
- **Assertions:**
  - single-flight dedupe per cache_key,
  - bounded write amplification.
- **Hardening target:** in-flight request coalescing.

### RTM-016 — Migration crash mid-flight
- **Vector:** crash between migration steps.
- **Decisions:** D08, D14
- **Assertions:**
  - transactional rollback leaves prior valid schema,
  - cache disabled if migration status unknown,
  - search remains operational via memory cache.
- **Hardening target:** atomic migration ledger + startup guard.

### RTM-017 — WAL contention pressure
- **Vector:** long-lived reads + burst writes + forced checkpoint.
- **Decisions:** D08, D14
- **Assertions:**
  - no deadlock,
  - busy handling path degrades gracefully,
  - checkpoint retries with backoff.
- **Hardening target:** busy_timeout + adaptive checkpoint loop.

### RTM-018 — Expiry skew attack
- **Vector:** manipulated local clock causes stale cache resurrection.
- **Decisions:** D08, D14
- **Assertions:**
  - monotonic clock source preferred for TTL decisions,
  - impossible time regressions trigger cache bypass.
- **Hardening target:** time-source abstraction + skew detector.

---

## Observability and evidence requirements

Every scenario run must emit:

- `scenario.id`, `scenario.severity`
- `decisionCoverage[]`
- `allowDecision` and `denyReason` counts
- renderer resolution outcomes (`exact|compatible|fallback|drop`)
- lane health transitions
- cache state transitions (`sqlite-ready|sqlite-degraded|memory-only`)

Evidence artifacts:

1. structured scenario report JSON,
2. rank/categorization snapshot diff,
3. audit event tail,
4. failure trace span links.

---

## Robust abstraction upgrades (derived from adversarial review)

1. **QuerySession actor** (per query)
   - isolates sequencing, fairness, cancellation, lane health.
2. **PolicyBundle service**
   - signed, versioned resolver policies with strict resolver identity.
3. **RendererCompatibilityMap**
   - explicit major compatibility rules by token family.
4. **CacheGuard layer**
   - single-flight, integrity checks, adaptive WAL operations.
5. **QualityBudget controller**
   - fallback ratio thresholds + automatic escalation.

---

## Suggested execution order

1. RTM-005..009 (security gates first)
2. RTM-016..018 (cache safety second)
3. RTM-010..013 (stream/rank correctness)
4. RTM-001..004 (renderer and manifest integrity)
5. RTM-014..015 (cache poisoning + stampede)

This order maximizes early detection of catastrophic risk.

---

## Traceability pointer

- Decision lock: `./nu-cmdk-decision-lock.md`
- ASCII trace index: `./ascii/traceability-index.md`
- Design log append-only record: `../research/nu-cmdk-design-log.md`
