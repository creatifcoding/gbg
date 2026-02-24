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
