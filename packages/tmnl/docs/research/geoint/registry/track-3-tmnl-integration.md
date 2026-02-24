# Track 3 — TMNL Ecosystem Integration Design (GEOINT)

## Objective
Design a TMNL-native integration path for GEOINT that aligns with the existing **`GeointHarnessService`** and **`sdk.geoint`** surfaces, while reducing state fragmentation across `geoint`, `harness`, `stx`, `genifer`, and map primitives.

---

## Scope inspected
- `src/lib/geoint/harness/*`
- `src/lib/geoint/stx/*`
- `src/lib/geoint/components/*` (map/shell/dashboard bridges)
- `src/lib/geoint/positioning/*`
- `src/lib/geoint/atoms/*`
- `src/lib/geoint/kori/*`
- `src/lib/genifer/harness/*`, `src/lib/genifer/code-mode/*`
- `src/lib/harness/*` (tool runtime integration)
- `src/lib/primitives/map/*` and terminal map consumer

External pattern references (Context7):
- DeckGL React + Mapbox integration (`/visgl/deck.gl`)
- Mapbox GL JS lifecycle + source update patterns (`/mapbox/mapbox-gl-js`)

---

## Component boundaries (current)

| Boundary | Owns | Current contract | Integration note |
|---|---|---|---|
| Harness runtime | Tool registration + dispatch | `PiAiToolRuntimeWithBuiltins` builds built-ins + Genifer + GEOINT tools | Single composition root for LLM tool calls |
| GEOINT harness service | Spawn/search/select/summary/viewport ops | `GeointHarnessService` + `createGeointTools` | Canonical service for `geoint_*` tools and `sdk.geoint` backing |
| Genifer code-mode SDK | In-sandbox programmable API | `sdk.geoint.spawn/search/summary/select/focus/clear/viewport` | Throws when `geointService` not injected |
| Entity lifecycle | Per-entity state machine + store | `stx/entity-stx.ts`, `entity-ops.ts` | Canonical runtime entity lifecycle exists, but UI paths are split |
| Kori bridge layer | Search->entity hydration + live streams | `GeointKoriBridge`, `entity-atoms` | Parallel entity state path vs STX path |
| Dashboard panel state | Panel-scoped UI atoms | `Atom.family(panelId)` via `families.ts` + `GeointPanelProvider` | Correct panel isolation; not tied to harness viewport/entity atoms |
| GEOINT map UI | DeckGL/Mapbox + per-instance atoms | `GeointMap.tsx` local atom families + positioning hooks | Separate state island from harness and panel atoms |
| Positioning subsystem | Projection + deck layer configs | `positioningRegistry`, `positioningOps`, `SceneGraphBridge` | Strong feature set, separate registry/runtime |
| Shared map primitive | Generic map substrate | `BaseMap` + `mapRegistry = overlayRegistry` | Good reusable shell, but GEOINT map does not currently compose through it |

---

## Runtime flow (as implemented)

### A) Direct harness tools (`geoint_spawn`, `geoint_search`, `geoint_select`, `geoint_summary`)
1. Tool call enters `PiAiToolRuntimeWithBuiltins`.
2. Runtime dispatches by tool name from map.
3. GEOINT tool bridge decodes params and calls `GeointHarnessService`.
4. `GeointHarnessService` mutates STX-backed entity state + viewport atoms.

### B) Genifer code-mode (`sdk.geoint.*`)
1. `genifer_code` executes via `executeCodeMode(...)`.
2. Sandbox builds SDK with optional `geointService` injection.
3. `sdk.geoint.*` delegates to `GeointHarnessService` methods.
4. Returns summaries/viewport payloads to code-mode caller.

### C) Dashboard/UI runtime path
1. `GeointDashboardPanel` creates panel identity and panel-scoped atoms.
2. `GeointShell` wraps with `GeointRegistryProvider` + `KoriBridgeProvider`.
3. `GeointMap` uses local instance atoms + positioning runtime for rendering.
4. UI state and harness state are only partially connected.

---

## Key integration gaps

1. **Multiple registries / state islands**
   - Harness registry (`geointHarnessRegistry`), STX registry, Kori registry, panel atom families, positioning registry, overlay/map registry.
   - Result: no single authoritative read model for map + timeline + detail + harness.

2. **Service/UI contract split**
   - `GeointHarnessService` is canonical for tools, but dashboard map/panel flow is not directly subscribed to it.

3. **Duplicate query semantics**
   - Filtering/summarization logic duplicated in GEOINT tool bridge and code-mode SDK wrappers.

4. **Optional injection failure mode**
   - `sdk.geoint` becomes runtime-failing when `geointService` injection is absent.

5. **Abort/cancellation gap in tool runtime**
   - Runtime currently passes `undefined` signal in execution bridge path.

---

## Context7 pattern alignment (DeckGL + Mapbox)

### DeckGL patterns to keep
- Controlled `viewState` + `onViewStateChange` callback constraints.
- `useCallback` for pick/hover handlers to reduce rerender churn.
- Explicit support for synchronized main/minimap view state where needed.

### Mapbox GL JS patterns to enforce
- Register sources/layers only after `load`/`style.load`.
- Use `map.getSource(id).setData(...)` for live data updates (avoid source/layer recreation loops).
- Pair `map.on(...)` with cleanup via `map.off(...)` during teardown.

### Fit to TMNL
Current `GeointMap`/`BaseMap` already implement good container measurement and render gating; lifecycle/event/source discipline should be standardized in a shared map substrate contract.

---

## Phased implementation plan (aligned to `GeointHarnessService` + `sdk.geoint`)

## Phase 0 — Contract hardening (no behavior changes)
**Goal:** lock canonical interface before wiring.
- Keep `GeointHarnessService` as canonical command surface.
- Extract shared filter/search/summary helpers used by both:
  - `geoint/harness/bridge.ts`
  - `genifer/code-mode/sandbox.ts`.
- Add explicit capability flag for `sdk.geoint` availability (instead of late throw-only behavior).

**Gate:**
- Existing GEOINT harness tests pass.
- New parity tests prove `geoint_*` tools and `sdk.geoint.*` return equivalent summaries for same input.

## Phase 1 — GEOINT Integration Adapter (read model bridge)
**Goal:** connect harness canonical state to UI panel/runtime surfaces.
- Introduce `GeointIntegrationAdapterService`:
  - projection from harness entity summaries + viewport into panel/map consumable atoms.
  - optional reverse channel for UI viewport changes -> `setViewport` (debounced).
- Do **not** replace panel atoms; provide projection feeds first.

**Gate:**
- Single panel can be driven entirely from harness state projection.
- Focus/select from `sdk.geoint` visibly updates dashboard map center and selected entity state.

## Phase 2 — Entity state convergence (STX first, Kori as projection)
**Goal:** stop maintaining independent runtime truths.
- Keep STX entity store as canonical lifecycle store.
- Rework Kori bridge/atoms to become projection/cache layer from STX (or attach at spawn pipeline boundary).
- Replace direct `SearchHydrationBridge` spawn path with harness-backed spawn batch where practical.

**Gate:**
- No duplicate spawn/destroy behavior across STX and Kori paths.
- `clear`, `select`, `focus`, `pin` semantics consistent between tools and UI.

## Phase 3 — Shared map substrate adoption
**Goal:** unify map lifecycle and registry semantics.
- Extract a shared DeckGL+Mapbox shell (can evolve `BaseMap`) with:
  - explicit lifecycle hooks (`onMapReady`, `onStyleLoaded`),
  - source update hooks (`setData` strategy),
  - interaction registration/cleanup contract.
- Recompose `GeointMap` on substrate while retaining GEOINT-specific layer builders.

**Gate:**
- `GeointMap` and terminal/editor map surfaces share lifecycle semantics and sizing behavior.
- No regressions in track/positioned entity rendering.

## Phase 4 — Multi-view transaction model (Track 3 target)
**Goal:** synchronize map, timeline, and detail from one intent transaction.
- Add lightweight intent transaction service:
  - commands from tools/UI routed through one execution path.
- Timeline and detail projections consume same canonical entity+viewport/time state.
- Preserve existing `sdk.geoint` API shape; route internals through transaction service.

**Gate:**
- `sdk.geoint.focus/select/clear` consistently updates map + timeline + detail in one transaction.
- Deterministic replay tests for command sequences.

## Phase 5 — Observability + reliability hardening
**Goal:** make integration debuggable and safe at scale.
- Add `Effect.withSpan` around adapter + transaction paths.
- Add abort wiring from harness runtime through tool execution into long operations.
- Add conformance test suite:
  - tool parity,
  - UI projection parity,
  - lifecycle cleanup (subscriptions/event handlers).

**Gate:**
- Span traces cover end-to-end command path.
- Cancellation test proves interrupted runs do not leak active tracking/session resources.

---

## Recommended near-term file targets
- `src/lib/geoint/harness/bridge.ts` (extract shared summarization/filter logic)
- `src/lib/genifer/code-mode/sandbox.ts` (reuse shared logic + capability signaling)
- `src/lib/geoint/components/GeointMap.tsx` + `src/lib/primitives/map/*` (substrate convergence)
- `src/lib/geoint/components/SearchHydrationBridge.tsx` (route through harness adapter)
- new: `src/lib/geoint/integration/GeointIntegrationAdapterService.ts`

---

## Evidence (path:line)
- Harness composition + GEOINT tool registration: `src/lib/harness/PiAiToolRuntimeBuiltins.ts:245-260,283-290,342,349-356,410`
- GEOINT service API + atom state: `src/lib/geoint/harness/GeointHarnessService.ts:124-145,220-437`
- GEOINT tool definitions: `src/lib/geoint/harness/tools.ts:67,104,141,186`
- GEOINT bridge operations: `src/lib/geoint/harness/bridge.ts:64-258`
- `sdk.geoint` API surface: `src/lib/genifer/code-mode/schemas.ts:174-201`
- `sdk.geoint` implementation + optional service guard: `src/lib/genifer/code-mode/sandbox.ts:168-178,303-416`
- Code-mode bridge injection of geoint service: `src/lib/genifer/harness/bridge.ts:295-301`
- STX entity canonical store and ops: `src/lib/geoint/stx/entity-stx.ts:274-370`, `src/lib/geoint/stx/entity-ops.ts:43-214`
- Panel-scoped atom families: `src/lib/geoint/atoms/families.ts:223-335,401-418`
- Back-compat global atom aliases (default panel): `src/lib/geoint/atoms/index.ts:71,109,138,145,199`
- Dashboard panel context wiring: `src/lib/geoint/components/GeointDashboardPanel.tsx:270-275,384,481-492`
- Shell providers (Kori registry + bridge): `src/lib/geoint/components/GeointShell.tsx:330-349`
- GeointMap local atom families + positioning sync: `src/lib/geoint/components/GeointMap.tsx:150-157,304,405-416,619-640,683-685`
- Positioning registry + operation atoms: `src/lib/geoint/positioning/hooks.tsx:43,89,413-432,439-445,838-867`
- SceneGraph layer build service: `src/lib/geoint/positioning/SceneGraphBridge.ts:89-100,473-558`
- BaseMap shared substrate + shared registry doctrine: `src/lib/primitives/map/BaseMap.tsx:199-230,258-263,379-400`; `src/lib/primitives/map/registries.ts:10-12,42,89-91,314-321`
- Terminal map consuming BaseMap registry path: `src/lib/terminal/v3/components/ToolCallView/tools/MapToolView.tsx:39-41,244,253-254,346`
- GEOINT/SDK integration tests: `src/lib/geoint/harness/__tests__/tools.test.ts:36-169`; `src/lib/geoint/harness/__tests__/code-mode-geoint-sdk.test.ts:20-84`; `src/lib/geoint/harness/__tests__/GeointHarnessService.test.ts:59-118`

---

## Context7 references used
- DeckGL interactivity + controlled view state patterns: `/visgl/deck.gl` (developer guide: interactivity/views/base-map integration)
- Mapbox lifecycle/events/style and `setData` update model: `/mapbox/mapbox-gl-js`
