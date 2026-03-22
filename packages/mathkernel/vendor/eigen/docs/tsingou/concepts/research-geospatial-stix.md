# Research: Geospatial Indexing & STIX Relationship Generation

```
Document:   TSGC-002 — Geospatial Indexing & STIX Generation Research
Status:     DRAFT
Created:    2026-02-19
Context:    Tsingou SIGINT Visualization Platform
Depends:    TSGC-001 (Fusion Ontology), TSG.12 (STIX Data Model), TSG.30 (Geospatial Math)
Covers:     RI-5 (Geospatial Indexing for Spatial Joins)
            RI-6 (STIX Relationship Generation from Fusion Events)
```

> Two research initiatives that bridge the fusion ontology to concrete implementation:
> **RI-5** answers "how do we make spatial joins fast?" and **RI-6** answers "how do
> we export fusion results as interoperable intelligence?"

---

## Table of Contents

### Part I: RI-5 — Geospatial Indexing for Spatial Joins

1. [The Spatial Join Problem in Tsingou](#1-the-spatial-join-problem-in-tsingou)
2. [H3 Hexagonal Hierarchical Geospatial Indexing](#2-h3-hexagonal-hierarchical-geospatial-indexing)
3. [H3 Resolution Selection for Signal Pair Types](#3-h3-resolution-selection-for-signal-pair-types)
4. [Bearing Cone to H3 Polyfill Algorithm](#4-bearing-cone-to-h3-polyfill-algorithm)
5. [H3 vs S2 vs Geohash: Comparative Analysis](#5-h3-vs-s2-vs-geohash-comparative-analysis)
6. [R-tree Family for Continuous Spatial Queries](#6-r-tree-family-for-continuous-spatial-queries)
7. [Moving Object Indexing](#7-moving-object-indexing)
8. [Spatial Join Algorithms](#8-spatial-join-algorithms)
9. [H3 Performance Characteristics](#9-h3-performance-characteristics)
10. [Spatial Join Pipeline Architecture](#10-spatial-join-pipeline-architecture)

### Part II: RI-6 — STIX Relationship Generation from Fusion Events

11. [STIX 2.1 Relationship Objects (SROs)](#11-stix-21-relationship-objects-sros)
12. [STIX Sighting Object for Signal Observations](#12-stix-sighting-object-for-signal-observations)
13. [Provenance Chains in STIX](#13-provenance-chains-in-stix)
14. [STIX Confidence Mapping](#14-stix-confidence-mapping)
15. [Custom STIX Extensions for Fusion Metadata](#15-custom-stix-extensions-for-fusion-metadata)
16. [STIX Bundle Assembly from Fusion Events](#16-stix-bundle-assembly-from-fusion-events)
17. [Automatic Relationship Inference](#17-automatic-relationship-inference)
18. [TAXII 2.1 Publishing Pipeline](#18-taxii-21-publishing-pipeline)
19. [SRO Templates for Fusion Output Types](#19-sro-templates-for-fusion-output-types)
20. [Effect Schema Codecs for STIX Generation](#20-effect-schema-codecs-for-stix-generation)
21. [STIX Generation Pipeline Architecture](#21-stix-generation-pipeline-architecture)
22. [Performance Analysis](#22-performance-analysis)
23. [Integration with Fusion Ontology](#23-integration-with-fusion-ontology)
24. [References](#24-references)

---

# PART I: RI-5 — Geospatial Indexing for Spatial Joins

---

## 1. The Spatial Join Problem in Tsingou

### 1.1 Problem Statement

The fusion ontology (TSGC-001) defines Tier 2 soft-key joins that operate on
spatial proximity. Two signals with no shared identifier are fusion candidates
when `haversine(A.geo, B.geo) < radius`. The naive approach — computing pairwise
distances between all signals in two collections — is O(n*m) and collapses at
operational scale.

```
Given:
  Collection A: 10,000 ADS-B signals/second
  Collection B: 500 AIS signals/3 minutes
  Collection C: 50 RF bearing sweeps/second

Naive pairwise:
  A x B: 10,000 * 500 = 5,000,000 distance computations/second
  A x C: 10,000 * 50  = 500,000 distance computations/second
  B x C: 500 * 50     = 25,000 distance computations/3 minutes

Total: ~5.5 million haversine computations/second
```

Each haversine computation involves two `atan2`, two `sin`, two `cos` — roughly
100ns on modern hardware. That is 550ms of pure math per second, consuming an
entire core just for distance checks, before any join logic.

### 1.2 The Spatial Index Solution

Spatial indexes reduce the search space by partitioning geography into cells,
then only computing distances between signals in the same or adjacent cells.
This converts O(n*m) to O(n*k) where k is the average number of signals per
cell — typically orders of magnitude smaller than m.

```
WITH SPATIAL INDEX (H3):

1. Assign each signal to an H3 cell: O(1) per signal
2. Join only signals sharing the same cell: O(n * k)
   where k = avg signals per cell << m

Example at resolution 7 (1.41 km edge, 5.16 km^2 area):
  10,000 ADS-B signals over a 500 km x 500 km area
  = ~48,000 H3 cells in the area
  = ~0.2 signals per cell on average
  = only nearby signals need distance computation
```

### 1.3 Two Complementary Approaches

Tsingou requires TWO spatial indexing strategies:

| Strategy | Index Type | Use Case | Characteristic |
|----------|-----------|----------|----------------|
| Discrete grid | H3 | Streaming joins, d2ts operators | Cell ID as join key |
| Continuous tree | R-tree | Range queries, nearest neighbor | Exact geometry |

H3 excels at streaming spatial joins because a cell ID is a 64-bit integer —
it becomes a standard equi-join key in d2ts. R-tree excels at ad-hoc range
queries and nearest-neighbor searches where exact distances matter.

---

## 2. H3 Hexagonal Hierarchical Geospatial Indexing

### 2.1 Overview

H3 is a discrete global grid system developed at Uber that partitions the
Earth's surface into a hierarchy of hexagonal cells. Unlike rectangular grids
(Geohash, S2), hexagons have uniform adjacency — every neighbor is equidistant
from the center, eliminating the diagonal-distance problem of square grids.

Source: [H3 Official Documentation](https://h3geo.org/)
Source: [uber/h3 GitHub](https://github.com/uber/h3)

### 2.2 Construction

H3 begins with a sphere-circumscribed icosahedron (20 triangular faces).
Hexagonal grids are laid onto each face using a gnomonic projection. The
base resolution (0) produces 122 cells: 110 hexagons and 12 pentagons
centered at icosahedron vertices. Each finer resolution subdivides each
hexagon into approximately 7 child hexagons (aperture 7).

```
ICOSAHEDRON FACE TILING:

    /\      /\      /\
   /  \    /  \    /  \
  / H  \  / H  \  / H  \     Hexagonal grid on
 /______\/______\/______\     triangular face
 \      /\      /\      /
  \ H  /  \ H  /  \ H  /     H = hexagon center
   \  /    \  /    \  /       P = pentagon (at vertex)
    \/      \/      \/

Pentagon at vertex (12 total globally):
  +-----+
 /       \
|    P    |     5 sides, not 6
 \       /      Slightly different area
  +-----+
```

### 2.3 Resolution Table

Complete H3 resolution statistics (spherical model):

| Res | Total Cells | Avg Hex Area | Avg Edge Length | Hex Area (m^2) |
|-----|-------------|-------------|-----------------|----------------|
| 0 | 122 | 4,357,449 km^2 | 1,281.26 km | 4.36e+12 |
| 1 | 842 | 609,788 km^2 | 483.06 km | 6.10e+11 |
| 2 | 5,882 | 86,802 km^2 | 182.51 km | 8.68e+10 |
| 3 | 41,162 | 12,393 km^2 | 68.98 km | 1.24e+10 |
| 4 | 288,122 | 1,770 km^2 | 26.07 km | 1.77e+09 |
| 5 | 2,016,842 | 252.90 km^2 | 9.85 km | 2.53e+08 |
| 6 | 14,117,882 | 36.13 km^2 | 3.72 km | 3.61e+07 |
| 7 | 98,825,162 | 5.16 km^2 | 1.41 km | 5.16e+06 |
| 8 | 691,776,122 | 0.74 km^2 | 531 m | 7.37e+05 |
| 9 | 4,842,432,842 | 0.105 km^2 | 200 m | 1.05e+05 |
| 10 | 33,897,029,882 | 0.015 km^2 | 76 m | 1.50e+04 |
| 11 | 237,279,209,162 | 0.0021 km^2 | 29 m | 2.14e+03 |
| 12 | 1.66e+12 | 3.1e-4 km^2 | 11 m | 3.07e+02 |
| 13 | 1.16e+13 | 4.4e-5 km^2 | 4.1 m | 4.39e+01 |
| 14 | 8.14e+13 | 6.3e-6 km^2 | 1.5 m | 6.27e+00 |
| 15 | 5.70e+14 | 9.0e-7 km^2 | 0.58 m | 8.95e-01 |

Source: [H3 Resolution Table](https://h3geo.org/docs/core-library/restable/)

Key property: **always exactly 12 pentagons at every resolution**, centered at
icosahedron vertices. Pentagon area is approximately 2/3 of hexagon area at the
same resolution.

### 2.4 Core Operations

| Operation | Function | Complexity | Description |
|-----------|----------|-----------|-------------|
| Point to cell | `latLngToCell(lat, lng, res)` | O(1) | Convert coordinate to H3 index |
| Cell to point | `cellToLatLng(cell)` | O(1) | Get cell center coordinate |
| Cell to boundary | `cellToBoundary(cell)` | O(1) | Get cell vertex coordinates |
| Grid disk | `gridDisk(cell, k)` | O(k^2) | All cells within k rings |
| Grid ring | `gridRing(cell, k)` | O(k) | Hollow ring at distance k |
| Grid distance | `gridDistance(a, b)` | O(1) | Hexagonal grid distance |
| Cell resolution | `getResolution(cell)` | O(1) | Extract resolution from index |
| Parent cell | `cellToParent(cell, parentRes)` | O(1) | Coarsen to parent resolution |
| Child cells | `cellToChildren(cell, childRes)` | O(7^dR) | Refine to child resolution |
| Polygon fill | `polygonToCells(polygon, res)` | O(A/cell_area) | Fill polygon with cells |
| Compact | `compactCells(cells)` | O(n) | Replace 7 siblings with parent |

The H3 index is a 64-bit integer encoding:
- Mode (4 bits): cell, edge, vertex
- Resolution (4 bits): 0-15
- Base cell (7 bits): 0-121
- Cell digits (3 bits each, up to 15): child index at each resolution

### 2.5 Adjacency Properties

Hexagonal grids have a critical advantage for spatial joins: **uniform adjacency**.

```
SQUARE GRID:                    HEXAGONAL GRID:
+---+---+---+                      ___
| d | 1 | d |                  ___/ 1 \___
+---+---+---+              ___/ 6 \___/ 2 \___
| 1 | * | 1 |             / 5 \___/ * \___/ 3 \
+---+---+---+             \___/ 4 \___/   \___/
| d | 1 | d |                 \___/
+---+---+---+

d = sqrt(2) ~= 1.414              All neighbors equidistant
1 = 1.0                           Distance = 1.0 uniformly
                                   6 neighbors (not 8)
```

For spatial joins, this means: checking the center cell plus its 6 immediate
neighbors (k-ring 1) guarantees coverage of all points within one cell
diameter. No diagonal ambiguity.

---

## 3. H3 Resolution Selection for Signal Pair Types

### 3.1 Selection Criteria

The optimal H3 resolution for a signal pair depends on:

1. **Spatial precision of the signals** — GPS is ~10m, DF bearing is ~1km at 10km range
2. **Fusion radius** from the ontology — how close must signals be to be candidates
3. **Expected signal density** — too fine a resolution = too many cells, too coarse = too many false candidates
4. **K-ring expansion budget** — checking k=1 ring costs 7 cells, k=2 costs 19 cells

The goal: choose the resolution where the **cell diameter approximately equals
the fusion radius**, so that checking the origin cell plus k=1 ring covers the
entire fusion zone.

### 3.2 Resolution Selection Table

| Signal Pair | Fusion Radius | Recommended Res | Cell Edge | Cell Diameter | K-ring | Cells Checked |
|-------------|--------------|-----------------|-----------|---------------|--------|---------------|
| ADS-B x ADS-B (dedup) | 100 m | 9 | 200 m | 400 m | k=0 | 1 |
| ADS-B x AIS | 500 m | 8 | 531 m | 1,062 m | k=1 | 7 |
| ADS-B x RF bearing | 2 km | 7 | 1.41 km | 2.82 km | k=1 | 7 |
| AIS x RF bearing | 2 km | 7 | 1.41 km | 2.82 km | k=1 | 7 |
| ADS-B x Radar | 1 km | 8 | 531 m | 1,062 m | k=1 | 7 |
| WiFi x Bluetooth | 50 m | 10 | 76 m | 152 m | k=1 | 7 |
| OSINT x OSINT | 10 km | 5 | 9.85 km | 19.7 km | k=1 | 7 |
| Radar x Radar (dedup) | 500 m | 8 | 531 m | 1,062 m | k=1 | 7 |
| RF DF x RF DF (cross-fix) | 5 km | 6 | 3.72 km | 7.44 km | k=1 | 7 |
| HTTP x DNS (identity) | N/A | N/A | N/A | N/A | N/A | Identity join |
| Any x OSINT (semantic) | 10 km | 5 | 9.85 km | 19.7 km | k=1 | 7 |

### 3.3 Multi-Resolution Strategy

Some signal pairs benefit from checking at multiple resolutions:

```
COARSE FILTER (resolution 5, ~10 km cells):
  Quickly eliminate pairs that are obviously too far apart.
  Cost: 1 cell lookup per signal.

FINE FILTER (resolution 8, ~530 m cells):
  For pairs that pass the coarse filter, refine to determine
  if they are within the fusion radius.
  Cost: 7 cell lookups (k=1 ring).

EXACT DISTANCE (haversine):
  For pairs that pass the fine filter, compute exact geodesic
  distance to determine true proximity.
  Cost: 1 haversine computation.
```

This three-stage pipeline eliminates 99%+ of candidates at the coarse stage,
reducing haversine computations by 2-3 orders of magnitude.

### 3.4 Resolution Selection Algorithm

```
function selectResolution(fusionRadiusMeters: number): H3Resolution {
  // Target: cell diameter ~= fusion radius
  // Cell diameter = 2 * edge length
  // So target edge length = fusionRadius / 2

  const targetEdge = fusionRadiusMeters / 2

  const edgeLengths = [
    1_281_260, 483_060, 182_510, 68_980, 26_070,  // res 0-4
    9_850, 3_720, 1_410, 531, 200,                  // res 5-9
    76, 29, 11, 4.1, 1.5, 0.58                      // res 10-15
  ]

  // Find the resolution whose edge length is closest
  // to but not larger than the target
  for (let res = 0; res < 16; res++) {
    if (edgeLengths[res] <= targetEdge) {
      return res as H3Resolution
    }
  }
  return 15 // finest resolution
}
```

---

## 4. Bearing Cone to H3 Polyfill Algorithm

### 4.1 The Bearing Cone Problem

RF direction-finding (DF) stations produce bearings, not positions. A bearing
from station S at azimuth theta with beamwidth beta and maximum range r_max
defines a **cone** (sector) on the Earth's surface. To perform spatial joins
with H3, this cone must be converted to a set of H3 cells.

```
BEARING CONE GEOMETRY:

                        r_max
            . . . . . . . . . .
         .                       .
       .    theta + beta/2         .
      .        /                    .
     .        /                      .
    .        /                        .
    .   S---/----> theta (azimuth)    .
    .        \                        .
     .        \                      .
      .        \ theta - beta/2     .
       .                           .
         .                       .
            . . . . . . . . . .

S      = Station position (known)
theta  = Azimuth (degrees from north, clockwise)
beta   = Beamwidth (degrees, typically 5-30)
r_max  = Maximum detection range (meters)
```

### 4.2 Cone to Polygon Conversion

The bearing cone is approximated as a polygon for H3 polyfill:

```
function bearingConeToPolygon(
  station: LatLng,
  azimuthDeg: number,
  beamwidthDeg: number,
  maxRangeMeters: number,
  arcSegments: number = 16
): GeoPolygon {
  const points: LatLng[] = []

  // Start at station
  points.push(station)

  // Generate arc points from (azimuth - beamwidth/2) to (azimuth + beamwidth/2)
  const startBearing = azimuthDeg - beamwidthDeg / 2
  const endBearing = azimuthDeg + beamwidthDeg / 2
  const step = beamwidthDeg / arcSegments

  for (let i = 0; i <= arcSegments; i++) {
    const bearing = startBearing + i * step
    const point = destinationPoint(station, maxRangeMeters, bearing)
    points.push(point)
  }

  // Close polygon back to station
  points.push(station)

  return { vertices: points }
}
```

### 4.3 Polygon to H3 Cell Set

```
function bearingConeToH3Cells(
  station: LatLng,
  azimuthDeg: number,
  beamwidthDeg: number,
  maxRangeMeters: number,
  resolution: H3Resolution
): Set<H3Index> {
  // Step 1: Convert cone to polygon
  const polygon = bearingConeToPolygon(
    station, azimuthDeg, beamwidthDeg, maxRangeMeters
  )

  // Step 2: Use H3 polyfill to get cells contained by polygon
  //   Mode: "intersect" to capture all cells the cone touches
  const containedCells = polygonToCells(polygon, resolution)

  // Step 3: Expand by k=1 ring to account for edge effects
  const expandedCells = new Set<H3Index>()
  for (const cell of containedCells) {
    for (const neighbor of gridDisk(cell, 1)) {
      expandedCells.add(neighbor)
    }
  }

  return expandedCells
}
```

### 4.4 Cell Count Estimates

The number of H3 cells in a bearing cone depends on resolution and cone geometry:

```
Cone area (flat approximation):
  A_cone = pi * r_max^2 * (beta / 360)

Cells in cone:
  N_cells ~= A_cone / cell_area + perimeter_cells
  N_cells ~= pi * r_max^2 * (beta/360) / cell_area
              + 2 * r_max / cell_edge * (1 + beta/360)
```

| Cone Geometry | Res 7 | Res 8 | Res 9 |
|---------------|-------|-------|-------|
| 10 km, 10 deg beamwidth | ~5 cells | ~30 cells | ~200 cells |
| 10 km, 30 deg beamwidth | ~15 cells | ~90 cells | ~600 cells |
| 50 km, 10 deg beamwidth | ~130 cells | ~900 cells | ~6,300 cells |
| 50 km, 30 deg beamwidth | ~400 cells | ~2,700 cells | ~19,000 cells |
| 100 km, 5 deg beamwidth | ~130 cells | ~900 cells | ~6,300 cells |
| 100 km, 30 deg beamwidth | ~1,600 cells | ~11,000 cells | ~77,000 cells |

**Guidance**: For streaming joins with RF bearings, resolution 7 keeps cell sets
manageable (<500 cells) for most tactical scenarios. Resolution 8 is acceptable
for narrow beamwidths. Resolution 9+ should only be used for short-range DF.

### 4.5 Optimized Bearing-to-Cell for Narrow Beamwidths

For narrow beamwidths (< 10 degrees), the polygon-polyfill approach is
unnecessarily expensive. An optimized algorithm traces the center bearing line
and expands laterally:

```
function narrowBeamToH3Cells(
  station: LatLng,
  azimuthDeg: number,
  beamwidthDeg: number,
  maxRangeMeters: number,
  resolution: H3Resolution
): Set<H3Index> {
  const cells = new Set<H3Index>()

  // Trace center line from station to max range
  const stepDistance = edgeLength(resolution) * 0.8  // 80% of cell edge
  const numSteps = Math.ceil(maxRangeMeters / stepDistance)

  for (let i = 0; i <= numSteps; i++) {
    const distance = i * stepDistance
    const centerPoint = destinationPoint(station, distance, azimuthDeg)
    const centerCell = latLngToCell(centerPoint, resolution)

    // Lateral expansion based on beamwidth at this distance
    const lateralWidth = distance * Math.tan(beamwidthDeg * Math.PI / 360)
    const kRings = Math.ceil(lateralWidth / (edgeLength(resolution) * 2))

    for (const cell of gridDisk(centerCell, kRings)) {
      cells.add(cell)
    }
  }

  return cells
}
```

This reduces computation from O(polygon_area / cell_area) to
O(range / cell_edge * k_lateral) — significant savings for long-range
narrow beams.

---

## 5. H3 vs S2 vs Geohash: Comparative Analysis

### 5.1 System Overview

Three major discrete global grid systems compete for geospatial indexing:

| Property | H3 (Uber) | S2 (Google) | Geohash |
|----------|-----------|-------------|---------|
| Cell shape | Hexagon (+ 12 pentagons) | Quadrilateral | Rectangle |
| Projection | Icosahedral gnomonic | Cube face Hilbert | Equirectangular |
| Aperture | ~7 (hex subdivision) | 4 (quad subdivision) | 32 (base-32 string) |
| Levels | 16 (0-15) | 31 (0-30) | Variable (1-12 chars) |
| Index type | 64-bit integer | 64-bit integer | String (base-32) |
| Hierarchy | Approximate containment | Exact containment | Exact containment |
| Neighbor finding | O(1), uniform | O(1), non-uniform | String manipulation |
| Area consistency | High (< 1.6:1 ratio) | Moderate (~2:1 ratio) | Low (~2:1 at equator, worse at poles) |

Source: [Geospatial Indexing Explained](https://benfeifke.com/posts/geospatial-indexing-explained/)
Source: [H3 vs S2 Comparison](https://h3geo.org/docs/comparisons/s2/)

### 5.2 Adjacency and Distance Properties

```
GEOHASH — Z-ORDER CURVE PROBLEM:

  +----+----+----+----+
  | 9p | 9r | 9x | 9z |    Geohash "9q" and "9r" are
  +----+----+----+----+    adjacent, but "9q" and "dr"
  | 9n | 9q | 9w | 9y |    are also adjacent despite
  +----+----+----+----+    having no common prefix.
  | 9j | 9m | 9t | 9v |
  +----+----+----+----+    Boundary effect: points near
  | 6 ..| 9k | 9s | 9u |    cell boundaries may have
  +----+----+----+----+    completely different prefixes.

S2 — HILBERT CURVE:

  Better locality than Geohash (Hilbert curve preserves
  proximity better than Z-order), but still has 8 neighbors
  with non-uniform distances (face/edge/corner adjacency).

H3 — HEXAGONAL GRID:

  6 neighbors, all equidistant. No diagonal ambiguity.
  gridDisk(cell, k) returns a perfect hexagonal ring.
  Grid distance = exact hop count on the hex lattice.
```

### 5.3 Suitability for Streaming Spatial Joins

| Criterion | H3 | S2 | Geohash |
|-----------|-----|-----|---------|
| Join key quality | Excellent — 64-bit int | Excellent — 64-bit int | Poor — string comparison |
| Uniform neighbor distance | Yes (6 equidistant) | No (8 non-uniform) | No (8 non-uniform) |
| Boundary artifacts | Minimal (hex symmetry) | Moderate (quad seams) | Severe (prefix boundaries) |
| Streaming join cost | O(1) per signal, O(7k) per join check | O(1) per signal, O(9k) per join check | O(1) per signal, O(9k) per join check |
| Multi-resolution support | cellToParent/cellToChildren | S2CellId.parent/child | Prefix truncation |
| Area consistency across globe | Best (<1.6:1 max ratio) | Good (~2:1 max ratio) | Worst (>10:1 at poles) |
| Library maturity | High (Uber, OSS) | High (Google, OSS) | High (standard) |

### 5.4 Recommendation for Tsingou

**H3 is the primary spatial index for Tsingou streaming joins.**

Rationale:
1. **Uniform adjacency** eliminates false negatives at cell boundaries
2. **64-bit integer index** is a natural d2ts join key
3. **Hexagonal symmetry** means k-ring expansion covers a circle, not a square
4. **Resolution 7-9** maps directly to fusion ontology radii (200m - 2km)
5. **polygonToCells** handles bearing cone conversion natively

S2 is acceptable as a secondary index for interop with Google-ecosystem tools.
Geohash is NOT recommended due to boundary artifacts and poor polar behavior.

---

## 6. R-tree Family for Continuous Spatial Queries

### 6.1 When R-trees Beat H3

H3 discretizes space. When the query demands exact geometry — "find all signals
within exactly 437.2 meters of this point" — H3 can only approximate. R-trees
operate on continuous bounding boxes and support exact range and nearest-neighbor
queries.

| Query Type | H3 | R-tree | Winner |
|-----------|-----|--------|--------|
| Streaming equi-join | Cell ID match | N/A | H3 |
| Exact range query | Approximate (grid discretization) | Exact (bbox + filter) | R-tree |
| k-nearest neighbor | Not native | Native | R-tree |
| Bulk insert | O(n) cell computation | O(n log n) tree build | H3 |
| Moving objects | Recompute cell on move | Update-in-place | Depends |

Source: [R-tree Wikipedia](https://en.wikipedia.org/wiki/R-tree)
Source: [RBush — JS R-tree](https://github.com/mourner/rbush)

### 6.2 R-tree Structure

```
R-TREE NODE STRUCTURE:

Root MBR: [entire area of interest]
  |
  +-- Internal Node MBR: [northwest quadrant]
  |     |
  |     +-- Leaf: Signal A (point + metadata)
  |     +-- Leaf: Signal B (point + metadata)
  |     +-- Leaf: Signal C (point + metadata)
  |
  +-- Internal Node MBR: [northeast quadrant]
  |     |
  |     +-- Leaf: Signal D (point + metadata)
  |     +-- Leaf: Signal E (point + metadata)
  |
  +-- Internal Node MBR: [south half]
        |
        +-- Leaf: Signal F (bearing cone polygon)
        +-- Leaf: Signal G (point + metadata)

MBR = Minimum Bounding Rectangle
Each leaf = signal with its spatial extent
Each internal node = MBR enclosing all children
```

### 6.3 R-tree Variants

| Variant | Optimization | Use Case |
|---------|-------------|----------|
| R-tree (Guttman 1984) | Original, minimize MBR area | General spatial data |
| R*-tree | Minimize overlap + margin | Better query performance |
| R+ tree | No overlap between nodes | Exact point queries |
| STR (Sort-Tile-Recursive) | Bulk-loading optimization | Static datasets |
| OMT | Overlap-minimizing top-down bulk load | Batch spatial index |

### 6.4 Performance Characteristics

RBush (JavaScript R-tree implementation):

| Operation | Time Complexity | Practical Performance |
|-----------|----------------|----------------------|
| Insert single | O(log n) | ~microseconds |
| Bulk load n items | O(n log n) | 2-3x faster than individual inserts |
| Range query (bbox) | O(log n + k) | 100-1000x faster than brute force |
| k-NN query | O(log n * k) | Near-instant for k < 100 |
| Remove single | O(log n) | ~microseconds |
| Memory | O(n) | ~100 bytes per item |

Post-bulk-load query performance is ~20-30% better than incrementally-built trees
due to better node packing (OMT algorithm with Floyd-Rivest selection).

### 6.5 R-tree in Tsingou

Tsingou uses R-tree as a secondary index for:

1. **Ad-hoc range queries** — "Show all signals within 5 km of this cursor position"
2. **Nearest-neighbor** — "Find the 10 closest ADS-B tracks to this AIS vessel"
3. **Geofence intersection** — "Which signals are inside this user-drawn polygon?"
4. **Bearing cone intersection** — Exact test for point-in-cone after H3 pre-filter

The R-tree is maintained per-collection as signals arrive, with periodic
bulk-rebuild when the tree degrades from heavy updates.

---

## 7. Moving Object Indexing

### 7.1 The Moving Object Problem

Tsingou signals represent moving objects — aircraft, vessels, vehicles. Their
positions change continuously. Standard spatial indexes (H3 cells, R-trees)
assume static positions. Two approaches exist for handling movement:

1. **Re-index on update** — When a signal position updates, recompute its H3 cell
   and update the R-tree entry. Simple but generates index churn.
2. **Predictive indexing** — Index the object's predicted trajectory, avoiding
   re-indexing until the prediction deviates from reality.

### 7.2 TPR-tree (Time-Parameterized R-tree)

The TPR-tree extends R-tree with velocity vectors. Each leaf stores:
```
{
  position: (x, y),      // Position at reference time t_ref
  velocity: (vx, vy),    // Velocity vector
  t_ref: timestamp        // Reference time

  // Position at time t:
  // x(t) = x + vx * (t - t_ref)
  // y(t) = y + vy * (t - t_ref)
}
```

Bounding rectangles are also parameterized:
- Lower bound moves at minimum velocity of enclosed objects
- Upper bound moves at maximum velocity of enclosed objects
- The bounding rectangle expands over time

Source: [TPR*-Tree Paper](https://www.vldb.org/conf/2003/papers/S24P01.pdf)
Source: [Spatio-temporal Access Methods](https://www.cs.purdue.edu/homes/aref/papers/STindex.pdf)

### 7.3 TPR*-tree Improvements

The TPR*-tree optimizes the TPR-tree construction:

| Aspect | TPR-tree | TPR*-tree |
|--------|----------|-----------|
| Insertion | R-tree heuristics (static) | Velocity-aware heuristics |
| MBR expansion | Faster (ignores velocity) | Slower but tighter bounds |
| Query performance | Baseline | 50-90% fewer node accesses |
| Best for | Short horizons | Long horizons |

The **horizon parameter H** controls how far into the future the tree is
optimized. For Tsingou:
- Aircraft (fast, predictable): H = 60 seconds
- Vessels (slow, predictable): H = 300 seconds
- Ground vehicles (medium, less predictable): H = 30 seconds

### 7.4 Practical Approach for Tsingou

Given d2ts differential dataflow, Tsingou uses a hybrid approach:

```
MOVING OBJECT STRATEGY:

1. H3 CELL ASSIGNMENT (primary):
   - Assign H3 cell on each position update
   - Cell changes trigger d2ts difference events
   - Most updates DON'T change the cell (object stays in same hex)
   - Only cell-crossing events propagate to join operators

2. R-TREE UPDATE (secondary):
   - Update R-tree entry on each position update
   - Used for ad-hoc queries, not streaming joins
   - Bulk rebuild every 60 seconds if update rate > 1000/sec

3. CELL CHANGE RATE:
   At resolution 7 (1.41 km edge), an aircraft at 250 m/s crosses
   a cell boundary every ~5.6 seconds. At 10,000 aircraft, that is
   ~1,800 cell-crossing events/second — manageable for d2ts.

   At resolution 8 (531 m edge), crossing every ~2.1 seconds,
   ~4,700 cell-crossings/second — still manageable.
```

---

## 8. Spatial Join Algorithms

### 8.1 Algorithm Taxonomy

| Algorithm | Index Required | Memory | Best For |
|-----------|---------------|--------|----------|
| Nested Loop | None | O(1) | Small datasets |
| Index Nested Loop (INL) | One-sided R-tree | O(n) | One indexed, one streaming |
| Partition-Based Spatial Merge (PBSM) | None (partitions on-the-fly) | O(n+m) | Large, un-indexed datasets |
| Sort-Tile-Recursive (STR) Join | Bulk-loaded R-trees | O(n+m) | Static batch joins |
| Grid-Based (H3) | Grid index | O(n+m) | Streaming equi-join |
| SGrid | Grid partitioning | O(n+m) | Parallel spatial joins |
| TOUCH | Grid + sort | O(n+m) | Adaptive workload |

Source: [Partition Based Spatial Merge Join](https://pages.cs.wisc.edu/~dewitt/includes/paradise/spjoin.pdf)
Source: [Spatial Join Techniques](https://www.cs.umd.edu/~hjs/pubs/jacoxtrjoin07.pdf)

### 8.2 H3-Based Streaming Spatial Join

For d2ts, the spatial join becomes a standard equi-join on H3 cell IDs:

```
STREAMING SPATIAL JOIN via H3:

Input:  Stream A (signals with geo), Stream B (signals with geo)
Config: resolution R, k-ring expansion K

Phase 1: Cell Assignment (per-signal, O(1))
  A' = A.map(signal => {
    const cell = latLngToCell(signal.geo, R)
    const cells = gridDisk(cell, K)
    return cells.map(c => ({ ...signal, h3Cell: c }))
  }).flatten()

  B' = B.map(signal => {
    const cell = latLngToCell(signal.geo, R)
    return { ...signal, h3Cell: cell }
  })

Phase 2: Equi-Join on h3Cell (d2ts native join)
  candidates = d2ts.join(A', B', (a, b) => a.h3Cell === b.h3Cell)

Phase 3: Predicate Evaluation (per-candidate)
  results = candidates.filter(([a, b]) => {
    const dist = haversine(a.geo, b.geo)
    const timeDelta = Math.abs(a.timestamp - b.timestamp)
    return dist < fusionRadius && timeDelta < timeWindow
  })
```

**Key insight**: The k-ring expansion is applied to ONE side of the join only.
Expanding both sides would create duplicate matches. By convention, the
**higher-frequency stream** (typically ADS-B) is expanded, and the
lower-frequency stream (AIS, RF bearing) uses the exact cell.

### 8.3 Performance: PBSM vs H3-Based

| Metric | PBSM | H3 Grid Join |
|--------|------|--------------|
| Setup cost | O(n+m) partition | O(n+m) cell assignment |
| Join cost per signal | O(partition_size) | O(k_ring_size * cell_occupancy) |
| Suitability for streaming | Poor (requires both inputs) | Excellent (incremental) |
| Memory | Full partitions in memory | Cell-to-signal index |
| Latency | Batch (seconds) | Per-event (milliseconds) |

PBSM is 80-100% faster than R-tree joins for batch workloads, but H3-based
joins dominate in streaming scenarios because they are inherently incremental —
each new signal triggers only local computation.

---

## 9. H3 Performance Characteristics

### 9.1 Core Operation Benchmarks

The H3 C library is the reference implementation. JavaScript bindings (h3-js)
use WASM compilation of the C library.

| Operation | C Library | h3-js (WASM) | Notes |
|-----------|----------|--------------|-------|
| latLngToCell | ~50 ns | ~200 ns | Single coordinate to cell |
| cellToLatLng | ~30 ns | ~150 ns | Cell center extraction |
| gridDisk(cell, 1) | ~100 ns | ~500 ns | 7 cells returned |
| gridDisk(cell, 2) | ~200 ns | ~1,000 ns | 19 cells returned |
| polygonToCells (small) | ~1 us | ~5 us | 10-cell polygon |
| polygonToCells (large) | ~100 us | ~500 us | 1000-cell polygon |
| cellToParent | ~10 ns | ~50 ns | Resolution coarsening |
| gridDistance | ~50 ns | ~200 ns | Hex grid hop count |
| compactCells (100) | ~1 us | ~5 us | Compact 100 cells |

Source: [H3 Internal Benchmarks](https://github.com/h3js/h3/issues/449)
Source: [H3.net Benchmarks](https://github.com/pocketken/H3.net/blob/main/docs/benchmarks.md)

### 9.2 Throughput Estimates for Tsingou

```
SCENARIO: 10,000 ADS-B signals/second at resolution 8

Per signal:
  latLngToCell:  200 ns
  gridDisk(k=1): 500 ns
  Total:         700 ns per signal

10,000 signals/sec * 700 ns = 7 ms/sec of H3 computation
  = 0.7% of a single core

SCENARIO: 50 RF bearing sweeps/second, 30-degree beam, 50 km range, res 7

Per sweep:
  bearingConeToPolygon: ~1 us
  polygonToCells:       ~50 us (est. ~400 cells at res 7)
  Total:                ~51 us per sweep

50 sweeps/sec * 51 us = 2.55 ms/sec
  = 0.26% of a single core

TOTAL H3 OVERHEAD: < 1% of a single core for the full signal mix.
```

### 9.3 Memory Requirements

| Data | Size per Entry | 10K entries | 100K entries |
|------|---------------|-------------|--------------|
| H3 cell index | 8 bytes | 80 KB | 800 KB |
| Signal → cell mapping | 16 bytes (id + cell) | 160 KB | 1.6 MB |
| Cell → signal set (avg 5) | 48 bytes (cell + list) | 480 KB | 4.8 MB |
| K-ring expansion cache | 56 bytes (7 cells) | 560 KB | 5.6 MB |

Total spatial index memory for 100K active signals: ~13 MB. Negligible.

---

## 10. Spatial Join Pipeline Architecture

### 10.1 Full Pipeline

```
SPATIAL JOIN PIPELINE — d2ts Integration

                    +-----------------------+
                    |   Signal Ingest       |
                    |   (NATS subjects)     |
                    +----------+------------+
                               |
                    +----------v------------+
                    |   CELL ASSIGNMENT     |
                    |                       |
                    |   For each signal:    |
                    |   1. latLngToCell(R)  |
                    |   2. Attach h3Cell    |
                    |   3. Emit (cell, sig) |
                    +----------+------------+
                               |
              +----------------+----------------+
              |                                 |
    +---------v---------+           +-----------v-----------+
    | POINT SIGNALS     |           | BEARING SIGNALS       |
    | (ADS-B, AIS, etc) |           | (RF DF sweeps)        |
    |                   |           |                       |
    | Single cell per   |           | polyfill cone ->      |
    | signal             |           | multiple cells per    |
    | + k-ring expand   |           | signal                 |
    +--------+----------+           +-----------+-----------+
             |                                  |
             +----------------+-----------------+
                              |
                    +---------v---------+
                    | H3 EQUI-JOIN      |
                    |                   |
                    | d2ts.join on      |
                    | h3Cell equality   |
                    |                   |
                    | Candidates only   |
                    | (same cell)       |
                    +--------+----------+
                             |
                    +--------v----------+
                    | PREDICATE EVAL    |
                    |                   |
                    | haversine check   |
                    | temporal check    |
                    | spectral check    |
                    | behavioral check  |
                    +--------+----------+
                             |
                    +--------v----------+
                    | CONFIDENCE CALC   |
                    |                   |
                    | Weighted score    |
                    | per ontology      |
                    | configuration     |
                    +--------+----------+
                             |
                    +--------v----------+
                    | FUSED DATUM       |
                    |                   |
                    | Output: merge /   |
                    | correlate / enrich|
                    | with confidence   |
                    +-------------------+
```

### 10.2 d2ts Operator Mapping

| Pipeline Stage | d2ts Operator | Incremental? |
|---------------|---------------|-------------|
| Cell assignment | `.map()` | Yes — per-signal |
| K-ring expansion | `.flatMap()` | Yes — per-signal |
| Equi-join | `.join()` on h3Cell | Yes — differential |
| Predicate evaluation | `.filter()` | Yes — per-candidate |
| Confidence calculation | `.map()` | Yes — per-candidate |
| Output classification | `.map()` | Yes — per-result |

The entire pipeline is incrementally maintained by d2ts. When a signal
position updates, only the affected cells recompute. The join operator
retracts the old cell association and asserts the new one.

### 10.3 Multi-Pair Join Orchestration

The fusion ontology may define N enabled join paths. Each join path becomes
an independent d2ts subgraph:

```
                    Signal Ingest
                         |
              +----------+----------+
              |          |          |
         ADS-B(A)    AIS(B)     RF(C)
              |          |          |
         cell(A)    cell(B)    cells(C)
              |          |          |
    +---------+----+-----+----+----+---------+
    |              |          |              |
  join(A,A)    join(A,B)  join(A,C)    join(B,C)
  (dedup)     (spatial)  (spatial+    (spatial+
                          spectral)   spectral)
    |              |          |              |
    +---------+----+-----+----+----+---------+
              |          |          |
         +----v----------v----------v----+
         |      RESULT MERGE             |
         |                               |
         |  Deduplicate across paths     |
         |  Select highest confidence    |
         |  Emit FusedDatum              |
         +-------------------------------+
```

Each join path runs independently. Results from multiple paths for the same
signal pair are merged, keeping the highest-confidence result.

---

# PART II: RI-6 — STIX Relationship Generation from Fusion Events

---

## 11. STIX 2.1 Relationship Objects (SROs)

### 11.1 SRO Overview

STIX 2.1 defines exactly two STIX Relationship Object types:

1. **Relationship** — A generic, typed link between two SDOs or SCOs
2. **Sighting** — A specialized observation record when an entity "sees" an SDO

If SDOs and SCOs are nodes in a graph, SROs are the edges. The fusion engine
produces both: relationships when it merges or correlates signals, and sightings
when it observes indicators in live signal streams.

Source: [STIX 2.1 Specification](https://docs.oasis-open.org/cti/stix/v2.1/cs01/stix-v2.1-cs01.html)
Source: [STIX Walkthrough](https://oasis-open.github.io/cti-documentation/stix/walkthrough.html)

### 11.2 Relationship Object Properties

```json
{
  "type": "relationship",
  "spec_version": "2.1",
  "id": "relationship--<uuid>",
  "created": "<timestamp>",
  "modified": "<timestamp>",
  "relationship_type": "<type-string>",
  "source_ref": "<stix-id>",
  "target_ref": "<stix-id>",
  "description": "<optional text>",
  "start_time": "<optional timestamp>",
  "stop_time": "<optional timestamp>",
  "confidence": <0-100>
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `relationship_type` | string | Yes | Named relationship (e.g., "indicates", "uses") |
| `source_ref` | identifier | Yes | The source of the relationship |
| `target_ref` | identifier | Yes | The target of the relationship |
| `description` | string | No | Human-readable description |
| `start_time` | timestamp | No | When the relationship began |
| `stop_time` | timestamp | No | When the relationship ended |
| `confidence` | integer (0-100) | No | Producer confidence in the assertion |

### 11.3 Standard Relationship Types

STIX 2.1 Appendix B defines a relationship summary table. Key relationship types
relevant to Tsingou fusion:

| Relationship Type | Source | Target | Tsingou Use |
|-------------------|--------|--------|-------------|
| `indicates` | indicator | attack-pattern, campaign, infrastructure, malware, threat-actor, tool | Signal pattern indicates threat |
| `uses` | threat-actor, intrusion-set, campaign | attack-pattern, infrastructure, malware, tool | Actor uses technique |
| `targets` | threat-actor, intrusion-set, campaign | identity, location, vulnerability | Threat targets entity |
| `attributed-to` | threat-actor, intrusion-set, campaign | identity, threat-actor | Attribution chain |
| `based-on` | indicator | observed-data | Indicator derived from observations |
| `related-to` | (any SDO) | (any SDO) | **Generic relationship — primary for fusion** |
| `delivers` | attack-pattern, campaign | malware | Delivery mechanism |
| `located-at` | threat-actor, campaign, observed-data | location | Geographic association |
| `derived-from` | indicator, observed-data | indicator, observed-data | Analytical derivation |
| `duplicate-of` | (any) | (any) | **Identity merge detection** |
| `consists-of` | observed-data, infrastructure | observed-data, infrastructure, tool | Composition |

### 11.4 Custom Relationship Types for Fusion

STIX permits user-defined relationship types. Tsingou defines:

| Custom Type | Source | Target | Meaning |
|-------------|--------|--------|---------|
| `x-tsingou-fused-with` | observed-data | observed-data | Tier 1 identity merge |
| `x-tsingou-correlated-with` | observed-data | observed-data | Tier 2 soft correlation |
| `x-tsingou-enriched-by` | observed-data | observed-data | Enrichment from external source |
| `x-tsingou-co-located-with` | observed-data | observed-data | Spatial co-location (no identity claim) |
| `x-tsingou-temporally-correlated` | observed-data | observed-data | Temporal co-occurrence |
| `x-tsingou-spectrally-matched` | observed-data | observed-data | Spectral/frequency match |
| `x-tsingou-behaviorally-similar` | observed-data | observed-data | Track/behavior correlation |
| `x-tsingou-flagged-discrepancy` | observed-data | observed-data | Identifier mismatch detected |

---

## 12. STIX Sighting Object for Signal Observations

### 12.1 Sighting Properties

The Sighting SRO records when an entity observes something. In Tsingou, a
sighting occurs when a live signal matches a known indicator (e.g., a
frequency/modulation pattern matches a cataloged emitter signature).

```json
{
  "type": "sighting",
  "spec_version": "2.1",
  "id": "sighting--<uuid>",
  "created": "<timestamp>",
  "modified": "<timestamp>",
  "sighting_of_ref": "<stix-id>",
  "observed_data_refs": ["<stix-id>", ...],
  "where_sighted_refs": ["<stix-id>", ...],
  "first_seen": "<timestamp>",
  "last_seen": "<timestamp>",
  "count": <integer>,
  "confidence": <0-100>
}
```

Source: [STIX 2.1 Sighting of Observed Data](https://oasis-open.github.io/cti-documentation/examples/sighting-of-observed-data.html)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `sighting_of_ref` | identifier | Yes | What was sighted (indicator, malware, etc.) |
| `observed_data_refs` | list of identifiers | No | The raw observations that constitute the sighting |
| `where_sighted_refs` | list of identifiers | No | Identity/location of the observer |
| `first_seen` | timestamp | No | When first observed |
| `last_seen` | timestamp | No | When last observed |
| `count` | integer | No | Number of times sighted |
| `confidence` | integer (0-100) | No | Producer confidence |

### 12.2 Sighting vs Relationship

| Aspect | Relationship | Sighting |
|--------|-------------|----------|
| Purpose | General typed link | Observation record |
| Has count | No | Yes |
| Has where_sighted | No | Yes |
| Has observed_data_refs | No | Yes |
| Source/Target | source_ref / target_ref | sighting_of_ref / observed_data_refs |
| When to use | Linking intelligence concepts | Recording when intelligence was observed in the wild |

### 12.3 Tsingou Sighting Generation

Sightings are generated when:

1. **Indicator match** — A d2ts anomaly detection rule fires and the matching
   pattern corresponds to a STIX indicator in the threat intel database
2. **Known emitter detection** — RF signature matches a cataloged emitter
3. **IOC match** — Network signal contains an indicator of compromise (IP, domain,
   hash) that matches a known indicator
4. **Repeated observation** — Same indicator observed multiple times, incrementing
   the sighting count

```
SIGHTING GENERATION PIPELINE:

  Live Signal ──> Pattern Match ──> Indicator DB Lookup
                                          |
                                    Match found?
                                    /          \
                                 Yes            No
                                  |              |
                          Create Sighting    (no action)
                                  |
                          Attach observed-data refs
                          Set where_sighted to sensor identity
                          Set confidence from match quality
                          Publish to STIX bundle stream
```

---

## 13. Provenance Chains in STIX

### 13.1 The Provenance Problem

When the fusion engine produces a correlation with confidence 0.78, an analyst
needs to trace: "Why 0.78? Which signals contributed? What predicates matched?
What was the raw evidence?"

STIX supports provenance through three mechanisms:

1. **object_refs** in observed-data — Links to the raw SCOs (observables)
2. **derived-from** relationship — Links derived intelligence to source material
3. **created_by_ref** — Attributes the intelligence to a producing identity

### 13.2 Provenance Chain Architecture

```
PROVENANCE CHAIN: Fusion Event -> Contributing Signals -> Raw Observables

Layer 3: FUSION RESULT
  +------------------------------------------+
  | relationship (x-tsingou-correlated-with)  |
  | confidence: 78                            |
  | source_ref: observed-data--A              |
  | target_ref: observed-data--B              |
  | created_by_ref: identity--tsingou-engine  |
  +------------------------------------------+
         |                    |
    derived-from          derived-from
         |                    |
Layer 2: SIGNAL OBSERVATIONS
  +--------------------+  +--------------------+
  | observed-data--A   |  | observed-data--B   |
  | (ADS-B signal)     |  | (AIS signal)       |
  | object_refs: [     |  | object_refs: [     |
  |   ipv4-addr--...,  |  |   network-traffic--|
  |   x-tsingou-sdr--  |  |   x-tsingou-ais--  |
  | ]                  |  | ]                  |
  +--------------------+  +--------------------+
         |                    |
    object_refs           object_refs
         |                    |
Layer 3: RAW OBSERVABLES (SCOs)
  +------------------+  +------------------+
  | x-tsingou-adsb   |  | x-tsingou-ais    |
  | icao: "A4F2B7"   |  | mmsi: 211900000  |
  | lat: 33.748      |  | lat: 33.751      |
  | lon: -84.388     |  | lon: -84.391     |
  | alt: 0           |  | sog: 0           |
  +------------------+  +------------------+
```

### 13.3 Provenance Metadata Extension

Tsingou attaches fusion provenance via a custom STIX extension on
relationship objects:

```json
{
  "extensions": {
    "extension-definition--<tsingou-fusion-provenance>": {
      "extension_type": "property-extension",
      "x_tsingou_fusion_tier": 2,
      "x_tsingou_predicates_matched": [
        {
          "predicate": "spatial_proximity",
          "score": 0.85,
          "weight": 0.35,
          "detail": "haversine=380m, threshold=500m"
        },
        {
          "predicate": "temporal_proximity",
          "score": 0.92,
          "weight": 0.25,
          "detail": "dt=12s, threshold=60s"
        }
      ],
      "x_tsingou_weighted_confidence": 0.78,
      "x_tsingou_ontology_version": "v1.2",
      "x_tsingou_join_path_id": "pair-3-adsb-ais"
    }
  }
}
```

---

## 14. STIX Confidence Mapping

### 14.1 STIX Confidence Scale

STIX 2.1 defines confidence as an integer 0-100. Appendix A provides normative
mappings to five external confidence scales:

| STIX Value | None/Low/Med/High | Admiralty Credibility | WEP | DNI Scale |
|-----------|-------------------|---------------------|-----|-----------|
| 0 | None | 6 - Truth cannot be judged | — | — |
| 1-19 | Low | 5 - Improbable | Almost no chance | Remote |
| 20-39 | Low | 4 - Doubtful | Very unlikely / Unlikely | Improbable / Very unlikely |
| 40-59 | Medium | 3 - Possibly true | Roughly even chance | Roughly even |
| 60-79 | High | 2 - Probably true | Likely / Very likely | Probable / Very likely |
| 80-100 | High | 1 - Confirmed | Almost certain(ly) | Almost certain |

Source: [STIX 2.1 Confidence Scales](https://stix2.readthedocs.io/en/latest/api/confidence/stix2.confidence.scales.html)
Source: [STIX 2.1 Appendix A](https://docs.oasis-open.org/cti/stix/v2.1/cs01/stix-v2.1-cs01.html)

### 14.2 Mapping Tsingou Fusion Confidence to STIX

The fusion ontology produces confidence values in [0.0, 1.0]. The mapping
to STIX [0, 100] is:

```typescript
function fusionConfidenceToStix(fusionConfidence: number): number {
  // Direct linear mapping: [0.0, 1.0] -> [0, 100]
  return Math.round(fusionConfidence * 100)
}
```

**However**, the mapping is NOT purely mechanical. The STIX confidence field
represents the **producer's confidence in the correctness of the assertion**,
not just the match score. Additional factors:

| Factor | Effect on STIX Confidence |
|--------|--------------------------|
| Fusion tier 1 (identity) | Always 100 (hard key match) |
| Fusion tier 2 (soft key) | `round(weighted_score * 100)` |
| Fusion tier 3 (derived) | Capped at 60 (requires human validation) |
| Source reliability | Multiplied by source credibility factor |
| Sensor quality | Reduced for degraded sensors |
| Known spoofing environment | Reduced by spoofing probability |

### 14.3 Confidence Assignment Rules

```
CONFIDENCE ASSIGNMENT:

Tier 1 (Hard Key):
  STIX confidence = 100
  Admiralty: "Confirmed"
  DNI: "Almost certain"

Tier 2 (Soft Key):
  base = round(weighted_score * 100)
  adjusted = base * source_reliability * sensor_quality
  STIX confidence = clamp(adjusted, 1, 95)
  Note: NEVER 100 for soft keys — that would assert identity certainty

Tier 3 (Derived):
  base = round(statistical_confidence * 100)
  STIX confidence = clamp(base, 1, 60)
  Note: Capped at 60 ("Possibly true") — requires analyst validation

Sightings:
  STIX confidence = indicator_match_quality * 100
  Exact IOC match: 95 (not 100 — could be false flag)
  Pattern match: 50-80 depending on pattern specificity
  Behavioral match: 30-60 depending on baseline deviation
```

---

## 15. Custom STIX Extensions for Fusion Metadata

### 15.1 Extension Definition Registration

STIX 2.1 uses `extension-definition` objects to formally register custom
extensions. Tsingou registers three extension definitions:

Source: [Creating Custom STIX Objects](https://www.dogesec.com/blog/create_custom_stix_objects/)
Source: [STIX Extensions](https://stix2.readthedocs.io/en/latest/guide/extensions.html)

```json
{
  "type": "extension-definition",
  "spec_version": "2.1",
  "id": "extension-definition--a1b2c3d4-tsingou-signal-ext",
  "created": "2026-01-01T00:00:00.000Z",
  "modified": "2026-01-01T00:00:00.000Z",
  "created_by_ref": "identity--tsingou-platform",
  "name": "Tsingou Signal Extension",
  "description": "Extends observed-data with Tsingou BaseSignal metadata",
  "schema": "https://tsingou.example.com/schemas/signal-ext-v1.json",
  "version": "1.0.0",
  "extension_types": ["property-extension"]
}
```

### 15.2 Extension Definitions

| Extension ID | Name | Extends | Purpose |
|-------------|------|---------|---------|
| `extension-definition--...-signal-ext` | Tsingou Signal Extension | `observed-data` | BaseSignal metadata (kind, version, source_id) |
| `extension-definition--...-fusion-ext` | Tsingou Fusion Extension | `relationship` | Fusion provenance (tier, predicates, scores) |
| `extension-definition--...-sensor-ext` | Tsingou Sensor Extension | `identity` | Sensor metadata (type, location, capabilities) |

### 15.3 Signal Extension Properties

Applied to `observed-data` objects generated from BaseSignals:

| Property | Type | Description |
|----------|------|-------------|
| `x_tsingou_signal_id` | string | BaseSignal unique identifier |
| `x_tsingou_source_id` | string | Adapter/source identifier |
| `x_tsingou_kind` | string | Signal kind (sdr, http, rss, ais, adsb) |
| `x_tsingou_version` | [integer, integer] | d2ts version pair [time, diff] |
| `x_tsingou_ingested_at` | timestamp | When signal entered the pipeline |
| `x_tsingou_nats_subject` | string | NATS subject the signal arrived on |

### 15.4 Fusion Extension Properties

Applied to `relationship` objects generated by the fusion engine:

| Property | Type | Description |
|----------|------|-------------|
| `x_tsingou_fusion_tier` | integer (1-3) | Fusion tier that produced this relationship |
| `x_tsingou_join_path_id` | string | Ontology join path that fired |
| `x_tsingou_ontology_version` | string | Version of the fusion ontology config |
| `x_tsingou_predicates_matched` | list | Predicate scores (see 13.3) |
| `x_tsingou_weighted_confidence` | number | Raw weighted score [0.0, 1.0] |
| `x_tsingou_h3_cell` | string | H3 cell where the join occurred |
| `x_tsingou_h3_resolution` | integer | H3 resolution used for the join |
| `x_tsingou_haversine_distance_m` | number | Exact distance between signals (meters) |
| `x_tsingou_temporal_delta_s` | number | Time delta between signals (seconds) |

---

## 16. STIX Bundle Assembly from Fusion Events

### 16.1 Bundle Structure

A STIX Bundle groups related objects for transport. When the fusion engine
produces a result, it assembles a bundle containing:

```json
{
  "type": "bundle",
  "id": "bundle--<uuid>",
  "objects": [
    // 1. Producer identity (Tsingou platform)
    { "type": "identity", ... },

    // 2. Extension definitions (if not previously shared)
    { "type": "extension-definition", ... },

    // 3. Raw observables (SCOs) from contributing signals
    { "type": "network-traffic", ... },
    { "type": "x-tsingou-adsb-observation", ... },
    { "type": "x-tsingou-ais-observation", ... },

    // 4. Observed-data containers for each signal
    { "type": "observed-data", ... },
    { "type": "observed-data", ... },

    // 5. The fusion relationship
    { "type": "relationship", ... },

    // 6. Location objects (if geospatial)
    { "type": "location", ... },

    // 7. Marking definitions (TLP, confidence)
    { "type": "marking-definition", ... }
  ]
}
```

Source: [STIX Bundle Documentation](https://oasis-open.github.io/cti-documentation/stix/intro.html)

### 16.2 Bundle Assembly Rules

| Rule | Rationale |
|------|-----------|
| Every bundle MUST include the producer identity | STIX requires created_by_ref to resolve |
| Extension definitions included on first use only | Reduces bundle size for repeated exports |
| SCOs MUST be included if referenced by observed-data | Bundle must be self-contained |
| Marking definitions MUST be included if referenced | TLP markings must be resolvable |
| One relationship per fusion event | Clear 1:1 mapping from fusion to STIX |
| Grouping object for multi-signal correlations | When >2 signals participate in a fusion |

### 16.3 Bundle Size Estimates

| Fusion Type | Objects in Bundle | Estimated JSON Size |
|-------------|-------------------|---------------------|
| Tier 1 merge (2 signals) | ~8 (id, 2 ext, 2 sco, 2 obs, 1 rel) | ~3 KB |
| Tier 2 correlate (2 signals) | ~9 (+ location) | ~4 KB |
| Tier 2 correlate (5 signals) | ~18 (+ grouping + locations) | ~10 KB |
| Sighting (indicator match) | ~6 (id, ext, sco, obs, sighting, indicator) | ~3 KB |
| Tier 3 derived (10 signals) | ~35 (+ multiple groupings) | ~20 KB |

---

## 17. Automatic Relationship Inference

### 17.1 Inference Rules

The fusion engine automatically generates STIX relationships based on fusion
output types defined in the ontology (TSGC-001 Section 9):

| Fusion Output | STIX Relationship Type | Confidence Range |
|---------------|----------------------|------------------|
| Merge | `duplicate-of` | 90-100 |
| Correlate (spatial) | `x-tsingou-co-located-with` | 65-89 |
| Correlate (temporal) | `x-tsingou-temporally-correlated` | 65-89 |
| Correlate (spectral) | `x-tsingou-spectrally-matched` | 65-89 |
| Correlate (behavioral) | `x-tsingou-behaviorally-similar` | 65-89 |
| Correlate (semantic) | `related-to` | 65-89 |
| Enrich | `derived-from` | 80-100 |
| Flag | `x-tsingou-flagged-discrepancy` | variable |

### 17.2 Co-location Inference

When two signals from different entity classes are spatially proximate:

```
IF:
  signal_A.entityClass != signal_B.entityClass
  AND haversine(A.geo, B.geo) < co_location_radius
  AND |A.timestamp - B.timestamp| < temporal_window

THEN:
  Generate relationship:
    type: "x-tsingou-co-located-with"
    source_ref: observed-data for signal_A
    target_ref: observed-data for signal_B
    confidence: f(distance, time_delta, entity_classes)

  Generate location:
    type: "location"
    latitude: midpoint(A.geo, B.geo).lat
    longitude: midpoint(A.geo, B.geo).lon
    precision: haversine(A.geo, B.geo)
```

### 17.3 Co-occurrence Inference

When multiple signals from independent sources mention the same indicator:

```
IF:
  signal_A.source != signal_B.source  (independent sources)
  AND intersect(A.indicators, B.indicators).size > 0
  AND |A.timestamp - B.timestamp| < co_occurrence_window

THEN:
  For each shared indicator:
    Generate relationship:
      type: "related-to"
      source_ref: observed-data for signal_A
      target_ref: observed-data for signal_B
      confidence: f(jaccard, source_reliability, indicator_specificity)
```

### 17.4 Shared Infrastructure Inference

When network signals resolve to common infrastructure:

```
IF:
  signal_A resolves to IP_X
  AND signal_B resolves to IP_X
  AND IP_X is in threat intel as infrastructure

THEN:
  Generate relationship:
    type: "uses"
    source_ref: grouping of (observed-data A, observed-data B)
    target_ref: infrastructure object for IP_X
    confidence: f(resolution_confidence, intel_source_reliability)
```

---

## 18. TAXII 2.1 Publishing Pipeline

### 18.1 TAXII 2.1 Overview

TAXII (Trusted Automated eXchange of Indicator Information) is the transport
protocol for STIX. TAXII 2.1 defines a RESTful API over HTTPS for exchanging
STIX 2.1 content between producers and consumers.

Source: [TAXII 2.1 Specification](https://docs.oasis-open.org/cti/taxii/v2.1/os/taxii-v2.1-os.html)
Source: [TAXII Introduction](https://oasis-open.github.io/cti-documentation/taxii/intro.html)

### 18.2 TAXII Architecture

```
TAXII 2.1 ARCHITECTURE:

  +------------------+          +-------------------+
  | TAXII Client     |  HTTPS   | TAXII Server      |
  | (Tsingou)        |<-------->| (Collection Hub)  |
  |                  |          |                   |
  | POST /objects    |   --->   | API Root          |
  | GET /objects     |   <---   |  +-- Collection A |
  | GET /manifest    |   <---   |  +-- Collection B |
  | DELETE /objects   |   --->   |  +-- Collection C |
  +------------------+          +-------------------+

  API Root URL:  https://taxii.example.com/api/v21/
  Discovery:     https://taxii.example.com/taxii2/
```

### 18.3 TAXII Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/taxii2/` | GET | Server discovery |
| `/{api-root}/` | GET | API root information |
| `/{api-root}/collections/` | GET | List available collections |
| `/{api-root}/collections/{id}/` | GET | Collection details |
| `/{api-root}/collections/{id}/objects/` | GET | Retrieve STIX objects |
| `/{api-root}/collections/{id}/objects/` | POST | **Publish STIX objects** |
| `/{api-root}/collections/{id}/manifest/` | GET | Object manifest (IDs + dates) |

### 18.4 Publishing Flow

```
TSINGOU -> TAXII PUBLISHING:

  Fusion Engine
       |
       | FusedDatum event
       v
  STIX Bundle Assembly (Section 16)
       |
       | Bundle JSON
       v
  TAXII Client Service
       |
       | POST /collections/{fusion-collection}/objects/
       | Content-Type: application/stix+json;version=2.1
       | Accept: application/stix+json;version=2.1
       v
  TAXII Server
       |
       | Status: 202 Accepted
       | Response: { "id": "<status-id>", "status": "pending" }
       v
  (Async processing)
       |
       | GET /status/{status-id}
       | Response: { "status": "complete", "success_count": N }
```

### 18.5 Tsingou TAXII Collections

| Collection | Content | Update Rate |
|-----------|---------|-------------|
| `tsingou-fusion-tier1` | Hard-key merges (identity joins) | Per merge event |
| `tsingou-fusion-tier2` | Soft-key correlations | Per correlation event |
| `tsingou-sightings` | Indicator sightings | Per sighting event |
| `tsingou-indicators` | Tsingou-generated detection patterns | Hourly batch |
| `tsingou-observed-data` | Raw signal observations | Configurable (batch/stream) |

### 18.6 Envelope Format

TAXII 2.1 uses an envelope wrapper (not raw bundles) for POST requests:

```json
{
  "objects": [
    { "type": "observed-data", "id": "observed-data--...", ... },
    { "type": "relationship", "id": "relationship--...", ... },
    { "type": "sighting", "id": "sighting--...", ... }
  ]
}
```

Note: The envelope is distinct from a STIX Bundle. The envelope has `objects`
at the top level. A bundle has `type: "bundle"` and `id`. TAXII 2.1 uses
envelopes for transport; bundles are for packaging/archival.

---

## 19. SRO Templates for Fusion Output Types

### 19.1 Template: Merge (Tier 1 — Identity Join)

When two signals share a hard key (same ICAO, same MMSI, same IP):

```json
{
  "type": "relationship",
  "spec_version": "2.1",
  "id": "relationship--<deterministic-uuid>",
  "created": "2026-02-19T10:30:00.000Z",
  "modified": "2026-02-19T10:30:00.000Z",
  "created_by_ref": "identity--tsingou-platform",
  "relationship_type": "duplicate-of",
  "source_ref": "observed-data--signal-A",
  "target_ref": "observed-data--signal-B",
  "confidence": 100,
  "start_time": "2026-02-19T10:29:45.000Z",
  "description": "Identity merge: shared ICAO hex A4F2B7",
  "object_marking_refs": ["marking-definition--tlp-green"],
  "extensions": {
    "extension-definition--tsingou-fusion-ext": {
      "extension_type": "property-extension",
      "x_tsingou_fusion_tier": 1,
      "x_tsingou_join_path_id": "pair-1-adsb-adsb-dedup",
      "x_tsingou_predicates_matched": [
        {
          "predicate": "identity_key",
          "score": 1.0,
          "weight": 1.0,
          "detail": "icao_hex=A4F2B7"
        }
      ],
      "x_tsingou_weighted_confidence": 1.0,
      "x_tsingou_ontology_version": "v1.2"
    }
  }
}
```

### 19.2 Template: Correlate (Tier 2 — Spatial + Temporal)

When two signals from different entity classes are spatially and temporally
co-located:

```json
{
  "type": "relationship",
  "spec_version": "2.1",
  "id": "relationship--<deterministic-uuid>",
  "created": "2026-02-19T10:30:00.000Z",
  "modified": "2026-02-19T10:30:00.000Z",
  "created_by_ref": "identity--tsingou-platform",
  "relationship_type": "x-tsingou-co-located-with",
  "source_ref": "observed-data--adsb-signal",
  "target_ref": "observed-data--ais-signal",
  "confidence": 78,
  "start_time": "2026-02-19T10:29:30.000Z",
  "stop_time": "2026-02-19T10:30:30.000Z",
  "description": "Spatial co-location: ADS-B aircraft near AIS vessel, 380m apart",
  "object_marking_refs": ["marking-definition--tlp-amber"],
  "extensions": {
    "extension-definition--tsingou-fusion-ext": {
      "extension_type": "property-extension",
      "x_tsingou_fusion_tier": 2,
      "x_tsingou_join_path_id": "pair-3-adsb-ais",
      "x_tsingou_predicates_matched": [
        {
          "predicate": "spatial_proximity",
          "score": 0.85,
          "weight": 0.35,
          "detail": "haversine=380m, threshold=500m"
        },
        {
          "predicate": "temporal_proximity",
          "score": 0.92,
          "weight": 0.25,
          "detail": "dt=12s, threshold=60s"
        },
        {
          "predicate": "altitude_constraint",
          "score": 1.0,
          "weight": 0.15,
          "detail": "alt=0ft, threshold=100ft"
        }
      ],
      "x_tsingou_weighted_confidence": 0.78,
      "x_tsingou_h3_cell": "871fb4e65ffffff",
      "x_tsingou_h3_resolution": 7,
      "x_tsingou_haversine_distance_m": 380.2,
      "x_tsingou_temporal_delta_s": 12.3,
      "x_tsingou_ontology_version": "v1.2"
    }
  }
}
```

### 19.3 Template: Enrich (Lookup Enrichment)

When a signal is enriched with data from an external registry:

```json
{
  "type": "relationship",
  "spec_version": "2.1",
  "id": "relationship--<deterministic-uuid>",
  "created": "2026-02-19T10:30:00.000Z",
  "modified": "2026-02-19T10:30:00.000Z",
  "created_by_ref": "identity--tsingou-platform",
  "relationship_type": "derived-from",
  "source_ref": "observed-data--enriched-signal",
  "target_ref": "observed-data--raw-signal",
  "confidence": 100,
  "description": "Enrichment: ICAO A4F2B7 resolved to N12345, Delta Air Lines",
  "extensions": {
    "extension-definition--tsingou-fusion-ext": {
      "extension_type": "property-extension",
      "x_tsingou_fusion_tier": 1,
      "x_tsingou_join_path_id": "pair-2-adsb-faa",
      "x_tsingou_predicates_matched": [
        {
          "predicate": "registry_lookup",
          "score": 1.0,
          "weight": 1.0,
          "detail": "faa_registry: A4F2B7 -> N12345"
        }
      ],
      "x_tsingou_weighted_confidence": 1.0,
      "x_tsingou_ontology_version": "v1.2"
    }
  }
}
```

### 19.4 Template: Flag (Identifier Discrepancy)

When the fusion engine detects an identifier mismatch:

```json
{
  "type": "relationship",
  "spec_version": "2.1",
  "id": "relationship--<deterministic-uuid>",
  "created": "2026-02-19T10:30:00.000Z",
  "modified": "2026-02-19T10:30:00.000Z",
  "created_by_ref": "identity--tsingou-platform",
  "relationship_type": "x-tsingou-flagged-discrepancy",
  "source_ref": "observed-data--signal-with-mmsi-211900000",
  "target_ref": "observed-data--intel-db-mmsi-211900001",
  "confidence": 45,
  "description": "MMSI discrepancy: observed 211900000, expected 211900001. Assessment: probable_typo (Levenshtein=1)",
  "extensions": {
    "extension-definition--tsingou-fusion-ext": {
      "extension_type": "property-extension",
      "x_tsingou_fusion_tier": 2,
      "x_tsingou_join_path_id": "identity-resolver-ais",
      "x_tsingou_predicates_matched": [
        {
          "predicate": "fuzzy_identity",
          "score": 0.92,
          "weight": 0.5,
          "detail": "levenshtein(211900000, 211900001)=1"
        },
        {
          "predicate": "spatial_proximity",
          "score": 0.65,
          "weight": 0.3,
          "detail": "haversine=1200m, expected_berth"
        }
      ],
      "x_tsingou_weighted_confidence": 0.45,
      "x_tsingou_discrepancy": {
        "field": "mmsi",
        "observed": "211900000",
        "expected": "211900001",
        "assessment": "probable_typo"
      },
      "x_tsingou_ontology_version": "v1.2"
    }
  }
}
```

---

## 20. Effect Schema Codecs for STIX Generation

### 20.1 Schema Architecture

The STIX generation pipeline uses Effect Schema for:
1. **Validation** — Ensuring generated STIX objects are spec-compliant
2. **Transformation** — Converting FusedDatum to STIX Relationship
3. **Serialization** — JSON encoding with deterministic output

### 20.2 Core STIX Schemas

```typescript
import { Schema } from "effect"

// STIX Common Properties
const StixCommonProps = Schema.Struct({
  type: Schema.String,
  spec_version: Schema.Literal("2.1"),
  id: Schema.String.pipe(
    Schema.pattern(/^[a-z][a-z0-9-]+--[0-9a-f-]{36}$/)
  ),
  created: Schema.String,  // ISO 8601
  modified: Schema.String,
  created_by_ref: Schema.optional(Schema.String),
  confidence: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.between(0, 100))
  ),
  object_marking_refs: Schema.optional(Schema.Array(Schema.String)),
})

// STIX Relationship
const StixRelationship = Schema.Struct({
  ...StixCommonProps.fields,
  type: Schema.Literal("relationship"),
  relationship_type: Schema.String,
  source_ref: Schema.String,
  target_ref: Schema.String,
  description: Schema.optional(Schema.String),
  start_time: Schema.optional(Schema.String),
  stop_time: Schema.optional(Schema.String),
  extensions: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  })),
})

// STIX Sighting
const StixSighting = Schema.Struct({
  ...StixCommonProps.fields,
  type: Schema.Literal("sighting"),
  sighting_of_ref: Schema.String,
  observed_data_refs: Schema.optional(Schema.Array(Schema.String)),
  where_sighted_refs: Schema.optional(Schema.Array(Schema.String)),
  first_seen: Schema.optional(Schema.String),
  last_seen: Schema.optional(Schema.String),
  count: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
})

// STIX Bundle
const StixBundle = Schema.Struct({
  type: Schema.Literal("bundle"),
  id: Schema.String,
  objects: Schema.Array(Schema.Unknown),
})
```

### 20.3 Fusion-to-STIX Transform Schema

```typescript
// Tsingou Fusion Extension
const TsingouFusionExtension = Schema.Struct({
  extension_type: Schema.Literal("property-extension"),
  x_tsingou_fusion_tier: Schema.Literal(1, 2, 3),
  x_tsingou_join_path_id: Schema.String,
  x_tsingou_ontology_version: Schema.String,
  x_tsingou_predicates_matched: Schema.Array(Schema.Struct({
    predicate: Schema.String,
    score: Schema.Number.pipe(Schema.between(0, 1)),
    weight: Schema.Number.pipe(Schema.between(0, 1)),
    detail: Schema.String,
  })),
  x_tsingou_weighted_confidence: Schema.Number.pipe(Schema.between(0, 1)),
  x_tsingou_h3_cell: Schema.optional(Schema.String),
  x_tsingou_h3_resolution: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.between(0, 15))
  ),
  x_tsingou_haversine_distance_m: Schema.optional(Schema.Number),
  x_tsingou_temporal_delta_s: Schema.optional(Schema.Number),
})

// Transform: FusedDatum -> StixRelationship
const FusedDatumToStixRelationship = Schema.transform(
  FusedDatum,   // from internal format
  StixRelationship,  // to STIX format
  {
    decode: (fusedDatum) => ({
      type: "relationship" as const,
      spec_version: "2.1" as const,
      id: `relationship--${deterministicUuid(fusedDatum)}`,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      created_by_ref: TSINGOU_IDENTITY_ID,
      relationship_type: mapFusionOutputToRelType(fusedDatum.outputType),
      source_ref: fusedDatum.contributing[0].stixId,
      target_ref: fusedDatum.contributing[1].stixId,
      confidence: fusionConfidenceToStix(fusedDatum.confidence),
      description: generateDescription(fusedDatum),
      start_time: fusedDatum.timeWindow?.start,
      stop_time: fusedDatum.timeWindow?.end,
      extensions: {
        [TSINGOU_FUSION_EXT_ID]: buildFusionExtension(fusedDatum)
      }
    }),
    encode: (stixRel) => parseStixRelToFusedDatum(stixRel),
  }
)
```

### 20.4 Relationship Type Mapping

```typescript
function mapFusionOutputToRelType(
  outputType: "merge" | "correlate" | "enrich" | "flag"
): string {
  switch (outputType) {
    case "merge":     return "duplicate-of"
    case "correlate": return "x-tsingou-correlated-with"
    case "enrich":    return "derived-from"
    case "flag":      return "x-tsingou-flagged-discrepancy"
  }
}
```

### 20.5 Deterministic UUID Generation

STIX IDs must be deterministic for the same fusion event to enable
deduplication across multiple exports:

```typescript
import { createHash } from "crypto"

function deterministicUuid(fusedDatum: FusedDatum): string {
  // Input: sorted contributing signal IDs + join path + timestamp
  const input = [
    ...fusedDatum.contributing.map(s => s.id).sort(),
    fusedDatum.joinPathId,
    fusedDatum.timestamp,
  ].join("|")

  const hash = createHash("sha256").update(input).digest("hex")

  // Format as UUIDv5-compatible
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "5" + hash.slice(13, 16),  // version 5
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80)
      .toString(16) + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join("-")
}
```

---

## 21. STIX Generation Pipeline Architecture

### 21.1 Full Pipeline

```
STIX GENERATION PIPELINE:

  d2ts Fusion Engine
       |
       | FusedDatum stream
       v
  +--------------------+
  | STIX TRANSFORMER   |
  |                    |
  | 1. Classify output |
  |    (merge/corr/    |
  |     enrich/flag)   |
  |                    |
  | 2. Generate SCOs   |
  |    from signals    |
  |                    |
  | 3. Generate        |
  |    observed-data   |
  |    containers      |
  |                    |
  | 4. Generate SRO    |
  |    (relationship   |
  |     or sighting)   |
  |                    |
  | 5. Attach          |
  |    provenance      |
  |    extension       |
  |                    |
  | 6. Compute STIX    |
  |    confidence      |
  +--------+-----------+
           |
           | StixObject stream
           v
  +--------+-----------+
  | BUNDLE ASSEMBLER   |
  |                    |
  | Collect related    |
  | objects into       |
  | bundles.           |
  |                    |
  | Strategies:        |
  | - Per-event bundle |
  | - Timed batch      |
  |   (every N secs)   |
  | - Size-based batch |
  |   (every N objects) |
  +--------+-----------+
           |
           | StixBundle stream
           v
  +--------+-----------+       +-------------------+
  | PUBLISHING ROUTER  |       | TAXII Server      |
  |                    |       | (external)        |
  | Route to:          |------>|                   |
  | - TAXII collection |       +-------------------+
  | - NATS subject     |
  | - File export      |------>  /export/stix/
  | - Event log        |
  +--------------------+------>  tsingou.stix.bundle.*
```

### 21.2 Service Model

```typescript
interface StixGenerationService {
  // Transform single fusion event to STIX objects
  readonly transformFusionEvent: (
    event: FusedDatum
  ) => Effect<ReadonlyArray<StixObject>, StixGenerationError>

  // Transform sighting event
  readonly transformSighting: (
    signal: BaseSignal,
    indicator: StixIndicator
  ) => Effect<ReadonlyArray<StixObject>, StixGenerationError>

  // Assemble objects into a bundle
  readonly assembleBundle: (
    objects: ReadonlyArray<StixObject>
  ) => Effect<StixBundle, StixGenerationError>

  // Publish bundle to configured destinations
  readonly publishBundle: (
    bundle: StixBundle,
    destinations: ReadonlyArray<PublishDestination>
  ) => Effect<PublishResult, StixPublishError>

  // Streaming pipeline: fusion events -> STIX bundles
  readonly pipeline: (
    fusionStream: Stream<FusedDatum>,
    config: StixPipelineConfig
  ) => Stream<StixBundle>
}
```

### 21.3 Pipeline Configuration

```typescript
const StixPipelineConfig = Schema.Struct({
  // Bundle assembly strategy
  bundleStrategy: Schema.Literal("per-event", "timed-batch", "size-batch"),

  // For timed-batch: flush interval in seconds
  batchIntervalSeconds: Schema.optional(
    Schema.Number.pipe(Schema.positive())
  ),

  // For size-batch: max objects per bundle
  batchSizeLimit: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.positive())
  ),

  // Publishing destinations
  destinations: Schema.Array(Schema.Union(
    Schema.Struct({
      type: Schema.Literal("taxii"),
      apiRoot: Schema.String,
      collectionId: Schema.String,
      auth: Schema.Struct({
        type: Schema.Literal("basic", "bearer"),
        credentials: Schema.String,
      }),
    }),
    Schema.Struct({
      type: Schema.Literal("nats"),
      subject: Schema.String,
    }),
    Schema.Struct({
      type: Schema.Literal("file"),
      directory: Schema.String,
      filenamePattern: Schema.String,
    }),
  )),

  // Confidence threshold — only publish above this
  minConfidence: Schema.Number.pipe(Schema.between(0, 100)),

  // TLP marking to apply
  tlpMarking: Schema.Literal("white", "green", "amber", "red"),

  // Include extension definitions in every bundle?
  includeExtensionDefs: Schema.Boolean,
})
```

---

## 22. Performance Analysis

### 22.1 STIX Bundle Assembly Cost

| Operation | Time (estimated) | Notes |
|-----------|-----------------|-------|
| FusedDatum to StixRelationship | ~50 us | Schema transform + UUID generation |
| Signal to observed-data + SCOs | ~100 us | Per contributing signal |
| Bundle assembly (2 signals) | ~300 us | Collect refs, dedup, serialize |
| Bundle assembly (5 signals) | ~700 us | More objects to collect |
| JSON serialization (4 KB bundle) | ~50 us | JSON.stringify |
| TAXII POST (network) | ~10-50 ms | Network latency dominant |
| NATS publish | ~100 us | Local broker |

### 22.2 Throughput Estimates

```
SCENARIO: 1,000 fusion events/second (mixed tiers)

Per-event bundling:
  Transform: 1,000 * 300 us = 300 ms/sec (30% of one core)
  TAXII publish: 1,000 * 20 ms = 20 seconds/sec ← BOTTLENECK
    Solution: Batch 100 events per TAXII POST = 10 POSTs/sec = 200 ms

Timed-batch bundling (every 1 second):
  Transform: 1,000 * 300 us = 300 ms/sec
  Bundle assembly: 1 * 5 ms = 5 ms/sec
  TAXII publish: 1 * 20 ms = 20 ms/sec
  Total: ~325 ms/sec (32.5% of one core)

VERDICT: Timed-batch at 1-second intervals is optimal.
  - Amortizes TAXII network overhead
  - Keeps latency under 2 seconds
  - One core handles 3,000+ events/sec
```

### 22.3 Memory Requirements

| Component | Memory | Notes |
|-----------|--------|-------|
| STIX object cache (1 min window) | ~50 MB | For dedup across bundles |
| Extension definitions (3) | ~5 KB | Cached, reused |
| Pending bundle buffer | ~10 MB | For batch assembly |
| TAXII client connection pool | ~1 MB | 5 connections |

### 22.4 Combined H3 + STIX Pipeline Performance

```
END-TO-END: Signal Ingest -> Fusion -> STIX Export

Phase 1: H3 Cell Assignment
  10,000 signals/sec * 700 ns = 7 ms/sec

Phase 2: d2ts Equi-Join
  ~5,000 candidate pairs/sec * 1 us = 5 ms/sec

Phase 3: Predicate Evaluation
  ~500 surviving pairs/sec * 10 us = 5 ms/sec

Phase 4: Confidence Calculation
  ~200 fusion events/sec * 5 us = 1 ms/sec

Phase 5: STIX Transform
  ~200 events/sec * 300 us = 60 ms/sec

Phase 6: STIX Publish
  ~2 batch POSTs/sec * 20 ms = 40 ms/sec

TOTAL: ~118 ms/sec = 11.8% of one core

Headroom: 8.5x before saturating a single core.
Multi-core: Phases are independently parallelizable.
```

---

## 23. Integration with Fusion Ontology

### 23.1 Ontology-to-STIX Mapping

Each JoinPathEntry in the fusion ontology (TSGC-001 Section 6) maps to a STIX
generation template:

| JoinPathEntry.outputType | STIX Template | Section |
|--------------------------|---------------|---------|
| `"merge"` | Merge template (19.1) | `duplicate-of` relationship |
| `"correlate"` | Correlate template (19.2) | `x-tsingou-*` relationship |
| `"enrich"` | Enrich template (19.3) | `derived-from` relationship |

The `joinType` field determines which custom relationship subtype is used:

| joinType | Custom Relationship Type |
|----------|------------------------|
| `"identity"` | `duplicate-of` (standard STIX) |
| `"spatial"` | `x-tsingou-co-located-with` |
| `"temporal"` | `x-tsingou-temporally-correlated` |
| `"spectral"` | `x-tsingou-spectrally-matched` |
| `"semantic"` | `related-to` (standard STIX) |
| `"behavioral"` | `x-tsingou-behaviorally-similar` |

### 23.2 Ontology Configuration Affects STIX Output

When an operator tunes the fusion ontology (adjusting thresholds, weights,
enabling/disabling join paths), the STIX output changes accordingly:

```
OPERATOR ACTION:                    STIX EFFECT:

Raise fusion_threshold 0.65->0.80   Fewer relationships generated
                                    Higher average confidence

Disable join path "pair-3"          No ADS-B x AIS relationships
                                    Corresponding TAXII collection quiets

Increase spatial weight 0.35->0.50  Spatially-close pairs score higher
                                    More co-location relationships

Enable Tier 3 statistical           New "x-tsingou-behaviorally-similar"
                                    relationships at low confidence (capped 60)
```

### 23.3 Ontology Version Tracking

Every STIX relationship includes `x_tsingou_ontology_version` in its fusion
extension. This enables:

1. **Reproducibility** — Given the same signals and ontology version, the same
   STIX output is deterministically produced
2. **Audit trail** — Analysts can see which ontology configuration produced a
   specific correlation
3. **Regression testing** — Compare STIX output across ontology versions

### 23.4 End-to-End Integration Diagram

```
FULL INTEGRATION: Ontology -> H3 -> d2ts -> STIX -> TAXII

+-------------------+
| Fusion Ontology   |
| (NATS config)     |
|                   |
| joinPaths: [      |
|   pair-1..pair-8  |
| ]                 |
| thresholds: {     |
|   fusion: 0.65    |
|   spatial_w: 0.35 |
| }                 |
+--------+----------+
         |
         | Compiles to
         v
+--------+----------+
| d2ts Dataflow     |
| Graph             |
|                   |
| For each enabled  |   +------------------+
| join path:        |   | H3 Spatial Index |
|                   |<--|                  |
| 1. cell assign    |   | latLngToCell()   |
| 2. equi-join on   |   | gridDisk()       |
|    h3Cell         |   | polygonToCells() |
| 3. predicate eval |   +------------------+
| 4. confidence     |
+--------+----------+
         |
         | FusedDatum stream
         v
+--------+----------+
| STIX Generation   |
|                   |
| 1. Select SRO     |
|    template       |
| 2. Transform via  |
|    Effect Schema  |
| 3. Assemble       |
|    bundle         |
| 4. Publish via    |
|    TAXII / NATS   |
+--------+----------+
         |
    +----+----+
    |         |
    v         v
 TAXII     NATS
 Server    Subject
```

---

## 24. References

### Geospatial Indexing

- [H3-HOME] Uber Technologies, "H3: Hexagonal Hierarchical Geospatial Indexing System." https://h3geo.org/
- [H3-GH] uber/h3 GitHub repository. https://github.com/uber/h3
- [H3-RES] H3 Resolution Table. https://h3geo.org/docs/core-library/restable/
- [H3-REGION] H3 Region Functions (polyfill). https://h3geo.org/docs/api/regions/
- [H3-TRAV] H3 Grid Traversal Functions. https://h3geo.org/docs/3.x/api/traversal/
- [H3-S2] H3 vs S2 Comparison. https://h3geo.org/docs/comparisons/s2/
- [GEOIDX] Feifke, B., "Geospatial Indexing Explained: A Comparison of Geohash, S2, and H3." https://benfeifke.com/posts/geospatial-indexing-explained/
- [RTREE] Guttman, A., "R-Trees: A Dynamic Index Structure for Spatial Searching." ACM SIGMOD, 1984.
- [RBUSH] Agafonkin, V., "RBush — high-performance JavaScript R-tree." https://github.com/mourner/rbush
- [TPR] Saltenis, S. et al., "Indexing the Positions of Continuously Moving Objects." ACM SIGMOD, 2000.
- [TPR*] Tao, Y. et al., "The TPR*-Tree: An Optimized Spatio-Temporal Access Method." VLDB, 2003.
- [PBSM] Patel, J.M. and DeWitt, D.J., "Partition Based Spatial-Merge Join." ACM SIGMOD, 1996.
- [SPJOIN] Jacox, E.H. and Samet, H., "Spatial Join Techniques." CS-TR-4730, University of Maryland, 2005.
- [FELT] Felt, "Understanding spatial indexes: H3 explained." https://felt.com/blog/h3-spatial-index-hexagons

### STIX/TAXII

- [STIX21] OASIS, "STIX Version 2.1." Committee Specification 03, June 2020. https://docs.oasis-open.org/cti/stix/v2.1/cs01/stix-v2.1-cs01.html
- [STIX-WALK] OASIS, "Introductory Walkthrough." https://oasis-open.github.io/cti-documentation/stix/walkthrough.html
- [STIX-SIGHT] OASIS, "Sighting of Observed Data Example." https://oasis-open.github.io/cti-documentation/examples/sighting-of-observed-data.html
- [STIX-EXT] dogesec, "Creating Custom STIX Objects for Cyber Threat Intelligence." https://www.dogesec.com/blog/create_custom_stix_objects/
- [STIX-PY] OASIS, "stix2 Python Library Documentation." https://stix2.readthedocs.io/en/latest/
- [STIX-CONF] stix2, "Confidence Scales." https://stix2.readthedocs.io/en/latest/api/confidence/stix2.confidence.scales.html
- [TAXII21] OASIS, "TAXII Version 2.1." https://docs.oasis-open.org/cti/taxii/v2.1/os/taxii-v2.1-os.html
- [TAXII-INTRO] OASIS, "Introduction to TAXII." https://oasis-open.github.io/cti-documentation/taxii/intro.html
- [OCA-EXT] Open Cybersecurity Alliance, "STIX Extensions." https://github.com/opencybersecurityalliance/stix-extensions

### Internal References

- [TSGC-001] Tsingou Fusion Ontology Design. `docs/tsingou/concepts/fusion-ontology.md`
- [TSG.12] STIX 2.1 Data Model. `docs/tsingou/rfc/rfc-section-stix-data-model.md`
- [TSG.13] BaseSignal-STIX Codec. `docs/tsingou/rfc/rfc-section-stix-codec.md`
- [TSG.14] TAXII Transport. `docs/tsingou/rfc/rfc-section-taxii-transport.md`
- [TSG.30] Geospatial Mathematics. `docs/tsingou/rfc/rfc-section-geospatial-math.md`
- [STIX-CAT] STIX 2.1 Object Catalog. `docs/tsingou/research/research-stix-sdo-catalog.md`
- [GEO-MATH] Geospatial Mathematics Research. `docs/tsingou/research/research-geospatial-math.md`

---

*End of TSGC-002*
