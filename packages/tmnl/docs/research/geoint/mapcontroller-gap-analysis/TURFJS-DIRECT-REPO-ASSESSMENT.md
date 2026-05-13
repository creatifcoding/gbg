# Turf.js Assessment for MapController vNext

## Status

- **Methodology used:** Context7 + direct repo examination in `/tmp`
- **Repo examined:** `/tmp/turf` @ commit `1fed227`
- **Primary target:** identify legit Turf packages for implementing MapController gap methods

---

## 1) What is verified (from direct repo)

### A. Turf is modular and tree-shakeable

- `@turf/turf` package is ESM/CJS dual export and marks `sideEffects: false`.
- Source: `/tmp/turf/packages/turf/package.json`

### B. `@turf/turf` is a re-export bundle of individual packages

- Core API exports are re-exported from module packages (`@turf/bbox`, `@turf/distance`, etc.).
- Source: `/tmp/turf/packages/turf/index.ts`

### C. Heavy geometry ops are explicitly marked in bundle source

- `buffer`, `intersect`, `difference`, `union` are marked as JSTS/polyclip-backed in exports.
- Source: `/tmp/turf/packages/turf/index.ts`

### D. Function-level caveats confirmed in source

- `buffer` supports negative radius but may return invalid/empty output for erosion edge cases.
  - Source: `/tmp/turf/packages/turf-buffer/index.js`
- `nearestPointOnLine` has migrated return property names (v7.4 guidance retained with backward-compat props).
  - Source: `/tmp/turf/packages/turf-nearest-point-on-line/index.ts`
- `intersect`, `difference`, `union` currently take `FeatureCollection<Polygon|MultiPolygon>` and require at least 2 geometries.
  - Source: `/tmp/turf/packages/turf-intersect/index.ts`
  - Source: `/tmp/turf/packages/turf-difference/index.ts`
  - Source: `/tmp/turf/packages/turf-union/index.ts`
- `Units` type includes linear units + radians/degrees with explicit warning on degree-distance interpretation.
  - Source: `/tmp/turf/packages/turf-helpers/index.ts`

---

## 2) Context7 corroboration (API-level)

Context7 confirms production APIs and examples for:

- `bbox`, `bboxPolygon`
- `distance`, `destination`, `area`
- `buffer`
- `booleanIntersects`, `booleanPointInPolygon`
- `intersect`, `difference`
- `nearestPointOnLine` and migration note for return fields

(DeepWiki for `turfjs/turf` is currently not indexed in this environment; direct repo inspection was used as primary evidence.)

---

## 3) Legit package shortlist for MapController work

## 3.1 Immediate, low-risk core set

Use these first (lightweight, directly aligned with existing MapController domains):

- `@turf/bbox`
- `@turf/bbox-polygon`
- `@turf/distance`
- `@turf/bearing`
- `@turf/area`
- `@turf/length`
- `@turf/destination`
- `@turf/boolean-point-in-polygon`
- `@turf/boolean-intersects`
- `@turf/line-intersect`
- `@turf/nearest-point-on-line`

## 3.2 Geometry-composition set (heavier)

Add only when specific method requirements demand them:

- `@turf/buffer`
- `@turf/intersect`
- `@turf/difference`
- `@turf/union`

## 3.3 Data hygiene/perf helpers

- `@turf/clean-coords`
- `@turf/simplify`
- `@turf/truncate`

---

## 4) MapController gap methods that Turf can directly power

High-confidence examples:

- `addBufferZone` → `buffer`
- `queryFeaturesInPolygon` / geofence checks → `booleanPointInPolygon`
- corridor conflict checks → `booleanIntersects`, `lineIntersect`
- `renderChangePolygons` overlays from AOI math → `intersect`, `difference`, `union`
- `computeRouteLength` style metrics on candidate paths → `length`
- `computeNearestPointOnRoute` → `nearestPointOnLine`
- `computeBbox` / AOI envelope ops → `bbox`, `bboxPolygon`
- directional cue projection → `bearing`, `destination`, `distance`

---

## 5) Hard boundaries (don’t over-claim Turf)

Turf **is not** a road-network routing engine.

- For true turn-by-turn road routing / ETA, use graph/routing services (OSRM/Valhalla/GraphHopper/Mapbox Directions), then use Turf for geometry post-processing.

Turf shortest path is grid/obstacle-based and not a drop-in replacement for road routing.

- Evidence: `/tmp/turf/packages/turf-shortest-path/index.ts`

---

## 6) Recommended integration policy for TMNL

1. Prefer **modular imports** over `@turf/turf` bundle in production paths.
2. Keep Turf in a dedicated geospatial adapter module (single import boundary).
3. Normalize/clean coordinates before heavy polygon ops (`cleanCoords`, optionally `truncate`).
4. Use explicit unit arguments in all distance/length APIs (no implicit defaults in business logic).
5. Gate heavy polygon composition ops behind feature flags/perf telemetry.

---

## 7) Proposed install profile (Bun)

Minimal first-wave install set:

```bash
bun add @turf/bbox @turf/bbox-polygon @turf/distance @turf/bearing @turf/area @turf/length @turf/destination @turf/boolean-point-in-polygon @turf/boolean-intersects @turf/line-intersect @turf/nearest-point-on-line
```

Second wave (when needed):

```bash
bun add @turf/buffer @turf/intersect @turf/difference @turf/union @turf/clean-coords @turf/simplify @turf/truncate
```
