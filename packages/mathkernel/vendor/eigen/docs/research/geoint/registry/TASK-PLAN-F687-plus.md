# GEOINT Implementation Task Plan (#F687+)

Status: proposed execution plan aligned to `RFC-geoint-registry-implementation.md`

## Sequencing Model
- **Wave 1 (Days 0–30):** Interop foundation (B-core)
- **Wave 2 (Days 31–60):** Integration + shadow compiler (B→A)
- **Wave 3 (Days 61–90):** Cutover + governance audit (A→C)

---

## Wave 1 — Foundation

### #F687 — Registry v1 contracts (Effect Schema)
**Goal:** Add canonical contracts (`RegistrySearchQueryV1`, `RegistryEntityEnvelopeV1`, `RegistryPageV1`, `PagingStateV1`, `ProvenanceHopV1`).

**Files**
- `src/lib/geoint/registry/schemas.ts` (new)
- `src/lib/geoint/registry/index.ts` (new)

**Gate**
- F1: schema decode/encode + compatibility tests green.

---

### #F688 — Opaque continuation token codec
**Goal:** signed paging tokens with TTL and query-hash binding.

**Files**
- `src/lib/geoint/registry/token-codec.ts` (new)
- `src/lib/geoint/registry/__tests__/token-codec.test.ts` (new)

**Depends on:** #F687  
**Gate**
- F2: tamper, replay, expiry tests green.

---

### #F689 — CQL2 filter normalization service
**Goal:** normalize STAC/OGC/native filter inputs to internal CQL2 JSON IR.

**Files**
- `src/lib/geoint/registry/filter-normalizer.ts` (new)
- `src/lib/geoint/registry/__tests__/filter-normalizer.test.ts` (new)

**Depends on:** #F687  
**Gate**
- F1/F2 support; typed failure paths validated.

---

### #F690 — Source vocabulary unification + aliases
**Goal:** eliminate runtime source drift (`adsb_lol`/`adsb-lol`, `weather`/`openmeteo`, etc.).

**Files**
- `src/lib/geoint/registry/sourceRegistry.ts` (new)
- `src/lib/geoint/schemas/search.ts` (adapter boundary only)
- `src/lib/ecs/schemas/core.ts` (no runtime drift)

**Depends on:** #F687  
**Gate**
- Canonical source IDs only in runtime state.

---

### #F691 — Provenance digest hardening
**Goal:** replace placeholder provenance hash with real request/response SHA-256 digests.

**Files**
- `src/lib/geoint/entities/index.ts`
- `src/lib/geoint/server/SearchRpcServer.ts`
- `src/lib/geoint/registry/provenance.ts` (new)

**Depends on:** #F687  
**Gate**
- F4: all envelopes include valid provenance digests.

---

### #F692 — Tool/SDK parity (source-aware search path)
**Goal:** identical behavior between `geoint_*` tools and `sdk.geoint.*`.

**Files**
- `src/lib/geoint/harness/tools.ts`
- `src/lib/geoint/harness/bridge.ts`
- `src/lib/genifer/code-mode/schemas.ts`
- `src/lib/genifer/code-mode/sandbox.ts`

**Depends on:** #F687, #F690  
**Gate**
- F3: parity tests pass for search/summary/select.

---

## Wave 2 — Integration + Shadow

### #F693 — GeointIntegrationAdapterService (projection bridge)
**Goal:** project harness/STX authority into panel/map atoms (no state islands).

**Files**
- `src/lib/geoint/integration/GeointIntegrationAdapterService.ts` (new)
- `src/lib/geoint/components/GeointDashboardPanel.tsx`
- `src/lib/geoint/components/GeointShell.tsx`

**Depends on:** #F692  
**Gate**
- I1: panel behavior driven by harness/STX projection parity.

---

### #F694 — STAC adapter to RegistryPageV1
**Goal:** first standards adapter outputting canonical envelopes and paging state.

**Files**
- `src/lib/geoint/registry/adapters/stac.ts` (new)
- `src/lib/geoint/services/SearchService.ts`
- `src/lib/geoint/server/SearchRpcServer.ts`

**Depends on:** #F687, #F688, #F689  
**Gate**
- I2: adapter conformance + paging behavior stable.

---

### #F695b — OGC Features adapter + queryables
**Goal:** OGC API Features Core + filter/queryables interop through same canonical page contract.

**Files**
- `src/lib/geoint/registry/adapters/ogc-features.ts` (new)
- `src/lib/geoint/registry/queryables.ts` (new)

**Depends on:** #F694  
**Gate**
- I2: STAC + OGC both converge on same IR/output contracts.

---

### #F696 — Mode compiler shadow mode
**Goal:** run compiler in shadow, compare layer outputs to existing map path.

**Files**
- `src/lib/geoint/registry/mode-compiler.ts` (new)
- `src/lib/geoint/components/GeointMap.tsx`
- `src/lib/geoint/layers/index.ts`

**Depends on:** #F693, #F694  
**Gate**
- I2/I3: output parity and no duplicate lifecycle effects.

---

## Wave 3 — Cutover + Governance

### #F697 — Canonical pipeline cutover (tools + sdk)
**Goal:** all geoint command paths run through canonical registry pipeline.

**Files**
- `src/lib/geoint/harness/bridge.ts`
- `src/lib/genifer/harness/bridge.ts`
- `src/lib/harness/PiAiToolRuntimeBuiltins.ts`

**Depends on:** #F696  
**Gate**
- C1: deterministic replay for focus/select/clear/track sequences.

---

### #F698 — Multi-view transaction model (map/timeline/detail)
**Goal:** synchronize all view models from one intent transaction path.

**Files**
- `src/lib/geoint/registry/transaction-service.ts` (new)
- `src/lib/geoint/components/*` (view model projections)

**Depends on:** #F697  
**Gate**
- C1/C2: synchronized updates within latency budget.

---

### #F699 — Policy guard (audit-first)
**Goal:** capability registry + policy checks with audit mode first.

**Files**
- `src/lib/geoint/registry/capability-registry.ts` (new)
- `src/lib/geoint/registry/policy-guard.ts` (new)

**Depends on:** #F697  
**Gate**
- C2: policy audit traces complete; selective enforcement safe.

---

### #F700 — Persistence continuity
**Goal:** move saved/history state from in-memory refs to durable persistence path.

**Files**
- `src/lib/geoint/server/SearchRpcServer.ts`
- `src/lib/geoint/persistence/postgis/*`

**Depends on:** #F697  
**Gate**
- C3: restart continuity tests pass.

---

### #F701 — No-bypass conformance + cleanup
**Goal:** remove legacy bypass paths and duplicate source config constants.

**Files**
- `src/lib/geoint/components/SearchPanel.tsx`
- `src/lib/geoint/components/SearchPanelCompound.tsx`
- `src/lib/geoint/components/MapSelectionOverlay.tsx`
- `src/lib/geoint/atoms/index.ts`

**Depends on:** #F699, #F700  
**Gate**
- C4: static route audit confirms canonical path only.

---

## Fast Validation Command Set
```bash
bunx vitest run \
  src/lib/geoint/harness/__tests__/GeointHarnessService.test.ts \
  src/lib/geoint/harness/__tests__/tools.test.ts \
  src/lib/geoint/harness/__tests__/code-mode-geoint-sdk.test.ts \
  src/lib/geoint/atoms/__tests__/mapOperations.test.ts
```

## Recommended first PR batch
- #F687 + #F688 + #F689 + #F691 + #F692 (foundation + parity)
