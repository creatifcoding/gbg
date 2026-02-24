# AVA.DS.5: GEOINT/HUMINT/MASINT Domain Data Sources

```
Section:       AVA.DS.5 — GEOINT/HUMINT/MASINT Domain Data Sources
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          I — Data Source Catalog
Prerequisites: AVA.DS.6 (NATS Subject Taxonomy)
```

> This section catalogs data sources for three intelligence disciplines:
> **GEOINT** (Geospatial Intelligence), **HUMINT** (Human Intelligence), and
> **MASINT** (Measurement and Signature Intelligence). These signal kinds bridge
> the gap between physical-world observation and analytical products — GEOINT
> provides spatial context, HUMINT provides ground-truth reports, and MASINT
> provides environmental measurements that correlate with entity activity.
>
> Together they feed Tier 2 (soft-key spatial/temporal) and Tier 3 (derived
> statistical pattern) fusion joins, enriching tracks established by kinetic
> and RF sensors with ground-truth context.

---

## Table of Contents

1. [Overview](#ava-ds-5-1-overview)
2. [Signal Kind: Geoint](#ava-ds-5-2-signal-kind-geoint)
3. [Signal Kind: Humint](#ava-ds-5-3-signal-kind-humint)
4. [Signal Kind: Masint](#ava-ds-5-4-signal-kind-masint)
5. [JetStream Configuration](#ava-ds-5-5-jetstream-configuration)
6. [References](#ava-ds-5-6-references)

---

## AVA.DS.5.1 Overview

| Property | Value |
|----------|-------|
| **Signal Kinds** | `Geoint`, `Humint`, `Masint` |
| **Entity Classes** | `Facility`, `Person`, `Organization`, `GroundVehicle`, `Vessel`, `Aircraft` |
| **Data Type (R5)** | Mixed — Event (HUMINT reports, seismic events) + Reference (OSM, GHSL, Natural Earth) |
| **Primary Fusion Tier** | Tier 2 (spatial/temporal correlation), Tier 3 (pattern derivation) |
| **JetStream Stream** | `SENSOR_GEO` — subjects `sensor.geoint.>`, `sensor.humint.>`, `sensor.masint.>` |
| **Max Age** | 168h (7 days) |

### Intelligence Discipline Mapping

| Discipline | SignalKind | Collection Method | Primary Output |
|-----------|-----------|-------------------|----------------|
| GEOINT | `Geoint` | Imagery analysis, geospatial feature extraction, change detection | Feature layers, settlement maps, facility footprints |
| HUMINT | `Humint` | Field reports, conflict event databases, humanitarian situation reports | Structured event records, SALUTE reports |
| MASINT | `Masint` | Seismic sensors, meteorological buoys, air quality monitors, water gauges | Time-series measurements, threshold alerts |

### Cross-Domain Value

These three signal kinds are rarely primary identifiers for entity tracks. Instead,
they provide **contextual enrichment** for tracks established by kinetic (ADS-B, AIS,
Radar) or cyber (HTTP, DNS) sensors:

- **GEOINT** answers: "What is at this location?" (facilities, infrastructure, terrain)
- **HUMINT** answers: "What happened here?" (conflict events, humanitarian reports)
- **MASINT** answers: "What environmental conditions exist?" (seismic activity, weather, pollution)

---

## AVA.DS.5.2 Signal Kind: Geoint

### AVA.DS.5.2.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| OpenStreetMap Overpass | `https://overpass-api.de/api/interpreter` | JSON/XML | REST (POST/GET) | None (rate-limited) | `type`, `tags`, `lat`, `lon`, `id` | Minutes (live edits) | ODbL |
| NASA FIRMS | `https://firms.modaps.eosdis.nasa.gov/api/` | CSV/JSON/KML | REST | MAP_KEY (free) | `latitude`, `longitude`, `brightness`, `confidence`, `acq_date` | 3h (NRT), minutes (URT) | Public Domain |
| Copernicus CDSE (Sentinel) | `https://dataspace.copernicus.eu/analyse/apis` | GeoTIFF/JSON | STAC + Sentinel Hub | OAuth2 (free tier) | `datetime`, `bbox`, `eo:cloud_cover`, `platform` | Daily (per orbit) | Copernicus Open |
| Global Human Settlement Layer | `https://human-settlement.emergency.copernicus.eu/download.php` | GeoTIFF | HTTP download | None | `population`, `built_up_area`, `settlement_class` | Static (multi-year epochs) | CC-BY-4.0 |
| Natural Earth | `https://www.naturalearthdata.com/downloads/` | SHP/GeoJSON | HTTP download | None | `name`, `type`, `admin`, `geometry` | Static (annual release) | Public Domain |

#### Source Notes

- **Overpass API**: The primary interface for querying OSM features by bounding box,
  tag filters, and spatial relations. Rate-limited to ~2 requests/minute on the public
  instance. For production use, deploy a local Overpass instance or use Geofabrik
  extracts. Output formats include JSON (Overpass JSON), XML, and CSV.

- **NASA FIRMS**: Provides MODIS and VIIRS active fire/hotspot detections within 3 hours
  of satellite overpass. Free MAP_KEY required. Rate limit resets every 10 minutes. CSV
  and JSON endpoints. Near-real-time (NRT), real-time (RT), and ultra-real-time (URT)
  tiers available.

- **Copernicus CDSE**: Free-tier access to Sentinel-1 (SAR), Sentinel-2 (multispectral),
  Sentinel-3 (ocean/land), and Sentinel-5P (atmospheric) data. STAC catalog API for
  discovery, Sentinel Hub for processing. Statistical API returns JSON aggregates
  without downloading full imagery.

- **GHSL**: JRC European Commission product. Pre-computed global grids of population
  density (GHS-POP), built-up surface (GHS-BUILT-S), and settlement model (GHS-SMOD).
  GeoTIFF format at 100m-1km resolution. Multi-epoch: 1975, 1990, 2000, 2015, 2020.

- **Natural Earth**: Curated public-domain vector and raster data at 1:10m, 1:50m, and
  1:110m scales. Shapefile and GeoJSON. Includes coastlines, admin boundaries,
  populated places, roads, airports, ports. Static reference data — annual releases.

### AVA.DS.5.2.2 NATS Subject Taxonomy

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.geoint.osm.geojson` | GeoJSON FeatureCollection | OSM Overpass query results |
| `sensor.geoint.osm.raw` | Overpass JSON | Raw Overpass API response |
| `sensor.geoint.firms.json` | JSON array | NASA FIRMS hotspot detections |
| `sensor.geoint.firms.csv` | CSV rows | NASA FIRMS CSV format |
| `sensor.geoint.sentinel.json` | STAC Item JSON | Sentinel product metadata |
| `sensor.geoint.sentinel.geotiff` | Object Store ref | Sentinel imagery (ref to Object Store) |
| `sensor.geoint.ghsl.geotiff` | Object Store ref | GHSL population/built-up grids |
| `sensor.geoint.naturalearth.geojson` | GeoJSON FeatureCollection | Natural Earth vector features |

**Normative**: GeoTIFF payloads MUST NOT be published inline on NATS subjects. Instead,
the adapter MUST store the raster in NATS Object Store (bucket `ava-geoint-raster`) and
publish a metadata-only JSON message containing the object store key, bounding box,
resolution, and CRS.

### AVA.DS.5.2.3 Payload Schema

#### FIRMS Hotspot (Canonical)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "FirmsHotspot",
  "type": "object",
  "required": ["latitude", "longitude", "brightness", "acq_date", "acq_time", "satellite", "confidence"],
  "properties": {
    "latitude":    { "type": "number", "minimum": -90, "maximum": 90 },
    "longitude":   { "type": "number", "minimum": -180, "maximum": 180 },
    "brightness":  { "type": "number", "description": "Brightness temperature (Kelvin)" },
    "scan":        { "type": "number", "description": "Along-scan pixel size (km)" },
    "track":       { "type": "number", "description": "Along-track pixel size (km)" },
    "acq_date":    { "type": "string", "format": "date" },
    "acq_time":    { "type": "string", "pattern": "^[0-9]{4}$", "description": "HHMM UTC" },
    "satellite":   { "type": "string", "enum": ["Terra", "Aqua", "N", "1"] },
    "instrument":  { "type": "string", "enum": ["MODIS", "VIIRS"] },
    "confidence":  { "type": ["string", "integer"], "description": "Detection confidence (low/nominal/high or 0-100)" },
    "frp":         { "type": "number", "description": "Fire Radiative Power (MW)" },
    "daynight":    { "type": "string", "enum": ["D", "N"] }
  }
}
```

#### OSM Feature (Canonical)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "OsmFeature",
  "type": "object",
  "required": ["type", "id", "lat", "lon", "tags"],
  "properties": {
    "type":   { "type": "string", "enum": ["node", "way", "relation"] },
    "id":     { "type": "integer" },
    "lat":    { "type": "number" },
    "lon":    { "type": "number" },
    "tags":   { "type": "object", "additionalProperties": { "type": "string" } },
    "nodes":  { "type": "array", "items": { "type": "integer" } },
    "members": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": { "type": "string" },
          "ref":  { "type": "integer" },
          "role": { "type": "string" }
        }
      }
    }
  }
}
```

#### Raster Object Store Reference

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "RasterObjectRef",
  "type": "object",
  "required": ["object_key", "bucket", "bbox", "crs", "resolution_m", "source"],
  "properties": {
    "object_key":     { "type": "string", "description": "NATS Object Store key" },
    "bucket":         { "type": "string", "const": "ava-geoint-raster" },
    "bbox":           { "type": "array", "items": { "type": "number" }, "minItems": 4, "maxItems": 4 },
    "crs":            { "type": "string", "default": "EPSG:4326" },
    "resolution_m":   { "type": "number" },
    "source":         { "type": "string", "enum": ["sentinel", "ghsl", "naturalearth"] },
    "acquired_at":    { "type": "string", "format": "date-time" },
    "content_type":   { "type": "string", "default": "image/tiff" }
  }
}
```

### AVA.DS.5.2.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|-------------|---------------------|---------|
| OSM `tags.name` + geometry | `Facility` | Custom (OSM ID) | `way/123456789` (airport) |
| OSM `tags.admin_level` | `Organization` | Custom (ISO 3166) | `AU` (Australia) |
| FIRMS `latitude`+`longitude` | `Facility` | Custom (H3 cell) | `8a2830828587fff` |
| Sentinel `bbox` centroid | `Facility` | Custom (H3 cell) | `8a2830828587fff` |
| GHSL `settlement_class` | `Facility` | Custom (H3 cell) | `8a2830828587fff` |
| Natural Earth `name` | `Facility` | Custom (NE ID) | `ne_10m_airports:YSSY` |

**Note**: GEOINT sources rarely produce direct entity identifiers. Instead, they
provide spatial context that enriches entities identified by other signal kinds.
The H3 cell index is used as the join key for spatial correlation.

### AVA.DS.5.2.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier | Description |
|------------------|-----------|----------|------|-------------|
| `AdsB` | Spatial | H3 cell + facility proximity | Tier 2 | Aircraft near GEOINT-identified facilities |
| `Ais` | Spatial | H3 cell + port geometry | Tier 2 | Vessels near GEOINT-identified ports |
| `Satellite` | Spatial+Temporal | bbox overlap + time window | Tier 2 | Satellite imagery of same area |
| `Humint` | Spatial+Temporal | H3 cell + time bucket | Tier 2 | Conflict events near facilities |
| `Masint` | Spatial | H3 cell | Tier 2 | Environmental readings at GEOINT locations |
| `Osint` | Spatial+Entity | location + entity name | Tier 3 | News reports mentioning GEOINT features |
| `Radar` | Spatial+Temporal | H3 cell + time bucket | Tier 2 | Radar returns near facilities |

### AVA.DS.5.2.6 Synthetic Data Generation

GEOINT data is predominantly reference data (OSM, Natural Earth, GHSL) with static
or slow-changing content. Synthetic generation is needed primarily for testing
hot-spot and change-detection flows.

**FIRMS Hotspot Synthetic**:
- Schema: `FirmsHotspot` (see 5.2.3)
- Value ranges: `latitude` [-60, 70], `longitude` [-180, 180], `brightness` [300, 500],
  `confidence` [0, 100], `frp` [0, 500]
- Strategy: **Parametric** — Generate clusters of hotspots around known facility
  coordinates with configurable density, spread radius (0.01-0.5 degrees), and
  temporal spacing (1-6 hours between detections).

**OSM Feature Synthetic**:
- Schema: `OsmFeature` (see 5.2.3)
- Strategy: **Replay** — Download a regional OSM extract (e.g., Geofabrik) and replay
  features as a time-ordered stream. Tag filters: `aeroway=aerodrome`,
  `landuse=military`, `amenity=port`, `building=industrial`.

**Raster Reference Synthetic**:
- Schema: `RasterObjectRef` (see 5.2.3)
- Strategy: **Parametric** — Generate metadata-only records pointing to synthetic
  256x256 GeoTIFF tiles with random settlement classification values.

---

## AVA.DS.5.3 Signal Kind: Humint

### AVA.DS.5.3.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| ACLED | `https://acleddata.com/` | JSON/CSV | REST | API key (free for research) | `event_type`, `sub_event_type`, `actor1`, `actor2`, `latitude`, `longitude`, `fatalities`, `event_date` | Weekly (real-time collection) | Research use |
| UN OCHA ReliefWeb | `https://api.reliefweb.int/v1/` | JSON | REST | appname (free, required from Nov 2025) | `title`, `body`, `date`, `country`, `source`, `theme`, `disaster_type` | Daily | Open |
| GDACS | `https://www.gdacs.org/xml/rss.xml` | XML/GeoJSON | RSS + API | None | `eventtype`, `alertlevel`, `alertscore`, `severity`, `population`, `latitude`, `longitude` | 6 minutes | Open |
| HDX (Humanitarian Data Exchange) | `https://data.humdata.org/api/3/` | JSON/CSV | CKAN REST | None (free) | `name`, `organization`, `resources`, `tags` | Varies (dataset-dependent) | Open |
| SALUTE Reports | N/A (synthetic) | JSON | N/A | N/A | `size`, `activity`, `location`, `unit`, `time`, `equipment` | N/A (synthetic) | N/A |

#### Source Notes

- **ACLED**: The Armed Conflict Location & Event Data Project provides real-time data on
  political violence and protest events globally. Weekly updates with rolling coverage.
  API key required (free for researchers). Returns structured event records with actor
  identification, geolocation, fatality counts, and event categorization. The API
  documentation is at `https://apidocs.acleddata.com/`.

- **ReliefWeb**: UN OCHA's humanitarian information portal. REST API returns reports,
  jobs, training, and disaster data as JSON. From November 2025, requires a pre-approved
  `appname` parameter. Historical data from 1996. Covers 196 countries.

- **GDACS**: The Global Disaster Alert and Coordination System provides automated alerts
  for earthquakes, tsunamis, tropical cyclones, floods, and volcanic eruptions. RSS feeds
  updated every 6 minutes. Alert levels: Green (low), Orange (moderate), Red (high).
  GeoJSON export available for spatial analysis.

- **HDX**: CKAN-based data catalog hosting 20,000+ humanitarian datasets. The API
  provides dataset metadata and resource URLs. ACLED data is also mirrored on HDX
  (246 datasets). Useful as a meta-source for discovering additional HUMINT data.

- **SALUTE Reports**: Military intelligence reporting format (Size, Activity, Location,
  Unit, Time, Equipment). No public API exists — this is a **synthetic-only** source
  for testing the HUMINT ingest pipeline. Reports are generated to validate structured
  field extraction and entity resolution.

### AVA.DS.5.3.2 NATS Subject Taxonomy

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.humint.acled.json` | JSON event records | ACLED conflict/protest events |
| `sensor.humint.acled.csv` | CSV rows | ACLED CSV export format |
| `sensor.humint.reliefweb.json` | JSON report objects | ReliefWeb humanitarian reports |
| `sensor.humint.gdacs.xml` | XML RSS items | GDACS disaster alerts (raw) |
| `sensor.humint.gdacs.json` | GeoJSON features | GDACS alerts (parsed to GeoJSON) |
| `sensor.humint.hdx.json` | JSON CKAN resources | HDX dataset metadata/resources |
| `sensor.humint.synthetic.salute` | JSON SALUTE report | Synthetic SALUTE format reports |
| `sensor.humint.synthetic.json` | JSON event records | Generic synthetic HUMINT events |

**Normative**: ACLED data subjects MUST include the ACLED event_id in the message
header (`Nats-Msg-Id`) for deduplication across weekly update overlaps.

### AVA.DS.5.3.3 Payload Schema

#### ACLED Event (Canonical)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "AcledEvent",
  "type": "object",
  "required": ["event_id_cnty", "event_date", "event_type", "actor1", "country", "latitude", "longitude"],
  "properties": {
    "event_id_cnty":    { "type": "string", "description": "Unique event identifier (country-specific)" },
    "event_date":       { "type": "string", "format": "date" },
    "year":             { "type": "integer" },
    "event_type":       { "type": "string", "enum": ["Battles", "Explosions/Remote violence", "Violence against civilians", "Protests", "Riots", "Strategic developments"] },
    "sub_event_type":   { "type": "string" },
    "actor1":           { "type": "string", "description": "Primary actor name" },
    "assoc_actor_1":    { "type": "string", "description": "Associated actor 1" },
    "inter1":           { "type": "integer", "description": "Actor 1 interaction code" },
    "actor2":           { "type": "string", "description": "Secondary actor name" },
    "assoc_actor_2":    { "type": "string" },
    "inter2":           { "type": "integer" },
    "interaction":      { "type": "integer", "description": "Interaction code (2-digit)" },
    "country":          { "type": "string" },
    "iso3":             { "type": "string", "pattern": "^[A-Z]{3}$" },
    "admin1":           { "type": "string", "description": "First admin division" },
    "admin2":           { "type": "string", "description": "Second admin division" },
    "admin3":           { "type": "string" },
    "location":         { "type": "string", "description": "Location name" },
    "latitude":         { "type": "number" },
    "longitude":        { "type": "number" },
    "geo_precision":    { "type": "integer", "enum": [1, 2, 3], "description": "1=exact, 2=near, 3=admin area" },
    "source":           { "type": "string" },
    "source_scale":     { "type": "string" },
    "notes":            { "type": "string" },
    "fatalities":       { "type": "integer", "minimum": 0 },
    "tags":             { "type": "string" },
    "timestamp":        { "type": "integer", "description": "UNIX epoch" }
  }
}
```

#### GDACS Alert (Canonical)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "GdacsAlert",
  "type": "object",
  "required": ["eventtype", "alertlevel", "eventid", "latitude", "longitude", "fromdate"],
  "properties": {
    "eventtype":    { "type": "string", "enum": ["EQ", "TC", "FL", "VO", "TS", "DR", "WF"] },
    "alertlevel":   { "type": "string", "enum": ["Green", "Orange", "Red"] },
    "alertscore":   { "type": "number" },
    "eventid":      { "type": "string" },
    "episodeid":    { "type": "string" },
    "eventname":    { "type": "string" },
    "description":  { "type": "string" },
    "htmldescription": { "type": "string" },
    "latitude":     { "type": "number" },
    "longitude":    { "type": "number" },
    "fromdate":     { "type": "string", "format": "date-time" },
    "todate":       { "type": "string", "format": "date-time" },
    "severity":     { "type": "object", "properties": {
      "value": { "type": "number" },
      "unit":  { "type": "string" }
    }},
    "population":   { "type": "object", "properties": {
      "value": { "type": "number" },
      "unit":  { "type": "string" }
    }},
    "vulnerability": { "type": "object", "properties": {
      "value": { "type": "number" },
      "unit":  { "type": "string" }
    }},
    "country":      { "type": "string" },
    "iso3":         { "type": "string" }
  }
}
```

#### SALUTE Report (Synthetic)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "SaluteReport",
  "type": "object",
  "required": ["size", "activity", "location", "unit", "time", "equipment"],
  "properties": {
    "report_id":    { "type": "string", "format": "uuid" },
    "size":         { "type": "string", "description": "Number of personnel/vehicles observed" },
    "activity":     { "type": "string", "description": "What the observed party is doing" },
    "location": {
      "type": "object",
      "required": ["latitude", "longitude"],
      "properties": {
        "latitude":    { "type": "number" },
        "longitude":   { "type": "number" },
        "mgrs":        { "type": "string", "description": "Military Grid Reference System coordinate" },
        "description": { "type": "string" }
      }
    },
    "unit":         { "type": "string", "description": "Unit identification / affiliation" },
    "time":         { "type": "string", "format": "date-time", "description": "DTG of observation" },
    "equipment":    { "type": "string", "description": "Weapons, vehicles, or equipment observed" },
    "reliability":  { "type": "string", "enum": ["A", "B", "C", "D", "E", "F"], "description": "Source reliability rating (NATO A-F)" },
    "credibility":  { "type": "integer", "enum": [1, 2, 3, 4, 5, 6], "description": "Information credibility rating (NATO 1-6)" },
    "classification": { "type": "string", "default": "UNCLASSIFIED" },
    "collector_id": { "type": "string" },
    "notes":        { "type": "string" }
  }
}
```

### AVA.DS.5.3.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|-------------|---------------------|---------|
| ACLED `actor1` | `Person` / `Organization` | Custom (ACLED actor) | `Military Forces of Syria` |
| ACLED `actor2` | `Person` / `Organization` | Custom (ACLED actor) | `Islamic State (IS)` |
| ACLED `location` + coords | `Facility` | Custom (H3 cell) | `8a2830828587fff` |
| ReliefWeb `source.name` | `Organization` | Custom (RW org ID) | `UNHCR` |
| ReliefWeb `country` | `Organization` | Custom (ISO 3166) | `SYR` |
| GDACS `eventid` | `Facility` | Custom (GDACS event) | `EQ-1234567` |
| SALUTE `unit` | `Organization` | Custom (unit designator) | `3rd BDE, 4th ID` |
| SALUTE `location` | `Facility` | Custom (MGRS) | `38SMB4948` |

**Note**: HUMINT entity resolution is inherently fuzzy. Actor names from ACLED may
refer to the same entity with different spellings or abbreviations. The fusion
pipeline SHOULD use Tier 3 (derived identity resolution) for HUMINT actor matching.

### AVA.DS.5.3.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier | Description |
|------------------|-----------|----------|------|-------------|
| `Geoint` | Spatial+Temporal | H3 cell + time bucket | Tier 2 | Conflict events near GEOINT features |
| `AdsB` | Spatial+Temporal | H3 cell + time window | Tier 2 | Aircraft activity near conflict zones |
| `Ais` | Spatial+Temporal | H3 cell + time window | Tier 2 | Vessel activity near conflict areas |
| `Osint` | Textual+Temporal | actor name + time bucket | Tier 3 | News corroborating HUMINT reports |
| `Social` | Textual+Spatial | location name + H3 cell | Tier 3 | Social media from conflict areas |
| `Masint` | Spatial+Temporal | H3 cell + time window | Tier 2 | Environmental signatures near events |
| `Satellite` | Spatial+Temporal | bbox overlap + date | Tier 2 | Imagery of conflict locations |
| `Cyber` | Entity (actor) | actor name / group ID | Tier 3 | Threat actor attribution |

### AVA.DS.5.3.6 Synthetic Data Generation

#### ACLED Event Synthetic

- Schema: `AcledEvent` (see 5.3.3)
- Value ranges: `event_type` uniform over 6 types, `fatalities` Poisson(lambda=3),
  `geo_precision` weighted [1:50%, 2:30%, 3:20%], coordinates within country bounding boxes
- Strategy: **Parametric** — Generate events clustered around known conflict zones
  (configurable by ISO3 country code). Temporal distribution follows a Poisson process
  with configurable rate (1-10 events/day per region).

#### SALUTE Report Synthetic

- Schema: `SaluteReport` (see 5.3.3)
- Value ranges: `size` ["2-3 personnel", "squad-sized element", "platoon", "company"],
  `activity` ["movement", "defensive position", "patrol", "staging", "logistics"],
  `equipment` ["small arms", "crew-served weapons", "armored vehicles", "logistics vehicles"],
  `reliability` weighted [B:40%, C:30%, D:20%, A:5%, E:5%],
  `credibility` weighted [2:30%, 3:40%, 4:20%, 1:5%, 5:5%]
- Strategy: **Parametric** — Generate reports along simulated patrol routes with
  configurable waypoint density. Time spacing: 15-120 minutes between reports.

#### GDACS Alert Synthetic

- Schema: `GdacsAlert` (see 5.3.3)
- Value ranges: `eventtype` weighted [EQ:40%, FL:25%, TC:20%, VO:10%, WF:5%],
  `alertlevel` weighted [Green:60%, Orange:30%, Red:10%],
  `severity.value` EQ: magnitude 3.0-8.5, TC: Category 1-5
- Strategy: **Replay** — Download GDACS historical RSS feed archive and replay
  events with time compression (1 week of history in 1 hour of test time).

---

## AVA.DS.5.4 Signal Kind: Masint

### AVA.DS.5.4.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| USGS Earthquake Hazards | `https://earthquake.usgs.gov/fdsnws/event/1/` | GeoJSON | REST (FDSN) | None | `mag`, `place`, `time`, `coordinates`, `depth`, `type` | Real-time (minutes) | Public Domain |
| USGS Earthquake Feeds | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/` | GeoJSON | Static feeds | None | Same as above | 1min / 5min / 15min / 1h / 1d | Public Domain |
| NOAA NDBC (Buoys) | `https://www.ndbc.noaa.gov/data/realtime2/` | Text (fixed-width) | HTTP download | None | `WDIR`, `WSPD`, `GST`, `WVHT`, `PRES`, `ATMP`, `WTMP` | Hourly (transmitted) | Public Domain |
| EPA AirNow | `https://www.airnowapi.org/aq/` | JSON/XML | REST | API key (free) | `AQI`, `ParameterName`, `Category`, `Latitude`, `Longitude` | Hourly | Public Domain |
| USGS Water Services | `https://waterservices.usgs.gov/nwis/iv/` | JSON/XML/RDB | REST | None | `value`, `dateTime`, `siteName`, `parameterCode` | 15 minutes | Public Domain |
| CTBTO (vDEC) | `https://www.ctbto.org/resources/for-researchers-experts/vdec` | Various | Research portal | Approved proposal | Station-dependent | Real-time (IMS) | Restricted (research) |

#### Source Notes

- **USGS Earthquake Hazards**: Two access modes — (1) FDSN event web service for
  historical queries with spatial/temporal/magnitude filters, returns GeoJSON
  FeatureCollections; (2) pre-computed feeds at multiple intervals (1min, 5min, 15min,
  1h, 1d) covering significant, 4.5+, 2.5+, 1.0+, and all earthquakes. Both free,
  no authentication.

- **NOAA NDBC**: National Data Buoy Center provides meteorological and oceanographic
  measurements from ~1,300 stations. Fixed-width text files per station in the
  `realtime2/` directory. Station IDs are 5-character codes (e.g., `41002`). Data
  includes wind, wave, pressure, temperature, currents. Alternative access via ERDDAP
  (`cwwcNDBCMet` dataset).

- **EPA AirNow**: Real-time air quality observations from 2,500+ US monitoring stations.
  Free API key required. Returns current AQI, forecast AQI, and historical observations.
  Parameters: PM2.5, PM10, Ozone, NO2, SO2, CO. JSON and XML output formats.

- **USGS Water Services**: Real-time and historical hydrological data from USGS
  monitoring sites. Instantaneous values (15-min interval), daily values, site info.
  JSON (WaterML 2.0 JSON), XML, and RDB (tab-delimited) output. Over 1.5 million
  sites. New OGC API endpoints rolling out in 2025-2026.

- **CTBTO vDEC**: The Comprehensive Nuclear-Test-Ban Treaty Organization operates
  a global network of 321 monitoring stations (seismic, hydroacoustic, infrasound,
  radionuclide). Data access requires approved research proposal via vDEC portal.
  Not suitable for real-time ingest without formal agreement. Included for completeness
  — use USGS as the primary seismic source.

### AVA.DS.5.4.2 NATS Subject Taxonomy

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.masint.usgs.seismic` | GeoJSON Feature | USGS earthquake event |
| `sensor.masint.usgs.seismic_feed` | GeoJSON FeatureCollection | USGS earthquake feed (batch) |
| `sensor.masint.usgs.water` | JSON (WaterML 2.0) | USGS water gauge instantaneous value |
| `sensor.masint.noaa.buoy` | JSON (parsed) | NOAA NDBC buoy measurement |
| `sensor.masint.noaa.buoy_raw` | Text (fixed-width) | NOAA NDBC raw text format |
| `sensor.masint.epa.airquality` | JSON | EPA AirNow AQI reading |
| `sensor.masint.ctbto.seismic` | JSON | CTBTO seismic detection (if accessible) |
| `sensor.masint.synthetic.json` | JSON | Generic synthetic MASINT measurement |

**Normative**: USGS earthquake events MUST include the USGS event ID in the NATS
message header (`Nats-Msg-Id`) for deduplication across overlapping feed windows.

### AVA.DS.5.4.3 Payload Schema

#### USGS Earthquake Event (Canonical)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "UsgsEarthquakeEvent",
  "type": "object",
  "required": ["id", "properties", "geometry"],
  "description": "GeoJSON Feature from USGS Earthquake Hazards API",
  "properties": {
    "type":       { "type": "string", "const": "Feature" },
    "id":         { "type": "string", "description": "USGS event ID (e.g., us7000n1bz)" },
    "properties": {
      "type": "object",
      "required": ["mag", "place", "time", "type", "status"],
      "properties": {
        "mag":     { "type": ["number", "null"], "description": "Magnitude" },
        "place":   { "type": ["string", "null"], "description": "Text description of location" },
        "time":    { "type": "integer", "description": "UNIX epoch milliseconds" },
        "updated": { "type": "integer", "description": "Last update epoch ms" },
        "tz":      { "type": ["integer", "null"], "description": "UTC offset minutes" },
        "url":     { "type": "string" },
        "detail":  { "type": "string", "description": "URL to GeoJSON detail" },
        "felt":    { "type": ["integer", "null"], "description": "Number of felt reports" },
        "cdi":     { "type": ["number", "null"], "description": "Community decimal intensity" },
        "mmi":     { "type": ["number", "null"], "description": "Modified Mercalli Intensity" },
        "alert":   { "type": ["string", "null"], "enum": ["green", "yellow", "orange", "red", null] },
        "status":  { "type": "string", "enum": ["automatic", "reviewed", "deleted"] },
        "tsunami": { "type": "integer", "enum": [0, 1] },
        "sig":     { "type": "integer", "description": "Significance (0-1000)" },
        "type":    { "type": "string", "description": "Event type (earthquake, quarry blast, etc.)" },
        "title":   { "type": "string" }
      }
    },
    "geometry": {
      "type": "object",
      "required": ["type", "coordinates"],
      "properties": {
        "type":        { "type": "string", "const": "Point" },
        "coordinates": {
          "type": "array",
          "items": { "type": "number" },
          "minItems": 3,
          "maxItems": 3,
          "description": "[longitude, latitude, depth_km]"
        }
      }
    }
  }
}
```

#### NOAA Buoy Measurement (Canonical)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "NoaaBuoyMeasurement",
  "type": "object",
  "required": ["station_id", "timestamp", "latitude", "longitude"],
  "properties": {
    "station_id":  { "type": "string", "pattern": "^[A-Za-z0-9]{5}$" },
    "timestamp":   { "type": "string", "format": "date-time" },
    "latitude":    { "type": "number" },
    "longitude":   { "type": "number" },
    "WDIR":        { "type": ["number", "null"], "description": "Wind direction (degrees true)" },
    "WSPD":        { "type": ["number", "null"], "description": "Wind speed (m/s)" },
    "GST":         { "type": ["number", "null"], "description": "Gust speed (m/s)" },
    "WVHT":        { "type": ["number", "null"], "description": "Significant wave height (m)" },
    "DPD":         { "type": ["number", "null"], "description": "Dominant wave period (s)" },
    "APD":         { "type": ["number", "null"], "description": "Average wave period (s)" },
    "MWD":         { "type": ["number", "null"], "description": "Mean wave direction (degrees)" },
    "PRES":        { "type": ["number", "null"], "description": "Sea-level pressure (hPa)" },
    "ATMP":        { "type": ["number", "null"], "description": "Air temperature (C)" },
    "WTMP":        { "type": ["number", "null"], "description": "Water temperature (C)" },
    "DEWP":        { "type": ["number", "null"], "description": "Dewpoint (C)" },
    "VIS":         { "type": ["number", "null"], "description": "Visibility (nautical miles)" },
    "TIDE":        { "type": ["number", "null"], "description": "Tide level (ft)" }
  }
}
```

#### EPA AirNow AQI Reading (Canonical)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "EpaAirQualityReading",
  "type": "object",
  "required": ["DateObserved", "ParameterName", "AQI", "Latitude", "Longitude"],
  "properties": {
    "DateObserved":   { "type": "string", "format": "date" },
    "HourObserved":   { "type": "integer", "minimum": 0, "maximum": 23 },
    "LocalTimeZone":  { "type": "string" },
    "ReportingArea":  { "type": "string" },
    "StateCode":      { "type": "string", "pattern": "^[A-Z]{2}$" },
    "Latitude":       { "type": "number" },
    "Longitude":      { "type": "number" },
    "ParameterName":  { "type": "string", "enum": ["PM2.5", "PM10", "O3", "NO2", "SO2", "CO"] },
    "AQI":            { "type": "integer", "minimum": 0, "maximum": 500 },
    "Category": {
      "type": "object",
      "properties": {
        "Number": { "type": "integer", "minimum": 1, "maximum": 6 },
        "Name":   { "type": "string", "enum": ["Good", "Moderate", "Unhealthy for Sensitive Groups", "Unhealthy", "Very Unhealthy", "Hazardous"] }
      }
    }
  }
}
```

#### USGS Water Instantaneous Value (Canonical)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "UsgsWaterReading",
  "type": "object",
  "required": ["site_no", "datetime", "value", "parameter_cd"],
  "properties": {
    "site_no":       { "type": "string", "description": "USGS site number (8-15 digits)" },
    "site_name":     { "type": "string" },
    "latitude":      { "type": "number" },
    "longitude":     { "type": "number" },
    "datetime":      { "type": "string", "format": "date-time" },
    "value":         { "type": ["number", "null"] },
    "parameter_cd":  { "type": "string", "description": "USGS parameter code (e.g., 00060=discharge, 00065=gage height)" },
    "parameter_nm":  { "type": "string", "description": "Parameter name" },
    "unit":          { "type": "string", "description": "Measurement unit" },
    "qualifiers":    { "type": "array", "items": { "type": "string" }, "description": "Data quality flags" }
  }
}
```

### AVA.DS.5.4.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|-------------|---------------------|---------|
| USGS earthquake `geometry.coordinates` | `Facility` | Custom (H3 cell) | `8a2830828587fff` |
| USGS earthquake `id` | N/A (event, not entity) | Custom (USGS event ID) | `us7000n1bz` |
| NOAA buoy `station_id` | `Facility` | Custom (NDBC station) | `41002` |
| EPA AirNow `ReportingArea` + coords | `Facility` | Custom (H3 cell) | `8a2830828587fff` |
| USGS water `site_no` | `Facility` | Custom (USGS site) | `01646500` |

**Note**: MASINT sources produce measurements, not entity identifiers. They map to
`Facility` entities (monitoring stations) or provide environmental context for spatial
correlation. Seismic events are transient phenomena, not persistent entities.

### AVA.DS.5.4.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier | Description |
|------------------|-----------|----------|------|-------------|
| `Geoint` | Spatial | H3 cell | Tier 2 | Environmental readings at GEOINT locations |
| `Humint` | Spatial+Temporal | H3 cell + time window | Tier 2 | Environmental context for conflict events |
| `AdsB` | Spatial+Temporal | H3 cell + time window | Tier 2 | Weather conditions affecting flight paths |
| `Ais` | Spatial+Temporal | H3 cell + time window | Tier 2 | Sea state affecting vessel routes |
| `Satellite` | Spatial+Temporal | bbox + date | Tier 2 | Satellite imagery of seismic/weather events |
| `Osint` | Spatial+Temporal | location + time | Tier 3 | News reports corroborating MASINT detections |
| `Masint` (self) | Temporal | time bucket | Tier 3 | Multi-sensor environmental pattern detection |

### AVA.DS.5.4.6 Synthetic Data Generation

#### Earthquake Synthetic

- Schema: `UsgsEarthquakeEvent` (see 5.4.3)
- Value ranges: `mag` [1.0, 9.0] (Gutenberg-Richter distribution: log10(N)=a-bM, b~1.0),
  `depth` [0, 700] km, `coordinates` along tectonic plate boundaries,
  `alert` weighted [null:70%, green:15%, yellow:10%, orange:4%, red:1%],
  `tsunami` weighted [0:95%, 1:5%]
- Strategy: **Parametric** — Generate events along configurable fault lines (Ring of Fire,
  Mid-Atlantic Ridge, Himalayan Front). Temporal spacing follows Poisson process with
  aftershock clustering (modified Omori law).

#### Buoy Measurement Synthetic

- Schema: `NoaaBuoyMeasurement` (see 5.4.3)
- Value ranges: `WSPD` [0, 40] m/s, `WVHT` [0, 15] m, `PRES` [950, 1050] hPa,
  `ATMP` [-20, 40] C, `WTMP` [-2, 35] C, `WDIR` [0, 360] degrees
- Strategy: **Parametric** — Generate hourly readings from 10-50 synthetic stations at
  configurable lat/lon coordinates. Apply sinusoidal diurnal temperature variation and
  random-walk pressure trends to simulate realistic weather patterns.

#### Air Quality Synthetic

- Schema: `EpaAirQualityReading` (see 5.4.3)
- Value ranges: `AQI` [0, 300] (lognormal distribution, mean=50, sd=30),
  `ParameterName` weighted [PM2.5:40%, O3:30%, PM10:15%, NO2:10%, SO2:3%, CO:2%],
  `Category.Number` derived from AQI value per EPA breakpoints
- Strategy: **Parametric** — Generate hourly readings for 20-100 synthetic monitoring
  sites in major metro areas. Apply weekday/weekend AQI variation and seasonal trends.

#### Water Gauge Synthetic

- Schema: `UsgsWaterReading` (see 5.4.3)
- Value ranges: `value` depends on parameter — discharge (00060): [0, 50000] cfs,
  gage height (00065): [0, 50] ft, water temperature (00010): [0, 35] C
- Strategy: **Parametric** — Generate 15-minute readings from 10-30 synthetic gauge
  sites along configurable river systems. Apply seasonal flow variation (spring melt
  peak) and storm-event discharge spikes.

---

## AVA.DS.5.5 JetStream Configuration

All three signal kinds in this domain share a single JetStream stream:

| Property | Value |
|----------|-------|
| **Stream Name** | `SENSOR_GEO` |
| **Subjects** | `sensor.geoint.>`, `sensor.humint.>`, `sensor.masint.>` |
| **Retention** | Limits |
| **Max Age** | 168h (7 days) |
| **Storage** | File |
| **Max Bytes** | 10 GB |
| **Discard** | Old |
| **Num Replicas** | 1 (dev), 3 (prod) |

### Consumer Groups

| Consumer | Filter | Deliver Policy | Ack Policy | Max Deliver |
|----------|--------|---------------|------------|-------------|
| `geoint-ingestor` | `sensor.geoint.>` | All | Explicit | 3 |
| `humint-ingestor` | `sensor.humint.>` | All | Explicit | 3 |
| `masint-ingestor` | `sensor.masint.>` | All | Explicit | 3 |
| `geo-monitor` | `sensor.geoint.>`, `sensor.humint.>`, `sensor.masint.>` | New | None | 1 |

### Object Store Buckets

| Bucket | Purpose | Max Object Size |
|--------|---------|----------------|
| `ava-geoint-raster` | Sentinel/GHSL/Natural Earth raster tiles | 100 MB |
| `ava-humint-attachments` | Report attachments, images, documents | 50 MB |

---

## AVA.DS.5.6 References

- [OpenStreetMap Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [NASA FIRMS API](https://firms.modaps.eosdis.nasa.gov/api/)
- [Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu/)
- [Global Human Settlement Layer](https://human-settlement.emergency.copernicus.eu/)
- [Natural Earth](https://www.naturalearthdata.com/)
- [ACLED](https://acleddata.com/) — [API Docs](https://apidocs.acleddata.com/)
- [ReliefWeb API](https://apidoc.reliefweb.int/)
- [GDACS](https://www.gdacs.org/)
- [Humanitarian Data Exchange](https://data.humdata.org/)
- [SALUTE Report Format](https://www.elon.edu/assets/docs/rotc/FM%202-22.3%20Human%20Intelligence%20Collector%20Operations%20Appendix%20H%20SALUTE.pdf)
- [USGS Earthquake Hazards](https://earthquake.usgs.gov/) — [FDSN API](https://earthquake.usgs.gov/fdsnws/event/1/) — [GeoJSON Feeds](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php)
- [NOAA NDBC](https://www.ndbc.noaa.gov/) — [Data Guide](https://www.ndbc.noaa.gov/docs/ndbc_web_data_guide.pdf)
- [EPA AirNow API](https://docs.airnowapi.org/)
- [USGS Water Services](https://waterservices.usgs.gov/)
- [CTBTO vDEC](https://www.ctbto.org/resources/for-researchers-experts/vdec)
- [RFC2119](https://www.rfc-editor.org/rfc/rfc2119) — Key words for requirement levels
- [H3 Hexagonal Hierarchical Spatial Index](https://h3geo.org/)
- [ava-fusion SignalKind](../../ava-fusion/src/signal.rs) — `Geoint`, `Humint`, `Masint` variants
- [ava-fusion EntityClass](../../ava-fusion/src/entity.rs) — `Facility`, `Person`, `Organization` variants

---

*End of Section AVA.DS.5*
