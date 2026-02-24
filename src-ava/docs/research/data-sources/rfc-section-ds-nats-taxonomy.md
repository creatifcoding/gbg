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
