# Research: STAC API & OGC API Features for GEOINT Query Architecture

## Summary

STAC API v1.0.0 is a **specialization of OGC API – Features** for spatiotemporal asset catalogs. OGC API Features Part 1 (Core) defines the foundational resource model (`/collections/{id}/items`), while STAC adds cross-collection search (`/search`) and asset-centric metadata. Both return GeoJSON FeatureCollections, share `bbox`/`datetime` query semantics, and use hypermedia-link pagination. For a GEOINT query architecture, implement OGC API Features as the base contract and layer STAC Item Search + CQL2 filtering on top.

---

## 1. Canonical Endpoints

### OGC API Features – Part 1: Core

| Endpoint | Method | Returns | Media Type | Description |
|---|---|---|---|---|
| `/` | GET | Landing Page | `application/json` | Links to all resources, `conformsTo` array |
| `/conformance` | GET | Conformance Declaration | `application/json` | Array of supported conformance class URIs |
| `/api` | GET | OpenAPI Definition | `application/vnd.oai.openapi+json;version=3.0` | Machine-readable service description |
| `/collections` | GET | Collection List | `application/json` | All feature collections with extent metadata |
| `/collections/{collectionId}` | GET | Single Collection | `application/json` | Metadata, spatial/temporal extent, CRS, links |
| `/collections/{collectionId}/items` | GET | FeatureCollection | `application/geo+json` | Paginated features with bbox/datetime filtering |
| `/collections/{collectionId}/items/{featureId}` | GET | Feature | `application/geo+json` | Single GeoJSON Feature |

**Source:** [OGC 17-069r4](https://docs.ogc.org/is/17-069r4/17-069r4.html)

### STAC API – Foundation (Core + Features + Item Search)

| Endpoint | Method | Returns | Media Type | Description |
|---|---|---|---|---|
| `/` | GET | STAC Catalog | `application/json` | Landing page with `conformsTo`, `stac_version` |
| `/search` | GET | ItemCollection | `application/geo+json` | **Cross-collection search** (REQUIRED) |
| `/search` | POST | ItemCollection | `application/geo+json` | **Cross-collection search** (RECOMMENDED) |
| `/collections` | GET | Collection List | `application/json` | STAC Collections (extends OGC) |
| `/collections/{collectionId}` | GET | STAC Collection | `application/json` | Collection with `summaries`, `assets`, `item_assets` |
| `/collections/{collectionId}/items` | GET | ItemCollection | `application/geo+json` | Per-collection Items (OGC API Features compliant) |
| `/collections/{collectionId}/items/{itemId}` | GET | STAC Item | `application/geo+json` | Single Item with `assets` dictionary |
| `/queryables` | GET | Queryables Schema | `application/schema+json` | Filterable properties (Part 3 extension) |

**Source:** [STAC API Spec v1.0.0](https://github.com/radiantearth/stac-api-spec) — [OpenAPI Rendered](https://api.stacspec.org/v1.0.0)

---

## 2. Query Semantics

### 2.1 bbox (Bounding Box)

**Shared by both OGC and STAC.** Spatial intersection filter.

```
# 2D: [west, south, east, north] (WGS84 lon/lat)
bbox=-10.415,36.066,3.779,44.213

# 3D: [west, south, min-elev, east, north, max-elev]
bbox=-10.415,36.066,0,3.779,44.213,1000
```

- CRS is always `http://www.opengis.net/def/crs/OGC/1.3/CRS84` (lon-first)
- Items whose geometry **intersects** the bbox are returned
- Degenerate bboxes (point/line) MUST be supported
- GET: comma-separated string. POST: JSON array of numbers

### 2.2 datetime (Temporal Filter)

**Shared by both. RFC 3339 format.**

```
# Single instant
datetime=2024-06-15T12:00:00Z

# Closed interval (/ separator)
datetime=2024-01-01T00:00:00Z/2024-12-31T23:59:59Z

# Open intervals (.. for unbounded)
datetime=2024-01-01T00:00:00Z/..   # from date, no end
datetime=../2024-12-31T23:59:59Z   # up to date, no start
```

### 2.3 STAC-Specific Parameters (Item Search)

| Parameter | Type | Description |
|---|---|---|
| `collections` | `[string]` | Filter by collection IDs |
| `ids` | `[string]` | Filter by specific Item IDs |
| `intersects` | GeoJSON Geometry | Spatial intersection (mutually exclusive with `bbox`) |
| `limit` | integer | Page size. Default: 10. Max: 10000 (server-defined) |

**Constraint:** Only ONE of `bbox` or `intersects` may be specified. Both → `400 Bad Request`.

### 2.4 CQL2 Filter (OGC API Features Part 3)

Advanced filtering via the `filter` parameter. Requires server to declare the `Filter` conformance class.

```
# Query parameters
filter=cloud_cover < 20 AND platform = 'sentinel-2a'
filter-lang=cql2-text
filter-crs=http://www.opengis.net/def/crs/OGC/1.3/CRS84

# POST body (cql2-json)
{
  "filter-lang": "cql2-json",
  "filter": {
    "op": "and",
    "args": [
      { "op": "<", "args": [{ "property": "cloud_cover" }, 20] },
      { "op": "=", "args": [{ "property": "platform" }, "sentinel-2a"] }
    ]
  }
}
```

**Discovery:** `GET /queryables` returns a JSON Schema describing which properties are filterable.

**Key CQL2 operators:**

| Category | Operators |
|---|---|
| Comparison | `=`, `<>`, `<`, `>`, `<=`, `>=`, `LIKE`, `BETWEEN`, `IN`, `IS NULL` |
| Logical | `AND`, `OR`, `NOT` |
| Spatial | `S_INTERSECTS`, `S_CONTAINS`, `S_WITHIN`, `S_CROSSES`, `S_TOUCHES`, `S_OVERLAPS` |
| Temporal | `T_INTERSECTS`, `T_BEFORE`, `T_AFTER`, `T_DURING` |
| Array | `A_CONTAINS`, `A_EQUALS`, `A_OVERLAPS` |

**Sources:** [OGC 19-079r2 (Part 3)](https://docs.ogc.org/is/19-079r2/19-079r2.html), [OGC 21-065r2 (CQL2)](https://docs.ogc.org/is/21-065r2/21-065r2.html)

---

## 3. Response Contracts

### 3.1 ItemCollection / FeatureCollection

Both STAC and OGC return GeoJSON FeatureCollections:

```jsonc
{
  "type": "FeatureCollection",
  "features": [/* GeoJSON Feature objects */],

  // OGC API Features optional fields:
  "numberMatched": 1000,     // Total matching features (optional)
  "numberReturned": 10,      // Features in this page
  "timeStamp": "2024-06-15T12:00:00Z",

  // Pagination links (REQUIRED):
  "links": [
    { "rel": "self", "href": "...", "type": "application/geo+json" },
    { "rel": "next", "href": "...?page=2", "type": "application/geo+json" },
    { "rel": "prev", "href": "...?page=1", "type": "application/geo+json" },
    { "rel": "root", "href": "/", "type": "application/json" }
  ]
}
```

### 3.2 STAC Item (GeoJSON Feature + Assets)

```jsonc
{
  "type": "Feature",
  "stac_version": "1.0.0",
  "stac_extensions": ["https://stac-extensions.github.io/eo/v1.1.0/schema.json"],
  "id": "S2A_MSIL2A_20240615",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[...], [...], [...], [...]]]
  },
  "bbox": [-10.415, 36.066, 3.779, 44.213],
  "properties": {
    "datetime": "2024-06-15T10:30:00Z",
    "created": "2024-06-15T14:00:00Z",
    "updated": "2024-06-15T14:00:00Z",
    "platform": "sentinel-2a",
    "instruments": ["msi"],
    "constellation": "sentinel-2",
    "eo:cloud_cover": 12.5,
    "proj:epsg": 32632
  },
  "assets": {
    "visual": {
      "href": "https://storage.example.com/scene/visual.tif",
      "type": "image/tiff; application=geotiff; profile=cloud-optimized",
      "title": "True Color",
      "roles": ["visual"]
    },
    "thumbnail": {
      "href": "https://storage.example.com/scene/thumb.png",
      "type": "image/png",
      "roles": ["thumbnail"]
    }
  },
  "links": [
    { "rel": "self", "href": "...", "type": "application/geo+json" },
    { "rel": "parent", "href": "...", "type": "application/json" },
    { "rel": "collection", "href": "...", "type": "application/json" },
    { "rel": "root", "href": "/", "type": "application/json" }
  ]
}
```

### 3.3 STAC Collection

```jsonc
{
  "type": "Collection",
  "id": "sentinel-2-l2a",
  "stac_version": "1.0.0",
  "title": "Sentinel-2 Level-2A",
  "description": "...",
  "license": "proprietary",
  "extent": {
    "spatial": { "bbox": [[-180, -90, 180, 90]] },
    "temporal": { "interval": [["2015-06-23T00:00:00Z", null]] }
  },
  "summaries": {
    "platform": ["sentinel-2a", "sentinel-2b"],
    "eo:cloud_cover": { "minimum": 0, "maximum": 100 }
  },
  "links": [
    { "rel": "items", "href": "./items", "type": "application/geo+json" },
    { "rel": "self", "href": "...", "type": "application/json" },
    { "rel": "root", "href": "/", "type": "application/json" }
  ]
}
```

---

## 4. Pagination

### Strategy

Both specs use **hypermedia link-based pagination** — follow `rel: "next"` links.

| Aspect | OGC API Features | STAC API |
|---|---|---|
| Mechanism | `links` array with `rel: "next"` | Same, extended for POST |
| Parameters | `limit`, server-defined cursor/offset | `limit`, server-defined |
| End detection | Absence of `next` link = last page | Same |
| `numberMatched` | Optional (total count hint) | Not required |
| POST pagination | N/A (GET only in Part 1) | Extended Link with `method`, `body`, `headers`, `merge` |

### STAC POST Pagination Example

```jsonc
{
  "links": [{
    "rel": "next",
    "href": "https://api.example.com/search",
    "type": "application/geo+json",
    "method": "POST",
    "body": { "token": "next:8a35eba9c" },
    "merge": true  // merge into original POST body
  }]
}
```

**Implementation guidance:** Always follow `next` links opaquely. Don't parse cursor tokens. The server owns pagination state.

---

## 5. Conformance & Discovery

### OGC API Features Conformance URIs

| Class | URI | Required? |
|---|---|---|
| Core | `http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/core` | YES |
| GeoJSON | `http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/geojson` | Recommended |
| HTML | `http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/html` | Optional |
| OpenAPI 3.0 | `http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/oas30` | Recommended |
| Filter (Part 3) | `http://www.opengis.net/spec/ogcapi-features-3/1.0/conf/filter` | Optional |
| CQL2 Text | `http://www.opengis.net/spec/cql2/1.0/conf/cql2-text` | With Part 3 |
| CQL2 JSON | `http://www.opengis.net/spec/cql2/1.0/conf/cql2-json` | With Part 3 |

### STAC API Conformance URIs

| Class | URI | Required? |
|---|---|---|
| STAC Core | `https://api.stacspec.org/v1.0.0/core` | YES |
| Item Search | `https://api.stacspec.org/v1.0.0/item-search` | For /search |
| STAC Features | `https://api.stacspec.org/v1.0.0/ogcapi-features` | For OGC compliance |
| Filter | `https://api.stacspec.org/v1.0.0/item-search#filter` | Optional |
| Sort | `https://api.stacspec.org/v1.0.0/item-search#sort` | Optional |
| Fields | `https://api.stacspec.org/v1.0.0/item-search#fields` | Optional |

### Discovery Flow

```
GET / → Landing Page
  ├─ conformsTo: [...] → What the server supports
  ├─ rel: "data" → /collections
  ├─ rel: "conformance" → /conformance
  ├─ rel: "service-desc" → /api (OpenAPI)
  ├─ rel: "search" → /search (STAC only)
  └─ rel: "http://www.opengis.net/def/rel/ogc/1.0/queryables" → /queryables
```

---

## 6. Domain Model Mapping Recommendations

### STAC Item → Internal GEOINT Asset Model

```
┌─────────────────────┐     ┌──────────────────────────┐
│   STAC Item          │     │  Internal Asset Model     │
├─────────────────────┤     ├──────────────────────────┤
│ id                   │ ──► │ externalId               │
│ geometry             │ ──► │ footprint (GeoJSON)      │
│ bbox                 │ ──► │ boundingBox              │
│ properties.datetime  │ ──► │ acquisitionTime          │
│ properties.platform  │ ──► │ sensor.platform          │
│ properties.instruments│──► │ sensor.instruments       │
│ properties.eo:*      │ ──► │ qualityMetrics.*         │
│ properties.proj:epsg │ ──► │ projection.epsgCode      │
│ assets{}             │ ──► │ dataProducts[]           │
│ assets.*.href        │ ──► │ dataProducts[].uri       │
│ assets.*.type        │ ──► │ dataProducts[].mediaType │
│ assets.*.roles       │ ──► │ dataProducts[].role      │
│ collection           │ ──► │ catalogId                │
│ links[rel=parent]    │ ──► │ parentCatalogRef         │
└─────────────────────┘     └──────────────────────────┘
```

### Key Mapping Decisions

1. **`geometry` → `footprint`**: Keep as GeoJSON natively. Don't transform to WKT/WKB at the boundary — defer to persistence layer. GeoJSON is the wire format and the query format.

2. **`assets` dict → `dataProducts[]`**: STAC assets are a keyed dictionary (`{ "visual": {...}, "thumbnail": {...} }`). Flatten to an array with the key preserved as `assetKey` for internal use. The `roles` array (`["data", "visual"]`) maps to your product classification.

3. **`properties.*` → typed fields**: STAC properties are a flat bag. Map well-known properties (datetime, platform, cloud_cover) to typed domain fields. Preserve unknown properties in a `metadata: Record<string, unknown>` escape hatch.

4. **`stac_extensions` → capability flags**: Parse extension URIs to determine which optional fields are available. E.g., `eo` extension → cloud_cover is present. `proj` extension → EPSG code is present.

5. **Temporal normalization**: STAC allows `datetime: null` when `start_datetime` + `end_datetime` are set (for ranges). Internal model should always have a canonical `timeRange: { start, end }` — single instants become zero-width ranges.

6. **Collection → Catalog mapping**: A STAC Collection maps to your internal catalog/dataset concept. The `summaries` field provides aggregated statistics useful for query planning (available platforms, cloud cover ranges, temporal bounds).

### Effect Schema Sketch

```typescript
import { Schema } from "effect"

const GeoJSONGeometry = Schema.Union(
  Schema.Struct({ type: Schema.Literal("Point"), coordinates: Schema.Array(Schema.Number) }),
  Schema.Struct({ type: Schema.Literal("Polygon"), coordinates: Schema.Array(Schema.Array(Schema.Array(Schema.Number))) }),
  // ... other geometry types
)

const TimeRange = Schema.Struct({
  start: Schema.DateFromString,
  end: Schema.DateFromString,
})

const DataProduct = Schema.TaggedStruct("DataProduct", {
  assetKey: Schema.String,
  uri: Schema.String,
  mediaType: Schema.String,
  roles: Schema.Array(Schema.String),
})

const SensorInfo = Schema.Struct({
  platform: Schema.NullOr(Schema.String),
  instruments: Schema.Array(Schema.String),
  constellation: Schema.NullOr(Schema.String),
})

const QualityMetrics = Schema.Struct({
  cloudCover: Schema.NullOr(Schema.Number),
  snowCover: Schema.NullOr(Schema.Number),
  sunAzimuth: Schema.NullOr(Schema.Number),
  sunElevation: Schema.NullOr(Schema.Number),
})

const GeointAsset = Schema.TaggedStruct("GeointAsset", {
  externalId: Schema.String,
  catalogId: Schema.String,
  footprint: GeoJSONGeometry,
  boundingBox: Schema.Array(Schema.Number),  // [w, s, e, n]
  timeRange: TimeRange,
  sensor: SensorInfo,
  quality: QualityMetrics,
  projection: Schema.NullOr(Schema.Struct({ epsgCode: Schema.Number })),
  dataProducts: Schema.Array(DataProduct),
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  stacExtensions: Schema.Array(Schema.String),
})
```

---

## Sources

### Kept
- **OGC API Features Part 1: Core (17-069r4)** — [docs.ogc.org/is/17-069r4](https://docs.ogc.org/is/17-069r4/17-069r4.html) — Canonical spec for endpoints, conformance, bbox/datetime, GeoJSON response contract
- **STAC API Spec v1.0.0** — [github.com/radiantearth/stac-api-spec](https://github.com/radiantearth/stac-api-spec) — Foundation specs (Core, Features, Item Search), OpenAPI definitions, examples
- **STAC API Item Search README** — [item-search/README.md](https://github.com/radiantearth/stac-api-spec/blob/main/item-search/README.md) — Query parameters, pagination contract, POST extensions, link relations
- **OGC API Features Part 3: Filtering (19-079r2)** — [docs.ogc.org/is/19-079r2](https://docs.ogc.org/is/19-079r2/19-079r2.html) — CQL2 filter parameter, queryables, filter-lang, spatial/temporal operators
- **CQL2 Specification (21-065r2)** — [docs.ogc.org/is/21-065r2](https://docs.ogc.org/is/21-065r2/21-065r2.html) — CQL2 grammar, operator catalog, text/JSON encodings
- **OGC Blog: Bringing STAC into OGC** — [ogc.org/blog-article/bringing-stac-into-ogc/](https://www.ogc.org/blog-article/bringing-stac-into-ogc/) — Official relationship statement between STAC and OGC standards
- **STAC API as OGC Community Standard (25-005)** — [docs.ogc.org/cs/25-005](https://docs.ogc.org/cs/25-005/25-005.html) — STAC API formally adopted as OGC Community Standard

### Dropped
- **pystac-client docs** — Client library tutorial, not spec-level
- **Planet API reference** — Vendor-specific implementation, not canonical
- **QGIS Server OGC API docs** — Implementation guide for specific server, not spec
- **stac-fastapi docs** — Python server implementation details, not contract-level
- **Hub Ocean STAC catalog** — Domain-specific example deployment

---

## Gaps

1. **OGC API Features Part 2: CRS** — Not deeply covered. If the GEOINT system needs non-WGS84 coordinate reference systems (e.g., UTM zones, MGRS), Part 2 defines CRS negotiation via `crs` query param and `Content-Crs` header. Spec: [docs.ogc.org/is/18-058r1](https://docs.ogc.org/is/18-058r1/18-058r1.html)

2. **STAC Transaction Extension** — Not covered. If the system needs to *write* Items (ingest pipeline), the Transaction Extension adds PUT/POST/DELETE/PATCH to Items. See: [stac-api-extensions/transaction](https://github.com/stac-api-extensions/transaction)

3. **Authentication/Authorization** — Neither spec mandates auth. GEOINT systems typically layer OAuth2/OIDC or mutual TLS. This is implementation-specific.

4. **Rate limiting & bulk export** — Neither spec addresses rate limiting or bulk download patterns. For large-scale GEOINT queries returning millions of items, consider async job patterns or OGC API Processes.

5. **MGRS/GeoHash tiling** — Common in GEOINT for spatial indexing. No native support in either spec — would be a custom extension or internal optimization layer.
