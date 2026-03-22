# GEOINT Agent Track C — Multi-View Reasoning Spine + Capability Registry + Policy Guards

## Intent
Evolve GEOINT from map-only execution to synchronized reasoning across:
1) **Map view**, 2) **Timeline view**, 3) **Detail/dossier view**,
while enforcing capability and policy checks for safe conversational tasking.

## Why this track
Mapbox/deck.gl can already handle high-volume rendering and multi-layer composition. Track C adds a governance and reasoning spine to support analyst-grade workflows (cross-time correlation, explainable layers, controlled access).

## Architecture
1. **Reasoning Orchestrator (Effect service)**
   - Converts conversational commands into typed intents: `InspectEntity`, `CompareIntervals`, `FocusAOI`, `TaskRoute`.
2. **Per-view projection models**
   - Map VM, Timeline VM, Detail VM; each atom-backed but keyed by shared entity/session IDs.
3. **Layer Capability Registry**
   - Registry metadata per layer: supported views, interactions, cost budget, classification, degrade strategy.
4. **Policy Guard Engine**
   - Gate checks before plan execution: role/classification/rate/compute constraints.
   - Actions: allow, redact, deny, require-confirmation.
5. **Bridge adapters**
   - Current deck.gl layer factories remain rendering back-end.

## Runtime flow
1. Conversational command enters harness/code-mode.
2. Orchestrator resolves intent + context (AOI, time window, user policy).
3. Registry returns eligible layer/view capabilities.
4. Guard evaluates and possibly rewrites plan.
5. Approved plan updates map/timeline/detail state in one transaction.
6. User interaction in any view emits new intent events; loop continues.

## Risks
- Highest complexity of the three tracks.
- Guard latency can impact interaction feel if checks are heavy.
- Requires strict schema/version discipline to avoid registry drift.

## Incremental migration
- **C0:** Introduce registry in audit-only mode (no blocking).
- **C1:** Add read-only timeline projection from current entity stream.
- **C2:** Add detail view with provenance + confidence surfaces.
- **C3:** Enable enforceable guard checks for sensitive ops.
- **C4:** Remove bypass paths and centralize intent execution.

## Code anchors
- `src/lib/geoint/components/GeointMap.tsx`
- `src/lib/geoint/stx/entity-stx.ts`
- `src/lib/geoint/harness/GeointHarnessService.ts`
- `src/lib/genifer/harness/bridge.ts`

## Research inputs used (DeepWiki / Exa / Context7)
- deck.gl multi-view/controller + composition guidance (DeepWiki/Exa/Context7):
  - https://deepwiki.com/search/what-architecture-patterns-doe_fbb25712-5583-46a8-9595-4c694642c993
  - https://deck.gl/docs/developer-guide/custom-layers/composite-layers
  - https://github.com/visgl/deck.gl/blob/master/docs/api-reference/core/composite-layer.md
- Mapbox runtime lifecycle and style/load discipline:
  - https://docs.mapbox.com/mapbox-gl-js/guides/styles/work-with-layers/
  - https://deepwiki.com/search/what-runtime-patterns-are-reco_078727cc-5c77-4c74-b486-f2682e931d02
