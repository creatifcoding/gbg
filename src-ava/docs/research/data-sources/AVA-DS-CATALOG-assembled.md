# AVA Data Source Integration Catalog

```
Document:      AVA-DS-CATALOG
Title:         Ava Fusion Pipeline — Data Source Integration Catalog
Status:        DRAFT
Authors:       Val (Vigilant Architecture Layer)
Created:       2026-02-20
Revision:      0.1.0
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)

SignalKinds:   20 (AdsB, Ais, Radar, Satellite, RfBearing, Sdr, Sigint,
               Elint, Comint, Http, Dns, Cyber, Osint, Social, Financial,
               Travel, Geoint, Humint, Masint, Custom)
EntityClasses: 10 (Aircraft, Vessel, GroundVehicle, RfEmitter, NetworkHost,
               Domain, Person, Organization, Campaign, Facility)
```

> This catalog specifies the concrete data sources, API endpoints, payload
> schemas, NATS subject taxonomy, cross-domain correlation matrix, and E2E
> test harness for the ava-fusion sensor fusion pipeline. Each of the 20
> SignalKind variants maps to one or more real-world data sources with
> documented API access, authentication requirements, rate limits, and
> payload schemas. Where no free API exists, synthetic data generation
> strategies are specified.

---

## Metrics Summary

| Metric | Count |
|--------|-------|
| Total sections | 8 |
| Domain catalogs | 5 |
| Integration specs | 3 |
| Total section lines | 5,298 |
| SignalKind variants | 20 |
| EntityClass variants | 10 |
| Viable cross-correlation pairs | 84 |

---

## Table of Contents


**PART I: DATA SOURCE CATALOG**

- **AVA.DS.1**: Kinetic Domain Data Sources
- **AVA.DS.2**: RF/Signals Domain Data Sources
- **AVA.DS.3**: Cyber/Network Domain Data Sources
- **AVA.DS.4**: OSINT/Social/Financial Domain Data Sources
- **AVA.DS.5**: GEOINT/HUMINT/MASINT Domain Data Sources

**PART II: INTEGRATION SPECIFICATION (Normative)**

- **AVA.DS.6**: NATS Subject Taxonomy
- **AVA.DS.7**: Cross-Domain Correlation Matrix
- **AVA.DS.8**: E2E Test Harness Specification

---


---

# PART I: DATA SOURCE CATALOG

---

# AVA.DS.1: Kinetic Domain Data Sources

```
Section:       AVA.DS.1 — Kinetic Domain Data Sources
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          I — Data Source Catalog
Prerequisites: AVA.2 (Signal Schema), AVA.3 (NATS Subject Taxonomy)
Feeds:         AVA.DS.6 (NATS Taxonomy), AVA.DS.7 (Cross-Correlation Matrix)
```

> The Kinetic Domain encompasses four `SignalKind` variants from `ava-fusion/src/signal.rs`
> that produce positional/motion data for physical objects: **AdsB** (aircraft transponder),
> **Ais** (maritime vessel transponder), **Radar** (primary/secondary radar returns), and
> **Satellite** (overhead imagery and sensor products). These four signal kinds feed the
> core spatial-temporal fusion pipeline and produce Tier 1 (hard-key) and Tier 2 (soft-key)
> correlations across `Aircraft`, `Vessel`, `Facility`, and `GroundVehicle` entity classes.

---

## Table of Contents

1. [Overview](#avads11-overview)
2. [Signal Kind: AdsB](#avads12-signal-kind-adsb)
3. [Signal Kind: Ais](#avads13-signal-kind-ais)
4. [Signal Kind: Radar](#avads14-signal-kind-radar)
5. [Signal Kind: Satellite](#avads15-signal-kind-satellite)

---

## AVA.DS.1.1 Overview

The Kinetic Domain is the **primary spatial-temporal backbone** of the ava-fusion pipeline.
All four signal kinds produce geo-referenced, timestamped observations of physical entities
in motion. Their `DataType` classification (from `signal.rs`) is **Event** — volatile,
append-only, timestamped differential streams suitable for d2ts processing.

| SignalKind | DataType | Primary EntityClass | Primary Namespace | Typical Update Rate |
|------------|----------|--------------------|--------------------|---------------------|
| `AdsB` | Event | Aircraft | IcaoHex | 1-5 seconds |
| `Ais` | Event | Vessel | Mmsi | 2-180 seconds |
| `Radar` | Event | Aircraft / Vessel | Custom (track ID) | 4-12 seconds |
| `Satellite` | Event | Facility / Vessel | Custom (scene ID) | Minutes to days |

**JetStream Stream**: `SENSOR_KINETIC` captures all four signal kinds:
`sensor.adsb.>`, `sensor.ais.>`, `sensor.radar.>`, `sensor.satellite.>`
(Retention: Limits, Max Age: 24h, Storage: Memory).

---

## AVA.DS.1.2 Signal Kind: AdsB

> ADS-B (Automatic Dependent Surveillance -- Broadcast) is a cooperative surveillance
> technology where aircraft broadcast their GPS-derived position, velocity, altitude,
> and identification via 1090 MHz transponders. ADS-B provides the highest-fidelity
> positional data for the Aircraft entity class with updates every 1-5 seconds.

### AVA.DS.1.2.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| OpenSky Network | https://opensky-network.org/api | JSON | REST | OAuth2 (client credentials) or Basic (legacy, deprecated) | `icao24`, `callsign`, `longitude`, `latitude`, `baro_altitude`, `velocity`, `true_track`, `time_position` | 5s resolution; `states/all` endpoint | CC-BY 4.0; 400 credits/day (anon), 8000 credits/day (contributor) |
| ADSBexchange | https://rapidapi.com/adsbx/api/adsbexchange-com1 | JSON | REST (RapidAPI) | `X-RapidAPI-Key` header | `hex`, `flight`, `lat`, `lon`, `alt_baro`, `gs`, `track`, `seen_pos` | ~1s (real-time feed) | Commercial; $10/month via RapidAPI, 10k requests/month |
| dump1090 (local) | TCP `localhost:30003` | SBS-1 BaseStation (CSV-like) | TCP socket | None (local) | `HexIdent`, `Callsign`, `Altitude`, `GroundSpeed`, `Track`, `Lat`, `Long` | ~1s (real-time) | Open source (GPL-2.0); requires RTL-SDR hardware |
| FlightAware AeroAPI | https://www.flightaware.com/aeroapi/portal | JSON | REST (v4) | `x-apikey` header | `ident`, `fa_flight_id`, `latitude`, `longitude`, `altitude`, `groundspeed`, `heading` | Per-query (not streaming) | Commercial; usage-based pricing per query, 60+ endpoints |

**Source Selection Guidance**:
- **Development/Testing**: OpenSky (free tier, 400 credits/day anonymous) or dump1090 (local receiver)
- **Production (community)**: ADSBexchange via RapidAPI ($10/month)
- **Production (enterprise)**: FlightAware AeroAPI (SLA-backed, predictive ETAs)
- **Offline/Replay**: OpenSky historical endpoints (up to 1 hour lookback) or dump1090 replay files

### AVA.DS.1.2.2 NATS Subject Taxonomy

Subject hierarchy for ADS-B data. Follows `sensor.{kind}.{source}.{format}` pattern per AVA.3.

**Normative subjects** (MUST be implemented):

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.adsb.opensky.json` | JSON | Raw OpenSky `/states/all` state vector response |
| `sensor.adsb.opensky.parsed` | JSON (BaseSignal) | Parsed into canonical BaseSignal schema |
| `sensor.adsb.adsbx.json` | JSON | Raw ADSBexchange aircraft array |
| `sensor.adsb.adsbx.parsed` | JSON (BaseSignal) | Parsed into canonical BaseSignal schema |
| `sensor.adsb.dump1090.raw` | SBS-1 text | Raw BaseStation MSG lines from port 30003 |
| `sensor.adsb.dump1090.parsed` | JSON (BaseSignal) | Parsed SBS-1 into canonical BaseSignal schema |
| `sensor.adsb.flightaware.json` | JSON | Raw AeroAPI flight position response |
| `sensor.adsb.flightaware.parsed` | JSON (BaseSignal) | Parsed into canonical BaseSignal schema |
| `sensor.adsb.synthetic.json` | JSON (BaseSignal) | Synthetically generated test data |

**Wildcard**: `sensor.adsb.>` captures all ADS-B sources and formats for the SensorIngestor actor.

### AVA.DS.1.2.3 Payload Schema

**Canonical BaseSignal (ADS-B)**:

```json
{
  "signalKind": "adsB",
  "source": "opensky",
  "timestamp": "2026-02-20T14:30:00.000Z",
  "entity": {
    "class": "aircraft",
    "id": "a1b2c3",
    "namespace": "icaoHex"
  },
  "position": {
    "longitude": -73.9857,
    "latitude": 40.7484,
    "altitude_m": 10668.0,
    "altitude_source": "barometric"
  },
  "kinematics": {
    "ground_speed_mps": 230.5,
    "true_track_deg": 045.2,
    "vertical_rate_mps": 0.0
  },
  "metadata": {
    "callsign": "UAL123",
    "squawk": "1200",
    "spi": false,
    "on_ground": false,
    "category": 3
  },
  "raw": {}
}
```

**OpenSky State Vector fields** (source-specific raw payload):

| Field | Type | Description |
|-------|------|-------------|
| `icao24` | string | ICAO 24-bit hex address (lowercase) |
| `callsign` | string | Callsign (8 chars, right-padded with spaces) |
| `origin_country` | string | Inferred country of origin |
| `time_position` | int | Unix epoch of last position update |
| `last_contact` | int | Unix epoch of last message received |
| `longitude` | float | WGS-84 longitude in degrees |
| `latitude` | float | WGS-84 latitude in degrees |
| `baro_altitude` | float | Barometric altitude in meters |
| `on_ground` | bool | Whether aircraft is on ground |
| `velocity` | float | Ground speed in m/s |
| `true_track` | float | Track angle in degrees (clockwise from N) |
| `vertical_rate` | float | Vertical rate in m/s |
| `sensors` | int[] | IDs of receivers that contributed |
| `geo_altitude` | float | Geometric (GPS) altitude in meters |
| `squawk` | string | Transponder squawk code |
| `spi` | bool | Special purpose indicator |
| `position_source` | int | 0=ADS-B, 1=ASTERIX, 2=MLAT, 3=FLARM |

**SBS-1 BaseStation MSG fields** (dump1090 port 30003):

| Position | Field | Example |
|----------|-------|---------|
| 1 | Message type | `MSG` |
| 2 | Transmission type | `3` (airborne position) |
| 3 | Session ID | `1` |
| 4 | Aircraft ID | `1` |
| 5 | Hex Ident (ICAO) | `A1B2C3` |
| 6 | Flight ID | `1` |
| 7 | Date generated | `2026/02/20` |
| 8 | Time generated | `14:30:00.000` |
| 9 | Date logged | `2026/02/20` |
| 10 | Time logged | `14:30:00.001` |
| 11 | Callsign | `UAL123` |
| 12 | Altitude (ft) | `35000` |
| 13 | Ground speed (kt) | `448` |
| 14 | Track (deg) | `045` |
| 15 | Latitude | `40.7484` |
| 16 | Longitude | `-73.9857` |
| 17 | Vertical rate (ft/min) | `0` |
| 18 | Squawk | `1200` |
| 19 | Alert flag | `0` |
| 20 | Emergency flag | `0` |
| 21 | SPI flag | `0` |
| 22 | On ground flag | `0` |

### AVA.DS.1.2.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|--------------------|---------|
| `icao24` (OpenSky) | Aircraft | IcaoHex | `a1b2c3` |
| `hex` (ADSBexchange) | Aircraft | IcaoHex | `a1b2c3` |
| `HexIdent` (dump1090 SBS-1) | Aircraft | IcaoHex | `A1B2C3` |
| `fa_flight_id` (FlightAware) | Aircraft | Custom | `UAL123-1708000000-airline-0001` |

**Identity Resolution**: All ADS-B sources resolve to `EntityClass::Aircraft` via
`IdentifierNamespace::IcaoHex`. The ICAO 24-bit hex address is globally unique per
aircraft and serves as the Tier 1 hard join key. FlightAware uses a proprietary flight ID
that requires a secondary lookup via the `ident` (callsign) field for cross-source
correlation.

**Reference Data Join**: The FAA Aircraft Registry (reference source, `UpdateRate::Daily`)
provides tail number, aircraft type, and registered owner keyed by ICAO hex. NATS subject:
`sensor.adsb.faa-registry.csv` (reference, not event).

### AVA.DS.1.2.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier | Notes |
|------------------|-----------|----------|------|-------|
| `Radar` | Spatial + Temporal | H3 cell (res 9) + 10s time bucket | Tier 2 | Correlate transponder with primary radar returns |
| `Ais` | Spatial + Temporal | H3 cell (res 7) + 60s time bucket | Tier 2 | Aircraft over maritime zones correlate with nearby vessel tracks |
| `Satellite` | Spatial + Temporal | H3 cell (res 5) + 600s time bucket | Tier 2 | Satellite imagery confirms aircraft presence at airports/facilities |
| `RfBearing` | Bearing intersection | Triangulated position vs. ADS-B position | Tier 2 | Validate RF DF bearings against known ADS-B positions |
| `Osint` | Entity (callsign) | Callsign string match | Tier 3 | News/social media mentions of specific flights |
| `Sigint` | Frequency + Spatial | 1090 MHz band + H3 cell | Tier 3 | SIGINT intercepts on ADS-B frequencies |

### AVA.DS.1.2.6 Synthetic Data Generation

**Primary strategy**: Parametric trajectory generation.

| Parameter | Range | Distribution |
|-----------|-------|--------------|
| `icao24` | `000000`-`ffffff` | Uniform random 6-char hex |
| `callsign` | 3-letter ICAO code + 1-4 digit flight number | Sampled from ICAO airline database |
| `latitude` | -90.0 to 90.0 | Gaussian around major airports |
| `longitude` | -180.0 to 180.0 | Gaussian around major airports |
| `baro_altitude` | 0 - 13716 m (0-45000 ft) | Phase-dependent (climb/cruise/descent) |
| `velocity` | 0 - 280 m/s (0-544 kt) | Phase-dependent |
| `true_track` | 0 - 360 deg | Great circle bearing between waypoints |
| `vertical_rate` | -30 to +30 m/s | Phase-dependent |

**Generation Strategy**:
1. Select origin/destination airport pair from OpenFlights database
2. Compute great-circle route with waypoints
3. Generate climb/cruise/descent phases with realistic performance envelopes
4. Add Gaussian noise (position: +/- 50m, altitude: +/- 15m, speed: +/- 2 m/s)
5. Publish at 1-5 second intervals to `sensor.adsb.synthetic.json`
6. Inject anomalies: ADS-B spoofing (sudden position jumps), transponder gaps, ghost tracks

---

## AVA.DS.1.3 Signal Kind: Ais

> AIS (Automatic Identification System) is a maritime cooperative surveillance system
> where vessels broadcast their MMSI, position, course, speed, and vessel particulars
> via VHF radio (161.975 MHz / 162.025 MHz). IMO mandates AIS for all SOLAS vessels
> (gross tonnage > 300 on international voyages). AIS provides the primary hard-key
> identifier (MMSI) for the Vessel entity class.

### AVA.DS.1.3.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| NOAA Marine Cadastre | https://marinecadastre.gov/accessais/ | CSV (zstd-compressed) | Bulk download (HTTPS) | None (public) | `MMSI`, `BaseDateTime`, `LAT`, `LON`, `SOG`, `COG`, `Heading`, `VesselType`, `Status` | Historical (daily files); 1-minute sample rate | Public domain (US Gov) |
| AISHub | https://www.aishub.net/api | XML / JSON / CSV | REST + TCP/UDP feed | API key (requires AIS station contribution) | `MMSI`, `TIME`, `LONGITUDE`, `LATITUDE`, `COG`, `SOG`, `HEADING`, `NAVSTAT`, `IMO`, `NAME` | Real-time (seconds) | Community (reciprocal sharing) |
| Global Fishing Watch | https://globalfishingwatch.org/our-apis/documentation | JSON | REST | Bearer token (free registration for non-commercial) | `mmsi`, `timestamp`, `lat`, `lon`, `speed`, `course`, `fishing_hours` | Varies (event-based: encounters, loitering, port visits, fishing) | CC-BY-SA 4.0 (non-commercial); 50k requests/day |
| MarineTraffic | https://servicedocs.marinetraffic.com/ | JSON / XML | REST | API key (commercial subscription) | `MMSI`, `LAT`, `LON`, `SPEED`, `COURSE`, `HEADING`, `TIMESTAMP`, `SHIP_NAME`, `SHIP_TYPE`, `IMO` | Real-time (seconds) for subscribed vessels | Commercial; pricing per vessel count and data tier (Terrestrial/Satellite) |

**Source Selection Guidance**:
- **Development/Replay**: NOAA Marine Cadastre (free bulk historical, daily CSV files ~17 GB total for 2025)
- **Development (real-time)**: AISHub (requires contributing an AIS receiving station)
- **Research (fishing/maritime)**: Global Fishing Watch (free for non-commercial, 50k req/day)
- **Production (enterprise)**: MarineTraffic (SLA-backed, terrestrial + satellite AIS)

### AVA.DS.1.3.2 NATS Subject Taxonomy

**Normative subjects** (MUST be implemented):

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.ais.noaa.csv` | CSV row | Raw NOAA Marine Cadastre CSV record |
| `sensor.ais.noaa.parsed` | JSON (BaseSignal) | Parsed into canonical BaseSignal schema |
| `sensor.ais.aishub.nmea` | NMEA 0183 text | Raw NMEA sentences from AISHub TCP feed |
| `sensor.ais.aishub.json` | JSON | AISHub REST API JSON response |
| `sensor.ais.aishub.parsed` | JSON (BaseSignal) | Parsed into canonical BaseSignal schema |
| `sensor.ais.gfw.json` | JSON | Global Fishing Watch API response |
| `sensor.ais.gfw.parsed` | JSON (BaseSignal) | Parsed into canonical BaseSignal schema |
| `sensor.ais.marinetraffic.json` | JSON | MarineTraffic API response |
| `sensor.ais.marinetraffic.parsed` | JSON (BaseSignal) | Parsed into canonical BaseSignal schema |
| `sensor.ais.synthetic.json` | JSON (BaseSignal) | Synthetically generated test data |

**Wildcard**: `sensor.ais.>` captures all AIS sources.

### AVA.DS.1.3.3 Payload Schema

**Canonical BaseSignal (AIS)**:

```json
{
  "signalKind": "ais",
  "source": "noaa",
  "timestamp": "2026-02-20T14:30:00.000Z",
  "entity": {
    "class": "vessel",
    "id": "367000001",
    "namespace": "mmsi"
  },
  "position": {
    "longitude": -122.4194,
    "latitude": 37.7749,
    "altitude_m": null,
    "altitude_source": null
  },
  "kinematics": {
    "ground_speed_mps": 5.14,
    "true_track_deg": 220.5,
    "vertical_rate_mps": null
  },
  "metadata": {
    "vessel_name": "PACIFIC EXPLORER",
    "imo": "9876543",
    "callsign": "WDC1234",
    "vessel_type": 70,
    "nav_status": 0,
    "heading": 220,
    "draught": 8.5,
    "destination": "USOAK",
    "eta": "02201800"
  },
  "raw": {}
}
```

**NOAA Marine Cadastre CSV fields**:

| Field | Type | Description |
|-------|------|-------------|
| `MMSI` | string | Maritime Mobile Service Identity (9 digits) |
| `BaseDateTime` | datetime | UTC timestamp of position report |
| `LAT` | float | WGS-84 latitude in degrees |
| `LON` | float | WGS-84 longitude in degrees |
| `SOG` | float | Speed over ground in knots (0-102.2) |
| `COG` | float | Course over ground in degrees (0-359.9) |
| `Heading` | float | True heading in degrees (0-359) |
| `VesselName` | string | Vessel name from static AIS data |
| `IMO` | string | IMO vessel number |
| `CallSign` | string | Radio callsign |
| `VesselType` | int | AIS vessel type code (0-99) |
| `Status` | int | AIS navigational status (0-15) |
| `Length` | float | Vessel length in meters |
| `Width` | float | Vessel width in meters |
| `Draft` | float | Vessel draft in meters |
| `Cargo` | int | Cargo type code |
| `TransceiverClass` | string | AIS transceiver class (A or B) |

**NMEA 0183 AIS sentence** (AISHub raw feed):

```
!AIVDM,1,1,,B,15N4cR`005Jrek0H@9n`DW5608EP,0*13
```

Decoded via ITU-R M.1371 into message types 1-27. Position reports are message types
1, 2, 3 (Class A) and 18, 19 (Class B).

### AVA.DS.1.3.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|--------------------|---------|
| `MMSI` (NOAA) | Vessel | Mmsi | `367000001` |
| `MMSI` (AISHub) | Vessel | Mmsi | `367000001` |
| `mmsi` (GFW) | Vessel | Mmsi | `367000001` |
| `MMSI` (MarineTraffic) | Vessel | Mmsi | `367000001` |

**Identity Resolution**: All AIS sources resolve to `EntityClass::Vessel` via
`IdentifierNamespace::Mmsi`. The 9-digit MMSI is the Tier 1 hard join key. IMO numbers
provide a secondary hard key for SOLAS vessels (cross-reference via ITU/IMO registries).

**Reference Data Join**: ITU Maritime Mobile Access and Retrieval System (MARS) database
provides registered vessel details keyed by MMSI. National vessel registries (e.g., USCG
PSIX) provide additional metadata.

### AVA.DS.1.3.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier | Notes |
|------------------|-----------|----------|------|-------|
| `Radar` | Spatial + Temporal | H3 cell (res 7) + 30s time bucket | Tier 2 | Correlate AIS with coastal radar tracks |
| `AdsB` | Spatial + Temporal | H3 cell (res 7) + 60s time bucket | Tier 2 | Aircraft overflying maritime zones |
| `Satellite` | Spatial + Temporal | H3 cell (res 5) + 600s time bucket | Tier 2 | SAR/optical imagery confirms vessel presence |
| `RfBearing` | Bearing intersection | Triangulated position vs. AIS position | Tier 2 | VHF direction finding for AIS transmitter validation |
| `Osint` | Entity (vessel name/MMSI) | String match on vessel identifiers | Tier 3 | News mentions of specific vessels |
| `Financial` | Entity (IMO/owner) | IMO lookup to beneficial ownership | Tier 3 | Sanctions screening via OFAC/OpenSanctions |

### AVA.DS.1.3.6 Synthetic Data Generation

**Primary strategy**: Shipping lane simulation with realistic vessel behavior.

| Parameter | Range | Distribution |
|-----------|-------|--------------|
| `mmsi` | `200000000`-`799999999` | Structured by MID (Maritime Identification Digit) |
| `vessel_name` | Generated from markov model | Seeded from real vessel name corpus |
| `latitude` | -90.0 to 90.0 | Concentrated on major shipping lanes |
| `longitude` | -180.0 to 180.0 | Concentrated on major shipping lanes |
| `sog` | 0 - 25 knots | Vessel-type dependent (tanker: 10-14 kt, container: 14-22 kt) |
| `cog` | 0 - 360 deg | Route-following with drift |
| `nav_status` | 0-15 | Predominantly 0 (under way) with port visits |
| `vessel_type` | 0-99 | Weighted toward common types (70=cargo, 80=tanker) |

**Generation Strategy**:
1. Select major port pair from global shipping routes (e.g., Shanghai to Rotterdam)
2. Generate route waypoints following established shipping lanes
3. Simulate speed changes for weather, straits, port approach
4. Add reporting gaps (2-180 second intervals per AIS class A/B)
5. Publish to `sensor.ais.synthetic.json`
6. Inject anomalies: AIS dark periods (transponder off), spoofed positions, flag-hopping MMSI changes

---

## AVA.DS.1.4 Signal Kind: Radar

> Radar (Radio Detection and Ranging) encompasses both **surveillance radar** (primary
> and secondary) used for air traffic control and coastal monitoring, and **weather radar**
> (NEXRAD) providing reflectivity/velocity data. Radar provides non-cooperative detection
> capability -- it can observe targets that do not broadcast ADS-B or AIS, making it
> essential for fusion with cooperative sources.

### AVA.DS.1.4.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| FAA SWIM (TFMS/TBFM) | https://www.faa.gov/air_traffic/technology/swim | XML (FIXM) / JSON | JMS (Java Message Service) via NEMS | FAA SWIM account (government/approved entities) | `gufi`, `position`, `altitude`, `speed`, `flightRef`, `eta`, `sta` | Streaming (seconds) | US Government; requires SWIM access agreement |
| NOAA NEXRAD Level II | `s3://unidata-nexrad-level2/` | Binary (NEXRAD Archive II) | AWS S3 (public, `--no-sign-request`) | None (public S3 bucket) | `station_id`, `elevation_angle`, `reflectivity`, `velocity`, `spectrum_width`, `timestamp` | 4-6 minute volume scans | Public domain (US Gov); real-time chunks in `unidata-nexrad-level2-chunks` (24h retention) |
| NOAA NEXRAD Level III | https://mesonet.agron.iastate.edu/archive/ | Various (NIDS format) | HTTPS download / THREDDS OPeNDAP | None (public) | `product_code`, `station_id`, `timestamp`, derived products (storm tracks, mesocyclones) | 4-6 minutes | Public domain (US Gov) |
| Synthetic Radar Track Generator | Local | JSON | N/A (local process) | None | `track_id`, `lat`, `lon`, `altitude`, `speed`, `heading`, `rcs` | Configurable (1-12s) | Internal (test only) |

**Source Selection Guidance**:
- **Development/Replay**: NOAA NEXRAD via AWS S3 (free, public, massive archive)
- **ATC Track Data**: FAA SWIM (requires approved access -- government or research partners)
- **Production (weather overlay)**: NEXRAD Level II real-time chunks (24h S3 retention + SNS notification)
- **Testing**: Synthetic radar track generator (parametric, supports anomalies)

### AVA.DS.1.4.2 NATS Subject Taxonomy

**Normative subjects** (MUST be implemented):

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.radar.swim.xml` | FIXM XML | Raw FAA SWIM TFMS/TBFM message |
| `sensor.radar.swim.parsed` | JSON (BaseSignal) | Parsed SWIM data into canonical schema |
| `sensor.radar.nexrad.raw` | Binary | Raw NEXRAD Level II archive data chunk |
| `sensor.radar.nexrad.json` | JSON | Parsed NEXRAD metadata (station, timestamp, products) |
| `sensor.radar.nexrad.parsed` | JSON (BaseSignal) | Extracted features (storm cells, tracks) as BaseSignal |
| `sensor.radar.synthetic.json` | JSON (BaseSignal) | Synthetically generated radar tracks |

**Wildcard**: `sensor.radar.>` captures all radar sources.

### AVA.DS.1.4.3 Payload Schema

**Canonical BaseSignal (Radar -- Surveillance Track)**:

```json
{
  "signalKind": "radar",
  "source": "swim",
  "timestamp": "2026-02-20T14:30:00.000Z",
  "entity": {
    "class": "aircraft",
    "id": "SWIM-TRK-00042",
    "namespace": "custom"
  },
  "position": {
    "longitude": -73.9857,
    "latitude": 40.7484,
    "altitude_m": 10668.0,
    "altitude_source": "radar"
  },
  "kinematics": {
    "ground_speed_mps": 230.5,
    "true_track_deg": 045.2,
    "vertical_rate_mps": 0.0
  },
  "metadata": {
    "gufi": "AA00000001202602201430",
    "track_quality": 0.95,
    "radar_site": "JFK",
    "rcs_dbsm": 15.0,
    "mode_s_code": "A1B2C3",
    "ssr_code": "1200"
  },
  "raw": {}
}
```

**Canonical BaseSignal (Radar -- NEXRAD Weather)**:

```json
{
  "signalKind": "radar",
  "source": "nexrad",
  "timestamp": "2026-02-20T14:30:00.000Z",
  "entity": {
    "class": "facility",
    "id": "KTLX",
    "namespace": "custom"
  },
  "position": {
    "longitude": -97.2778,
    "latitude": 35.3331,
    "altitude_m": 370.0,
    "altitude_source": "site_elevation"
  },
  "kinematics": {
    "ground_speed_mps": null,
    "true_track_deg": null,
    "vertical_rate_mps": null
  },
  "metadata": {
    "station_id": "KTLX",
    "vcp": 212,
    "elevation_angle": 0.5,
    "max_reflectivity_dbz": 55.0,
    "products": ["reflectivity", "velocity", "spectrum_width"],
    "storm_cells_detected": 3
  },
  "raw": {}
}
```

**NEXRAD Level II data organization** (AWS S3):

```
s3://unidata-nexrad-level2/{year}/{month}/{day}/{site}/{site}{year}{month}{day}_{HHMMSS}_V06
```

Example: `s3://unidata-nexrad-level2/2026/02/20/KTLX/KTLX20260220_143000_V06`

Real-time chunks: `s3://unidata-nexrad-level2-chunks/` (24h retention, SNS notifications available).

### AVA.DS.1.4.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|--------------------|---------|
| `gufi` + `mode_s_code` (SWIM) | Aircraft | IcaoHex (when Mode S available) | `A1B2C3` |
| `track_id` (SWIM, no Mode S) | Aircraft | Custom | `SWIM-TRK-00042` |
| `station_id` (NEXRAD) | Facility | Custom | `KTLX` |
| `track_id` (Synthetic) | Aircraft / Vessel / GroundVehicle | Custom | `SYN-RAD-00001` |

**Identity Resolution**: Radar tracks are inherently non-cooperative -- the radar assigns
an internal track ID. When Mode S (secondary surveillance radar) is available, the ICAO
hex code provides a Tier 1 hard key for Aircraft correlation with ADS-B. Primary-only
radar tracks require Tier 2 spatial-temporal correlation.

### AVA.DS.1.4.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier | Notes |
|------------------|-----------|----------|------|-------|
| `AdsB` | Spatial + Temporal | H3 cell (res 9) + 10s time bucket | Tier 2 | Primary use case: validate ADS-B with radar returns |
| `Ais` | Spatial + Temporal | H3 cell (res 7) + 30s time bucket | Tier 2 | Coastal radar correlates with AIS vessel tracks |
| `Satellite` | Spatial + Temporal | H3 cell (res 5) + 600s time bucket | Tier 2 | Satellite imagery confirms radar-detected objects |
| `RfBearing` | Bearing intersection | Triangulated bearing vs. radar position | Tier 2 | RF DF bearings validated against radar track |
| `Elint` | Frequency + Spatial | Radar emitter parameters + position | Tier 2 | ELINT characterization of radar emissions |

### AVA.DS.1.4.6 Synthetic Data Generation

**Primary strategy**: Parametric track generation with realistic radar characteristics.

| Parameter | Range | Distribution |
|-----------|-------|--------------|
| `track_id` | Auto-incrementing `SYN-RAD-NNNNN` | Sequential |
| `latitude` | Coverage area of simulated radar site | Uniform within site range |
| `longitude` | Coverage area of simulated radar site | Uniform within site range |
| `altitude` | 0 - 15000 m | Target-type dependent |
| `rcs_dbsm` | -20 to +40 dBsm | Target-type dependent (bird: -10, GA: +5, commercial: +20) |
| `speed` | 0 - 340 m/s | Target-type dependent |
| `track_quality` | 0.0 - 1.0 | Higher for cooperative targets |

**Generation Strategy**:
1. Define radar site position and coverage parameters (range, min elevation)
2. Generate N tracks with random start positions within coverage
3. Apply great-circle or straight-line trajectories with speed/altitude profiles
4. Add radar-specific noise (range quantization, azimuth jitter, missed detections)
5. Publish at radar scan rate (4-12 seconds) to `sensor.radar.synthetic.json`
6. Inject anomalies: clutter tracks, split tracks, track swaps, ghost returns

---

## AVA.DS.1.5 Signal Kind: Satellite

> Satellite encompasses overhead sensor platforms providing electro-optical (EO),
> synthetic aperture radar (SAR), multispectral, and thermal imagery. Satellite data
> provides wide-area, non-cooperative observation capability that complements the
> point-source nature of ADS-B, AIS, and radar. Temporal resolution ranges from
> minutes (fire hotspots) to days (revisit cycle), but spatial coverage is global.

### AVA.DS.1.5.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| Copernicus / Sentinel-2 | https://dataspace.copernicus.eu/ | GeoTIFF (COG) / STAC metadata JSON | STAC API + Sentinel Hub API | OAuth2 (free registration) | `product_id`, `acquisition_date`, `cloud_cover`, `tile_id`, `bands`, `geometry` | 5-day revisit (per satellite); 2-3 day effective (constellation) | CC-BY (Copernicus free, full and open); STAC at `catalogue.dataspace.copernicus.eu` |
| NASA FIRMS | https://firms.modaps.eosdis.nasa.gov/api/ | CSV / JSON / KML | REST | MAP_KEY (free registration) | `latitude`, `longitude`, `brightness`, `confidence`, `acq_date`, `acq_time`, `satellite`, `frp` | Near real-time (3-4h latency for MODIS; ~30 min for VIIRS) | Public domain (US Gov); 5000 transactions per 10-min interval |
| USGS Landsat | https://earthexplorer.usgs.gov/ | GeoTIFF (COG) / STAC metadata JSON | M2M REST API + STAC | USGS ERS account (free) | `scene_id`, `wrs_path`, `wrs_row`, `acquisition_date`, `cloud_cover`, `sensor_id` | 16-day revisit (per satellite); 8-day effective (Landsat 8+9) | Public domain (US Gov); STAC at `landsatlook.usgs.gov/stac-server` |
| Planet Labs | https://docs.planet.com/ | GeoTIFF / STAC metadata JSON | REST (Data API v2) | API key (Basic HTTP Auth) | `item_id`, `geometry`, `acquired`, `cloud_cover`, `gsd`, `satellite_id` | Daily (3-5m resolution, PlanetScope); sub-daily (SkySat tasking) | Commercial; Education/Research: 3,000 km^2/month free; ~5 req/s rate limit |

**Source Selection Guidance**:
- **Development/Research**: Copernicus Sentinel-2 (free, open, global, 10m resolution) or USGS Landsat (free, 30m)
- **Fire/Hotspot Detection**: NASA FIRMS (free, near real-time, global)
- **Production (high-cadence)**: Planet Labs (daily global, 3-5m resolution, commercial)
- **SAR (cloud-penetrating)**: Copernicus Sentinel-1 (free, C-band SAR, 12-day revisit)

### AVA.DS.1.5.2 NATS Subject Taxonomy

**Normative subjects** (MUST be implemented):

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.satellite.sentinel.json` | JSON (STAC Item) | Sentinel-2 STAC catalog item metadata |
| `sensor.satellite.sentinel.geotiff` | Reference (Object Store key) | Sentinel-2 image tile (metadata only in subject; image in Object Store) |
| `sensor.satellite.sentinel.parsed` | JSON (BaseSignal) | Parsed Sentinel-2 metadata as canonical BaseSignal |
| `sensor.satellite.firms.json` | JSON | NASA FIRMS fire hotspot detection |
| `sensor.satellite.firms.parsed` | JSON (BaseSignal) | Parsed FIRMS hotspot as BaseSignal |
| `sensor.satellite.landsat.json` | JSON (STAC Item) | USGS Landsat STAC catalog item metadata |
| `sensor.satellite.landsat.parsed` | JSON (BaseSignal) | Parsed Landsat metadata as BaseSignal |
| `sensor.satellite.planet.json` | JSON | Planet Labs Data API item metadata |
| `sensor.satellite.planet.parsed` | JSON (BaseSignal) | Parsed Planet item as BaseSignal |
| `sensor.satellite.synthetic.json` | JSON (BaseSignal) | Synthetically generated satellite observation events |

**Normative**: Satellite imagery payloads (GeoTIFF, COG) MUST be stored in NATS Object Store.
Subject messages MUST contain only metadata and an Object Store reference key. This follows
the same pattern as RF IQ samples (AVA.3-R7).

**Wildcard**: `sensor.satellite.>` captures all satellite sources.

### AVA.DS.1.5.3 Payload Schema

**Canonical BaseSignal (Satellite -- Imagery Metadata)**:

```json
{
  "signalKind": "satellite",
  "source": "sentinel",
  "timestamp": "2026-02-20T10:15:30.000Z",
  "entity": {
    "class": "facility",
    "id": "T33UUP",
    "namespace": "custom"
  },
  "position": {
    "longitude": 12.4964,
    "latitude": 41.9028,
    "altitude_m": 786000.0,
    "altitude_source": "orbit"
  },
  "kinematics": {
    "ground_speed_mps": null,
    "true_track_deg": null,
    "vertical_rate_mps": null
  },
  "metadata": {
    "product_id": "S2A_MSIL2A_20260220T101531_N0400_R065_T33UUP_20260220T123456",
    "platform": "Sentinel-2A",
    "instrument": "MSI",
    "processing_level": "L2A",
    "cloud_cover_pct": 12.5,
    "tile_id": "T33UUP",
    "crs": "EPSG:32633",
    "bands": ["B02", "B03", "B04", "B08"],
    "gsd_m": 10.0,
    "geometry_wkt": "POLYGON((12.0 41.5, 13.0 41.5, 13.0 42.5, 12.0 42.5, 12.0 41.5))",
    "object_store_key": "satellite/sentinel/S2A_20260220T101531_T33UUP.tif"
  },
  "raw": {}
}
```

**Canonical BaseSignal (Satellite -- FIRMS Hotspot)**:

```json
{
  "signalKind": "satellite",
  "source": "firms",
  "timestamp": "2026-02-20T06:42:00.000Z",
  "entity": {
    "class": "facility",
    "id": "FIRMS-20260220-064200-3478N-11823W",
    "namespace": "custom"
  },
  "position": {
    "longitude": -118.23,
    "latitude": 34.78,
    "altitude_m": null,
    "altitude_source": null
  },
  "kinematics": {
    "ground_speed_mps": null,
    "true_track_deg": null,
    "vertical_rate_mps": null
  },
  "metadata": {
    "satellite": "NOAA-20",
    "instrument": "VIIRS",
    "brightness_k": 342.5,
    "bright_ti5_k": 310.2,
    "frp_mw": 45.8,
    "confidence": "high",
    "scan_km": 0.39,
    "track_km": 0.36,
    "daynight": "D",
    "type": 0
  },
  "raw": {}
}
```

**NASA FIRMS CSV fields**:

| Field | Type | Description |
|-------|------|-------------|
| `latitude` | float | Center latitude of fire pixel |
| `longitude` | float | Center longitude of fire pixel |
| `brightness` | float | Brightness temperature (Kelvin) — channel 21/22 |
| `scan` | float | Along-scan pixel size (km) |
| `track` | float | Along-track pixel size (km) |
| `acq_date` | string | Acquisition date (YYYY-MM-DD) |
| `acq_time` | string | Acquisition time (HHMM UTC) |
| `satellite` | string | Satellite name (Terra, Aqua, NOAA-20, NOAA-21, Landsat) |
| `instrument` | string | Instrument (MODIS, VIIRS, OLI) |
| `confidence` | string | Detection confidence (low/nominal/high) |
| `version` | string | Collection version |
| `bright_ti4` | float | Brightness temperature VIIRS I-4 channel (K) |
| `bright_ti5` | float | Brightness temperature VIIRS I-5 channel (K) |
| `frp` | float | Fire Radiative Power (MW) |
| `daynight` | string | D=day, N=night |
| `type` | int | 0=presumed vegetation, 1=active volcano, 2=other static, 3=offshore |

### AVA.DS.1.5.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|--------------------|---------|
| `tile_id` (Sentinel-2) | Facility | Custom | `T33UUP` |
| `scene_id` (Landsat) | Facility | Custom | `LC08_L2SP_042036_20260220` |
| `item_id` (Planet) | Facility | Custom | `20260220_153042_1003` |
| hotspot lat/lon (FIRMS) | Facility | Custom | `FIRMS-20260220-064200-3478N-11823W` |

**Identity Resolution**: Satellite observations map primarily to `EntityClass::Facility`
(fixed infrastructure, terrain features) or can be correlated to Vessel/Aircraft entity
classes via spatial-temporal joins. Satellite data does not carry cooperative identifiers --
all correlation is Tier 2 (spatial-temporal) or Tier 3 (pattern-based, e.g., vessel wake
detection in SAR imagery).

### AVA.DS.1.5.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier | Notes |
|------------------|-----------|----------|------|-------|
| `Ais` | Spatial + Temporal | H3 cell (res 5) + 600s time bucket | Tier 2 | SAR/EO detects vessels; correlate with AIS positions |
| `AdsB` | Spatial + Temporal | H3 cell (res 5) + 600s time bucket | Tier 2 | Imagery of airports confirms aircraft presence |
| `Radar` | Spatial + Temporal | H3 cell (res 5) + 600s time bucket | Tier 2 | Weather radar (NEXRAD) overlays with satellite weather imagery |
| `Geoint` | Spatial | H3 cell (res 7) + feature overlap | Tier 1 | Satellite imagery is a primary GEOINT source |
| `Masint` | Spatial + Temporal | H3 cell (res 5) + time window | Tier 2 | Satellite thermal + MASINT seismic/acoustic for event confirmation |
| `Osint` | Temporal + Entity | Temporal proximity + location mention | Tier 3 | News reports of fires/floods correlated with FIRMS/Sentinel data |

### AVA.DS.1.5.6 Synthetic Data Generation

**Primary strategy**: Simulated observation events with realistic metadata.

| Parameter | Range | Distribution |
|-----------|-------|--------------|
| `tile_id` | MGRS tile codes | Sampled from areas of interest |
| `acquisition_date` | Historical/projected revisit schedule | Platform-specific orbit model |
| `cloud_cover_pct` | 0 - 100% | Beta distribution (mode ~30%) |
| `gsd_m` | 0.3 - 30 m | Platform-specific |
| `brightness_k` (FIRMS) | 300 - 500 K | Normal (mean 340K for vegetation fire) |
| `frp_mw` (FIRMS) | 0.1 - 500 MW | Log-normal |
| `confidence` (FIRMS) | low / nominal / high | Weighted (10% / 40% / 50%) |

**Generation Strategy**:
1. Define area of interest (AOI) as GeoJSON polygon
2. Simulate satellite overpasses using simplified TLE orbital mechanics
3. For each overpass, generate STAC-compliant metadata (cloud cover, sun elevation, etc.)
4. For FIRMS-type data, randomly place fire pixels within the AOI with realistic brightness/FRP
5. Publish metadata events to `sensor.satellite.synthetic.json`
6. Inject anomalies: cloud-obscured targets, off-nadir collection angles, temporal gaps

---

*End of Section AVA.DS.1*


---

# AVA.DS.2: RF/Signals Domain Data Sources

```
Section:       AVA.DS.2 — RF/Signals Domain Data Sources
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (researcher-rf)
Created:       2026-02-20
Part:          I — Data Source Catalog
Prerequisites: AVA.2 (Signal Schema), AVA.3 (NATS Subject Taxonomy)
SignalKinds:   RfBearing, Sdr, Sigint, Elint, Comint
```

> This section catalogs data sources for the RF/Signals domain covering five
> SignalKind variants: **RfBearing** (direction-finding bearings), **Sdr**
> (software-defined radio IQ captures), **Sigint** (signals intelligence
> frequency/license data), **Elint** (electronic intelligence emitter
> characterization), and **Comint** (communications intelligence intercept
> metadata). The RF domain is **heavily synthetic** — most operational data is
> classified or commercially restricted. This catalog documents the few
> publicly accessible sources alongside detailed synthetic generation
> strategies for each signal kind.

---

## Table of Contents

1. [Overview](#avads21-overview)
2. [Signal Kind: RfBearing](#avads22-signal-kind-rfbearing)
3. [Signal Kind: Sdr](#avads23-signal-kind-sdr)
4. [Signal Kind: Sigint](#avads24-signal-kind-sigint)
5. [Signal Kind: Elint](#avads25-signal-kind-elint)
6. [Signal Kind: Comint](#avads26-signal-kind-comint)

---

## AVA.DS.2.1 Overview

The RF/Signals domain covers electromagnetic spectrum collection and analysis.
Unlike the Kinetic domain (ADS-B, AIS) where free, high-fidelity real-time
feeds exist, RF signals intelligence operates under significant access
constraints:

| Constraint | Impact |
|-----------|--------|
| **Classification** | SIGINT/ELINT/COMINT operational data is classified at national level |
| **Commercial licensing** | Direction-finding and spectrum monitoring systems are expensive |
| **Physics complexity** | Realistic RF propagation requires environmental modeling |
| **Legal restrictions** | Intercepting communications is illegal in most jurisdictions without authorization |

**Strategy**: Use the publicly accessible sources that exist (KiwiSDR, FCC ULS,
ITU BRIFIC, SigMF recordings) for format validation and schema grounding, then
generate synthetic data with realistic statistical distributions for pipeline
testing.

**Entity Mapping**: All five RF signal kinds map primarily to `EntityClass::RfEmitter`
with secondary mappings to `Aircraft`, `Vessel`, and `Facility` through
cross-correlation.

---

## AVA.DS.2.2 Signal Kind: RfBearing

> RF direction-finding bearing measurements — azimuth/elevation from a sensor
> toward a detected emitter, optionally with Time Difference of Arrival (TDoA)
> multilateration results.

### AVA.DS.2.2.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| KiwiSDR Network (TDoA) | http://kiwisdr.com | JSON + WAV/IQ | WebSocket | None (public) | `frequency_hz`, `bearing_deg`, `lat`, `lon`, `snr_db`, `timestamp` | On-demand | Public/community |
| KiwiSDR TDoA Extension | http://kiwisdr.com/app/TDoA/ | JSON result + heatmap | HTTP | None | `tdoa_lat`, `tdoa_lon`, `confidence`, `receivers[]` | Per-query | Public |
| OpenWebRX Direction Finding | https://www.openwebrx.de/ | JSON | WebSocket | Varies by instance | `frequency_hz`, `bearing_deg`, `bandwidth_hz` | Real-time | Open-source (AGPL) |
| Synthetic DF Generator | Local | JSON | N/A | N/A | `frequency_hz`, `bearing_deg`, `elevation_deg`, `snr_db`, `error_deg` | Configurable | N/A |

**Notes on KiwiSDR**:
- ~600 public KiwiSDR receivers worldwide provide 0-30 MHz coverage
- TDoA requires selecting 2+ receivers to triangulate; each records 30s of IQ at the target frequency
- GPS-synchronized clocks enable cross-correlation for geolocation
- TDoA service has been intermittently restricted outside amateur/time-station bands
- No formal REST API — integration requires WebSocket scraping of the OpenWebRX interface
- Best used as a **format reference** and occasional validation source, not a production feed

### AVA.DS.2.2.2 NATS Subject Taxonomy

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.rfbearing.kiwisdr.json` | JSON | KiwiSDR TDoA bearing measurement |
| `sensor.rfbearing.openwebrx.json` | JSON | OpenWebRX DF bearing |
| `sensor.rfbearing.synthetic.json` | JSON | Generated DF bearing data |
| `sensor.rfbearing.synthetic.batch` | JSON array | Batch of synthetic bearings for replay |

**Normative**: RfBearing subjects MUST include sensor position (lat/lon) in the
payload to enable multilateration at the fusion layer. A single bearing from one
sensor is insufficient for geolocation — the fusion engine combines bearings
from multiple sensors via Tier 2 spatial+temporal correlation.

### AVA.DS.2.2.3 Payload Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "RfBearingMeasurement",
  "type": "object",
  "required": ["timestamp", "sensor_id", "sensor_lat", "sensor_lon", "frequency_hz", "bearing_deg"],
  "properties": {
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 UTC timestamp of measurement"
    },
    "sensor_id": {
      "type": "string",
      "description": "Unique identifier of the DF sensor/receiver"
    },
    "sensor_lat": {
      "type": "number",
      "minimum": -90,
      "maximum": 90,
      "description": "Sensor latitude (WGS84)"
    },
    "sensor_lon": {
      "type": "number",
      "minimum": -180,
      "maximum": 180,
      "description": "Sensor longitude (WGS84)"
    },
    "frequency_hz": {
      "type": "number",
      "minimum": 0,
      "description": "Center frequency of the detected emission in Hz"
    },
    "bearing_deg": {
      "type": "number",
      "minimum": 0,
      "maximum": 360,
      "description": "True bearing from sensor to emitter (degrees, 0=North, clockwise)"
    },
    "elevation_deg": {
      "type": ["number", "null"],
      "minimum": -90,
      "maximum": 90,
      "description": "Elevation angle (if 3D DF available)"
    },
    "bearing_error_deg": {
      "type": "number",
      "minimum": 0,
      "description": "Estimated 1-sigma bearing error in degrees"
    },
    "snr_db": {
      "type": ["number", "null"],
      "description": "Signal-to-noise ratio at the sensor in dB"
    },
    "bandwidth_hz": {
      "type": ["number", "null"],
      "description": "Measured signal bandwidth in Hz"
    },
    "modulation": {
      "type": ["string", "null"],
      "description": "Detected modulation type (AM, FM, SSB, CW, digital, unknown)"
    },
    "tdoa_result": {
      "type": ["object", "null"],
      "description": "TDoA multilateration result (if available)",
      "properties": {
        "estimated_lat": { "type": "number" },
        "estimated_lon": { "type": "number" },
        "cep_90_m": { "type": "number", "description": "90% circular error probable in meters" },
        "receivers_used": { "type": "integer", "minimum": 2 }
      }
    }
  }
}
```

### AVA.DS.2.2.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|---------------------|---------|
| `frequency_hz` + `bearing_deg` + time | `RfEmitter` | Custom (freq+geohash) | `14.100MHz@u4pru` |
| `tdoa_result.estimated_lat/lon` | `RfEmitter` | Custom (H3 cell) | `emitter@8a2a1072b59ffff` |
| Cross-correlated with ADS-B | `Aircraft` | IcaoHex | `a12345` |
| Cross-correlated with AIS | `Vessel` | Mmsi | `211234567` |

### AVA.DS.2.2.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier |
|------------------|-----------|----------|------|
| `AdsB` | Spatial+Temporal | H3 cell + time bucket + known transponder freq | Tier 2 |
| `Ais` | Spatial+Temporal | H3 cell + time bucket + VHF marine freq range | Tier 2 |
| `Radar` | Spatial+Temporal | H3 cell + time bucket | Tier 2 |
| `Sdr` | Frequency+Temporal | Frequency bin + time bucket | Tier 1 (same emitter) |
| `Elint` | Frequency+Parameter | Frequency + pulse characteristics | Tier 2 |
| `Sigint` | Frequency | FCC/ITU allocated frequency match | Tier 1 (license lookup) |

### AVA.DS.2.2.6 Synthetic Data Generation

**Bearing Error Model**: Real DF systems exhibit Gaussian bearing errors with
standard deviation dependent on SNR and antenna array geometry.

| Parameter | Distribution | Range | Notes |
|-----------|-------------|-------|-------|
| `frequency_hz` | Log-uniform | 100 kHz – 6 GHz | Weighted toward HF (3-30 MHz) and VHF (30-300 MHz) |
| `bearing_deg` | Uniform | 0 – 360 | True bearing, clockwise from north |
| `bearing_error_deg` | Gaussian(0, sigma) | sigma = 1-15 deg | sigma inversely proportional to SNR |
| `snr_db` | Normal(15, 8) | -5 to 40 | Clipped; lower SNR = larger bearing error |
| `elevation_deg` | Normal(5, 10) | -5 to 45 | Ground-based emitters cluster near horizon |
| `sensor_lat/lon` | Fixed per sensor | Global | Place 3-8 synthetic sensors within a region |
| `bandwidth_hz` | Categorical | 200, 3000, 6000, 25000, 200000 | AM=6kHz, FM=200kHz, SSB=3kHz |

**Generation Strategy**: Parametric with correlated emitter tracks.

1. Define 5-20 synthetic emitters with fixed positions and frequencies
2. For each emitter, generate bearing observations from each sensor with
   `bearing_true + Normal(0, sigma(snr))` error model
3. Vary SNR over time to simulate propagation fading
4. Inject 5-10% anomalous bearings (multipath, interference) for robustness testing
5. Generate corresponding TDoA results for emitters observed by 3+ sensors

---

## AVA.DS.2.3 Signal Kind: Sdr

> Software-defined radio raw signal captures — IQ (in-phase/quadrature) sample
> recordings with associated metadata. The canonical metadata format is SigMF
> (Signal Metadata Format).

### AVA.DS.2.3.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| GNU Radio + SigMF | https://github.com/sigmf/SigMF | SigMF (JSON meta + binary IQ) | File-based | N/A | `core:frequency`, `core:sample_rate`, `core:datatype` | N/A (recordings) | LGPL-3.0 |
| SigMF Specification | https://sigmf.org | JSON Schema | N/A | N/A | Metadata schema definition | Versioned (v1.x) | CC-BY-4.0 |
| RTL-SDR (rtl_tcp) | https://www.rtl-sdr.com | Raw IQ (uint8 interleaved) | TCP socket | None | `center_freq`, `sample_rate`, `gain` | Real-time stream | GPL-2.0 |
| WebSDR Network | http://websdr.org | Audio stream + waterfall | HTTP/WebSocket | None (public) | `frequency_hz`, `mode`, `bandwidth` | Real-time | Varies by host |
| OpenWebRX Instances | https://www.openwebrx.de | JSON + Audio | WebSocket | Varies | `frequency_hz`, `waterfall_data`, `audio` | Real-time | AGPL-3.0 |
| IQ Engine (recordings DB) | https://github.com/IQEngine/IQEngine | SigMF | REST API | Optional | SigMF metadata fields | On-upload | MIT |
| GNU Radio ZMQ Sink | https://wiki.gnuradio.org/index.php/ZMQ_PUB_Sink | Raw IQ (complex float32) | ZMQ PUB/SUB | None (local) | Configured in flowgraph | Real-time | GPL-3.0 |

**Notes on SigMF**:
- SigMF is the canonical metadata standard for IQ recordings
- A SigMF recording consists of: `.sigmf-data` (binary IQ samples) + `.sigmf-meta` (JSON metadata)
- The `core:datatype` field specifies sample format (e.g., `cf32_le` = complex float32 little-endian, `cu8` = complex unsigned 8-bit)
- Extensions define additional fields (e.g., `signal` extension for modulation type)
- Monthly community calls, active development on GitHub

**Notes on RTL-SDR**:
- RTL2832U-based USB dongles provide 24-1766 MHz coverage at 8-bit IQ
- `rtl_tcp` streams raw IQ over TCP with a 12-byte DongleInfo header followed by interleaved uint8 I/Q pairs (128 = zero)
- Sample rates up to 2.56 MSPS (stable at 2.048 MSPS)
- Suitable for local capture; not a network data source

### AVA.DS.2.3.2 NATS Subject Taxonomy

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.sdr.gnuradio.sigmf` | SigMF JSON (metadata only) | GNU Radio capture metadata; IQ data in Object Store |
| `sensor.sdr.rtlsdr.iq` | Binary reference | RTL-SDR raw IQ; Object Store reference for sample data |
| `sensor.sdr.websdr.json` | JSON | WebSDR spectrum/waterfall snapshot |
| `sensor.sdr.openwebrx.json` | JSON | OpenWebRX receiver data |
| `sensor.sdr.synthetic.sigmf` | SigMF JSON | Synthetic IQ capture metadata |

**Normative**: IQ sample data MUST be stored in the NATS Object Store (`ava-iq-samples`
bucket). The NATS subject message MUST contain only the SigMF metadata JSON plus
an `object_store_key` field referencing the binary data. Raw IQ payloads MUST NOT
be published directly to subjects (they exceed NATS message size limits).

### AVA.DS.2.3.3 Payload Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SdrCapture",
  "description": "SDR IQ capture metadata following SigMF core + AVA extensions",
  "type": "object",
  "required": ["timestamp", "sensor_id", "sigmf_meta", "object_store_key"],
  "properties": {
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 UTC capture start time"
    },
    "sensor_id": {
      "type": "string",
      "description": "Unique identifier of the SDR receiver"
    },
    "object_store_key": {
      "type": "string",
      "description": "NATS Object Store key for the binary IQ data (bucket: ava-iq-samples)"
    },
    "sigmf_meta": {
      "type": "object",
      "description": "SigMF v1.x compliant metadata",
      "required": ["global", "captures", "annotations"],
      "properties": {
        "global": {
          "type": "object",
          "required": ["core:datatype", "core:sample_rate"],
          "properties": {
            "core:datatype": {
              "type": "string",
              "description": "Sample format (cf32_le, ci16_le, cu8, etc.)"
            },
            "core:sample_rate": {
              "type": "number",
              "description": "Sample rate in samples per second"
            },
            "core:version": {
              "type": "string",
              "description": "SigMF spec version (e.g., 1.0.0)"
            },
            "core:hw": {
              "type": "string",
              "description": "Hardware description (e.g., RTL-SDR Blog V4)"
            },
            "core:author": {
              "type": "string"
            }
          }
        },
        "captures": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["core:sample_start", "core:frequency"],
            "properties": {
              "core:sample_start": { "type": "integer" },
              "core:frequency": { "type": "number", "description": "Center frequency in Hz" },
              "core:datetime": { "type": "string", "format": "date-time" }
            }
          }
        },
        "annotations": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "core:sample_start": { "type": "integer" },
              "core:sample_count": { "type": "integer" },
              "core:freq_lower_edge": { "type": "number" },
              "core:freq_upper_edge": { "type": "number" },
              "core:label": { "type": "string" }
            }
          }
        }
      }
    },
    "duration_seconds": {
      "type": "number",
      "description": "Capture duration in seconds"
    },
    "sample_count": {
      "type": "integer",
      "description": "Total number of IQ sample pairs"
    }
  }
}
```

### AVA.DS.2.3.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|---------------------|---------|
| `captures[].core:frequency` | `RfEmitter` | Custom (freq+time) | `145.500MHz@2026-02-20T12:00Z` |
| `annotations[].core:label` | `RfEmitter` | Custom (label) | `DMR_repeater_VK3RMM` |
| Cross-correlated with RfBearing | `RfEmitter` | Custom (freq+geohash) | `14.100MHz@u4pru` |

### AVA.DS.2.3.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier |
|------------------|-----------|----------|------|
| `RfBearing` | Frequency+Temporal | Frequency bin + time bucket | Tier 1 |
| `Sigint` | Frequency | Allocated frequency match | Tier 1 (license lookup) |
| `Elint` | Frequency+Parameter | Center freq + detected pulse characteristics | Tier 2 |
| `Comint` | Frequency+Temporal | Intercepted comms freq + time window | Tier 2 |
| `AdsB` | Frequency | 1090 MHz captures → ADS-B decode | Tier 1 |
| `Ais` | Frequency | 161.975/162.025 MHz captures → AIS decode | Tier 1 |

### AVA.DS.2.3.6 Synthetic Data Generation

**IQ Sample Generation**: Synthetic IQ captures allow testing the ingest
pipeline without requiring physical SDR hardware.

| Parameter | Distribution | Range | Notes |
|-----------|-------------|-------|-------|
| `core:datatype` | Categorical | `cf32_le`, `ci16_le`, `cu8` | cf32_le most common for GNU Radio |
| `core:sample_rate` | Categorical | 48000, 240000, 1024000, 2048000 | RTL-SDR max stable = 2.048 MSPS |
| `core:frequency` | Log-uniform | 100 kHz – 1.766 GHz | Weighted toward VHF/UHF amateur, FM broadcast, ADS-B |
| `duration_seconds` | Uniform | 1 – 300 | Short captures for testing |
| `snr_db` | Normal(20, 10) | -10 to 50 | Signal-to-noise of injected signals |
| Noise floor | AWGN | N(0, sigma) | sigma from thermal noise model |
| Injected signal count | Poisson(3) | 0 – 10 | Multiple signals per capture |

**Generation Strategy**: Parametric + replay.

1. Generate AWGN (Additive White Gaussian Noise) base samples at the target sample rate
2. Inject 1-5 synthetic signals: tones (CW), AM/FM modulated carriers, digital bursts
3. Apply frequency offset, phase noise, and IQ imbalance for realism
4. Package as SigMF: binary `.sigmf-data` + JSON `.sigmf-meta`
5. Upload binary to NATS Object Store, publish metadata to `sensor.sdr.synthetic.sigmf`

**Pre-recorded Datasets** (format validation):
- IQEngine sample recordings (publicly available SigMF files)
- GNU Radio tutorial recordings
- RTL-SDR blog sample captures

---

## AVA.DS.2.4 Signal Kind: Sigint

> Signals intelligence — frequency allocation databases, license registries,
> and spectrum monitoring data. In the AVA context, SIGINT refers to the
> **reference data** layer: knowing who is allocated what frequency, where
> transmitters are licensed, and what the spectrum plan looks like. Operational
> intercept data is classified and handled under Comint/Elint.

### AVA.DS.2.4.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| FCC Universal Licensing System (ULS) | https://www.fcc.gov/wireless/data/public-access-files-database-downloads | Pipe-delimited CSV (`.dat`) | Bulk download (ZIP) | None | `callsign`, `frequency_mhz`, `lat`, `lon`, `licensee_name`, `service_code` | Weekly | Public domain (US Gov) |
| FCC ULS License Search | https://wireless2.fcc.gov/UlsApp/UlsSearch/searchLicense.jsp | HTML / scrape | HTTP query | None | `callsign`, `frequency`, `licensee` | Real-time | Public domain |
| ITU BRIFIC | https://www.itu.int/epublications/publication/brific-api-documentation | JSON, CSV | REST API | API key | `frequency_mhz`, `administration`, `station_name`, `service` | Monthly | ITU terms |
| ITU Radio Regulations Freq Allocations | https://www.itu.int/pub/R-REG-RR | PDF / structured | N/A | N/A | `frequency_band`, `allocation`, `region` | Periodic (WRC) | ITU terms |
| NTIA Frequency Allocation Chart (US) | https://www.ntia.gov/page/us-frequency-allocation-chart | PDF + CSV | Download | None | `frequency_band`, `allocation`, `service` | Static (updated per WRC) | Public domain (US Gov) |
| RadioReference.com | https://www.radioreference.com | HTML | Limited API | Subscription | `frequency`, `agency`, `location`, `talkgroup` | Community-maintained | Proprietary |
| Synthetic SIGINT Generator | Local | JSON | N/A | N/A | `frequency_hz`, `callsign`, `licensee`, `location` | Configurable | N/A |

**Notes on FCC ULS**:
- Bulk download files are ~2-5 GB uncompressed
- Pipe-delimited `.dat` files: `EN.dat` (entity), `HD.dat` (header), `FR.dat` (frequency), `LO.dat` (location)
- `FR.dat` contains frequency assignments: callsign, frequency upper/lower bounds, emission designator
- Weekly differential updates available; full database snapshots released periodically
- Several open-source parsers on GitHub: `gdubin/uls`, `QueuingKoala/fcc-db`, `mmmorris1975/uls-loader`

**Notes on ITU BRIFIC**:
- REST API with JSON/CSV output
- Requires registration and API key
- Covers international frequency registrations (space and terrestrial services)
- Master International Frequency Register (MIFR) is the canonical global source

### AVA.DS.2.4.2 NATS Subject Taxonomy

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.sigint.fcc.json` | JSON | FCC ULS license/frequency record |
| `sensor.sigint.fcc.batch` | JSON array | Batch import of FCC ULS records |
| `sensor.sigint.itu.json` | JSON | ITU BRIFIC frequency registration |
| `sensor.sigint.ntia.json` | JSON | NTIA frequency allocation band |
| `sensor.sigint.synthetic.json` | JSON | Generated SIGINT reference record |

**Normative**: SIGINT sources are `DataType::Reference` (not event streams).
They SHOULD be loaded into a NATS KV bucket (`ava-ref-sigint`) for O(1) lookup
by frequency during fusion. The subject stream is used for initial load and
incremental updates only.

### AVA.DS.2.4.3 Payload Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SigintFrequencyRecord",
  "type": "object",
  "required": ["source", "frequency_lower_hz", "frequency_upper_hz"],
  "properties": {
    "source": {
      "type": "string",
      "enum": ["fcc_uls", "itu_brific", "ntia", "synthetic"],
      "description": "Data source identifier"
    },
    "callsign": {
      "type": ["string", "null"],
      "description": "Assigned callsign (FCC/ITU)"
    },
    "frequency_lower_hz": {
      "type": "number",
      "description": "Lower bound of assigned frequency in Hz"
    },
    "frequency_upper_hz": {
      "type": "number",
      "description": "Upper bound of assigned frequency in Hz"
    },
    "center_frequency_hz": {
      "type": ["number", "null"],
      "description": "Center frequency (computed if not provided)"
    },
    "emission_designator": {
      "type": ["string", "null"],
      "description": "ITU emission designator (e.g., 20K0F3E for NFM voice)"
    },
    "service_code": {
      "type": ["string", "null"],
      "description": "Radio service code (e.g., IG=Industrial, YX=Amateur)"
    },
    "licensee_name": {
      "type": ["string", "null"],
      "description": "Name of the license holder"
    },
    "station_lat": {
      "type": ["number", "null"],
      "description": "Licensed station latitude (WGS84)"
    },
    "station_lon": {
      "type": ["number", "null"],
      "description": "Licensed station longitude (WGS84)"
    },
    "power_watts": {
      "type": ["number", "null"],
      "description": "Authorized ERP in watts"
    },
    "license_status": {
      "type": ["string", "null"],
      "enum": ["active", "expired", "cancelled", "pending", null],
      "description": "Current license status"
    },
    "grant_date": {
      "type": ["string", "null"],
      "format": "date",
      "description": "License grant date"
    },
    "expiry_date": {
      "type": ["string", "null"],
      "format": "date",
      "description": "License expiration date"
    },
    "administration": {
      "type": ["string", "null"],
      "description": "ITU administration code (e.g., USA, G=UK, F=France)"
    }
  }
}
```

### AVA.DS.2.4.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|---------------------|---------|
| `callsign` | `RfEmitter` | Custom (callsign) | `W3ABC` |
| `station_lat/lon` | `Facility` | Custom (geo+name) | `FCC_site@38.89,-77.03` |
| `licensee_name` | `Organization` | Custom (name) | `Acme Broadcasting Inc` |
| `frequency_lower_hz` + `station_lat/lon` | `RfEmitter` | Custom (freq+geohash) | `462.5625MHz@dqcjr` |

### AVA.DS.2.4.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier |
|------------------|-----------|----------|------|
| `RfBearing` | Frequency | Detected freq matches licensed freq | Tier 1 |
| `Sdr` | Frequency | Captured freq matches licensed freq | Tier 1 |
| `Elint` | Frequency+Location | Licensed radar freq + station location | Tier 2 |
| `AdsB` | Frequency | 1090 MHz transponder allocation | Tier 1 (reference) |
| `Ais` | Frequency | VHF marine allocation (156-162 MHz) | Tier 1 (reference) |
| `Osint` | Entity | Licensee name matches OSINT entity | Tier 3 |

### AVA.DS.2.4.6 Synthetic Data Generation

**Strategy**: Generate realistic FCC ULS-style records with plausible callsigns,
frequencies, and locations.

| Parameter | Distribution | Range | Notes |
|-----------|-------------|-------|-------|
| `callsign` | Pattern-based | `[WKNWA][0-9][A-Z]{1,3}` | US amateur: W, K, N, WA-WZ prefixes |
| `frequency_lower_hz` | Band-weighted | 1.8 MHz – 5.8 GHz | Weighted toward VHF/UHF land-mobile |
| `bandwidth_hz` | Service-dependent | 200 – 6,000,000 | NFM=12.5kHz, FM broadcast=200kHz |
| `station_lat` | Uniform | 25 – 50 (CONUS) | Continental US coverage |
| `station_lon` | Uniform | -125 – -65 (CONUS) | Continental US coverage |
| `power_watts` | Log-normal | 1 – 50,000 | Median ~100W |
| `service_code` | Categorical | IG, YX, PW, MG, etc. | Weighted toward land-mobile |
| `license_status` | Categorical | active (90%), expired (8%), cancelled (2%) | Realistic distribution |

**Generation Strategy**: Reference data seeding.

1. Generate 10,000-50,000 license records spanning HF through UHF
2. Cluster licenses around major metro areas (population-weighted lat/lon)
3. Assign realistic service codes and emission designators
4. Load into `ava-ref-sigint` KV bucket keyed by `{callsign}`
5. Publish batch to `sensor.sigint.synthetic.json` for initial load

---

## AVA.DS.2.5 Signal Kind: Elint

> Electronic intelligence — characterization of non-communications electronic
> emissions, primarily radar and navigation systems. ELINT focuses on **emitter
> parameters**: frequency, pulse repetition interval (PRI), pulse width (PW),
> scan pattern, and antenna characteristics.

### AVA.DS.2.5.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| NAWCWD EW Handbook | https://apps.dtic.mil/sti/pdfs/ADA617071.pdf | PDF | Download | None | Radar parameter tables, EW fundamentals | Static | US Gov (public) |
| RadDet Dataset | https://arxiv.org/html/2501.10407v1 | HDF5 + annotations | Download | None | IQ samples, radar signal annotations, SNR | Static (research) | Academic |
| Microwaves101 EW Reference | https://www.microwaves101.com/encyclopedias/ew-and-radar-handbook | HTML | Scrape | None | Radar types, frequency bands, parameters | Static | Educational |
| EWIRDB (restricted) | https://www.srcinc.com/services/intel-analysis-and-production/ewirdb.html | Classified DB | N/A | Classified | Full emitter parameter library | N/A | Classified (US DoD) |
| Synthetic Emitter Generator | Local | JSON | N/A | N/A | `frequency_hz`, `pri_us`, `pw_us`, `scan_type`, `scan_rate_rpm` | Configurable | N/A |

**Notes on ELINT Data Availability**:
- **EWIRDB** (Electronic Warfare Integrated Reprogrammable Database) is the authoritative
  emitter parameter database — maintained by SRC Inc. for the US DoD. It is **classified**
  and unavailable for open-source use.
- The **NAWCWD EW Handbook** (Naval Air Warfare Center) provides unclassified radar
  parameter ranges by type (search, track, fire control, navigation).
- **RadDet** is a recent academic dataset (2025) with 40,000 annotated IQ frames across
  a 500 MHz band — useful for format validation but not operational parameters.
- Realistic ELINT data is **almost entirely synthetic** for our pipeline.

### AVA.DS.2.5.2 NATS Subject Taxonomy

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.elint.synthetic.json` | JSON | Synthetic emitter parameter record |
| `sensor.elint.synthetic.batch` | JSON array | Batch import of emitter library |
| `sensor.elint.raddet.json` | JSON | RadDet dataset radar detection |
| `sensor.elint.reference.json` | JSON | Reference emitter from handbook data |

**Normative**: ELINT emitter parameter records are `DataType::Reference`. The
emitter library SHOULD be loaded into KV bucket `ava-ref-elint` keyed by
`{emitter_type}.{frequency_band}` for lookup during fusion.

### AVA.DS.2.5.3 Payload Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ElintEmitterRecord",
  "type": "object",
  "required": ["emitter_id", "frequency_hz", "emitter_type"],
  "properties": {
    "emitter_id": {
      "type": "string",
      "description": "Unique emitter identifier (synthetic or database key)"
    },
    "emitter_type": {
      "type": "string",
      "enum": ["search_radar", "track_radar", "fire_control", "navigation", "weather", "multifunction", "unknown"],
      "description": "Emitter functional classification"
    },
    "frequency_hz": {
      "type": "number",
      "description": "Center operating frequency in Hz"
    },
    "frequency_band": {
      "type": "string",
      "enum": ["HF", "VHF", "UHF", "L", "S", "C", "X", "Ku", "K", "Ka", "V", "W"],
      "description": "IEEE radar frequency band designation"
    },
    "pri_us": {
      "type": ["number", "null"],
      "description": "Pulse Repetition Interval in microseconds"
    },
    "prf_hz": {
      "type": ["number", "null"],
      "description": "Pulse Repetition Frequency in Hz (= 1/PRI)"
    },
    "pulse_width_us": {
      "type": ["number", "null"],
      "description": "Pulse width in microseconds"
    },
    "scan_type": {
      "type": ["string", "null"],
      "enum": ["circular", "sector", "conical", "electronic", "track_while_scan", "fixed", null],
      "description": "Antenna scan pattern type"
    },
    "scan_rate_rpm": {
      "type": ["number", "null"],
      "description": "Antenna rotation rate in RPM (for mechanical scanners)"
    },
    "peak_power_kw": {
      "type": ["number", "null"],
      "description": "Peak transmit power in kilowatts"
    },
    "antenna_gain_dbi": {
      "type": ["number", "null"],
      "description": "Antenna gain in dBi"
    },
    "modulation_on_pulse": {
      "type": ["string", "null"],
      "enum": ["none", "linear_fm", "barker", "polyphase", "frequency_hopping", null],
      "description": "Intra-pulse modulation type"
    },
    "platform_type": {
      "type": ["string", "null"],
      "enum": ["ground_fixed", "ground_mobile", "naval", "airborne", "space", null],
      "description": "Platform hosting the emitter"
    },
    "observed_lat": {
      "type": ["number", "null"],
      "description": "Last observed latitude (if geolocated)"
    },
    "observed_lon": {
      "type": ["number", "null"],
      "description": "Last observed longitude (if geolocated)"
    },
    "first_seen": {
      "type": ["string", "null"],
      "format": "date-time",
      "description": "First observation timestamp"
    },
    "last_seen": {
      "type": ["string", "null"],
      "format": "date-time",
      "description": "Most recent observation timestamp"
    }
  }
}
```

### AVA.DS.2.5.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|---------------------|---------|
| `emitter_id` | `RfEmitter` | Custom (emitter_id) | `SR-47_Xband_search` |
| `observed_lat/lon` | `Facility` | Custom (geo+name) | `radar_site@51.47,-0.46` |
| `platform_type=naval` + location | `Vessel` | Mmsi (if correlated) | `211234567` |
| `platform_type=airborne` + location | `Aircraft` | IcaoHex (if correlated) | `a12345` |

### AVA.DS.2.5.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier |
|------------------|-----------|----------|------|
| `RfBearing` | Frequency+Location | DF bearing intersects emitter location | Tier 2 |
| `Sdr` | Frequency+Parameter | IQ capture at radar frequency with matching PRI | Tier 2 |
| `Sigint` | Frequency+Location | Licensed radar frequency + station location | Tier 1 |
| `Radar` | Parameter | PRF/PW matching known radar type → track correlation | Tier 2 |
| `Satellite` | Spatial+Temporal | SAR imagery confirms ground radar installation | Tier 3 |
| `Comint` | Temporal+Location | Comms activity collocated with radar activation | Tier 3 |

### AVA.DS.2.5.6 Synthetic Data Generation

**Emitter Parameter Model**: Based on unclassified radar parameter ranges from
the NAWCWD EW Handbook.

| Radar Type | Frequency Band | PRI Range (us) | PW Range (us) | Peak Power (kW) | Scan Type |
|-----------|---------------|----------------|---------------|-----------------|-----------|
| Search (long range) | L, S | 1000-4000 | 1-50 | 100-5000 | Circular (6-15 RPM) |
| Search (medium range) | S, C | 500-2000 | 0.5-10 | 10-500 | Circular (12-30 RPM) |
| Track / Fire Control | X, Ku | 100-500 | 0.1-1 | 1-100 | Conical / Electronic |
| Navigation (marine) | X | 500-3000 | 0.05-1 | 1-50 | Circular (20-30 RPM) |
| Weather | S, C | 750-3000 | 0.5-5 | 100-1000 | Circular (3-6 RPM) |
| Multifunction (AESA) | S, X | 10-2000 | 0.1-100 | 10-1000 | Electronic (agile) |

| Parameter | Distribution | Range | Notes |
|-----------|-------------|-------|-------|
| `frequency_hz` | Band-specific uniform | Per radar type table | Within IEEE band limits |
| `pri_us` | Log-uniform | Per radar type table | Some exhibit PRI stagger/jitter |
| `pulse_width_us` | Log-uniform | Per radar type table | Correlated with range capability |
| `scan_rate_rpm` | Normal(mu, sigma) | Per scan type | Mechanical scanners only |
| `peak_power_kw` | Log-normal | Per radar type table | Higher power = longer range |
| `observed_lat/lon` | Clustered | Global military/port areas | Near coastlines, airports, borders |
| PRI jitter | Uniform(0.95*PRI, 1.05*PRI) | +/-5% of nominal | Simulates real PRI variation |

**Generation Strategy**: Parametric emitter library + time-series observations.

1. Generate 100-500 emitter definitions from the parameter table above
2. Assign each a fixed location (weighted toward coastlines, airports, military areas)
3. For event-mode testing, generate time-series "intercept" observations:
   - Each observation = timestamp + emitter_id + measured parameters (with noise)
   - Parameter measurement noise: frequency +/- 0.1%, PRI +/- 2%, PW +/- 5%
4. 10% of emitters should be "agile" (frequency hopping, PRI stagger) for robustness testing
5. Load emitter library into `ava-ref-elint` KV, publish observations to `sensor.elint.synthetic.json`

---

## AVA.DS.2.6 Signal Kind: Comint

> Communications intelligence — metadata from intercepted communications.
> **AVA does NOT intercept or store communication content** — only metadata
> (frequency, time, duration, bearing, protocol type). This is critical for
> legal compliance and ethical operation.

### AVA.DS.2.6.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| SALUTE Report Schema | US Army FM 2-22.3, App H | Structured text | N/A | Public (doctrine) | `size`, `activity`, `location`, `unit`, `time`, `equipment` | N/A | US Gov (public) |
| CTF/Research Datasets | Various academic | PCAP, JSON | Download | Varies | `frequency`, `protocol`, `timestamp`, `duration` | Static | Academic |
| Synthetic COMINT Generator | Local | JSON | N/A | N/A | `frequency_hz`, `bearing_deg`, `duration_s`, `protocol`, `report_type` | Configurable | N/A |

**Notes on COMINT Data Availability**:
- **All operational COMINT data is classified.** There are zero publicly available
  real-world COMINT feeds.
- The SALUTE report format (Size, Activity, Location, Unit, Time, Equipment) from
  US Army FM 2-22.3 provides the canonical schema structure for intelligence reports.
- CTF (Capture The Flag) competitions occasionally produce RF intercept datasets,
  but these are narrowly scoped and not systematically archived.
- AVA's COMINT integration is **100% synthetic** for pipeline validation.

**Legal Note**: Intercepting communications content violates federal law in most
jurisdictions (18 USC 2511 in the US, RIPA in the UK). AVA's COMINT schema
deliberately captures only **metadata** (time, freq, duration, protocol, bearing)
— never content. The `content` field MUST NOT exist in the schema.

### AVA.DS.2.6.2 NATS Subject Taxonomy

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.comint.synthetic.json` | JSON | Synthetic COMINT intercept metadata |
| `sensor.comint.synthetic.salute` | JSON (SALUTE) | Synthetic SALUTE-format report |
| `sensor.comint.synthetic.batch` | JSON array | Batch import of intercept metadata |

**Normative**: COMINT subjects MUST NOT carry communication content. Payloads
are metadata-only: frequency, time, duration, protocol identification, bearing
(if available), and activity classification.

### AVA.DS.2.6.3 Payload Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ComintInterceptMetadata",
  "type": "object",
  "required": ["timestamp", "report_id", "frequency_hz", "report_type"],
  "properties": {
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 UTC timestamp of intercept"
    },
    "report_id": {
      "type": "string",
      "description": "Unique report identifier"
    },
    "report_type": {
      "type": "string",
      "enum": ["intercept_metadata", "salute", "spot_report"],
      "description": "Report format type"
    },
    "frequency_hz": {
      "type": "number",
      "description": "Intercepted frequency in Hz"
    },
    "bandwidth_hz": {
      "type": ["number", "null"],
      "description": "Observed signal bandwidth in Hz"
    },
    "duration_seconds": {
      "type": ["number", "null"],
      "description": "Duration of observed transmission in seconds"
    },
    "protocol": {
      "type": ["string", "null"],
      "enum": ["voice_analog", "voice_digital", "data_burst", "dmr", "p25", "tetra", "dstar", "morse_cw", "unknown", null],
      "description": "Identified communication protocol (metadata only)"
    },
    "modulation": {
      "type": ["string", "null"],
      "enum": ["AM", "FM", "SSB", "FSK", "PSK", "OFDM", "spread_spectrum", "unknown", null],
      "description": "Detected modulation type"
    },
    "bearing_deg": {
      "type": ["number", "null"],
      "minimum": 0,
      "maximum": 360,
      "description": "Bearing to source from intercept station (if DF available)"
    },
    "sensor_id": {
      "type": ["string", "null"],
      "description": "Intercept station identifier"
    },
    "sensor_lat": {
      "type": ["number", "null"],
      "description": "Intercept station latitude"
    },
    "sensor_lon": {
      "type": ["number", "null"],
      "description": "Intercept station longitude"
    },
    "activity_classification": {
      "type": ["string", "null"],
      "enum": ["routine", "tactical", "emergency", "encrypted", "jamming", "unknown", null],
      "description": "Activity type classification"
    },
    "confidence": {
      "type": ["number", "null"],
      "minimum": 0,
      "maximum": 1,
      "description": "Classification confidence (0-1)"
    },
    "salute": {
      "type": ["object", "null"],
      "description": "SALUTE report fields (if report_type=salute)",
      "properties": {
        "size": { "type": "string", "description": "Number/strength of observed communications" },
        "activity": { "type": "string", "description": "Type of communication activity" },
        "location": { "type": "string", "description": "Grid reference or description" },
        "unit": { "type": ["string", "null"], "description": "Identified unit/organization" },
        "time": { "type": "string", "description": "DTG (Date-Time Group) of observation" },
        "equipment": { "type": ["string", "null"], "description": "Communication equipment observed" }
      }
    }
  }
}
```

### AVA.DS.2.6.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|---------------------|---------|
| `frequency_hz` + `sensor_lat/lon` + `bearing_deg` | `RfEmitter` | Custom (freq+geohash) | `155.475MHz@u4pru` |
| `salute.unit` | `Organization` | Custom (unit name) | `3rd_Btn_Comms` |
| Cross-correlated with RfBearing TDoA | `RfEmitter` | Custom (H3 cell) | `emitter@8a2a1072b59ffff` |
| Cross-correlated with SIGINT license | `RfEmitter` | Custom (callsign) | `W3ABC` |

### AVA.DS.2.6.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier |
|------------------|-----------|----------|------|
| `RfBearing` | Frequency+Temporal | Same freq + overlapping time window | Tier 1 |
| `Sdr` | Frequency+Temporal | IQ capture at intercept frequency | Tier 1 |
| `Sigint` | Frequency | Licensed frequency match → identify transmitter | Tier 1 |
| `Elint` | Temporal+Location | Radar activity collocated with comms | Tier 3 |
| `Humint` | Temporal+Location | HUMINT report matching COMINT activity area | Tier 3 |
| `Osint` | Entity+Temporal | OSINT event matching observed comms activity | Tier 3 |

### AVA.DS.2.6.6 Synthetic Data Generation

**Strategy**: Generate realistic intercept metadata with correlated temporal patterns
simulating communication networks.

| Parameter | Distribution | Range | Notes |
|-----------|-------------|-------|-------|
| `frequency_hz` | Band-weighted | 30 MHz – 900 MHz | VHF/UHF land-mobile heavy |
| `duration_seconds` | Log-normal(30, 2) | 2 – 600 | Median 30s, long tail for data bursts |
| `protocol` | Categorical | voice_analog (30%), dmr (25%), p25 (20%), voice_digital (10%), data_burst (10%), morse_cw (5%) | Realistic protocol mix |
| `modulation` | Protocol-dependent | FM for analog, FSK for DMR/P25, AM for SSB | Coupled to protocol |
| `bearing_deg` | Uniform | 0 – 360 | If DF available |
| `activity_classification` | Categorical | routine (60%), tactical (20%), encrypted (10%), emergency (5%), unknown (5%) | Weighted toward routine |
| `confidence` | Beta(8, 2) | 0.5 – 1.0 | Skewed toward high confidence |
| Inter-transmission gap | Exponential(lambda=0.01) | 10s – 600s | Poisson process between transmissions |

**Generation Strategy**: Network-based temporal correlation.

1. Define 5-15 synthetic "communication networks" (e.g., tactical net, logistics net, command net)
2. Each network has 3-10 participants at fixed locations with assigned frequencies
3. Generate transmission events following a Poisson process per network
4. Transmissions within a network are temporally correlated (call-response patterns):
   - Station A transmits → 2-10s gap → Station B responds → ...
5. Inject 10% anomalous activity (encrypted bursts, jamming, frequency changes)
6. Generate matching SALUTE reports for 20% of significant intercepts
7. Publish to `sensor.comint.synthetic.json` with temporal ordering preserved

**SALUTE Report Generation**:
```
SIZE:     "3 active stations on net"
ACTIVITY: "Routine voice traffic, logistics coordination"
LOCATION: "GL 38.897,-77.036 (National Mall area)"
UNIT:     "Unidentified, callsign prefix 'EAGLE'"
TIME:     "202602201430Z-202602201445Z"
EQUIPMENT: "Suspected DMR Tier III trunked"
```

---

## AVA.DS.2.7 Object Store Configuration

IQ sample data requires dedicated NATS Object Store configuration:

| Bucket | Max Object Size | Max Bucket Size | TTL | Purpose |
|--------|----------------|-----------------|-----|---------|
| `ava-iq-samples` | 100 MB | 10 GB | 24h | SDR IQ binary data |
| `ava-iq-samples-archive` | 100 MB | 100 GB | 30d | Archived IQ captures |

**Normative**: IQ binary data MUST be stored in Object Store, never inline in
subject messages. Object keys MUST follow: `{sensor_id}/{timestamp_epoch}/{capture_id}.sigmf-data`

---

## AVA.DS.2.8 JetStream Configuration (RF Domain)

| Stream | Subjects | Retention | Max Age | Storage | Notes |
|--------|----------|-----------|---------|---------|-------|
| `SENSOR_RF` | `sensor.rfbearing.>`, `sensor.sdr.>`, `sensor.sigint.>`, `sensor.elint.>`, `sensor.comint.>` | Limits | 24h | File | All RF sensor data |

**Consumer Groups**:

| Consumer | Stream | Filter | Deliver | Purpose |
|----------|--------|--------|---------|---------|
| `rf-bearing-ingestor` | `SENSOR_RF` | `sensor.rfbearing.>` | Push | DF bearing processing |
| `sdr-ingestor` | `SENSOR_RF` | `sensor.sdr.>` | Push | IQ metadata processing |
| `sigint-loader` | `SENSOR_RF` | `sensor.sigint.>` | Push | Reference data loading |
| `elint-correlator` | `SENSOR_RF` | `sensor.elint.>` | Push | Emitter correlation |
| `comint-processor` | `SENSOR_RF` | `sensor.comint.>` | Push | Intercept metadata processing |

---

## AVA.DS.2.9 KV Buckets (RF Domain Reference Data)

| Bucket | Key Pattern | Value | TTL | Purpose |
|--------|------------|-------|-----|---------|
| `ava-ref-sigint` | `{callsign}` | JSON SigintFrequencyRecord | 7d | FCC/ITU license lookup |
| `ava-ref-sigint` | `freq.{band}.{center_mhz}` | JSON SigintFrequencyRecord | 7d | Frequency-based lookup |
| `ava-ref-elint` | `{emitter_type}.{frequency_band}` | JSON ElintEmitterRecord | 30d | Emitter parameter library |
| `ava-ref-elint` | `id.{emitter_id}` | JSON ElintEmitterRecord | 30d | Emitter ID lookup |

---

*End of Section AVA.DS.2*


---

# AVA.DS.3: Cyber/Network Domain Data Sources

```
Section:       AVA.DS.3 — Cyber/Network Domain Data Sources
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          I — Data Source Catalog
SignalKinds:   Http, Dns, Cyber
EntityClasses: NetworkHost, Domain, Campaign, Organization
Prerequisites: AVA.DS.6 (NATS Subject Taxonomy)
```

> This section catalogs the data sources, payload schemas, entity mappings, and
> cross-correlation targets for the three Cyber/Network domain signal kinds:
> **Http** (network flow metadata), **Dns** (passive and active DNS records), and
> **Cyber** (threat intelligence indicators in STIX 2.1 and proprietary formats).
> The Cyber signal kind is a key differentiator for the ava-fusion pipeline,
> providing structured threat context via STIX 2.1 bundles that enrich kinetic
> and RF observations with adversary attribution.

---

## Table of Contents

1. [Overview](#ava-ds-31-overview)
2. [Signal Kind: Http](#ava-ds-32-signal-kind-http)
3. [Signal Kind: Dns](#ava-ds-33-signal-kind-dns)
4. [Signal Kind: Cyber](#ava-ds-34-signal-kind-cyber)

---

## AVA.DS.3.1 Overview

The Cyber/Network domain covers three complementary signal kinds that together
provide deep visibility into network infrastructure and adversary operations:

| SignalKind | DataType  | Primary EntityClass | Purpose |
|------------|-----------|--------------------:|---------|
| `Http`     | Event     | NetworkHost         | Network flow metadata — HTTP/HTTPS request/response records from IDS sensors, PCAP extraction, and labeled intrusion detection datasets |
| `Dns`      | Event + Reference | Domain      | DNS resolution records — passive DNS archives, active resolver logs, and domain reputation lists |
| `Cyber`    | Reference + Event | Campaign    | Cyber threat intelligence — STIX 2.1 indicators, IOCs, vulnerability catalogs, and threat feeds |

**Key integration principle**: Cyber signals provide the *attribution context*
that transforms raw network observations (Http, Dns) into actionable intelligence.
An IP address in an Http flow becomes meaningful when correlated with a STIX
Indicator; a DNS query becomes suspicious when the domain appears in a threat feed.

### EntityClass Mapping Summary

| EntityClass   | Primary Namespace | Observable By | Identifier Example |
|---------------|-------------------|---------------|--------------------|
| NetworkHost   | IpAddress         | Http, Dns, Cyber | `192.168.1.100` |
| Domain        | DomainName        | Dns, Cyber, Http | `evil.example.com` |
| Campaign      | STIX ID           | Cyber         | `campaign--8e2e2d2b-...` |
| Organization  | Name / LEI        | Cyber, Osint  | `APT29` |

---

## AVA.DS.3.2 Signal Kind: Http

### AVA.DS.3.2.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| **Zeek http.log** | https://docs.zeek.org/en/master/logs/http.html | JSON (line-delimited) | Local file / Kafka | None (sensor) | `id.orig_h`, `id.resp_h`, `method`, `host`, `uri`, `status_code`, `user_agent` | Real-time | BSD |
| **tshark PCAP export** | https://www.wireshark.org/docs/man-pages/tshark.html | JSON (`-T json`) | CLI | None (local) | `ip.src`, `ip.dst`, `tcp.dstport`, `http.request.uri`, `http.host` | Batch | GPL-2.0 |
| **CICIDS2017** | https://www.unb.ca/cic/datasets/ids-2017.html | CSV (79 features) | Download | None | `Flow Duration`, `Src IP`, `Dst IP`, `Src Port`, `Dst Port`, `Protocol`, `Label` | Static | Research |
| **CSE-CIC-IDS2018** | https://www.unb.ca/cic/datasets/ids-2018.html | CSV + PCAP | AWS S3 | None | Same as CICIDS2017 + additional features | Static | Research |
| **CIC-DDoS2019** | https://www.unb.ca/cic/datasets/ddos-2019.html | CSV | Download | None | Flow features + `Label` (DDoS type) | Static | Research |

### AVA.DS.3.2.2 NATS Subject Taxonomy

```
sensor.http.zeek.json        # Zeek http.log JSON records
sensor.http.zeek.raw         # Zeek http.log TSV (original format)
sensor.http.pcap.json        # tshark -T json PCAP metadata
sensor.http.cicids.csv       # CICIDS2017/2018 labeled flows
sensor.http.ddos.csv         # CIC-DDoS2019 labeled flows
sensor.http.synthetic.json   # Generated test HTTP flows
```

**Normative subjects** (MUST be implemented):

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.http.zeek.json` | JSON | Zeek http.log JSON — primary production source |
| `sensor.http.pcap.json` | JSON | Parsed PCAP HTTP metadata via tshark |
| `sensor.http.cicids.csv` | CSV | Labeled IDS dataset flows for ML training |
| `sensor.http.synthetic.json` | JSON | Synthetic HTTP flow generator output |

### AVA.DS.3.2.3 Payload Schema

**Canonical: Zeek http.log JSON**

```json
{
  "ts": 1708432456.789012,
  "uid": "CYkN4p3jMHa7ZeMPbi",
  "id.orig_h": "192.168.1.100",
  "id.orig_p": 46378,
  "id.resp_h": "93.184.216.34",
  "id.resp_p": 443,
  "trans_depth": 1,
  "method": "GET",
  "host": "example.com",
  "uri": "/api/v1/data",
  "version": "1.1",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "request_body_len": 0,
  "response_body_len": 1256,
  "status_code": 200,
  "status_msg": "OK",
  "tags": [],
  "resp_fuids": ["FmHxM41UOhQoFKNR3h"],
  "resp_mime_types": ["application/json"]
}
```

**BaseSignal mapping** (Rust struct: `ava-fusion/src/signal.rs`):

```rust
BaseSignal {
    signal_kind: SignalKind::Http,
    timestamp: ts,                    // Zeek ts field (epoch float)
    source_id: "zeek",
    entity_ids: vec![
        EntityId { class: NetworkHost, namespace: IpAddress, value: id.orig_h },
        EntityId { class: NetworkHost, namespace: IpAddress, value: id.resp_h },
        EntityId { class: Domain,      namespace: DomainName, value: host },
    ],
    payload: serde_json::Value,       // Full Zeek record
    confidence: 0.95,                 // High — direct observation
}
```

### AVA.DS.3.2.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|-------------|---------------------|---------|
| `id.orig_h` | NetworkHost | IpAddress | `192.168.1.100` |
| `id.resp_h` | NetworkHost | IpAddress | `93.184.216.34` |
| `host` | Domain | DomainName | `example.com` |
| `user_agent` | — | — | Used for fingerprinting, not entity ID |

### AVA.DS.3.2.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier | Description |
|------------------|-----------|----------|------|-------------|
| Dns | Temporal + Key | Domain name + time window | Tier 1 | DNS resolution preceding HTTP request |
| Cyber | Key-based | IP or Domain vs. STIX Indicator pattern | Tier 1 | IOC match on dest IP or host |
| Osint | Key-based | Domain or IP in news/reports | Tier 2 | OSINT enrichment of suspicious hosts |
| AdsB / Ais | Temporal | Timestamp overlap at facility | Tier 3 | Kinetic asset at network origin |
| RfBearing | Spatial + Temporal | Geolocation of IP + bearing | Tier 3 | RF emission co-located with network host |

### AVA.DS.3.2.6 Synthetic Data Generation

| Parameter | Range / Strategy |
|-----------|------------------|
| `id.orig_h` | RFC 1918 private ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` |
| `id.resp_h` | Mix of public IPs (randomized) + known-bad IPs from threat feeds |
| `method` | Weighted: GET (70%), POST (20%), PUT (5%), DELETE (3%), HEAD (2%) |
| `host` | Sampled from Tranco top-1M + synthetic suspicious domains |
| `status_code` | Weighted: 200 (60%), 301/302 (15%), 404 (10%), 403 (5%), 500 (5%), other (5%) |
| `user_agent` | Sampled from real UA databases + known malware UA strings |
| `Label` | For IDS datasets: BENIGN (80%), DDoS (8%), PortScan (5%), BruteForce (4%), Other (3%) |
| **Generation strategy** | Parametric: Markov chain session modeling with configurable attack injection rate |

---

## AVA.DS.3.3 Signal Kind: Dns

### AVA.DS.3.3.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| **Zeek dns.log** | https://docs.zeek.org/en/master/logs/dns.html | JSON (line-delimited) | Local file / Kafka | None (sensor) | `query`, `qtype_name`, `answers`, `rcode_name`, `id.orig_h` | Real-time | BSD |
| **Farsight DNSDB** | https://docs.farsightsecurity.com/ | JSON (NDJSON) | REST (v2) | API key (commercial) | `rrname`, `rrtype`, `rdata`, `time_first`, `time_last`, `count` | Minutes | Commercial + Research |
| **CIRCL Passive DNS** | https://www.circl.lu/services/passive-dns/ | JSON | REST | API key (free for researchers) | `rrname`, `rrtype`, `rdata`, `time_first`, `time_last`, `count` | Hourly | Free (research) |
| **Tranco Top-1M** | https://tranco-list.eu/ | CSV (rank, domain) | REST + Download | None | `rank`, `domain` | Daily | MIT |
| **DNS-over-HTTPS logs** | Operator-specific | JSON | N/A | N/A | `question.name`, `question.type`, `answer.data` | Real-time | Operator |

### AVA.DS.3.3.2 NATS Subject Taxonomy

```
sensor.dns.zeek.json         # Zeek dns.log JSON records
sensor.dns.zeek.raw          # Zeek dns.log TSV (original format)
sensor.dns.farsight.json     # Farsight DNSDB passive DNS lookups
sensor.dns.circl.json        # CIRCL passive DNS records
sensor.dns.tranco.csv        # Tranco top-1M domain list
sensor.dns.doh.json          # DNS-over-HTTPS resolver logs
sensor.dns.synthetic.json    # Generated test DNS records
```

**Normative subjects** (MUST be implemented):

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.dns.zeek.json` | JSON | Zeek dns.log — primary production source |
| `sensor.dns.farsight.json` | JSON | Farsight DNSDB passive DNS (commercial) |
| `sensor.dns.circl.json` | JSON | CIRCL passive DNS (research tier) |
| `sensor.dns.tranco.csv` | CSV | Tranco top-1M reference list (daily refresh) |
| `sensor.dns.synthetic.json` | JSON | Synthetic DNS record generator output |

### AVA.DS.3.3.3 Payload Schema

**Canonical: Zeek dns.log JSON**

```json
{
  "ts": 1708432456.123456,
  "uid": "CYkN4p3jMHa7ZeMPbi",
  "id.orig_h": "192.168.1.100",
  "id.orig_p": 52311,
  "id.resp_h": "8.8.8.8",
  "id.resp_p": 53,
  "proto": "udp",
  "trans_id": 42567,
  "query": "evil.example.com",
  "qclass": 1,
  "qclass_name": "C_INTERNET",
  "qtype": 1,
  "qtype_name": "A",
  "rcode": 0,
  "rcode_name": "NOERROR",
  "AA": false,
  "TC": false,
  "RD": true,
  "RA": true,
  "Z": 0,
  "answers": ["93.184.216.34"],
  "TTLs": [3600.0],
  "rejected": false
}
```

**Passive DNS Common Output Format** (Farsight DNSDB / CIRCL):

```json
{
  "rrname": "evil.example.com.",
  "rrtype": "A",
  "rdata": "93.184.216.34",
  "time_first": 1708300000,
  "time_last": 1708432456,
  "count": 47,
  "bailiwick": "example.com.",
  "origin": "sensor-id-123"
}
```

**BaseSignal mapping**:

```rust
BaseSignal {
    signal_kind: SignalKind::Dns,
    timestamp: ts,
    source_id: "zeek",       // or "farsight", "circl"
    entity_ids: vec![
        EntityId { class: Domain,      namespace: DomainName, value: query },
        EntityId { class: NetworkHost, namespace: IpAddress,  value: answers[0] },
        EntityId { class: NetworkHost, namespace: IpAddress,  value: id.orig_h },
    ],
    payload: serde_json::Value,
    confidence: 0.95,         // Direct observation
}
```

### AVA.DS.3.3.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|-------------|---------------------|---------|
| `query` / `rrname` | Domain | DomainName | `evil.example.com` |
| `answers[*]` / `rdata` | NetworkHost | IpAddress | `93.184.216.34` |
| `id.orig_h` | NetworkHost | IpAddress | `192.168.1.100` (resolver client) |
| `id.resp_h` | NetworkHost | IpAddress | `8.8.8.8` (DNS server) |

### AVA.DS.3.3.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier | Description |
|------------------|-----------|----------|------|-------------|
| Http | Temporal + Key | Domain + time window | Tier 1 | DNS lookup followed by HTTP connection |
| Cyber | Key-based | Domain vs. STIX Indicator | Tier 1 | Domain matches IOC indicator pattern |
| Osint | Key-based | Domain in GDELT/news | Tier 2 | OSINT mention of suspicious domain |
| Social | Key-based | Domain in social media posts | Tier 2 | Social media discussion of domain |
| Financial | Key-based | WHOIS registrant vs. sanctions | Tier 3 | Domain registrant on OFAC/sanctions list |

### AVA.DS.3.3.6 Synthetic Data Generation

| Parameter | Range / Strategy |
|-----------|------------------|
| `query` | Mix of: Tranco top-1M samples (70%), DGA-like random labels (15%), known-bad from threat feeds (10%), typosquat variants (5%) |
| `qtype_name` | Weighted: A (60%), AAAA (15%), CNAME (10%), MX (5%), TXT (5%), NS (3%), SOA (2%) |
| `rcode_name` | Weighted: NOERROR (85%), NXDOMAIN (10%), SERVFAIL (3%), REFUSED (2%) |
| `answers` | Random public IPs for benign; known-bad IPs for malicious; empty for NXDOMAIN |
| `TTLs` | Range 60-86400; low TTLs (< 300) flagged as suspicious (fast-flux) |
| `count` (passive DNS) | Power-law distribution: most domains seen 1-10 times, popular domains 10K+ |
| **Generation strategy** | Replay: replay real Zeek dns.log with anonymized IPs + injected malicious queries |

---

## AVA.DS.3.4 Signal Kind: Cyber

> **STIX 2.1 integration is a key differentiator for ava-fusion.** This section
> documents the STIX bundle ingestion path, the mapping from STIX Domain Objects
> (SDOs) and STIX Cyber-observable Objects (SCOs) to BaseSignal and EntityClass,
> and the non-STIX threat intelligence feeds that supplement the STIX pipeline.

### AVA.DS.3.4.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| **MITRE ATT&CK** | https://github.com/mitre-attack/attack-stix-data | STIX 2.1 JSON | GitHub raw + TAXII 2.1 | None (GitHub) / Rate-limited (TAXII) | `type`, `id`, `name`, `external_references`, `kill_chain_phases` | ~Quarterly | MIT |
| **abuse.ch URLhaus** | https://urlhaus.abuse.ch/api/ | JSON | REST POST | API key (free) | `url`, `url_status`, `threat`, `tags`, `host`, `date_added` | Minutes | CC0 |
| **abuse.ch ThreatFox** | https://threatfox-api.abuse.ch/api/v1/ | JSON | REST POST | API key (free) | `ioc_type`, `ioc_value`, `threat_type`, `malware`, `confidence_level` | Minutes | CC0 |
| **abuse.ch MalwareBazaar** | https://bazaar.abuse.ch/api/ | JSON | REST POST | API key (free) | `sha256_hash`, `file_type`, `signature`, `tags`, `first_seen` | Minutes | CC0 |
| **CISA KEV** | https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json | JSON | Direct download | None | `cveID`, `vendorProject`, `product`, `vulnerabilityName`, `dateAdded`, `dueDate`, `knownRansomwareCampaignUse` | Daily | Public domain |
| **AlienVault OTX** | https://otx.alienvault.com/api/ | JSON | REST v2 | API key (free) | `id`, `name`, `indicators[].type`, `indicators[].indicator`, `tags`, `TLP` | Minutes | Free tier |
| **MISP Default Feeds** | https://www.misp-project.org/feeds/ | MISP JSON + STIX | REST | API key (self-hosted) | Event attributes, indicators, tags, galaxies | Varies per feed | Mixed (mostly free) |
| **PhishTank** | https://checkurl.phishtank.com/checkurl/ | JSON / CSV | REST POST | API key (free) | `url`, `phish_id`, `verified`, `valid`, `verified_at` | Hourly | CC BY-SA |

### AVA.DS.3.4.2 NATS Subject Taxonomy

```
sensor.cyber.mitre.stix      # MITRE ATT&CK STIX 2.1 bundles
sensor.cyber.abusech.json    # abuse.ch (URLhaus, ThreatFox, MalwareBazaar)
sensor.cyber.cisa.json       # CISA KEV catalog
sensor.cyber.otx.json        # AlienVault OTX pulses
sensor.cyber.misp.stix       # MISP feeds in STIX format
sensor.cyber.misp.json       # MISP feeds in native MISP JSON
sensor.cyber.phishtank.json  # PhishTank verified phishing URLs
sensor.cyber.synthetic.stix  # Synthetic STIX bundles for testing
sensor.cyber.synthetic.json  # Synthetic IOC records for testing
```

**Normative subjects** (MUST be implemented):

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.cyber.mitre.stix` | STIX 2.1 JSON | MITRE ATT&CK knowledge base bundles |
| `sensor.cyber.abusech.json` | JSON | abuse.ch unified feed (URLhaus + ThreatFox + MalwareBazaar) |
| `sensor.cyber.cisa.json` | JSON | CISA KEV vulnerability catalog |
| `sensor.cyber.otx.json` | JSON | AlienVault OTX pulse indicators |
| `sensor.cyber.misp.stix` | STIX 2.1 JSON | MISP feeds exported as STIX bundles |
| `sensor.cyber.synthetic.stix` | STIX 2.1 JSON | Test STIX bundles |

**AVA.3-R6 compliance**: All STIX 2.1 bundles MUST use format token `stix`.
Non-STIX threat feeds MUST use `json`. This enables format-specific deserialization
at the SensorIngestor bridge.

### AVA.DS.3.4.3 Payload Schema

#### STIX 2.1 Bundle Format (Canonical)

The STIX 2.1 bundle is the canonical payload format for the `Cyber` signal kind.
All non-STIX feeds SHOULD be converted to STIX 2.1 at the adapter layer where
feasible.

**Bundle envelope**:

```json
{
  "type": "bundle",
  "id": "bundle--a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "objects": [
    { "type": "indicator", "..." : "..." },
    { "type": "malware", "..." : "..." },
    { "type": "relationship", "..." : "..." },
    { "type": "observed-data", "..." : "..." }
  ]
}
```

**STIX 2.1 Domain Objects (SDOs) relevant to ava-fusion**:

| STIX Type | ava-fusion EntityClass | Purpose |
|-----------|----------------------|---------|
| `indicator` | NetworkHost / Domain / Campaign | IOC with detection pattern |
| `malware` | Campaign | Malware family definition |
| `campaign` | Campaign | Named adversary campaign |
| `threat-actor` | Organization / Person | Adversary attribution |
| `attack-pattern` | Campaign | ATT&CK technique reference |
| `infrastructure` | NetworkHost / Domain | Adversary infrastructure (C2 servers) |
| `vulnerability` | — | CVE reference (joins with CISA KEV) |
| `observed-data` | NetworkHost / Domain | Sighting of observable in the wild |
| `relationship` | — | Links between SDOs (e.g., indicator → malware) |
| `identity` | Organization | Named entity (victim, reporter) |
| `report` | — | Aggregation of related objects |

**STIX 2.1 Cyber-observable Objects (SCOs) embedded in Observed Data**:

| SCO Type | ava-fusion Entity | Key Properties |
|----------|-------------------|----------------|
| `ipv4-addr` | NetworkHost | `value`: `"93.184.216.34"` |
| `ipv6-addr` | NetworkHost | `value`: `"2001:db8::1"` |
| `domain-name` | Domain | `value`: `"evil.example.com"` |
| `url` | Domain + NetworkHost | `value`: full URL |
| `email-addr` | Person | `value`: email address |
| `file` | — | `hashes.SHA-256`, `name`, `size` |
| `network-traffic` | NetworkHost | `src_ref`, `dst_ref`, `protocols` |
| `autonomous-system` | NetworkHost | `number`, `name` |

**Example: STIX 2.1 Indicator (IP-based IOC)**:

```json
{
  "type": "indicator",
  "spec_version": "2.1",
  "id": "indicator--a932fcc6-e032-476c-826f-cb970a5a1ade",
  "created": "2026-02-20T12:00:00.000Z",
  "modified": "2026-02-20T12:00:00.000Z",
  "name": "Malicious IP — C2 Server",
  "description": "Known command-and-control server for APT campaign",
  "indicator_types": ["malicious-activity"],
  "pattern": "[ipv4-addr:value = '93.184.216.34']",
  "pattern_type": "stix",
  "valid_from": "2026-02-20T00:00:00Z",
  "valid_until": "2026-08-20T00:00:00Z",
  "kill_chain_phases": [
    {
      "kill_chain_name": "mitre-attack",
      "phase_name": "command-and-control"
    }
  ],
  "labels": ["c2", "apt"],
  "confidence": 85,
  "external_references": [
    {
      "source_name": "abuse.ch",
      "url": "https://threatfox.abuse.ch/ioc/12345/"
    }
  ]
}
```

**Example: STIX 2.1 Campaign**:

```json
{
  "type": "campaign",
  "spec_version": "2.1",
  "id": "campaign--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f",
  "created": "2026-02-20T12:00:00.000Z",
  "modified": "2026-02-20T12:00:00.000Z",
  "name": "Operation Northern Storm",
  "description": "Multi-vector campaign targeting maritime infrastructure",
  "aliases": ["NorthStorm", "FrozenTide"],
  "first_seen": "2026-01-15T00:00:00Z",
  "objective": "Disruption of port logistics systems"
}
```

#### STIX Bundle → BaseSignal Conversion Path

The STIX-to-BaseSignal conversion is the critical ingestion bridge. The adapter
layer MUST implement the following transformation:

```
STIX Bundle
  │
  ├── Extract objects[] by type
  │     ├── indicator  → parse pattern → extract SCO values
  │     ├── malware    → extract name, hashes
  │     ├── campaign   → extract name, aliases
  │     ├── threat-actor → extract name, aliases
  │     ├── observed-data → extract SCO refs
  │     └── relationship → build entity graph edges
  │
  ├── For each extractable entity:
  │     BaseSignal {
  │       signal_kind: SignalKind::Cyber,
  │       timestamp: object.modified (or object.created),
  │       source_id: "mitre" | "abusech" | "otx" | ...,
  │       entity_ids: [extracted EntityId values],
  │       payload: original STIX object (JSON),
  │       confidence: object.confidence / 100.0  (STIX: 0-100, BaseSignal: 0.0-1.0),
  │     }
  │
  └── Publish to: sensor.cyber.{source}.stix
```

**Pattern parsing**: STIX indicator patterns follow the STIX Patterning Language.
Common patterns relevant to ava-fusion:

| Pattern | Extracted Entity |
|---------|-----------------|
| `[ipv4-addr:value = '1.2.3.4']` | NetworkHost (IpAddress: `1.2.3.4`) |
| `[domain-name:value = 'evil.com']` | Domain (DomainName: `evil.com`) |
| `[url:value = 'http://evil.com/mal']` | Domain + NetworkHost |
| `[file:hashes.SHA-256 = 'abc...']` | — (file hash, no direct entity) |
| `[email-addr:value = 'bad@evil.com']` | Person (email) |
| `[network-traffic:dst_ref.type = 'ipv4-addr' AND ...]` | NetworkHost |

#### Non-STIX Feed Schemas

**abuse.ch ThreatFox IOC**:

```json
{
  "id": "12345",
  "ioc": "93.184.216.34:443",
  "ioc_type": "ip:port",
  "threat_type": "botnet_cc",
  "threat_type_desc": "Indicator that identifies a botnet command&control server",
  "malware": "Cobalt Strike",
  "malware_alias": "CobaltStrike,Agentemis",
  "malware_malpedia": "https://malpedia.caad.fkie.fraunhofer.de/details/win.cobalt_strike",
  "confidence_level": 75,
  "first_seen": "2026-02-20 10:00:00 UTC",
  "last_seen": null,
  "reporter": "analyst123",
  "tags": ["CobaltStrike", "C2"]
}
```

**CISA KEV entry**:

```json
{
  "cveID": "CVE-2024-12345",
  "vendorProject": "Apache",
  "product": "HTTP Server",
  "vulnerabilityName": "Apache HTTP Server Path Traversal",
  "dateAdded": "2026-02-18",
  "shortDescription": "Apache HTTP Server contains a path traversal vulnerability...",
  "requiredAction": "Apply mitigations per vendor instructions or discontinue use.",
  "dueDate": "2026-03-10",
  "knownRansomwareCampaignUse": "Known",
  "notes": ""
}
```

**AlienVault OTX Pulse (abbreviated)**:

```json
{
  "id": "65abc123def456",
  "name": "Maritime Infrastructure Campaign IOCs",
  "description": "Indicators associated with attacks on port logistics",
  "author_name": "analyst",
  "created": "2026-02-19T08:00:00.000Z",
  "modified": "2026-02-20T12:00:00.000Z",
  "TLP": "green",
  "tags": ["maritime", "apt", "c2"],
  "indicators": [
    {
      "type": "IPv4",
      "indicator": "93.184.216.34",
      "description": "C2 server",
      "is_active": 1,
      "role": "c2"
    },
    {
      "type": "domain",
      "indicator": "evil.example.com",
      "description": "Phishing domain",
      "is_active": 1,
      "role": "phishing"
    },
    {
      "type": "FileHash-SHA256",
      "indicator": "e3b0c44298fc1c149afbf4c8996fb924...",
      "description": "Malware dropper",
      "is_active": 1
    }
  ],
  "references": ["https://example.com/report"],
  "targeted_countries": ["US", "NO", "NL"]
}
```

### AVA.DS.3.4.4 Entity Mapping

**From STIX 2.1 objects**:

| STIX Object Type | STIX Property | EntityClass | IdentifierNamespace | Example |
|------------------|---------------|-------------|---------------------|---------|
| `indicator` (pattern) | `ipv4-addr:value` | NetworkHost | IpAddress | `93.184.216.34` |
| `indicator` (pattern) | `domain-name:value` | Domain | DomainName | `evil.example.com` |
| `campaign` | `id` | Campaign | STIX ID | `campaign--8e2e2d2b-...` |
| `campaign` | `name` | Campaign | Name | `Operation Northern Storm` |
| `threat-actor` | `name` | Organization | Name | `APT29` |
| `infrastructure` | `name` + pattern | NetworkHost / Domain | IpAddress / DomainName | C2 server IP/domain |
| `observed-data` → `ipv4-addr` | `value` | NetworkHost | IpAddress | `10.0.0.1` |
| `observed-data` → `domain-name` | `value` | Domain | DomainName | `suspect.example.org` |
| `identity` | `name` | Organization | Name | `Victim Corp` |

**From non-STIX feeds**:

| Source | Source Field | EntityClass | IdentifierNamespace | Example |
|--------|-------------|-------------|---------------------|---------|
| abuse.ch ThreatFox | `ioc` (ip:port) | NetworkHost | IpAddress | `93.184.216.34` |
| abuse.ch URLhaus | `host` | Domain / NetworkHost | DomainName / IpAddress | `evil.example.com` |
| abuse.ch MalwareBazaar | `sha256_hash` | — | — | File hash (no entity) |
| CISA KEV | `vendorProject` + `product` | — | — | Vulnerability (enrichment only) |
| AlienVault OTX | `indicators[].indicator` (IPv4) | NetworkHost | IpAddress | `93.184.216.34` |
| AlienVault OTX | `indicators[].indicator` (domain) | Domain | DomainName | `evil.example.com` |
| PhishTank | `url` (extracted host) | Domain | DomainName | `phishing.example.com` |

### AVA.DS.3.4.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier | Description |
|------------------|-----------|----------|------|-------------|
| Http | Key-based | IP / Domain from STIX indicator pattern vs. Http flow `id.resp_h` / `host` | Tier 1 | **Critical path** — IOC match on network flows |
| Dns | Key-based | Domain from STIX indicator vs. DNS `query` / `rrname` | Tier 1 | **Critical path** — DNS resolution to malicious domain |
| Osint | Key-based | Campaign name / threat actor in GDELT/news | Tier 2 | Campaign context enrichment from open sources |
| Social | Key-based | IOC domains/IPs discussed on social media | Tier 2 | Social amplification of threat intelligence |
| AdsB | Behavioral | Campaign targeting aviation → ADS-B tracks at targeted airports | Tier 3 | Kinetic situational awareness during cyber campaign |
| Ais | Behavioral | Campaign targeting maritime → AIS tracks at targeted ports | Tier 3 | Maritime situational awareness during cyber campaign |
| Financial | Key-based | Threat actor org vs. sanctions lists | Tier 2 | Financial sanctions enrichment for attribution |
| RfBearing | Spatial | C2 server geolocation vs. RF bearing intersection | Tier 3 | Geolocation of adversary infrastructure |

### AVA.DS.3.4.6 Synthetic Data Generation

**STIX 2.1 synthetic bundle generation**:

| Object Type | Generation Strategy |
|-------------|---------------------|
| `indicator` | Generate with randomized IP/domain patterns; confidence 50-95; valid_from within last 30 days |
| `malware` | Sample names from MITRE ATT&CK software list; randomize hashes |
| `campaign` | Named campaigns with 3-8 related indicators; first_seen within last 90 days |
| `threat-actor` | Named actors with aliases; resource_level from [individual, club, organization, government] |
| `relationship` | `indicator` → `indicates` → `malware`; `campaign` → `uses` → `malware`; `threat-actor` → `attributed-to` → `campaign` |
| `observed-data` | Embed synthetic SCOs (ipv4-addr, domain-name, network-traffic) |
| `bundle` | 5-50 objects per bundle; realistic relationship graph |

**Non-STIX synthetic IOC generation**:

| Parameter | Range / Strategy |
|-----------|------------------|
| IP IOCs | Mix of RFC 5737 documentation ranges (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) + random public IPs |
| Domain IOCs | DGA-like labels (consonant-heavy, 8-20 chars) + typosquat of Tranco top-1K |
| File hashes | Random SHA-256; some matching MalwareBazaar known hashes for replay |
| Confidence | Uniform 30-100 for ThreatFox; binary verified/unverified for PhishTank |
| Temporal | `first_seen` uniformly distributed over last 30 days |
| **Generation strategy** | Scenario-based: generate a campaign with 10-30 indicators, 2-5 malware families, 1-3 threat actors, and realistic relationship graph. Publish as STIX bundle + individual IOC records. |

---

## Appendix A: STIX 2.1 Integration Architecture

### A.1 Ingestion Pipeline

```
                    ┌──────────────────────────────────┐
                    │         Source Adapters           │
                    ├──────────────────────────────────┤
                    │ MITRE ATT&CK  │  TAXII 2.1 poll │
                    │ abuse.ch      │  REST poll (5m)  │
                    │ CISA KEV      │  HTTP GET (1h)   │
                    │ AlienVault OTX│  REST poll (5m)  │
                    │ MISP feeds    │  REST pull        │
                    │ PhishTank     │  REST poll (1h)  │
                    └───────┬──────────────────────────┘
                            │
                            ▼
                    ┌──────────────────────────────────┐
                    │     STIX Normalization Layer      │
                    │                                  │
                    │  Non-STIX → STIX 2.1 converter   │
                    │  (ThreatFox IOC → STIX indicator) │
                    │  (CISA KEV → STIX vulnerability)  │
                    │  (OTX pulse → STIX bundle)        │
                    │  (PhishTank → STIX indicator)      │
                    └───────┬──────────────────────────┘
                            │
                            ▼
                    ┌──────────────────────────────────┐
                    │        NATS Publication           │
                    │                                  │
                    │  Native STIX → sensor.cyber.*.stix│
                    │  Converted   → sensor.cyber.*.stix│
                    │  Raw non-STIX→ sensor.cyber.*.json│
                    └───────┬──────────────────────────┘
                            │
                            ▼
                    ┌──────────────────────────────────┐
                    │    SensorIngestor (Cyber)         │
                    │    Subscribes: sensor.cyber.>     │
                    │                                  │
                    │  1. Deserialize STIX/JSON         │
                    │  2. Extract entities (pattern parse)│
                    │  3. Build BaseSignal              │
                    │  4. Publish to fusion pipeline    │
                    └──────────────────────────────────┘
```

### A.2 STIX Pattern Parser Requirements

The SensorIngestor for `Cyber` MUST implement a STIX Patterning Language parser
capable of extracting observable values from at minimum these pattern types:

| Pattern Type | Example | Extraction |
|-------------|---------|------------|
| Simple comparison | `[ipv4-addr:value = '1.2.3.4']` | IP address |
| Simple comparison | `[domain-name:value = 'evil.com']` | Domain name |
| Simple comparison | `[url:value = 'http://evil.com/path']` | URL (domain + path) |
| Simple comparison | `[file:hashes.SHA-256 = 'abc...']` | File hash |
| AND compound | `[network-traffic:dst_ref.type = 'ipv4-addr' AND network-traffic:dst_port = 443]` | IP + port |
| OR compound | `[ipv4-addr:value = '1.2.3.4' OR ipv4-addr:value = '5.6.7.8']` | Multiple IPs |

Complex patterns (LIKE, MATCHES, nested observations) MAY be deferred to a
later implementation phase.

### A.3 Confidence Normalization

Different sources use different confidence scales. The adapter layer MUST normalize
to the BaseSignal `confidence: f64` field (range 0.0 to 1.0):

| Source | Native Scale | Normalization |
|--------|-------------|---------------|
| STIX 2.1 `confidence` | 0-100 (integer) | `value / 100.0` |
| abuse.ch ThreatFox `confidence_level` | 0-100 (integer) | `value / 100.0` |
| AlienVault OTX | No explicit confidence | Default `0.70` |
| CISA KEV | Binary (in catalog = exploited) | Fixed `0.95` |
| MITRE ATT&CK | No explicit confidence | Default `0.90` (curated by MITRE) |
| PhishTank `verified` | Boolean | `true` → `0.85`, `false` → `0.40` |
| MISP `threat_level_id` | 1-4 (High to Undefined) | `[0.90, 0.70, 0.50, 0.30]` |

### A.4 TAXII 2.1 Polling Configuration

For the MITRE ATT&CK TAXII server:

| Parameter | Value |
|-----------|-------|
| Discovery URL | `https://attack-taxii.mitre.org/taxii2/` |
| API Root | `https://attack-taxii.mitre.org/api/v21/` |
| Collections | `enterprise-attack`, `mobile-attack`, `ics-attack` |
| Rate Limit | 10 requests per 10-minute window per source IP |
| Poll Interval | Every 6 hours (data updates ~quarterly) |
| Auth | None (public) |

---

## Appendix B: JetStream Configuration for Cyber Domain

From the NATS Subject Taxonomy (AVA.3.7):

| Stream Name | Subjects | Retention | Max Age | Storage | Notes |
|-------------|----------|-----------|---------|---------|-------|
| `SENSOR_CYBER` | `sensor.http.>`, `sensor.dns.>`, `sensor.cyber.>` | Limits | 72h | File | Longer retention than kinetic — threat intel has longer relevance window |

**Consumer groups**:

| Consumer | Filter | Deliver Policy | Ack Policy |
|----------|--------|----------------|------------|
| `cyber-ingestor` | `sensor.cyber.>` | All | Explicit |
| `http-ingestor` | `sensor.http.>` | All | Explicit |
| `dns-ingestor` | `sensor.dns.>` | All | Explicit |
| `ioc-matcher` | `sensor.cyber.*.stix` | All | Explicit |
| `dns-enricher` | `sensor.dns.*.json` | New | None |

---

*End of Section AVA.DS.3*


---

# AVA.DS.4: OSINT/Social/Financial Domain Data Sources

```
Section:       AVA.DS.4 — OSINT/Social/Financial Domain Data Sources
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          I — Data Source Catalog
SignalKinds:   Osint, Social, Financial, Travel
EntityClasses: Person, Organization, Campaign
```

> This section catalogs open-source intelligence, social media, financial/sanctions,
> and travel data sources that feed the ava-fusion pipeline. These four SignalKinds
> share a common characteristic: they produce **identity-centric** signals rather than
> geospatial tracks, making them primary inputs for **Person**, **Organization**, and
> **Campaign** entity resolution. The key words "MUST", "MUST NOT", "REQUIRED",
> "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED",
> "MAY", and "OPTIONAL" in this document are to be interpreted as described in
> [RFC2119] and [RFC8174].

---

## Table of Contents

1. [Overview](#avads41-overview)
2. [Signal Kind: Osint](#avads42-signal-kind-osint)
3. [Signal Kind: Social](#avads43-signal-kind-social)
4. [Signal Kind: Financial](#avads44-signal-kind-financial)
5. [Signal Kind: Travel](#avads45-signal-kind-travel)
6. [Cross-Domain Correlation Summary](#avads46-cross-domain-correlation-summary)
7. [JetStream Configuration](#avads47-jetstream-configuration)
8. [References](#avads48-references)

---

## AVA.DS.4.1 Overview

The OSINT/Social/Financial domain encompasses four SignalKinds that observe
human and organizational activity through publicly available information channels:

| SignalKind | DataType | Description | Primary Entities |
|------------|----------|-------------|-----------------|
| `Osint` | Event | News events, web archives, knowledge graphs | Person, Organization, Campaign |
| `Social` | Event | Social media posts, handles, network graphs | Person, Organization |
| `Financial` | Reference | Sanctions lists, corporate registries, filings | Person, Organization |
| `Travel` | Event | Passenger records, route data, border crossings | Person |

**Fusion role**: These signals provide the **identity layer** of the fusion pipeline.
While kinetic and RF domains produce geospatial tracks, OSINT/Social/Financial
signals resolve **who** is behind those tracks. Tier 1 joins use hard identifiers
(social handles, LEI codes, OFAC entity IDs). Tier 2 joins use name matching,
temporal co-occurrence, and network proximity.

**DataType split**: `Financial` sources are primarily `Reference` (slowly-changing
registries materialized as d2ts arrangements). `Osint`, `Social`, and `Travel` are
`Event` streams (volatile, append-only, timestamped).

---

## AVA.DS.4.2 Signal Kind: Osint

### AVA.DS.4.2.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| GDELT Event Database | https://www.gdeltproject.org/ | CSV/BigQuery | REST + BigQuery | None (BigQuery needs GCP) | `GLOBALEVENTID`, `Actor1Name`, `Actor2Name`, `ActionGeo_*`, `DATEADDED` | 15 min | Free/Open |
| GDELT GKG | https://www.gdeltproject.org/ | CSV/BigQuery | REST + BigQuery | None (BigQuery needs GCP) | `DocumentIdentifier`, `Persons`, `Organizations`, `Themes`, `Tone` | 15 min | Free/Open |
| Wayback Machine CDX | https://web.archive.org/cdx/search/cdx | JSON/CDX | REST GET | None | `urlkey`, `timestamp`, `mimetype`, `statuscode`, `digest` | Continuous | Free/Open |
| Common Crawl | https://commoncrawl.org/ | WARC/WET/WAT | S3 (`s3://commoncrawl/`) | None (`--no-sign-request`) | `url`, `timestamp`, `content-type`, `payload` | Monthly crawl | Free/Open |
| RSS/Atom News Feeds | Various | XML (RSS 2.0/Atom) | HTTP GET | None | `title`, `link`, `pubDate`, `description`, `author` | Publisher-dependent | Varies |

**Notes**:
- **GDELT** is the highest-value OSINT source. The Event Database encodes geopolitical
  events using the CAMEO coding system with actor identification, event type, and
  geolocation. The GKG extracts persons, organizations, themes, and sentiment from
  every news article worldwide.
- **GDELT direct download**: Files are available at
  `http://data.gdeltproject.org/gdeltv2/{YYYYMMDDHHMMSS}.export.CSV.zip` (events)
  and `http://data.gdeltproject.org/gdeltv2/{YYYYMMDDHHMMSS}.gkg.csv.zip` (GKG),
  published every 15 minutes. No authentication required.
- **Common Crawl**: As of March 2025 (CC-MAIN-2025-13), the truncation threshold
  increased from 1 MiB to 5 MiB. Access via `aws --no-sign-request s3 ls s3://commoncrawl/`.
- **Wayback Machine CDX**: The only required parameter is `url=`. Supports
  `output=json`, field selection via `fl=`, and timestamp filtering with `from=`/`to=`.

### AVA.DS.4.2.2 NATS Subject Taxonomy

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.osint.gdelt.events` | JSON | Parsed GDELT event records (CAMEO-coded) |
| `sensor.osint.gdelt.gkg` | JSON | GDELT Global Knowledge Graph extracts |
| `sensor.osint.wayback.json` | JSON | Wayback Machine CDX query results |
| `sensor.osint.commoncrawl.json` | JSON | Common Crawl extracted page metadata |
| `sensor.osint.news.rss` | JSON | Normalized RSS/Atom feed items |
| `sensor.osint.gdelt.raw` | CSV | Raw GDELT CSV before parsing |
| `sensor.osint.commoncrawl.raw` | WARC ref | Object Store reference to WARC segment |

**Normative**: Source adapters MUST normalize all OSINT sources into the canonical
`OsintSignal` payload schema (AVA.DS.4.2.3) before publishing to `.events`/`.gkg`
subjects. Raw formats MAY be published to `.raw` subjects for replay.

### AVA.DS.4.2.3 Payload Schema

```json
{
  "$id": "ava://schemas/osint-signal",
  "type": "object",
  "required": ["signalKind", "sourceId", "timestamp", "headline"],
  "properties": {
    "signalKind": { "const": "osint" },
    "sourceId": {
      "type": "string",
      "description": "Unique signal ID (e.g., 'gdelt:1234567890')"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 event timestamp"
    },
    "headline": {
      "type": "string",
      "description": "Article title or event summary"
    },
    "url": {
      "type": "string",
      "format": "uri",
      "description": "Source document URL"
    },
    "persons": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Extracted person names"
    },
    "organizations": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Extracted organization names"
    },
    "themes": {
      "type": "array",
      "items": { "type": "string" },
      "description": "GDELT GKG themes or user-defined tags"
    },
    "tone": {
      "type": "number",
      "description": "Sentiment score (-10 to +10, GDELT tone scale)"
    },
    "cameoEventCode": {
      "type": "string",
      "description": "CAMEO event code (GDELT events only)"
    },
    "geo": {
      "type": "object",
      "properties": {
        "lat": { "type": "number" },
        "lon": { "type": "number" },
        "name": { "type": "string" },
        "countryCode": { "type": "string" }
      },
      "description": "Geolocation of the event (if available)"
    }
  }
}
```

### AVA.DS.4.2.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|---------------------|---------|
| `persons[]` | Person | Custom (name) | `"John Smith"` |
| `organizations[]` | Organization | Custom (name) | `"Acme Corp"` |
| `cameoEventCode` + actors | Campaign | Custom (campaign ID) | `"cameo:040"` (verbal conflict) |
| `url` (domain) | Domain | DomainName | `"reuters.com"` |

**Identity resolution**: OSINT person/org names require fuzzy matching against
known entity registries (Financial domain sanctions lists, corporate registries).
This is a **Tier 2** (soft key) operation — no hard identifier exists in raw OSINT.

### AVA.DS.4.2.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier |
|------------------|-----------|----------|------|
| Social | Name + Temporal | Person/Org name + time window | Tier 2 |
| Financial | Name match | Organization name ↔ SDN/LEI name | Tier 2 |
| Cyber | URL/Domain | Document URL domain ↔ threat indicator domain | Tier 1 |
| Humint | Name + Location | Actor names + geo coordinates | Tier 2 |
| AdsB/Ais | Geo + Temporal | Event geo ↔ track position + time | Tier 3 |

### AVA.DS.4.2.6 Synthetic Data Generation

**GDELT synthetic**: Not required — GDELT is freely available with 15-minute updates.
For **offline testing**, replay captured GDELT CSV files via the feeder.

**RSS synthetic**: Generate with parametric templates:
- Schema: `{ title: string, link: string, pubDate: ISO8601, description: string, author: string }`
- Topics: draw from GDELT theme taxonomy (2000+ themes)
- Names: sample from census name lists + country-appropriate org names
- Rate: 1-10 articles/minute per simulated feed

---

## AVA.DS.4.3 Signal Kind: Social

### AVA.DS.4.3.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| Mastodon Public Timeline | https://docs.joinmastodon.org/methods/timelines/ | JSON | REST | None (public) / OAuth (auth'd) | `id`, `account.acct`, `content`, `created_at`, `tags[]` | Real-time | AGPL-3.0 (server) |
| Bluesky AT Protocol Firehose | https://docs.bsky.app/docs/advanced-guides/firehose | CBOR/JSON | WebSocket (`com.atproto.sync.subscribeRepos`) | None | `did`, `handle`, `text`, `createdAt`, `facets[]` | Real-time | MIT |
| Reddit API | https://www.reddit.com/dev/api/ | JSON | REST (OAuth) | OAuth2 required | `author`, `subreddit`, `title`, `selftext`, `created_utc`, `score` | Real-time | Reddit TOS |
| Pushshift (Reddit Archive) | https://archive.org/details/reddit-data-comments | JSON/ZSTD | Bulk download / API (mod-only) | Mod approval | `author`, `subreddit`, `body`, `created_utc` | Archive (2005-2022) | Research |
| GitHub Events API | https://docs.github.com/en/rest/activity/events | JSON | REST | Token (optional) | `type`, `actor.login`, `repo.name`, `created_at`, `payload` | Real-time | GitHub TOS |

**Notes**:
- **Mastodon**: Per-instance API. Rate limit: 300 req/5min (authenticated), 7500 req/5min
  (per-IP unauthenticated). Public timeline requires no auth. Each instance has its own
  endpoint (e.g., `mastodon.social`, `hachyderm.io`).
- **Bluesky**: The firehose is a WebSocket stream at
  `wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos`. No authentication required.
  Receives **all** public network events. Jetstream alternative available but not
  protocol-stable.
- **Reddit**: Free tier = 60 req/min (OAuth), 10 req/min (unauthenticated). Non-commercial
  use only for free tier. Commercial use requires pre-approval.
- **Pushshift**: Real-time ingestion stopped in 2023. Historical archive (2005-2022)
  available via Internet Archive. API access restricted to approved Reddit moderators.
- **GitHub Events**: 60 req/hr (unauthenticated), 5000 req/hr (authenticated with token).
  Public events endpoint returns the last 300 events.

### AVA.DS.4.3.2 NATS Subject Taxonomy

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.social.mastodon.json` | JSON | Mastodon public timeline posts |
| `sensor.social.bluesky.json` | JSON | Bluesky AT Protocol firehose events |
| `sensor.social.reddit.json` | JSON | Reddit submissions and comments |
| `sensor.social.github.json` | JSON | GitHub public events |
| `sensor.social.pushshift.json` | JSON | Pushshift archive replay |
| `sensor.social.mastodon.raw` | JSON | Raw Mastodon API response (before normalization) |
| `sensor.social.bluesky.raw` | CBOR | Raw AT Protocol repo events (CBOR-encoded) |

**Normative**: Bluesky raw events are CBOR-encoded repository operations. Source
adapters MUST decode CBOR and extract post/like/follow records before publishing to
the `.json` subject. The `.raw` subject MAY carry the original CBOR for archival.

### AVA.DS.4.3.3 Payload Schema

```json
{
  "$id": "ava://schemas/social-signal",
  "type": "object",
  "required": ["signalKind", "sourceId", "platform", "handle", "timestamp"],
  "properties": {
    "signalKind": { "const": "social" },
    "sourceId": {
      "type": "string",
      "description": "Platform-qualified post ID (e.g., 'mastodon:12345@mastodon.social')"
    },
    "platform": {
      "type": "string",
      "enum": ["mastodon", "bluesky", "reddit", "github", "pushshift"],
      "description": "Source platform identifier"
    },
    "handle": {
      "type": "string",
      "description": "User handle (e.g., '@user@instance', 'user.bsky.social', 'u/username')"
    },
    "displayName": {
      "type": "string",
      "description": "User display name (may differ from handle)"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "content": {
      "type": "string",
      "description": "Post text content (HTML stripped)"
    },
    "eventType": {
      "type": "string",
      "enum": ["post", "reply", "repost", "like", "follow", "commit", "issue", "pr"],
      "description": "Type of social activity"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Hashtags or topic tags"
    },
    "mentions": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Mentioned handles"
    },
    "urls": {
      "type": "array",
      "items": { "type": "string", "format": "uri" },
      "description": "Embedded URLs"
    },
    "replyTo": {
      "type": "string",
      "description": "Parent post ID if this is a reply"
    },
    "engagement": {
      "type": "object",
      "properties": {
        "likes": { "type": "integer" },
        "reposts": { "type": "integer" },
        "replies": { "type": "integer" }
      }
    }
  }
}
```

### AVA.DS.4.3.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|---------------------|---------|
| `handle` | Person | SocialHandle | `"@user@mastodon.social"` |
| `handle` (org accounts) | Organization | SocialHandle | `"@mozilla@mozilla.social"` |
| `mentions[]` | Person | SocialHandle | `"user.bsky.social"` |
| `urls[]` (domain) | Domain | DomainName | `"github.com"` |
| `tags[]` (campaign hashtags) | Campaign | Custom | `"#OpName"` |

**Identity resolution**: Social handles are the **primary hard key** for Person entities
in this domain. Cross-platform identity linkage (same person on Mastodon + Bluesky +
Reddit) is a **Tier 2** operation requiring profile bio matching, temporal correlation,
or explicit cross-references in user profiles.

### AVA.DS.4.3.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier |
|------------------|-----------|----------|------|
| Osint | Name + Temporal | Social handle display name ↔ OSINT person name | Tier 2 |
| Financial | Name match | Display name ↔ SDN entity name | Tier 2 |
| Cyber | URL + Domain | Shared URLs in posts ↔ threat indicator URLs | Tier 1 |
| Social (cross-platform) | Profile matching | Handle bio, display name, linked URLs | Tier 2 |
| Dns | Domain | URLs in posts ↔ passive DNS records | Tier 1 |

### AVA.DS.4.3.6 Synthetic Data Generation

**Mastodon synthetic**: Generate mock ActivityPub-style posts:
- Schema: `{ id, account: { acct, display_name }, content, created_at, tags: [{name}] }`
- Handles: `@{firstname}{lastname}@{instance}` from name lists + instance pool
- Content: Template-based with topic hashtags from a configurable theme set
- Rate: 5-50 posts/second per simulated instance
- Engagement: Poisson-distributed likes/boosts (lambda=3)

**Bluesky synthetic**: Generate mock AT Protocol records:
- Schema: `{ did, handle, text, createdAt, facets: [{mention, link}] }`
- DIDs: `did:plc:{random-32char}` format
- Handles: `{name}.bsky.social`

**Reddit synthetic**: Generate mock submissions:
- Schema: `{ author, subreddit, title, selftext, created_utc, score }`
- Subreddits: Pool of 50 simulated communities
- Score: Log-normal distribution (median=10, sigma=2)

---

## AVA.DS.4.4 Signal Kind: Financial

### AVA.DS.4.4.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| OFAC SDN List | https://ofac.treasury.gov/sanctions-list-service | XML/CSV | Download | None | `uid`, `sdnName`, `sdnType`, `programList`, `idList`, `addressList` | ~Weekly | US Gov (Public Domain) |
| OpenSanctions | https://www.opensanctions.org/ | JSON (FtM)/CSV | REST + Bulk | None (bulk), API key (search) | `id`, `schema`, `properties.name`, `datasets[]` | Daily | Open (non-commercial free) |
| GLEIF LEI Database | https://www.gleif.org/en/lei-data/gleif-api | JSON/XML/CSV | REST API | None | `LEI`, `Entity.LegalName`, `Entity.LegalAddress`, `Registration.Status` | Daily | Free/Open |
| SEC EDGAR | https://data.sec.gov/ | JSON/XBRL | REST | None (User-Agent required) | `cik`, `entityName`, `filings[]`, `facts.us-gaap.*` | Continuous | US Gov (Public Domain) |
| OpenCorporates | https://api.opencorporates.com/ | JSON | REST | API key | `company_number`, `name`, `jurisdiction_code`, `incorporation_date` | Daily | Open (free tier limited) |

**Notes**:
- **OFAC SDN**: The canonical sanctions list. Available as `SDN.xml` (full structured),
  `sdn.csv` (flat), and the newer Advanced Sanctions XML standard. Download from
  `https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML`.
  No API key, no rate limit on downloads. Updated approximately weekly.
- **OpenSanctions**: Aggregates 100+ sanctions and PEP lists worldwide. Bulk download:
  `https://data.opensanctions.org/datasets/latest/default/entities.ftm.json`. Free for
  non-commercial use. Commercial use requires license.
- **GLEIF**: Free API, no registration required. Supports up to 200 LEI records per
  request. Concatenated files published daily for bulk download.
- **SEC EDGAR**: Free, no API key required. User-Agent header MUST include contact
  email. Rate limit: 10 requests/second. XBRL data available as structured JSON at
  `https://data.sec.gov/api/xbrl/companyfacts/CIK{number}.json`.
- **OpenCorporates**: Free tier = 200 requests/month, 50 requests/day. Open data projects
  get free unlimited access. Covers 200M+ companies across jurisdictions.

### AVA.DS.4.4.2 NATS Subject Taxonomy

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.financial.ofac.json` | JSON | Parsed OFAC SDN entries |
| `sensor.financial.opensanctions.json` | JSON | OpenSanctions entity records |
| `sensor.financial.gleif.json` | JSON | GLEIF LEI records |
| `sensor.financial.edgar.json` | JSON | SEC EDGAR filing metadata |
| `sensor.financial.opencorporates.json` | JSON | OpenCorporates company records |
| `sensor.financial.ofac.raw` | XML | Raw OFAC SDN XML |
| `sensor.financial.gleif.raw` | CSV | Raw GLEIF concatenated file |

**Normative**: Financial sources are **Reference** data (DataType::Reference).
Source adapters SHOULD publish to the `.json` normalized subject after parsing.
The `.raw` subjects MAY be used for archival of original formats. Financial data
MUST be materialized in the `ava-state` KV bucket for O(1) lookup by entity ID.

### AVA.DS.4.4.3 Payload Schema

```json
{
  "$id": "ava://schemas/financial-signal",
  "type": "object",
  "required": ["signalKind", "sourceId", "source", "entityName", "entityType", "lastUpdated"],
  "properties": {
    "signalKind": { "const": "financial" },
    "sourceId": {
      "type": "string",
      "description": "Source-qualified entity ID (e.g., 'ofac:12345', 'lei:5493001KJTIIGC8Y1R12')"
    },
    "source": {
      "type": "string",
      "enum": ["ofac", "opensanctions", "gleif", "edgar", "opencorporates"],
      "description": "Data source identifier"
    },
    "entityName": {
      "type": "string",
      "description": "Primary entity name"
    },
    "entityType": {
      "type": "string",
      "enum": ["individual", "entity", "vessel", "aircraft"],
      "description": "OFAC-style entity type classification"
    },
    "aliases": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Known aliases / alternate names"
    },
    "identifiers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "description": "ID type (passport, taxId, LEI, CIK)" },
          "value": { "type": "string" },
          "country": { "type": "string" }
        }
      },
      "description": "Government/corporate identifiers"
    },
    "sanctionsPrograms": {
      "type": "array",
      "items": { "type": "string" },
      "description": "OFAC/sanctions program codes (e.g., 'SDGT', 'IRAN')"
    },
    "jurisdiction": {
      "type": "string",
      "description": "Country or jurisdiction code (ISO 3166-1 alpha-2)"
    },
    "addresses": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "street": { "type": "string" },
          "city": { "type": "string" },
          "country": { "type": "string" }
        }
      }
    },
    "legalForm": {
      "type": "string",
      "description": "Legal entity form (GLEIF/OpenCorporates)"
    },
    "status": {
      "type": "string",
      "enum": ["active", "inactive", "dissolved", "sanctioned"],
      "description": "Current entity status"
    },
    "lastUpdated": {
      "type": "string",
      "format": "date-time",
      "description": "Last update timestamp from source"
    }
  }
}
```

### AVA.DS.4.4.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|---------------------|---------|
| `entityName` (individual) | Person | Custom (name) | `"PUTIN, Vladimir Vladimirovich"` |
| `entityName` (entity) | Organization | Custom (name/LEI) | `"SBERBANK"` |
| `identifiers[type=LEI]` | Organization | Custom (LEI) | `"5493001KJTIIGC8Y1R12"` |
| `identifiers[type=passport]` | Person | Custom (passport) | `"AB1234567"` |
| `entityType=vessel` | Vessel | Mmsi | (cross-reference to AIS) |
| `entityType=aircraft` | Aircraft | IcaoHex | (cross-reference to ADS-B) |
| `sanctionsPrograms` + linked entities | Campaign | Custom (program code) | `"SDGT"` (terrorism) |

**Identity resolution**: Financial sources provide the **richest identity attributes**
in the pipeline. OFAC SDN entries include passport numbers, tax IDs, dates of birth,
and aliases — enabling high-confidence Tier 1 matching against other identity-bearing
signals. LEI codes from GLEIF provide **globally unique** organization identifiers.

### AVA.DS.4.4.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier |
|------------------|-----------|----------|------|
| Osint | Name match | SDN/LEI entity name ↔ OSINT person/org name | Tier 2 |
| Social | Name match | Entity name/alias ↔ social display name | Tier 2 |
| AdsB | ICAO hex | OFAC aircraft entries ↔ ADS-B tracks | Tier 1 |
| Ais | MMSI/vessel name | OFAC vessel entries ↔ AIS tracks | Tier 1 |
| Cyber | Domain/IP | Corporate domains ↔ threat indicators | Tier 2 |
| Travel | Name + Document | Person name + passport ↔ PNR passenger | Tier 1 |
| Financial (cross-source) | LEI/Name | GLEIF LEI ↔ EDGAR CIK ↔ OpenCorporates ID | Tier 1 |

### AVA.DS.4.4.6 Synthetic Data Generation

**OFAC synthetic**: Not required for basic testing — the real SDN list is freely
downloadable. For **volume testing**, generate synthetic entries:
- Schema: mirrors `FinancialSignal` above
- Names: Random person/org names with culturally appropriate aliases
- Programs: Sample from real OFAC program codes (`SDGT`, `IRAN`, `CYBER2`, `UKRAINE-EO13661`)
- Identifiers: Random passport/tax ID formats per country
- Rate: Bulk load (1000-10000 entries), not streaming

**GLEIF synthetic**:
- LEI format: `{4-digit prefix}{14-digit random}{2-digit checksum}`
- Legal names: Company name generator + jurisdiction suffix
- Status: 80% active, 15% lapsed, 5% retired

---

## AVA.DS.4.5 Signal Kind: Travel

### AVA.DS.4.5.1 Data Sources

| Source | URL | Format | API | Auth | Key Fields | Update Rate | License |
|--------|-----|--------|-----|------|------------|-------------|---------|
| OpenFlights Routes DB | https://openflights.org/data | CSV (`.dat`) | Download | None | `airline`, `source_airport`, `dest_airport`, `stops`, `equipment` | Static (last updated 2014) | ODbL |
| Synthetic PNR Generator | N/A | JSON | Internal | N/A | `pnr_id`, `passenger_name`, `flight`, `departure`, `arrival`, `passport` | Configurable | Synthetic |

**Notes**:
- **OpenFlights**: Historical route data (67,663 routes, 3,321 airports, 548 airlines as
  of June 2014). Useful as **reference data** for route plausibility validation and
  synthetic PNR generation, but not current operational data.
- **Real PNR/APIS data**: Government-classified (CBP, Europol). Not available for open
  integration. The ava-fusion pipeline uses **synthetic PNR generation** for development
  and testing, with schemas modeled after IATA PNRGOV and UN/EDIFACT PAXLST standards.

### AVA.DS.4.5.2 NATS Subject Taxonomy

| Subject Pattern | Payload Format | Description |
|----------------|---------------|-------------|
| `sensor.travel.synthetic.json` | JSON | Synthetic PNR records |
| `sensor.travel.openflights.csv` | CSV | OpenFlights route reference data |
| `sensor.travel.synthetic.pnr` | JSON | Structured PNR with passenger details |
| `sensor.travel.synthetic.apis` | JSON | Synthetic APIS (passenger manifest) records |

**Normative**: All travel signals in the dev/test pipeline MUST be synthetic.
Production travel integrations require separate compliance review and are out of
scope for this RFC.

### AVA.DS.4.5.3 Payload Schema

```json
{
  "$id": "ava://schemas/travel-signal",
  "type": "object",
  "required": ["signalKind", "sourceId", "recordType", "timestamp"],
  "properties": {
    "signalKind": { "const": "travel" },
    "sourceId": {
      "type": "string",
      "description": "PNR record locator or manifest ID (e.g., 'pnr:ABC123')"
    },
    "recordType": {
      "type": "string",
      "enum": ["pnr", "apis", "border_crossing"],
      "description": "Travel record type"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "Record creation or flight departure time"
    },
    "passenger": {
      "type": "object",
      "properties": {
        "givenName": { "type": "string" },
        "surname": { "type": "string" },
        "dob": { "type": "string", "format": "date" },
        "nationality": { "type": "string", "description": "ISO 3166-1 alpha-2" },
        "documentType": { "type": "string", "enum": ["passport", "national_id", "visa"] },
        "documentNumber": { "type": "string" },
        "documentCountry": { "type": "string" }
      },
      "required": ["givenName", "surname"]
    },
    "itinerary": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "flightNumber": { "type": "string" },
          "airline": { "type": "string" },
          "departureAirport": { "type": "string", "description": "IATA code" },
          "arrivalAirport": { "type": "string", "description": "IATA code" },
          "departureTime": { "type": "string", "format": "date-time" },
          "arrivalTime": { "type": "string", "format": "date-time" },
          "seatNumber": { "type": "string" },
          "bookingClass": { "type": "string" }
        }
      }
    },
    "companions": {
      "type": "array",
      "items": { "type": "string" },
      "description": "PNR co-travelers (names)"
    },
    "paymentMethod": {
      "type": "string",
      "enum": ["credit_card", "cash", "wire_transfer", "crypto"],
      "description": "Booking payment method"
    }
  }
}
```

### AVA.DS.4.5.4 Entity Mapping

| Source Field | EntityClass | IdentifierNamespace | Example |
|-------------|------------|---------------------|---------|
| `passenger.givenName` + `surname` | Person | Custom (name) | `"SMITH, John"` |
| `passenger.documentNumber` | Person | Custom (passport) | `"AB1234567"` |
| `itinerary[].airline` | Organization | Custom (IATA code) | `"BA"` (British Airways) |
| `itinerary[].departureAirport` | Facility | Custom (IATA code) | `"LHR"` |

### AVA.DS.4.5.5 Cross-Correlation Targets

| Target SignalKind | Join Type | Join Key | Tier |
|------------------|-----------|----------|------|
| Financial | Document + Name | Passport number ↔ OFAC SDN identifiers | Tier 1 |
| AdsB | Flight + Time | Flight number ↔ ADS-B callsign + departure time | Tier 1 |
| Social | Name + Temporal | Passenger name ↔ social media check-in posts | Tier 3 |
| Osint | Name + Location | Passenger name ↔ news mentions at destination | Tier 3 |
| Travel (self-join) | Document | Passport number across multiple PNRs → travel pattern | Tier 1 |

### AVA.DS.4.5.6 Synthetic Data Generation

PNR generation is the **primary data strategy** for the Travel signal kind:

- **Passenger identity**: Random realistic names from census data, weighted by
  nationality. Passport numbers formatted per issuing country conventions.
- **Itinerary**: Select routes from OpenFlights database. Generate 1-4 leg itineraries
  with realistic connection times (45min-4hr domestic, 2hr-8hr international).
- **Temporal distribution**: Flights weighted toward business hours (0600-2200 local).
  Seasonal variation: +30% summer, -20% winter for leisure routes.
- **Companions**: 40% solo, 35% pairs, 15% family (3-5), 10% group (6+).
- **Payment**: 70% credit card, 20% cash, 8% wire transfer, 2% crypto.
- **Red flag injection**: 5% of synthetic PNRs include anomaly indicators:
  - Last-minute booking (<24hr before departure)
  - One-way ticket to high-risk destination
  - Cash payment for expensive route
  - Passport country mismatch with departure location
  - Known OFAC SDN name match (synthetic)
- **Rate**: 10-100 PNR records/minute for pipeline testing
- **Generation strategy**: Parametric with configurable anomaly rate

---

## AVA.DS.4.6 Cross-Domain Correlation Summary

This matrix summarizes all join paths originating from OSINT/Social/Financial/Travel
signals to other domains:

| From → To | Join Key | Tier | Confidence | Notes |
|-----------|----------|------|------------|-------|
| Financial → AdsB | OFAC aircraft ICAO hex | Tier 1 | High | Sanctioned aircraft tracking |
| Financial → Ais | OFAC vessel MMSI/name | Tier 1 | High | Sanctioned vessel tracking |
| Financial → Travel | Passport/name match | Tier 1 | High | Watchlist screening |
| Financial → Financial | LEI/CIK cross-ref | Tier 1 | High | Corporate identity linkage |
| Social → Cyber | Shared URLs/domains | Tier 1 | High | Threat actor infrastructure |
| Social → Social | Cross-platform profile | Tier 2 | Medium | Identity unification |
| Social → Osint | Name + time window | Tier 2 | Medium | Person activity correlation |
| Osint → Financial | Org name match | Tier 2 | Medium | Entity enrichment |
| Osint → Humint | Name + geo | Tier 2 | Medium | Ground truth correlation |
| Osint → AdsB/Ais | Geo + time | Tier 3 | Low | Event-track correlation |
| Travel → AdsB | Flight callsign | Tier 1 | High | Passenger-aircraft linkage |
| Travel → Social | Name + temporal | Tier 3 | Low | Travel behavior inference |

**Highest-value fusion paths**:
1. **Financial → AdsB/Ais**: Sanctioned entity tracking (OFAC aircraft/vessel → live tracks)
2. **Financial → Travel**: Watchlist passenger screening (SDN name/passport → PNR)
3. **Social → Cyber**: Threat actor infrastructure mapping (posted URLs → IOC domains)
4. **Osint → Financial → AdsB**: Chain: news mention → sanctions match → live track

---

## AVA.DS.4.7 JetStream Configuration

All OSINT/Social/Financial/Travel signals are captured by the `SENSOR_OSINT` JetStream
stream (as defined in AVA.3.7):

| Stream Name | Subjects | Retention | Max Age | Storage |
|-------------|----------|-----------|---------|---------|
| `SENSOR_OSINT` | `sensor.osint.>`, `sensor.social.>`, `sensor.financial.>`, `sensor.travel.>` | Limits | 72h | File |

**Consumer groups**:

| Consumer | Filter Subject | Deliver Policy | Ack Policy |
|----------|---------------|----------------|------------|
| `osint-normalizer` | `sensor.osint.*.raw` | All | Explicit |
| `social-normalizer` | `sensor.social.*.raw` | All | Explicit |
| `financial-loader` | `sensor.financial.*.json` | All | Explicit |
| `travel-screener` | `sensor.travel.*.json` | All | Explicit |
| `identity-resolver` | `sensor.social.*.json`, `sensor.osint.*.json` | All | Explicit |

**KV materialization** (Financial reference data):

| KV Bucket | Key Pattern | Source | TTL |
|-----------|-------------|--------|-----|
| `ava-state` | `entity.ofac.{uid}` | OFAC SDN | 7d |
| `ava-state` | `entity.sanctions.{id}` | OpenSanctions | 24h |
| `ava-state` | `entity.lei.{lei_code}` | GLEIF | 7d |
| `ava-state` | `entity.edgar.{cik}` | SEC EDGAR | 7d |

---

## AVA.DS.4.8 References

- [GDELT Project] https://www.gdeltproject.org/data.html — Event database and GKG
- [Wayback CDX API] https://archive.org/developers/wayback-cdx-server.html — CDX server BETA
- [Common Crawl] https://commoncrawl.org/get-started — S3 data access
- [Mastodon API] https://docs.joinmastodon.org/methods/timelines/ — Public timeline
- [Mastodon Rate Limits] https://docs.joinmastodon.org/api/rate-limits/ — 300 req/5min
- [Bluesky Firehose] https://docs.bsky.app/docs/advanced-guides/firehose — AT Protocol stream
- [Reddit Data API] https://support.reddithelp.com/hc/en-us/articles/16160319875092 — API wiki
- [GitHub Events API] https://docs.github.com/en/rest/activity/events — Public events
- [Pushshift Archive] https://archive.org/details/reddit-data-comments — Reddit 2005-2022
- [OFAC SDN] https://ofac.treasury.gov/sanctions-list-service — Sanctions List Service
- [OpenSanctions] https://www.opensanctions.org/docs/bulk/ — Bulk data documentation
- [GLEIF API] https://www.gleif.org/en/lei-data/gleif-api — Free LEI lookup
- [SEC EDGAR API] https://www.sec.gov/search-filings/edgar-application-programming-interfaces — EDGAR APIs
- [OpenCorporates API] https://api.opencorporates.com/documentation/API-Reference — v0.4.8
- [OpenFlights] https://openflights.org/data — Airport, airline, and route data
- [RFC2119] Bradner, S., "Key words for use in RFCs", BCP 14, RFC 2119, March 1997
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119", BCP 14, RFC 8174, May 2017
- [ava-fusion SignalKind] `ava-fusion/src/signal.rs` — Osint, Social, Financial, Travel variants
- [ava-fusion EntityClass] `ava-fusion/src/entity.rs` — Person, Organization, Campaign
- [NATS Subject Taxonomy] `docs/specifications/rfc/rfc-section-nats-subject-taxonomy.md` — AVA.3

---

*End of Section AVA.DS.4*


---

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


---


---

# PART II: INTEGRATION SPECIFICATION (Normative)

---

# AVA.DS.6: NATS Subject Taxonomy (Normative)

```
Section:       AVA.DS.6 — NATS Subject Taxonomy (Normative)
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          II — Integration Specification (Normative)
Prerequisites: AVA.3 (NATS Subject Taxonomy), AVA.DS.1-5 (Domain Catalogs)
Feeds:         AVA.DS.7 (Cross-Correlation Matrix), AVA.DS.8 (Test Harness)
```

> This section consolidates the NATS subject taxonomy defined in
> [AVA.3](../../specifications/rfc/rfc-section-nats-subject-taxonomy.md) with
> the data source discoveries from the five domain catalogs
> ([AVA.DS.1](rfc-section-ds-kinetic.md) through [AVA.DS.5](rfc-section-ds-geoint-humint-masint.md)).
> It provides the **complete normative mapping** from every SignalKind to its
> JetStream streams, consumers, KV buckets, and Object Store buckets. The key
> words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHOULD", "RECOMMENDED", and
> "MAY" are interpreted as described in [RFC2119].

---

## Table of Contents

1. [Subject Hierarchy Recap](#avads61-subject-hierarchy-recap)
2. [Complete SignalKind-to-Subject Mapping](#avads62-complete-signalkind-to-subject-mapping)
3. [JetStream Stream Definitions](#avads63-jetstream-stream-definitions)
4. [Consumer Group Definitions](#avads64-consumer-group-definitions)
5. [KV Bucket Definitions](#avads65-kv-bucket-definitions)
6. [Object Store Definitions](#avads66-object-store-definitions)
7. [Wildcard Subscription Patterns](#avads67-wildcard-subscription-patterns)
8. [Normative Requirements](#avads68-normative-requirements)

---

## AVA.DS.6.1 Subject Hierarchy Recap

All subjects follow the four-token pattern defined in AVA.3:

```
sensor.{kind}.{source}.{format}
```

| Token | Constraints | Examples |
|-------|------------|---------|
| `sensor` | Fixed root namespace | — |
| `{kind}` | Lowercase SignalKind variant name, `[a-z_]+` | `adsb`, `ais`, `rfbearing`, `cyber` |
| `{source}` | Data source name, `[a-z0-9_-]+` | `opensky`, `noaa`, `synthetic` |
| `{format}` | Payload encoding, `[a-z0-9]+` | `json`, `csv`, `raw`, `stix`, `sigmf`, `geojson` |

Output namespaces:

```
fusion.{tier}.{entity_class}.results   # Fusion results
fusion.tracks.{entity_class}.{event}   # Track lifecycle
alarm.{severity}.{entity_class}        # Alarm notifications
ctl.{component}.{command}              # Control plane
```

---

## AVA.DS.6.2 Complete SignalKind-to-Subject Mapping

### AVA.DS.6.2.1 Kinetic Domain (AVA.DS.1)

| SignalKind | Subject | Source | Format | Catalog Ref |
|------------|---------|--------|--------|-------------|
| `AdsB` | `sensor.adsb.opensky.json` | OpenSky Network | JSON state vector | DS.1.2.1 |
| | `sensor.adsb.opensky.parsed` | OpenSky | BaseSignal JSON | DS.1.2.2 |
| | `sensor.adsb.adsbx.json` | ADSBexchange | JSON | DS.1.2.1 |
| | `sensor.adsb.adsbx.parsed` | ADSBexchange | BaseSignal JSON | DS.1.2.2 |
| | `sensor.adsb.dump1090.raw` | dump1090 | SBS-1 text | DS.1.2.1 |
| | `sensor.adsb.dump1090.parsed` | dump1090 | BaseSignal JSON | DS.1.2.2 |
| | `sensor.adsb.flightaware.json` | FlightAware | JSON | DS.1.2.1 |
| | `sensor.adsb.flightaware.parsed` | FlightAware | BaseSignal JSON | DS.1.2.2 |
| | `sensor.adsb.synthetic.json` | Synthetic | BaseSignal JSON | DS.1.2.6 |
| `Ais` | `sensor.ais.noaa.csv` | NOAA Marine Cadastre | CSV | DS.1.3.1 |
| | `sensor.ais.noaa.parsed` | NOAA | BaseSignal JSON | DS.1.3.2 |
| | `sensor.ais.aishub.nmea` | AISHub | NMEA 0183 | DS.1.3.1 |
| | `sensor.ais.aishub.json` | AISHub | JSON | DS.1.3.1 |
| | `sensor.ais.aishub.parsed` | AISHub | BaseSignal JSON | DS.1.3.2 |
| | `sensor.ais.gfw.json` | Global Fishing Watch | JSON | DS.1.3.1 |
| | `sensor.ais.gfw.parsed` | GFW | BaseSignal JSON | DS.1.3.2 |
| | `sensor.ais.marinetraffic.json` | MarineTraffic | JSON | DS.1.3.1 |
| | `sensor.ais.marinetraffic.parsed` | MarineTraffic | BaseSignal JSON | DS.1.3.2 |
| | `sensor.ais.synthetic.json` | Synthetic | BaseSignal JSON | DS.1.3.6 |
| `Radar` | `sensor.radar.swim.xml` | FAA SWIM | FIXM XML | DS.1.4.1 |
| | `sensor.radar.swim.parsed` | FAA SWIM | BaseSignal JSON | DS.1.4.2 |
| | `sensor.radar.nexrad.raw` | NOAA NEXRAD | Binary | DS.1.4.1 |
| | `sensor.radar.nexrad.json` | NOAA NEXRAD | JSON metadata | DS.1.4.2 |
| | `sensor.radar.nexrad.parsed` | NOAA NEXRAD | BaseSignal JSON | DS.1.4.2 |
| | `sensor.radar.synthetic.json` | Synthetic | BaseSignal JSON | DS.1.4.6 |
| `Satellite` | `sensor.satellite.sentinel.json` | Copernicus | STAC Item JSON | DS.1.5.1 |
| | `sensor.satellite.sentinel.geotiff` | Copernicus | Object Store ref | DS.1.5.2 |
| | `sensor.satellite.sentinel.parsed` | Copernicus | BaseSignal JSON | DS.1.5.2 |
| | `sensor.satellite.firms.json` | NASA FIRMS | JSON | DS.1.5.1 |
| | `sensor.satellite.firms.parsed` | NASA FIRMS | BaseSignal JSON | DS.1.5.2 |
| | `sensor.satellite.landsat.json` | USGS Landsat | STAC Item JSON | DS.1.5.1 |
| | `sensor.satellite.landsat.parsed` | USGS Landsat | BaseSignal JSON | DS.1.5.2 |
| | `sensor.satellite.planet.json` | Planet Labs | JSON | DS.1.5.1 |
| | `sensor.satellite.planet.parsed` | Planet Labs | BaseSignal JSON | DS.1.5.2 |
| | `sensor.satellite.synthetic.json` | Synthetic | BaseSignal JSON | DS.1.5.6 |

### AVA.DS.6.2.2 RF/Signals Domain (AVA.DS.2)

| SignalKind | Subject | Source | Format | Catalog Ref |
|------------|---------|--------|--------|-------------|
| `RfBearing` | `sensor.rfbearing.kiwisdr.json` | KiwiSDR TDoA | JSON | DS.2.2.1 |
| | `sensor.rfbearing.openwebrx.json` | OpenWebRX | JSON | DS.2.2.1 |
| | `sensor.rfbearing.synthetic.json` | Synthetic | JSON | DS.2.2.6 |
| | `sensor.rfbearing.synthetic.batch` | Synthetic | JSON array | DS.2.2.6 |
| `Sdr` | `sensor.sdr.gnuradio.sigmf` | GNU Radio | SigMF JSON | DS.2.3.1 |
| | `sensor.sdr.rtlsdr.iq` | RTL-SDR | Binary ref | DS.2.3.1 |
| | `sensor.sdr.websdr.json` | WebSDR | JSON | DS.2.3.1 |
| | `sensor.sdr.openwebrx.json` | OpenWebRX | JSON | DS.2.3.1 |
| | `sensor.sdr.synthetic.sigmf` | Synthetic | SigMF JSON | DS.2.3.6 |
| `Sigint` | `sensor.sigint.fcc.json` | FCC ULS | JSON | DS.2.4.1 |
| | `sensor.sigint.fcc.batch` | FCC ULS | JSON array | DS.2.4.1 |
| | `sensor.sigint.itu.json` | ITU BRIFIC | JSON | DS.2.4.1 |
| | `sensor.sigint.ntia.json` | NTIA | JSON | DS.2.4.1 |
| | `sensor.sigint.synthetic.json` | Synthetic | JSON | DS.2.4.6 |
| `Elint` | `sensor.elint.synthetic.json` | Synthetic | JSON | DS.2.5.6 |
| | `sensor.elint.synthetic.batch` | Synthetic | JSON array | DS.2.5.6 |
| | `sensor.elint.raddet.json` | RadDet | JSON | DS.2.5.1 |
| | `sensor.elint.reference.json` | Handbook | JSON | DS.2.5.1 |
| `Comint` | `sensor.comint.synthetic.json` | Synthetic | JSON | DS.2.6.6 |
| | `sensor.comint.synthetic.salute` | Synthetic | SALUTE JSON | DS.2.6.6 |
| | `sensor.comint.synthetic.batch` | Synthetic | JSON array | DS.2.6.6 |

### AVA.DS.6.2.3 Cyber/Network Domain (AVA.DS.3)

| SignalKind | Subject | Source | Format | Catalog Ref |
|------------|---------|--------|--------|-------------|
| `Http` | `sensor.http.zeek.json` | Zeek http.log | JSON | DS.3.2.1 |
| | `sensor.http.zeek.raw` | Zeek http.log | TSV | DS.3.2.2 |
| | `sensor.http.pcap.json` | tshark | JSON | DS.3.2.1 |
| | `sensor.http.cicids.csv` | CICIDS2017/2018 | CSV | DS.3.2.1 |
| | `sensor.http.ddos.csv` | CIC-DDoS2019 | CSV | DS.3.2.2 |
| | `sensor.http.synthetic.json` | Synthetic | JSON | DS.3.2.6 |
| `Dns` | `sensor.dns.zeek.json` | Zeek dns.log | JSON | DS.3.3.1 |
| | `sensor.dns.zeek.raw` | Zeek dns.log | TSV | DS.3.3.2 |
| | `sensor.dns.farsight.json` | Farsight DNSDB | JSON | DS.3.3.1 |
| | `sensor.dns.circl.json` | CIRCL | JSON | DS.3.3.1 |
| | `sensor.dns.tranco.csv` | Tranco | CSV | DS.3.3.1 |
| | `sensor.dns.doh.json` | DoH logs | JSON | DS.3.3.2 |
| | `sensor.dns.synthetic.json` | Synthetic | JSON | DS.3.3.6 |
| `Cyber` | `sensor.cyber.mitre.stix` | MITRE ATT&CK | STIX 2.1 | DS.3.4.1 |
| | `sensor.cyber.abusech.json` | abuse.ch | JSON | DS.3.4.1 |
| | `sensor.cyber.cisa.json` | CISA KEV | JSON | DS.3.4.1 |
| | `sensor.cyber.otx.json` | AlienVault OTX | JSON | DS.3.4.1 |
| | `sensor.cyber.misp.stix` | MISP feeds | STIX 2.1 | DS.3.4.1 |
| | `sensor.cyber.misp.json` | MISP feeds | MISP JSON | DS.3.4.2 |
| | `sensor.cyber.phishtank.json` | PhishTank | JSON | DS.3.4.1 |
| | `sensor.cyber.synthetic.stix` | Synthetic | STIX 2.1 | DS.3.4.6 |
| | `sensor.cyber.synthetic.json` | Synthetic | JSON | DS.3.4.6 |

### AVA.DS.6.2.4 OSINT/Social/Financial Domain (AVA.DS.4)

| SignalKind | Subject | Source | Format | Catalog Ref |
|------------|---------|--------|--------|-------------|
| `Osint` | `sensor.osint.gdelt.events` | GDELT | JSON | DS.4.2.1 |
| | `sensor.osint.gdelt.gkg` | GDELT GKG | JSON | DS.4.2.1 |
| | `sensor.osint.gdelt.raw` | GDELT | CSV | DS.4.2.2 |
| | `sensor.osint.wayback.json` | Wayback Machine | JSON | DS.4.2.1 |
| | `sensor.osint.commoncrawl.json` | Common Crawl | JSON | DS.4.2.1 |
| | `sensor.osint.commoncrawl.raw` | Common Crawl | WARC ref | DS.4.2.2 |
| | `sensor.osint.news.rss` | RSS feeds | JSON | DS.4.2.1 |
| `Social` | `sensor.social.mastodon.json` | Mastodon | JSON | DS.4.3.1 |
| | `sensor.social.mastodon.raw` | Mastodon | JSON (raw API) | DS.4.3.2 |
| | `sensor.social.bluesky.json` | Bluesky AT Proto | JSON | DS.4.3.1 |
| | `sensor.social.bluesky.raw` | Bluesky AT Proto | CBOR | DS.4.3.2 |
| | `sensor.social.reddit.json` | Reddit API | JSON | DS.4.3.1 |
| | `sensor.social.github.json` | GitHub Events | JSON | DS.4.3.1 |
| | `sensor.social.pushshift.json` | Pushshift archive | JSON | DS.4.3.1 |
| `Financial` | `sensor.financial.ofac.json` | OFAC SDN | JSON | DS.4.4.1 |
| | `sensor.financial.ofac.raw` | OFAC SDN | XML | DS.4.4.2 |
| | `sensor.financial.opensanctions.json` | OpenSanctions | JSON | DS.4.4.1 |
| | `sensor.financial.gleif.json` | GLEIF LEI | JSON | DS.4.4.1 |
| | `sensor.financial.gleif.raw` | GLEIF | CSV | DS.4.4.2 |
| | `sensor.financial.edgar.json` | SEC EDGAR | JSON | DS.4.4.1 |
| | `sensor.financial.opencorporates.json` | OpenCorporates | JSON | DS.4.4.1 |
| `Travel` | `sensor.travel.synthetic.json` | Synthetic | JSON | DS.4.5.6 |
| | `sensor.travel.synthetic.pnr` | Synthetic | PNR JSON | DS.4.5.2 |
| | `sensor.travel.synthetic.apis` | Synthetic | APIS JSON | DS.4.5.2 |
| | `sensor.travel.openflights.csv` | OpenFlights | CSV | DS.4.5.1 |

### AVA.DS.6.2.5 GEOINT/HUMINT/MASINT Domain (AVA.DS.5)

| SignalKind | Subject | Source | Format | Catalog Ref |
|------------|---------|--------|--------|-------------|
| `Geoint` | `sensor.geoint.osm.geojson` | OpenStreetMap | GeoJSON | DS.5.2.1 |
| | `sensor.geoint.osm.raw` | Overpass API | Overpass JSON | DS.5.2.2 |
| | `sensor.geoint.firms.json` | NASA FIRMS | JSON | DS.5.2.1 |
| | `sensor.geoint.firms.csv` | NASA FIRMS | CSV | DS.5.2.2 |
| | `sensor.geoint.sentinel.json` | Copernicus | STAC Item JSON | DS.5.2.1 |
| | `sensor.geoint.sentinel.geotiff` | Copernicus | Object Store ref | DS.5.2.2 |
| | `sensor.geoint.ghsl.geotiff` | GHSL | Object Store ref | DS.5.2.1 |
| | `sensor.geoint.naturalearth.geojson` | Natural Earth | GeoJSON | DS.5.2.1 |
| `Humint` | `sensor.humint.acled.json` | ACLED | JSON | DS.5.3.1 |
| | `sensor.humint.acled.csv` | ACLED | CSV | DS.5.3.2 |
| | `sensor.humint.reliefweb.json` | ReliefWeb | JSON | DS.5.3.1 |
| | `sensor.humint.gdacs.xml` | GDACS | XML | DS.5.3.1 |
| | `sensor.humint.gdacs.json` | GDACS | GeoJSON | DS.5.3.2 |
| | `sensor.humint.hdx.json` | HDX | JSON | DS.5.3.1 |
| | `sensor.humint.synthetic.salute` | Synthetic | SALUTE JSON | DS.5.3.6 |
| | `sensor.humint.synthetic.json` | Synthetic | JSON | DS.5.3.6 |
| `Masint` | `sensor.masint.usgs.seismic` | USGS Earthquakes | GeoJSON | DS.5.4.1 |
| | `sensor.masint.usgs.seismic_feed` | USGS Feeds | GeoJSON FC | DS.5.4.2 |
| | `sensor.masint.usgs.water` | USGS Water | JSON | DS.5.4.1 |
| | `sensor.masint.noaa.buoy` | NOAA NDBC | JSON | DS.5.4.1 |
| | `sensor.masint.noaa.buoy_raw` | NOAA NDBC | Fixed-width text | DS.5.4.2 |
| | `sensor.masint.epa.airquality` | EPA AirNow | JSON | DS.5.4.1 |
| | `sensor.masint.ctbto.seismic` | CTBTO vDEC | JSON | DS.5.4.1 |
| | `sensor.masint.synthetic.json` | Synthetic | JSON | DS.5.4.6 |

### AVA.DS.6.2.6 Custom Signal Kind

| SignalKind | Subject | Source | Format | Notes |
|------------|---------|--------|--------|-------|
| `Custom` | `sensor.custom.{name}.{fmt}` | Operator-defined | Operator-defined | MUST follow 4-token pattern (AVA.3-R8) |

---

## AVA.DS.6.3 JetStream Stream Definitions

Seven streams capture all sensor data. Streams MUST NOT overlap (AVA.3-R5).

| Stream | Subjects | Retention | Max Age | Storage | Domain |
|--------|----------|-----------|---------|---------|--------|
| `SENSOR_KINETIC` | `sensor.adsb.>`, `sensor.ais.>`, `sensor.radar.>`, `sensor.satellite.>` | Limits | 24h | File | Kinetic (DS.1) |
| `SENSOR_RF` | `sensor.rfbearing.>`, `sensor.sdr.>`, `sensor.sigint.>`, `sensor.elint.>`, `sensor.comint.>` | Limits | 24h | File | RF/Signals (DS.2) |
| `SENSOR_CYBER` | `sensor.http.>`, `sensor.dns.>`, `sensor.cyber.>` | Limits | 72h | File | Cyber/Network (DS.3) |
| `SENSOR_OSINT` | `sensor.osint.>`, `sensor.social.>`, `sensor.financial.>`, `sensor.travel.>` | Limits | 72h | File | OSINT/Social/Financial (DS.4) |
| `SENSOR_GEO` | `sensor.geoint.>`, `sensor.humint.>`, `sensor.masint.>` | Limits | 168h | File | GEOINT/HUMINT/MASINT (DS.5) |
| `FUSION_RESULTS` | `fusion.>` | Limits | 168h | File | Fusion output |
| `ALARMS` | `alarm.>` | Interest | 720h | File | Alarm archive |

**Custom signals**: Subjects matching `sensor.custom.>` are NOT captured by any
default stream. Operators MUST create a dedicated stream or extend an existing
one when deploying custom signal kinds.

**Normative**: Each stream captures exactly the listed subject patterns. The
union of all stream subjects covers every `sensor.{kind}.>` pattern for all 20
SignalKind variants except `Custom`.

---

## AVA.DS.6.4 Consumer Group Definitions

### AVA.DS.6.4.1 Kinetic Domain Consumers

| Consumer | Stream | Filter | Deliver | Ack | Purpose |
|----------|--------|--------|---------|-----|---------|
| `adsb-ingestor` | `SENSOR_KINETIC` | `sensor.adsb.>` | All | Explicit | ADS-B parsing and BaseSignal conversion |
| `ais-ingestor` | `SENSOR_KINETIC` | `sensor.ais.>` | All | Explicit | AIS NMEA decoding, CSV parsing |
| `radar-ingestor` | `SENSOR_KINETIC` | `sensor.radar.>` | All | Explicit | Radar track extraction |
| `satellite-ingestor` | `SENSOR_KINETIC` | `sensor.satellite.>` | All | Explicit | Satellite metadata processing |

### AVA.DS.6.4.2 RF Domain Consumers

| Consumer | Stream | Filter | Deliver | Ack | Purpose |
|----------|--------|--------|---------|-----|---------|
| `rf-bearing-ingestor` | `SENSOR_RF` | `sensor.rfbearing.>` | All | Explicit | DF bearing processing |
| `sdr-ingestor` | `SENSOR_RF` | `sensor.sdr.>` | All | Explicit | IQ metadata processing |
| `sigint-loader` | `SENSOR_RF` | `sensor.sigint.>` | All | Explicit | Reference data KV loading |
| `elint-correlator` | `SENSOR_RF` | `sensor.elint.>` | All | Explicit | Emitter parameter correlation |
| `comint-processor` | `SENSOR_RF` | `sensor.comint.>` | All | Explicit | Intercept metadata processing |

### AVA.DS.6.4.3 Cyber Domain Consumers

| Consumer | Stream | Filter | Deliver | Ack | Purpose |
|----------|--------|--------|---------|-----|---------|
| `http-ingestor` | `SENSOR_CYBER` | `sensor.http.>` | All | Explicit | HTTP flow processing |
| `dns-ingestor` | `SENSOR_CYBER` | `sensor.dns.>` | All | Explicit | DNS record processing |
| `cyber-ingestor` | `SENSOR_CYBER` | `sensor.cyber.>` | All | Explicit | STIX/IOC deserialization |
| `ioc-matcher` | `SENSOR_CYBER` | `sensor.cyber.*.stix` | All | Explicit | STIX pattern matching |
| `dns-enricher` | `SENSOR_CYBER` | `sensor.dns.*.json` | New | None | Passive DNS enrichment |

### AVA.DS.6.4.4 OSINT Domain Consumers

| Consumer | Stream | Filter | Deliver | Ack | Purpose |
|----------|--------|--------|---------|-----|---------|
| `osint-normalizer` | `SENSOR_OSINT` | `sensor.osint.>` | All | Explicit | GDELT/RSS normalization |
| `social-normalizer` | `SENSOR_OSINT` | `sensor.social.>` | All | Explicit | Social media normalization |
| `financial-loader` | `SENSOR_OSINT` | `sensor.financial.>` | All | Explicit | Sanctions/registry KV loading |
| `travel-screener` | `SENSOR_OSINT` | `sensor.travel.>` | All | Explicit | PNR screening pipeline |
| `identity-resolver` | `SENSOR_OSINT` | `sensor.social.*.json`, `sensor.osint.*.json` | All | Explicit | Person/Org identity resolution |

### AVA.DS.6.4.5 GEO Domain Consumers

| Consumer | Stream | Filter | Deliver | Ack | Purpose |
|----------|--------|--------|---------|-----|---------|
| `geoint-ingestor` | `SENSOR_GEO` | `sensor.geoint.>` | All | Explicit | Feature extraction, raster ref |
| `humint-ingestor` | `SENSOR_GEO` | `sensor.humint.>` | All | Explicit | ACLED/SALUTE processing |
| `masint-ingestor` | `SENSOR_GEO` | `sensor.masint.>` | All | Explicit | Environmental measurement processing |
| `geo-monitor` | `SENSOR_GEO` | `sensor.geoint.>`, `sensor.humint.>`, `sensor.masint.>` | New | None | Monitoring/dashboard |

---

## AVA.DS.6.5 KV Bucket Definitions

| Bucket | Key Pattern | Value Schema | TTL | Source Domain |
|--------|-------------|-------------|-----|--------------|
| `ava-config` | `pipeline.{name}` | PipelineConfig JSON | — | Control plane |
| `ava-config` | `joinpath.{id}` | JoinPathEntryV2 JSON | — | Ontology |
| `ava-state` | `entity.{entity_id}` | EntityState JSON | — | All domains |
| `ava-state` | `track.{track_id}` | TrackState JSON | — | Fusion output |
| `ava-state` | `entity.ofac.{uid}` | FinancialSignal JSON | 7d | DS.4 Financial |
| `ava-state` | `entity.sanctions.{id}` | FinancialSignal JSON | 24h | DS.4 Financial |
| `ava-state` | `entity.lei.{lei_code}` | FinancialSignal JSON | 7d | DS.4 Financial |
| `ava-state` | `entity.edgar.{cik}` | FinancialSignal JSON | 7d | DS.4 Financial |
| `ava-metrics` | `actor.{name}.stats` | ActorMetrics JSON | — | Pipeline |
| `ava-schemas` | `signal.{kind}` | JSON Schema | — | All |
| `ava-ref-sigint` | `{callsign}` | SigintFrequencyRecord | 7d | DS.2 Sigint |
| `ava-ref-sigint` | `freq.{band}.{center_mhz}` | SigintFrequencyRecord | 7d | DS.2 Sigint |
| `ava-ref-elint` | `{emitter_type}.{frequency_band}` | ElintEmitterRecord | 30d | DS.2 Elint |
| `ava-ref-elint` | `id.{emitter_id}` | ElintEmitterRecord | 30d | DS.2 Elint |

**Normative**: All KV keys MUST use dots (`.`) as separators. Colons (`:`) are
INVALID in NATS KV keys (AVA.3-R4).

---

## AVA.DS.6.6 Object Store Definitions

| Bucket | Purpose | Max Object | Max Bucket | TTL | Source Domain |
|--------|---------|-----------|-----------|-----|--------------|
| `ava-blobs` | General large-payload storage | 100 MB | 50 GB | 7d | All |
| `ava-iq-samples` | SDR IQ binary data | 100 MB | 10 GB | 24h | DS.2 Sdr |
| `ava-iq-samples-archive` | Archived IQ captures | 100 MB | 100 GB | 30d | DS.2 Sdr |
| `ava-geoint-raster` | Sentinel/GHSL/Natural Earth rasters | 100 MB | 50 GB | 30d | DS.5 Geoint |
| `ava-humint-attachments` | Report attachments, images | 50 MB | 10 GB | 30d | DS.5 Humint |

**Object key conventions**:

| Bucket | Key Pattern | Example |
|--------|-------------|---------|
| `ava-iq-samples` | `{sensor_id}/{timestamp_epoch}/{capture_id}.sigmf-data` | `rtlsdr-01/1708432456/cap001.sigmf-data` |
| `ava-geoint-raster` | `{source}/{product_id}.tif` | `sentinel/S2A_20260220_T33UUP.tif` |
| `ava-blobs` | `{signal_kind}/{source}/{id}` | `satellite/sentinel/S2A_20260220.tif` |

**Normative**: Binary payloads exceeding 1 MB (IQ samples, imagery, PCAP)
MUST be stored in Object Store. NATS subject messages MUST contain only metadata
and an `object_store_key` field referencing the binary data (AVA.3-R7).

---

## AVA.DS.6.7 Wildcard Subscription Patterns

### AVA.DS.6.7.1 Per-Domain Wildcards

| Domain | Wildcard | Captures |
|--------|----------|----------|
| Kinetic | `sensor.adsb.>` | All ADS-B sources and formats |
| | `sensor.ais.>` | All AIS sources and formats |
| | `sensor.radar.>` | All radar sources and formats |
| | `sensor.satellite.>` | All satellite sources and formats |
| RF/Signals | `sensor.rfbearing.>` | All RF bearing sources |
| | `sensor.sdr.>` | All SDR captures |
| | `sensor.sigint.>` | All SIGINT reference data |
| | `sensor.elint.>` | All ELINT emitter records |
| | `sensor.comint.>` | All COMINT intercept metadata |
| Cyber | `sensor.http.>` | All HTTP flow data |
| | `sensor.dns.>` | All DNS records |
| | `sensor.cyber.>` | All threat intelligence |
| OSINT | `sensor.osint.>` | All OSINT events |
| | `sensor.social.>` | All social media |
| | `sensor.financial.>` | All financial/sanctions |
| | `sensor.travel.>` | All travel records |
| GEO | `sensor.geoint.>` | All GEOINT features |
| | `sensor.humint.>` | All HUMINT reports |
| | `sensor.masint.>` | All MASINT measurements |

### AVA.DS.6.7.2 Cross-Domain Wildcards

| Pattern | Use Case |
|---------|----------|
| `sensor.>` | All sensor data (monitoring, replay) |
| `sensor.*.synthetic.>` | All synthetic test data across domains |
| `sensor.*.*.parsed` | All parsed BaseSignal data |
| `sensor.*.*.stix` | All STIX 2.1 bundles |
| `fusion.>` | All fusion results |
| `fusion.tier1.>` | All Tier 1 hard-key results |
| `fusion.*.aircraft.>` | All aircraft results across tiers |
| `alarm.>` | All alarms |
| `alarm.critical.>` | Critical severity only |

---

## AVA.DS.6.8 Normative Requirements

| ID | Requirement | Level | Source |
|----|-------------|-------|--------|
| DS.6-R1 | All sensor subjects MUST follow `sensor.{kind}.{source}.{format}` | MUST | AVA.3-R1 |
| DS.6-R2 | `{kind}` MUST be lowercase SignalKind variant name | MUST | AVA.3-R2 |
| DS.6-R3 | JetStream streams MUST NOT have overlapping subjects | MUST | AVA.3-R5 |
| DS.6-R4 | KV keys MUST use dots, MUST NOT use colons | MUST | AVA.3-R4 |
| DS.6-R5 | STIX 2.1 bundles MUST use format token `stix` | MUST | AVA.3-R6 |
| DS.6-R6 | IQ/imagery >1MB MUST use Object Store | MUST | AVA.3-R7 |
| DS.6-R7 | Custom signals MUST follow 4-token pattern | MUST | AVA.3-R8 |
| DS.6-R8 | Every subject in this document SHOULD have a synthetic equivalent | SHOULD | New |
| DS.6-R9 | Reference data (Sigint, Elint, Financial) SHOULD be materialized in KV | SHOULD | DS.2, DS.4 |
| DS.6-R10 | USGS/ACLED events MUST include source event ID in `Nats-Msg-Id` header | MUST | DS.5 |

---

*End of Section AVA.DS.6*


---

# AVA.DS.7: Cross-Domain Correlation Matrix

```
Section:       AVA.DS.7 — Cross-Domain Correlation Matrix
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          II — Integration Specification (Normative)
Prerequisites: AVA.DS.1-6 (Domain Catalogs + NATS Taxonomy)
Feeds:         AVA.DS.8 (Test Harness)
```

> This section defines the **20x20 SignalKind cross-correlation matrix** for
> the ava-fusion pipeline. For each viable signal pair, it specifies the join
> type (from `ava-fusion/src/join_path.rs`), join key, fusion tier, and
> expected output type. The matrix is derived from the "Cross-Correlation
> Targets" subsections of [AVA.DS.1](rfc-section-ds-kinetic.md) through
> [AVA.DS.5](rfc-section-ds-geoint-humint-masint.md), cross-referenced with
> the `EntityClass` "Observable By" relationships from
> `ava-fusion/src/entity.rs`. The key words "MUST", "SHOULD", and "MAY" are
> interpreted as described in [RFC2119].

---

## Table of Contents

1. [Overview](#avads71-overview)
2. [Fusion Tier Definitions](#avads72-fusion-tier-definitions)
3. [Join Type Reference](#avads73-join-type-reference)
4. [Tier 1 Correlations (Hard Key)](#avads74-tier-1-correlations)
5. [Tier 2 Correlations (Soft Key)](#avads75-tier-2-correlations)
6. [Tier 3 Correlations (Derived)](#avads76-tier-3-correlations)
7. [Density Heat Map](#avads77-density-heat-map)
8. [EntityClass Overlap Matrix](#avads78-entityclass-overlap-matrix)
9. [Implementation Priority](#avads79-implementation-priority)

---

## AVA.DS.7.1 Overview

The ava-fusion pipeline supports correlation between any two of the 20
SignalKind variants. Not all 190 unique pairs (20 choose 2) are viable --
correlation requires at least one shared `EntityClass` or a plausible
spatial/temporal/spectral overlap. This document enumerates the **84 viable
pairs** discovered across the five domain catalogs.

**Correlation viability** is determined by:

1. **Shared EntityClass**: Both signal kinds can observe the same entity type
   (e.g., AdsB and Radar both observe Aircraft).
2. **Spatial overlap**: Both produce geo-referenced observations in overlapping
   regions (e.g., Satellite and Ais in maritime zones).
3. **Temporal overlap**: Both produce time-stamped observations within
   correlatable windows.
4. **Key overlap**: Both carry matching identifiers (e.g., ICAO hex, MMSI, IP
   address, domain name, frequency).

---

## AVA.DS.7.2 Fusion Tier Definitions

From `ava-fusion/src/join_path.rs`:

| Tier | Rust Variant | Confidence | Join Mechanism | Example |
|------|-------------|------------|----------------|---------|
| **Tier 1** | `Tier1Kinematic` | C ~ 0.99 | Hard key -- shared deterministic identifier | ICAO hex, MMSI, IP address, frequency |
| **Tier 2** | `Tier2Attribute` | C < 0.99 | Soft key -- proximity predicates, probabilistic | H3 cell + time bucket, bearing intersection |
| **Tier 3** | `Tier3Behavioral` | Variable | Derived -- statistical/behavioral patterns | Name matching, temporal co-occurrence |

---

## AVA.DS.7.3 Join Type Reference

From `ava-fusion/src/join_path.rs`:

| JoinType | Description | Key Expression |
|----------|-------------|----------------|
| `Identity` | Shared identifier (ICAO, MMSI, IP, domain, STIX ID) | `payload.{id_field}` |
| `Spatial` | Geographic proximity (H3 cell intersection, haversine) | `H3(lat, lon, resolution)` |
| `Temporal` | Temporal proximity (time window overlap) | `abs(t1 - t2) < window_ms` |
| `Spectral` | RF frequency proximity (band matching) | `abs(f1 - f2) < bandwidth_hz` |
| `Semantic` | Named entity / IOC overlap (Jaccard coefficient) | `jaccard(entities_A, entities_B)` |
| `Behavioral` | Velocity/maneuver pattern similarity (DTW, cosine) | Statistical distance metric |
| `Statistical` | Tier 3 statistical correlation (emergent patterns) | Model-specific |

---

## AVA.DS.7.4 Tier 1 Correlations (Hard Key)

Tier 1 joins use deterministic shared identifiers. These are the highest-confidence,
lowest-latency correlations and SHOULD be implemented first.

| Left Signal | Right Signal | Join Key | EntityClass | Output | Catalog Ref |
|------------|-------------|----------|-------------|--------|-------------|
| AdsB | AdsB (multi-source) | ICAO hex | Aircraft | FusedTrack | DS.1.2.5 |
| Ais | Ais (multi-source) | MMSI | Vessel | FusedTrack | DS.1.3.5 |
| Http | Dns | IP address + Domain name | NetworkHost, Domain | FusedTrack | DS.3.2.5 |
| Http | Cyber | IP / Domain vs STIX indicator | NetworkHost, Domain | CorrelatedPair | DS.3.2.5 |
| Dns | Cyber | Domain vs STIX indicator | Domain | CorrelatedPair | DS.3.3.5 |
| RfBearing | Sdr | Frequency + time bucket | RfEmitter | FusedTrack | DS.2.2.5 |
| RfBearing | Sigint | Licensed frequency match | RfEmitter | Enrichment | DS.2.2.5 |
| RfBearing | Comint | Frequency + time | RfEmitter | FusedTrack | DS.2.6.5 |
| Sdr | Sigint | Captured freq = licensed freq | RfEmitter | Enrichment | DS.2.3.5 |
| Sdr | AdsB | 1090 MHz capture = ADS-B decode | Aircraft | FusedTrack | DS.2.3.5 |
| Sdr | Ais | 161.975/162.025 MHz = AIS decode | Vessel | FusedTrack | DS.2.3.5 |
| Sdr | Comint | Frequency + time | RfEmitter | FusedTrack | DS.2.6.5 |
| Sigint | Elint | Licensed radar freq + station location | RfEmitter, Facility | Enrichment | DS.2.4.5 |
| Sigint | Comint | Licensed frequency match | RfEmitter | Enrichment | DS.2.6.5 |
| Sigint | AdsB | 1090 MHz allocation | Aircraft | Enrichment | DS.2.4.5 |
| Sigint | Ais | VHF marine allocation | Vessel | Enrichment | DS.2.4.5 |
| Financial | AdsB | OFAC aircraft ICAO hex | Aircraft | Flag | DS.4.4.5 |
| Financial | Ais | OFAC vessel MMSI/name | Vessel | Flag | DS.4.4.5 |
| Financial | Travel | Passport/name match | Person | Flag | DS.4.4.5 |
| Financial | Financial | LEI/CIK cross-reference | Organization | FusedTrack | DS.4.4.5 |
| Travel | AdsB | Flight callsign + departure time | Aircraft, Person | CorrelatedPair | DS.4.5.5 |
| Travel | Travel (self-join) | Passport number across PNRs | Person | SequenceMatch | DS.4.5.5 |
| Social | Cyber | Shared URLs/domains | Domain, Campaign | CorrelatedPair | DS.4.3.5 |
| Social | Dns | URLs in posts = DNS records | Domain | CorrelatedPair | DS.4.3.5 |
| Geoint | Satellite | Spatial bbox overlap + feature | Facility | FusedTrack | DS.5.2.5 |

**Total Tier 1 pairs**: 25

---

## AVA.DS.7.5 Tier 2 Correlations (Soft Key)

Tier 2 joins use probabilistic proximity predicates. These require spatial
indexing (H3), temporal windowing, and/or spectral binning.

| Left Signal | Right Signal | Join Type | Join Key | EntityClass | Blocking | Catalog Ref |
|------------|-------------|-----------|----------|-------------|----------|-------------|
| AdsB | Radar | Spatial+Temporal | H3 res 9 + 10s bucket | Aircraft | spatial, temporal | DS.1.2.5 |
| AdsB | Ais | Spatial+Temporal | H3 res 7 + 60s bucket | Aircraft, Vessel | spatial, temporal | DS.1.2.5 |
| AdsB | Satellite | Spatial+Temporal | H3 res 5 + 600s bucket | Aircraft, Facility | spatial, temporal | DS.1.2.5 |
| AdsB | RfBearing | Bearing intersection | Triangulated pos vs ADS-B pos | Aircraft, RfEmitter | spatial, temporal | DS.1.2.5 |
| Ais | Radar | Spatial+Temporal | H3 res 7 + 30s bucket | Vessel | spatial, temporal | DS.1.3.5 |
| Ais | Satellite | Spatial+Temporal | H3 res 5 + 600s bucket | Vessel, Facility | spatial, temporal | DS.1.3.5 |
| Ais | RfBearing | Bearing intersection | Triangulated pos vs AIS pos | Vessel, RfEmitter | spatial, temporal | DS.1.3.5 |
| Radar | Satellite | Spatial+Temporal | H3 res 5 + 600s bucket | Aircraft, Facility | spatial, temporal | DS.1.4.5 |
| Radar | RfBearing | Bearing intersection | Bearing vs radar track pos | Aircraft, RfEmitter | spatial, temporal | DS.1.4.5 |
| Radar | Elint | Parameter match | PRF/PW matching radar type | RfEmitter | spectral | DS.1.4.5 |
| RfBearing | AdsB | Spatial+Temporal | H3 cell + time + transponder freq | Aircraft, RfEmitter | spatial, temporal | DS.2.2.5 |
| RfBearing | Ais | Spatial+Temporal | H3 cell + time + VHF freq range | Vessel, RfEmitter | spatial, temporal | DS.2.2.5 |
| RfBearing | Radar | Spatial+Temporal | H3 cell + time bucket | RfEmitter | spatial, temporal | DS.2.2.5 |
| RfBearing | Elint | Frequency+Parameter | Freq + pulse characteristics | RfEmitter | spectral | DS.2.2.5 |
| Sdr | Elint | Frequency+Parameter | Center freq + detected pulse | RfEmitter | spectral | DS.2.3.5 |
| Sdr | Comint | Frequency+Temporal | Intercepted freq + time window | RfEmitter | spectral, temporal | DS.2.3.5 |
| Elint | RfBearing | Frequency+Location | DF bearing vs emitter location | RfEmitter | spatial, spectral | DS.2.5.5 |
| Elint | Sdr | Frequency+Parameter | IQ capture at radar freq | RfEmitter | spectral | DS.2.5.5 |
| Elint | Radar | Parameter match | PRF/PW vs known radar type | RfEmitter | spectral | DS.2.5.5 |
| Sigint | Elint | Frequency+Location | Licensed radar + station loc | RfEmitter, Facility | spatial, spectral | DS.2.4.5 |
| Http | Osint | Key | Domain/IP in news | NetworkHost, Domain | — | DS.3.2.5 |
| Dns | Osint | Key | Domain in news | Domain | — | DS.3.3.5 |
| Dns | Social | Key | Domain in social posts | Domain | — | DS.3.3.5 |
| Dns | Financial | Key | WHOIS registrant vs sanctions | Domain, Organization | — | DS.3.3.5 |
| Cyber | Osint | Key | Campaign name in news | Campaign, Organization | — | DS.3.4.5 |
| Cyber | Social | Key | IOC domains in social media | Domain, Campaign | — | DS.3.4.5 |
| Cyber | Financial | Key | Threat actor org vs sanctions | Organization | — | DS.3.4.5 |
| Osint | Social | Name+Temporal | Person/Org name + time window | Person, Organization | temporal | DS.4.2.5 |
| Osint | Financial | Name match | Organization name = SDN/LEI name | Organization | — | DS.4.2.5 |
| Osint | Humint | Name+Location | Actor names + geo coordinates | Person, Organization | spatial, temporal | DS.4.2.5 |
| Social | Social (cross-platform) | Profile matching | Bio, display name, linked URLs | Person | — | DS.4.3.5 |
| Social | Financial | Name match | Display name = SDN entity | Person, Organization | — | DS.4.3.5 |
| Financial | Cyber | Key | Corporate domains = threat indicators | Domain, Organization | — | DS.4.4.5 |
| Geoint | AdsB | Spatial | H3 cell + facility proximity | Aircraft, Facility | spatial | DS.5.2.5 |
| Geoint | Ais | Spatial | H3 cell + port geometry | Vessel, Facility | spatial | DS.5.2.5 |
| Geoint | Humint | Spatial+Temporal | H3 cell + time bucket | Facility, Organization | spatial, temporal | DS.5.2.5 |
| Geoint | Masint | Spatial | H3 cell | Facility | spatial | DS.5.2.5 |
| Geoint | Radar | Spatial+Temporal | H3 cell + time bucket | Facility | spatial, temporal | DS.5.2.5 |
| Humint | AdsB | Spatial+Temporal | H3 cell + time window | Aircraft, Person | spatial, temporal | DS.5.3.5 |
| Humint | Ais | Spatial+Temporal | H3 cell + time window | Vessel, Person | spatial, temporal | DS.5.3.5 |
| Humint | Masint | Spatial+Temporal | H3 cell + time window | Facility | spatial, temporal | DS.5.3.5 |
| Humint | Satellite | Spatial+Temporal | bbox overlap + date | Facility | spatial, temporal | DS.5.3.5 |
| Masint | Geoint | Spatial | H3 cell | Facility | spatial | DS.5.4.5 |
| Masint | AdsB | Spatial+Temporal | H3 cell + time window | Aircraft, Facility | spatial, temporal | DS.5.4.5 |
| Masint | Ais | Spatial+Temporal | H3 cell + time window | Vessel, Facility | spatial, temporal | DS.5.4.5 |
| Masint | Satellite | Spatial+Temporal | bbox + date | Facility | spatial, temporal | DS.5.4.5 |
| Masint | Masint (self) | Temporal | time bucket | Facility | temporal | DS.5.4.5 |
| Satellite | Masint | Spatial+Temporal | H3 res 5 + time window | Facility | spatial, temporal | DS.1.5.5 |
| Satellite | Geoint | Spatial | H3 res 7 + feature overlap | Facility | spatial | DS.1.5.5 |

**Total Tier 2 pairs**: 48

---

## AVA.DS.7.6 Tier 3 Correlations (Derived)

Tier 3 joins use statistical, behavioral, or semantic methods. These are the
lowest-confidence but highest-novelty correlations.

| Left Signal | Right Signal | Join Type | Method | EntityClass | Catalog Ref |
|------------|-------------|-----------|--------|-------------|-------------|
| AdsB | Osint | Semantic | Callsign string match in news | Aircraft, Campaign | DS.1.2.5 |
| AdsB | Sigint | Frequency+Spatial | 1090 MHz band + H3 cell | Aircraft, RfEmitter | DS.1.2.5 |
| Ais | Osint | Semantic | Vessel name/MMSI in news | Vessel, Campaign | DS.1.3.5 |
| Ais | Financial | Identity+Semantic | IMO lookup to beneficial ownership | Vessel, Organization | DS.1.3.5 |
| Satellite | Osint | Temporal+Semantic | News of fires/floods + FIRMS data | Facility, Campaign | DS.1.5.5 |
| Elint | Satellite | Spatial+Temporal | SAR confirms ground radar | RfEmitter, Facility | DS.2.5.5 |
| Elint | Comint | Temporal+Location | Radar + comms co-located | RfEmitter, Organization | DS.2.5.5 |
| Comint | Humint | Temporal+Location | HUMINT report + COMINT area | RfEmitter, Organization | DS.2.6.5 |
| Comint | Osint | Entity+Temporal | OSINT event + observed comms | Organization | DS.2.6.5 |
| Sigint | Osint | Entity | Licensee name = OSINT entity | Organization | DS.2.4.5 |
| Http | RfBearing | Spatial+Temporal | IP geolocation + bearing | NetworkHost, RfEmitter | DS.3.2.5 |
| Http | AdsB/Ais | Temporal | Timestamp overlap at facility | NetworkHost, Aircraft | DS.3.2.5 |
| Cyber | AdsB | Behavioral | Campaign targets aviation | Campaign, Aircraft | DS.3.4.5 |
| Cyber | Ais | Behavioral | Campaign targets maritime | Campaign, Vessel | DS.3.4.5 |
| Cyber | RfBearing | Spatial | C2 geolocation vs RF bearing | NetworkHost, RfEmitter | DS.3.4.5 |
| Osint | AdsB/Ais | Geo+Temporal | Event geo = track position | Person, Aircraft | DS.4.2.5 |
| Osint | Cyber | URL/Domain | Document URL = threat domain | Domain, Campaign | DS.4.2.5 |
| Travel | Social | Name+Temporal | Passenger name = social check-in | Person | DS.4.5.5 |
| Travel | Osint | Name+Location | Passenger name = news at dest | Person | DS.4.5.5 |
| Humint | Osint | Textual+Temporal | Actor name + time bucket | Person, Organization | DS.5.3.5 |
| Humint | Social | Textual+Spatial | Location name + H3 cell | Person, Organization | DS.5.3.5 |
| Humint | Cyber | Entity (actor) | Actor name / group ID | Organization, Campaign | DS.5.3.5 |
| Masint | Osint | Spatial+Temporal | Location + time | Facility | DS.5.4.5 |

**Total Tier 3 pairs**: 23

---

## AVA.DS.7.7 Density Heat Map

Correlation density per SignalKind (number of viable pairs per signal).
Higher density = more integration value.

```
SignalKind    | T1 | T2 | T3 | Total | Density
─────────────┼────┼────┼────┼───────┼────────
AdsB         |  4 |  6 |  3 |   13  | ████████████▏
Ais          |  3 |  6 |  2 |   11  | ██████████▌
Radar        |  1 |  6 |  0 |    7  | ██████▍
Satellite    |  1 |  5 |  2 |    8  | ███████▍
RfBearing    |  4 |  6 |  0 |   10  | █████████▎
Sdr          |  5 |  3 |  0 |    8  | ███████▍
Sigint       |  5 |  2 |  2 |    9  | ████████▎
Elint        |  1 |  5 |  2 |    8  | ███████▍
Comint       |  4 |  1 |  3 |    8  | ███████▍
Http         |  2 |  1 |  2 |    5  | ████▋
Dns          |  2 |  3 |  0 |    5  | ████▋
Cyber        |  3 |  3 |  3 |    9  | ████████▎
Osint        |  1 |  5 |  4 |   10  | █████████▎
Social       |  2 |  4 |  1 |    7  | ██████▍
Financial    |  4 |  3 |  1 |    8  | ███████▍
Travel       |  3 |  0 |  2 |    5  | ████▋
Geoint       |  1 |  5 |  0 |    6  | █████▌
Humint       |  0 |  5 |  3 |    8  | ███████▍
Masint       |  0 |  6 |  1 |    7  | ██████▍
Custom       |  0 |  0 |  0 |    0  | (operator-defined)
```

**Key observations**:
- **AdsB** has the highest density (13 pairs) -- it is the most cross-correlated signal.
- **Ais** and **RfBearing** follow closely (11, 10 pairs respectively).
- **Http**, **Dns**, and **Travel** have the fewest pairs (5 each) -- they are domain-specific.
- **Humint** and **Masint** have zero Tier 1 pairs -- they lack hard identifiers.

---

## AVA.DS.7.8 EntityClass Overlap Matrix

This matrix shows which EntityClasses are observable by which SignalKinds.
An "X" means the signal kind can produce observations mapped to that entity class.

```
                  | Aircraft | Vessel | GndVeh | RfEmit | NetHost | Domain | Person | Org   | Campaign | Facility
──────────────────┼──────────┼────────┼────────┼────────┼─────────┼────────┼────────┼───────┼──────────┼─────────
AdsB              |    X     |        |        |        |         |        |        |       |          |
Ais               |          |   X    |        |        |         |        |        |       |          |
Radar             |    X     |   X    |   X    |        |         |        |        |       |          |    X
Satellite         |          |   X    |        |        |         |        |        |       |          |    X
RfBearing         |    X     |   X    |        |   X    |         |        |        |       |          |
Sdr               |    X     |   X    |        |   X    |         |        |        |       |          |
Sigint            |    X     |   X    |        |   X    |         |        |        |  X    |          |    X
Elint             |    X     |   X    |        |   X    |         |        |        |       |          |    X
Comint            |          |        |        |   X    |         |        |        |  X    |          |
Http              |          |        |        |        |    X    |   X    |        |       |          |
Dns               |          |        |        |        |    X    |   X    |        |       |          |
Cyber             |          |        |        |        |    X    |   X    |   X    |  X    |    X     |
Osint             |          |        |        |        |         |   X    |   X    |  X    |    X     |
Social            |          |        |        |        |         |   X    |   X    |  X    |    X     |
Financial         |    X     |   X    |        |        |         |        |   X    |  X    |    X     |
Travel            |          |        |        |        |         |        |   X    |  X    |          |    X
Geoint            |          |        |        |        |         |        |        |  X    |          |    X
Humint            |          |        |        |        |         |        |   X    |  X    |          |    X
Masint            |          |        |        |        |         |        |        |       |          |    X
Custom            |    ?     |   ?    |   ?    |   ?    |    ?    |   ?    |   ?    |  ?    |    ?     |    ?
```

**Fusion rule**: Two signals CAN be correlated at Tier 1 (Identity) only if they
share at least one EntityClass column marked "X". Tier 2 (Spatial/Temporal)
correlations can bridge signals with no shared EntityClass IF they produce
geo-referenced observations. Tier 3 (Semantic/Behavioral) correlations have no
EntityClass constraint.

---

## AVA.DS.7.9 Implementation Priority

Recommended implementation order based on fusion value and complexity:

### Phase 1: Foundation (Tier 1, intra-domain)

| Priority | Pair | Value | Complexity |
|----------|------|-------|------------|
| P0 | AdsB x AdsB (multi-source dedup) | Critical | Low |
| P0 | Ais x Ais (multi-source dedup) | Critical | Low |
| P0 | Http x Dns (flow + resolution) | Critical | Low |
| P0 | Http x Cyber (IOC matching) | Critical | Medium |
| P0 | Dns x Cyber (domain IOC matching) | Critical | Medium |

### Phase 2: Cross-Domain Kinetic (Tier 2, spatial)

| Priority | Pair | Value | Complexity |
|----------|------|-------|------------|
| P1 | AdsB x Radar (transponder + primary) | High | Medium |
| P1 | AdsB x Ais (air-maritime) | High | Medium |
| P1 | Ais x Radar (maritime radar) | High | Medium |
| P1 | RfBearing x Sdr (DF + IQ) | High | Medium |
| P1 | Satellite x Ais (imagery + AIS) | High | High |

### Phase 3: Intelligence Integration (Tier 1+2, cross-domain)

| Priority | Pair | Value | Complexity |
|----------|------|-------|------------|
| P2 | Financial x AdsB (sanctioned aircraft) | High | Low |
| P2 | Financial x Ais (sanctioned vessels) | High | Low |
| P2 | Financial x Travel (watchlist screening) | High | Medium |
| P2 | Social x Cyber (threat infra mapping) | Medium | Medium |
| P2 | Sigint x Elint (license + emitter param) | Medium | High |

### Phase 4: Enrichment (Tier 3, behavioral)

| Priority | Pair | Value | Complexity |
|----------|------|-------|------------|
| P3 | Osint x AdsB/Ais (news + tracks) | Medium | High |
| P3 | Humint x Geoint (conflict + features) | Medium | Medium |
| P3 | Cyber x AdsB/Ais (campaign + kinetic) | Medium | High |
| P3 | Travel x Social (travel behavior) | Low | High |
| P3 | Masint x Humint (environmental context) | Low | Medium |

---

*End of Section AVA.DS.7*


---

# AVA.DS.8: E2E Test Harness Specification

```
Section:       AVA.DS.8 — E2E Test Harness Specification
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          II — Integration Specification (Normative)
Prerequisites: AVA.DS.6 (NATS Taxonomy), AVA.DS.7 (Cross-Correlation Matrix)
```

> This section specifies the end-to-end test harness for the ava-fusion pipeline.
> It defines synthetic data generators for all 20 SignalKinds, a JetStream-based
> replay harness with virtual time, validation criteria for latency/completeness/
> correctness, and a suite of test scenarios covering single-domain, cross-domain,
> burst-load, and late-arrival conditions. The key words "MUST", "SHOULD", and
> "MAY" are interpreted as described in [RFC2119].

---

## Table of Contents

1. [Overview](#avads81-overview)
2. [Synthetic Data Generator Specification](#avads82-synthetic-data-generator-specification)
3. [Replay Harness](#avads83-replay-harness)
4. [Validation Criteria](#avads84-validation-criteria)
5. [Test Scenarios](#avads85-test-scenarios)
6. [Coverage Matrix](#avads86-coverage-matrix)
7. [Spike Script Specification](#avads87-spike-script-specification)

---

## AVA.DS.8.1 Overview

The test harness serves three purposes:

1. **Infrastructure validation**: Verify that NATS JetStream streams, KV buckets,
   and Object Store buckets are correctly provisioned and accessible.
2. **Pipeline smoke testing**: Publish synthetic messages through all 20 SignalKind
   subjects and verify end-to-end flow from ingest to fusion output.
3. **Regression testing**: Replay recorded scenarios to validate fusion correctness
   after code changes.

### Architecture

```
┌─────────────────────────┐     ┌──────────────────────┐
│  Synthetic Generator    │     │  NATS Server          │
│                         │     │                       │
│  Per-SignalKind factory  │────▶│  JetStream Streams    │
│  Configurable rate       │     │  KV Buckets           │
│  Anomaly injection       │     │  Object Store         │
│  Virtual time clock      │     │                       │
└─────────────────────────┘     └──────────┬───────────┘
                                           │
                                           ▼
                                ┌──────────────────────┐
                                │  Fusion Pipeline      │
                                │  (System Under Test)  │
                                └──────────┬───────────┘
                                           │
                                           ▼
                                ┌──────────────────────┐
                                │  Validation Harness   │
                                │                       │
                                │  Subscribe fusion.>   │
                                │  Check latency        │
                                │  Check completeness   │
                                │  Check correctness    │
                                │  Report pass/fail     │
                                └──────────────────────┘
```

---

## AVA.DS.8.2 Synthetic Data Generator Specification

Each SignalKind has a dedicated generator. All generators share a common
interface:

```typescript
interface SyntheticGenerator {
  signalKind: string;
  subject: string;              // NATS subject to publish to
  ratePerSecond: number;        // Messages per second
  durationSeconds: number;      // Total generation time
  anomalyRate: number;          // Fraction of anomalous messages (0.0-1.0)
  seed: number;                 // PRNG seed for reproducibility
  generate(): AsyncIterable<{ subject: string; payload: Uint8Array }>;
}
```

### AVA.DS.8.2.1 Kinetic Domain Generators

| SignalKind | Subject | Schema | Rate | Strategy | Anomalies | Catalog Ref |
|------------|---------|--------|------|----------|-----------|-------------|
| `AdsB` | `sensor.adsb.synthetic.json` | BaseSignal (ADS-B) | 10-100/s | Parametric trajectory (great-circle route, climb/cruise/descent phases) | Spoofed positions, transponder gaps, ghost tracks | DS.1.2.6 |
| `Ais` | `sensor.ais.synthetic.json` | BaseSignal (AIS) | 5-50/s | Shipping lane simulation (port-to-port routes, vessel-type-dependent speed) | AIS dark periods, spoofed positions, MMSI changes | DS.1.3.6 |
| `Radar` | `sensor.radar.synthetic.json` | BaseSignal (Radar) | 5-20/s | Parametric track (radar site coverage area, scan-rate-dependent updates) | Clutter tracks, split tracks, ghost returns | DS.1.4.6 |
| `Satellite` | `sensor.satellite.synthetic.json` | BaseSignal (Satellite) | 0.1-1/s | Observation events (simulated overpass schedule, random AOI targets) | Cloud obscuration, temporal gaps, off-nadir angles | DS.1.5.6 |

**Key parameters (all kinetic generators)**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `entityCount` | int | 50 | Number of simultaneous tracked entities |
| `areaOfInterest` | GeoJSON | US CONUS | Geographic bounding polygon |
| `noiseLevel` | enum | `medium` | Position noise: low (10m), medium (50m), high (200m) |
| `anomalyRate` | float | 0.05 | Fraction of messages with injected anomalies |

### AVA.DS.8.2.2 RF/Signals Domain Generators

| SignalKind | Subject | Schema | Rate | Strategy | Anomalies | Catalog Ref |
|------------|---------|--------|------|----------|-----------|-------------|
| `RfBearing` | `sensor.rfbearing.synthetic.json` | RfBearingMeasurement | 1-10/s | Correlated emitter observations from 3-8 sensor network | Multipath, interference, false bearings | DS.2.2.6 |
| `Sdr` | `sensor.sdr.synthetic.sigmf` | SdrCapture (SigMF meta) | 0.01-0.1/s | AWGN base + 1-5 injected signals (tone, AM, FM, digital) | IQ imbalance, phase noise, frequency drift | DS.2.3.6 |
| `Sigint` | `sensor.sigint.synthetic.json` | SigintFrequencyRecord | Bulk (1000+) | FCC ULS-style records, band-weighted frequencies | Expired licenses, duplicate callsigns | DS.2.4.6 |
| `Elint` | `sensor.elint.synthetic.json` | ElintEmitterRecord | 0.5-5/s | Emitter library (100-500 entries) + time-series observations | Agile emitters (freq hop, PRI stagger) | DS.2.5.6 |
| `Comint` | `sensor.comint.synthetic.json` | ComintInterceptMetadata | 0.5-5/s | Network-based temporal correlation (call-response patterns) | Encrypted bursts, jamming, frequency changes | DS.2.6.6 |

### AVA.DS.8.2.3 Cyber/Network Domain Generators

| SignalKind | Subject | Schema | Rate | Strategy | Anomalies | Catalog Ref |
|------------|---------|--------|------|----------|-----------|-------------|
| `Http` | `sensor.http.synthetic.json` | Zeek http.log JSON | 50-500/s | Markov chain session model (80% benign, 20% suspicious) | DDoS, port scans, brute force, known malware UA | DS.3.2.6 |
| `Dns` | `sensor.dns.synthetic.json` | Zeek dns.log JSON | 50-500/s | Replay pattern (70% Tranco, 15% DGA, 10% known-bad, 5% typosquat) | Fast-flux (low TTL), NXDOMAIN floods | DS.3.3.6 |
| `Cyber` | `sensor.cyber.synthetic.stix` | STIX 2.1 Bundle | 0.1-1/s | Scenario-based (campaign + 10-30 indicators + relationships) | Expired indicators, conflicting IOCs | DS.3.4.6 |

### AVA.DS.8.2.4 OSINT/Social/Financial/Travel Generators

| SignalKind | Subject | Schema | Rate | Strategy | Anomalies | Catalog Ref |
|------------|---------|--------|------|----------|-----------|-------------|
| `Osint` | `sensor.osint.gdelt.events` | OsintSignal | 1-10/s | Template-based (theme taxonomy, census names, country-weighted geo) | — | DS.4.2.6 |
| `Social` | `sensor.social.mastodon.json` | SocialSignal | 5-50/s | Mock ActivityPub posts (Mastodon-style, Poisson engagement) | — | DS.4.3.6 |
| `Financial` | `sensor.financial.ofac.json` | FinancialSignal | Bulk (1000+) | OFAC SDN-style records (random names, programs, identifiers) | — | DS.4.4.6 |
| `Travel` | `sensor.travel.synthetic.json` | TravelSignal | 0.5-5/s | Parametric PNR (OpenFlights routes, census names, configurable anomaly rate) | Last-minute booking, one-way, cash payment, SDN match | DS.4.5.6 |

### AVA.DS.8.2.5 GEOINT/HUMINT/MASINT Generators

| SignalKind | Subject | Schema | Rate | Strategy | Anomalies | Catalog Ref |
|------------|---------|--------|------|----------|-----------|-------------|
| `Geoint` | `sensor.geoint.firms.json` | FirmsHotspot | 0.1-1/s | Parametric clusters around facility coordinates | — | DS.5.2.6 |
| `Humint` | `sensor.humint.acled.json` | AcledEvent | 0.5-5/s | Parametric (conflict zone clusters, Poisson process) | — | DS.5.3.6 |
| `Masint` | `sensor.masint.usgs.seismic` | UsgsEarthquakeEvent | 0.1-1/s | Gutenberg-Richter distribution along fault lines | — | DS.5.4.6 |

---

## AVA.DS.8.3 Replay Harness

The replay harness publishes pre-recorded or generated message sequences to
JetStream with controlled timing.

### AVA.DS.8.3.1 Replay Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Real-time** | Publish at original inter-message intervals | Production-like load testing |
| **Compressed** | Publish N times faster than real-time | Rapid regression testing |
| **Burst** | Publish all messages as fast as possible | Throughput/backpressure testing |
| **Virtual time** | Publish with synthetic timestamps, no wall-clock delay | Deterministic unit testing |

### AVA.DS.8.3.2 Replay Configuration

```typescript
interface ReplayConfig {
  mode: 'realtime' | 'compressed' | 'burst' | 'virtual';
  compressionFactor?: number;    // For 'compressed' mode (default: 10x)
  sourceFile?: string;           // Path to recorded message sequence
  generators?: GeneratorConfig[]; // In-memory synthetic generators
  maxMessages?: number;          // Cap total messages (default: unlimited)
  virtualTimeStart?: string;     // ISO 8601 start time for virtual mode
  virtualTimeStep?: number;      // Milliseconds per message in virtual mode
}
```

### AVA.DS.8.3.3 Message Recording Format

Recorded sequences use NDJSON (newline-delimited JSON):

```json
{"t":1708432456789,"s":"sensor.adsb.opensky.json","h":{"Nats-Msg-Id":"adsb-001"},"p":"base64..."}
{"t":1708432457123,"s":"sensor.ais.noaa.csv","h":{},"p":"base64..."}
```

| Field | Description |
|-------|-------------|
| `t` | Timestamp (Unix epoch milliseconds) |
| `s` | NATS subject |
| `h` | NATS headers (object) |
| `p` | Base64-encoded payload |

---

## AVA.DS.8.4 Validation Criteria

### AVA.DS.8.4.1 Latency

| Metric | Threshold | Measurement |
|--------|-----------|-------------|
| **Ingest latency** | < 100ms (p99) | Time from NATS publish to SensorIngestor ack |
| **Fusion latency** | < 500ms (p99) | Time from ingest to fusion result publication |
| **Alarm latency** | < 1000ms (p99) | Time from triggering event to alarm publication |
| **End-to-end** | < 2000ms (p99) | Time from source publish to fusion output available |

### AVA.DS.8.4.2 Completeness

| Metric | Threshold | Measurement |
|--------|-----------|-------------|
| **Message delivery** | 100% (zero loss) | Published count = stream message count |
| **Entity coverage** | >= 95% | Entities in synthetic data that appear in fusion output |
| **SignalKind coverage** | 20/20 | All signal kinds have at least one message processed |
| **Stream coverage** | 7/7 | All JetStream streams receive expected messages |

### AVA.DS.8.4.3 Correctness

| Metric | Threshold | Measurement |
|--------|-----------|-------------|
| **Tier 1 precision** | >= 0.99 | True positive rate for hard-key correlations |
| **Tier 1 recall** | >= 0.99 | All hard-key matches found |
| **Tier 2 precision** | >= 0.90 | True positive rate for spatial-temporal correlations |
| **Tier 2 recall** | >= 0.85 | Most spatial-temporal matches found |
| **Entity resolution accuracy** | >= 0.95 | Correct entity assignment for known test entities |
| **Anomaly detection rate** | >= 0.80 | Injected anomalies flagged by pipeline |
| **False positive rate** | <= 0.05 | Non-anomalous messages incorrectly flagged |

---

## AVA.DS.8.5 Test Scenarios

### AVA.DS.8.5.1 Single-Domain Scenarios

| ID | Scenario | SignalKind | Messages | Duration | Validates |
|----|----------|-----------|----------|----------|-----------|
| SD-1 | ADS-B multi-source dedup | AdsB (x3 sources) | 1000 | 60s | Tier 1 identity join, dedup |
| SD-2 | AIS shipping lane track | Ais | 500 | 120s | Track lifecycle (create/update/drop) |
| SD-3 | Radar coverage correlation | Radar | 300 | 60s | Spatial indexing, scan-rate processing |
| SD-4 | HTTP+DNS flow correlation | Http, Dns | 2000 | 30s | Tier 1 key join, temporal sequencing |
| SD-5 | STIX IOC matching | Cyber, Http, Dns | 500 | 30s | Pattern parsing, IOC match, flag generation |
| SD-6 | RF bearing triangulation | RfBearing (3 sensors) | 300 | 60s | Multilateration, emitter geolocation |
| SD-7 | OFAC sanctions screening | Financial, Ais | 200 | 30s | Tier 1 MMSI/name match, flag generation |
| SD-8 | ACLED conflict event ingest | Humint | 100 | 30s | Event dedup (Nats-Msg-Id), entity extraction |
| SD-9 | Seismic event processing | Masint | 50 | 30s | GeoJSON parsing, H3 spatial index |
| SD-10 | Social media normalization | Social (Mastodon) | 500 | 30s | Handle extraction, URL parsing |

### AVA.DS.8.5.2 Cross-Domain Scenarios

| ID | Scenario | SignalKinds | Messages | Duration | Validates |
|----|----------|------------|----------|----------|-----------|
| CD-1 | Air track fusion | AdsB, Radar, RfBearing | 2000 | 120s | Tier 1 (ICAO) + Tier 2 (spatial) fusion |
| CD-2 | Maritime surveillance | Ais, Radar, Satellite | 1500 | 120s | Multi-sensor vessel tracking |
| CD-3 | Cyber-kinetic correlation | Cyber, Http, AdsB | 1000 | 60s | Campaign IOC → network flow → aircraft track |
| CD-4 | Sanctioned entity tracking | Financial, AdsB, Ais | 500 | 60s | OFAC aircraft/vessel live tracking |
| CD-5 | OSINT enrichment chain | Osint, Financial, Ais | 300 | 60s | News → sanctions match → vessel track |
| CD-6 | RF spectrum fusion | Sdr, RfBearing, Sigint, Elint | 500 | 60s | Frequency correlation, emitter resolution |
| CD-7 | Environmental context | Masint, Geoint, Humint | 200 | 60s | Spatial correlation, contextual enrichment |
| CD-8 | Travel watchlist | Travel, Financial, AdsB | 300 | 60s | PNR screening → OFAC match → flight tracking |

### AVA.DS.8.5.3 Stress Scenarios

| ID | Scenario | Description | Messages | Duration | Validates |
|----|----------|-------------|----------|----------|-----------|
| ST-1 | Burst load | All 20 SignalKinds at max rate simultaneously | 50000 | 30s | Backpressure, no message loss |
| ST-2 | Sustained load | 10 SignalKinds at production rate for extended period | 100000 | 600s | Memory stability, no degradation |
| ST-3 | Late arrival | Messages published 30-120s after their timestamps | 1000 | 120s | Late arrival policy, window extension |
| ST-4 | Out-of-order | Messages published in random timestamp order | 1000 | 60s | Reordering, correct temporal joins |
| ST-5 | Duplicate messages | Same Nats-Msg-Id published 3x per message | 1000 | 30s | Deduplication, exactly-once processing |
| ST-6 | Schema evolution | Mix of v1 and v2 payload schemas | 500 | 30s | Forward compatibility, graceful degradation |

---

## AVA.DS.8.6 Coverage Matrix

This matrix shows which test scenarios exercise which fusion tiers and infrastructure:

| Scenario | Tier 1 | Tier 2 | Tier 3 | JetStream | KV | ObjectStore | Alarms |
|----------|--------|--------|--------|-----------|------|-------------|--------|
| SD-1 | X | | | SENSOR_KINETIC | | | |
| SD-2 | | | | SENSOR_KINETIC | ava-state | | |
| SD-3 | | X | | SENSOR_KINETIC | | | |
| SD-4 | X | | | SENSOR_CYBER | | | |
| SD-5 | X | | | SENSOR_CYBER | | | X |
| SD-6 | X | X | | SENSOR_RF | | | |
| SD-7 | X | | | SENSOR_OSINT, SENSOR_KINETIC | ava-state | | X |
| SD-8 | | | | SENSOR_GEO | | | |
| SD-9 | | X | | SENSOR_GEO | | | |
| SD-10 | | | | SENSOR_OSINT | | | |
| CD-1 | X | X | | SENSOR_KINETIC, SENSOR_RF | | | |
| CD-2 | | X | | SENSOR_KINETIC | | ava-blobs | |
| CD-3 | X | | X | SENSOR_CYBER, SENSOR_KINETIC | | | X |
| CD-4 | X | | | SENSOR_OSINT, SENSOR_KINETIC | ava-state | | X |
| CD-5 | | X | X | SENSOR_OSINT, SENSOR_KINETIC | ava-state | | |
| CD-6 | X | X | | SENSOR_RF | ava-ref-sigint, ava-ref-elint | ava-iq-samples | |
| CD-7 | | X | | SENSOR_GEO | | ava-geoint-raster | |
| CD-8 | X | | | SENSOR_OSINT, SENSOR_KINETIC | ava-state | | X |
| ST-1 | X | X | | ALL | ALL | ALL | X |
| ST-2 | X | X | | SENSOR_KINETIC, SENSOR_CYBER | ava-state | | |
| ST-3 | | X | | SENSOR_KINETIC | | | |
| ST-4 | X | X | | SENSOR_KINETIC | | | |
| ST-5 | X | | | SENSOR_GEO | | | |
| ST-6 | X | | | SENSOR_KINETIC | | | |

**Coverage summary**:
- Tier 1: 15/24 scenarios (63%)
- Tier 2: 13/24 scenarios (54%)
- Tier 3: 2/24 scenarios (8%)
- JetStream: All 7 streams covered
- KV: 4 buckets covered
- Object Store: 3 buckets covered
- Alarms: 6/24 scenarios (25%)

---

## AVA.DS.8.7 Spike Script Specification

The E2E spike script (`scripts/spike-nats-e2e.ts`) provides a minimal but
comprehensive infrastructure validation. It is the first executable test
artifact and validates that the NATS infrastructure provisioned by
[AVA.DS.6](rfc-section-ds-nats-taxonomy.md) is operational.

### AVA.DS.8.7.1 Test Sequence

1. **Connect** to NATS at `localhost:4222` with token auth
2. **Verify streams** -- all 7 JetStream streams exist with correct subject filters
3. **Verify KV buckets** -- all 4 KV buckets (`ava-config`, `ava-state`, `ava-metrics`, `ava-schemas`) exist
4. **Verify Object Store** -- `ava-blobs` bucket exists
5. **Publish test messages** -- 1 synthetic JSON message per SignalKind (20 total)
6. **Verify stream counts** -- each stream has the expected message count
7. **KV round-trip** -- put `entity.test001` -> get -> verify -> delete -> verify tombstone
8. **Object Store round-trip** -- put 1MB blob -> get -> verify SHA-256 -> delete
9. **Wildcard subscription** -- subscribe `sensor.adsb.>` -> publish -> receive -> verify
10. **Print summary** -- pass/fail per step with timing

### AVA.DS.8.7.2 Expected Stream Message Counts

| Stream | Expected Count | SignalKinds |
|--------|---------------|-------------|
| `SENSOR_KINETIC` | 4 | AdsB, Ais, Radar, Satellite |
| `SENSOR_RF` | 5 | RfBearing, Sdr, Sigint, Elint, Comint |
| `SENSOR_CYBER` | 3 | Http, Dns, Cyber |
| `SENSOR_OSINT` | 4 | Osint, Social, Financial, Travel |
| `SENSOR_GEO` | 3 | Geoint, Humint, Masint |
| `FUSION_RESULTS` | 0 | (no fusion in spike) |
| `ALARMS` | 0 | (no alarms in spike) |

**Note**: The Custom SignalKind message (`sensor.custom.operator.json`) is NOT
captured by any default stream. The spike script verifies this by publishing
the message and confirming no stream count increments -- validating AVA.3-R5
(no overlapping subjects, custom requires explicit stream).

---

*End of Section AVA.DS.8*


---

