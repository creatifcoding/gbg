# TSG-RFC-002 Section: SigMF Codec

```
Section:       SigMF Codec
Section ID:    TSG.18
Parent RFC:    TSG-RFC-002 (Tsingou SIGINT Visualization Platform)
Part:          IV -- SDR & RF Integration (Normative)
Status:        DRAFT
Author:        Val (sdr-analyst)
Created:       2026-02-18
Research Base: research-sdr-hardware-ecosystem.md (1,019 lines),
               SigMF Specification v1.2.0 (https://github.com/sigmf/SigMF)
Codebase Refs: src/lib/tsingou-flow/schemas/base-signal.ts (159 lines),
               src/lib/tsingou-flow/adapters/HolonetBridgeAdapter.ts (277 lines),
               docs/tsingou/adr/ADR-011-sdr-gnu-radio-bridge.md (125 lines)
```

> This section specifies the Signal Metadata Format (SigMF) codec for the Tsingou
> SIGINT visualization platform. It establishes the SigMF data model, the
> BaseSignal-to-SigMF codec for bidirectional conversion, recording lifecycle
> management, annotation schema, capture segment handling, and the Effect-TS
> service contract for SigMF I/O operations. The key words "MUST", "MUST NOT",
> "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED",
> "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted
> as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [TSG.18.1 Scope and Motivation](#tsg181-scope-and-motivation)
2. [TSG.18.2 SigMF Specification Overview](#tsg182-sigmf-specification-overview)
3. [TSG.18.3 SigMF Data Model](#tsg183-sigmf-data-model)
4. [TSG.18.4 Global Object](#tsg184-global-object)
5. [TSG.18.5 Capture Segments](#tsg185-capture-segments)
6. [TSG.18.6 Annotations](#tsg186-annotations)
7. [TSG.18.7 SigMF Dataset Formats](#tsg187-sigmf-dataset-formats)
8. [TSG.18.8 SigMF Archive Format](#tsg188-sigmf-archive-format)
9. [TSG.18.9 BaseSignal-to-SigMF Codec](#tsg189-basesignal-to-sigmf-codec)
10. [TSG.18.10 Effect-TS Service Contract](#tsg1810-effect-ts-service-contract)
11. [TSG.18.11 Recording Lifecycle](#tsg1811-recording-lifecycle)
12. [TSG.18.12 Extension Namespaces](#tsg1812-extension-namespaces)
13. [TSG.18.13 NATS Subject Taxonomy for SigMF](#tsg1813-nats-subject-taxonomy-for-sigmf)
14. [TSG.18.14 Storage and Retrieval Patterns](#tsg1814-storage-and-retrieval-patterns)
15. [TSG.18.15 Normative Requirements Summary](#tsg1815-normative-requirements-summary)
16. [TSG.18.16 References](#tsg1816-references)

---

## TSG.18.1 Scope and Motivation

### TSG.18.1.1 Purpose

SigMF (Signal Metadata Format) [SIGMF] is the industry-standard metadata
format for describing recorded RF signal datasets. It provides a structured,
machine-readable way to describe what was captured, how it was captured, and
where within the captured data interesting events occur.

Tsingou integrates SigMF for three primary purposes:

1. **Recording**: Persistently store IQ recordings from SDR devices with
   complete provenance metadata, enabling replay and offline analysis.

2. **Interchange**: Exchange recorded signal data with external tools
   (GNU Radio, MATLAB, SciPy, inspectrum, Universal Radio Hacker) using a
   universally supported format.

3. **Annotation**: Attach analysis results (signal detections, protocol
   identifications, anomalies) to specific regions of recorded data, creating
   a layered, enrichable signal archive.

### TSG.18.1.2 Relationship to Other Sections

```
TSG.16 (SDR Hardware)
    |
    | IQ samples + device metadata
    v
TSG.18 (SigMF Codec) <-------> External Tools (GNU Radio, MATLAB, etc.)
    |
    | BaseSignal conversion
    v
TSG.7 (Signal Pipeline / d2ts)
    |
    | Analysis results (annotations)
    v
TSG.18 (SigMF Codec) --------> SigMF Archive (.sigmf)
```

SigMF operates at the boundary between Tsingou and the external signal
recording ecosystem. The codec translates between the Tsingou-native BaseSignal
schema (TSG.8) and the SigMF metadata format, preserving complete provenance
through bidirectional conversion.

### TSG.18.1.3 Design Philosophy

Implementations MUST treat SigMF as a first-class interchange format, not an
afterthought export. This means:

- Recording metadata MUST be captured at acquisition time, not reconstructed
  after the fact
- SigMF global, capture, and annotation objects MUST be populated from live
  device telemetry (center frequency, sample rate, gain settings) as reported
  by the SDR sidecar process
- Annotations created by Tsingou analysis MUST use the SigMF annotation
  schema, enabling round-trip compatibility with external tools

---

## TSG.18.2 SigMF Specification Overview

### TSG.18.2.1 Specification Version

This section is normative against SigMF Specification v1.2.0 [SIGMF]. Where
the SigMF specification permits implementation choices, this section selects
specific options appropriate for the Tsingou platform.

### TSG.18.2.2 File Structure

A SigMF recording consists of two or three files sharing a common base name:

```
recording.sigmf-meta    ← JSON metadata (REQUIRED)
recording.sigmf-data    ← Binary IQ samples (REQUIRED)
recording.sigmf-archive ← tar archive of both (OPTIONAL)
```

| File | Extension | Format | Required | Description |
|------|-----------|--------|----------|-------------|
| Metadata | `.sigmf-meta` | JSON (UTF-8) | MUST | Global, captures, annotations |
| Dataset | `.sigmf-data` | Binary | MUST | Raw IQ samples |
| Archive | `.sigmf` | tar (uncompressed) | MAY | Portable bundle |

Implementations MUST use the `.sigmf-meta` extension for metadata files.
Implementations MUST use the `.sigmf-data` extension for dataset files.
The two files MUST share the same base name (e.g., `recording.sigmf-meta`
and `recording.sigmf-data`).

### TSG.18.2.3 Metadata Structure

The metadata file is a JSON object with exactly three top-level keys:

```json
{
  "global": { ... },
  "captures": [ ... ],
  "annotations": [ ... ]
}
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `global` | object | MUST | Recording-level metadata |
| `captures` | array | MUST | Array of capture segment objects |
| `annotations` | array | MUST | Array of annotation objects |

All three keys MUST be present, even if `captures` or `annotations` arrays
are empty.

---

## TSG.18.3 SigMF Data Model

### TSG.18.3.1 Core Namespace

SigMF defines a `core` namespace of standardized fields. All field names are
prefixed with `core:` in the metadata JSON. The namespace prefix is REQUIRED
for all core fields.

### TSG.18.3.2 Data Types

SigMF metadata values use the following data types:

| SigMF Type | JSON Type | Description | Example |
|------------|-----------|-------------|---------|
| `string` | string | UTF-8 text | `"RTL-SDR v4"` |
| `double` | number | IEEE 754 double | `433920000.0` |
| `uint` | number | Non-negative integer | `2400000` |
| `int` | number | Signed integer | `-40` |
| `boolean` | boolean | true/false | `true` |
| `datetime` | string | ISO 8601 / RFC 3339 | `"2026-02-18T12:00:00.000Z"` |

### TSG.18.3.3 Sample Counting Convention

SigMF uses zero-based sample indexing throughout:

- Sample 0 is the first sample in the dataset file
- `core:sample_start` in captures and annotations refers to the absolute
  sample offset from the beginning of the dataset
- `core:sample_count` in annotations specifies the number of samples covered

The relationship between byte offset and sample index is:

```
byte_offset = sample_index * bytes_per_sample

Where:
  bytes_per_sample = bits_per_component / 8 * 2  (for complex formats)
  bytes_per_sample = bits_per_component / 8      (for real formats)
```

For common SDR formats:

| Format | Bits/Component | Bytes/Sample | 1M Samples = |
|--------|---------------|-------------|-------------|
| `cu8` | 8 | 2 | 2 MB |
| `ci8` | 8 | 2 | 2 MB |
| `ci16_le` | 16 | 4 | 4 MB |
| `cf32_le` | 32 | 8 | 8 MB |
| `cf64_le` | 64 | 16 | 16 MB |

---

## TSG.18.4 Global Object

### TSG.18.4.1 Required Fields

The global object MUST contain the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `core:datatype` | string | Sample format descriptor (see TSG.18.7) |
| `core:version` | string | SigMF spec version (`"1.2.0"`) |

### TSG.18.4.2 Recommended Fields

Implementations SHOULD populate the following fields when information is
available from the SDR device or sidecar process:

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `core:sample_rate` | double | Sample rate in samples/sec | SDR device config |
| `core:description` | string | Human-readable description | User or auto-generated |
| `core:author` | string | Recording author | User config |
| `core:license` | string | License identifier (SPDX) | User config |
| `core:hw` | string | Hardware description | SDR device type/serial |
| `core:recorder` | string | Recording software name | `"tsingou-sdr-sidecar/1.0"` |
| `core:geolocation` | object | GeoJSON Point | GPS if available |
| `core:sha512` | string | SHA-512 hash of dataset file | Post-recording computation |
| `core:offset` | uint | Offset of first sample in dataset | 0 for simple recordings |
| `core:num_channels` | uint | Number of interleaved channels | 1 for single, 2 for MIMO |
| `core:trailing_bytes` | uint | Bytes after last sample | 0 for clean recordings |
| `core:metadata_only` | boolean | No associated dataset | false for recordings |

### TSG.18.4.3 Geolocation

When the SDR receiver location is known (via GPS, manual entry, or network
geolocation), the `core:geolocation` field SHOULD be populated as a GeoJSON
Point object [RFC7946]:

```json
{
  "core:geolocation": {
    "type": "Point",
    "coordinates": [-74.0060, 40.7128, 10.0]
  }
}
```

The coordinates array contains `[longitude, latitude, altitude]` where
altitude is in meters above the WGS-84 reference ellipsoid and is OPTIONAL.

### TSG.18.4.4 Example Global Object

```json
{
  "core:datatype": "cu8",
  "core:version": "1.2.0",
  "core:sample_rate": 2400000,
  "core:description": "433 MHz ISM band scan — RTL-SDR v4",
  "core:author": "Tsingou Operator",
  "core:license": "CC-BY-4.0",
  "core:hw": "RTL-SDR v4 (R828D), serial 00000001",
  "core:recorder": "tsingou-sdr-sidecar/1.0.0",
  "core:geolocation": {
    "type": "Point",
    "coordinates": [-74.0060, 40.7128]
  },
  "core:offset": 0,
  "core:num_channels": 1,
  "core:trailing_bytes": 0,
  "core:metadata_only": false
}
```

### TSG.18.4.5 Tsingou Extension Fields

Tsingou defines an extension namespace `tsingou:` for platform-specific
metadata that has no SigMF core equivalent:

| Field | Type | Description |
|-------|------|-------------|
| `tsingou:session_id` | string | Tsingou recording session identifier |
| `tsingou:device_id` | string | Sidecar device identifier |
| `tsingou:pipeline_version` | string | Tsingou pipeline version |
| `tsingou:fft_config` | object | FFT configuration used during recording |
| `tsingou:nats_subject` | string | NATS subject the data was published to |
| `tsingou:gain_db` | double | Configured gain in dB |
| `tsingou:bias_tee` | boolean | Whether bias-tee was enabled |
| `tsingou:ppm_correction` | int | Frequency correction in PPM |

Extension fields are OPTIONAL and MUST use the `tsingou:` namespace prefix.

---

## TSG.18.5 Capture Segments

### TSG.18.5.1 Purpose

Capture segments describe contiguous blocks of samples within the dataset.
Each segment begins at a specific sample index and describes the RF
configuration active during that segment. A new capture segment is created
whenever the RF configuration changes (retune, gain change, etc.).

### TSG.18.5.2 Required Fields

Each capture object MUST contain:

| Field | Type | Description |
|-------|------|-------------|
| `core:sample_start` | uint | Absolute sample index where this segment begins |

### TSG.18.5.3 Optional Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `core:frequency` | double | Center frequency in Hz | SDR tuner |
| `core:datetime` | datetime | ISO 8601 timestamp of segment start | System clock or GPS |
| `core:global_index` | uint | Globally unique sample counter | For multi-file recordings |
| `core:header_bytes` | uint | Non-sample bytes before this segment | Usually 0 |

### TSG.18.5.4 Capture Segment Semantics

Capture segments are ordered by `core:sample_start` and partition the dataset:

```
Dataset (binary):
  [--- Segment 0 ---][--- Segment 1 ---][--- Segment 2 ---]
  sample_start=0      sample_start=N     sample_start=M

Metadata (JSON):
  "captures": [
    { "core:sample_start": 0, "core:frequency": 433920000 },
    { "core:sample_start": N, "core:frequency": 462000000 },
    { "core:sample_start": M, "core:frequency": 433920000 }
  ]
```

Each segment's configuration applies from `core:sample_start` until the
next segment's `core:sample_start` (or end of dataset for the last segment).

A recording MUST contain at least one capture segment with
`core:sample_start` equal to 0.

### TSG.18.5.5 Multi-Frequency Recording

When the SDR sidecar performs frequency hopping or scanning, each frequency
dwell creates a new capture segment:

```json
{
  "captures": [
    {
      "core:sample_start": 0,
      "core:frequency": 433920000,
      "core:datetime": "2026-02-18T12:00:00.000Z"
    },
    {
      "core:sample_start": 2400000,
      "core:frequency": 462562500,
      "core:datetime": "2026-02-18T12:00:01.000Z"
    },
    {
      "core:sample_start": 4800000,
      "core:frequency": 433920000,
      "core:datetime": "2026-02-18T12:00:02.000Z"
    }
  ]
}
```

This example shows a 1-second dwell per frequency at 2.4 MSPS (2,400,000
samples per second). The sidecar MUST create new capture segments on each
retune operation and MUST include the `core:frequency` field.

### TSG.18.5.6 Timestamping

Implementations SHOULD include `core:datetime` in every capture segment.
When a GPS-disciplined oscillator is available (USRP GPSDO), the timestamp
SHOULD be derived from GPS time. Otherwise, the system clock SHOULD be used
with NTP synchronization.

Timestamp precision MUST be at least millisecond. Microsecond precision is
RECOMMENDED when the platform supports it.

---

## TSG.18.6 Annotations

### TSG.18.6.1 Purpose

Annotations attach metadata to specific regions of the recorded signal data.
They describe what is present in a given time-frequency window: signal
detections, protocol identifications, modulation classifications, anomaly
markers, or any other analysis result.

Annotations are the primary mechanism by which Tsingou analysis results
enrich recorded signal data.

### TSG.18.6.2 Required Fields

Each annotation object MUST contain:

| Field | Type | Description |
|-------|------|-------------|
| `core:sample_start` | uint | First sample index of the annotation |
| `core:sample_count` | uint | Number of samples covered |

### TSG.18.6.3 Optional Core Fields

| Field | Type | Description |
|-------|------|-------------|
| `core:freq_lower_edge` | double | Lower frequency bound in Hz |
| `core:freq_upper_edge` | double | Upper frequency bound in Hz |
| `core:label` | string | Short human-readable label |
| `core:comment` | string | Free-text description |
| `core:generator` | string | Tool/algorithm that created this annotation |
| `core:uuid` | string | Globally unique annotation identifier |

### TSG.18.6.4 Time-Frequency Annotation Windows

Annotations describe rectangular regions in the time-frequency plane:

```
Frequency
    ^
    |  ┌───────────────────────┐  freq_upper_edge
    |  │                       │
    |  │    ANNOTATION         │
    |  │    (label, comment)   │
    |  │                       │
    |  └───────────────────────┘  freq_lower_edge
    |  ^                       ^
    |  sample_start            sample_start + sample_count
    └──────────────────────────────────────────────> Time (samples)
```

When `core:freq_lower_edge` and `core:freq_upper_edge` are omitted, the
annotation applies to the full bandwidth of the recording.

### TSG.18.6.5 Annotation Layering

Multiple annotations MAY overlap in time, frequency, or both. This enables
layered analysis where different detectors annotate the same region:

```json
{
  "annotations": [
    {
      "core:sample_start": 0,
      "core:sample_count": 48000,
      "core:freq_lower_edge": 433800000,
      "core:freq_upper_edge": 434050000,
      "core:label": "ISM-device",
      "core:generator": "rtl_433/23.01"
    },
    {
      "core:sample_start": 0,
      "core:sample_count": 48000,
      "core:freq_lower_edge": 433800000,
      "core:freq_upper_edge": 434050000,
      "core:label": "OOK-modulation",
      "core:generator": "tsingou-modclassifier/1.0"
    },
    {
      "core:sample_start": 12000,
      "core:sample_count": 24000,
      "core:label": "anomaly:power-spike",
      "core:generator": "tsingou-anomaly-detector/1.0",
      "core:comment": "Unexpected 12 dB power increase"
    }
  ]
}
```

### TSG.18.6.6 Tsingou Annotation Extensions

Tsingou defines extension fields for analysis-specific annotation metadata:

| Field | Type | Description |
|-------|------|-------------|
| `tsingou:signal_kind` | string | BaseSignal kind identifier |
| `tsingou:confidence` | double | Detection confidence (0.0-1.0) |
| `tsingou:protocol` | string | Identified protocol name |
| `tsingou:modulation` | string | Identified modulation type |
| `tsingou:snr_db` | double | Measured signal-to-noise ratio |
| `tsingou:bandwidth_hz` | double | Measured signal bandwidth |
| `tsingou:duration_sec` | double | Signal duration in seconds |
| `tsingou:stix_indicator_id` | string | Linked STIX indicator (see TSG.13) |
| `tsingou:d2ts_version` | string | d2ts pipeline version at annotation time |

### TSG.18.6.7 Annotation from d2ts Pipeline

When the d2ts signal pipeline (TSG.7) detects a signal of interest, it
SHOULD emit a SigMF annotation object through the annotation service:

```
d2ts pipeline
    |
    | SignalDetection event
    v
AnnotationService
    |
    | Creates SigMF annotation
    v
SigMF metadata file (appended to annotations array)
```

The annotation service MUST calculate `core:sample_start` and
`core:sample_count` from the detection timestamp and the recording's sample
rate:

```
sample_start = floor((detection_time - recording_start_time) * sample_rate)
sample_count = floor(detection_duration * sample_rate)
```

---

## TSG.18.7 SigMF Dataset Formats

### TSG.18.7.1 Datatype String Syntax

The `core:datatype` field uses a structured string format:

```
<type_prefix><bit_width>[_<endianness>]
```

Where:
- `type_prefix` indicates real/complex and signed/unsigned:

| Prefix | Meaning | Components per Sample |
|--------|---------|----------------------|
| `r` | Real | 1 (I only) |
| `c` | Complex | 2 (I + Q) |
| `u` | Unsigned integer | — |
| `i` | Signed integer | — |
| `f` | IEEE 754 float | — |

- `bit_width` is bits per component (not per sample)
- `_le` or `_be` suffix for endianness (REQUIRED for multi-byte types)

### TSG.18.7.2 Complete Datatype Reference

| Datatype String | Description | Bytes/Sample | Value Range | SDR Device |
|-----------------|-------------|-------------|-------------|------------|
| `cu8` | Complex unsigned 8-bit | 2 | I,Q: 0-255 | RTL-SDR |
| `ci8` | Complex signed 8-bit | 2 | I,Q: -128..127 | HackRF One |
| `ci16_le` | Complex signed 16-bit LE | 4 | I,Q: -32768..32767 | USRP, PlutoSDR |
| `ci16_be` | Complex signed 16-bit BE | 4 | I,Q: -32768..32767 | (rare) |
| `ci32_le` | Complex signed 32-bit LE | 8 | I,Q: -2^31..2^31-1 | (rare) |
| `cf32_le` | Complex float 32-bit LE | 8 | I,Q: IEEE 754 single | GNU Radio |
| `cf64_le` | Complex float 64-bit LE | 16 | I,Q: IEEE 754 double | MATLAB |
| `ru8` | Real unsigned 8-bit | 1 | 0-255 | AM demod output |
| `ri16_le` | Real signed 16-bit LE | 2 | -32768..32767 | Audio recordings |
| `rf32_le` | Real float 32-bit LE | 4 | IEEE 754 single | DSP output |

### TSG.18.7.3 Endianness

Multi-byte types MUST specify endianness explicitly:

- `_le`: Little-endian (x86/x86-64, ARM little-endian). RECOMMENDED default.
- `_be`: Big-endian (network byte order, some FPGA outputs).

Single-byte types (`cu8`, `ci8`, `ru8`, `ri8`) do not require endianness
suffixes.

Implementations MUST default to little-endian when writing new recordings on
x86/x86-64 and ARM platforms. Implementations MUST correctly handle both
endianness values when reading.

### TSG.18.7.4 Format Conversion

When converting between SigMF datatypes, implementations MUST use the
conversion formulas specified in TSG.16.7.4. The datatype string in the
SigMF metadata MUST match the actual binary format of the dataset file.

Implementations MUST NOT modify the dataset file without updating the
`core:datatype` field. If format conversion is performed (e.g., `cu8` to
`cf32_le` for analysis), a new SigMF recording with the converted datatype
MUST be created rather than modifying the original.

### TSG.18.7.5 Tsingou Default Format

For recordings initiated by the Tsingou sidecar:

| Recording Scenario | Default Datatype | Rationale |
|-------------------|-----------------|-----------|
| RTL-SDR raw capture | `cu8` | Native device format, smallest file |
| HackRF raw capture | `ci8` | Native device format |
| USRP raw capture | `ci16_le` | Native device format, 12-bit in 16-bit container |
| Post-processing output | `cf32_le` | Full-precision analysis format |
| SoapySDR generic | `cf32_le` | SoapySDR normalizes to CF32 |

Implementations SHOULD record in the device's native format to minimize
processing overhead and preserve original sample fidelity. Format conversion
for analysis SHOULD be performed in-memory during pipeline processing, not
by rewriting the dataset file.

---

## TSG.18.8 SigMF Archive Format

### TSG.18.8.1 Archive Structure

A SigMF archive bundles the metadata and dataset files into a single
uncompressed tar archive with the `.sigmf` extension:

```
recording.sigmf (tar archive)
  |
  +-- recording.sigmf-meta   (JSON metadata)
  +-- recording.sigmf-data   (Binary IQ data)
```

### TSG.18.8.2 Tar Format Requirements

The archive MUST use POSIX.1-2001 (pax) tar format [IEEE1003]. The archive
MUST NOT be compressed (no gzip, bzip2, xz, or zstd). This is intentional:
IQ data is essentially noise and does not compress well. Compression adds
CPU overhead without meaningful size reduction.

Implementations MUST set file names within the archive to the base name
with appropriate extensions (no directory prefix).

### TSG.18.8.3 Multi-Recording Archives

SigMF archives MAY contain multiple recordings. In this case, each recording
has a unique base name:

```
multi-recording.sigmf (tar archive)
  |
  +-- capture-001.sigmf-meta
  +-- capture-001.sigmf-data
  +-- capture-002.sigmf-meta
  +-- capture-002.sigmf-data
```

Implementations SHOULD support multi-recording archives for batch import
and export.

### TSG.18.8.4 Archive Size Considerations

| Recording Duration | Device | Format | Archive Size |
|-------------------|--------|--------|-------------|
| 1 minute | RTL-SDR 2.4 MSPS | `cu8` | ~275 MB |
| 10 minutes | RTL-SDR 2.4 MSPS | `cu8` | ~2.7 GB |
| 1 hour | RTL-SDR 2.4 MSPS | `cu8` | ~16.5 GB |
| 1 minute | HackRF 8 MSPS | `ci8` | ~916 MB |
| 10 minutes | HackRF 8 MSPS | `ci8` | ~9.2 GB |
| 1 minute | USRP 10 MSPS | `ci16_le` | ~2.3 GB |
| 10 minutes | USRP 10 MSPS | `ci16_le` | ~22.9 GB |

For recordings exceeding 4 GB, implementations MUST use pax tar format
which supports files up to 8 EB (exabytes). Implementations MUST NOT use
the legacy USTAR format which limits files to ~8 GB.

### TSG.18.8.5 Streaming Archive Creation

For long recordings, the sidecar MUST NOT buffer the entire dataset in
memory before creating the archive. Instead, the sidecar SHOULD:

1. Create the metadata file in memory (small, typically <100 KB)
2. Write the dataset file directly to disk during capture
3. After capture completes, create the archive by:
   a. Writing the tar header for the metadata file
   b. Writing the metadata content
   c. Writing the tar header for the dataset file
   d. Appending the dataset file content (by reading from disk)

This pattern limits memory usage to the tar header + metadata size,
regardless of recording duration.

---

## TSG.18.9 BaseSignal-to-SigMF Codec

### TSG.18.9.1 Codec Architecture

The SigMF codec provides bidirectional conversion between the Tsingou
BaseSignal schema (TSG.8) and SigMF metadata:

```
                    ┌──────────────────────┐
                    │   SigMF Codec        │
                    │                      │
BaseSignal --------►│  encode()            │--------► SigMF metadata
(kind: "sdr")       │                      │          + dataset
                    │  decode()            │
SigMF metadata ----►│                      │--------► BaseSignal[]
+ dataset           │                      │
                    └──────────────────────┘
```

### TSG.18.9.2 Encoding: BaseSignal to SigMF

When a recording session is initiated, the codec translates BaseSignal
stream metadata to SigMF global and capture objects:

**Global mapping:**

| BaseSignal Field | SigMF Global Field | Transformation |
|-----------------|-------------------|----------------|
| `source.type` | `core:hw` | `"sdr:" + source.type` |
| `source.id` | `tsingou:device_id` | Direct copy |
| `metadata.sampleRate` | `core:sample_rate` | Direct copy |
| `metadata.format` | `core:datatype` | Format name to SigMF datatype string |
| `metadata.description` | `core:description` | Direct copy |
| `timestamp` | `core:datetime` (in first capture) | ISO 8601 conversion |
| — | `core:version` | Always `"1.2.0"` |
| — | `core:recorder` | `"tsingou-sdr-sidecar/" + version` |

**Format name to SigMF datatype mapping:**

| Tsingou Format | SigMF Datatype |
|---------------|---------------|
| `"cu8"` | `"cu8"` |
| `"cs8"` / `"ci8"` | `"ci8"` |
| `"cs16"` / `"ci16"` | `"ci16_le"` |
| `"cf32"` | `"cf32_le"` |
| `"cf64"` | `"cf64_le"` |

Implementations MUST append the `_le` endianness suffix for multi-byte
types when encoding on little-endian platforms.

**Capture segment mapping:**

| BaseSignal Field | SigMF Capture Field | Transformation |
|-----------------|--------------------|--------------  |
| `data.centerFrequency` | `core:frequency` | Direct copy |
| `timestamp` | `core:datetime` | ISO 8601 conversion |
| — | `core:sample_start` | Calculated from timestamp and sample rate |

### TSG.18.9.3 Decoding: SigMF to BaseSignal

When importing a SigMF recording for analysis, the codec translates SigMF
metadata to a stream of BaseSignal objects:

**Global to BaseSignal source:**

| SigMF Global Field | BaseSignal Field | Transformation |
|-------------------|-----------------|----------------|
| `core:hw` | `source.type` | Extract device type from hw string |
| `core:datatype` | `metadata.format` | SigMF datatype to Tsingou format name |
| `core:sample_rate` | `metadata.sampleRate` | Direct copy |
| `core:description` | `metadata.description` | Direct copy |
| `core:geolocation` | `metadata.location` | GeoJSON to lat/lon |

**Capture segments to BaseSignal stream:**

Each capture segment generates one or more BaseSignal objects. The number of
signals per segment depends on the configured chunk size (default: 1 FFT
window worth of samples per signal).

```
SigMF capture segment [N..M]
    |
    | chunk into FFT-sized windows
    v
BaseSignal (sample_start=N)
BaseSignal (sample_start=N+fft_size)
BaseSignal (sample_start=N+2*fft_size)
...
BaseSignal (sample_start=M-fft_size)
```

### TSG.18.9.4 Annotation to BaseSignal Enrichment

SigMF annotations are decoded into BaseSignal `annotations` metadata:

| SigMF Annotation Field | BaseSignal Field | Transformation |
|------------------------|-----------------|----------------|
| `core:label` | `annotations[].label` | Direct copy |
| `core:comment` | `annotations[].comment` | Direct copy |
| `core:generator` | `annotations[].source` | Direct copy |
| `core:freq_lower_edge` | `annotations[].freqLower` | Direct copy |
| `core:freq_upper_edge` | `annotations[].freqUpper` | Direct copy |
| `core:sample_start` | `annotations[].sampleStart` | Direct copy |
| `core:sample_count` | `annotations[].sampleCount` | Direct copy |
| `tsingou:confidence` | `annotations[].confidence` | Direct copy |
| `tsingou:protocol` | `annotations[].protocol` | Direct copy |

### TSG.18.9.5 Effect Schema Definitions

The codec uses Effect Schema for all data structures:

```typescript
// SigMF Global Schema
const SigMFGlobal = Schema.Struct({
  "core:datatype": Schema.String,
  "core:version": Schema.String,
  "core:sample_rate": Schema.optional(Schema.Number),
  "core:description": Schema.optional(Schema.String),
  "core:author": Schema.optional(Schema.String),
  "core:license": Schema.optional(Schema.String),
  "core:hw": Schema.optional(Schema.String),
  "core:recorder": Schema.optional(Schema.String),
  "core:geolocation": Schema.optional(Schema.Unknown),
  "core:sha512": Schema.optional(Schema.String),
  "core:offset": Schema.optional(Schema.Number),
  "core:num_channels": Schema.optional(Schema.Number),
  "core:trailing_bytes": Schema.optional(Schema.Number),
  "core:metadata_only": Schema.optional(Schema.Boolean),
})

// SigMF Capture Segment Schema
const SigMFCapture = Schema.Struct({
  "core:sample_start": Schema.Number,
  "core:frequency": Schema.optional(Schema.Number),
  "core:datetime": Schema.optional(Schema.String),
  "core:global_index": Schema.optional(Schema.Number),
  "core:header_bytes": Schema.optional(Schema.Number),
})

// SigMF Annotation Schema
const SigMFAnnotation = Schema.Struct({
  "core:sample_start": Schema.Number,
  "core:sample_count": Schema.Number,
  "core:freq_lower_edge": Schema.optional(Schema.Number),
  "core:freq_upper_edge": Schema.optional(Schema.Number),
  "core:label": Schema.optional(Schema.String),
  "core:comment": Schema.optional(Schema.String),
  "core:generator": Schema.optional(Schema.String),
  "core:uuid": Schema.optional(Schema.String),
})

// Complete SigMF Metadata Schema
const SigMFMetadata = Schema.Struct({
  global: SigMFGlobal,
  captures: Schema.Array(SigMFCapture),
  annotations: Schema.Array(SigMFAnnotation),
})
```

---

## TSG.18.10 Effect-TS Service Contract

### TSG.18.10.1 SigMFCodec Service

The SigMF codec is exposed as an Effect-TS service for dependency injection
and testability:

```typescript
interface SigMFCodec {
  /**
   * Encode a recording session's metadata as SigMF.
   * Returns the complete SigMF metadata JSON string.
   */
  readonly encodeMetadata: (
    session: RecordingSession
  ) => Effect.Effect<string, SigMFEncodeError>

  /**
   * Decode a SigMF metadata file into a RecordingSession.
   */
  readonly decodeMetadata: (
    json: string
  ) => Effect.Effect<RecordingSession, SigMFDecodeError>

  /**
   * Create a SigMF annotation from a signal detection event.
   */
  readonly createAnnotation: (
    detection: SignalDetection,
    recording: RecordingSession
  ) => Effect.Effect<SigMFAnnotationObject, SigMFEncodeError>

  /**
   * Validate a SigMF metadata file against the specification.
   */
  readonly validate: (
    json: string
  ) => Effect.Effect<SigMFValidationResult, SigMFValidateError>

  /**
   * Read a SigMF archive (.sigmf) and return metadata + dataset path.
   */
  readonly readArchive: (
    archivePath: string
  ) => Effect.Effect<SigMFArchiveContents, SigMFIOError>

  /**
   * Write a SigMF archive (.sigmf) from metadata + dataset.
   */
  readonly writeArchive: (
    metadata: SigMFMetadataObject,
    datasetPath: string,
    outputPath: string
  ) => Effect.Effect<void, SigMFIOError>

  /**
   * Compute SHA-512 hash of a dataset file for integrity verification.
   */
  readonly hashDataset: (
    datasetPath: string
  ) => Effect.Effect<string, SigMFIOError>
}
```

### TSG.18.10.2 Error Types

```typescript
const SigMFError = Schema.Union(
  Schema.TaggedStruct("SigMFEncodeError", {
    message: Schema.String,
    field: Schema.optional(Schema.String),
  }),
  Schema.TaggedStruct("SigMFDecodeError", {
    message: Schema.String,
    path: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  }),
  Schema.TaggedStruct("SigMFValidateError", {
    message: Schema.String,
    violations: Schema.Array(Schema.Struct({
      field: Schema.String,
      rule: Schema.String,
      message: Schema.String,
    })),
  }),
  Schema.TaggedStruct("SigMFIOError", {
    message: Schema.String,
    path: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }),
)
```

### TSG.18.10.3 Validation Rules

The `validate` method MUST check:

| Rule | Level | Description |
|------|-------|-------------|
| SIGMF-V001 | ERROR | `core:datatype` is a valid SigMF datatype string |
| SIGMF-V002 | ERROR | `core:version` matches `"1.x.y"` pattern |
| SIGMF-V003 | ERROR | First capture has `core:sample_start` = 0 |
| SIGMF-V004 | ERROR | Capture `core:sample_start` values are monotonically increasing |
| SIGMF-V005 | ERROR | Annotation `core:sample_count` > 0 |
| SIGMF-V006 | WARN | `core:sample_rate` is present in global |
| SIGMF-V007 | WARN | `core:frequency` is present in first capture |
| SIGMF-V008 | WARN | `core:datetime` is present in first capture |
| SIGMF-V009 | WARN | `core:sha512` matches dataset file (if present and file available) |
| SIGMF-V010 | ERROR | Annotation `core:sample_start` + `core:sample_count` does not exceed dataset length |
| SIGMF-V011 | ERROR | `core:freq_lower_edge` < `core:freq_upper_edge` in annotations |
| SIGMF-V012 | WARN | Extension fields use valid namespace prefix |

---

## TSG.18.11 Recording Lifecycle

### TSG.18.11.1 State Machine

```
                     ┌──────────────┐
                     │              │
         ┌──────────►│    IDLE      │
         │           │              │
         │           └──────┬───────┘
         │                  │ start_recording
         │                  v
         │           ┌──────────────┐
         │           │              │
    stop │      ┌───►│  RECORDING   │◄──── retune (new capture segment)
         │      │    │              │
         │      │    └──────┬───────┘
         │      │           │ pause
         │   resume         v
         │      │    ┌──────────────┐
         │      │    │              │
         │      └────┤   PAUSED     │
         │           │              │
         │           └──────┬───────┘
         │                  │ stop
         │                  v
         │           ┌──────────────┐
         │           │              │
         │           │  FINALIZING  │ ← compute SHA-512, write archive
         │           │              │
         │           └──────┬───────┘
         │                  │ finalized
         │                  v
         │           ┌──────────────┐
         │           │              │
         └───────────┤  COMPLETED   │
                     │              │
                     └──────────────┘
```

### TSG.18.11.2 Lifecycle Events

| Event | From State | To State | Actions |
|-------|-----------|----------|---------|
| `start_recording` | IDLE | RECORDING | Create metadata, open dataset file, add first capture |
| `retune` | RECORDING | RECORDING | Add new capture segment with updated frequency |
| `annotate` | RECORDING | RECORDING | Append annotation to metadata |
| `pause` | RECORDING | PAUSED | Flush buffers, record pause timestamp |
| `resume` | PAUSED | RECORDING | Add new capture segment (gap marker) |
| `stop` | RECORDING/PAUSED | FINALIZING | Close dataset file, begin finalization |
| `finalized` | FINALIZING | COMPLETED | SHA-512 computed, archive created (if requested) |

### TSG.18.11.3 NATS Commands

The sidecar accepts recording commands via NATS request-reply:

| Subject | Payload | Response |
|---------|---------|----------|
| `tsingou.signal.sdr.record.start` | `{ "deviceId": "...", "config": {...} }` | `{ "status": "ok", "sessionId": "..." }` |
| `tsingou.signal.sdr.record.stop` | `{ "sessionId": "..." }` | `{ "status": "ok", "path": "..." }` |
| `tsingou.signal.sdr.record.pause` | `{ "sessionId": "..." }` | `{ "status": "ok" }` |
| `tsingou.signal.sdr.record.resume` | `{ "sessionId": "..." }` | `{ "status": "ok" }` |
| `tsingou.signal.sdr.record.annotate` | `{ "sessionId": "...", "annotation": {...} }` | `{ "status": "ok" }` |

### TSG.18.11.4 Concurrent Recording and Analysis

Implementations MUST support concurrent recording and real-time analysis.
The sidecar MUST be able to write IQ samples to disk while simultaneously
publishing FFT data (or decimated IQ) to NATS for live visualization:

```
SDR Hardware
    |
    v
Sidecar Process
    |
    +-----> Disk (SigMF dataset)    ← recording path
    |
    +-----> NATS (FFT/IQ messages)  ← real-time analysis path
```

This dual-output pattern ensures that recordings capture the full-resolution
raw IQ data while the real-time analysis path operates at the reduced
bandwidth required for visualization (typically FFT magnitudes only).

---

## TSG.18.12 Extension Namespaces

### TSG.18.12.1 Namespace Registration

SigMF supports arbitrary extension namespaces for domain-specific metadata.
Extension field names use the format `namespace:field_name`.

Tsingou registers the `tsingou` namespace. All Tsingou-specific extension
fields MUST use the `tsingou:` prefix.

### TSG.18.12.2 Tsingou Extension Fields — Global

| Field | Type | Description |
|-------|------|-------------|
| `tsingou:session_id` | string | Unique recording session identifier |
| `tsingou:device_id` | string | SDR sidecar device identifier |
| `tsingou:pipeline_version` | string | Tsingou pipeline version string |
| `tsingou:gain_db` | double | Configured receiver gain in dB |
| `tsingou:gain_mode` | string | `"auto"` or `"manual"` |
| `tsingou:bias_tee` | boolean | Whether bias-tee power was enabled |
| `tsingou:ppm_correction` | int | Frequency correction applied (PPM) |
| `tsingou:antenna` | string | Antenna port name (e.g., `"TX/RX"`, `"RX2"`) |
| `tsingou:fft_config` | object | FFT parameters for concurrent analysis |

### TSG.18.12.3 Tsingou Extension Fields — Capture

| Field | Type | Description |
|-------|------|-------------|
| `tsingou:gain_db` | double | Gain setting for this capture segment |
| `tsingou:temperature_c` | double | Device temperature at segment start |
| `tsingou:dropped_samples` | uint | Samples dropped before this segment |

### TSG.18.12.4 Tsingou Extension Fields — Annotation

| Field | Type | Description |
|-------|------|-------------|
| `tsingou:signal_kind` | string | BaseSignal kind from signal taxonomy |
| `tsingou:confidence` | double | Detection confidence (0.0-1.0) |
| `tsingou:protocol` | string | Identified protocol name |
| `tsingou:modulation` | string | Identified modulation type |
| `tsingou:symbol_rate` | double | Measured symbol rate (baud) |
| `tsingou:snr_db` | double | Measured SNR in dB |
| `tsingou:bandwidth_hz` | double | Measured occupied bandwidth in Hz |
| `tsingou:duration_sec` | double | Signal duration in seconds |
| `tsingou:power_dbfs` | double | Average power in dBFS |
| `tsingou:stix_indicator_id` | string | Linked STIX indicator ID (TSG.13) |
| `tsingou:d2ts_version` | string | d2ts pipeline version |
| `tsingou:analysis_chain` | string[] | Ordered list of analysis stages |

### TSG.18.12.5 Extension Namespace Discovery

When reading SigMF files from external sources, implementations MUST
gracefully handle unknown extension namespaces by preserving but not
interpreting the fields. Unknown extension fields MUST NOT cause parsing
errors.

---

## TSG.18.13 NATS Subject Taxonomy for SigMF

### TSG.18.13.1 Subject Hierarchy

SigMF-related NATS subjects follow the Tsingou signal subject taxonomy:

```
tsingou.signal.sdr.
    |
    +-- fft.{device_id}          ← FFT magnitude data (real-time)
    +-- iq.{device_id}           ← Raw IQ samples (real-time, high bandwidth)
    +-- decoded.{protocol}       ← Decoded protocol messages
    +-- health.{device_id}       ← Device health heartbeats
    +-- command.{device_id}      ← Control commands (tune, gain, etc.)
    +-- record.start             ← Start recording command
    +-- record.stop              ← Stop recording command
    +-- record.pause             ← Pause recording command
    +-- record.resume            ← Resume recording command
    +-- record.annotate          ← Add annotation to active recording
    +-- record.status.{session}  ← Recording status updates
    +-- sigmf.import             ← Import SigMF recording for analysis
    +-- sigmf.export             ← Export analysis results as SigMF
```

### TSG.18.13.2 FFT Message Format (Recap)

FFT messages published to `tsingou.signal.sdr.fft.{device_id}` use the
format specified in TSG.17.4.4:

```json
{
  "type": "fft",
  "magnitudes": [-80.5, -78.2, ...],
  "centerFrequency": 433920000,
  "bandwidth": 2400000,
  "fftSize": 1024,
  "windowFunction": "hann",
  "timestamp": 1708300000.123,
  "seq": 42
}
```

### TSG.18.13.3 Recording Status Messages

During recording, the sidecar publishes status updates to
`tsingou.signal.sdr.record.status.{session_id}`:

```json
{
  "type": "recording_status",
  "sessionId": "rec-20260218-120000",
  "state": "recording",
  "duration": 60.5,
  "samplesWritten": 145200000,
  "bytesWritten": 290400000,
  "captureSegments": 1,
  "annotations": 3,
  "diskFreeBytes": 107374182400,
  "timestamp": 1708300060.5
}
```

---

## TSG.18.14 Storage and Retrieval Patterns

### TSG.18.14.1 File System Layout

Tsingou stores SigMF recordings in a structured directory hierarchy:

```
$TSINGOU_DATA/recordings/
    |
    +-- 2026/
    |   +-- 02/
    |       +-- 18/
    |           +-- rec-20260218-120000/
    |           |   +-- rec-20260218-120000.sigmf-meta
    |           |   +-- rec-20260218-120000.sigmf-data
    |           |
    |           +-- rec-20260218-143000/
    |               +-- rec-20260218-143000.sigmf-meta
    |               +-- rec-20260218-143000.sigmf-data
    +-- imports/
        +-- external-recording-001.sigmf-meta
        +-- external-recording-001.sigmf-data
```

The directory hierarchy uses `YYYY/MM/DD/session_id/` to prevent flat
directory performance issues with large numbers of recordings.

### TSG.18.14.2 Recording Index

Implementations SHOULD maintain a recording index in NATS KV store for
fast metadata queries without scanning the file system:

KV Bucket: `tsingou-recordings`

Key format: `recordings.{session_id}`

Value:
```json
{
  "sessionId": "rec-20260218-120000",
  "startTime": "2026-02-18T12:00:00.000Z",
  "endTime": "2026-02-18T12:05:00.000Z",
  "duration": 300.0,
  "deviceId": "rtlsdr-00000001",
  "deviceType": "rtlsdr",
  "centerFrequency": 433920000,
  "sampleRate": 2400000,
  "datatype": "cu8",
  "fileSize": 1440000000,
  "captureSegments": 1,
  "annotationCount": 12,
  "path": "/data/recordings/2026/02/18/rec-20260218-120000/",
  "sha512": "abc123..."
}
```

### TSG.18.14.3 Recording Replay

To replay a SigMF recording through the d2ts pipeline for re-analysis:

1. Read the `.sigmf-meta` file and decode via `SigMFCodec.decodeMetadata()`
2. Open the `.sigmf-data` file for sequential reading
3. For each capture segment:
   a. Seek to the segment's byte offset
   b. Read samples in FFT-sized chunks
   c. Convert to CF32 if necessary (using TSG.16.7.4 formulas)
   d. Publish as BaseSignal objects to the d2ts ingest pipeline
   e. Maintain the original timestamp progression (scaled by replay speed)

Implementations SHOULD support variable replay speed (0.1x to 10x real-time)
by adjusting the delay between published BaseSignal batches.

### TSG.18.14.4 Integrity Verification

Implementations SHOULD compute the SHA-512 hash of the dataset file after
recording and store it in `core:sha512`. On subsequent reads,
implementations MAY verify the hash to detect corruption.

The SHA-512 computation is performed on the raw binary content of the
`.sigmf-data` file, not including the metadata.

---

## TSG.18.15 Normative Requirements Summary

### TSG.18.15.1 File Format

| Requirement | Level |
|-------------|-------|
| Use `.sigmf-meta` extension for metadata files | MUST |
| Use `.sigmf-data` extension for dataset files | MUST |
| Metadata and dataset share same base name | MUST |
| Include `global`, `captures`, `annotations` keys in metadata | MUST |
| Include `core:datatype` and `core:version` in global | MUST |
| Include at least one capture with `core:sample_start` = 0 | MUST |
| Use SigMF v1.2.0 specification | MUST |

### TSG.18.15.2 Datatype Handling

| Requirement | Level |
|-------------|-------|
| Support `cu8` datatype (RTL-SDR native) | MUST |
| Support `ci8` datatype (HackRF native) | MUST |
| Support `ci16_le` datatype (USRP native) | SHOULD |
| Support `cf32_le` datatype (processing format) | MUST |
| Append `_le` suffix for multi-byte types on LE platforms | MUST |
| Handle both `_le` and `_be` endianness when reading | MUST |
| Datatype string matches actual binary format | MUST |

### TSG.18.15.3 Recording

| Requirement | Level |
|-------------|-------|
| Create new capture segment on frequency change | MUST |
| Include `core:frequency` in capture segments | MUST |
| Include `core:datetime` in capture segments | SHOULD |
| Support concurrent recording and real-time analysis | MUST |
| Record in device native format | SHOULD |
| Compute SHA-512 hash after recording | SHOULD |

### TSG.18.15.4 Annotations

| Requirement | Level |
|-------------|-------|
| Include `core:sample_start` and `core:sample_count` | MUST |
| Support overlapping annotations | MUST |
| Use `tsingou:` namespace for extension fields | MUST |
| Preserve unknown extension namespaces when reading | MUST |
| Include `core:generator` in Tsingou-created annotations | SHOULD |

### TSG.18.15.5 Archives

| Requirement | Level |
|-------------|-------|
| Use uncompressed pax tar format for archives | MUST |
| Use `.sigmf` extension for archives | MUST |
| Support multi-recording archives for import | SHOULD |
| Use pax tar (not USTAR) for files > 4 GB | MUST |

### TSG.18.15.6 Service Contract

| Requirement | Level |
|-------------|-------|
| Expose SigMFCodec as Effect-TS service | MUST |
| Validate metadata against SigMF specification | MUST |
| Support bidirectional BaseSignal <-> SigMF conversion | MUST |
| Effect Schema for all SigMF data structures | MUST |

---

## TSG.18.16 References

| Key | Reference |
|-----|-----------|
| [RFC2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997 |
| [RFC8174] | Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017 |
| [RFC7946] | Butler, H., Daly, M., Doyle, A., Gillies, S., Hagen, S., Schaub, T., "The GeoJSON Format", RFC 7946, August 2016 |
| [SIGMF] | Signal Metadata Format Specification v1.2.0, https://github.com/sigmf/SigMF |
| [IEEE1003] | IEEE Std 1003.1-2017, "POSIX.1-2017 (pax archive format)" |
| [ADR-011] | "ADR-011: SDR Integration via GNU Radio Bridge + RTL-SDR Sidecar", Tsingou ADR |
| [EFFECT] | "Effect-TS", https://effect.website |
| [INSPECTRUM] | inspectrum SDR signal viewer, https://github.com/miek/inspectrum |
| [URH] | Universal Radio Hacker, https://github.com/jopohl/urh |
