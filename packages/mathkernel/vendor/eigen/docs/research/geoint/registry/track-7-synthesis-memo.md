# Track 7 — GEOINT Registry Synthesis Memo (Architecture + 90-Day Roadmap)

Date: 2026-02-24  
Authoring role: Synthesis coordinator (Negotiate phase)

---

## 1) Executive recommendation

Adopt a **single staged architecture** that combines the six tracks without forcing a rewrite:

- **Backbone (now): Track 2 + Track B**  
  Standards-aligned query pipeline, canonical envelopes, CQL2 normalization, opaque continuation tokens, provenance hashing.
- **Control plane (next): Track A**  
  Declarative Layer Graph + Mode Compiler driving existing layer factories in shadow mode before cutover.
- **Governance plane (later): Track C**  
  Multi-view reasoning spine + capability registry + policy guards, introduced audit-first then enforce for sensitive actions.
- **Integration rule from Track 3:**  
  `GeointHarnessService + STX` remain runtime authority; panel/map/timeline/detail become projections, not independent truths.
- **Source policy from Track 1:**  
  Tempo-tiered source admission with cross-source corroboration for high-tempo decisions.

This yields the best balance of **source breadth, interoperability, and implementation safety**.

---

## 2) Inputs reconciled

### Registry tracks
- `docs/research/geoint/registry/track-1-data-sources.md`
- `docs/research/geoint/registry/track-2-interoperability.md`
- `docs/research/geoint/registry/track-3-tmnl-integration.md`

### Newly produced tracks 4–6 (represented as proposal set)
- `docs/research/geoint/proposal-a-layer-graph-mode-compiler.md`
- `docs/research/geoint/proposal-b-standards-query-pipeline.md`
- `docs/research/geoint/proposal-c-multiview-capability-policy.md`

### Decision companion
- `docs/research/geoint/proposal-comparison-matrix.md`

---

## 3) Synthesis by axis

## A. Source breadth (Track 1)
Use Track 1 scoring and tempo classes as **runtime admission policy**, not just research notes.

- **Primary ingest:** OpenSky / ADS-B enterprise tier, NEXRAD + NWS, USGS, select AIS stream.
- **Secondary corroboration:** GDACS, FIRMS, marine/commercial backfills.
- **Context/enrichment:** STAC catalogs (Copernicus, Sentinel Hub, Planetary Computer).

**Hard rule:** Tempo A/B actions require corroboration across source classes (e.g., flight + weather, disaster + imagery indicator).

## B. Interoperability (Track 2 + Track B)
Make `registry.v1` Effect Schema contracts the canonical boundary:

- `RegistrySearchQueryV1`
- `RegistryEntityEnvelopeV1`
- `RegistryPageV1`
- `PagingStateV1`
- append-only provenance hops with real request/response digests

Normalize filter expressions to **CQL2 JSON** internal IR regardless of STAC/OGC input format.
Expose pagination externally as a **single opaque continuation token**.

## C. Implementation constraints (Track 3 + A/C)
Current system has state islands and partial duplication; reconcile with explicit authority:

- Canonical runtime authority: harness service + STX entity state.
- Projection-only consumers: Kori cache, panel atoms, map/timeline/detail VMs.
- Preserve existing map rendering factories; introduce compiler/executor as orchestration layer.
- Defer hard policy enforcement until interaction latency and transaction consistency are proven.

---

## 4) Recommended target architecture (single integrated model)

```text
[Intent Ingress]
  geoint_* tools + sdk.geoint.* + UI intents
          |
          v
[Intent/Mode Compiler]  (Track A)
  -> CompiledModePlan + LayerGraph diff
          |
          v
[Registry Query Pipeline]  (Track 2 / B)
  - CQL2 normalizer
  - STAC adapter
  - OGC Features adapter
  - Native source adapters
          |
          v
[Canonical Envelope Plane]
  RegistryEntityEnvelopeV1 + ProvenanceHopV1 + PagingStateV1
          |
          +--> [Projection Registry] -> existing deck.gl layer factories
          +--> [Multi-view VMs] map/timeline/detail
          |
          v
[Capability + Policy Guard]  (Track C)
  audit-first -> selective enforcement
```

### Non-negotiable contracts
1. Effect Schema first across registry boundaries.
2. Opaque token paging only at public API boundary.
3. Source vocabulary unification at ECS boundary (remove drift aliases).
4. Real provenance hashing (no placeholder digest values).
5. Single transaction path for `focus/select/clear/track` commands.

---

## 5) 90-day roadmap

## Days 0–30 (Foundation: interop spine + safety rails)

### Scope
- Ship `registry.v1` schema package and decode/encode tests.
- Implement continuation token codec (signed, query-hash bound, expiry).
- Add CQL2 normalization service (initial subset + typed failure path).
- Unify source vocabulary mapping (GEOINT ↔ ECS).
- Replace provenance placeholder hash with real SHA-256 request/response digests.
- Add capability signaling for `sdk.geoint` availability.

### Acceptance gates
- Gate F1: schema compatibility and backward decode pass.
- Gate F2: token tamper/expiry tests pass.
- Gate F3: tool parity (`geoint_*` vs `sdk.geoint.*`) for search/summary/select.
- Gate F4: provenance digest presence in all envelopes.

### Tradeoff
Lower visible UX gain in month 1, but major rework risk eliminated.

---

## Days 31–60 (Integration: adapter convergence + compiler shadow)

### Scope
- Introduce `GeointIntegrationAdapterService` projection path.
- Route dashboard map panel from harness/STX projection (no local truth divergence).
- Add STAC adapter first, OGC adapter second.
- Wrap existing search outputs into `RegistryPageV1`.
- Run Layer Graph compiler in **shadow mode** with output parity checks.

### Acceptance gates
- Gate I1: one-panel full projection from harness state (focus/select reflected on map).
- Gate I2: shadow compiler parity within agreed diff threshold.
- Gate I3: no duplicate spawn/destroy behavior across STX and Kori paths.
- Gate I4: cancellation/cleanup tests show no leaked subscriptions/resources.

### Tradeoff
Temporary dual-path overhead (current render + shadow compiler) for deterministic cutover confidence.

---

## Days 61–90 (Cutover: unified execution + governed multi-view)

### Scope
- Cut `geoint_*` and `sdk.geoint.*` to pipeline + compiler execution path.
- Enable map/timeline/detail transaction model from shared intent events.
- Activate capability registry and policy guard in **audit mode**, then enforce for sensitive operations only.
- Move saved search/history off in-memory refs into durable persistence path.
- Add spans and reliability metrics (ack latency, stream lag, replay depth, churn).

### Acceptance gates
- Gate C1: deterministic replay for command sequences (`focus/select/clear`).
- Gate C2: policy audit traces complete; selective enforcement does not violate latency budget.
- Gate C3: persistence continuity pass across restart.
- Gate C4: no bypass path remains around canonical execution pipeline.

### Tradeoff
Governance enforcement delayed until stability is demonstrated; safer than early hard-blocking.

---

## 6) Prioritization and explicit deferrals

## Must-do in this cycle
- Canonical registry contracts + adapters + provenance + token paging.
- State authority convergence and projection bridge.
- Compiler shadow then cutover.

## Defer to post-day-90
- Broad policy hard enforcement for all actions.
- Advanced multi-view analytics UX beyond map/timeline/detail baseline.
- Additional source integrations outside highest-value admission tiers.

---

## 7) Top risks and controls

1. **Spec drift (STAC/OGC/provider quirks)**  
   Control: adapter capability declarations + conformance contract tests.

2. **State divergence (map/panel/STX/Kori)**  
   Control: enforce projection-only pattern; STX/harness single-write authority.

3. **Token replay/corruption**  
   Control: signed token codec + query hash binding + TTL.

4. **Policy-induced latency**  
   Control: audit-only phase, selective enforcement, measured SLO gates.

5. **Source/legal mismatch with mission tempo**  
   Control: runtime admission tiers + corroboration requirements + source metadata retention.

---

## 8) Final decision statement

**Proceed with a staged hybrid: B-core + A-control + C-governance, anchored by Track 3 integration constraints and Track 1 source admission policy.**

This is the highest-confidence architecture to deliver interoperable GEOINT operations within 90 days while preserving TMNL’s existing rendering investments and reducing migration risk.
