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
