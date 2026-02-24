# Appendix C — Data Source Catalog

```
Section:       Appendix C — Data Source Catalog
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          Appendices (Informative)
Prerequisites: AVA.3 (NATS Subject Taxonomy), AVA.4 (Source Adapters)
```

> This appendix catalogs the concrete data sources referenced in the ava-fusion
> codebase and NATS subject taxonomy. Sources are organized by SignalKind domain.
> Each entry includes the source name, type (API, file, stream), data format,
> update frequency, and the NATS subject it maps to. Reference data sources
> are registered via the `ReferenceSource` struct (`ava-fusion/src/signal.rs:190-205`).

---

## Table of Contents

1. [Overview](#c1-overview)
2. [Kinetic Domain Sources](#c2-kinetic-domain-sources)
3. [RF/Signals Domain Sources](#c3-rfsignals-domain-sources)
4. [Cyber/Network Domain Sources](#c4-cybernetwork-domain-sources)
5. [OSINT/Social/Financial Domain Sources](#c5-osintsocialfinancial-domain-sources)
6. [GEOINT/HUMINT/MASINT Domain Sources](#c6-geointhumintmasint-domain-sources)
7. [Reference Source Registration](#c7-reference-source-registration)
8. [Domain Research Catalogs](#c8-domain-research-catalogs)

---

## C.1 Overview

Data sources fall into two categories per the `DataType` enum
(`ava-fusion/src/signal.rs:128-133`):

- **Event sources**: Volatile, append-only, timestamped streams. Ingested as
  differential-dataflow collections.
- **Reference sources**: Stable, slowly-changing lookup data. Materialized as
  differential-dataflow arrangements for O(1) joins.

All source examples below are extracted from the NATS subject taxonomy
([AVA.3](rfc-section-nats-subject-taxonomy.md)) and the `ReferenceSource`
struct definition.

---

## C.2 Kinetic Domain Sources

### ADS-B (`sensor.adsb.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| OpenSky Network | API | JSON state vector | `sensor.adsb.opensky.json` | ~5s | Public ADS-B aggregator; REST + WebSocket |
| dump1090 | Stream | SBS-1 BaseStation | `sensor.adsb.dump1090.raw` | ~1s | Local RTL-SDR receiver; TCP port 30003 |
| ADSBexchange | API | JSON | `sensor.adsb.adsbx.json` | ~2s | Community-run ADS-B exchange |

### AIS (`sensor.ais.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| NOAA Marine Cadastre | File | CSV | `sensor.ais.noaa.csv` | Daily | Historical AIS bulk data |
| AISHub | Stream | NMEA | `sensor.ais.aishub.nmea` | ~2-30s | Real-time AIS sharing network |
| Global Fishing Watch | API | JSON | `sensor.ais.gfw.json` | Hourly | Fishing vessel tracking |

### Radar (`sensor.radar.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| FAA SWIM | API | JSON track data | `sensor.radar.swim.json` | ~4-12s | System Wide Information Management |
| NOAA NEXRAD | File | Level II binary | `sensor.radar.nexrad.raw` | ~5min | Weather radar (dual-use) |
| Synthetic | Generator | JSON | `sensor.radar.synthetic.json` | Configurable | Test data generator |

### Satellite (`sensor.satellite.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| Copernicus Sentinel-2 | File | GeoTIFF | `sensor.satellite.sentinel.geotiff` | ~5 days | ESA multispectral imagery |
| NASA FIRMS | API | JSON hotspots | `sensor.satellite.firms.json` | ~3h | Fire Information for Resource Management |
| USGS Landsat | API | JSON metadata | `sensor.satellite.landsat.json` | ~16 days | USGS Earth observation |

---

## C.3 RF/Signals Domain Sources

### RF Bearing (`sensor.rfbearing.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| KiwiSDR | API | JSON bearing | `sensor.rfbearing.kiwisdr.json` | Seconds | Web-based SDR with DF capability |
| Synthetic DF | Generator | JSON | `sensor.rfbearing.synthetic.json` | Configurable | Test direction-finding data |

### SDR (`sensor.sdr.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| GNU Radio | Stream | SigMF | `sensor.sdr.gnuradio.sigmf` | Continuous | SigMF metadata + IQ reference |
| RTL-SDR | Stream | IQ samples | `sensor.sdr.rtlsdr.iq` | Continuous | Raw IQ via Object Store |
| WebSDR | API | JSON spectrum | `sensor.sdr.websdr.json` | Seconds | Web-accessible SDR spectrum |

### SIGINT (`sensor.sigint.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| FCC License DB | File/API | JSON | `sensor.sigint.fcc.json` | Daily (ref) | FCC ULS license database |
| ITU Frequency Allocations | File | JSON | `sensor.sigint.itu.json` | Static (ref) | ITU Radio Regulations |
| Synthetic | Generator | JSON | `sensor.sigint.synthetic.json` | Configurable | Generated intercept reports |

### ELINT (`sensor.elint.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| EW Parameter DB | File | JSON | `sensor.elint.ewdb.json` | Static (ref) | Electronic warfare parameter database |
| Synthetic | Generator | JSON | `sensor.elint.synthetic.json` | Configurable | Generated emitter data |

### COMINT (`sensor.comint.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| Synthetic | Generator | JSON | `sensor.comint.synthetic.json` | Configurable | Generated COMINT reports |

---

## C.4 Cyber/Network Domain Sources

### HTTP (`sensor.http.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| Zeek http.log | Stream | JSON | `sensor.http.zeek.json` | Continuous | Network security monitor |
| PCAP metadata | File | JSON | `sensor.http.pcap.json` | Batch | Parsed packet capture |
| CICIDS2017 | File | CSV | `sensor.http.cicids.csv` | Static (ref) | Intrusion detection dataset |

### DNS (`sensor.dns.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| Passive DNS | Stream | JSON | `sensor.dns.passive.json` | Continuous | Passive DNS collection |
| Zeek dns.log | Stream | JSON | `sensor.dns.zeek.json` | Continuous | DNS event logging |
| Tranco Top-1M | File | CSV | `sensor.dns.tranco.csv` | Daily (ref) | Domain popularity ranking |

### Cyber (`sensor.cyber.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| MITRE ATT&CK | API | STIX 2.1 | `sensor.cyber.mitre.stix` | Daily (ref) | Adversary TTPs |
| AlienVault OTX | API | JSON pulses | `sensor.cyber.otx.json` | Hourly | Open Threat Exchange |
| abuse.ch | API | JSON IOCs | `sensor.cyber.abusech.json` | Hourly | Malware/botnet trackers |
| CISA KEV | API | JSON | `sensor.cyber.cisa.json` | Daily (ref) | Known Exploited Vulnerabilities |
| MISP feeds | Stream | STIX 2.1 | `sensor.cyber.misp.stix` | Hourly | MISP community feeds |

---

## C.5 OSINT/Social/Financial Domain Sources

### OSINT (`sensor.osint.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| GDELT Events | API | JSON | `sensor.osint.gdelt.json` | 15min | Global event monitoring |
| GDELT GKG | API | GKG format | `sensor.osint.gdelt.gkg` | 15min | Global Knowledge Graph |
| News RSS | Stream | RSS/XML | `sensor.osint.news.rss` | Minutes | RSS feed aggregation |
| Wayback Machine | API | JSON CDX | `sensor.osint.wayback.json` | On-demand | Internet Archive CDX API |

### Social (`sensor.social.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| Mastodon | API | JSON | `sensor.social.mastodon.json` | Continuous | Public timeline streaming |
| Bluesky (AT Protocol) | Stream | JSON | `sensor.social.bluesky.json` | Continuous | Firehose subscription |
| Reddit | API | JSON | `sensor.social.reddit.json` | Minutes | Subreddit monitoring |
| GitHub Events | API | JSON | `sensor.social.github.json` | Seconds | GitHub Events API |

### Financial (`sensor.financial.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| OFAC SDN | File | JSON | `sensor.financial.ofac.json` | Daily (ref) | Specially Designated Nationals |
| OpenSanctions | API | JSON | `sensor.financial.opensanctions.json` | Daily (ref) | Sanctions aggregator |
| GLEIF LEI | API | JSON | `sensor.financial.gleif.json` | Daily (ref) | Legal Entity Identifiers |
| SEC EDGAR | API | JSON | `sensor.financial.edgar.json` | Daily | SEC filings |

### Travel (`sensor.travel.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| Synthetic PNR | Generator | JSON | `sensor.travel.synthetic.json` | Configurable | Generated PNR records |
| OpenFlights | File | CSV | `sensor.travel.openflights.csv` | Static (ref) | Flight routes database |

---

## C.6 GEOINT/HUMINT/MASINT Domain Sources

### GEOINT (`sensor.geoint.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| OpenStreetMap | File/API | GeoJSON | `sensor.geoint.osm.geojson` | Daily (ref) | Volunteered geographic data |
| NASA FIRMS | API | JSON | `sensor.geoint.firms.json` | ~3h | Fire hotspot detection |
| Sentinel Analysis | API | JSON | `sensor.geoint.sentinel.json` | ~5 days | Derived imagery products |
| GHSL | File | GeoTIFF | `sensor.geoint.ghsl.geotiff` | Static (ref) | Global Human Settlement Layer |

### HUMINT (`sensor.humint.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| ACLED | API | JSON | `sensor.humint.acled.json` | Daily | Armed Conflict Location & Event Data |
| ReliefWeb | API | JSON | `sensor.humint.reliefweb.json` | Daily | UN OCHA humanitarian reports |
| Synthetic SALUTE | Generator | SALUTE format | `sensor.humint.synthetic.salute` | Configurable | SALUTE-formatted reports |

### MASINT (`sensor.masint.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| USGS Earthquakes | API | JSON | `sensor.masint.usgs.json` | Minutes | USGS earthquake monitoring |
| NOAA Buoys | API | JSON | `sensor.masint.noaa.json` | Minutes | NOAA buoy measurements |
| EPA AirNow | API | JSON | `sensor.masint.epa.json` | Hourly | Air quality monitoring |
| CTBTO | Stream | JSON | `sensor.masint.ctbto.json` | Continuous | Seismic/radionuclide monitoring |

---

## C.7 Reference Source Registration

Reference data sources are registered in the fusion ontology via the
`ReferenceSource` struct (`ava-fusion/src/signal.rs:190-205`):

```
ReferenceSource {
    id:            String,        // Unique source identifier (e.g. "faa-registry")
    signal_kind:   String,        // Signal kind produced (e.g. "faa-db")
    entity_class:  String,        // Entity class described (e.g. "Aircraft")
    key_field:     String,        // Primary key for lookups (e.g. "icao_hex")
    update_rate:   UpdateRate,    // Refresh cadence
    nats_subject:  String,        // NATS subject pattern
    ttl_seconds:   f64,           // Time-to-live before staleness
}
```

Example registration from test (`ava-fusion/src/signal.rs:297-305`):

| Field | Value |
|-------|-------|
| `id` | `"faa-registry"` |
| `signal_kind` | `"faa-db"` |
| `entity_class` | `"Aircraft"` |
| `key_field` | `"icao_hex"` |
| `update_rate` | `Daily` |
| `nats_subject` | `"tsingou.ref.faa.*"` |
| `ttl_seconds` | `86400.0` (24h) |

---

## C.8 Domain Research Catalogs

Detailed per-domain data source specifications (API endpoints, authentication,
rate limits, data formats, and cross-correlation opportunities) are documented
in the research catalogs referenced from
[AVA.3.9](rfc-section-nats-subject-taxonomy.md#ava39-per-domain-subject-catalogs):

| Domain | Catalog Path | SignalKinds Covered |
|--------|-------------|---------------------|
| Kinetic | `docs/research/data-sources/kinetic-domain.md` | AdsB, Ais, Radar, Satellite |
| RF/Signals | `docs/research/data-sources/rf-signals-domain.md` | RfBearing, Sdr, Sigint, Elint, Comint |
| Cyber/Network | `docs/research/data-sources/cyber-network-domain.md` | Http, Dns, Cyber |
| OSINT/Social/Financial | `docs/research/data-sources/osint-social-financial-domain.md` | Osint, Social, Financial, Travel |
| GEOINT/HUMINT/MASINT | `docs/research/data-sources/geoint-humint-masint-domain.md` | Geoint, Humint, Masint |

---

*Source: `ava-fusion/src/signal.rs` (337 lines) for ReferenceSource and
DataType definitions; `rfc-section-nats-subject-taxonomy.md` for NATS subject
examples; domain research catalogs for extended source details.*

*End of Appendix C*
