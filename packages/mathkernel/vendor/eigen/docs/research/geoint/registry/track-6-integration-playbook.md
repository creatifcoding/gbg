# Track 6 — Practical Integration Playbook
## Expanded Source Registry → `GeointHarnessService` + `sdk.geoint` + map layers

Date: 2026-02-24  
Status: Implementation playbook (phased rollout + gates)

---

## 1) Objective

Wire an **expanded GEOINT source registry** into TMNL without rewrites, using additive seams:

1. `GeointHarnessService` stays canonical for runtime entity/viewport operations.
2. `sdk.geoint` remains API-stable but gains source-aware routing.
3. Map layers consume source registry metadata (visibility/color/capability) instead of duplicated local constants.

This playbook is intentionally migration-safe and test-gated.

---

## 2) Hard constraints

- **No large rewrites**: additive modules + narrow edits only.
- **Preserve existing contracts first**: tool names and `sdk.geoint` method names remain unchanged.
- **Atom-as-State discipline**: registry-backed atoms remain source of truth.
- **Rollout by feature flags** with parity tests before default-on.

---

## 3) Current seams to integrate (evidence anchors)

### Harness + tool bridge
- Canonical service contract + atoms: `src/lib/geoint/harness/GeointHarnessService.ts:69-121,142-143,223-227`
- Viewport/focus/select operations: `src/lib/geoint/harness/GeointHarnessService.ts:358-433`
- Tool contracts (TypeBox): `src/lib/geoint/harness/tools.ts:38-49,81-86,118-123,155-167`
- Tool execution bridge: `src/lib/geoint/harness/bridge.ts:64-262`

### `sdk.geoint`
- SDK surface: `src/lib/genifer/code-mode/schemas.ts:174-195`
- SDK implementation + guard: `src/lib/genifer/code-mode/sandbox.ts:171-178,304-416`
- Injection path: `src/lib/harness/PiAiToolRuntimeBuiltins.ts:245-260`, `src/lib/genifer/harness/bridge.ts:299`, `src/lib/genifer/code-mode/executor.ts:239`

### Source definitions and duplication points
- Canonical source enum today: `src/lib/geoint/schemas/search.ts:56-67`
- Query source field: `src/lib/geoint/schemas/search.ts:272`
- Filter atoms by source: `src/lib/geoint/atoms/index.ts:286,360-361`
- Search UI local source config duplication:
  - `src/lib/geoint/components/SearchPanel.tsx:65-75`
  - `src/lib/geoint/components/SearchPanelCompound.tsx:146-156`
- Workspace default sources: `src/lib/geoint/workspace/schemas.ts:136-137`

### Map layer wiring
- `GeointMap` local families + layer composition: `src/lib/geoint/components/GeointMap.tsx:150-170,464-513`
- Selection overlay still reads default/global atoms: `src/lib/geoint/components/MapSelectionOverlay.tsx:17,120,261`
- Shared map registry is overlay registry alias: `src/lib/primitives/map/registries.ts:42`, `src/lib/overlays/atoms/index.ts:37`
- Search-result layers exist but are not wired into map path: `src/lib/geoint/layers/searchResults.ts:282-335`

---

## 4) Target integration shape (additive)

### 4.1 New canonical module (add)
Create `src/lib/geoint/registry/sourceRegistry.ts` with:

- `SourceRegistryEntry` (Effect Schema) fields:
  - `id` (registry key)
  - `intelSource` (current runtime source when mapped)
  - `label`, `domain`, `tier`, `defaultEnabled`
  - capabilities: `searchable`, `spawnable`, `mapRenderable`, `sdkExposed`
  - `colorKey` (for UI/layers), `aliases`
- Exported helpers:
  - `listSources()`
  - `resolveSourceId(idOrAlias)`
  - `toIntelSourceSet(expandedIds)`
  - `isSourceEnabledFor(surface)`

### 4.2 Non-breaking compatibility rule
- Keep current `IntelSource` values unchanged for now (`track`, `osm`, `opensky`, etc.).
- Expanded registry entries can map many external providers to one current `IntelSource` until Track 2 contract expansion lands.

---

## 5) Phased rollout plan with test gates

## Phase 0 — Registry foundation (no behavior change)

### Changes
- Add `sourceRegistry.ts` (new module only).
- Add thin adapters in existing surfaces:
  - Search panels read source descriptors from registry instead of hardcoded `SOURCE_CONFIG`.
  - Keep fallback to current constants behind flag.

### File touch set
- **Add**: `src/lib/geoint/registry/sourceRegistry.ts`
- **Edit (small)**:
  - `src/lib/geoint/components/SearchPanel.tsx`
  - `src/lib/geoint/components/SearchPanelCompound.tsx`

### Gate P0
- `bunx vitest run src/lib/geoint/harness/__tests__/tools.test.ts src/lib/geoint/harness/__tests__/GeointHarnessService.test.ts`
- Add new: `src/lib/geoint/registry/__tests__/sourceRegistry.test.ts`
  - decode/encode passes
  - alias resolution deterministic
  - default-enabled set matches expected baseline

### Rollback
- Flip `GEOINT_SOURCE_REGISTRY_V2=false` and continue using existing local `SOURCE_CONFIG`.

---

## Phase 1 — Harness + tool source awareness

### Changes
- Extend `geoint_search` params with optional `sources?: string[]` (expanded IDs).
- In `createGeointTools`, resolve `sources` through registry → filter summary list by mapped `IntelSource`.
- Keep existing `mode/entityType/bounds/limit` behavior unchanged.

### File touch set
- `src/lib/geoint/harness/tools.ts`
- `src/lib/geoint/harness/bridge.ts`
- `src/lib/geoint/registry/sourceRegistry.ts` (helper usage)

### Gate P1
- Existing tests still pass:
  - `bunx vitest run src/lib/geoint/harness/__tests__/tools.test.ts`
- Add new: `src/lib/geoint/harness/__tests__/tools-source-registry.test.ts`
  - `geoint_search` with expanded IDs returns same entities as mapped `IntelSource`
  - unknown source IDs fail with explicit error
  - mixed valid+invalid behavior is deterministic (documented)

### Rollback
- Keep `sources` optional; if resolver unavailable, ignore and revert to existing search behavior.

---

## Phase 2 — `sdk.geoint` parity with tool surface

### Changes
- Extend `sdk.geoint.search(...)` params to accept optional `sources?: string[]`.
- Reuse exact filtering helper from harness bridge (single logic path; no drift).
- Preserve current guard behavior when `geointService` is absent.

### File touch set
- `src/lib/genifer/code-mode/schemas.ts`
- `src/lib/genifer/code-mode/sandbox.ts`
- shared helper extraction in `src/lib/geoint/harness/bridge.ts` (or new helper module)

### Gate P2
- `bunx vitest run src/lib/geoint/harness/__tests__/code-mode-geoint-sdk.test.ts`
- Add new parity test:
  - same data + same params produce equivalent counts/entityIds for `geoint_search` and `sdk.geoint.search`

### Rollback
- Hide new `sources` arg behind feature flag in SDK typing + runtime branch.

---

## Phase 3 — Map layer source-registry projection

### Changes
- Add source-registry-driven layer selector for map rendering.
- Wire search-result layers into `GeointMap` (additive) using existing `createSearchResultLayers`.
- Keep track/positioning layers unchanged; search-result layers append by visibility toggle.

### File touch set
- `src/lib/geoint/components/GeointMap.tsx`
- `src/lib/geoint/layers/searchResults.ts` (only if metadata hooks needed)
- `src/lib/geoint/atoms/index.ts` / families for per-panel source visibility if required

### Gate P3
- Add tests:
  - `src/lib/geoint/layers/__tests__/searchResults-source-visibility.test.ts`
  - `src/lib/geoint/components/__tests__/GeointMap-source-layers.test.tsx`
- Assertions:
  - disabling a source removes its render layer contributions
  - source color/lookups come from registry descriptor, not hardcoded map-local table

### Rollback
- Feature-flag search-result layer injection (`GEOINT_MAP_SOURCE_LAYERS_V2=false`) to revert to current track-only map layering.

---

## Phase 4 — Panel-scoped selection/viewport alignment

### Changes
- Migrate `MapSelectionOverlay` from default/global atoms to panel-scoped atoms passed via props/context.
- Ensure source color lookup uses source registry metadata path.

### File touch set
- `src/lib/geoint/components/MapSelectionOverlay.tsx`
- `src/lib/geoint/components/GeointMap.tsx`
- `src/lib/geoint/components/GeointDashboardPanel.tsx`

### Gate P4
- Add tests:
  - panel A selection does not bleed into panel B
  - overlay color is consistent with registry source descriptor

### Rollback
- Keep compatibility prop path for legacy default-panel atoms while panel-scoped path bakes.

---

## Phase 5 — Default-on + observability + cleanup

### Changes
- Default feature flags to on after parity metrics pass.
- Add `Effect.withSpan` around new registry resolve path + map projection path.
- Remove duplicated `SOURCE_CONFIG` constants once usage is zero.

### Gate P5
- Regression run:
  - `bunx vitest run src/lib/geoint/harness/__tests__/GeointHarnessService.test.ts src/lib/geoint/harness/__tests__/tools.test.ts src/lib/geoint/harness/__tests__/code-mode-geoint-sdk.test.ts src/lib/geoint/atoms/__tests__/mapOperations.test.ts`
- New conformance checks:
  - no duplicate source config constants (`rg "const SOURCE_CONFIG" src/lib/geoint/components` returns only registry adapter usage)
  - no parity drift between tool + SDK search behavior

### Rollback
- Keep one release window where old constants and old filter path can be re-enabled by flag.

---

## 6) Test matrix (what must be true before each promotion)

| Gate | Tool path | SDK path | Map path | Panel isolation | Result |
|---|---|---|---|---|---|
| P0 | unchanged | unchanged | unchanged | unchanged | registry compiles + decodes |
| P1 | source-aware | unchanged | unchanged | unchanged | tool filtering stable |
| P2 | source-aware | source-aware | unchanged | unchanged | tool/sdk parity |
| P3 | source-aware | source-aware | source-aware layers | unchanged | map layer toggles stable |
| P4 | source-aware | source-aware | source-aware layers | scoped selection/viewport | no cross-panel bleed |
| P5 | default-on | default-on | default-on | default-on | duplicate configs removed |

---

## 7) Commit slicing plan (small, coherent slices)

1. **Slice A**: add `sourceRegistry.ts` + tests (no callsite behavior change).  
2. **Slice B**: `geoint_search` optional `sources` + bridge resolver + tests.  
3. **Slice C**: `sdk.geoint.search` `sources` parity + tests.  
4. **Slice D**: map source-layer injection + tests.  
5. **Slice E**: panel-scoped overlay migration + tests.  
6. **Slice F**: default-on flags + duplicate config removal + conformance pass.

---

## 8) Risks and mitigations

1. **Source vocabulary drift** across UI/harness/SDK.  
   - Mitigation: single registry resolver + parity tests at P1/P2.

2. **Map regression from extra layers**.  
   - Mitigation: feature flag + per-source visibility tests before default-on.

3. **Panel context bleed** in selection overlay.  
   - Mitigation: P4 panel-isolation tests.

4. **Silent behavior drift between tool and SDK**.  
   - Mitigation: shared filtering helper + explicit parity suite.

---

## 9) Definition of done (Track 6)

Track 6 is complete only when:

- Expanded source registry is canonical for source metadata.
- `geoint_search` and `sdk.geoint.search` both support expanded source IDs with parity.
- Map rendering respects registry-driven source visibility/color semantics.
- Selection overlay and viewport wiring are panel-scoped (no global bleed).
- Legacy duplicated source config constants are removed or reduced to compatibility shim only.
