# RFC Section TSG.30: Geospatial Mathematics

```
Section:       TSG.30 — Geospatial Mathematics
Parent RFC:    Tsingou Platform Specification
Status:        DRAFT
Author:        Val (dsp-specialist)
Created:       2026-02-18
Research Base: research-geospatial-math.md (12 sections, 17 references)
```

> This section establishes the geodetic, geometric, and algorithmic foundations
> for all geospatial computation within the Tsingou SIGINT visualization platform.
> Every position display, bearing line, geofence boundary, spatial query, and
> target track traces to the mathematical models defined herein. Implementations
> MUST satisfy these geodetic and algorithmic constraints; deviations require
> explicit justification against the cited standards. The key words "MUST",
> "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" are to be interpreted as
> described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [Scope and Applicability](#1-scope-and-applicability)
2. [Geodetic Reference Systems](#2-geodetic-reference-systems)
3. [Coordinate Transformations](#3-coordinate-transformations)
4. [Distance Computation](#4-distance-computation)
5. [Bearing and Azimuth Calculation](#5-bearing-and-azimuth-calculation)
6. [Map Projections](#6-map-projections)
7. [Spatial Indexing](#7-spatial-indexing)
8. [R-tree Spatial Queries](#8-r-tree-spatial-queries)
9. [Geofencing Algorithms](#9-geofencing-algorithms)
10. [Spatial Clustering](#10-spatial-clustering)
11. [Position Surveillance Protocols](#11-position-surveillance-protocols)
12. [Multi-Sensor Position Fusion](#12-multi-sensor-position-fusion)
13. [Geospatial Error Models](#13-geospatial-error-models)
14. [Tsingou Integration Mapping](#14-tsingou-integration-mapping)
15. [Normative Requirements Summary](#15-normative-requirements-summary)
16. [Bibliography](#16-bibliography)

---

## 1. Scope and Applicability

### 1.1 Purpose

This section defines the geodetic models, distance algorithms, spatial indexing
structures, and position fusion methods required by the Tsingou platform to place
signals, emitters, platforms, and tracks in geographic space. SIGINT operations
are inherently spatial — every intercepted signal has a bearing, every emitter
has a location (known or estimated), and every platform follows a track through
geographic coordinates.

### 1.2 Architecture Context

Geospatial data flows through the Tsingou architecture at multiple levels:

```
┌──────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Position Sources │────▶│  Fusion Engine    │────▶│  Visualization      │
│                  │     │                  │     │                      │
│  - ADS-B receiver│     │  - Track fusion  │     │  - Map display       │
│  - AIS receiver  │     │  - DF cross-fix  │     │  - Track plots       │
│  - DF stations   │     │  - Error ellipses│     │  - Geofence overlays │
│  - TDOA systems  │     │  - Clustering    │     │  - Bearing lines     │
│  - GPS/GNSS      │     │  - Association   │     │  - Heat maps         │
└──────────────────┘     └──────────────────┘     └─────────────────────┘
         Sensors                Processing              Display
```

Position data is published to NATS subjects:
- `tsingou.geo.adsb.*` — ADS-B aircraft positions
- `tsingou.geo.ais.*` — AIS vessel positions
- `tsingou.geo.df.*` — Direction finding bearings
- `tsingou.geo.track.*` — Fused tracks
- `tsingou.geo.fence.*` — Geofence events (enter/exit)

### 1.3 Normative Scope

The geodetic definitions, distance formulas, and error models in this section
are normative. All geospatial computations within Tsingou MUST conform to the
WGS84 reference frame [WGS84]. Spatial indexing and clustering algorithm choices
are RECOMMENDED but MAY be substituted with equivalent implementations meeting
the stated performance requirements.

---

## 2. Geodetic Reference Systems

### 2.1 WGS84 Reference Ellipsoid

All geospatial computations in Tsingou MUST use the World Geodetic System 1984
(WGS84) reference ellipsoid [WGS84] as the geodetic datum. The defining
parameters are:

Table 2-1: WGS84 Ellipsoid Parameters

| Parameter | Symbol | Value | Unit |
|-----------|--------|-------|------|
| Semi-major axis | a | 6,378,137.0 | m |
| Flattening | f | 1/298.257223563 | — |
| Semi-minor axis | b = a(1-f) | 6,356,752.3142 | m |
| First eccentricity squared | e^2 = 2f - f^2 | 0.00669437999014 | — |
| Second eccentricity squared | e'^2 = e^2/(1-e^2) | 0.00673949674228 | — |
| Angular velocity | omega | 7.292115 * 10^{-5} | rad/s |
| Gravitational constant | GM | 3.986005 * 10^{14} | m^3/s^2 |

Implementations MUST NOT substitute a spherical Earth model where the WGS84
ellipsoid is specified, except where explicitly permitted for computational
efficiency with documented accuracy bounds (Section 4.2).

### 2.2 EPSG Coordinate Reference System Codes

Implementations MUST use standard EPSG codes [EPSG] to identify coordinate
reference systems:

Table 2-2: Required CRS Support

| EPSG Code | Name | Type | Requirement |
|-----------|------|------|-------------|
| 4326 | WGS 84 (Geographic) | Geographic 2D | MUST |
| 4979 | WGS 84 (Geographic 3D) | Geographic 3D | MUST |
| 4978 | WGS 84 (Geocentric) | Geocentric (ECEF) | MUST |
| 3857 | WGS 84 / Pseudo-Mercator | Projected | MUST |
| 326xx | WGS 84 / UTM zone xxN | Projected | SHOULD |
| 327xx | WGS 84 / UTM zone xxS | Projected | SHOULD |

Implementations MUST correctly transform between any two supported CRS codes.
The PROJ library [PROJ] is the RECOMMENDED transformation engine.

### 2.3 Geodetic Coordinate Conventions

The following conventions MUST be observed for geodetic coordinates:

| Convention | Definition | Normative Level |
|-----------|-----------|-----------------|
| Latitude range | -90.0 to +90.0 degrees | MUST |
| Longitude range | -180.0 to +180.0 degrees | MUST |
| Positive latitude | North of equator | MUST |
| Positive longitude | East of prime meridian | MUST |
| Coordinate order | (latitude, longitude) in APIs | MUST |
| Coordinate order | [longitude, latitude] in GeoJSON | MUST (per RFC 7946) |
| Angular units | Decimal degrees for storage | MUST |
| Altitude reference | Meters above WGS84 ellipsoid | MUST |

The conflicting coordinate order conventions between geographic APIs (lat, lon)
and GeoJSON (lon, lat) are a known interoperability hazard. Implementations MUST
document which convention is used at each interface boundary.

### 2.4 Radii of Curvature

The WGS84 ellipsoid has latitude-dependent radii of curvature required for
accurate local-area computations:

**Meridional radius (north-south curvature):**

```
M(phi) = a * (1 - e^2) / (1 - e^2 * sin^2(phi))^{3/2}
```

**Prime vertical radius (east-west curvature):**

```
N(phi) = a / (1 - e^2 * sin^2(phi))^{1/2}
```

Table 2-3: Radii of Curvature at Key Latitudes

| Latitude | M (meters) | N (meters) | Mean R (meters) |
|----------|-----------|-----------|----------------|
| 0 deg (equator) | 6,335,439 | 6,378,137 | 6,356,752 |
| 30 deg | 6,351,377 | 6,383,482 | 6,367,381 |
| 45 deg | 6,367,381 | 6,388,838 | 6,378,101 |
| 60 deg | 6,383,453 | 6,394,209 | 6,388,824 |
| 90 deg (pole) | 6,399,594 | 6,399,594 | 6,399,594 |

Implementations MUST use the latitude-dependent radii of curvature for
computations requiring accuracy better than 1%. The mean Earth radius
(R = 6,371,008.8 m) MAY be used for display-level approximations.

---

## 3. Coordinate Transformations

### 3.1 Geodetic to ECEF

The transformation from geodetic coordinates (phi, lambda, h) to Earth-Centered
Earth-Fixed Cartesian coordinates (X, Y, Z) is defined as:

```
X = (N(phi) + h) * cos(phi) * cos(lambda)
Y = (N(phi) + h) * cos(phi) * sin(lambda)
Z = (N(phi) * (1 - e^2) + h) * sin(phi)
```

where N(phi) is the prime vertical radius of curvature (Section 2.4).

This transformation is exact (no iteration required).

### 3.2 ECEF to Geodetic

The inverse transformation is not closed-form and requires iterative solution.
The Bowring method [WGS84] is RECOMMENDED for its rapid convergence:

```
Step 1: Compute auxiliary values
  p = sqrt(X^2 + Y^2)
  theta = atan2(Z * a, p * b)

Step 2: Compute geodetic latitude
  phi = atan2(Z + e'^2 * b * sin^3(theta),
              p - e^2 * a * cos^3(theta))

Step 3: Compute longitude
  lambda = atan2(Y, X)

Step 4: Compute ellipsoidal height
  N = a / sqrt(1 - e^2 * sin^2(phi))
  h = p / cos(phi) - N
```

Bowring's method achieves sub-millimeter accuracy in a single iteration for
points within 100 km of the Earth's surface. Implementations MUST achieve
position accuracy of < 1 mm for the ECEF-to-geodetic transformation.

### 3.3 ECEF to Local Tangent Plane (ENU)

The East-North-Up (ENU) coordinate system is a local tangent plane system
centered at a reference point (phi_0, lambda_0, h_0). The transformation from
ECEF offsets (dX, dY, dZ) to ENU coordinates (dE, dN, dU) is:

```
[dE]   [-sin(lambda_0)             cos(lambda_0)            0         ]   [dX]
[dN] = [-sin(phi_0)*cos(lambda_0)  -sin(phi_0)*sin(lambda_0)  cos(phi_0)]   [dY]
[dU]   [ cos(phi_0)*cos(lambda_0)   cos(phi_0)*sin(lambda_0)  sin(phi_0)]   [dZ]
```

The ENU system is used for all local-area geospatial computations including
bearing calculation, range computation, and elevation angle determination.

### 3.4 ENU to Azimuth-Elevation-Range (AER)

From ENU coordinates, the azimuth, elevation, and slant range are computed as:

```
Slant range:  r  = sqrt(dE^2 + dN^2 + dU^2)
Azimuth:      az = atan2(dE, dN)              (0 = North, clockwise)
Elevation:    el = atan2(dU, sqrt(dE^2 + dN^2))
```

The AER coordinate system is fundamental to radar and direction-finding (DF)
operations. Implementations MUST support AER computation from any two geodetic
positions.

### 3.5 Transformation Accuracy Requirements

Table 3-1: Transformation Accuracy Requirements

| Transformation | Required Accuracy | Normative Level |
|---------------|-------------------|-----------------|
| Geodetic to ECEF | Exact (analytical) | MUST |
| ECEF to Geodetic | < 1 mm | MUST |
| Geodetic to ENU | < 1 mm (within 100 km) | MUST |
| ENU to AER | < 0.001 degree bearing, < 1 m range | MUST |
| CRS to CRS (via PROJ) | Per EPSG accuracy specification | SHOULD |

---

## 4. Distance Computation

### 4.1 Spherical Distance (Haversine Formula)

The Haversine formula computes the great-circle distance between two points on
a sphere, using the numerically stable haversine formulation:

```
a = sin^2((phi_2 - phi_1)/2) +
    cos(phi_1) * cos(phi_2) * sin^2((lambda_2 - lambda_1)/2)

c = 2 * atan2(sqrt(a), sqrt(1 - a))

d = R * c
```

where R = 6,371,008.8 m (mean Earth radius) and all angles are in radians.

Table 4-1: Haversine Accuracy Characteristics

| Property | Value |
|----------|-------|
| Earth model | Sphere (mean radius) |
| Maximum error vs ellipsoid | ~0.3% (~3 km per 1000 km) |
| Worst-case latitude | Pole-to-equator paths |
| Numerical stability | Stable for all distances |
| Computation | 2 atan2, 4 sin, 2 cos, 1 sqrt |

Implementations MAY use the Haversine formula for:
- Display-level distance calculations where 0.3% error is acceptable
- Real-time distance computation where speed is more important than precision
- Distance thresholding (pass/fail decisions with adequate margin)

Implementations MUST NOT use the Haversine formula for:
- Precision geolocation (DF cross-fix, TDOA)
- Survey-grade distance computation
- Distance calculations where the error budget is < 1%

### 4.2 Ellipsoidal Distance (Vincenty's Inverse Formula)

Vincenty's inverse formula [VINCENTY-1975] computes the geodesic distance on the
WGS84 ellipsoid with sub-millimeter accuracy:

```
Input:  Points (phi_1, lambda_1) and (phi_2, lambda_2)
Output: Geodesic distance s, forward azimuth alpha_1, back azimuth alpha_2

Reduced latitudes:
  U_1 = atan((1 - f) * tan(phi_1))
  U_2 = atan((1 - f) * tan(phi_2))
  L = lambda_2 - lambda_1

Iterative solution (initialize lambda = L):
  Repeat until |lambda_new - lambda| < 10^{-12}:
    sin_sigma = sqrt((cos(U_2)*sin(lambda))^2 +
                (cos(U_1)*sin(U_2) - sin(U_1)*cos(U_2)*cos(lambda))^2)
    cos_sigma = sin(U_1)*sin(U_2) + cos(U_1)*cos(U_2)*cos(lambda)
    sigma = atan2(sin_sigma, cos_sigma)
    sin_alpha = cos(U_1)*cos(U_2)*sin(lambda) / sin_sigma
    cos2_alpha = 1 - sin_alpha^2
    cos_2sigma_m = cos_sigma - 2*sin(U_1)*sin(U_2) / cos2_alpha
    C = (f/16) * cos2_alpha * (4 + f*(4 - 3*cos2_alpha))
    lambda = L + (1 - C)*f*sin_alpha *
             (sigma + C*sin_sigma*(cos_2sigma_m +
              C*cos_sigma*(-1 + 2*cos_2sigma_m^2)))

Distance computation:
  u2 = cos2_alpha * (a^2 - b^2) / b^2
  A = 1 + (u2/16384) * (4096 + u2*(-768 + u2*(320 - 175*u2)))
  B = (u2/1024) * (256 + u2*(-128 + u2*(74 - 47*u2)))
  delta_sigma = B*sin_sigma*(cos_2sigma_m + (B/4)*(cos_sigma*
                (-1+2*cos_2sigma_m^2) - (B/6)*cos_2sigma_m*
                (-3+4*sin_sigma^2)*(-3+4*cos_2sigma_m^2)))
  s = b * A * (sigma - delta_sigma)
```

Table 4-2: Vincenty Algorithm Properties

| Property | Value |
|----------|-------|
| Earth model | WGS84 ellipsoid |
| Accuracy | < 0.5 mm |
| Convergence | 3-5 iterations (typical) |
| Failure case | Nearly antipodal points (convergence failure) |
| Fallback | Karney's algorithm [KARNEY-2013] for antipodal cases |

Implementations MUST use Vincenty's formula (or Karney's algorithm) for all
precision distance calculations. Implementations MUST detect convergence failure
and fall back to Karney's algorithm for nearly antipodal points.

### 4.3 Flat Earth Approximation

For very short distances (< 10 km), a planar approximation using the local
radii of curvature provides adequate accuracy:

```
dN = (phi_2 - phi_1) * M(phi_mean)        (north-south distance)
dE = (lambda_2 - lambda_1) * N(phi_mean) * cos(phi_mean)   (east-west distance)
d = sqrt(dN^2 + dE^2)
```

where M and N are the meridional and prime vertical radii (Section 2.4),
and phi_mean = (phi_1 + phi_2) / 2.

Table 4-3: Flat Earth Approximation Error

| Distance | Maximum Error |
|----------|--------------|
| 1 km | < 0.001% |
| 10 km | < 0.01% |
| 100 km | < 1% |
| 1000 km | > 5% (unacceptable) |

Implementations MAY use the flat Earth approximation for local-area computations
where the distance between points is known to be < 10 km.

### 4.4 Distance Algorithm Selection

Table 4-4: Distance Algorithm Requirements

| Use Case | RECOMMENDED Algorithm | Normative Level |
|----------|----------------------|-----------------|
| Precision geolocation (DF, TDOA) | Vincenty/Karney | MUST |
| Display distance annotations | Haversine | MAY |
| Geofence threshold checks | Haversine (with margin) | SHOULD |
| Local-area (< 10 km) | Flat Earth | MAY |
| Track smoothing | Vincenty | SHOULD |
| Database spatial queries | Index-native (H3/S2 distance) | SHOULD |

---

## 5. Bearing and Azimuth Calculation

### 5.1 Initial Bearing (Forward Azimuth)

The initial (forward) bearing from point 1 to point 2 on a sphere is the angle
measured clockwise from true north at the starting point [MOVABLE-TYPE]:

```
theta = atan2(sin(lambda_2 - lambda_1) * cos(phi_2),
              cos(phi_1)*sin(phi_2) -
              sin(phi_1)*cos(phi_2)*cos(lambda_2 - lambda_1))

bearing = (theta * 180/pi + 360) mod 360    (normalize to 0-360)
```

This formula assumes a spherical Earth. For ellipsoidal bearing, Vincenty's
inverse formula (Section 4.2) provides the forward azimuth alpha_1 as a
byproduct of the distance computation.

### 5.2 Final Bearing (Back Azimuth)

The bearing at the destination point (looking back toward the start) differs
from the initial bearing because great circle paths do not maintain constant
bearing (except along meridians and the equator):

```
back_azimuth = (bearing_from_2_to_1 + 180) mod 360
```

### 5.3 Destination Point Given Bearing and Distance

The forward geodesic problem: given a starting point, initial bearing, and
distance, compute the destination point.

**Spherical solution:**

```
phi_2 = asin(sin(phi_1)*cos(d/R) +
             cos(phi_1)*sin(d/R)*cos(theta))

lambda_2 = lambda_1 + atan2(sin(theta)*sin(d/R)*cos(phi_1),
                              cos(d/R) - sin(phi_1)*sin(phi_2))
```

**Ellipsoidal solution:** Vincenty's direct formula provides sub-millimeter
accuracy. Implementations MUST use the ellipsoidal solution for DF bearing
projection (Line of Bearing display).

### 5.4 Line of Bearing (LOB)

A Line of Bearing from a DF station extends from the station position along the
measured bearing to an indefinite distance. In the display, the LOB is rendered
as a great circle arc.

**LOB representation:**

```
LOB = {
  origin: (phi_station, lambda_station),
  bearing: theta (degrees true north),
  uncertainty: sigma_theta (degrees, 1-sigma),
  max_range: d_max (meters, display limit)
}
```

The uncertainty sigma_theta defines the LOB angular width. The resulting
position uncertainty at range d is:

```
cross_range_error = d * tan(sigma_theta)
```

Table 5-1: LOB Cross-Range Error

| DF Accuracy (1-sigma) | Error at 10 km | Error at 50 km | Error at 100 km |
|-----------------------|---------------|---------------|----------------|
| 0.5 deg | 87 m | 436 m | 873 m |
| 1.0 deg | 175 m | 873 m | 1,745 m |
| 2.0 deg | 349 m | 1,745 m | 3,491 m |
| 5.0 deg | 875 m | 4,364 m | 8,749 m |

### 5.5 Bearing Intersection (Cross-Fix)

When two or more DF stations observe the same emitter, the LOBs intersect at
the estimated emitter position. The cross-fix accuracy depends on:

1. **Individual LOB accuracy** (sigma_theta of each station)
2. **Intersection geometry** (angle between LOBs — 90 degrees is optimal)
3. **Number of LOBs** (2 minimum, 3+ enables overdetermined solution)

**Two-LOB intersection on a sphere:**

```
Given: Station A at (phi_A, lambda_A) with bearing theta_A
       Station B at (phi_B, lambda_B) with bearing theta_B

1. Compute the two intersection points of the great circles
2. Select the intersection closest to the expected area
```

For overdetermined cases (3+ LOBs), a weighted least-squares solution in the
local tangent plane minimizes the sum of squared bearing residuals.

Implementations MUST support cross-fix computation from 2 or more LOBs.
Implementations SHOULD compute and display the error ellipse at the cross-fix
point (Section 13.2).

---

## 6. Map Projections

### 6.1 Projection Requirements

Implementations MUST support at least the following map projections:

Table 6-1: Required Map Projection Support

| Projection | EPSG | Property | Use Case | Requirement |
|-----------|------|----------|----------|-------------|
| Web Mercator | 3857 | Conformal | Base map tiles | MUST |
| UTM (per zone) | 326xx/327xx | Conformal | Local-area metric display | SHOULD |
| Azimuthal equidistant | — | Equidistant | Range/bearing display | SHOULD |
| Polar stereographic | 3031/3995 | Conformal | Polar operations | MAY |
| Lambert conformal conic | Various | Conformal | Aeronautical charts | MAY |

### 6.2 Web Mercator (EPSG:3857)

The Web Mercator projection is the universal standard for tiled web maps:

```
x = a * lambda
y = a * ln(tan(pi/4 + phi/2))
```

where a = 6,378,137 m (WGS84 semi-major axis, used as sphere radius).

**Tile coordinates at zoom level z:**

```
tile_x = floor((lambda_deg + 180) / 360 * 2^z)
tile_y = floor((1 - ln(tan(phi_rad) + sec(phi_rad)) / pi) / 2 * 2^z)
```

**Valid latitude range:** -85.051129 to +85.051129 degrees (the square-tile
constraint truncates the projection before the poles).

Table 6-2: Web Mercator Zoom Levels

| Zoom | Tile Count | Meters/Pixel (equator) | Coverage |
|------|-----------|----------------------|---------|
| 0 | 1 | 156,543 | Whole world |
| 5 | 1,024 | 4,891 | Continental |
| 10 | 1,048,576 | 153 | Metropolitan |
| 15 | 1,073,741,824 | 4.77 | Block-level |
| 18 | 68,719,476,736 | 0.60 | Building-level |

Implementations MUST correctly render geospatial overlays (LOBs, tracks,
geofences) in Web Mercator projection, accounting for the conformal distortion
at high latitudes.

### 6.3 Universal Transverse Mercator (UTM)

UTM divides the globe into 60 zones, each 6 degrees of longitude wide:

```
Zone number = floor((lambda_deg + 180) / 6) + 1
Central meridian = (zone - 1) * 6 - 180 + 3
```

**UTM coordinates:**
- Easting: meters from central meridian + 500,000 m false easting
- Northing: meters from equator (+ 10,000,000 m false northing in S hemisphere)
- Scale factor at central meridian: k_0 = 0.9996
- Maximum distortion: < 0.04% within any zone

Implementations SHOULD support UTM for local-area operations where metric
coordinates simplify distance and area calculations.

### 6.4 Azimuthal Equidistant Projection

The azimuthal equidistant projection preserves true distances from the center
point. Range rings displayed in this projection are metrically accurate.

```
c = arccos(sin(phi_0)*sin(phi) + cos(phi_0)*cos(phi)*cos(lambda - lambda_0))
k = c / sin(c)
x = k * cos(phi) * sin(lambda - lambda_0)
y = k * (cos(phi_0)*sin(phi) - sin(phi_0)*cos(phi)*cos(lambda - lambda_0))
```

This projection is RECOMMENDED for DF station displays where range rings and
bearing lines must be geometrically accurate relative to the station.

### 6.5 Projection Selection for SIGINT Operations

Table 6-3: Projection Selection Guide

| Operation | RECOMMENDED Projection | Rationale |
|-----------|----------------------|-----------|
| Web map base layer | Web Mercator (3857) | Universal tile support |
| Range/bearing overlay | Azimuthal equidistant | True distance from sensor |
| Local area operations | UTM zone | Metric coordinates |
| Track plotting | Web Mercator (with distortion awareness) | Standard display |
| Area measurement | Equal-area (Albers) | True area preservation |
| Polar operations | Polar stereographic | Conformal at high latitudes |

Implementations MUST NOT compute distances or areas directly in Web Mercator
projected coordinates (the distortion is severe at non-equatorial latitudes).
All distance and area computations MUST use geodetic coordinates or appropriate
local projections.

---

## 7. Spatial Indexing

### 7.1 H3 Hexagonal Hierarchical Index

The H3 spatial index [UBER-H3] tessellates the globe with hexagonal cells
using an icosahedral projection with aperture-7 hierarchical subdivision:

```
122 base cells (resolution 0): 110 hexagons + 12 pentagons
Each parent subdivided into ~7 children (aperture 7)
16 resolution levels (0-15)
64-bit integer cell index
```

Table 7-1: H3 Resolution Properties

| Resolution | Avg Cell Area | Avg Edge Length | Total Cells |
|-----------|--------------|----------------|-------------|
| 0 | 4,357,449 km^2 | 1,108 km | 122 |
| 1 | 609,788 km^2 | 419 km | 842 |
| 3 | 12,393 km^2 | 59.8 km | 41,162 |
| 5 | 252.9 km^2 | 8.5 km | 2,016,842 |
| 7 | 5.161 km^2 | 1.22 km | 98,825,162 |
| 9 | 0.1053 km^2 | 174 m | 4.84 * 10^9 |
| 11 | 0.00215 km^2 | 25 m | 2.37 * 10^{11} |
| 13 | 4.4 * 10^{-5} km^2 | 3.3 m | 1.17 * 10^{13} |
| 15 | 9.0 * 10^{-7} km^2 | 0.5 m | 5.70 * 10^{14} |

**Key properties:**
- Near-uniform cell area across the globe (< 1.2:1 variation)
- Equidistant neighbors (6 per hexagon, uniform distance)
- Hierarchical: parent-child relationship (approximate containment)
- Efficient k-ring queries (concentric hexagonal rings)

**H3 operations required by Tsingou:**

| Operation | H3 Function | Use Case |
|-----------|-------------|----------|
| Point to cell | `latLngToCell` | Index position data |
| Cell to boundary | `cellToBoundary` | Display hex outlines |
| k-ring | `gridDisk` | Proximity search |
| Hierarchical parent | `cellToParent` | Zoom-level aggregation |
| Compact/uncompact | `compactCells` | Efficient coverage sets |
| Distance (grid) | `gridDistance` | Approximate hex distance |

Implementations MUST support H3 at resolutions 0 through 12 for spatial
aggregation and indexing of signal intelligence data.

### 7.2 S2 Geometry

The S2 geometry library [S2-GEOMETRY] projects the sphere onto a cube and
recursively subdivides each face using a quadtree with Hilbert curve ordering:

```
6 cube faces
30 subdivision levels
64-bit cell ID (face + position + level)
Strict hierarchical containment (parent always contains children)
```

Table 7-2: S2 Cell Level Properties

| Level | Avg Cell Area | Min Edge | Max Edge |
|-------|--------------|----------|----------|
| 0 | 85,011,012 km^2 | 7,842 km | 7,842 km |
| 5 | 83,019 km^2 | 197 km | 280 km |
| 10 | 316 km^2 | 12 km | 18 km |
| 14 | 316,234 m^2 | 401 m | 579 m |
| 18 | 1,235 m^2 | 25 m | 36 m |
| 22 | 4.83 m^2 | 1.6 m | 2.3 m |
| 26 | 0.019 m^2 | 0.10 m | 0.14 m |
| 30 | ~0.74 cm^2 | 0.006 m | 0.009 m |

**Key properties:**
- Strict containment hierarchy (no aperture approximation)
- Hilbert curve ordering (excellent spatial locality)
- Higher area variation than H3 (~5.2:1)
- No pentagons (cube projection)

**S2 operations required by Tsingou:**

| Operation | S2 Function | Use Case |
|-----------|-------------|----------|
| Point to cell | `S2CellId::from_lat_lng` | Index position data |
| Region covering | `S2RegionCoverer` | Geofence to cell set |
| Cell union | `S2CellUnion` | Efficient area representation |
| Contains test | `S2Cell::contains` | Spatial containment |
| Distance | `S2Earth::getDistance` | Spherical distance |

Implementations SHOULD support S2 for region covering (geofence cell decomposition)
and range queries where strict containment hierarchy is required.

### 7.3 Geohash

Geohash encodes a location by interleaving latitude and longitude bits and
encoding with base-32. Each additional character provides approximately 2.5 bits
of latitude precision and 2.5 bits of longitude precision.

Table 7-3: Geohash Precision

| Characters | Lat Bits | Lon Bits | Cell Width | Cell Height |
|-----------|---------|---------|-----------|------------|
| 1 | 2 | 3 | 5,000 km | 5,000 km |
| 3 | 7 | 8 | 156 km | 156 km |
| 5 | 12 | 13 | 4.9 km | 4.9 km |
| 7 | 17 | 18 | 153 m | 153 m |
| 9 | 22 | 23 | 4.8 m | 4.8 m |
| 12 | 30 | 30 | 0.019 m | 0.019 m |

**Key properties:**
- String prefix = spatial containment (simple prefix queries)
- Z-order curve (not Hilbert — less optimal locality)
- Rectangular cells (extreme elongation near poles)
- Edge discontinuity (adjacent cells may have very different prefixes)

Implementations MAY use Geohash for NATS subject-based spatial partitioning
(e.g., `tsingou.geo.adsb.{geohash5}.*`).

### 7.4 Spatial Index Selection

Table 7-4: Spatial Index Comparison and Recommendation

| Feature | H3 | S2 | Geohash | R-tree |
|---------|-----|-----|---------|--------|
| Cell shape | Hexagon | Quad (spherical) | Rectangle | MBR |
| Area uniformity | Excellent | Moderate | Poor | N/A |
| Neighbor uniformity | Excellent | Good | Fair | N/A |
| Hierarchy | Approximate | Strict | Strict | Balanced tree |
| Spatial locality | Good | Excellent | Fair | Good |
| Index type | 64-bit int | 64-bit int | String | Tree |
| Dynamic insert | O(1) | O(1) | O(1) | O(log n) |
| Range query | k-ring O(k) | Covering O(k) | Prefix O(1) | O(log n + k) |
| RECOMMENDED for | Aggregation, heatmaps | Coverage, geofencing | Subject routing | Geometry queries |

Implementations MUST support at least one discrete global grid system (H3 or S2)
for spatial indexing of position data. H3 is RECOMMENDED as the primary spatial
index for its superior cell uniformity and neighbor semantics.

---

## 8. R-tree Spatial Queries

### 8.1 R-tree Structure

R-trees [GUTTMAN-1984] are balanced search trees for spatial data. Each node
stores between m and M entries. Each entry contains a Minimum Bounding Rectangle
(MBR) and a pointer to a child node (internal) or spatial object (leaf).

**Invariants:**
- Height-balanced (all leaves at the same depth)
- Each non-root node: m <= entries <= M (m <= ceil(M/2))
- Root: 2 <= entries <= M (unless it is a leaf)
- Every leaf MBR tightly bounds its spatial object
- Every internal MBR tightly bounds the MBRs of its children

### 8.2 Search Operations

**Intersection query** (find all objects intersecting query rectangle Q):

```
Search(node T, query Q):
  if T is a leaf:
    return {E in T : E.MBR intersects Q}
  else:
    result = {}
    for each entry E in T:
      if E.MBR intersects Q:
        result = result union Search(E.child, Q)
    return result
```

**k-Nearest Neighbor (k-NN) query:**

```
kNN(node T, query point P, k):
  priority_queue = {(distance(P, T.MBR), T)}
  result = []
  while priority_queue not empty and |result| < k:
    (dist, node) = priority_queue.dequeue_min()
    if node is leaf entry:
      result.append(node)
    else:
      for each entry E in node:
        priority_queue.enqueue((distance(P, E.MBR), E))
  return result
```

### 8.3 R*-tree Improvements

The R*-tree [BECKMANN-1990] improves upon the original R-tree with:

1. **Overlap minimization** for leaf-level splits (reduces query ambiguity)
2. **Forced reinsertion** on overflow (30% of entries, improves structure)
3. **Combined optimization criteria** (area, overlap, margin, perimeter)

R*-trees provide 10-30% better query performance than R-trees for typical
geospatial datasets. Implementations SHOULD use R*-tree or STR bulk-loaded
R-tree for spatial query support.

### 8.4 Bulk Loading (Sort-Tile-Recursive)

For static or slowly-changing spatial datasets, STR bulk loading produces
near-optimal R-trees:

```
STR(objects, M):
  1. Sort objects by x-coordinate of centroid
  2. Partition into ceil(sqrt(n/M)) vertical slabs
  3. Within each slab, sort by y-coordinate of centroid
  4. Partition into groups of M -> leaf nodes
  5. Recursively build internal levels from leaf MBRs
```

STR-loaded R-trees have ~10% less MBR overlap than incrementally built R*-trees,
resulting in faster queries.

### 8.5 Complexity Analysis

Table 8-1: R-tree Operation Complexity

| Operation | Average Case | Worst Case | Notes |
|-----------|-------------|-----------|-------|
| Point query | O(log_M n) | O(n) | Worst case: all MBRs overlap |
| Range query | O(log_M n + k) | O(n) | k = result count |
| k-NN query | O(log_M n * k) | O(n * k) | Priority queue variant |
| Insertion | O(log_M n) | O(n) | Cascade splits rare |
| Deletion | O(log_M n) | O(n) | May trigger reinsertion |
| Bulk load (STR) | O(n log n) | O(n log n) | Sort-dominated |

Implementations SHOULD use R-tree spatial indexing for geometry-based queries
(polygon intersection, nearest neighbor) on dynamic datasets such as track
positions.

---

## 9. Geofencing Algorithms

### 9.1 Circular Geofence

A circular geofence is defined by a center point and radius. A position is
inside the geofence if and only if its distance from the center is less than
the radius:

```
inside = distance(point, center) < radius
```

Implementations MUST use the Haversine formula (Section 4.1) or better for
circular geofence distance computation. Euclidean distance in projected
coordinates MUST NOT be used for geofences with radius > 1 km.

### 9.2 Polygonal Geofence (Ray Casting)

The ray casting algorithm determines whether a point lies inside an arbitrary
polygon by counting the number of intersections between a ray from the point
and the polygon boundary:

```
RayCast(point P, polygon V[0..n-1]):
  inside = false
  j = n - 1
  for i = 0 to n-1:
    if ((V[i].y > P.y) != (V[j].y > P.y)) and
       (P.x < (V[j].x - V[i].x)*(P.y - V[i].y)/(V[j].y - V[i].y) + V[i].x):
      inside = !inside
    j = i
  return inside
```

**Properties:**
- O(n) per query, where n = number of polygon vertices
- Handles concave polygons correctly
- Handles polygons with holes (test against outer boundary and inner boundaries)
- Edge cases (point on vertex or edge) require explicit handling

### 9.3 Winding Number Algorithm

The winding number algorithm counts the number of times the polygon winds
around the test point. Non-zero winding number indicates the point is inside:

```
WindingNumber(point P, polygon V[0..n-1]):
  wn = 0
  for i = 0 to n-1:
    j = (i + 1) mod n
    if V[i].y <= P.y:
      if V[j].y > P.y:
        if isLeft(V[i], V[j], P) > 0:
          wn += 1
    else:
      if V[j].y <= P.y:
        if isLeft(V[i], V[j], P) < 0:
          wn -= 1
  return wn != 0

isLeft(A, B, P) = (B.x - A.x)*(P.y - A.y) - (P.x - A.x)*(B.y - A.y)
```

**Advantages over ray casting:**
- Correctly handles self-intersecting polygons
- No division operations (numerically robust)
- Same O(n) complexity

Implementations MUST support polygonal geofencing using either ray casting or
winding number algorithm.

### 9.4 Grid-Accelerated Geofencing

For high-frequency position updates against static geofences, a grid overlay
reduces average query complexity:

```
Preprocessing (per geofence):
  1. Compute bounding box of polygon
  2. Overlay uniform grid (cell size ~ polygon edge length / 10)
  3. Classify each cell: INSIDE, OUTSIDE, or BOUNDARY
  4. For BOUNDARY cells, store relevant polygon edges

Query:
  1. Map point to grid cell: O(1)
  2. If INSIDE or OUTSIDE: return immediately: O(1)
  3. If BOUNDARY: test against stored edges: O(k), k << n
```

Average query complexity reduces from O(n) to approximately O(1) for most
positions. Implementations SHOULD use grid-accelerated geofencing when geofences
are static and query rates exceed 1000 positions/second.

### 9.5 Spherical Geofencing Considerations

For geofences defined in geographic coordinates:

1. Geofence edges SHOULD be interpreted as great circle arcs (not rhumb lines)
   for geofences spanning > 1 degree of latitude or longitude
2. The point-in-polygon test SHOULD be performed in a local tangent plane (ENU)
   projection centered on the geofence centroid for geofences spanning < 10 degrees
3. For global-scale geofences, S2 region covering (Section 7.2) SHOULD be used
   to decompose the geofence into a set of S2 cells, enabling O(1) containment
   tests via cell ID comparison

### 9.6 Geofence Event Generation

When a tracked entity crosses a geofence boundary, the following events
MUST be generated:

Table 9-1: Geofence Events

| Event | Trigger | Required Data |
|-------|---------|---------------|
| `fence.enter` | Position transitions from outside to inside | track_id, fence_id, timestamp, position |
| `fence.exit` | Position transitions from inside to outside | track_id, fence_id, timestamp, position |
| `fence.dwell` | Entity remains inside for > dwell_threshold | track_id, fence_id, duration |

Implementations MUST debounce geofence events to prevent spurious enter/exit
oscillation when a track follows a geofence boundary. A hysteresis buffer of
at least 2x the position uncertainty SHOULD be applied.

---

## 10. Spatial Clustering

### 10.1 DBSCAN

DBSCAN (Density-Based Spatial Clustering of Applications with Noise)
[ESTER-1996] groups spatially dense points into clusters and identifies
isolated points as noise.

**Parameters:**
- epsilon (eps): maximum neighborhood radius
- MinPts: minimum points to form a dense region

**Point classification:**
- **Core point:** >= MinPts neighbors within distance eps
- **Border point:** within eps of a core point, but < MinPts own neighbors
- **Noise point:** neither core nor border (outlier)

**Algorithm:**

```
DBSCAN(D, eps, MinPts):
  C = 0                           // cluster counter
  for each point P in D:
    if P.visited: continue
    P.visited = true
    N = regionQuery(P, eps)        // find neighbors within eps
    if |N| < MinPts:
      P.label = NOISE
    else:
      C = C + 1
      expandCluster(P, N, C, eps, MinPts)

expandCluster(P, N, C, eps, MinPts):
  P.label = C
  for each point Q in N:
    if not Q.visited:
      Q.visited = true
      N' = regionQuery(Q, eps)
      if |N'| >= MinPts:
        N = N union N'
    if Q.label == UNDEFINED:
      Q.label = C
```

**Complexity:**
- With spatial index (R-tree): O(n log n)
- Without spatial index: O(n^2)

### 10.2 HDBSCAN

HDBSCAN (Hierarchical DBSCAN) [MCINNES-2017] extends DBSCAN to automatically
determine cluster granularity:

1. Build a minimum spanning tree of the mutual reachability distance graph
2. Construct a cluster hierarchy by removing edges in decreasing order
3. Condense the hierarchy using min_cluster_size
4. Extract the most persistent (stable) clusters

**Advantages over DBSCAN:**
- No epsilon parameter to tune
- Handles varying-density clusters
- Produces a cluster persistence hierarchy
- Identifies a natural number of clusters

### 10.3 Spatial Clustering for SIGINT Applications

Table 10-1: Clustering Method Selection

| Use Case | RECOMMENDED Method | Key Parameters |
|----------|-------------------|----------------|
| Emitter geolocation clustering | HDBSCAN | min_cluster_size = 3, metric = haversine |
| Signal density heatmap | DBSCAN + H3 aggregation | eps = H3 res 7 edge (~1.2 km) |
| Track pattern analysis | OPTICS | MinPts = 5 |
| Activity hotspot detection | DBSCAN | eps = application scale |
| Anomalous position detection | DBSCAN (noise points = anomalies) | MinPts = 3 |

**Distance metric for geographic clustering:**

Implementations MUST use the Haversine distance (or Vincenty for precision) as
the distance metric for all geospatial clustering. Euclidean distance on raw
latitude/longitude coordinates MUST NOT be used, as it produces incorrect results
due to the non-uniform scaling of degrees across latitudes:

```
1 degree latitude ~ 111 km (constant)
1 degree longitude ~ 111 km * cos(latitude) (varies from 111 km to 0)
```

---

## 11. Position Surveillance Protocols

### 11.1 ADS-B (Automatic Dependent Surveillance — Broadcast)

ADS-B is the primary aviation surveillance technology. Aircraft broadcast GPS-
derived position on 1090 MHz Extended Squitter (Mode S) [ICAO-ADSB].

#### 11.1.1 Position Message Structure

Table 11-1: ADS-B Airborne Position (Type Code 9-18)

| Field | Bits | Description |
|-------|------|-------------|
| Downlink Format | 5 | DF=17 (Extended Squitter) |
| ICAO Address | 24 | Unique aircraft identifier |
| Type Code | 5 | 9-18 = airborne position |
| Surveillance Status | 2 | Alert, SPI, or temporary alert |
| NIC Supplement | 1 | Navigation Integrity Category |
| Altitude | 12 | Barometric or GNSS altitude |
| CPR Format | 1 | 0 = even, 1 = odd |
| CPR Latitude | 17 | Encoded latitude |
| CPR Longitude | 17 | Encoded longitude |

#### 11.1.2 CPR Decoding

Compact Position Reporting [NASA-CPR] encodes latitude and longitude using
alternating even/odd frames with 17-bit resolution (~5 m precision):

```
Constants:
  N_Z = 15                    (latitude zones from equator to pole)
  dLat_even = 360 / (4*N_Z)  = 6.0 degrees
  dLat_odd  = 360 / (4*N_Z-1) = 6.1017 degrees

Global decode (requires one even + one odd message):
  j = floor(59 * lat_cpr_even - 60 * lat_cpr_odd + 0.5)
  lat_even = dLat_even * (mod(j, 60) + lat_cpr_even)
  lat_odd  = dLat_odd  * (mod(j, 59) + lat_cpr_odd)

Longitude zones:
  NL(lat) = floor(2*pi / arccos(1 - (1-cos(pi/(2*N_Z))) / cos^2(pi*lat/180)))

Longitude decode (select based on most recent message type):
  if NL(lat_even) != NL(lat_odd):
    Position is ambiguous — wait for next pair
  else:
    Compute longitude using NL-derived zone count
```

**Important:** CPR decoding can produce incorrect positions near zone boundaries
[NASA-CPR]. Implementations MUST perform a reasonableness test: the decoded
position MUST be within 180 NM of the previous known position.

#### 11.1.3 Velocity Message (Type Code 19)

| Field | Description | Resolution |
|-------|-------------|------------|
| Groundspeed (subtype 1,2) | East-west and north-south components | 1 knot |
| Airspeed (subtype 3,4) | True or indicated airspeed | 1 knot |
| Heading | True heading | 360/1024 degrees |
| Vertical rate | Climb/descent rate | 64 ft/min |

### 11.2 AIS (Automatic Identification System)

AIS is the maritime surveillance protocol, broadcasting vessel position on VHF
channels (161.975 MHz and 162.025 MHz) [ITU-M1371].

#### 11.2.1 Position Report (Message Types 1, 2, 3)

Table 11-2: AIS Class A Position Report Fields

| Field | Bits | Resolution | Range |
|-------|------|------------|-------|
| MMSI | 30 | — | 9-digit vessel ID |
| Navigation status | 4 | — | 0-15 (underway, moored, etc.) |
| Rate of turn | 8 | 0.01 deg/s | +/- 720 deg/min |
| SOG (Speed Over Ground) | 10 | 0.1 knot | 0-102.2 knots |
| Position accuracy | 1 | — | 0 = low, 1 = high (<10 m) |
| Longitude | 28 | 1/10000 min | +/- 180 degrees |
| Latitude | 27 | 1/10000 min | +/- 90 degrees |
| COG (Course Over Ground) | 12 | 0.1 degree | 0-359.9 degrees |
| True heading | 9 | 1 degree | 0-359 degrees |
| Timestamp | 6 | 1 second | 0-59 (UTC second) |

**Position decoding:**

```
longitude_deg = raw_longitude / 600000.0
latitude_deg  = raw_latitude / 600000.0
sog_knots     = raw_sog / 10.0
cog_deg       = raw_cog / 10.0
```

**Update rates (Class A, speed-dependent):**

| Speed | Update Interval | Condition |
|-------|----------------|-----------|
| At anchor | 3 min | Navigation status = 1 or 5 |
| 0-14 knots | 10 sec | Underway |
| 0-14 knots, changing course | 3.33 sec | Underway, turning |
| 14-23 knots | 6 sec | Underway |
| > 23 knots | 2 sec | Underway |

### 11.3 Multilateration (MLAT)

MLAT determines aircraft position from Time Difference of Arrival (TDOA) of
1090 MHz transponder signals at multiple receivers:

```
For N receivers at known positions (x_i, y_i, z_i), i = 1..N:
  TDOA_{i,j} = (t_i - t_j) * c   (range difference)

Each TDOA defines a hyperboloid. The intersection of (N-1) hyperboloids
gives the position estimate. Minimum N = 4 receivers for 3D position.
```

MLAT accuracy depends on receiver geometry (DOP) and timing precision.
Typical accuracy: 30-100 m for aviation MLAT systems.

### 11.4 Position Source Comparison

Table 11-3: Position Surveillance Source Comparison

| Source | Domain | Frequency | Position Precision | Update Rate | Range |
|--------|--------|-----------|-------------------|-------------|-------|
| ADS-B | Aviation | 1090 MHz | ~5 m (GPS) | 0.5-2 Hz | ~250 NM |
| AIS | Maritime | 161-162 MHz | ~10 m (GNSS) | 0.1-0.5 Hz | ~40 NM (VHF) |
| MLAT | Aviation | 1090 MHz | 30-100 m | 1 Hz | Network-dependent |
| DF bearing | SIGINT | Any | km-scale (range-dependent) | Per measurement | DF equipment-dependent |
| TDOA | SIGINT | Any | 10-1000 m | Per measurement | Network-dependent |
| Radar | Military | Various | 10-100 m | 1-12 Hz | Radar-dependent |

Implementations MUST support ingestion of at least ADS-B and AIS position data.
Implementations SHOULD support DF bearing ingestion for SIGINT geolocation.

---

## 12. Multi-Sensor Position Fusion

### 12.1 Measurement Models

Each position source provides observations with associated uncertainty modeled
as Gaussian noise:

**ADS-B:**
```
z_adsb = [lat, lon, alt]^T + v_adsb
R_adsb = diag(sigma_lat^2, sigma_lon^2, sigma_alt^2)
       ~ diag((5 m)^2, (5 m)^2, (15 m)^2)
```

**AIS:**
```
z_ais = [lat, lon]^T + v_ais
R_ais = diag(sigma_lat^2, sigma_lon^2)
      ~ diag((10 m)^2, (10 m)^2)
```

**DF bearing:**
```
z_df = theta_true + v_df
sigma_df ~ 1-5 degrees (equipment and SNR dependent)
```

### 12.2 State Vector and Dynamics Model

The track state vector for a kinematic target:

```
x = [phi, lambda, h, v_N, v_E, v_D]^T
```

(geodetic position + velocity in North-East-Down frame)

**Constant velocity dynamics model:**

```
x_{k+1} = F * x_k + w_k

F = [I_3   dt*I_3]     (position += velocity * dt)
    [0_3   I_3   ]     (velocity unchanged)

w_k ~ N(0, Q)          (process noise, accounts for maneuvering)
```

**Process noise covariance** for a maneuvering target with acceleration
uncertainty sigma_a:

```
Q = sigma_a^2 * [dt^4/4*I_3   dt^3/2*I_3]
                [dt^3/2*I_3   dt^2*I_3  ]
```

Table 12-1: Process Noise Parameters

| Target Type | sigma_a (m/s^2) | Rationale |
|------------|-----------------|-----------|
| Aircraft (cruise) | 0.5 | Gentle maneuvers |
| Aircraft (maneuvering) | 5.0 | Aggressive turns |
| Ship (open water) | 0.1 | Slow course changes |
| Ship (harbor) | 1.0 | Frequent maneuvers |
| Ground vehicle | 3.0 | Frequent acceleration/braking |

### 12.3 Extended Kalman Filter (EKF) Update

For each measurement z with observation model h(x) and Jacobian H:

```
Innovation:       y = z - h(x_pred)
Innovation cov:   S = H * P_pred * H^T + R
Kalman gain:      K = P_pred * H^T * S^{-1}
State update:     x = x_pred + K * y
Covariance update: P = (I - K*H) * P_pred
```

For position measurements (ADS-B, AIS), h(x) is a simple extraction of the
position components and H is the corresponding identity sub-matrix.

For bearing measurements (DF), the observation model is nonlinear:

```
h_df(x) = atan2(lambda_target - lambda_station,
                phi_target - phi_station)    (approximate, local tangent plane)

H_df = [dh/dphi, dh/dlambda, 0, 0, 0, 0]   (Jacobian of bearing w.r.t. state)
```

### 12.4 Track Association

When multiple sensors observe multiple targets, measurements must be correctly
associated with existing tracks. The Global Nearest Neighbor (GNN) algorithm:

```
GNN(tracks T, measurements Z):
  1. Compute gating matrix:
     G[i,j] = 1 if d_M(T_i, Z_j) < gate_threshold, 0 otherwise
     where d_M = Mahalanobis distance = sqrt(y^T * S^{-1} * y)

  2. Compute cost matrix:
     C[i,j] = d_M(T_i, Z_j) if G[i,j] = 1, else infinity

  3. Solve assignment:
     Hungarian algorithm: O(n^3) for n = max(|T|, |Z|)

  4. Handle unassigned:
     - Unassigned measurements -> initiate new tracks
     - Unassigned tracks -> increment miss counter
     - Delete tracks with miss_count > max_misses
```

**Gating threshold:** The Mahalanobis distance follows a chi-squared distribution
with degrees of freedom equal to the measurement dimension. Gate thresholds:

Table 12-2: Gating Thresholds (Chi-Squared)

| Measurement Dim | 95% Gate | 99% Gate | 99.9% Gate |
|----------------|----------|----------|-----------|
| 1 (bearing) | 3.84 | 6.63 | 10.83 |
| 2 (lat, lon) | 5.99 | 9.21 | 13.82 |
| 3 (lat, lon, alt) | 7.81 | 11.34 | 16.27 |

Implementations MUST implement track-to-measurement association. The GNN
algorithm with chi-squared gating is RECOMMENDED. Multi-Hypothesis Tracking
(MHT) MAY be used for dense environments where association ambiguity is high.

### 12.5 Track Management

Table 12-3: Track Lifecycle States

| State | Condition | Action |
|-------|-----------|--------|
| Tentative | New track (< N_confirm updates) | Associate, do not display |
| Confirmed | >= N_confirm consecutive updates | Display track |
| Coasting | No updates for T_coast seconds | Predict only, display degraded |
| Deleted | No updates for T_delete seconds | Remove from track list |

RECOMMENDED parameters:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| N_confirm | 3 | Reduce false tracks |
| T_coast (aircraft) | 30 s | ADS-B update gap tolerance |
| T_coast (ship) | 300 s | AIS update gap tolerance |
| T_delete | 3 * T_coast | Allow for intermittent reception |

### 12.6 Fusion Architecture

Table 12-4: Fusion Architecture Options

| Architecture | Description | Pros | Cons |
|-------------|-------------|------|------|
| Centralized | All raw measurements to single fuser | Optimal, all info | High bandwidth, single point of failure |
| Track-to-track | Each sensor runs local tracker, fuse tracks | Lower bandwidth | Suboptimal, correlation handling |
| Hierarchical | Local nodes fuse, feed regional | Scalable | Highest latency |

Implementations SHOULD use a distributed (track-to-track) fusion architecture
where each sensor type (ADS-B, AIS, DF) maintains local tracks that are fused
in the Tsingou visualization layer. This balances bandwidth, latency, and
computational load.

---

## 13. Geospatial Error Models

### 13.1 Circular Error Probable (CEP)

CEP is the radius of the circle containing 50% of position estimates, centered
on the true position:

```
For circular Gaussian errors (sigma_x = sigma_y = sigma):
  CEP_50 = 0.6745 * sigma

For general case (sigma_x != sigma_y):
  CEP_50 ~ 0.5887 * (sigma_x + sigma_y)    (Ethridge approximation)
```

Table 13-1: Probability Containment Radii

| Probability | Multiplier (circular case) | Name |
|------------|---------------------------|------|
| 50% | 1.1774 * sigma | CEP |
| 90% | 2.1460 * sigma | R90 |
| 95% | 2.4477 * sigma | R95 |
| 99% | 3.0349 * sigma | R99 |
| 99.9% | 3.7169 * sigma | R99.9 |

### 13.2 Error Ellipse

When position errors are anisotropic or correlated, the error region is an
ellipse defined by the covariance matrix P:

```
P = [sigma_x^2      rho*sigma_x*sigma_y]
    [rho*sigma_x*sigma_y   sigma_y^2    ]

Eigenvalues: lambda_1, lambda_2 (lambda_1 >= lambda_2)

Semi-major axis: a = sqrt(lambda_1) * k(p)
Semi-minor axis: b = sqrt(lambda_2) * k(p)

Orientation: theta = 0.5 * atan2(2*P[0,1], P[0,0] - P[1,1])
```

where k(p) is the chi-squared scale factor for probability p:
- k(50%) = 1.1774
- k(90%) = 2.1460
- k(95%) = 2.4477

Implementations MUST display error ellipses for fused track positions.
Implementations SHOULD display error ellipses at the 95% confidence level by
default, with configurable probability level.

### 13.3 Dilution of Precision (DOP)

DOP quantifies the geometric contribution to position error:

```
Position error = DOP * measurement_error

GDOP = sqrt(sigma_x^2 + sigma_y^2 + sigma_z^2 + sigma_t^2) / sigma_meas
PDOP = sqrt(sigma_x^2 + sigma_y^2 + sigma_z^2) / sigma_meas
HDOP = sqrt(sigma_x^2 + sigma_y^2) / sigma_meas
VDOP = sigma_z / sigma_meas
```

Table 13-2: DOP Quality Ratings

| DOP Value | Quality | Description |
|-----------|---------|-------------|
| 1-2 | Excellent | Ideal geometry |
| 2-5 | Good | Acceptable for most applications |
| 5-10 | Moderate | Usable but degraded |
| 10-20 | Poor | Low confidence |
| > 20 | Very poor | Unreliable |

For DF geolocation, HDOP is computed from the geometry of the DF stations
relative to the emitter. Narrow crossing angles (< 30 degrees) produce high
HDOP and elongated error ellipses.

Implementations SHOULD compute and display HDOP for DF-derived positions.

### 13.4 Position Accuracy Indicators

Table 13-3: Position Accuracy Standards

| Source | Accuracy Metric | Typical Value |
|--------|----------------|---------------|
| GPS (civilian) | 95% CEP | 3-5 m |
| GPS (WAAS/SBAS) | 95% CEP | < 3 m |
| ADS-B (NACp=8) | 95% containment | < 92.6 m |
| ADS-B (NACp=11) | 95% containment | < 7.5 m |
| AIS (high accuracy flag) | 95% CEP | < 10 m |
| MLAT (4+ receivers) | 95% CEP | 30-100 m |
| DF cross-fix (2 stations) | 95% ellipse | km-scale (geometry-dependent) |

Implementations MUST propagate and display position accuracy metadata from each
source. ADS-B NACp (Navigation Accuracy Category for Position) and AIS position
accuracy flag MUST be decoded and used to set measurement covariance in the
fusion filter.

---

## 14. Tsingou Integration Mapping

### 14.1 Geospatial Data Flow via NATS

Table 14-1: NATS Subject Mapping for Geospatial Data

| Data Type | NATS Subject Pattern | Payload Format | Update Rate |
|-----------|---------------------|---------------|-------------|
| ADS-B position | `tsingou.geo.adsb.{icao_hex}` | JSON: lat, lon, alt, gs, track, vs | Per message (~2/s) |
| AIS position | `tsingou.geo.ais.{mmsi}` | JSON: lat, lon, sog, cog, heading | Per message (2-30s) |
| DF bearing | `tsingou.geo.df.{station_id}` | JSON: bearing, sigma, freq, timestamp | Per measurement |
| Fused track | `tsingou.geo.track.{track_id}` | JSON: lat, lon, alt, vN, vE, vD, P[] | Per update (~1 Hz) |
| Geofence event | `tsingou.geo.fence.{fence_id}` | JSON: track_id, event_type, timestamp | On transition |
| Cluster result | `tsingou.geo.cluster.{run_id}` | JSON: cluster_id, centroid, members, cep | On computation |

### 14.2 Visualization Layer Mapping

Table 14-2: Geospatial Visualization Components

| Geospatial Concept | Visualization Layer | Rendering Technology |
|-------------------|-------------------|---------------------|
| Base map tiles | Map layer | Mapbox GL / Leaflet (Web Mercator tiles) |
| Track positions | Map overlay | SVG markers on map |
| Track history | Map overlay | SVG/Canvas polyline |
| Error ellipses | Map overlay | SVG ellipse (rotated) |
| Lines of Bearing | Map overlay | Great circle arc (SVG path) |
| Geofence boundaries | Map overlay | GeoJSON polygon |
| Signal density heatmap | Map overlay | H3 hexagon fill (Canvas/WebGL) |
| Range rings | Map overlay | Azimuthal equidistant circles |

### 14.3 Spatial Query Configuration

Implementations MUST expose the following geospatial parameters for operator
configuration:

Table 14-3: Configurable Geospatial Parameters

| Parameter | Range | Default | Effect |
|-----------|-------|---------|--------|
| H3 resolution | 0-12 | 7 | Heatmap cell size |
| Track coast time | 10-600 s | 60 s | Track persistence |
| Track confirm count | 1-10 | 3 | False track rejection |
| Error ellipse probability | 50-99.9% | 95% | Ellipse size |
| Geofence hysteresis | 0-1000 m | 100 m | Boundary debounce |
| DF LOB max range | 10-500 km | 200 km | LOB display extent |
| Distance algorithm | Haversine/Vincenty | Haversine | Precision level |
| Clustering method | DBSCAN/HDBSCAN | HDBSCAN | Cluster algorithm |
| Cluster eps | 0.1-100 km | 1 km | DBSCAN neighborhood |

---

## 15. Normative Requirements Summary

### 15.1 MUST Requirements

| ID | Requirement | Section |
|----|------------|---------|
| GEO-1 | MUST use WGS84 as the geodetic datum | 2.1 |
| GEO-2 | MUST support EPSG:4326, EPSG:4979, EPSG:4978, EPSG:3857 | 2.2 |
| GEO-3 | MUST observe coordinate conventions (lat range, lon range, order) | 2.3 |
| GEO-4 | MUST achieve < 1 mm accuracy for ECEF-to-geodetic transform | 3.2 |
| GEO-5 | MUST support AER computation from any two geodetic positions | 3.4 |
| GEO-6 | MUST use Vincenty/Karney for precision distance computation | 4.2 |
| GEO-7 | MUST detect Vincenty convergence failure and fall back to Karney | 4.2 |
| GEO-8 | MUST NOT use Haversine for precision geolocation | 4.1 |
| GEO-9 | MUST support ellipsoidal bearing for DF LOB projection | 5.3 |
| GEO-10 | MUST support cross-fix from 2+ LOBs | 5.5 |
| GEO-11 | MUST correctly render overlays in Web Mercator | 6.2 |
| GEO-12 | MUST NOT compute distances/areas in Web Mercator coordinates | 6.5 |
| GEO-13 | MUST support at least one DGGS (H3 or S2) | 7.4 |
| GEO-14 | MUST support H3 resolutions 0-12 | 7.1 |
| GEO-15 | MUST use Haversine or better for circular geofence distance | 9.1 |
| GEO-16 | MUST support polygonal geofencing (ray casting or winding number) | 9.3 |
| GEO-17 | MUST generate fence.enter, fence.exit, fence.dwell events | 9.6 |
| GEO-18 | MUST debounce geofence events with hysteresis buffer | 9.6 |
| GEO-19 | MUST use Haversine/Vincenty distance metric for clustering | 10.3 |
| GEO-20 | MUST NOT cluster on raw lat/lon with Euclidean distance | 10.3 |
| GEO-21 | MUST support ADS-B and AIS position ingestion | 11.4 |
| GEO-22 | MUST perform CPR reasonableness test (< 180 NM) | 11.1.2 |
| GEO-23 | MUST implement track-to-measurement association | 12.4 |
| GEO-24 | MUST display error ellipses for fused positions | 13.2 |
| GEO-25 | MUST propagate and display position accuracy metadata | 13.4 |

### 15.2 SHOULD Requirements

| ID | Requirement | Section |
|----|------------|---------|
| GEO-S1 | SHOULD support UTM zones for local-area operations | 2.2 |
| GEO-S2 | SHOULD use latitude-dependent radii for < 1% accuracy | 2.4 |
| GEO-S3 | SHOULD compute error ellipse at cross-fix point | 5.5 |
| GEO-S4 | SHOULD use azimuthal equidistant for DF station displays | 6.4 |
| GEO-S5 | SHOULD use R*-tree or STR-loaded R-tree for spatial queries | 8.3 |
| GEO-S6 | SHOULD use grid-accelerated geofencing at > 1000 pts/s | 9.4 |
| GEO-S7 | SHOULD interpret geofence edges as great circles for > 1 degree | 9.5 |
| GEO-S8 | SHOULD support DF bearing ingestion | 11.4 |
| GEO-S9 | SHOULD use distributed fusion architecture | 12.6 |
| GEO-S10 | SHOULD display 95% error ellipses by default | 13.2 |
| GEO-S11 | SHOULD compute and display HDOP for DF positions | 13.3 |

### 15.3 MAY Requirements

| ID | Requirement | Section |
|----|------------|---------|
| GEO-M1 | MAY use Haversine for display-level distance | 4.1 |
| GEO-M2 | MAY use flat Earth for distances < 10 km | 4.3 |
| GEO-M3 | MAY use Geohash for NATS subject spatial partitioning | 7.3 |
| GEO-M4 | MAY support polar stereographic projection | 6.1 |
| GEO-M5 | MAY support Lambert conformal conic projection | 6.1 |
| GEO-M6 | MAY use S2 for region covering | 7.2 |
| GEO-M7 | MAY use MHT for dense-environment association | 12.4 |

---

## 16. Bibliography

### Primary References

| Key | Citation | Relevance |
|-----|----------|-----------|
| [WGS84] | Department of Defense, "World Geodetic System 1984," NIMA TR 8350.2, 3rd ed., 2000. | Geodetic reference ellipsoid |
| [VINCENTY-1975] | T. Vincenty, "Direct and inverse solutions of geodesics on the ellipsoid with application of nested equations," *Survey Review* 23(176):88-93, 1975. | Ellipsoidal distance/bearing |
| [KARNEY-2013] | C.F.F. Karney, "Algorithms for geodesics," *Journal of Geodesy* 87(1):43-55, 2013. | Robust geodesic computation |
| [GUTTMAN-1984] | A. Guttman, "R-trees: A dynamic index structure for spatial searching," *Proc. ACM SIGMOD*, pp. 47-57, 1984. | R-tree spatial index |
| [BECKMANN-1990] | N. Beckmann, H.-P. Kriegel, R. Schneider, B. Seeger, "The R*-tree: An efficient and robust access method for points and rectangles," *Proc. ACM SIGMOD*, pp. 322-331, 1990. | R*-tree improvements |
| [UBER-H3] | Uber Engineering, "H3: Uber's Hexagonal Hierarchical Spatial Index," h3geo.org, 2018. | H3 hexagonal grid |
| [S2-GEOMETRY] | Google, "S2 Geometry Library," s2geometry.io. | S2 spherical cells |
| [ESTER-1996] | M. Ester, H.-P. Kriegel, J. Sander, X. Xu, "A density-based algorithm for discovering clusters in large spatial databases with noise," *KDD*, pp. 226-231, 1996. | DBSCAN clustering |
| [MCINNES-2017] | L. McInnes, J. Healy, S. Astels, "hdbscan: Hierarchical density based clustering," *JOSS* 2(11):205, 2017. | HDBSCAN |
| [BAR-SHALOM-2001] | Y. Bar-Shalom, X.-R. Li, T. Kirubarajan, *Estimation with Applications to Tracking and Navigation*, Wiley, 2001. | Multi-sensor tracking and fusion |
| [SNYDER-1987] | J.P. Snyder, "Map Projections — A Working Manual," USGS Professional Paper 1395, 1987. | Map projection mathematics |
| [MOVABLE-TYPE] | C. Veness, "Calculate distance, bearing and more between Latitude/Longitude points," movable-type.co.uk/scripts/latlong.html. | Practical geodetic formulas |

### Standards

| Key | Citation | Relevance |
|-----|----------|-----------|
| [ICAO-ADSB] | ICAO, Annex 10, Vol. IV, "Surveillance and Collision Avoidance Systems." | ADS-B standard |
| [ITU-M1371] | ITU-R M.1371-5, "Technical characteristics for an automatic identification system using time-division multiple access in the VHF maritime mobile frequency band," 2014. | AIS standard |
| [NASA-CPR] | NASA Langley Formal Methods, "A Formal Analysis of the Compact Position Reporting Algorithm," 2017. | CPR decoding analysis |
| [RFC7946] | IETF RFC 7946, "The GeoJSON Format," 2016. | GeoJSON coordinate order |
| [RFC2119] | S. Bradner, "Key words for use in RFCs to Indicate Requirement Levels," BCP 14, RFC 2119, March 1997. | Requirement keywords |
| [RFC8174] | B. Leiba, "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words," BCP 14, RFC 8174, May 2017. | Requirement keyword clarification |

### Software Libraries

| Key | Citation | Relevance |
|-----|----------|-----------|
| [PROJ] | PROJ Contributors, "PROJ Coordinate Transformation Software Library," proj.org. | CRS transformation engine |
| [EPSG] | IOGP, "EPSG Geodetic Parameter Registry," epsg.io. | Coordinate system registry |
| [GEOGRAPHICLIB] | C.F.F. Karney, "GeographicLib," geographiclib.sourceforge.io. | Robust geodesic library |
| [TURF] | Mapbox, "Turf.js — Advanced geospatial analysis for browsers and Node.js," turfjs.org. | JavaScript geospatial library |

---

<!-- INTEGRATION NOTES
- This section provides geospatial foundations for ALL position/location features in Tsingou
- Sections 2-3 (geodetic/transforms) are foundational for all other sections
- Section 4-5 (distance/bearing) govern DF geolocation and track display
- Section 6 (projections) constrains map rendering
- Section 7-8 (indexing) govern spatial query performance
- Section 9 (geofencing) specifies boundary monitoring capabilities
- Section 10 (clustering) supports emitter geolocation and activity analysis
- Section 11 (surveillance protocols) defines position source ingestion
- Section 12 (fusion) specifies multi-sensor track combination
- Section 13 (error models) governs uncertainty visualization

CROSS-REFERENCES:
- TSG.25 (DSP Foundations): FFT/spectral data also has geospatial context (SDR location)
- TSG.4 (Data Fusion Mathematics): Kalman filter theory detailed there, applied here
- TSG.28 (Graph Theory): Spatial network analysis builds on geospatial primitives
- ADR-011 (SDR Integration): SDR hardware location metadata
- TSG.36 (EW Doctrine): Geolocation methods grounded in EW operational doctrine

CODEBASE INTEGRATION:
- Position data flows through NATS subjects (tsingou.geo.*)
- Map visualization uses Mapbox GL or Leaflet with Web Mercator tiles
- H3 aggregation computed server-side, rendered as hex overlays
- Track fusion engine implemented as Effect service
- Geofence definitions stored as GeoJSON polygons in configuration
-->
