# Research: Geospatial Mathematics for SIGINT Visualization

```
Document:     research-geospatial-math.md
Purpose:      Raw research with mathematical derivations for TSG.30
Author:       Val (dsp-specialist)
Created:      2026-02-18
Status:       COMPLETE
Feeds Into:   rfc-section-geospatial-math.md (TSG.30)
```

> This document collects the mathematical foundations, algorithmic analysis, and
> performance characteristics of geospatial computation relevant to the Tsingou
> SIGINT visualization platform. Tsingou must place signals, emitters, platforms,
> and tracks in geographic space — these are the mathematical tools that enable it.

---

## Table of Contents

1. [Geodetic Reference Systems](#1-geodetic-reference-systems)
2. [Coordinate Transformations](#2-coordinate-transformations)
3. [Distance Computation](#3-distance-computation)
4. [Bearing and Azimuth](#4-bearing-and-azimuth)
5. [Map Projections](#5-map-projections)
6. [Spatial Indexing Systems](#6-spatial-indexing-systems)
7. [R-tree Family](#7-r-tree-family)
8. [Geofencing Algorithms](#8-geofencing-algorithms)
9. [Spatial Clustering](#9-spatial-clustering)
10. [Position Surveillance Protocols](#10-position-surveillance-protocols)
11. [Multi-Sensor Position Fusion](#11-multi-sensor-position-fusion)
12. [Geospatial Error Models](#12-geospatial-error-models)

---

## 1. Geodetic Reference Systems

### 1.1 WGS84 Ellipsoid

The World Geodetic System 1984 (WGS84) defines the reference ellipsoid used by
GPS and all modern geospatial systems. The defining parameters:

| Parameter | Symbol | Value |
|-----------|--------|-------|
| Semi-major axis (equatorial radius) | a | 6,378,137.0 m |
| Flattening | f | 1/298.257223563 |
| Semi-minor axis (polar radius) | b | 6,356,752.3142 m |
| First eccentricity squared | e^2 | 0.00669437999014 |
| Second eccentricity squared | e'^2 | 0.00673949674228 |

Derived:
```
b = a * (1 - f)
e^2 = 2*f - f^2
e'^2 = e^2 / (1 - e^2)
```

### 1.2 Geodetic Coordinates (phi, lambda, h)

- phi (latitude): angle between the equatorial plane and the normal to the
  ellipsoid at the surface point, -90 to +90 degrees
- lambda (longitude): angle from the prime meridian, -180 to +180 degrees
- h (ellipsoidal height): distance above the ellipsoid along the normal

EPSG:4326 is the CRS code for the WGS84 geographic coordinate system.

### 1.3 Geocentric vs Geodetic Latitude

Geocentric latitude (phi_c) is the angle from the equatorial plane to the line
connecting the center of the ellipsoid to the surface point. Geodetic latitude
(phi) is measured along the normal. The difference:

```
tan(phi_c) = (1 - e^2) * tan(phi)
```

Maximum difference occurs at 45 degrees latitude: ~11.5 arc-minutes (~21 km).

### 1.4 Radius of Curvature

The ellipsoid has two principal radii of curvature at geodetic latitude phi:

**Meridional (north-south):**
```
M(phi) = a*(1 - e^2) / (1 - e^2*sin^2(phi))^(3/2)
```

**Prime vertical (east-west):**
```
N(phi) = a / (1 - e^2*sin^2(phi))^(1/2)
```

At the equator: M = 6,335,439 m, N = 6,378,137 m
At the poles:   M = N = 6,399,594 m

The mean radius of curvature: R_mean = sqrt(M * N)

---

## 2. Coordinate Transformations

### 2.1 Geodetic to ECEF

Earth-Centered Earth-Fixed (ECEF) Cartesian coordinates (X, Y, Z):

```
X = (N + h) * cos(phi) * cos(lambda)
Y = (N + h) * cos(phi) * sin(lambda)
Z = (N*(1 - e^2) + h) * sin(phi)
```

where N is the prime vertical radius of curvature.

### 2.2 ECEF to Geodetic

The inverse transformation is iterative (Bowring's method):

```
1. Initial approximation:
   p = sqrt(X^2 + Y^2)
   theta = atan2(Z*a, p*b)

2. Latitude:
   phi = atan2(Z + e'^2 * b * sin^3(theta),
               p - e^2 * a * cos^3(theta))

3. Longitude:
   lambda = atan2(Y, X)

4. Height:
   N = a / sqrt(1 - e^2 * sin^2(phi))
   h = p / cos(phi) - N
```

Bowring's method converges to sub-millimeter accuracy in a single iteration for
points near the Earth's surface.

### 2.3 ECEF to ENU (East-North-Up)

Given a reference point (phi_0, lambda_0, h_0) and an ECEF offset (dX, dY, dZ):

```
[dE]   [-sin(lambda_0)          cos(lambda_0)         0              ] [dX]
[dN] = [-sin(phi_0)*cos(lambda_0)  -sin(phi_0)*sin(lambda_0)  cos(phi_0) ] [dY]
[dU]   [ cos(phi_0)*cos(lambda_0)   cos(phi_0)*sin(lambda_0)  sin(phi_0) ] [dZ]
```

ENU is a local tangent plane coordinate system centered at the reference point.
Used for local-area computations (bearing, range, elevation angle).

### 2.4 ENU to AER (Azimuth-Elevation-Range)

From ENU coordinates:

```
Range:     r = sqrt(dE^2 + dN^2 + dU^2)
Azimuth:   az = atan2(dE, dN)             (0 = North, clockwise)
Elevation: el = atan2(dU, sqrt(dE^2 + dN^2))
```

This is the fundamental transform for radar-like systems and DF (direction
finding) applications in SIGINT.

---

## 3. Distance Computation

### 3.1 Spherical Law of Cosines

For two points (phi_1, lambda_1) and (phi_2, lambda_2) on a sphere of radius R:

```
d = R * arccos(sin(phi_1)*sin(phi_2) +
               cos(phi_1)*cos(phi_2)*cos(lambda_2 - lambda_1))
```

Numerically unstable for small distances (near-zero argument to arccos).

### 3.2 Haversine Formula

Numerically stable reformulation using the haversine function
hav(theta) = sin^2(theta/2):

```
a = sin^2((phi_2 - phi_1)/2) +
    cos(phi_1)*cos(phi_2)*sin^2((lambda_2 - lambda_1)/2)

c = 2 * atan2(sqrt(a), sqrt(1 - a))

d = R * c
```

Properties:
- Numerically stable for all distances, including very small
- Assumes spherical Earth (R ~ 6,371 km mean radius)
- Accuracy: ~0.3% worst case (pole-to-equator paths)
- Error: up to ~0.5% compared to ellipsoidal geodesic

### 3.3 Vincenty's Inverse Formula (Ellipsoidal)

Computes the geodesic distance on the WGS84 ellipsoid with sub-millimeter
accuracy via an iterative procedure:

```
Input:  (phi_1, lambda_1), (phi_2, lambda_2)
Output: distance s, forward azimuth alpha_1, back azimuth alpha_2

Reduced latitudes:
  U_1 = atan((1-f)*tan(phi_1))
  U_2 = atan((1-f)*tan(phi_2))

Iterate until convergence of lambda:
  sin_sigma = sqrt((cos(U_2)*sin(lambda))^2 +
              (cos(U_1)*sin(U_2) - sin(U_1)*cos(U_2)*cos(lambda))^2)
  cos_sigma = sin(U_1)*sin(U_2) + cos(U_1)*cos(U_2)*cos(lambda)
  sigma = atan2(sin_sigma, cos_sigma)
  sin_alpha = cos(U_1)*cos(U_2)*sin(lambda) / sin_sigma
  cos2_alpha = 1 - sin_alpha^2
  cos_2sigma_m = cos_sigma - 2*sin(U_1)*sin(U_2)/cos2_alpha
  C = f/16 * cos2_alpha * (4 + f*(4 - 3*cos2_alpha))
  lambda_new = L + (1-C)*f*sin_alpha *
               (sigma + C*sin_sigma*(cos_2sigma_m +
                C*cos_sigma*(-1 + 2*cos_2sigma_m^2)))

Distance:
  u2 = cos2_alpha * (a^2 - b^2) / b^2
  A = 1 + u2/16384 * (4096 + u2*(-768 + u2*(320 - 175*u2)))
  B = u2/1024 * (256 + u2*(-128 + u2*(74 - 47*u2)))
  delta_sigma = B*sin_sigma*(cos_2sigma_m + ...)
  s = b * A * (sigma - delta_sigma)
```

Properties:
- Accuracy: < 0.5 mm on the WGS84 ellipsoid
- Convergence: typically 3-5 iterations
- Fails to converge for nearly antipodal points (~0.01% of cases)
- For antipodal points: use Karney's algorithm (GeographicLib)

### 3.4 Accuracy Comparison

| Method | Model | Accuracy | Computation |
|--------|-------|----------|-------------|
| Spherical law of cosines | Sphere | ~0.5% | 1 arccos |
| Haversine | Sphere | ~0.3% | 2 atan2 |
| Vincenty inverse | WGS84 ellipsoid | < 0.5 mm | Iterative (3-5 iters) |
| Karney (GeographicLib) | WGS84 ellipsoid | < 15 nm | Iterative (robust) |
| Flat Earth approximation | Plane | ~1% at 100 km | 1 sqrt |

For Tsingou: Haversine is sufficient for display and rough calculations.
Vincenty/Karney MUST be used for precision geolocation and DF bearing intersection.

---

## 4. Bearing and Azimuth

### 4.1 Initial Bearing (Forward Azimuth)

From point 1 to point 2 on a sphere:

```
theta = atan2(sin(lambda_2 - lambda_1)*cos(phi_2),
              cos(phi_1)*sin(phi_2) -
              sin(phi_1)*cos(phi_2)*cos(lambda_2 - lambda_1))
```

Result in radians, measured clockwise from north (0 = north, pi/2 = east).
Convert to degrees: bearing = (theta * 180/pi + 360) mod 360.

### 4.2 Final Bearing (Back Azimuth)

Compute the initial bearing from point 2 to point 1 and reverse by 180 degrees:

```
back_azimuth = (forward_azimuth_21 + 180) mod 360
```

### 4.3 Destination Point Given Bearing and Distance

Given start point (phi_1, lambda_1), bearing theta, and distance d on sphere R:

```
phi_2 = asin(sin(phi_1)*cos(d/R) + cos(phi_1)*sin(d/R)*cos(theta))

lambda_2 = lambda_1 + atan2(sin(theta)*sin(d/R)*cos(phi_1),
                             cos(d/R) - sin(phi_1)*sin(phi_2))
```

This is the forward geodesic problem (Vincenty direct formula on the ellipsoid).

### 4.4 Bearing Intersection (Cross-Fix)

Given two stations at known positions with measured bearings to an unknown target,
the target position is the intersection of the two bearing lines.

On a sphere, two great circles intersect at two points. The solution involves:

```
1. Convert bearings to great circle equations
2. Compute intersection using cross-product of normal vectors
3. Select the correct intersection (closest to expected area)
```

For Tsingou SIGINT: bearing intersection (cross-fix) from multiple DF stations
is the primary geolocation method. Accuracy depends on:
- Bearing accuracy of each DF measurement
- Geometry (angle of intersection — 90 degrees optimal)
- Number of DF stations (2 minimum, 3+ for overdetermined solution)

### 4.5 Bearing Error and LOB Width

A Line of Bearing (LOB) from a DF station has angular uncertainty:

```
LOB_width at distance d = d * tan(sigma_bearing)

where sigma_bearing = RMS bearing error (typically 1-5 degrees for tactical DF)
```

| DF Accuracy | LOB Width at 10 km | LOB Width at 100 km |
|-------------|-------------------|---------------------|
| 1 degree | 175 m | 1,745 m |
| 2 degrees | 349 m | 3,491 m |
| 5 degrees | 875 m | 8,749 m |
| 10 degrees | 1,763 m | 17,633 m |

The intersection of two LOBs forms an error ellipse whose size depends on the
LOB widths and the crossing angle.

---

## 5. Map Projections

### 5.1 Projection Classification

| Property | Conformal | Equal-Area | Equidistant |
|----------|----------|-----------|-------------|
| Preserves | Angles/shapes locally | Areas | Distances from center |
| Distorts | Areas | Shapes | Areas and shapes |
| Examples | Mercator, Lambert CC | Albers, Mollweide | Azimuthal equidistant |
| SIGINT use | Navigation charts | Area analysis | Range rings |

### 5.2 Web Mercator (EPSG:3857)

The de facto standard for web mapping (Google Maps, OpenStreetMap, Mapbox):

```
x = R * lambda
y = R * ln(tan(pi/4 + phi/2))
```

where R = 6,378,137 m (WGS84 semi-major axis used as sphere radius).

Properties:
- Conformal (preserves angles locally)
- Extreme area distortion at high latitudes (Greenland appears as large as Africa)
- Valid range: -85.051 to +85.051 degrees latitude
- Square tiles: 2^zoom tiles per axis at zoom level z

Tile coordinates at zoom level z:

```
tile_x = floor((lambda + 180) / 360 * 2^z)
tile_y = floor((1 - ln(tan(phi) + 1/cos(phi)) / pi) / 2 * 2^z)
```

### 5.3 Transverse Mercator / UTM

Universal Transverse Mercator divides the globe into 60 zones (6 degrees wide):

```
Zone number = floor((lambda + 180) / 6) + 1
Central meridian = (zone - 1) * 6 - 180 + 3
```

UTM coordinates (Easting, Northing) in meters:
- Easting: 500,000 m false easting (to avoid negative values)
- Northing: 0 m in Northern hemisphere, 10,000,000 m false northing in Southern
- Scale factor at central meridian: k_0 = 0.9996

Properties:
- Conformal
- Maximum distortion < 0.04% within any zone
- Well-suited for local-area computations
- Breaks down at zone boundaries (seam problem)

### 5.4 Stereographic (Polar and Oblique)

The stereographic projection is conformal and preserves circles. Used for:
- Polar regions (beyond 84N and 80S, where UTM is not defined)
- Radar displays (azimuthal projection centered on the radar site)

```
Polar stereographic (from North Pole):
x = 2*R*tan(pi/4 - phi/2)*sin(lambda)
y = -2*R*tan(pi/4 - phi/2)*cos(lambda)
```

### 5.5 Lambert Conformal Conic

Used for continental-scale mapping in mid-latitudes:

```
rho = F * (tan(pi/4 + phi/2))^{-n}
x = rho * sin(n * (lambda - lambda_0))
y = rho_0 - rho * cos(n * (lambda - lambda_0))
```

where n and F depend on the standard parallels. Used for aeronautical charts
(ICAO standard for many countries).

### 5.6 Azimuthal Equidistant

Distances from the center point are preserved — range rings are true circles:

```
c = arccos(sin(phi_0)*sin(phi) + cos(phi_0)*cos(phi)*cos(lambda - lambda_0))
k = c / sin(c)
x = k * cos(phi)*sin(lambda - lambda_0)
y = k * (cos(phi_0)*sin(phi) - sin(phi_0)*cos(phi)*cos(lambda - lambda_0))
```

Used for DF station displays and radio propagation coverage maps.

### 5.7 Projection Selection for SIGINT

| Display | RECOMMENDED Projection | Rationale |
|---------|----------------------|-----------|
| Web map base layer | Web Mercator (EPSG:3857) | Universal tile support |
| Range/bearing overlay | Azimuthal equidistant | True distance from station |
| Local area operations | UTM zone | Metric coordinates, low distortion |
| Polar operations | Polar stereographic | Conformal at high latitudes |
| Continental overview | Lambert conformal conic | Standard aeronautical charts |

---

## 6. Spatial Indexing Systems

### 6.1 Geohash

Geohash encodes a location into a short string by interleaving the bits of
latitude and longitude and encoding with base-32:

```
Precision: each character adds ~5 bits of precision
Character 1: ~5000 km cells
Character 5: ~5 km cells (most common)
Character 8: ~20 m cells
Character 12: ~0.02 m cells
```

Properties:
- Simple string prefix = spatial containment
- Z-order curve (not Hilbert — locality not optimal)
- Rectangular cells (elongated near poles)
- Edge effects: adjacent cells may have very different prefixes

### 6.2 H3 Hexagonal Index (Uber)

H3 tessellates the globe with hexagons using an icosahedral projection:

```
122 base cells (resolution 0): 110 hexagons + 12 pentagons
Aperture 7: each parent has ~7 children
16 resolution levels (0-15)
```

| Resolution | Avg Area | Avg Edge Length | Num Cells |
|-----------|----------|----------------|-----------|
| 0 | 4,357,449 km^2 | 1,108 km | 122 |
| 1 | 609,788 km^2 | 419 km | 842 |
| 2 | 86,801 km^2 | 158 km | 5,882 |
| 3 | 12,393 km^2 | 59.8 km | 41,162 |
| 4 | 1,770 km^2 | 22.6 km | 288,122 |
| 5 | 252.9 km^2 | 8.5 km | 2,016,842 |
| 6 | 36.13 km^2 | 3.2 km | 14,117,882 |
| 7 | 5.161 km^2 | 1.22 km | 98,825,162 |
| 8 | 0.7373 km^2 | 461 m | 691,776,122 |
| 9 | 0.1053 km^2 | 174 m | 4,842,432,842 |
| 10 | 0.01505 km^2 | 66 m | ~3.39 * 10^10 |
| 11 | 0.00215 km^2 | 25 m | ~2.37 * 10^11 |
| 12 | 0.000307 km^2 | 9.4 m | ~1.66 * 10^12 |
| 15 | 0.9 m^2 | 0.5 m | ~5.70 * 10^14 |

Properties:
- Equal-area cells (low distortion across latitudes)
- Equidistant neighbors (6 neighbors per hex, uniform distance)
- Hierarchical: parent-child containment (approximate due to aperture 7)
- 64-bit integer index (efficient storage and comparison)

### 6.3 S2 Geometry (Google)

S2 projects the sphere onto a cube, then recursively subdivides each face using
a quadtree with a Hilbert space-filling curve:

```
6 cube faces
Each face: quadtree subdivision (30 levels)
Level 0: 6 cells
Level 30: ~4.6 * 10^18 cells (sub-centimeter)
```

| Level | Avg Area | Min Edge | Max Edge |
|-------|----------|----------|----------|
| 0 | 85,011,012 km^2 | 7,842 km | 7,842 km |
| 1 | 21,252,753 km^2 | 3,921 km | 5,004 km |
| 12 | 5.07 km^2 | 1.6 km | 2.3 km |
| 14 | 316,234 m^2 | 401 m | 579 m |
| 16 | 19,764 m^2 | 100 m | 145 m |
| 20 | 77.2 m^2 | 6.3 m | 9.0 m |
| 24 | 0.30 m^2 | 0.39 m | 0.57 m |
| 30 | ~0.74 cm^2 | 0.006 m | 0.009 m |

Properties:
- Strict hierarchical containment (parent always contains children)
- Hilbert curve ordering (excellent spatial locality)
- 64-bit cell ID (level encoded in trailing bits)
- No pentagons (cube projection avoids icosahedral singularities)
- Cell area variation: ~5.2:1 across the globe (vs ~1:1 for H3)

### 6.4 Spatial Index Comparison

| Feature | Geohash | H3 | S2 | Quadtree |
|---------|---------|-----|-----|----------|
| Geometry | Rectangle | Hexagon | Quadrilateral | Rectangle |
| Area uniformity | Poor (varies by latitude) | Excellent (~1:1) | Moderate (~5.2:1) | Poor |
| Neighbor uniformity | 8 neighbors, varying distances | 6 neighbors, equal distance | 4-8 neighbors | 4-8 neighbors |
| Hierarchy | Strict containment | Approximate | Strict containment | Strict containment |
| Space-filling curve | Z-order | Face-local Hilbert | Global Hilbert | Z-order or Hilbert |
| Index type | String | 64-bit int | 64-bit int | 64-bit int |
| Max resolution | ~mm | ~0.5 m | ~cm | Arbitrary |
| Best for | Simple prefix queries | Spatial aggregation | Range queries, covering | In-memory traversal |

For Tsingou: H3 is RECOMMENDED for spatial aggregation (signal density heatmaps,
emitter clustering). S2 is RECOMMENDED for range queries and coverage regions.
Geohash MAY be used for simple NATS subject-based spatial partitioning.

---

## 7. R-tree Family

### 7.1 R-tree Structure

An R-tree is a balanced search tree for spatial data, where each node contains
between m and M entries. Each entry stores a minimum bounding rectangle (MBR) and
a pointer to a child node (internal) or data object (leaf).

```
Properties:
- Height-balanced (all leaves at same depth)
- Every non-root node has between m and M entries (m <= M/2)
- Root has between 2 and M entries (unless it is a leaf)
- Each leaf entry (MBR, object_id) stores the bounding box of a spatial object
- Each internal entry (MBR, child_ptr) stores the MBR that encloses all entries
  in the child subtree
```

### 7.2 Search Algorithm

```
Search(node T, query MBR Q):
  If T is a leaf:
    Return all entries whose MBR intersects Q
  Else:
    For each entry E in T:
      If E.MBR intersects Q:
        Search(E.child, Q)
```

Average-case complexity: O(log_M(n)) where n is the number of objects.
Worst-case: O(n) (when all MBRs overlap — pathological case).

### 7.3 Insertion Algorithm

```
Insert(entry E):
  1. Choose leaf L:
     - At each level, choose the child whose MBR needs least enlargement
       to accommodate E
     - Break ties by choosing the child with smallest MBR area
  2. If L has room, insert E
  3. If L is full, split into L and L':
     - Distribute entries to minimize total MBR area (NP-hard; use heuristic)
     - Quadratic split: O(M^2) — pick seeds that maximize wasted area,
       then assign remaining entries greedily
     - Linear split: O(M) — faster but worse quality
  4. Propagate splits up the tree (may increase height)
```

### 7.4 R*-tree Improvements

The R*-tree improves insertion quality by:
- Minimizing overlap (not just area) for leaf-level splits
- Forced reinsertion: on overflow, remove p entries and reinsert them
  (typically p = 30% of M)
- Better split heuristic using perimeter minimization

R*-tree provides 10-30% better query performance than R-tree for most datasets.

### 7.5 Bulk Loading (STR — Sort-Tile-Recursive)

For static datasets, STR produces near-optimal R-trees:

```
1. Sort all objects by x-coordinate
2. Partition into sqrt(n/M) vertical slabs
3. Within each slab, sort by y-coordinate
4. Partition into groups of M → these become leaf nodes
5. Recursively build internal levels
```

STR-loaded R-trees have ~10% less overlap than incrementally built R*-trees.

### 7.6 Complexity Summary

| Operation | Average | Worst | Notes |
|-----------|---------|-------|-------|
| Point query | O(log_M n) | O(n) | Worst case: high overlap |
| Range query | O(log_M n + k) | O(n) | k = result size |
| k-NN query | O(log_M n * log n) | O(n log n) | Priority queue based |
| Insertion | O(log_M n) | O(n) | Worst: cascade splits |
| Deletion | O(log_M n) | O(n) | May require reinsertion |
| Bulk load (STR) | O(n log n) | O(n log n) | Sort-dominated |

---

## 8. Geofencing Algorithms

### 8.1 Circular Geofence

The simplest geofence: a point is inside if its distance from the center is
less than the radius:

```
inside = haversine(point, center) < radius
```

Complexity: O(1) per point.

For large numbers of circular geofences, use a spatial index (R-tree or grid)
to prune candidates before distance computation.

### 8.2 Ray Casting Algorithm (Point-in-Polygon)

Cast a ray from the test point to infinity (typically in the +x direction) and
count intersections with polygon edges:

```
RayCast(point P, polygon vertices V[0..n-1]):
  crossings = 0
  for i = 0 to n-1:
    j = (i + 1) mod n
    if (V[i].y <= P.y < V[j].y) or (V[j].y <= P.y < V[i].y):
      t = (P.y - V[i].y) / (V[j].y - V[i].y)
      if P.x < V[i].x + t * (V[j].x - V[i].x):
        crossings += 1
  return (crossings mod 2) == 1    // odd = inside
```

Complexity: O(n) per point, where n = number of polygon vertices.
Handles concave polygons correctly. Edge cases: point on vertex or edge.

### 8.3 Winding Number Algorithm

Computes the winding number of the polygon around the test point. Non-zero
winding number = inside:

```
WindingNumber(point P, polygon V[0..n-1]):
  wn = 0
  for i = 0 to n-1:
    j = (i + 1) mod n
    if V[i].y <= P.y:
      if V[j].y > P.y:                    // upward crossing
        if isLeft(V[i], V[j], P) > 0:     // P left of edge
          wn += 1
    else:
      if V[j].y <= P.y:                   // downward crossing
        if isLeft(V[i], V[j], P) < 0:     // P right of edge
          wn -= 1
  return wn != 0

isLeft(P0, P1, P2) = (P1.x-P0.x)*(P2.y-P0.y) - (P2.x-P0.x)*(P1.y-P0.y)
```

Advantages over ray casting:
- Correctly handles self-intersecting polygons
- No trigonometric functions needed
- Numerically robust

### 8.4 Grid-Accelerated Geofencing

For repeated point-in-polygon queries against the same polygon:

```
1. Overlay a grid on the polygon's bounding box
2. Pre-classify each grid cell: inside, outside, or boundary
3. For each query point:
   a. Find the grid cell containing the point
   b. If classified inside/outside: return immediately O(1)
   c. If boundary: run ray casting on the polygon edges crossing this cell
```

Reduces average query time from O(n) to O(1) for most points.

### 8.5 Geofencing on the Sphere

For geofences defined in geographic coordinates, the algorithms above work on
projected coordinates but may introduce projection-related errors for large
geofences. For geofences spanning > 1 degree:

- Use spherical point-in-polygon (great circle edges instead of straight lines)
- Or project to a local tangent plane (ENU) centered on the geofence centroid
- For circular geofences: always use Haversine distance (not Euclidean)

---

## 9. Spatial Clustering

### 9.1 DBSCAN (Density-Based Spatial Clustering of Applications with Noise)

DBSCAN groups points based on density connectivity, identifying clusters of
arbitrary shape and marking low-density points as noise.

**Parameters:**
- epsilon (eps): maximum distance between two neighbors
- MinPts: minimum number of points to form a dense region

**Point classification:**
- Core point: has >= MinPts neighbors within distance eps
- Border point: within eps of a core point but < MinPts own neighbors
- Noise point: neither core nor border (outlier)

**Algorithm:**
```
DBSCAN(points, eps, MinPts):
  label all points as UNDEFINED
  cluster_id = 0
  for each point P in points:
    if P.label != UNDEFINED: continue
    neighbors = range_query(P, eps)
    if |neighbors| < MinPts:
      P.label = NOISE
      continue
    cluster_id += 1
    P.label = cluster_id
    seed_set = neighbors - {P}
    for each Q in seed_set:
      if Q.label == NOISE: Q.label = cluster_id
      if Q.label != UNDEFINED: continue
      Q.label = cluster_id
      Q_neighbors = range_query(Q, eps)
      if |Q_neighbors| >= MinPts:
        seed_set = seed_set union Q_neighbors
```

**Complexity:**
- With spatial index (R-tree, KD-tree): O(n log n)
- Without spatial index: O(n^2)
- Space: O(n)

**Parameter selection for geospatial data:**
- eps: depends on application scale (meters for urban, km for regional)
- MinPts: rule of thumb >= dim + 1 = 3 for 2D geographic data
- k-distance plot: sort k-th nearest neighbor distances, find the "knee"

### 9.2 OPTICS (Ordering Points to Identify Clustering Structure)

Extends DBSCAN to produce a hierarchical clustering without fixing eps:

```
Produces a reachability plot — valleys indicate clusters at different density
levels. More informative than single-eps DBSCAN.
```

Complexity: O(n log n) with spatial index.

### 9.3 HDBSCAN (Hierarchical DBSCAN)

Combines DBSCAN with hierarchical clustering:
- Builds a hierarchy of all possible DBSCAN clusterings
- Extracts the most persistent clusters across density levels
- Automatically determines the number of clusters
- Handles varying-density clusters

For Tsingou: HDBSCAN is RECOMMENDED for emitter clustering because SIGINT
signals exhibit varying spatial density (urban vs rural, high-power vs low-power).

### 9.4 Geospatial Clustering for SIGINT

| Use Case | RECOMMENDED Method | Parameters |
|----------|-------------------|------------|
| Emitter geolocation clustering | HDBSCAN | min_cluster_size = 3 |
| Signal density heatmap | DBSCAN + H3 aggregation | eps = H3 res 7 edge length |
| Track pattern analysis | OPTICS | MinPts = 5 |
| Activity hotspot detection | DBSCAN | eps = application-dependent |

---

## 10. Position Surveillance Protocols

### 10.1 ADS-B (Automatic Dependent Surveillance — Broadcast)

ADS-B is the primary surveillance technology for aviation. Aircraft broadcast
their position derived from GPS on 1090 MHz.

**Message Types (Mode S Extended Squitter):**

| Type Code | Content | Update Rate |
|-----------|---------|-------------|
| 9-18 | Airborne position (CPR encoded) | 2 per second |
| 5-8 | Surface position | Variable |
| 19 | Airborne velocity (speed, heading, vertical rate) | 2 per second |
| 1-4 | Aircraft identification (callsign) | 5 seconds |
| 28 | Aircraft status (emergency) | As needed |

**CPR (Compact Position Reporting) Decoding:**

CPR uses two alternating message types (even/odd) to encode position with 17-bit
latitude and longitude values, achieving ~5 m precision:

```
N_Z = 15  (number of latitude zones)

Latitude zones:
  dLat_even = 360 / (4*N_Z)    = 6.0 degrees
  dLat_odd  = 360 / (4*N_Z-1)  = 6.1017 degrees

Global decode (requires one even + one odd message):
  j = floor(59*lat_cpr_even - 60*lat_cpr_odd + 0.5)
  lat_even = dLat_even * (mod(j, 60) + lat_cpr_even)
  lat_odd  = dLat_odd  * (mod(j, 59) + lat_cpr_odd)

Longitude decode (similar, using NL(lat) longitude zone function):
  NL(lat) = floor(2*pi / arccos(1 - (1-cos(pi/(2*N_Z))) / cos(pi*lat/180)^2))
```

**Important:** CPR decoding can produce incorrect positions for a small fraction
of cases, particularly near zone boundaries. Implementations MUST perform a
reasonableness test (< 180 NM from previous known position).

### 10.2 AIS (Automatic Identification System)

AIS is the maritime equivalent of ADS-B, broadcasting vessel position on VHF
(161.975 MHz and 162.025 MHz).

**Key Message Types (ITU-R M.1371-5):**

| Message Type | Content | Update Rate |
|-------------|---------|-------------|
| 1, 2, 3 | Position report (Class A) | 2-10 sec (speed-dependent) |
| 5 | Static/voyage data (name, destination, ETA) | 6 min |
| 18 | Position report (Class B) | 30 sec |
| 21 | Aid to navigation report | 3 min |
| 24 | Class B static data | 6 min |

**Position Encoding:**

```
Longitude: 28 bits, 1/10000 minute resolution
  longitude_deg = raw_longitude / 600000.0
  Valid range: -180.0 to +180.0 degrees

Latitude: 27 bits, 1/10000 minute resolution
  latitude_deg = raw_latitude / 600000.0
  Valid range: -90.0 to +90.0 degrees

Speed Over Ground (SOG): 10 bits, 0.1 knot resolution
  speed_knots = raw_sog / 10.0
  1023 = not available, 1022 = 102.2+ knots

Course Over Ground (COG): 12 bits, 0.1 degree resolution
  course_deg = raw_cog / 10.0
  3600 = not available
```

**MMSI (Maritime Mobile Service Identity):**
9-digit identifier. First 3 digits = MID (Maritime Identification Digits) = country.

### 10.3 SIGINT-Relevant Position Sources

| Source | Domain | Frequency | Precision | Update Rate |
|--------|--------|-----------|-----------|-------------|
| ADS-B | Aviation | 1090 MHz | ~5 m | 0.5-2 Hz |
| AIS | Maritime | 161-162 MHz | ~10 m | 0.1-0.5 Hz |
| MLAT | Aviation | 1090 MHz | ~30-100 m | 1 Hz |
| ACARS | Aviation | VHF/SATCOM | ~100 m (GPS) | Minutes |
| DF bearing | SIGINT | Various | km-scale (range-dependent) | Per measurement |
| TDOA | SIGINT | Various | 10-1000 m | Per measurement |
| GPS spoofing detection | SIGINT | L1/L2 | N/A | Continuous |

---

## 11. Multi-Sensor Position Fusion

### 11.1 Measurement Models

Each sensor provides position observations with associated uncertainty:

**ADS-B measurement:**
```
z_ADS-B = [lat, lon, alt]^T + v_ADS-B

v_ADS-B ~ N(0, R_ADS-B)
R_ADS-B = diag(sigma_lat^2, sigma_lon^2, sigma_alt^2)
         ~ diag(5m, 5m, 15m)^2    (typical GPS accuracy)
```

**DF bearing measurement:**
```
z_DF = theta_true + v_DF

v_DF ~ N(0, sigma_theta^2)
sigma_theta ~ 1-5 degrees (dependent on DF equipment and SNR)
```

**AIS measurement:**
```
z_AIS = [lat, lon]^T + v_AIS

v_AIS ~ N(0, R_AIS)
R_AIS ~ diag(10m, 10m)^2    (typical GNSS accuracy)
```

### 11.2 Extended Kalman Filter for Position Tracking

State vector: x = [lat, lon, alt, v_N, v_E, v_D]^T
(position + velocity in North-East-Down frame)

**Prediction:**
```
x_pred = F * x_prev + w

F = [I_3  dt*I_3]    (constant velocity model)
    [0_3  I_3   ]

Q = process noise covariance (accounts for maneuvering)
```

**Update (for each measurement):**
```
y = z - h(x_pred)           (innovation)
S = H * P_pred * H^T + R    (innovation covariance)
K = P_pred * H^T * S^{-1}   (Kalman gain)
x_updated = x_pred + K * y
P_updated = (I - K * H) * P_pred
```

### 11.3 Track Association

When multiple sensors observe multiple targets, measurements must be associated
with the correct tracks. The assignment problem:

**Global Nearest Neighbor (GNN):**
```
1. Compute distance matrix D[i,j] = Mahalanobis distance between
   track i's prediction and measurement j
2. Gate: remove associations with D > threshold (chi-squared)
3. Solve assignment: Hungarian algorithm O(n^3)
4. Unassigned measurements → initialize new tracks
5. Unassigned tracks → increment miss counter (delete after N misses)
```

**Mahalanobis distance:**
```
d_M = sqrt((z - h(x))^T * S^{-1} * (z - h(x)))
```

where S is the innovation covariance.

### 11.4 Multi-Hypothesis Tracking (MHT)

For dense environments where GNN may make incorrect associations:
- Maintain multiple association hypotheses in a tree
- Prune hypotheses with low probability
- Defer hard decisions (N-scan pruning)
- Computationally expensive: O(n^k) for k hypotheses

### 11.5 Fusion Architectures

| Architecture | Description | Latency | Bandwidth |
|-------------|-------------|---------|-----------|
| Centralized | All raw measurements to one fuser | Lowest | Highest |
| Distributed | Each sensor runs local tracker, fuse tracks | Medium | Medium |
| Hierarchical | Local fusion nodes feed regional fusion | Highest | Lowest |

For Tsingou: Distributed architecture is RECOMMENDED. Each sensor type (ADS-B
receiver, AIS receiver, DF station) runs a local tracker. Tsingou fuses the
resulting tracks in the visualization layer.

---

## 12. Geospatial Error Models

### 12.1 Circular Error Probable (CEP)

CEP is the radius of the circle within which 50% of measurements fall, centered
on the true position:

```
CEP_50 = 0.5887 * (sigma_x + sigma_y)    (for sigma_x ~ sigma_y)
CEP_50 = 0.6745 * sigma                   (for circular Gaussian, sigma_x = sigma_y)
```

| Probability | Multiple of CEP | Name |
|------------|----------------|------|
| 50% | 1.0 * CEP | CEP (Circular Error Probable) |
| 90% | 2.08 * CEP | R90 |
| 95% | 2.45 * CEP | R95 |
| 99% | 3.03 * CEP | R99 |

### 12.2 Error Ellipse

When sigma_x != sigma_y or errors are correlated, the error region is an ellipse:

```
Semi-major axis: a = sqrt(0.5*(sigma_x^2 + sigma_y^2 +
                     sqrt((sigma_x^2 - sigma_y^2)^2 + 4*rho^2*sigma_x^2*sigma_y^2)))

Semi-minor axis: b = sqrt(0.5*(sigma_x^2 + sigma_y^2 -
                     sqrt((sigma_x^2 - sigma_y^2)^2 + 4*rho^2*sigma_x^2*sigma_y^2)))

Orientation: theta = 0.5 * atan2(2*rho*sigma_x*sigma_y,
                                  sigma_x^2 - sigma_y^2)
```

where rho is the correlation coefficient.

### 12.3 Dilution of Precision (DOP)

For GNSS and multi-sensor geolocation:

```
GDOP = sqrt(PDOP^2 + TDOP^2)
PDOP = sqrt(HDOP^2 + VDOP^2)
HDOP = sqrt(sigma_E^2 + sigma_N^2) / sigma_measurement
VDOP = sigma_D / sigma_measurement
```

| DOP Value | Quality | Description |
|-----------|---------|-------------|
| 1-2 | Excellent | Best achievable |
| 2-5 | Good | Acceptable for most applications |
| 5-10 | Moderate | Usable for navigation |
| 10-20 | Poor | Low confidence |
| > 20 | Very poor | Unreliable |

For DF geolocation, the equivalent metric is GDOP computed from the geometry
of the DF stations relative to the emitter.

---

## References

| Key | Title | Relevance |
|-----|-------|-----------|
| [WGS84] | Department of Defense World Geodetic System 1984, NIMA TR 8350.2, 3rd ed., 2000 | Geodetic reference |
| [VINCENTY-1975] | Vincenty, "Direct and inverse solutions of geodesics on the ellipsoid with application of nested equations," Survey Review 23(176), 1975 | Ellipsoidal distance |
| [KARNEY-2013] | Karney, "Algorithms for geodesics," J. Geodesy 87(1):43-55, 2013 | Robust geodesic computation |
| [GUTTMAN-1984] | Guttman, "R-trees: A dynamic index structure for spatial searching," Proc. ACM SIGMOD, 1984 | R-tree original |
| [BECKMANN-1990] | Beckmann et al., "The R*-tree: An efficient and robust access method for points and rectangles," Proc. ACM SIGMOD, 1990 | R*-tree |
| [UBER-H3] | Uber Engineering, "H3: Uber's Hexagonal Hierarchical Spatial Index," 2018 | H3 system |
| [S2-GEOMETRY] | Google, "S2 Geometry Library," s2geometry.io | S2 cells |
| [ESTER-1996] | Ester et al., "A density-based algorithm for discovering clusters in large spatial databases with noise," KDD, 1996 | DBSCAN |
| [MCINNES-2017] | McInnes et al., "hdbscan: Hierarchical density based clustering," JOSS, 2017 | HDBSCAN |
| [ICAO-ADSB] | ICAO Annex 10, Vol IV, "Surveillance and Collision Avoidance Systems" | ADS-B standard |
| [ITU-M1371] | ITU-R M.1371-5, "Technical characteristics for an automatic identification system" | AIS standard |
| [NASA-CPR] | NASA Langley, "A Formal Analysis of the Compact Position Reporting Algorithm," 2017 | CPR analysis |
| [MOVABLE-TYPE] | Veness, "Calculate distance, bearing and more between Latitude/Longitude points," movable-type.co.uk | Bearing formulas |
| [BAR-SHALOM] | Bar-Shalom et al., "Estimation with Applications to Tracking and Navigation," Wiley, 2001 | Multi-sensor tracking |
| [SNYDER-1987] | Snyder, "Map Projections — A Working Manual," USGS Professional Paper 1395, 1987 | Map projections |
| [EPSG] | EPSG Geodetic Parameter Registry, epsg.io | CRS registry |

---

<!-- INTEGRATION NOTES
- This research feeds into rfc-section-geospatial-math.md (TSG.30)
- WGS84 parameters are normative (from DoD NIMA TR 8350.2)
- All distance formulas verified against movable-type.co.uk implementations
- H3 resolution table from h3geo.org official documentation
- S2 level table from s2geometry.io documentation
- CPR decoding from ICAO Annex 10 and NASA CPR formal analysis
- AIS protocol from ITU-R M.1371-5
-->
