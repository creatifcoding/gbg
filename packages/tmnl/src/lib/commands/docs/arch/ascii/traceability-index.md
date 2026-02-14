# NuCmdk ASCII Suite — Decision Traceability Index

**Status:** Active  
**Date:** 2026-02-13  
**Purpose:** Map implementation/research acceptance checks back to locked architecture decisions.

---

## Decision Key (from `../nu-cmdk-decision-lock.md`)

| Decision ID | Locked Decision | Summary |
|---|---|---|
| D01 | cmdk role | cmdk is substrate baseline, not strict clone target |
| D02 | Provider envelope model | Variant C (manifest + stream hybrid) |
| D03 | Schema architecture | Pluggable variant registry + per-variant versioning |
| D04 | Renderer safety | Valid renderer token (or fallback) required |
| D05 | Row assembly discipline | Generic decode+assemble pipeline; invalid rows dropped + telemetry |
| D06 | Execution model | Data resolvers, typed and gated |
| D07 | Orchestration boundary | Dedicated NuCmdkSearchBroker |
| D08 | State + cache | Atoms + service cache; tiered cache with SQLite warm layer |
| D09 | Transport model | Mixed lanes, Effect RPC-first direction, HTTP partial timeout |
| D10 | Ranking/categorization behavior | Incremental recompute on row updates |
| D11 | Fallback behavior | Semantic fallback chain retained |
| D12 | Renderer token namespace | `<provider>/<variant>/<view>@v<major>` token format locked |
| D13 | Resolver allow-list policy | Scope-by-resolver capability matrix locked |
| D14 | SQLite cache migration policy | L2 schema/migrations/WAL policy locked |
| D15 | QuerySession actor model | Per-query mailbox actor + scoped lifecycle + atom-backed state |
| D16 | TTR-first performance objective | Time-to-resolution primary metric with penalty constraints |
| D17 | Constrained hillclimb tuning | Safe parameter optimization loop with guardrails |
| D18 | Provider/adapter LayerRouter parity | `HttpLayerRouter`-style service + global/local middleware + bounded dispatch |

---

## ASCII Document Traceability Matrix

| ASCII Doc | Primary Decision Coverage | Acceptance Check IDs |
|---|---|---|
| `01-runtime-topology.md` | D01, D07, D08, D09, D10, D15 | CSA-001..040 |
| `02-variant-c-manifest-stream.md` | D02, D03, D05, D09 | CSA-001..040 |
| `03-registry-relationships.md` | D03, D04, D05, D06, D12 | CSA-001..040 |
| `04-row-update-pipeline.md` | D05, D07, D10, D15, D16 | CSA-001..040 |
| `05-ranking-engine.md` | D01, D10, D11, D16, D17 | CSA-001..040 |
| `06-categorization-model.md` | D01, D10, D12, D16 | CSA-001..040 |
| `07-lane-state-machine.md` | D07, D09, D11, D13, D15 | CSA-001..040 |
| `08-failure-isolation.md` | D05, D07, D09, D11, D13, D15 | CSA-001..040 |
| `09-resolver-safety.md` | D04, D06, D09, D12, D13 | CSA-001..040 |
| `10-cache-behavior.md` | D08, D09, D10, D14, D16, D17 | CSA-001..040 |
| `11-query-mode-planner.md` | D01, D10, D11, D16, D17 | CSA-001..040 |

---

## Implementation Trace Rules

1. Any code change justified by a `CSA-*` check must reference at least one `Dxx` decision.
2. If a check passes but violates a mapped decision, it is considered a failed check.
3. New checks must extend this index before implementation starts.
4. Decision updates require:
   - updating `nu-cmdk-decision-lock.md`,
   - updating this traceability index,
   - appending `nu-cmdk-design-log.md`.

---

## Suggested Check Annotation Format

Use this annotation in implementation PR notes or task logs:

```text
CHECK: 04-row-update-pipeline.md::CSA-012
DECISIONS: D05,D10
EVIDENCE: ranked-index-delta snapshot + telemetry correlation IDs
RESULT: PASS
```

---

## Adversarial Simulation Coverage

Adversarial preflight matrix:

- `../nu-cmdk-redteam-simulation-matrix.md`

Mapping rule:

- each `RTM-*` scenario must cite `decisionCoverage` (`Dxx`) and produce executable evidence artifacts.
- scenarios introducing new invariants must be reflected here and in the decision lock.

## Gap Tracker (bounded)

- Per-provider resolver policy manifests derived from D13
- Cache compaction and prune tuning thresholds derived from D14
- Renderer major-version compatibility rollout policy derived from D12
- QuerySession runtime instrumentation wiring for required TTR event timeline (D16)
- Hillclimb harness automation from bootstrap logs to measured runs (D17)

These are bounded operational follow-ups layered on top of locked decisions.
