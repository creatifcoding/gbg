# GEOINT Agent Track B — Standards-Aligned Query Pipeline (Source/Layer Separation)

## Intent
Separate GEOINT into two clean planes:
- **Query/source plane** for STAC + OGC API Features + native sources.
- **Render plane** for deck.gl layers generated from normalized envelopes.

## Why this track
Current TMNL already has a useful search+spawn path, but source semantics and rendering are still tightly coupled. Track B hardens interoperability, provenance, and tasking reliability while preserving existing map rendering code.

## Architecture
1. **Canonical `GeoEntityEnvelope` schema**
   - Effect Schema envelope for all ingested entities:
   - `source`, `collection`, `itemId`, geometry, temporal fields, confidence, provenance links.
2. **Query Pipeline service**
   - Fan-out requests by source capability.
   - Normalize + merge + stream envelopes.
   - Emit reasoning/task signals (e.g., anomaly candidates).
3. **Adapter layer for standards**
   - STAC-style search (`bbox`, `datetime`, `collections`, `intersects`, paging/filter).
   - OGC API Features collection/items/filter adapters.
4. **Layer Projection Registry**
   - Pure projection: `GeoEntityEnvelope[]` → existing `tracks/features/heatmap/searchResults` layer factories.

## Runtime flow
1. Tool/code-mode request enters `GeointHarnessService`.
2. Query Pipeline expands intent into source requests (STAC/OGC/native).
3. Pipeline normalizes payloads into envelopes, preserving provenance.
4. Projection registry emits deck.gl layer descriptors from envelopes.
5. Map renders; interaction events reference canonical envelope IDs.

## Risks
- Initial adapter/schema overhead.
- Potential version drift between source APIs and envelope model.

## Incremental migration
- **B0:** Add envelope schemas only (no behavior change).
- **B1:** Wrap existing search outputs into envelopes.
- **B2:** Introduce projection registry while keeping current factories.
- **B3:** Route `geoint_*` tools and `sdk.geoint.*` through pipeline.
- **B4:** Add standards adapters gradually (STAC first, then OGC Features).

## Code anchors
- `src/lib/geoint/services/SearchService.ts`
- `src/lib/geoint/harness/tools.ts`
- `src/lib/geoint/kori/search-result-mapper.ts`
- `src/lib/geoint/schemas/search.ts`

## Research inputs used (DeepWiki / Exa / Context7)
- STAC query semantics and filtering/pagination patterns (DeepWiki + Exa):
  - https://deepwiki.com/search/what-query-parameters-and-pagi_81f21b27-d8ea-4b83-8a83-9d7b2c7bce7c
  - https://github.com/stac-api-extensions/filter
  - https://github.com/radiantearth/stac-api-spec/blob/release/v1.0.0/stac-spec/item-spec/item-spec.md
- OGC API Features core/filter guidance (Exa):
  - https://docs.ogc.org/is/17-069r3/17-069r3.html
  - https://docs.ogc.org/is/19-079r2/19-079r2.html
- Mapbox source/layer lifecycle update patterns (DeepWiki + Context7):
  - https://deepwiki.com/search/what-runtime-patterns-are-reco_078727cc-5c77-4c74-b486-f2682e931d02
  - https://github.com/mapbox/mapbox-gl-js/blob/main/debug/dynamic-filter.html
