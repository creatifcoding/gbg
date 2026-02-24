# RFC: TMNL GEOINT Registry Implementation (Hybrid B→A→C)

- **RFC ID**: GEOINT-RFC-IMPLEMENTATION-001
- **Status**: Draft (implementation-ready)
- **Date**: 2026-02-24
- **Owner**: TMNL GEOINT architecture
- **Decision Type**: Architecture + migration plan
- **Supersedes**: N/A
- **Related Research**: Tracks 1–7 and `geoint-registry-deck.json`

---

## 1) Context

TMNL already has substantial GEOINT capability, but delivery risk is concentrated in integration seams, not core primitives:

1. **State authority drift**: multiple runtime truth islands exist across harness/STX/Kori/panel/map paths.
2. **Interop boundary drift**: source vocabulary mismatch, mixed contract systems (TypeBox vs Effect Schema), non-canonical pagination behavior.
3. **Operational trust gap**: provenance hashes are not fully hardened in current conversion path.
4. **Roadmap pressure**: source universe is broad enough for production value, but must be admitted by tempo/tier and corroboration policy.

The research tracks converge on a staged rollout that avoids rewrite risk while enforcing conformance gates.

---

## 2) Decision

## 2.1 Normative decision

TMNL SHALL implement GEOINT registry evolution via **Hybrid B→A→C**:

1. **B (Interop backbone first)**
   - Canonical `registry.v1` contracts
   - CQL2-normalized filter pipeline
   - STAC/OGC/native adapters
   - Opaque continuation tokens
   - Append-only provenance with real digests

2. **A (Control plane second)**
   - Intent/mode compiler + layer graph diffing
   - Shadow mode first, then cutover

3. **C (Governance third)**
   - Capability registry + policy guard
   - Audit mode first, selective enforcement after latency and determinism gates

## 2.2 Why this decision

- B delivers immediate interoperability and migration safety.
- A can be introduced without destabilizing existing layer factories.
- C is intentionally deferred to avoid policy-latency regressions before runtime path convergence.

## 2.3 Rejected alternatives

- **A-first**: higher orchestration elegance, but delayed standards hardening and higher integration risk.
- **C-first**: governance without canonical execution path risks false enforcement and operator friction.
- **Big-bang rewrite**: explicitly rejected; violates migration safety goals.

---

## 3) Target Architecture (explicit)

```text
[Intent Ingress]
  geoint_* tools + sdk.geoint.* + UI intents
          |
          v
[Intent / Mode Compiler]  (A, shadow -> active)
  -> CompiledModePlan + LayerGraph diff
          |
          v
[Registry Query Pipeline]  (B)
  - Filter normalizer (CQL2 JSON IR)
  - STAC adapter
  - OGC Features adapter
  - Native adapters
          |
          v
[Canonical Envelope Plane]
  RegistryEntityEnvelopeV1 + PagingStateV1 + ProvenanceHopV1
          |
          +--> Projection registry -> existing deck.gl layer factories
          +--> Multi-view VMs (map / timeline / detail)
          |
          v
[Capability + Policy Guard] (C)
  audit-first -> selective enforcement
```

## 3.1 Runtime authority rule (non-negotiable)

`GeointHarnessService + STX` are the only write-authoritative execution path for GEOINT command intent (`focus`, `select`, `clear`, `track`, search mutation side effects). UI surfaces are projections.

## 3.2 Non-negotiable architecture constraints

1. Effect Schema at registry boundaries.
2. Opaque continuation token as external paging contract.
3. Canonical source vocabulary at ECS boundary (no alias drift in runtime state).
4. Real request/response digest provenance (no placeholders).
5. Single transaction path for `focus/select/clear/track`.

---

## 4) Contract Definitions Summary

## 4.1 Canonical query/result contracts (registry.v1)

| Contract | Purpose | Required properties (summary) |
|---|---|---|
| `RegistrySearchQueryV1` | Canonical search ingress | `version`, `queryId`, `collections`, optional `bbox/intersects/datetime/filter`, `page` |
| `RegistryEntityEnvelopeV1` | Canonical item envelope | `envelopeId`, `entityType`, canonical `source`, `collection`, `nativeId`, `properties`, `provenance[]` |
| `PagingStateV1` | Canonical paging state | `mode`, `returned`, optional `matched`, `hasNext`, optional `continuationToken/nextHref` |
| `RegistryPageV1` | Canonical page payload | `queryId`, `items[]`, `paging`, `sourceCounts`, `errors`, `executionTimeMs` |
| `ProvenanceHopV1` | Chainable provenance event | `provider`, `endpoint`, `requestedAt`, `receivedAt`, `requestHash`, `responseHash`, optional `pageState` |

## 4.2 Registry-level capability/binding contracts

| Contract | Purpose |
|---|---|
| `SourceRegistryEntry` | Declares source identity, aliases, capability profile, and operational metadata |
| `LayerRegistryEntry` | Declares layer capability requirements and rendering metadata |
| `SourceLayerBinding` | Deterministic source↔layer binding with trust gate and precedence |
| `RegistrySnapshotV1` | Atomically serializable state of sources/layers/bindings |

## 4.3 Contract invariants

1. Canonical source identity in runtime state; adapter aliases only at boundary decode/encode.
2. Filter normalization target is CQL2 JSON internal IR.
3. `bbox + datetime + filter` compose as logical AND.
4. STAC providers must explicitly declare Item/Catalog/Collection support and static/dynamic catalog mode.
5. External pagination remains opaque regardless of provider-specific paging semantics.
6. Provenance chain is append-only and hash-addressable.

---

## 5) Phased Rollout Plan (0–90 days)

## 5.1 Days 0–30: Foundation (B-core)

### Scope

- Ship `registry.v1` contracts and compatibility decoding tests.
- Add token codec (signed, query-hash bound, TTL/expiry).
- Add filter normalizer (CQL2 JSON IR subset, typed failures).
- Unify source vocabulary mapping (GEOINT ↔ ECS boundary).
- Replace placeholder provenance hashing with SHA-256 request/response digesting.
- Add explicit `sdk.geoint` capability signaling.

### Required acceptance gates

- **F1** schema compatibility and backward decode pass.
- **F2** token tamper and expiry tests pass.
- **F3** parity across `geoint_*` and `sdk.geoint.*` for search/summary/select.
- **F4** provenance digest presence in all envelopes.

## 5.2 Days 31–60: Integration (B→A shadow)

### Scope

- Introduce `GeointIntegrationAdapterService` projection path.
- Route dashboard map/panel from harness/STX projection (no local truth divergence).
- Implement STAC adapter first, then OGC adapter.
- Wrap existing search outputs in `RegistryPageV1`.
- Run compiler/layer diff executor in shadow mode with parity metrics.

### Required acceptance gates

- **I1** full panel projection parity from harness state.
- **I2** compiler shadow parity within accepted diff threshold.
- **I3** no duplicate lifecycle behavior across STX/Kori.
- **I4** cancellation and cleanup show no leaks.

## 5.3 Days 61–90: Cutover (A active, C audit-first)

### Scope

- Cut `geoint_*` and `sdk.geoint.*` to canonical pipeline + compiler execution.
- Enable multi-view transaction model for map/timeline/detail.
- Enable capability/policy guard in audit mode, then selective enforcement.
- Move saved search/history from in-memory refs to durable persistence.
- Add observability spans and reliability metrics.

### Required acceptance gates

- **C1** deterministic replay for command sequences (`focus/select/clear`).
- **C2** policy audit completeness and latency budget compliance.
- **C3** persistence continuity passes across restart.
- **C4** no bypass path remains around canonical execution pipeline.

---

## 6) Test Gates and Conformance Matrix

| Gate | Conformance checks | Minimum evidence |
|---|---|---|
| F1 | `registry.v1` decode/encode + N/N-1 compatibility | Contract test suite green |
| F2 | Token integrity, tamper detection, TTL expiry, query-hash mismatch | Security/unit tests green |
| F3 | Tool vs SDK parity (`search`, `summary`, `select`) | Golden parity tests |
| F4 | Every envelope includes request/response digest in provenance | Envelope schema + runtime assertions |
| I1 | Harness/STX projection drives panel/map behavior equivalently | Integration tests + panel replay |
| I2 | Compiler shadow output diff under threshold | Diff report artifact |
| I3 | STX/Kori lifecycle dedupe (`spawn/destroy/select`) | No-dup invariant tests |
| I4 | Abort/cancel and cleanup (subscriptions/resources) | Leak/teardown tests |
| C1 | Deterministic command replay | Replay harness fixtures |
| C2 | Policy audit traces + latency SLO | Trace and benchmark report |
| C3 | Saved/history persistence continuity | Restart continuity tests |
| C4 | No non-canonical execution path | Route audit + static checks |

---

## 7) Risk Register

| ID | Risk | Impact | Likelihood | Mitigation | Owner |
|---|---|---:|---:|---|---|
| R1 | STAC/OGC/provider conformance drift | High | Medium | Adapter capability declarations + conformance tests | Registry adapters |
| R2 | State divergence during dual-path rollout | High | Medium | Projection-only rule + shadow parity gates | GEOINT integration |
| R3 | Token replay/corruption | High | Low-Med | Signed codec + query-hash binding + TTL | Registry core |
| R4 | Policy enforcement latency regression | Medium-High | Medium | Audit-first, selective enforcement, latency gates | Governance plane |
| R5 | Source legal/SLA mismatch for tempo use | High | Medium | Tempo-tier admission policy + corroboration requirements | Source governance |
| R6 | Persistence migration regressions | High | Medium | Dual read/write window + restart continuity gates | Persistence |

---

## 8) Rollback Strategy

## 8.1 Feature-flagged rollback controls

- `GEOINT_SOURCE_REGISTRY_V2`
- `GEOINT_MAP_SOURCE_LAYERS_V2`
- `GEOINT_COMPILER_SHADOW_ONLY`
- `GEOINT_POLICY_AUDIT_ONLY`

## 8.2 Rollback triggers

Immediate rollback to prior phase if any of:

1. Gate failures in current phase.
2. P95 interaction latency exceeds approved budget.
3. Tool/SDK parity drift detected in production canary.
4. Projection inconsistency between harness/STX and panel/map.
5. Token integrity failure or replay vulnerability.

## 8.3 Rollback procedure

1. Flip phase-specific feature flags to previous stable mode.
2. Re-enable legacy source config/paths for one release window.
3. Keep canonical contract artifacts for forward re-entry.
4. Open incident + evidence package before retry.

---

## 9) Concrete TMNL File-Level Change Map

> The map is implementation-oriented and grouped by rollout phase.

## 9.1 Phase 0 (Days 0–30)

### Add

- `src/lib/geoint/registry/schemas.ts` — `registry.v1` contract definitions.
- `src/lib/geoint/registry/sourceRegistry.ts` — source descriptors, aliases, capability metadata.
- `src/lib/geoint/registry/token-codec.ts` — opaque continuation token encode/decode/signature/TTL.
- `src/lib/geoint/registry/filter-normalizer.ts` — CQL2 normalization service.

### Edit

- `src/lib/geoint/harness/tools.ts` — source-aware params and boundary migration away from TypeBox-only contracts.
- `src/lib/geoint/harness/bridge.ts` — shared source/filter/summary logic for tool+SDK parity.
- `src/lib/genifer/code-mode/schemas.ts` — optional `sources` parity in `sdk.geoint.search`.
- `src/lib/genifer/code-mode/sandbox.ts` — reuse shared resolver + explicit capability signaling.
- `src/lib/geoint/components/SearchPanel.tsx` — remove hardcoded source config usage.
- `src/lib/geoint/components/SearchPanelCompound.tsx` — same as above.
- `src/lib/geoint/entities/index.ts` — replace provenance placeholder hash path.
- `src/lib/ecs/schemas/core.ts` — canonical source mapping boundary.

## 9.2 Phase 1 (Days 31–60)

### Add

- `src/lib/geoint/integration/GeointIntegrationAdapterService.ts` — projection bridge (harness/STX to panel/map).
- `src/lib/geoint/registry/adapters/stac.ts` — STAC adapter.
- `src/lib/geoint/registry/adapters/ogc.ts` — OGC Features adapter.
- `src/lib/geoint/registry/adapters/native.ts` — native adapter.

### Edit

- `src/lib/geoint/server/SearchRpcServer.ts` — wrap output to `RegistryPageV1`; begin adapter convergence.
- `src/lib/geoint/components/GeointMap.tsx` — consume projection path and registry-driven source/layer visibility.
- `src/lib/geoint/layers/searchResults.ts` — source metadata-driven layer styling/visibility.
- `src/lib/geoint/atoms/index.ts` and/or `src/lib/geoint/atoms/families.ts` — projection/state hooks for source-layer control.
- `src/lib/geoint/components/SearchHydrationBridge.tsx` — route hydration/spawn through harness adapter path.
- `src/lib/primitives/map/BaseMap.tsx` + `src/lib/primitives/map/registries.ts` — map substrate lifecycle alignment.

## 9.3 Phase 2 (Days 61–90)

### Edit

- `src/lib/harness/PiAiToolRuntimeBuiltins.ts` — canonical runtime routing cutover.
- `src/lib/genifer/harness/bridge.ts` — SDK bridge path cutover.
- `src/lib/genifer/code-mode/executor.ts` — ensure execution path convergence.
- `src/lib/geoint/harness/tools.ts` and `src/lib/genifer/code-mode/sandbox.ts` — remove bypass path and finalize parity.
- `src/lib/geoint/components/MapSelectionOverlay.tsx` — panel-scoped selection alignment.
- `src/lib/geoint/components/GeointDashboardPanel.tsx` — panel-scoped transaction wiring.
- `src/lib/geoint/components/GeointMap.tsx` — map/timeline/detail transaction convergence.
- `src/lib/geoint/server/SearchRpcServer.ts` — persistence migration completion.
- `src/lib/geoint/persistence/postgis/schemas.ts` — durable saved/history alignment target.

---

## 10) Migration Gates and Exit Criteria

A phase is complete only if all gates for that phase are green and rollback criteria are not tripped.

- **Exit 0–30**: F1–F4 passed.
- **Exit 31–60**: I1–I4 passed and shadow diff accepted.
- **Exit 61–90**: C1–C4 passed; no bypass route; policy remains audit-first until selective enforcement gate is approved.

---

## 11) Explicit Deferrals (post-day-90)

1. Broad hard policy enforcement for all actions.
2. Advanced multi-view analytics UX beyond baseline map/timeline/detail.
3. Additional lower-priority source integrations outside tempo-tier admissions.

---

## 12) Evidence Index (path:lines)

### Decision and roadmap
- `docs/research/geoint/registry/track-7-synthesis-memo.md:106,115,117,128,138,148,158,168,211,213`
- `docs/research/geoint/registry/geoint-registry-deck.json:73,121,132`

### Interop contracts and migration
- `docs/research/geoint/registry/track-2-interoperability.md:79-80,113-117,125-129,172,194,209,218,368,376,391,416,418,425,435,440,444,447,469,485`

### Integration constraints and adapter path
- `docs/research/geoint/registry/track-3-tmnl-integration.md:65,70,100,102,114,116,125,135,147,158,173,178`

### Source registry + phased file touch evidence
- `docs/research/geoint/registry/track-6-integration-playbook.md:63,85,94,99,106,111,123,131,136,148,158,170,178,183,194,199,204,211,218,238,263`

### Source admission and tempo policy
- `docs/research/geoint/registry/track-1-data-sources.md:17,21,54-59,78-83,100`

### Capability/trust contract details
- `docs/research/geoint/registry/track-5-registry-contract.md:45,90,211,246,264,275,383,394,417,436,455`

### TMNL code anchors (current seams)
- `src/lib/geoint/components/SearchPanelCompound.tsx:146`
- `src/lib/geoint/entities/index.ts:160,174`
- `src/lib/geoint/server/SearchRpcServer.ts:124-126,804,813,819,822,832`
- `src/lib/geoint/schemas/search.ts:288,1083,1287`
- `src/lib/geoint/harness/tools.ts:38-49,67,81-86,118-123,155-167`
- `src/lib/genifer/code-mode/sandbox.ts:169,175-178`
- `src/lib/geoint/atoms/index.ts:66-71,96-97,467`

---

## 13) Final Statement

TMNL will implement GEOINT registry modernization by **Hybrid B→A→C**, with interop contracts and provenance hardening first, control-plane compiler shadow next, and policy governance audit-first then selective enforcement. This sequence minimizes rewrite risk while maximizing standards conformance, deterministic behavior, and operational safety.
