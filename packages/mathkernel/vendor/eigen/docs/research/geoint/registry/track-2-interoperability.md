# Track 2 — Interoperability Architecture for a Composable GEOINT Registry

**Author:** SwiftUnion (Design)
**Date:** 2026-02-24
**Status:** Proposed architecture (gate-ready)

---

## 1) Scope and acceptance gates

This track defines a **standards-aligned interoperability architecture** for TMNL GEOINT registry composition across:

- STAC Item Search (+ STAC Filter extension)
- OGC API - Features Core + Part 3 Filtering
- CQL2 normalization
- Pagination interoperability
- Provenance chain integrity
- Schema versioning + migration safety

### Gate checklist (must all pass)

1. **Standards evidence** includes DeepWiki + web/Exa source grounding.
2. **Canonical registry schema** is explicit and Effect-Schema-first.
3. **Contract interfaces** are concrete and implementable.
4. **Pagination strategy** works for GET/POST STAC + OGC next-link flows.
5. **Provenance model** is append-only and hash-addressable.
6. **Versioning strategy** supports backward decode + staged cutover.
7. **TMNL migration plan** maps to specific current files/contracts.

---

## 2) Research inputs (required DeepWiki + web/Exa)

## DeepWiki

- `stac-utils/stac-fastapi`: filter extension surface, queryables endpoints, filter params and conformance handling.
- `Effect-TS/effect`: schema evolution patterns (`Union`, `transform`, version-compatible decode strategy).

## Web/Exa

- STAC Item Search canonical params/pagination:
  - https://raw.githubusercontent.com/radiantearth/stac-api-spec/release/v1.0.0/item-search/README.md
  - https://raw.githubusercontent.com/radiantearth/stac-api-spec/release/v1.0.0/item-search/openapi.yaml
- STAC Filter extension:
  - https://github.com/stac-api-extensions/filter
  - https://raw.githubusercontent.com/stac-api-extensions/filter/main/openapi.yaml
- OGC API Features Core + Filtering:
  - https://docs.ogc.org/is/17-069r3/17-069r3.html
  - https://docs.ogc.org/is/19-079r2/19-079r2.html
- CQL2:
  - https://docs.ogc.org/is/21-065r2/21-065r2.html

---

## 3) Standards findings (interoperability-critical)

### 3.1 STAC (Item Search + Filter extension)

- `GET /search` is required; `POST /search` recommended.
- Core search parameters include `limit`, `bbox`, `datetime`, `intersects`, `ids`, `collections`.
- `limit` is advisory; server must not exceed; may cap to server max.
- Pagination is via hypermedia links (`rel=next`, optional `prev/first/last`).
- For POST pagination, STAC extends links with `method`, `headers`, `body`, `merge` for follow-up semantics.
- Filter extension introduces `filter`, `filter-lang`, `filter-crs` and queryables resources.

### 3.2 OGC API Features (Core + Part 3 Filtering)

- Core `/collections/{collectionId}/items` supports `limit`, `bbox`, `datetime`.
- Paging is by `next` link; optional `numberMatched` and `numberReturned`.
- Part 3 adds:
  - `filter` parameter
  - `filter-lang` (`cql2-text` / `cql2-json`, default language advertised by API)
  - `filter-crs` (CRS84 default; optional broader CRS support)
  - `/queryables` and `/collections/{collectionId}/queryables`
- When mixed with bbox/datetime/property predicates, filter semantics are **logical AND**.

### 3.3 CQL2 implications

- CQL2 is the only practical common denominator across STAC filter + OGC filtering.
- Interop architecture should normalize all inbound filter forms to **CQL2 JSON AST** internally.

---

## 4) TMNL current-state evidence and gaps

### Existing strengths

- Search contracts already include source, retrieval time, and per-source counts:
  - `src/lib/geoint/schemas/search.ts:256,464,477,489`
- Provider-specific pagination hooks already exist (`nextUrl`):
  - `src/lib/geoint/schemas/search.ts:1083,1287`
- Sentinel search body already uses STAC-like fields (`collections`, `bbox`, `intersects`, `datetime`, `query`):
  - `src/lib/geoint/api/ExternalApiClient.ts:1464-1487`
- Provenance schema exists and is rich in ECS layer:
  - `src/lib/ecs/schemas/provenance.ts:81,153`

### Interop gaps to close

1. **Source vocabulary drift across boundaries**
   - GEOINT search sources: `adsb_lol`, `weather` (`src/lib/geoint/schemas/search.ts:56-65`)
   - ECS canonical sources: `adsb-lol`, `openmeteo`, `derived` (`src/lib/ecs/schemas/core.ts:37-55`)
   - Manual remap in entity conversion (`src/lib/geoint/entities/index.ts:132-139`)

2. **Provenance hash placeholder**
   - Current buildProvenance writes all-zero hash (`src/lib/geoint/entities/index.ts:174`).

3. **Pagination contract not canonicalized**
   - Unified response lacks explicit interoperable page contract despite provider `nextUrl` fields (`src/lib/geoint/schemas/search.ts:464-495,1083,1287`).

4. **Saved search persistence split**
   - PostGIS model exists (`src/lib/geoint/persistence/postgis/schemas.ts:238`) but runtime saved/history currently in-memory refs (`src/lib/geoint/server/SearchRpcServer.ts:124,793-880`).

5. **Harness boundary drift (TypeBox vs Effect Schema)**
   - Harness tools use TypeBox (`src/lib/geoint/harness/tools.ts:38-49,81-86`) while domain contracts use Effect Schema (`src/lib/geoint/schemas/search.ts:256+`).

6. **`totalLimit` not clearly enforced end-to-end**
   - Declared in query schema (`src/lib/geoint/schemas/search.ts:288`) but server execution centers on per-source limit (`src/lib/geoint/server/SearchRpcServer.ts:453,657`).

---

## 5) Canonical Track 2 architecture

## 5.1 Layered model

1. **Ingress contract**: `RegistrySearchQueryV1`
2. **Filter normalizer**: any input → CQL2 JSON AST
3. **Adapter fanout**: STAC / OGC Features / native sources
4. **Result harmonizer**: provider payload → `RegistryEntityEnvelopeV1`
5. **Page codec**: provider next-state ↔ opaque continuation token
6. **Projection boundary**: envelope set → existing layer factories (no UI rewrite)

This keeps render/UI stable while fixing interoperability underneath.

## 5.2 Canonical registry schemas (Effect)

```ts
import { Schema } from "effect"

export const RegistryVersion = Schema.Literal("registry.v1")
export type RegistryVersion = typeof RegistryVersion.Type

export const RegistryProvider = Schema.Literal("stac", "ogc-features", "native")
export type RegistryProvider = typeof RegistryProvider.Type

export const FilterLang = Schema.Literal("cql2-json", "cql2-text", "stac-query", "none")
export type FilterLang = typeof FilterLang.Type

export const PagingMode = Schema.Literal("link", "token", "offset")

export const RegistryCollectionRef = Schema.Struct({
  provider: RegistryProvider,
  id: Schema.String,
})

export const Cql2Expr = Schema.Unknown // concrete AST schema can be tightened incrementally

export const RegistryFilterV1 = Schema.TaggedStruct("RegistryFilterV1", {
  lang: FilterLang,
  cql2: Schema.optional(Cql2Expr),
  raw: Schema.optional(Schema.Unknown),
  filterCrs: Schema.optional(Schema.String),
})

export const PagingRequestV1 = Schema.TaggedStruct("PagingRequestV1", {
  mode: PagingMode,
  limit: Schema.Number.pipe(Schema.int(), Schema.between(1, 1000)),
  cursor: Schema.optional(Schema.String),
  offset: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))),
  nextHref: Schema.optional(Schema.String),
})

export const RegistrySearchQueryV1 = Schema.TaggedStruct("RegistrySearchQueryV1", {
  version: RegistryVersion,
  queryId: Schema.String,
  text: Schema.optional(Schema.String),
  collections: Schema.Array(RegistryCollectionRef),
  bbox: Schema.optional(Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number)),
  intersects: Schema.optional(Schema.Unknown),
  datetime: Schema.optional(Schema.String),
  filter: Schema.optional(RegistryFilterV1),
  page: PagingRequestV1,
})

export const ProvenanceHopV1 = Schema.TaggedStruct("ProvenanceHopV1", {
  provider: RegistryProvider,
  endpoint: Schema.String,
  requestedAt: Schema.Date,
  receivedAt: Schema.Date,
  requestHash: Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/i)),
  responseHash: Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/i)),
  pageState: Schema.optional(Schema.String),
})

export const RegistryEntityEnvelopeV1 = Schema.TaggedStruct("RegistryEntityEnvelopeV1", {
  version: RegistryVersion,
  envelopeId: Schema.String,
  entityType: Schema.String,
  source: Schema.String, // must map to canonical ECS IntelSource at boundary
  collection: RegistryCollectionRef,
  nativeId: Schema.String,
  geometry: Schema.Unknown,
  observedAt: Schema.optional(Schema.Date),
  retrievedAt: Schema.Date,
  confidence: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  properties: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  provenance: Schema.Array(ProvenanceHopV1).pipe(Schema.minItems(1)),
})

export const PagingStateV1 = Schema.TaggedStruct("PagingStateV1", {
  mode: PagingMode,
  returned: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  matched: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))),
  hasNext: Schema.Boolean,
  continuationToken: Schema.optional(Schema.String),
  nextHref: Schema.optional(Schema.String),
})

export const RegistryPageV1 = Schema.TaggedStruct("RegistryPageV1", {
  version: RegistryVersion,
  queryId: Schema.String,
  items: Schema.Array(RegistryEntityEnvelopeV1),
  paging: PagingStateV1,
  sourceCounts: Schema.Record({ key: Schema.String, value: Schema.Number }),
  errors: Schema.Record({ key: Schema.String, value: Schema.String }),
  executionTimeMs: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
})
```

---

## 6) Contract interfaces (adapter boundaries)

```ts
import { Effect } from "effect"

export interface RegistryAdapter {
  readonly id: string
  readonly provider: "stac" | "ogc-features" | "native"
  readonly supports: {
    readonly filterLangs: ReadonlyArray<"cql2-json" | "cql2-text" | "stac-query">
    readonly pagingModes: ReadonlyArray<"link" | "token" | "offset">
    readonly supportsFilterCrs: boolean
  }

  normalizeQuery: (
    query: RegistrySearchQueryV1
  ) => Effect.Effect<unknown, Error>

  searchPage: (
    query: RegistrySearchQueryV1
  ) => Effect.Effect<RegistryPageV1, Error>

  continuePage: (
    continuationToken: string
  ) => Effect.Effect<RegistryPageV1, Error>
}

export interface FilterNormalizer {
  toCql2Json: (
    filter: RegistryFilterV1,
    context: { provider: "stac" | "ogc-features" | "native" }
  ) => Effect.Effect<RegistryFilterV1, Error>
}

export interface ContinuationCodec {
  encode: (state: {
    adapterId: string
    queryHash: string
    mode: "link" | "token" | "offset"
    nextHref?: string
    token?: string
    offset?: number
    limit: number
  }) => string

  decode: (token: string) => Effect.Effect<{
    adapterId: string
    queryHash: string
    mode: "link" | "token" | "offset"
    nextHref?: string
    token?: string
    offset?: number
    limit: number
  }, Error>
}
```

---

## 7) Concrete API shapes for TMNL

## 7.1 `POST /v2/geoint/registry/search`

```json
{
  "version": "registry.v1",
  "queryId": "qry-01J6...",
  "collections": [
    { "provider": "stac", "id": "sentinel-2-l2a" },
    { "provider": "ogc-features", "id": "roads" }
  ],
  "bbox": [-122.6, 37.6, -122.2, 37.95],
  "datetime": "2025-01-01T00:00:00Z/..",
  "filter": {
    "lang": "cql2-text",
    "raw": "eo:cloud_cover <= 15 AND S_INTERSECTS(geometry, BBOX(-122.6,37.6,-122.2,37.95))"
  },
  "page": { "mode": "token", "limit": 100 }
}
```

### Response

```json
{
  "version": "registry.v1",
  "queryId": "qry-01J6...",
  "items": [
    {
      "version": "registry.v1",
      "envelopeId": "env-01J6...",
      "entityType": "imagery",
      "source": "sentinel",
      "collection": { "provider": "stac", "id": "sentinel-2-l2a" },
      "nativeId": "S2A_...",
      "geometry": { "type": "Polygon", "coordinates": [] },
      "retrievedAt": "2026-02-24T05:02:11.924Z",
      "properties": { "eo:cloud_cover": 8.3 },
      "provenance": [
        {
          "provider": "stac",
          "endpoint": "https://.../search",
          "requestedAt": "2026-02-24T05:02:10.111Z",
          "receivedAt": "2026-02-24T05:02:11.804Z",
          "requestHash": "8a7f...",
          "responseHash": "1fd3..."
        }
      ]
    }
  ],
  "paging": {
    "mode": "token",
    "returned": 100,
    "matched": 1642,
    "hasNext": true,
    "continuationToken": "eyJhZGFwdGVySWQiOiJzdGFj..."
  },
  "sourceCounts": { "stac": 100, "ogc-features": 0 },
  "errors": {},
  "executionTimeMs": 1732
}
```

## 7.2 `POST /v2/geoint/registry/page`

```json
{ "continuationToken": "eyJhZGFwdGVySWQiOiJzdGFj..." }
```

Returns `RegistryPageV1` again.

---

## 8) Filter and pagination interoperability rules

### Filter normalization rules

- STAC `query` object + STAC Filter extension expressions normalize to CQL2 JSON AST.
- OGC `filter` + `filter-lang` + `filter-crs` normalize to same AST.
- `bbox`/`datetime` are merged with `filter` using explicit **AND**.
- If provider lacks declared conformance for requested encoding, fail fast with typed error.

### Pagination rules

- Follow provider-native `next` link/token/offset internally.
- Expose only **opaque continuationToken** externally.
- Token must embed adapter id + query hash + next-state and be integrity-protected.
- For STAC POST-next semantics (`method`/`headers`/`body`/`merge`), preserve replay hints in token payload.

---

## 9) Provenance contract

Each envelope must include immutable, append-only provenance hops:

- source endpoint
- request/response timestamps
- SHA-256 request + response digests
- page-state continuation artifact

This extends TMNL’s current provenance direction but removes weak placeholder hashing (`src/lib/geoint/entities/index.ts:174`).

---

## 10) Schema versioning and compatibility strategy

## 10.1 Version envelope

- Every registry query/result/envelope carries `version: "registry.v1"`.
- Minor additions are additive only.
- Breaking changes create `registry.v2` and dual decoders.

## 10.2 Effect-compatible decoding

- Use `Schema.Union(V2, V1)` at ingress.
- Use `Schema.transform` / `Schema.transformOrFail` to promote older versions into current runtime model.
- Keep encode path configurable (`targetVersion`) for staged downgrade support.

## 10.3 Deprecation policy

- N+1 support window for previous major.
- Emit warning metadata in response headers/details before hard cutoff.

---

## 11) Migration implications for TMNL

## Phase M0 — Schema introduction (no behavior change)

- Add `src/lib/geoint/registry/schemas.ts` (canonical V1 contracts).
- Add mapping utilities from existing `SearchResultItem` to `RegistryEntityEnvelopeV1`.

## Phase M1 — Bridge wrapping current search

- Wrap `SearchRpcServer` responses into `RegistryPageV1`.
- Preserve existing UI layer inputs (no rendering churn).

## Phase M2 — Adapter contracts + token codec

- Add `registry/adapters/{stac,ogc,native}.ts`.
- Add continuation token codec and roundtrip tests.

## Phase M3 — Filter normalization pipeline

- Implement CQL2-normalization service.
- Enforce AND-composition with bbox/datetime.

## Phase M4 — Provenance hardening

- Replace placeholder hash path (`src/lib/geoint/entities/index.ts:174`) with real hashing of request/response artifacts.

## Phase M5 — Boundary unification

- Replace harness TypeBox tool contracts with Effect-Schema-backed registry contracts (`src/lib/geoint/harness/tools.ts:38+`).
- Unify IntelSource at boundary with ECS canonical vocabulary (`src/lib/ecs/schemas/core.ts:37+`).

## Phase M6 — Persistence alignment

- Move saved search/history from in-memory refs (`src/lib/geoint/server/SearchRpcServer.ts:124,793-880`) to existing PostGIS saved-search schema (`src/lib/geoint/persistence/postgis/schemas.ts:238+`).

---

## 12) Risks and mitigations

1. **Spec drift across providers**
   - Mitigation: adapter capability declarations + conformance assertions.

2. **Token replay/corruption**
   - Mitigation: signed token codec with query-hash binding + expiry.

3. **Source enum breakage during migration**
   - Mitigation: explicit canonical mapping table and contract tests.

4. **Incremental rollout risk**
   - Mitigation: dual-path execution and parity metrics before cutover.

---

## 13) Recommended implementation order (commit slices)

1. `registry/schemas` + golden decode tests.
2. `registry/token-codec` + pagination roundtrip tests.
3. `registry/filter-normalizer` + CQL2 canonicalization tests.
4. `registry/adapters/stac` then `registry/adapters/ogc`.
5. `SearchRpcServer` bridge integration.
6. Harness boundary migration to Effect Schema contracts.
7. Persistence cutover for saved/history.

---

## 14) Decision summary

Track 2 should proceed with:

- **CQL2 JSON as internal filter IR**
- **Opaque canonical continuation tokens**
- **Envelope-first provenance with real digests**
- **Effect-Schema versioned contracts (`registry.v1`)**
- **Adapter-based interop preserving existing render plane**

This gives TMNL a composable registry core that is standards-aligned, evolvable, and migration-safe without destabilizing UI workflows.
