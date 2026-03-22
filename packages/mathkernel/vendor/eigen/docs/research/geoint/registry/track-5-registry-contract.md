# Track 5 — Flexible GEOINT Layer+Source Registry Contract (Interoperability-First)

**Author:** Val (Design)
**Date:** 2026-02-24
**Status:** Proposed (gate-ready)

---

## 1) Scope and acceptance gates

This track defines a **generic, composable registry contract** for GEOINT in TMNL, with interoperability as the first-order concern:

- canonical source + layer registry contracts,
- standards-first capability model,
- deterministic composition rules,
- explicit trust/provenance scoring for operational gating.

### Gate checklist

1. **Evidence gate:** DeepWiki + Exa/web evidence included. ✅
2. **Schema gate:** Effect Schema-first contracts (versioned, tagged, migratable). ✅
3. **Capability gate:** source/layer capability model is explicit and testable. ✅
4. **Composition gate:** source-layer binding rules are deterministic and enforceable. ✅
5. **Trust gate:** provenance-aware scoring model with hard-fail conditions defined. ✅
6. **Migration gate:** rollout plan avoids UI churn and preserves boundary compatibility. ✅

---

## 2) Interoperability-first design principles

1. **External dialects first, internal IR second**
   - Accept STAC + OGC filter/paging/queryables idioms at boundaries.
   - Normalize internally to stable IR (CQL2 JSON + opaque continuation).

2. **Canonical IDs, adapter aliases**
   - Internal state uses canonical source IDs only.
   - Adapter-specific names (`adsb_lol`, `weather`) are decode/encode aliases, never runtime truth.

3. **Contract over implementation**
   - Layer/source negotiation is capability-driven, not hardcoded by provider.

4. **Provenance is required data, not metadata decoration**
   - Every entity envelope carries append-only provenance hops.

5. **Atom-as-state runtime discipline**
   - Registry state for React consumers should be Atom-first (`Atom.make`) to avoid Ref→Atom bridge drift.

## 2.1 STAC core alignment (about-page reinforcement)

From `https://stacspec.org/en/about/stac-spec/`, we harden contract semantics around five explicit STAC properties:

1. **Item/Catalog/Collection are first-class object types** (not inferred ad hoc).
2. **Dynamic vs static catalog mode is explicit** (search endpoint availability depends on this).
3. **STAC API search capability is declared per-source** (no assumptions).
4. **Asset + relationship link support is represented as capability metadata**.
5. **Extension maturity is represented in registry metadata** so unstable extensions are policy-gated.

These are now reflected in the implementation schema layer (`src/lib/geoint/registry/schemas.ts`) via STAC capability structures.

---

## 3) Evidence baseline

## 3.1 DeepWiki evidence

- **Effect Schema patterns** (tagged structs/classes, unions, transforms, branding, annotations):
  - https://deepwiki.com/search/what-are-the-canonical-pattern_9c528bb2-fb74-43c2-86e0-8f9f4e27f5bf
- **stac-fastapi filter/queryables/conformance behavior**:
  - https://deepwiki.com/search/how-does-stacfastapi-expose-st_29647834-febb-40e8-b58a-6a19286088fc

## 3.2 Exa/web evidence

- STAC Item Search v1.0 pagination + POST next-link hints (`method`, `headers`, `body`, `merge`):
  - https://raw.githubusercontent.com/radiantearth/stac-api-spec/release/v1.0.0/item-search/README.md
- STAC Filter extension conformance + queryables + filter params:
  - https://raw.githubusercontent.com/stac-api-extensions/filter/main/README.md
- OGC API Features Part 3 Filtering + CQL2 references:
  - https://docs.ogc.org/is/19-079r2/19-079r2.html
  - https://docs.ogc.org/is/21-065r2/21-065r2.html
- W3C PROV-DM core model (entity/activity/agent + trustworthiness rationale):
  - https://www.w3.org/TR/prov-dm/

## 3.3 TMNL local evidence (boundary gaps)

- GEOINT vs ECS source vocabulary drift:
  - `src/lib/geoint/schemas/search.ts:56`
  - `src/lib/ecs/schemas/core.ts:37`
- Manual source remap and placeholder provenance hash:
  - `src/lib/geoint/entities/index.ts:130`
  - `src/lib/geoint/entities/index.ts:174`
- Pagination fields exist but are not canonicalized at registry boundary:
  - `src/lib/geoint/schemas/search.ts:1083`
  - `src/lib/geoint/schemas/search.ts:1287`
- Query schema has `totalLimit`, server primarily executes per-source limit:
  - `src/lib/geoint/schemas/search.ts:288`
  - `src/lib/geoint/server/SearchRpcServer.ts:453`
- Harness boundary uses TypeBox while core contracts are Effect Schema:
  - `src/lib/geoint/harness/tools.ts:38`

---

## 4) Canonical registry contract (Effect Schema)

> Prime, this is the spine: one source registry, one layer registry, one binding registry, all versioned.

```ts
import { Schema } from "effect"

// ---------------------------------------------------------------------------
// Version + IDs
// ---------------------------------------------------------------------------

export const RegistryVersion = Schema.Literal("geoint.registry.v1")
export type RegistryVersion = typeof RegistryVersion.Type

export const SourceId = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9][a-z0-9-]{1,63}$/),
  Schema.brand("SourceId")
)
export type SourceId = typeof SourceId.Type

export const LayerId = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9][a-z0-9-]{1,63}$/),
  Schema.brand("LayerId")
)
export type LayerId = typeof LayerId.Type

// ---------------------------------------------------------------------------
// Canonical source namespace (ECS-aligned)
// ---------------------------------------------------------------------------

export const CanonicalIntelSource = Schema.Literal(
  "opensky",
  "adsb-lol",
  "flightradar24",
  "overpass",
  "osm",
  "nominatim",
  "planet",
  "sentinel",
  "maxar",
  "openmeteo",
  "noaa",
  "manual",
  "derived",
  "fused",
  "unknown"
)
export type CanonicalIntelSource = typeof CanonicalIntelSource.Type

export const ProviderKind = Schema.Literal("stac", "ogc-features", "native", "stream")
export type ProviderKind = typeof ProviderKind.Type

export const FilterLang = Schema.Literal("none", "cql2-text", "cql2-json")
export type FilterLang = typeof FilterLang.Type

export const PagingMode = Schema.Literal("link", "token", "offset")
export type PagingMode = typeof PagingMode.Type

// ---------------------------------------------------------------------------
// Capability profile
// ---------------------------------------------------------------------------

export const SearchCapability = Schema.TaggedStruct("SearchCapability", {
  supportsCollections: Schema.Boolean,
  supportsIds: Schema.Boolean,
  supportsBBox: Schema.Boolean,
  supportsIntersects: Schema.Boolean,
  supportsDatetime: Schema.Boolean,
  maxLimit: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))
})

export const FilterCapability = Schema.TaggedStruct("FilterCapability", {
  supportsFilter: Schema.Boolean,
  supportedLangs: Schema.Array(FilterLang),
  supportsFilterCrs: Schema.Boolean,
  cql2Classes: Schema.Array(Schema.String) // conformance URIs
})

export const QueryablesCapability = Schema.TaggedStruct("QueryablesCapability", {
  rootQueryables: Schema.Boolean,
  collectionQueryables: Schema.Boolean,
  additionalPropertiesPolicy: Schema.Literal("strict", "permissive")
})

export const PagingCapability = Schema.TaggedStruct("PagingCapability", {
  modes: Schema.Array(PagingMode),
  supportsPostNextHints: Schema.Boolean // STAC method/headers/body/merge
})

export const ProvenanceCapability = Schema.TaggedStruct("ProvenanceCapability", {
  providesObservedAt: Schema.Boolean,
  providesIngestedAt: Schema.Boolean,
  providesRequestHash: Schema.Boolean,
  providesResponseHash: Schema.Boolean,
  providesAgentAttribution: Schema.Boolean,
  providesBundleIdentity: Schema.Boolean
})

export const SourceCapabilityProfile = Schema.TaggedStruct("SourceCapabilityProfile", {
  provider: ProviderKind,
  conformance: Schema.Array(Schema.String),
  search: SearchCapability,
  filter: FilterCapability,
  queryables: QueryablesCapability,
  paging: PagingCapability,
  provenance: ProvenanceCapability,
  latencyMsP50: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
  latencyMsP95: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
  defaultTtlSeconds: Schema.Number.pipe(Schema.greaterThan(0))
})

// ---------------------------------------------------------------------------
// Registry entries
// ---------------------------------------------------------------------------

export const SourceAlias = Schema.TaggedStruct("SourceAlias", {
  adapter: Schema.String,         // e.g. geoint-search, ingestion-weather
  externalId: Schema.String,      // e.g. adsb_lol, weather
  canonical: CanonicalIntelSource // e.g. adsb-lol, openmeteo
})

export const SourceRegistryEntry = Schema.TaggedStruct("SourceRegistryEntry", {
  _tag: Schema.Literal("SourceRegistryEntry"),
  version: RegistryVersion,
  sourceId: SourceId,
  canonicalSource: CanonicalIntelSource,
  displayName: Schema.String,
  endpoint: Schema.String,
  enabled: Schema.Boolean,
  priority: Schema.Number.pipe(Schema.between(0, 100)),
  weight: Schema.Number.pipe(Schema.between(0, 1)),
  aliases: Schema.Array(SourceAlias),
  capabilities: SourceCapabilityProfile,
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown })
})

export const LayerKind = Schema.Literal("data", "render", "analytic")

export const LayerCapabilityProfile = Schema.TaggedStruct("LayerCapabilityProfile", {
  kind: LayerKind,
  requiredEntityTypes: Schema.Array(Schema.String),
  requiresTemporalOrdering: Schema.Boolean,
  requiresStreaming: Schema.Boolean,
  requiredFilterLangs: Schema.Array(FilterLang),
  requiredProvenanceFields: Schema.Array(
    Schema.Literal(
      "observedAt",
      "ingestedAt",
      "requestHash",
      "responseHash",
      "agentAttribution",
      "bundleIdentity"
    )
  )
})

export const LayerRegistryEntry = Schema.TaggedStruct("LayerRegistryEntry", {
  _tag: Schema.Literal("LayerRegistryEntry"),
  version: RegistryVersion,
  layerId: LayerId,
  name: Schema.String,
  zIndex: Schema.Number,
  visible: Schema.Boolean,
  opacity: Schema.Number.pipe(Schema.between(0, 1)),
  capabilities: LayerCapabilityProfile,
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown })
})

export const TrustGate = Schema.TaggedStruct("TrustGate", {
  minScore: Schema.Number.pipe(Schema.between(0, 100)),
  requireCrossSource: Schema.Boolean,
  maxStalenessSeconds: Schema.Number.pipe(Schema.greaterThan(0))
})

export const SourceLayerBinding = Schema.TaggedStruct("SourceLayerBinding", {
  _tag: Schema.Literal("SourceLayerBinding"),
  version: RegistryVersion,
  bindingId: Schema.String,
  sourceId: SourceId,
  layerId: LayerId,
  enabled: Schema.Boolean,
  precedence: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  trustGate: TrustGate
})

export const RegistrySnapshotV1 = Schema.TaggedStruct("RegistrySnapshotV1", {
  version: RegistryVersion,
  sources: Schema.Array(SourceRegistryEntry),
  layers: Schema.Array(LayerRegistryEntry),
  bindings: Schema.Array(SourceLayerBinding),
  updatedAt: Schema.Date
})
```

### 4.1 Boundary transforms (required)

Use schema transforms for alias normalization at adapters (not ad-hoc switch blocks):

- `GeointSearchSource -> CanonicalIntelSource`
- `IngestionWeatherSource -> CanonicalIntelSource`
- `ProviderNativeCollectionId -> SourceId`

Rule: **runtime state stores canonical values only**.

---

## 5) Capability model

Capabilities are contracts, not comments. A source advertises what it can actually do.

## 5.1 Capability dimensions

1. **Search**: supports bbox/intersects/datetime/ids/collections; max limit behavior.
2. **Filter**: supports `filter`, `filter-lang`, `filter-crs`; CQL2 class set.
3. **Queryables**: root + per-collection queryables, strict/permissive unknown field policy.
4. **Paging**: link/token/offset; STAC POST next-link hints support.
5. **Provenance**: observed/ingested timestamps, request/response digests, attribution chain.
6. **QoS**: p50/p95 latency, ttl, rate limits (metadata).

## 5.2 Baseline interoperability profile (must-have)

A source is **Interop-Core** only if all are true:

- advertises conformance for STAC/OGC path it claims,
- supports at least one filter language (`cql2-text` or `cql2-json`) if filter-enabled,
- provides queryables endpoint(s) for filterable terms,
- exposes deterministic next-page semantics,
- emits provenance minimum (`observedAt`, `ingestedAt`, `requestHash`, `responseHash`).

---

## 6) Composition rules (deterministic)

## 6.1 Source ↔ Layer compatibility

A binding is valid iff:

1. source capabilities satisfy layer required capabilities,
2. source trust score >= layer trust gate,
3. provenance required fields are present,
4. filter language intersection is non-empty when filtering required.

## 6.2 Query composition

1. Normalize inbound filter expressions to **CQL2 JSON IR**.
2. Combine `filter` + `bbox` + `datetime` using logical **AND**.
3. If both `bbox` and `intersects` are provided on Item Search, reject with typed contract error.
4. Keep continuation external contract opaque; preserve provider-native pagination details internally.

## 6.3 Alias and source identity

1. Alias decode is total for known adapters.
2. Unknown alias fails with typed boundary error (never coerced silently).
3. Canonical source remains stable across all internal stores and events.

## 6.4 Conflict resolution for multi-source fusion

Given multiple source candidates for the same entity key:

1. pick latest by `observedAt` within tolerated skew,
2. break ties by higher trust score,
3. break ties again by source priority,
4. preserve all losing candidates in provenance lineage (no data amnesia).

## 6.5 Runtime state rule

Registry state should use Atom-first state surfaces for UI consumers:

- `sourceRegistryAtom`, `layerRegistryAtom`, `bindingRegistryAtom`,
- service methods mutate atoms directly,
- avoid Ref→Atom mirror patterns for registry data.

---

## 7) Trust + provenance scoring model

## 7.1 Scorecard factors (0..100 each)

- **LineageCompleteness (25%)**
  - entity/activity/agent relations present (`wasGeneratedBy`, `used`, `wasDerivedFrom`, `wasAssociatedWith`).
- **IntegrityAttestation (20%)**
  - request/response digests present and verifiable; bundle identity present.
- **Accountability (15%)**
  - attributable agent/org, delegation chain quality.
- **Freshness (15%)**
  - staleness vs source TTL + latency profile.
- **InteropConformance (15%)**
  - declared and validated conformance classes.
- **CrossSourceCorroboration (10%)**
  - agreement across independent source families.

### Formula

`TrustScore = 0.25*L + 0.20*I + 0.15*A + 0.15*F + 0.15*C + 0.10*X`

Where each factor is in `[0, 100]`.

## 7.2 Operational bands

- **85–100 (Tier A):** eligible for primary operational overlays.
- **70–84 (Tier B):** secondary/corroborative overlays.
- **50–69 (Tier C):** contextual display only.
- **<50 (Tier D):** blocked unless explicitly overridden.

## 7.3 Hard-fail conditions (score ignored)

Any of the following forces `effectiveTrust = 0`:

1. missing provenance hop chain,
2. missing request/response digest on required sources,
3. staleness > `2 * defaultTtlSeconds`,
4. signature/hash verification failure,
5. source identity unresolved (alias decode failure).

## 7.4 Provenance payload contract (minimum)

Each emitted item should include:

- `observedAt`, `ingestedAt`,
- `sourceId` + canonical source,
- `requestHash`, `responseHash`,
- `activityId` (collection/search op),
- `agent` attribution when available,
- optional `bundleId` for provenance-of-provenance.

---

## 8) Invariants and conformance tests

1. **Canonical source invariant**
   - no runtime `adsb_lol` / `weather` literals past adapter boundary.

2. **Binding determinism invariant**
   - same snapshot + same query => same source-layer plan.

3. **Provenance minimum invariant**
   - every fused entity has at least one provenance hop with hashes.

4. **Pagination opacity invariant**
   - client token reveals no provider internals; server can replay safely.

5. **Schema compatibility invariant**
   - decoders support N and N-1 major via `Schema.Union` + transforms.

---

## 9) Migration plan (commit slices)

1. **Slice 1: Contracts only**
   - add `registry/schemas.ts` with v1 contracts.
2. **Slice 2: Alias transforms**
   - add adapter transform modules; remove ad-hoc source switches.
3. **Slice 3: Registry runtime**
   - introduce atom-backed registry state + selectors.
4. **Slice 4: Binding planner**
   - implement capability checks and deterministic binding.
5. **Slice 5: Trust engine**
   - implement scorecard + hard-fail gates.
6. **Slice 6: Bridge integration**
   - wrap existing search/harness outputs into registry envelope without UI redesign.
7. **Slice 7: Conformance + migration tests**
   - regression and parity tests before default-path cutover.

---

## 10) Decision summary

Adopt **`geoint.registry.v1`** as the canonical, interoperability-first contract with:

- Effect Schema tagged/versioned registry definitions,
- capability-driven source-layer composition,
- explicit alias transforms at boundaries,
- provenance-required trust scoring with hard-fail safety,
- atom-first runtime registry state.

This gives TMNL a flexible registry core that can absorb STAC/OGC/native sources cleanly, while keeping operational trust explicit and testable.
