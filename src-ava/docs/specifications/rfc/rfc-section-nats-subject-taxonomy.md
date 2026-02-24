# AVA.3 NATS Subject Taxonomy

```
Section:       AVA.3 — NATS Subject Taxonomy
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          I — Data Ingest (Normative)
Prerequisites: AVA.1 (Pipeline Architecture), AVA.2 (Signal Schema)
Feeds:         AVA.4 (Source Adapters), AVA.5 (JetStream Persistence)
```

> This section specifies the NATS subject namespace for the ava-fusion pipeline.
> Every sensor reading, fusion result, alarm notification, and control message
> flows through a hierarchical subject tree. The taxonomy maps 1:1 to the 20
> `SignalKind` variants defined in `ava-fusion/src/signal.rs` and supports
> wildcard subscriptions for multi-source ingest. The key words "MUST", "MUST
> NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED",
> "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted
> as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava31-conventions-and-terminology)
2.  [Subject Hierarchy Design](#ava32-subject-hierarchy-design)
3.  [Sensor Ingest Subjects](#ava33-sensor-ingest-subjects)
4.  [Fusion Output Subjects](#ava34-fusion-output-subjects)
5.  [Control Plane Subjects](#ava35-control-plane-subjects)
6.  [KV Bucket Naming](#ava36-kv-bucket-naming)
7.  [JetStream Stream Mapping](#ava37-jetstream-stream-mapping)
8.  [Wildcard Subscription Patterns](#ava38-wildcard-subscription-patterns)
9.  [Per-Domain Subject Catalogs](#ava39-per-domain-subject-catalogs)
10. [Normative Requirements Summary](#ava310-normative-requirements-summary)
11. [References](#ava311-references)

---

## AVA.3.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.3.1.1 Terminology

| Term | Definition |
|------|-----------|
| **Subject** | A NATS subject string using dot-delimited hierarchy (e.g., `sensor.adsb.raw`) |
| **SignalKind** | One of 20 sensor type discriminators from `ava-fusion/src/signal.rs` |
| **EntityClass** | One of 10 entity types from `ava-fusion/src/entity.rs` |
| **Source Adapter** | A component that connects to an external data source and publishes to NATS |
| **JetStream Stream** | A persistent, replayable NATS message stream |
| **KV Bucket** | A NATS JetStream key-value store |
| **Consumer** | A JetStream subscription with delivery guarantees |

### AVA.3.1.2 Subject Syntax

All subjects MUST conform to NATS subject syntax:
- Dot-delimited tokens: `level1.level2.level3`
- Tokens MUST match `[a-zA-Z0-9_-]+` (no spaces, no colons)
- Wildcards: `*` matches one token, `>` matches one or more tokens
- Maximum depth: 16 tokens (NATS server default)

---

## AVA.3.2 Subject Hierarchy Design

### AVA.3.2.1 Root Namespace

All ava-fusion subjects live under four root namespaces:

```
sensor.{kind}.{source}.{format}    # Inbound sensor data
fusion.{tier}.{entity_class}       # Fusion pipeline output
alarm.{severity}.{entity_class}    # Alarm notifications
ctl.{component}.{command}          # Control plane
```

### AVA.3.2.2 Design Principles

1. **SignalKind-first routing**: The second token after `sensor.` MUST be the
   lowercase SignalKind variant name. This enables `sensor.adsb.>` to capture
   all ADS-B data regardless of source or format.

2. **Source provenance**: The third token identifies the data source (e.g.,
   `opensky`, `noaa`, `abusech`). This enables per-source filtering.

3. **Format suffix**: The fourth token indicates payload encoding (e.g., `raw`,
   `json`, `csv`, `sigmf`, `stix`). This enables format-specific parsers.

4. **Entity-routed output**: Fusion results are routed by tier and entity class,
   enabling consumers to subscribe to specific tiers or entity types.

---

## AVA.3.3 Sensor Ingest Subjects

### AVA.3.3.1 Kinetic Domain

| SignalKind | Subject Pattern | Example | Format |
|------------|----------------|---------|--------|
| `AdsB` | `sensor.adsb.{source}.{fmt}` | `sensor.adsb.opensky.json` | OpenSky JSON state vector |
| | | `sensor.adsb.dump1090.raw` | SBS-1 BaseStation format |
| | | `sensor.adsb.adsbx.json` | ADSBexchange API format |
| `Ais` | `sensor.ais.{source}.{fmt}` | `sensor.ais.noaa.csv` | NOAA Marine Cadastre CSV |
| | | `sensor.ais.aishub.nmea` | Raw NMEA sentences |
| | | `sensor.ais.gfw.json` | Global Fishing Watch API |
| `Radar` | `sensor.radar.{source}.{fmt}` | `sensor.radar.swim.json` | FAA SWIM track data |
| | | `sensor.radar.nexrad.raw` | NOAA NEXRAD Level II |
| | | `sensor.radar.synthetic.json` | Generated test data |
| `Satellite` | `sensor.satellite.{source}.{fmt}` | `sensor.satellite.sentinel.geotiff` | Sentinel-2 imagery |
| | | `sensor.satellite.firms.json` | NASA FIRMS hotspots |
| | | `sensor.satellite.landsat.json` | USGS Landsat metadata |

**Normative**: All SensorIngestor actors MUST subscribe to `sensor.{kind}.>` for
their assigned SignalKind. The wildcard captures all sources and formats.

### AVA.3.3.2 RF/Signals Domain

| SignalKind | Subject Pattern | Example | Format |
|------------|----------------|---------|--------|
| `RfBearing` | `sensor.rfbearing.{source}.{fmt}` | `sensor.rfbearing.kiwisdr.json` | Bearing measurement |
| | | `sensor.rfbearing.synthetic.json` | Generated DF data |
| `Sdr` | `sensor.sdr.{source}.{fmt}` | `sensor.sdr.gnuradio.sigmf` | SigMF metadata + IQ ref |
| | | `sensor.sdr.rtlsdr.iq` | Raw IQ samples |
| | | `sensor.sdr.websdr.json` | WebSDR spectrum data |
| `Sigint` | `sensor.sigint.{source}.{fmt}` | `sensor.sigint.fcc.json` | FCC license DB records |
| | | `sensor.sigint.itu.json` | ITU frequency allocations |
| | | `sensor.sigint.synthetic.json` | Generated intercept reports |
| `Elint` | `sensor.elint.{source}.{fmt}` | `sensor.elint.ewdb.json` | EW parameter database |
| | | `sensor.elint.synthetic.json` | Generated emitter data |
| `Comint` | `sensor.comint.{source}.{fmt}` | `sensor.comint.synthetic.json` | Generated COMINT reports |

**Normative**: RF signal subjects carrying IQ sample references SHOULD use the
NATS Object Store for the actual sample data, with the subject message containing
only metadata and an object store reference key.

### AVA.3.3.3 Cyber/Network Domain

| SignalKind | Subject Pattern | Example | Format |
|------------|----------------|---------|--------|
| `Http` | `sensor.http.{source}.{fmt}` | `sensor.http.zeek.json` | Zeek http.log JSON |
| | | `sensor.http.pcap.json` | Parsed PCAP metadata |
| | | `sensor.http.cicids.csv` | CICIDS2017 dataset |
| `Dns` | `sensor.dns.{source}.{fmt}` | `sensor.dns.passive.json` | Passive DNS records |
| | | `sensor.dns.zeek.json` | Zeek dns.log JSON |
| | | `sensor.dns.tranco.csv` | Tranco top-1M list |
| `Cyber` | `sensor.cyber.{source}.{fmt}` | `sensor.cyber.mitre.stix` | MITRE ATT&CK STIX 2.1 |
| | | `sensor.cyber.otx.json` | AlienVault OTX pulses |
| | | `sensor.cyber.abusech.json` | abuse.ch IOCs |
| | | `sensor.cyber.cisa.json` | CISA KEV catalog |
| | | `sensor.cyber.misp.stix` | MISP feed STIX bundles |

**Normative**: STIX 2.1 bundles MUST be published with format token `stix`.
Non-STIX threat feeds MUST use `json`. This enables format-specific
deserialization at the subscriber bridge.

### AVA.3.3.4 OSINT/Social/Financial Domain

| SignalKind | Subject Pattern | Example | Format |
|------------|----------------|---------|--------|
| `Osint` | `sensor.osint.{source}.{fmt}` | `sensor.osint.gdelt.json` | GDELT events |
| | | `sensor.osint.gdelt.gkg` | GDELT Global Knowledge Graph |
| | | `sensor.osint.news.rss` | RSS feed items |
| | | `sensor.osint.wayback.json` | Wayback Machine CDX |
| `Social` | `sensor.social.{source}.{fmt}` | `sensor.social.mastodon.json` | Mastodon public timeline |
| | | `sensor.social.bluesky.json` | AT Protocol firehose |
| | | `sensor.social.reddit.json` | Reddit API/Pushshift |
| | | `sensor.social.github.json` | GitHub Events API |
| `Financial` | `sensor.financial.{source}.{fmt}` | `sensor.financial.ofac.json` | OFAC SDN list |
| | | `sensor.financial.opensanctions.json` | OpenSanctions entities |
| | | `sensor.financial.gleif.json` | LEI database records |
| | | `sensor.financial.edgar.json` | SEC EDGAR filings |
| `Travel` | `sensor.travel.{source}.{fmt}` | `sensor.travel.synthetic.json` | Generated PNR records |
| | | `sensor.travel.openflights.csv` | OpenFlights routes |

### AVA.3.3.5 GEOINT/HUMINT/MASINT Domain

| SignalKind | Subject Pattern | Example | Format |
|------------|----------------|---------|--------|
| `Geoint` | `sensor.geoint.{source}.{fmt}` | `sensor.geoint.osm.geojson` | OpenStreetMap features |
| | | `sensor.geoint.firms.json` | NASA FIRMS hotspots |
| | | `sensor.geoint.sentinel.json` | Sentinel analysis products |
| | | `sensor.geoint.ghsl.geotiff` | Global Human Settlement |
| `Humint` | `sensor.humint.{source}.{fmt}` | `sensor.humint.acled.json` | ACLED conflict events |
| | | `sensor.humint.reliefweb.json` | UN OCHA reports |
| | | `sensor.humint.synthetic.salute` | SALUTE format reports |
| `Masint` | `sensor.masint.{source}.{fmt}` | `sensor.masint.usgs.json` | USGS earthquake data |
| | | `sensor.masint.noaa.json` | NOAA buoy measurements |
| | | `sensor.masint.epa.json` | EPA AirNow readings |
| | | `sensor.masint.ctbto.json` | Seismic monitoring data |

### AVA.3.3.6 Custom Signal Kind

| SignalKind | Subject Pattern | Example | Format |
|------------|----------------|---------|--------|
| `Custom` | `sensor.custom.{source}.{fmt}` | `sensor.custom.operator.json` | Operator-defined |

**Normative**: Custom signal subjects MUST follow the same 4-token pattern.
The `source` token SHOULD identify the operator or system that produces the data.

---

## AVA.3.4 Fusion Output Subjects

### AVA.3.4.1 Fusion Results

```
fusion.{tier}.{entity_class}.results
```

| Tier | Subject | Description |
|------|---------|-------------|
| Tier 1 | `fusion.tier1.aircraft.results` | Hard-key identity matches (ICAO hex) |
| Tier 1 | `fusion.tier1.vessel.results` | Hard-key identity matches (MMSI) |
| Tier 1 | `fusion.tier1.networkhost.results` | Hard-key identity matches (IP) |
| Tier 2 | `fusion.tier2.aircraft.results` | Soft-key probabilistic correlations |
| Tier 2 | `fusion.tier2.vessel.results` | Soft-key spatial/temporal matches |
| Tier 3 | `fusion.tier3.rfemitter.results` | Derived statistical patterns |
| Tier 3 | `fusion.tier3.campaign.results` | Derived behavioral patterns |

**Normative**: Wildcard `fusion.tier1.>` MUST capture all Tier 1 results.
Wildcard `fusion.>.aircraft.>` MUST capture all aircraft results across tiers.

### AVA.3.4.2 Track Updates

```
fusion.tracks.{entity_class}.{event}
```

| Subject | Description |
|---------|-------------|
| `fusion.tracks.aircraft.created` | New track initiated |
| `fusion.tracks.aircraft.updated` | Track state updated |
| `fusion.tracks.aircraft.merged` | Tracks merged (identity resolution) |
| `fusion.tracks.aircraft.dropped` | Track dropped (coasting expired) |
| `fusion.tracks.vessel.created` | Maritime track initiated |

### AVA.3.4.3 Alarm Notifications

```
alarm.{severity}.{entity_class}
```

| Subject | Description |
|---------|-------------|
| `alarm.critical.aircraft` | Critical aircraft alarm (e.g., ADS-B spoofing) |
| `alarm.warning.vessel` | Warning vessel alarm (e.g., AIS gap > threshold) |
| `alarm.info.networkhost` | Informational network alarm |
| `alarm.absence.aircraft` | Absence detection alarm |

---

## AVA.3.5 Control Plane Subjects

```
ctl.{component}.{command}
```

| Subject | Description | Direction |
|---------|-------------|-----------|
| `ctl.pipeline.start` | Start the supervision tree | External → Pipeline |
| `ctl.pipeline.stop` | Graceful shutdown | External → Pipeline |
| `ctl.pipeline.status` | Request pipeline status | Request/Reply |
| `ctl.feeder.start` | Start data feeder | External → Feeder |
| `ctl.feeder.stop` | Stop data feeder | External → Feeder |
| `ctl.feeder.rate` | Set feeder publish rate | External → Feeder |
| `ctl.adapter.register` | Register new source adapter | External → Pipeline |
| `ctl.adapter.deregister` | Remove source adapter | External → Pipeline |

---

## AVA.3.6 KV Bucket Naming

| Bucket | Key Pattern | Value | Purpose |
|--------|------------|-------|---------|
| `ava-config` | `pipeline.{name}` | JSON PipelineConfig | Runtime configuration |
| `ava-config` | `joinpath.{id}` | JSON JoinPathEntryV2 | Join path definitions |
| `ava-state` | `entity.{entity_id}` | JSON EntityState | Latest entity state |
| `ava-state` | `track.{track_id}` | JSON TrackState | Latest track state |
| `ava-metrics` | `actor.{name}.stats` | JSON ActorMetrics | Actor performance counters |
| `ava-schemas` | `signal.{kind}` | JSON Schema | Signal payload schemas |

**Normative**: KV bucket keys MUST use dots (`.`) as separators.
Colons (`:`) are INVALID in NATS KV keys (they become NATS subjects internally).

---

## AVA.3.7 JetStream Stream Mapping

| Stream Name | Subjects | Retention | Max Age | Purpose |
|-------------|----------|-----------|---------|---------|
| `SENSOR_KINETIC` | `sensor.adsb.>`, `sensor.ais.>`, `sensor.radar.>`, `sensor.satellite.>` | Limits | 24h | Kinetic sensor replay |
| `SENSOR_RF` | `sensor.rfbearing.>`, `sensor.sdr.>`, `sensor.sigint.>`, `sensor.elint.>`, `sensor.comint.>` | Limits | 24h | RF signal replay |
| `SENSOR_CYBER` | `sensor.http.>`, `sensor.dns.>`, `sensor.cyber.>` | Limits | 72h | Cyber data replay |
| `SENSOR_OSINT` | `sensor.osint.>`, `sensor.social.>`, `sensor.financial.>`, `sensor.travel.>` | Limits | 72h | OSINT replay |
| `SENSOR_GEO` | `sensor.geoint.>`, `sensor.humint.>`, `sensor.masint.>` | Limits | 168h | Geo/human replay |
| `FUSION_RESULTS` | `fusion.>` | Limits | 168h | All fusion output |
| `ALARMS` | `alarm.>` | Interest | 720h | Alarm archive |

**Normative**: Each stream MUST capture exactly the subjects listed. Streams
MUST NOT overlap (a subject MUST belong to exactly one stream).

---

## AVA.3.8 Wildcard Subscription Patterns

### AVA.3.8.1 Ingest Wildcards (SensorIngestor actors)

| Actor | Subscription | Captures |
|-------|-------------|----------|
| SensorIngestor (ADS-B) | `sensor.adsb.>` | All ADS-B sources and formats |
| SensorIngestor (AIS) | `sensor.ais.>` | All AIS sources and formats |
| SensorIngestor (Cyber) | `sensor.cyber.>` | All cyber threat feeds |
| SensorIngestor (All) | `sensor.>` | Every sensor message (monitoring) |

### AVA.3.8.2 Output Wildcards (consumers)

| Use Case | Subscription | Captures |
|----------|-------------|----------|
| All Tier 1 results | `fusion.tier1.>` | All hard-key matches |
| All aircraft | `fusion.*.aircraft.>` | Aircraft across all tiers |
| All alarms | `alarm.>` | Every alarm notification |
| Critical alarms only | `alarm.critical.>` | Critical severity only |

---

## AVA.3.9 Per-Domain Subject Catalogs

Detailed data source specifications, including API endpoints, authentication,
data formats, rate limits, and cross-correlation opportunities, are documented
in the research data source catalogs:

| Domain | Catalog | SignalKinds |
|--------|---------|-------------|
| Kinetic | [kinetic-domain.md](../../research/data-sources/kinetic-domain.md) | AdsB, Ais, Radar, Satellite |
| RF/Signals | [rf-signals-domain.md](../../research/data-sources/rf-signals-domain.md) | RfBearing, Sdr, Sigint, Elint, Comint |
| Cyber/Network | [cyber-network-domain.md](../../research/data-sources/cyber-network-domain.md) | Http, Dns, Cyber |
| OSINT/Social/Financial | [osint-social-financial-domain.md](../../research/data-sources/osint-social-financial-domain.md) | Osint, Social, Financial, Travel |
| GEOINT/HUMINT/MASINT | [geoint-humint-masint-domain.md](../../research/data-sources/geoint-humint-masint-domain.md) | Geoint, Humint, Masint |

---

## AVA.3.10 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.3-R1 | All sensor subjects MUST follow `sensor.{kind}.{source}.{format}` pattern | MUST |
| AVA.3-R2 | The `{kind}` token MUST be the lowercase SignalKind variant name | MUST |
| AVA.3-R3 | Fusion output subjects MUST follow `fusion.{tier}.{entity_class}.results` | MUST |
| AVA.3-R4 | KV bucket keys MUST use dots as separators, MUST NOT use colons | MUST |
| AVA.3-R5 | JetStream streams MUST NOT have overlapping subject filters | MUST |
| AVA.3-R6 | STIX 2.1 bundles MUST use format token `stix` | MUST |
| AVA.3-R7 | IQ sample data SHOULD use Object Store with metadata-only subject messages | SHOULD |
| AVA.3-R8 | Custom signals MUST follow the 4-token sensor subject pattern | MUST |
| AVA.3-R9 | All subjects MUST conform to NATS subject syntax (`[a-zA-Z0-9_-]+` tokens) | MUST |
| AVA.3-R10 | SensorIngestor actors MUST subscribe to `sensor.{kind}.>` wildcards | MUST |

---

## AVA.3.11 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [NATS Subjects] https://docs.nats.io/nats-concepts/subjects
- [NATS JetStream] https://docs.nats.io/nats-concepts/jetstream
- [NATS KV] https://docs.nats.io/nats-concepts/jetstream/key-value-store
- [ava-fusion SignalKind] `ava-fusion/src/signal.rs` — 20 variants
- [ava-fusion EntityClass] `ava-fusion/src/entity.rs` — 10 variants

---

*End of section AVA.3*
