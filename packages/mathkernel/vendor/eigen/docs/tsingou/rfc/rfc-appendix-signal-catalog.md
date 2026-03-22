# Appendix C: Signal Kind Catalog

```
Appendix:   C — Signal Kind Catalog
Parent RFC: Tsingou Platform Specification (TMNL-RFC-002)
Status:     DRAFT
Created:    2026-02-18
Authors:    Val (catalog-writer agent)
Depends:    TSG.8 (BaseSignal Schema), TSG.2 (SIGINT Domain), TSG.9 (Source Adapters)
Feeds:      TSG.12 (STIX Data Model), TSG.13 (STIX Codec), TSG.7 (Signal Pipeline)
```

---

## TSG.C.1 Introduction

### TSG.C.1.1 Purpose

This appendix provides the authoritative catalog of all signal kinds recognized
by the Tsingou platform. Each entry specifies the kind identifier, payload
schema, intelligence discipline mapping, processing pipeline, rendering
recommendations, and STIX 2.1 export mapping. The catalog serves as the
single-source-of-truth reference for adapter implementors, pipeline authors,
and visualization developers.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
interpreted as described in [RFC2119] and [RFC8174].

### TSG.C.1.2 Scope

This catalog covers:

1. **Adapter-native kinds** (TSG.C.2 through TSG.C.10) -- The 8 compile-time
   known signal kinds plus the planned SDR kind, each with a dedicated source
   adapter and typed extension schema.
2. **SIGINT discipline kinds** (TSG.C.11 through TSG.C.16) -- Runtime-registered
   signal kinds carrying intelligence discipline metadata for COMINT, ELINT,
   FISINT, MASINT, CYBINT, and OSINT.
3. **STIX-derived kinds** (TSG.C.17) -- Signal kinds mapped from STIX 2.1
   SDO/SCO/SRO types via the bidirectional codec.
4. **System kinds** (TSG.C.18) -- Internal system signal kinds reserved for
   platform diagnostics and lifecycle events.

### TSG.C.1.3 Kind Naming Convention

All signal kinds conform to the naming rules defined in TSG.8.4.4:

| Constraint | Rule | Example |
|------------|------|---------|
| Format | Lowercase, hyphen-separated | `file-watch`, `comint-cdr` |
| Length | 1-64 characters | Enforced by schema registry |
| Characters | `[a-z0-9-]` | No underscores, dots, or uppercase |
| Reserved prefix `_` | Internal system kinds | `_diagnostic`, `_heartbeat` |
| Reserved prefix `stix-` | STIX-derived kinds | `stix-indicator`, `stix-malware` |
| Discipline prefix | Intelligence discipline kinds | `comint-`, `elint-`, `cybint-` |

### TSG.C.1.4 Schema Dispatch

Signal kinds are dispatched via the mechanism defined in TSG.8.4.3:

```
Signal arrives with kind = K
  |
  +-- K in KnownSignalKind (8 compile-time literals)?
  |   +-- YES -> Validate against typed extension schema
  |   +-- NO  -> Lookup K in SchemaRegistry (NATS KV)
  |              +-- FOUND -> Validate payload against registered JSON Schema
  |              +-- NOT FOUND -> Reject (strict) or accept as BaseSignal (permissive)
  |
  v
Validated signal enters d2ts graph
```

### TSG.C.1.5 Catalog Entry Format

Each signal kind entry follows this structure:

| Field | Description |
|-------|-------------|
| **Kind identifier** | The literal `kind` string value |
| **Status** | `compile-time` (in `KnownSignalKind`) or `runtime-registered` |
| **Category** | Adapter-native, SIGINT discipline, STIX-derived, or System |
| **Description** | Purpose and use case |
| **Source adapter** | Which adapter produces signals of this kind |
| **Payload schema** | Typed payload fields (reference to schema file) |
| **Frequency range** | Typical signal emission rate |
| **Intelligence discipline** | COMINT, ELINT, OSINT, CYBINT, etc. |
| **d2ts pipeline** | Processing operators applied |
| **Rendering layer** | Recommended visualization layer(s) |
| **STIX mapping** | Corresponding STIX 2.1 object type(s) |
| **Example payload** | A representative `BaseSignal` instance |

---

## TSG.C.2 Quick Reference Matrix

### TSG.C.2.1 Adapter-Native Kinds

| Kind | Adapter | Discipline(s) | Frequency | Primary Layer | STIX Type |
|------|---------|---------------|-----------|---------------|-----------|
| `http` | `HttpSourceAdapter` | CYBINT, OSINT | 0.01-100 Hz | DOM, visx | `observed-data` |
| `rss` | `RssSourceAdapter` | OSINT | 0.001-0.1 Hz | DOM, visx | `observed-data`, `report` |
| `nats` | `NatsSourceAdapter` | Multi-INT | 0-100 kHz+ | varies | varies |
| `websocket` | `WebSocketSourceAdapter` | CYBINT, OSINT | 0-10 kHz | visx, DOM | `observed-data` |
| `file-watch` | `FileWatchAdapter` | Multi-INT | event-driven | DOM, visx | `artifact` |
| `serial` | `SerialAdapter` | ELINT, MASINT | 9600-115200 baud | p5, visx | `observed-data` |
| `midi` | `MidiAdapter` (stub) | Control | 0-1 kHz | DOM | N/A |
| `osc` | `OscAdapter` (stub) | MASINT | 0-10 kHz | visx, p5 | `observed-data` |
| `sdr` | `SdrAdapter` (planned) | ELINT, COMINT | 0-100 kHz | p5, visx | `observed-data` |

### TSG.C.2.2 SIGINT Discipline Kinds (Runtime-Registered)

| Kind | Discipline | Source Path | Primary d2ts Operator | Primary Layer |
|------|-----------|-------------|----------------------|---------------|
| `comint-cdr` | COMINT | HTTP/NATS -> CDR feed | `join` (selector key) | R3F, visx |
| `comint-metadata` | COMINT | HTTP/NATS -> metadata feed | `window` + `count` | visx |
| `comint-traffic` | COMINT | HTTP/NATS -> traffic stats | `iterate` (EWMA) | visx |
| `elint-pdw` | ELINT | NATS (SDR bridge) | `filter` + clustering | p5, visx |
| `elint-spectrum` | ELINT | NATS (SDR bridge) | `window` + `aggregate` | p5 |
| `elint-emitter` | ELINT | d2ts derived | `join` (EOB match) | R3F, DOM |
| `fisint-telemetry` | FISINT | HTTP/NATS | `map` + `window` | R3F, visx |
| `masint-sensor` | MASINT | NATS/WebSocket | `window` + anomaly | visx, p5 |
| `masint-acoustic` | MASINT | WebSocket (hydrophone) | FFT + spectrogram | p5 |
| `cybint-ioc` | CYBINT | HTTP (TAXII/API) | `join` (IOC key) | DOM, visx |
| `cybint-alert` | CYBINT | NATS/WebSocket | `anomaly` + threshold | DOM |
| `cybint-netflow` | CYBINT | NATS | `window` + `aggregate` | visx, R3F |
| `osint-article` | OSINT | RSS/HTTP | `map` (NLP extract) | DOM |
| `osint-social` | OSINT | HTTP/WebSocket | `window` + sentiment | DOM, visx |
| `osint-advisory` | OSINT | RSS/HTTP | `map` + `join` | DOM |

### TSG.C.2.3 STIX-Derived Kinds (Runtime-Registered)

| Kind | STIX Type | Category | Primary Layer |
|------|-----------|----------|---------------|
| `stix-indicator` | `indicator` | SDO | DOM, visx |
| `stix-observed-data` | `observed-data` | SDO | visx |
| `stix-malware` | `malware` | SDO | DOM, R3F |
| `stix-threat-actor` | `threat-actor` | SDO | R3F, DOM |
| `stix-attack-pattern` | `attack-pattern` | SDO | DOM |
| `stix-campaign` | `campaign` | SDO | visx, DOM |
| `stix-vulnerability` | `vulnerability` | SDO | DOM |
| `stix-infrastructure` | `infrastructure` | SDO | R3F |
| `stix-relationship` | `relationship` | SRO | R3F |
| `stix-sighting` | `sighting` | SRO | visx, DOM |
| `stix-artifact` | `artifact` | SCO | DOM |
| `stix-ipv4-addr` | `ipv4-addr` | SCO | DOM, R3F |
| `stix-domain-name` | `domain-name` | SCO | DOM |
| `stix-url` | `url` | SCO | DOM |
| `stix-file` | `file` | SCO | DOM |

---

## TSG.C.3 `http` -- HTTP Signal

### TSG.C.3.1 Overview

| Property | Value |
|----------|-------|
| **Kind identifier** | `http` |
| **Status** | Compile-time (`KnownSignalKind`) |
| **Category** | Adapter-native |
| **Schema file** | `src/lib/tsingou-flow/schemas/http-signal.ts` (66 lines) |
| **Source adapter** | `HttpSourceAdapter` |
| **Transport** | HTTP poll / SSE / long-poll / webhook |
| **Frequency range** | 0.01-100 Hz (poll) / event-driven (SSE, webhook) |
| **Intelligence disciplines** | CYBINT (primary), OSINT (primary), COMINT (secondary), GEOINT (secondary) |

### TSG.C.3.2 Description

The `http` signal kind represents data ingested from HTTP endpoints. The
`HttpSourceAdapter` operates in four distinct modes -- poll, SSE (Server-Sent
Events), long-poll, and webhook receiver -- each producing `http` signals with
mode-specific field patterns. This is the most versatile adapter kind, serving
as the primary ingestion path for REST APIs, threat intelligence platforms,
TAXII 2.1 endpoints, social media APIs, and government data portals.

### TSG.C.3.3 Payload Schema

```typescript
// Verified from schemas/http-signal.ts:20-51
export const HttpPayload = Schema.Struct({
  url: Schema.String,                              // REQUIRED
  method: HttpMethod,                               // REQUIRED ('GET'|'POST'|'PUT'|'DELETE'|'PATCH')
  statusCode: Schema.optional(                      // OPTIONAL (present for poll/long-poll)
    Schema.Number.pipe(Schema.int(), Schema.between(100, 599)),
  ),
  body: Schema.Unknown,                             // REQUIRED (decoded response/event body)
  headers: Schema.optional(                         // OPTIONAL
    Schema.Record({ key: Schema.String, value: Schema.String }),
  ),
  sseEventType: Schema.optional(Schema.String),     // OPTIONAL (SSE mode)
  sseEventId: Schema.optional(Schema.String),       // OPTIONAL (SSE mode)
  contentType: Schema.optional(Schema.String),      // OPTIONAL
  responseTimeMs: Schema.optional(Schema.Number),   // OPTIONAL (poll/long-poll mode)
})
```

### TSG.C.3.4 Adapter Mode Field Patterns

| Mode | `statusCode` | `sseEventType` | `sseEventId` | `responseTimeMs` | Trigger |
|------|-------------|---------------|-------------|-----------------|---------|
| Poll | Present | Absent | Absent | Present | Fixed interval |
| SSE | Absent | Present | Present | Absent | Event-driven |
| Long-poll | Present | Absent | Absent | Present | Response-driven |
| Webhook | Absent | Absent | Absent | Absent | Push-driven |

### TSG.C.3.5 Frequency Range

| Mode | Typical Frequency | Min | Max |
|------|------------------|-----|-----|
| Poll | 0.1-1 Hz (every 1-10 seconds) | 0.01 Hz (100s interval) | 100 Hz |
| SSE | Event-driven, bursty | N/A | Thousands/sec |
| Long-poll | Response latency dependent | 0.01 Hz | 10 Hz |
| Webhook | Push-driven, bursty | N/A | Thousands/sec |

### TSG.C.3.6 Processing Pipeline (d2ts)

| Stage | Operator | Description |
|-------|----------|-------------|
| 1. Ingest | `map` (normalize) | Extract `body` into structured form |
| 2. Validate | `schemaValidate` | Validate against `HttpPayload` schema |
| 3. Dedup | `filter` (ETag/Last-Modified) | Skip unchanged poll responses |
| 4. Extract | `map` (entity extraction) | Pull IOCs, entities, or structured data from body |
| 5. Enrich | `join` (reference data) | Correlate with existing intelligence |
| 6. Window | `window` (time-based) | Aggregate for temporal analysis |
| 7. Anomaly | `anomaly` (baseline deviation) | Detect unusual response patterns |

### TSG.C.3.7 Rendering Recommendations

| Visualization | Layer | Use Case |
|--------------|-------|----------|
| API response feed | DOM (z:3) | Real-time display of incoming responses |
| Response time chart | visx (z:1) | Latency monitoring over time |
| IOC extraction table | DOM (z:3) | Extracted indicators from API bodies |
| Threat intel timeline | visx (z:1) | Temporal distribution of intelligence items |
| Source health indicator | DOM (z:3) | Adapter status and error rate |
| Geospatial overlay | R3F (z:0) | Geolocated intelligence from API responses |

### TSG.C.3.8 STIX Mapping

| HTTP Use Case | STIX Export Type | Category |
|---------------|-----------------|----------|
| TAXII poll response | `observed-data` (bundle contents) | SDO |
| Threat intel API | `indicator`, `malware`, `threat-actor` | SDO |
| Vulnerability feed | `vulnerability` | SDO |
| Social media post | `observed-data` with `x-tsingou-social` extension | SDO |
| General API response | `observed-data` | SDO |

### TSG.C.3.9 Example BaseSignal Payload

```json
{
  "id": "sig_http_01J9XKMRP2",
  "sourceId": "taxii-alienvault-otx",
  "timestamp": "2026-02-18T14:30:22.451Z",
  "version": [142, 87],
  "kind": "http",
  "payload": {
    "url": "https://otx.alienvault.com/api/v1/pulses/subscribed",
    "method": "GET",
    "statusCode": 200,
    "body": {
      "results": [
        {
          "id": "65f1a2b3c4d5e6f7",
          "name": "APT29 Infrastructure Update",
          "indicators": [
            { "type": "IPv4", "indicator": "198.51.100.23" }
          ]
        }
      ]
    },
    "headers": {
      "content-type": "application/json",
      "x-ratelimit-remaining": "45"
    },
    "contentType": "application/json",
    "responseTimeMs": 234.5
  },
  "metadata": {
    "http.etag": "\"abc123def456\"",
    "http.poll-interval-ms": 30000,
    "discipline": "CYBINT",
    "tlp": "TLP:GREEN"
  }
}
```

---

## TSG.C.4 `rss` -- RSS/Atom Feed Signal

### TSG.C.4.1 Overview

| Property | Value |
|----------|-------|
| **Kind identifier** | `rss` |
| **Status** | Compile-time (`KnownSignalKind`) |
| **Category** | Adapter-native |
| **Schema file** | `src/lib/tsingou-flow/schemas/rss-signal.ts` (67 lines) |
| **Source adapter** | `RssSourceAdapter` |
| **Transport** | HTTP GET (periodic poll) |
| **Frequency range** | 0.001-0.1 Hz (every 10 seconds to 15 minutes) |
| **Intelligence disciplines** | OSINT (primary), CYBINT (secondary) |

### TSG.C.4.2 Description

The `rss` signal kind represents individual items from RSS 2.0 or Atom 1.0
feeds. The `RssSourceAdapter` polls feeds at configurable intervals, parses
XML, and emits one `BaseSignal` per new feed item. Deduplication is performed
via the `itemGuid` field, ensuring each item is emitted exactly once across
poll cycles. This is the fundamental OSINT ingestion primitive for news
monitoring, advisory tracking, and vulnerability feed processing.

### TSG.C.4.3 Payload Schema

```typescript
// Verified from schemas/rss-signal.ts:17-52
export const RssPayload = Schema.Struct({
  feedUrl: Schema.String,                                  // REQUIRED
  feedTitle: Schema.optional(Schema.String),               // OPTIONAL
  itemGuid: Schema.String,                                 // REQUIRED (dedup key)
  title: Schema.String,                                    // REQUIRED
  link: Schema.optional(Schema.String),                    // OPTIONAL
  pubDate: Schema.optional(Schema.DateFromSelf),           // OPTIONAL
  content: Schema.optional(Schema.String),                 // OPTIONAL (full text)
  description: Schema.optional(Schema.String),             // OPTIONAL (summary)
  author: Schema.optional(Schema.String),                  // OPTIONAL
  categories: Schema.optional(Schema.Array(Schema.String)),// OPTIONAL
  enclosureUrl: Schema.optional(Schema.String),            // OPTIONAL (media)
  enclosureType: Schema.optional(Schema.String),           // OPTIONAL
  enclosureLength: Schema.optional(Schema.Number),         // OPTIONAL
})
```

### TSG.C.4.4 Frequency Range

| Feed Type | Typical Interval | Signals/Hour |
|-----------|-----------------|-------------|
| Breaking news (Reuters, AP) | 60s poll, 5-20 items/cycle | 50-200 |
| Advisory feeds (US-CERT, NVD) | 300s poll, 1-5 items/cycle | 5-60 |
| Blog monitoring | 900s poll, 0-2 items/cycle | 0-8 |
| Podcast feeds | 3600s poll, 0-1 items/cycle | 0-1 |

### TSG.C.4.5 Processing Pipeline (d2ts)

| Stage | Operator | Description |
|-------|----------|-------------|
| 1. Ingest | `map` (normalize) | Extract RSS item fields from parsed XML |
| 2. Dedup | `filter` (GUID tracking) | Skip previously seen `itemGuid` values |
| 3. NLP | `map` (entity extraction) | Extract named entities, keywords, locations |
| 4. Classify | `map` (topic tagging) | Assign topic labels via keyword or ML classifier |
| 5. Enrich | `join` (reference data) | Cross-reference extracted entities with IOC lists |
| 6. Window | `window` (time-based) | Aggregate items per feed per time bucket |
| 7. Anomaly | `anomaly` (volume spike) | Detect unusual publication frequency |

### TSG.C.4.6 Rendering Recommendations

| Visualization | Layer | Use Case |
|--------------|-------|----------|
| Feed aggregation panel | DOM (z:3) | Scrollable, sortable news/alert feed |
| Entity mention timeline | visx (z:1) | Temporal distribution of entity mentions |
| Topic heatmap | visx (z:1) | Topic frequency over time |
| Geographic event map | R3F (z:0) | Geotagged news events on map overlay |
| Word cloud | DOM (z:3) | NLP-extracted significant terms |
| Publication burst chart | visx (z:1) | Publication rate anomaly visualization |

### TSG.C.4.7 STIX Mapping

| RSS Use Case | STIX Export Type | Category |
|--------------|-----------------|----------|
| Threat advisory | `report` | SDO |
| Vulnerability disclosure | `vulnerability` | SDO |
| General news item | `observed-data` | SDO |
| IoC-containing article | `indicator` (extracted IOCs) | SDO |

### TSG.C.4.8 Example BaseSignal Payload

```json
{
  "id": "sig_rss_01J9XLNQF7",
  "sourceId": "rss-us-cert-alerts",
  "timestamp": "2026-02-18T13:45:00.000Z",
  "version": [98, 312],
  "kind": "rss",
  "payload": {
    "feedUrl": "https://www.cisa.gov/feed/known-exploited-vulnerabilities",
    "feedTitle": "CISA Known Exploited Vulnerabilities",
    "itemGuid": "CVE-2026-1234-cisa-kev",
    "title": "CISA Adds CVE-2026-1234 to Known Exploited Vulnerabilities Catalog",
    "link": "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    "pubDate": "2026-02-18T13:00:00.000Z",
    "description": "CISA has added CVE-2026-1234 to its KEV catalog based on evidence of active exploitation.",
    "categories": ["vulnerability", "kev", "critical"],
    "author": "CISA"
  },
  "metadata": {
    "rss.feedTitle": "CISA KEV",
    "rss.pollIntervalMs": 300000,
    "discipline": "OSINT",
    "source.reliability": "A",
    "source.accuracy": "2",
    "tlp": "TLP:CLEAR"
  }
}
```

---

## TSG.C.5 `nats` -- NATS JetStream Signal

### TSG.C.5.1 Overview

| Property | Value |
|----------|-------|
| **Kind identifier** | `nats` |
| **Status** | Compile-time (`KnownSignalKind`) |
| **Category** | Adapter-native |
| **Schema file** | `src/lib/tsingou-flow/schemas/nats-signal.ts` (60 lines) |
| **Source adapter** | `NatsSourceAdapter` |
| **Transport** | NATS JetStream |
| **Frequency range** | 0-100 kHz+ (dependent on publisher rate) |
| **Intelligence disciplines** | Multi-INT (CYBINT, COMINT, ELINT, MASINT, FISINT) |

### TSG.C.5.2 Description

The `nats` signal kind represents messages received from external NATS subjects.
NATS serves a dual role in Tsingou: it is both the internal messaging fabric
(Holonet) and an external signal source. `NatsSignal` distinguishes messages
arriving from external publishers on monitored NATS subjects from internal
Holonet traffic. This is the highest-throughput adapter kind, supporting
100 kHz+ ingestion rates via JetStream consumers with configurable
acknowledgment policies.

The `nats` kind is the universal bridge for external signal processing systems.
GNU Radio SDR output, IDS alert streams, CDR event feeds, and sensor telemetry
all commonly publish to NATS subjects, making this the most multi-disciplinary
adapter kind.

### TSG.C.5.3 Payload Schema

```typescript
// Verified from schemas/nats-signal.ts:17-45
export const NatsPayload = Schema.Struct({
  subject: Schema.String,                               // REQUIRED
  data: Schema.Unknown,                                  // REQUIRED
  headers: Schema.optional(                              // OPTIONAL
    Schema.Record({ key: Schema.String, value: Schema.String }),
  ),
  sequence: Schema.optional(                             // OPTIONAL (JetStream)
    Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  ),
  stream: Schema.optional(Schema.String),                // OPTIONAL (JetStream)
  consumer: Schema.optional(Schema.String),              // OPTIONAL (JetStream)
  replyTo: Schema.optional(Schema.String),               // OPTIONAL (req-reply)
  serverTimestamp: Schema.optional(Schema.DateFromSelf),  // OPTIONAL
})
```

### TSG.C.5.4 Frequency Range

| Use Case | Typical Rate | JetStream Policy |
|----------|-------------|-----------------|
| SDR FFT output | 10-100 kHz | `AckExplicit`, batch ack |
| CDR event stream | 100-1,000 Hz | `AckExplicit` |
| IDS alert stream | 1-100 Hz | `AckExplicit` |
| Sensor telemetry | 10-10,000 Hz | `AckNone` or `AckExplicit` |
| STIX bundle publish | 0.01-1 Hz | `AckExplicit` |

### TSG.C.5.5 Processing Pipeline (d2ts)

| Stage | Operator | Description |
|-------|----------|-------------|
| 1. Ingest | `map` (subject dispatch) | Route `data` by NATS subject pattern |
| 2. Validate | `schemaValidate` | Validate `data` against registry by subject |
| 3. Parse | `map` (decode) | Decode structured data (JSON, MessagePack, Protobuf) |
| 4. Route | `filter` (subject prefix) | Split into discipline-specific sub-graphs |
| 5. Process | varies by discipline | Subject-dependent analysis operators |
| 6. Window | `window` (time or count) | Temporal or count-based aggregation |
| 7. Output | `map` (enrich) | Attach cross-reference data before rendering |

### TSG.C.5.6 Rendering Recommendations

| Visualization | Layer | Use Case |
|--------------|-------|----------|
| Subject topic tree | DOM (z:3) | Hierarchical NATS subject browser |
| Message rate chart | visx (z:1) | Per-subject throughput over time |
| Data inspection panel | DOM (z:3) | Raw/decoded message viewer |
| Latency histogram | visx (z:1) | Server-to-ingestion latency distribution |
| Cross-subject correlation | R3F (z:0) | Entity graph from joined subjects |

### TSG.C.5.7 STIX Mapping

The STIX mapping for `nats` signals is determined by the message content carried
in the `data` field, not by the `nats` kind itself. The NATS adapter is a
transport-level construct; the intelligence content is in the payload.

| NATS Subject Pattern | Typical STIX Type | Notes |
|---------------------|------------------|-------|
| `tsingou.signals.stix.*` | Original STIX type from bundle | Pass-through |
| `tsingou.signals.ioc.*` | `indicator` | IOC correlation results |
| `tsingou.signals.alert.*` | `observed-data` | IDS/SIEM alerts |
| `tsingou.signals.sdr.*` | `observed-data` with SDR extension | RF observations |
| Custom subjects | `x-tsingou-{subject-root}` | Custom STIX objects |

### TSG.C.5.8 Example BaseSignal Payload

```json
{
  "id": "sig_nats_01J9XPQZM3",
  "sourceId": "nats-ids-suricata",
  "timestamp": "2026-02-18T14:32:11.892Z",
  "version": [143, 1204],
  "kind": "nats",
  "payload": {
    "subject": "tsingou.signals.alert.suricata",
    "data": {
      "alert": {
        "signature_id": 2100498,
        "signature": "ET POLICY Outbound DNS Query to OpenDNS",
        "category": "policy-violation",
        "severity": 2
      },
      "src_ip": "10.0.1.15",
      "dest_ip": "208.67.222.222",
      "proto": "UDP"
    },
    "headers": {
      "Nats-Msg-Id": "suricata-evt-8832771"
    },
    "sequence": 8832771,
    "stream": "TSINGOU_ALERTS",
    "consumer": "tsingou-ingester-1",
    "serverTimestamp": "2026-02-18T14:32:11.890Z"
  },
  "metadata": {
    "nats.stream": "TSINGOU_ALERTS",
    "discipline": "CYBINT",
    "tlp": "TLP:AMBER"
  }
}
```

---

## TSG.C.6 `websocket` -- WebSocket Signal

### TSG.C.6.1 Overview

| Property | Value |
|----------|-------|
| **Kind identifier** | `websocket` |
| **Status** | Compile-time (`KnownSignalKind`) |
| **Category** | Adapter-native |
| **Schema file** | `src/lib/tsingou-flow/schemas/websocket-signal.ts` (55 lines) |
| **Source adapter** | `WebSocketSourceAdapter` |
| **Transport** | WebSocket (RFC 6455) |
| **Frequency range** | 0-10 kHz (event-driven) |
| **Intelligence disciplines** | CYBINT (primary), OSINT (secondary), MASINT (secondary) |

### TSG.C.6.2 Description

The `websocket` signal kind represents messages received from WebSocket
connections. The `WebSocketSourceAdapter` establishes persistent connections to
arbitrary WebSocket servers and emits one `BaseSignal` per message. Both text
and binary message types are supported. This adapter is critical for
real-time streaming feeds including market data, chat monitoring, IoT
telemetry (MQTT-over-WebSocket), and collaborative platform event streams.

### TSG.C.6.3 Payload Schema

```typescript
// Verified from schemas/websocket-signal.ts:20-40
export const WebSocketPayload = Schema.Struct({
  url: Schema.String,                                    // REQUIRED
  data: Schema.Unknown,                                   // REQUIRED
  type: WebSocketMessageType,                             // REQUIRED ('text'|'binary')
  protocol: Schema.optional(Schema.String),               // OPTIONAL (sub-protocol)
  byteLength: Schema.optional(Schema.Number),             // OPTIONAL (binary msg size)
  connectionSeq: Schema.optional(                         // OPTIONAL
    Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  ),
})
```

### TSG.C.6.4 Frequency Range

| Use Case | Typical Rate | Message Type |
|----------|-------------|-------------|
| Crypto exchange feed | 100-10,000 msg/s | text (JSON) |
| IRC/Matrix/Discord bridge | 0.1-10 msg/s | text |
| IoT MQTT-over-WS | 1-1,000 msg/s | text or binary |
| Collaborative doc changes | 1-100 msg/s | text (JSON) |

### TSG.C.6.5 Processing Pipeline (d2ts)

| Stage | Operator | Description |
|-------|----------|-------------|
| 1. Ingest | `map` (decode) | Parse text as JSON or interpret binary |
| 2. Validate | `schemaValidate` | Validate decoded data structure |
| 3. Route | `filter` (message type) | Separate by data schema |
| 4. Process | `window` + `aggregate` | Aggregate real-time streams |
| 5. Anomaly | `anomaly` (rate deviation) | Detect message rate anomalies |
| 6. Correlate | `join` (entity key) | Cross-reference with other sources |

### TSG.C.6.6 Rendering Recommendations

| Visualization | Layer | Use Case |
|--------------|-------|----------|
| Live message feed | DOM (z:3) | Real-time scrolling message display |
| Rate sparkline | visx (z:1) | Message rate over time |
| Binary data inspector | DOM (z:3) | Hex dump for binary messages |
| Connection status | DOM (z:3) | Connection health and reconnection events |
| Cross-source correlation | R3F (z:0) | Entity graph from joined WebSocket streams |

### TSG.C.6.7 STIX Mapping

| WebSocket Use Case | STIX Export Type | Category |
|-------------------|-----------------|----------|
| Chat message | `observed-data` | SDO |
| Market tick | `observed-data` with financial extension | SDO |
| IoT sensor reading | `observed-data` | SDO |
| Alert notification | `indicator` or `sighting` | SDO/SRO |

### TSG.C.6.8 Example BaseSignal Payload

```json
{
  "id": "sig_ws_01J9XR2LK8",
  "sourceId": "ws-discord-threatintel",
  "timestamp": "2026-02-18T14:35:42.103Z",
  "version": [144, 567],
  "kind": "websocket",
  "payload": {
    "url": "wss://gateway.discord.gg/?v=10&encoding=json",
    "data": {
      "t": "MESSAGE_CREATE",
      "d": {
        "channel_id": "1234567890",
        "content": "New C2 infrastructure detected: 203.0.113.47 port 443",
        "author": { "username": "threat_researcher" }
      }
    },
    "type": "text",
    "protocol": "json",
    "connectionSeq": 567
  },
  "metadata": {
    "ws.channel": "threat-intel-sharing",
    "discipline": "CYBINT",
    "tlp": "TLP:AMBER"
  }
}
```

---

## TSG.C.7 `file-watch` -- File Watch Signal

### TSG.C.7.1 Overview

| Property | Value |
|----------|-------|
| **Kind identifier** | `file-watch` |
| **Status** | Compile-time (`KnownSignalKind`) |
| **Category** | Adapter-native |
| **Schema file** | `src/lib/tsingou-flow/schemas/file-watch-signal.ts` (59 lines) |
| **Source adapter** | `FileWatchAdapter` |
| **Transport** | Filesystem events (inotify/kqueue/FSEvents) |
| **Frequency range** | Event-driven (0-100 events/s typical) |
| **Intelligence disciplines** | Multi-INT (file content determines discipline) |

### TSG.C.7.2 Description

The `file-watch` signal kind represents filesystem events detected by the
`FileWatchAdapter`. The adapter monitors directories for file creation,
modification, and deletion events. For create/modify events, the adapter
MAY parse file content (JSON, CSV, structured text) and include it in the
payload. This adapter serves as the batch import mechanism for intelligence
data drops, log file tailing, PCAP file monitoring, and configuration
change detection.

### TSG.C.7.3 Payload Schema

```typescript
// Verified from schemas/file-watch-signal.ts:20-44
export const FileWatchPayload = Schema.Struct({
  path: Schema.String,                                   // REQUIRED
  event: FileWatchEventType,                              // REQUIRED ('create'|'modify'|'delete')
  content: Schema.optional(Schema.Unknown),               // OPTIONAL (parsed file content)
  size: Schema.optional(                                  // OPTIONAL
    Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  ),
  mimeType: Schema.optional(Schema.String),               // OPTIONAL
  lineRange: Schema.optional(Schema.Struct({              // OPTIONAL (tail mode)
    start: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
    end: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  })),
  hash: Schema.optional(Schema.String),                   // OPTIONAL (dedup hash)
})
```

### TSG.C.7.4 Frequency Range

| Use Case | Typical Rate | Event Type |
|----------|-------------|-----------|
| Log file tailing | 1-100 events/s | `modify` (append) |
| Data drop directory | 0.01-1 events/s | `create` |
| PCAP file rotation | 0.001-0.01 events/s | `create` |
| Config change monitoring | 0-0.001 events/s | `modify` |

### TSG.C.7.5 Processing Pipeline (d2ts)

| Stage | Operator | Description |
|-------|----------|-------------|
| 1. Ingest | `map` (parse content) | Decode file content based on `mimeType` |
| 2. Dedup | `filter` (hash check) | Skip unchanged files via content hash |
| 3. Extract | `map` (content analysis) | Extract structured data from file content |
| 4. Route | `filter` (MIME type) | Route by content type to specialized pipelines |
| 5. Window | `window` (time or count) | Batch multiple file events for aggregate analysis |
| 6. Correlate | `join` (entity key) | Cross-reference extracted data with other sources |

### TSG.C.7.6 Rendering Recommendations

| Visualization | Layer | Use Case |
|--------------|-------|----------|
| File event log | DOM (z:3) | Chronological file event list |
| Directory tree browser | DOM (z:3) | Monitored directory structure |
| Log tail viewer | DOM (z:3) | Real-time log line display (tail mode) |
| File activity timeline | visx (z:1) | Event frequency over time by path |
| Content diff viewer | DOM (z:3) | Before/after for modify events |

### TSG.C.7.7 STIX Mapping

| File Watch Use Case | STIX Export Type | Category |
|--------------------|-----------------|----------|
| PCAP file | `artifact` (file hash, content) | SCO |
| Log entries | `observed-data` | SDO |
| Malware sample drop | `file` (SCO) + `malware` (SDO) | SCO/SDO |
| Config change | `observed-data` | SDO |

### TSG.C.7.8 Example BaseSignal Payload

```json
{
  "id": "sig_fw_01J9XSNTV2",
  "sourceId": "filewatch-pcap-drops",
  "timestamp": "2026-02-18T14:40:33.221Z",
  "version": [145, 23],
  "kind": "file-watch",
  "payload": {
    "path": "/data/captures/2026-02-18/capture-14h40.pcap",
    "event": "create",
    "size": 15728640,
    "mimeType": "application/vnd.tcpdump.pcap",
    "hash": "sha256:a1b2c3d4e5f6..."
  },
  "metadata": {
    "filewatch.directory": "/data/captures/",
    "filewatch.recursive": true,
    "discipline": "CYBINT"
  }
}
```

---

## TSG.C.8 `serial` -- Serial Port Signal

### TSG.C.8.1 Overview

| Property | Value |
|----------|-------|
| **Kind identifier** | `serial` |
| **Status** | Compile-time (`KnownSignalKind`) |
| **Category** | Adapter-native |
| **Schema file** | `src/lib/tsingou-flow/schemas/serial-signal.ts` (64 lines) |
| **Source adapter** | `SerialAdapter` |
| **Transport** | USB/UART (serialport lib, WebSerial API, or Tauri sidecar) |
| **Frequency range** | 9600-115200 baud (data rate dependent on baud and framing) |
| **Intelligence disciplines** | ELINT (primary), MASINT (primary), COMINT (secondary) |

### TSG.C.8.2 Description

The `serial` signal kind represents data received from USB/UART serial ports.
The `SerialAdapter` connects to serial devices, reads raw byte streams, applies
configurable parser types (line, delimiter, byte-length, ready, raw), and emits
one `BaseSignal` per parsed frame. This adapter bridges hardware sensors,
SDR output, GPS receivers, Arduino/ESP32 telemetry, and embedded device debug
output into the Tsingou pipeline.

### TSG.C.8.3 Payload Schema

```typescript
// Verified from schemas/serial-signal.ts:26-49
export const SerialPayload = Schema.Struct({
  port: Schema.String,                                   // REQUIRED
  baudRate: Schema.Number.pipe(Schema.int(), Schema.positive()), // REQUIRED
  raw: Schema.Uint8ArrayFromSelf,                         // REQUIRED
  parsed: Schema.optional(Schema.Unknown),                // OPTIONAL
  parserType: Schema.optional(SerialParserType),          // OPTIONAL
  delimiter: Schema.optional(Schema.String),              // OPTIONAL
  vendorId: Schema.optional(Schema.String),               // OPTIONAL
  productId: Schema.optional(Schema.String),              // OPTIONAL
  manufacturer: Schema.optional(Schema.String),           // OPTIONAL
})
```

### TSG.C.8.4 Parser Types

| Parser | Description | Frame Boundary | Use Case |
|--------|-------------|---------------|----------|
| `line` | Newline-delimited | `\n` or `\r\n` | NMEA sentences, text sensors |
| `delimiter` | Custom delimiter | User-specified byte/string | Protocol-specific framing |
| `byte-length` | Fixed byte count | N bytes per frame | IQ samples, fixed-format sensors |
| `ready` | Ready pattern match | Prompt string (e.g., `"> "`) | Interactive device commands |
| `raw` | No parsing | Chunk as received | Pass-through for external parsers |

### TSG.C.8.5 Frequency Range

| Baud Rate | Raw Throughput | Typical Signals/s (line parser) |
|-----------|---------------|-------------------------------|
| 9600 | ~960 bytes/s | 10-50 |
| 19200 | ~1,920 bytes/s | 20-100 |
| 57600 | ~5,760 bytes/s | 50-500 |
| 115200 | ~11,520 bytes/s | 100-1,000 |

### TSG.C.8.6 Processing Pipeline (d2ts)

| Stage | Operator | Description |
|-------|----------|-------------|
| 1. Ingest | `map` (frame parse) | Apply parser to raw bytes |
| 2. Validate | `schemaValidate` | Validate parsed output structure |
| 3. Decode | `map` (protocol decode) | NMEA, custom binary protocol, etc. |
| 4. Calibrate | `map` (sensor calibration) | Apply calibration curves if applicable |
| 5. Window | `window` (time-based) | Aggregate sensor readings |
| 6. Anomaly | `anomaly` (threshold) | Detect out-of-range values |
| 7. Correlate | `join` (sensor key) | Fuse multiple sensor streams |

### TSG.C.8.7 Rendering Recommendations

| Visualization | Layer | Use Case |
|--------------|-------|----------|
| Hex dump viewer | DOM (z:3) | Raw byte inspection |
| Parsed data table | DOM (z:3) | Structured sensor readings |
| Time-series chart | visx (z:1) | Sensor value over time |
| Spectrum display | p5 (z:2) | FFT of serial-delivered SDR data |
| GPS track overlay | R3F (z:0) | NMEA position data on map |
| Sensor health gauge | DOM (z:3) | Current value + threshold bands |

### TSG.C.8.8 STIX Mapping

Serial signals map to STIX when they carry intelligence-relevant data:

| Serial Use Case | STIX Export Type | Category |
|-----------------|-----------------|----------|
| SDR RF detection | `observed-data` with RF extension | SDO |
| GPS position | `location` | SDO |
| Sensor anomaly | `observed-data` | SDO |
| Device identification | `observed-data` | SDO |

### TSG.C.8.9 Example BaseSignal Payload

```json
{
  "id": "sig_ser_01J9XTVQH5",
  "sourceId": "serial-gps-nmea",
  "timestamp": "2026-02-18T14:42:18.050Z",
  "version": [146, 892],
  "kind": "serial",
  "payload": {
    "port": "/dev/ttyUSB0",
    "baudRate": 9600,
    "raw": "<Uint8Array: 24 47 50 47 47 41 2C ...>",
    "parsed": {
      "sentence": "GPGGA",
      "time": "144218.00",
      "latitude": 38.8977,
      "longitude": -77.0365,
      "quality": 1,
      "satellites": 8,
      "hdop": 1.2,
      "altitude": 15.3,
      "altitudeUnits": "M"
    },
    "parserType": "line"
  },
  "metadata": {
    "serial.baud": 9600,
    "serial.parser": "nmea",
    "discipline": "GEOINT"
  }
}
```

---

## TSG.C.9 `midi` -- MIDI Signal

### TSG.C.9.1 Overview

| Property | Value |
|----------|-------|
| **Kind identifier** | `midi` |
| **Status** | Compile-time (`KnownSignalKind`) |
| **Category** | Adapter-native |
| **Schema file** | `src/lib/tsingou-flow/schemas/midi-signal.ts` (89 lines) |
| **Source adapter** | `MidiAdapter` (stub -- implementation pending) |
| **Transport** | Web MIDI API (browser) / node-midi (Node.js sidecar) |
| **Frequency range** | Event-driven, 0-1 kHz |
| **Intelligence disciplines** | Control surface (not intelligence-domain-specific) |

### TSG.C.9.2 Description

The `midi` signal kind represents MIDI (Musical Instrument Digital Interface)
messages. In Tsingou's context, MIDI serves as a **control surface protocol**
rather than an intelligence data source. MIDI controllers (knobs, sliders,
buttons) provide tactile analyst input for adjusting d2ts graph parameters
(window sizes, thresholds, filter cutoffs) and navigation controls. MIDI is
also used for operator interaction logging and hardware sensor bridging via
Arduino/ESP32 serial-to-MIDI converters.

### TSG.C.9.3 Payload Schema

```typescript
// Verified from schemas/midi-signal.ts:47-74
export const MidiPayload = Schema.Struct({
  channel: MidiChannel,          // REQUIRED (0-15)
  type: MidiMessageType,         // REQUIRED (note-on|note-off|cc|...)
  note: Schema.optional(Midi7Bit),         // 0-127 (note events)
  velocity: Schema.optional(Midi7Bit),     // 0-127 (note events)
  cc: Schema.optional(Midi7Bit),           // 0-127 (CC events)
  value: Schema.optional(Midi7Bit),        // 0-127 (CC events)
  program: Schema.optional(Midi7Bit),      // 0-127 (program change)
  pitchBend: Schema.optional(Midi14Bit),   // -8192 to 8191
  pressure: Schema.optional(Midi7Bit),     // 0-127 (aftertouch)
  raw: Schema.optional(Schema.Array(Schema.Number)), // Raw bytes (sysex)
  deviceName: Schema.optional(Schema.String),
  deviceId: Schema.optional(Schema.String),
})
```

### TSG.C.9.4 MIDI Message Types

| Message Type | Required Payload Fields | Use Case |
|-------------|------------------------|----------|
| `note-on` | `note`, `velocity` | Key press, trigger event |
| `note-off` | `note`, `velocity` | Key release |
| `cc` | `cc`, `value` | Knob/slider continuous control |
| `program-change` | `program` | Preset/mode switch |
| `pitch-bend` | `pitchBend` | Pitch wheel, fine-grained control |
| `aftertouch` | `note`, `pressure` | Per-key pressure |
| `channel-pressure` | `pressure` | Global channel pressure |
| `sysex` | `raw` | System exclusive messages |

### TSG.C.9.5 Processing Pipeline (d2ts)

| Stage | Operator | Description |
|-------|----------|-------------|
| 1. Ingest | `map` (parse MIDI bytes) | Convert raw MIDI to typed payload |
| 2. Route | `filter` (message type) | Separate CC, notes, sysex |
| 3. Map | `map` (CC-to-parameter) | Map CC numbers to graph parameters |
| 4. Smooth | `iterate` (EWMA) | Smooth CC values to prevent jitter |
| 5. Apply | Side-effect: update atom | Write smoothed value to parameter atom |

### TSG.C.9.6 Rendering Recommendations

| Visualization | Layer | Use Case |
|--------------|-------|----------|
| MIDI monitor | DOM (z:3) | Real-time message log |
| CC value sliders | DOM (z:3) | Visual feedback for knob positions |
| Velocity heatmap | p5 (z:2) | Note velocity distribution |
| Device status | DOM (z:3) | Connected MIDI device health |

### TSG.C.9.7 STIX Mapping

MIDI signals are NOT mapped to STIX. MIDI is a control protocol, not an
intelligence data carrier. Implementations MUST NOT export MIDI signals as
STIX objects.

### TSG.C.9.8 Example BaseSignal Payload

```json
{
  "id": "sig_midi_01J9XVW3Q1",
  "sourceId": "midi-akai-mpk-mini",
  "timestamp": "2026-02-18T14:45:00.012Z",
  "version": [147, 34],
  "kind": "midi",
  "payload": {
    "channel": 0,
    "type": "cc",
    "cc": 74,
    "value": 93,
    "deviceName": "Akai MPK Mini MkIII",
    "deviceId": "midi-device-0"
  },
  "metadata": {
    "midi.mapping": "window-size-ms",
    "midi.range": "[100, 60000]"
  }
}
```

---

## TSG.C.10 `osc` -- Open Sound Control Signal

### TSG.C.10.1 Overview

| Property | Value |
|----------|-------|
| **Kind identifier** | `osc` |
| **Status** | Compile-time (`KnownSignalKind`) |
| **Category** | Adapter-native |
| **Schema file** | `src/lib/tsingou-flow/schemas/osc-signal.ts` (65 lines) |
| **Source adapter** | `OscAdapter` (stub -- implementation pending) |
| **Transport** | UDP |
| **Frequency range** | Event-driven, 0-10 kHz |
| **Intelligence disciplines** | MASINT (secondary), Control |

### TSG.C.10.2 Description

The `osc` signal kind represents Open Sound Control messages received via UDP.
OSC is a network protocol designed for real-time communication between
computers, sound synthesizers, and multimedia devices. In Tsingou, OSC
provides a bridge for IoT sensor networks, distributed monitoring systems,
and GNU Radio integrations that emit demodulated data via OSC endpoints.
The hierarchical address space (`/path/to/parameter`) maps naturally to
d2ts routing operators.

### TSG.C.10.3 Payload Schema

```typescript
// Verified from schemas/osc-signal.ts:35-50
export const OscPayload = Schema.Struct({
  address: Schema.String.pipe(Schema.startsWith('/')),   // REQUIRED (OSC address)
  args: Schema.Array(OscArgument),                        // REQUIRED (typed args)
  timetag: Schema.optional(Schema.Number),                // OPTIONAL (NTP timestamp)
  isBundle: Schema.optional(Schema.Boolean),              // OPTIONAL
  remoteAddress: Schema.optional(Schema.String),          // OPTIONAL (host:port)
})
```

### TSG.C.10.4 OSC Argument Types

| OSC Type Tag | Schema Mapping | Description |
|-------------|---------------|-------------|
| `i` (int32) | `Schema.Number` | 32-bit integer |
| `f` (float32) | `Schema.Number` | 32-bit float |
| `s` (string) | `Schema.String` | Null-terminated string |
| `b` (blob) | `Schema.Uint8ArrayFromSelf` | Binary blob |
| `T` / `F` | `Schema.Boolean` | True / False |
| `N` (nil) | `Schema.Null` | Null value |

### TSG.C.10.5 Frequency Range

| Use Case | Typical Rate | Address Pattern |
|----------|-------------|----------------|
| IoT sensor network | 1-100 Hz per sensor | `/sensors/{id}/{metric}` |
| GNU Radio demod output | 100-10,000 Hz | `/gnuradio/{flowgraph}/{metric}` |
| Environmental monitoring | 0.1-10 Hz | `/environment/{location}/{metric}` |
| Control surface | 0-1 kHz | `/control/{group}/{parameter}` |

### TSG.C.10.6 Processing Pipeline (d2ts)

| Stage | Operator | Description |
|-------|----------|-------------|
| 1. Ingest | `map` (address parse) | Extract hierarchy from address path |
| 2. Route | `filter` (address prefix) | Route by address tree to sub-graphs |
| 3. Decode | `map` (arg extraction) | Extract typed values from args array |
| 4. Window | `window` (time-based) | Aggregate sensor readings |
| 5. Anomaly | `anomaly` (threshold) | Detect out-of-range sensor values |
| 6. Fuse | `join` (sensor key) | Fuse multiple OSC sensor streams |

### TSG.C.10.7 Rendering Recommendations

| Visualization | Layer | Use Case |
|--------------|-------|----------|
| Address tree browser | DOM (z:3) | Hierarchical OSC address space |
| Sensor dashboard | visx (z:1) | Multi-metric time-series display |
| Generative visualization | p5 (z:2) | Sensor-driven generative art |
| Spatial sensor map | R3F (z:0) | Geolocated sensor positions |
| Bundle inspector | DOM (z:3) | OSC bundle contents viewer |

### TSG.C.10.8 STIX Mapping

| OSC Use Case | STIX Export Type | Category |
|-------------|-----------------|----------|
| Sensor reading | `observed-data` | SDO |
| Environmental alert | `observed-data` | SDO |
| SDR measurement | `observed-data` with RF extension | SDO |

### TSG.C.10.9 Example BaseSignal Payload

```json
{
  "id": "sig_osc_01J9XWKLR9",
  "sourceId": "osc-env-monitoring-bldg4",
  "timestamp": "2026-02-18T14:47:22.331Z",
  "version": [148, 412],
  "kind": "osc",
  "payload": {
    "address": "/sensors/bldg4/floor2/temperature",
    "args": [22.7],
    "remoteAddress": "192.168.4.100:9000"
  },
  "metadata": {
    "osc.bundle": false,
    "discipline": "MASINT",
    "sensor.type": "temperature",
    "sensor.unit": "celsius"
  }
}
```

---

## TSG.C.11 `sdr` -- Software-Defined Radio Signal (Planned)

### TSG.C.11.1 Overview

| Property | Value |
|----------|-------|
| **Kind identifier** | `sdr` |
| **Status** | Planned (not yet in `KnownSignalKind`; will be compile-time when implemented) |
| **Category** | Adapter-native |
| **Schema file** | `schemas/sdr-signal.ts` (planned -- not yet in codebase) |
| **Source adapter** | `SdrAdapter` (planned) |
| **Transport** | GNU Radio -> NATS/serial bridge -> Tsingou |
| **Frequency range** | 0-100 kHz (chunk delivery rate; RF frequency range 24 MHz - 1.7 GHz for RTL-SDR) |
| **Intelligence disciplines** | ELINT (primary), COMINT (primary) |

### TSG.C.11.2 Description

The `sdr` signal kind represents IQ (In-phase/Quadrature) sample chunks from
Software-Defined Radio hardware. Raw RF signals are captured by SDR dongles
(RTL-SDR, HackRF, USRP), processed by GNU Radio flowgraphs (decimation,
channelizing, demodulation), and delivered to Tsingou via a NATS or serial
bridge. Each signal carries a chunk of IQ samples along with metadata
specifying center frequency, sample rate, sample format, and optional SigMF
annotations.

### TSG.C.11.3 Planned Payload Schema

```typescript
// PLANNED -- not yet in codebase (from TSG.8.6.11)
export const SdrPayload = Schema.Struct({
  centerFreqHz: Schema.Number.pipe(Schema.positive()),       // REQUIRED
  sampleRate: Schema.Number.pipe(Schema.positive()),          // REQUIRED
  format: Schema.Literal('cu8', 'cs8', 'cf32', 'cs16'),      // REQUIRED
  samples: Schema.Uint8ArrayFromSelf,                          // REQUIRED
  sampleCount: Schema.optional(                                // OPTIONAL
    Schema.Number.pipe(Schema.int(), Schema.positive()),
  ),
  deviceId: Schema.optional(Schema.String),                    // OPTIONAL
  gainDb: Schema.optional(Schema.Number),                      // OPTIONAL
  bandwidthHz: Schema.optional(Schema.Number.pipe(Schema.positive())), // OPTIONAL
  sigmfAnnotation: Schema.optional(Schema.Unknown),            // OPTIONAL
  flowgraphId: Schema.optional(Schema.String),                 // OPTIONAL
  agcEnabled: Schema.optional(Schema.Boolean),                 // OPTIONAL
})
```

### TSG.C.11.4 IQ Sample Formats

| Format | Description | Bytes/Sample | Dynamic Range | Typical Source |
|--------|-------------|-------------|---------------|---------------|
| `cu8` | Complex unsigned 8-bit | 2 | 48 dB | RTL-SDR native output |
| `cs8` | Complex signed 8-bit | 2 | 48 dB | HackRF native output |
| `cs16` | Complex signed 16-bit | 4 | 96 dB | USRP, Airspy |
| `cf32` | Complex float 32-bit | 8 | ~150 dB | GNU Radio internal format |

### TSG.C.11.5 RF Frequency Bands

| Band | Frequency Range | Common Signals | SDR Coverage |
|------|----------------|---------------|-------------|
| VLF | 3-30 kHz | Submarine comms, nav | Requires upconverter |
| LF | 30-300 kHz | Navigation, time signals | Requires upconverter |
| MF | 300 kHz-3 MHz | AM broadcast, maritime | Requires upconverter |
| HF | 3-30 MHz | Shortwave, amateur | RTL-SDR (with direct sampling) |
| VHF | 30-300 MHz | FM broadcast, air traffic | RTL-SDR |
| UHF | 300 MHz-3 GHz | Mobile, GPS, ADS-B, AIS | RTL-SDR (to 1.7 GHz) |
| SHF | 3-30 GHz | Radar, satellite | Requires HackRF/USRP |

### TSG.C.11.6 Processing Pipeline (d2ts)

| Stage | Operator | Description |
|-------|----------|-------------|
| 1. Ingest | `map` (chunk reassembly) | Reassemble IQ chunks into contiguous buffers |
| 2. FFT | `map` (FFT operator) | Compute power spectral density |
| 3. Filter | `filter` (frequency band) | Select frequency range of interest |
| 4. Detect | `anomaly` (power threshold) | Detect signals above noise floor |
| 5. Demod | `map` (demodulation) | Demodulate detected signals (AM/FM/PSK) |
| 6. Classify | `join` (signal database) | Match against known signal characteristics |
| 7. Window | `window` (spectrogram) | Build time-frequency-power matrix |

### TSG.C.11.7 Rendering Recommendations

| Visualization | Layer | Use Case |
|--------------|-------|----------|
| Waterfall display | p5 (z:2) | Time x frequency x power heatmap |
| Spectrum plot (FFT) | p5 (z:2) | Real-time frequency power display |
| Constellation diagram | p5 (z:2) | I/Q phase diagram for modulation ID |
| Signal detection markers | visx (z:1) | Detected signal markers on spectrum |
| Emitter location map | R3F (z:0) | Geolocated emitter positions |
| Band occupancy chart | visx (z:1) | Frequency band utilization over time |

### TSG.C.11.8 STIX Mapping

| SDR Use Case | STIX Export Type | Category |
|-------------|-----------------|----------|
| RF observation | `observed-data` with RF extension | SDO |
| Emitter identification | `observed-data` + `identity` | SDO |
| Signal detection | `indicator` (RF signature) | SDO |
| Spectrum recording | `artifact` (SigMF file reference) | SCO |

### TSG.C.11.9 Example BaseSignal Payload

```json
{
  "id": "sig_sdr_01J9XYHLZ4",
  "sourceId": "sdr-rtlsdr-adsb",
  "timestamp": "2026-02-18T14:50:00.001Z",
  "version": [149, 44201],
  "kind": "sdr",
  "payload": {
    "centerFreqHz": 1090000000,
    "sampleRate": 2400000,
    "format": "cu8",
    "samples": "<Uint8Array: 4800 bytes = 2400 IQ pairs>",
    "sampleCount": 2400,
    "deviceId": "rtl-sdr-0",
    "gainDb": 42.0,
    "bandwidthHz": 2000000,
    "agcEnabled": false
  },
  "metadata": {
    "sdr.hardware": "RTL2832U",
    "sdr.antenna": "ADS-B 1090MHz",
    "sdr.flowgraph": "adsb-demod-v2",
    "discipline": "ELINT"
  }
}
```

---

## TSG.C.12 COMINT Signal Kinds

### TSG.C.12.1 Overview

COMINT (Communications Intelligence) signal kinds carry processed
communications intelligence data. These are runtime-registered kinds that
enter Tsingou via `HttpSourceAdapter` or `NatsSourceAdapter` from external
COMINT processing systems. Raw intercepts are NOT ingested -- Tsingou
processes metadata, CDR (Call Detail Records), traffic analysis products,
and NLP-extracted content.

**Normative Statement TSG.C-1**: COMINT signal kinds MUST use the `comint-`
prefix. Implementations SHOULD register the following kinds in the schema
registry.

### TSG.C.12.2 `comint-cdr` -- Call Detail Record

| Property | Value |
|----------|-------|
| **Kind identifier** | `comint-cdr` |
| **Status** | Runtime-registered |
| **Description** | Call Detail Records for contact chaining and traffic analysis |
| **Source adapter** | `HttpSourceAdapter` (CDR API), `NatsSourceAdapter` (CDR stream) |
| **Frequency range** | 1-1,000 Hz (event stream rate) |
| **Modulation type** | N/A (metadata, not RF) |
| **Typical bandwidth** | N/A |
| **d2ts pipeline** | `map` (extract selectors) -> `join` (1-2 hop chaining) -> `aggregate` (frequency) -> `iterate` (baseline) -> `anomaly` (deviation) |
| **Rendering layer** | R3F (contact graph), visx (communication timeline), DOM (selector detail) |
| **STIX mapping** | `observed-data` (CDR event), `relationship` (contact chain edges) |

**Payload schema (runtime-registered):**

```typescript
const ComintCdrPayload = Schema.Struct({
  caller: Schema.String,          // Caller selector (phone, email, IMSI)
  callee: Schema.String,          // Callee selector
  selectorType: Schema.Literal('phone', 'email', 'imsi', 'ip', 'domain', 'account'),
  startTime: Schema.DateFromSelf,
  endTime: Schema.optional(Schema.DateFromSelf),
  durationSec: Schema.optional(Schema.Number),
  protocol: Schema.optional(Schema.String),
  direction: Schema.optional(Schema.Literal('inbound', 'outbound', 'unknown')),
  cellTower: Schema.optional(Schema.Struct({
    id: Schema.String,
    latitude: Schema.Number,
    longitude: Schema.Number,
  })),
})
```

**Example payload:**

```json
{
  "id": "sig_comint_01J9Y0BKQ7",
  "sourceId": "comint-cdr-feed",
  "timestamp": "2026-02-18T15:00:12.441Z",
  "version": [150, 1234],
  "kind": "comint-cdr",
  "payload": {
    "caller": "+14155551234",
    "callee": "+442071234567",
    "selectorType": "phone",
    "startTime": "2026-02-18T14:58:00.000Z",
    "endTime": "2026-02-18T14:59:47.000Z",
    "durationSec": 107,
    "protocol": "VOIP/SIP",
    "direction": "outbound"
  },
  "metadata": {
    "discipline": "COMINT",
    "source.reliability": "B",
    "source.accuracy": "2",
    "tlp": "TLP:RED"
  }
}
```

### TSG.C.12.3 `comint-metadata` -- Communication Metadata

| Property | Value |
|----------|-------|
| **Kind identifier** | `comint-metadata` |
| **Status** | Runtime-registered |
| **Description** | Communication metadata (non-content) for traffic analysis |
| **Source adapter** | `HttpSourceAdapter`, `NatsSourceAdapter` |
| **Frequency range** | 10-10,000 Hz |
| **d2ts pipeline** | `window` (time bucketing) -> `count` (volume) -> `iterate` (EWMA baseline) -> `anomaly` (deviation) |
| **Rendering layer** | visx (volume chart, frequency heatmap), DOM (metadata table) |
| **STIX mapping** | `observed-data` |

### TSG.C.12.4 `comint-traffic` -- Traffic Analysis Product

| Property | Value |
|----------|-------|
| **Kind identifier** | `comint-traffic` |
| **Status** | Runtime-registered |
| **Description** | Processed traffic analysis results (volume, pattern, anomaly) |
| **Source adapter** | Derived (d2ts output), `NatsSourceAdapter` |
| **Frequency range** | 0.01-10 Hz (aggregated output) |
| **d2ts pipeline** | Input to further correlation stages; `join` (temporal) with OSINT |
| **Rendering layer** | visx (traffic charts), DOM (alert panel) |
| **STIX mapping** | `observed-data`, `indicator` (traffic anomaly) |

---

## TSG.C.13 ELINT Signal Kinds

### TSG.C.13.1 Overview

ELINT (Electronic Intelligence) signal kinds carry data derived from
non-communications electromagnetic emissions -- primarily radar systems.
These enter Tsingou from SDR hardware via GNU Radio processing and NATS
transport bridges.

**Normative Statement TSG.C-2**: ELINT signal kinds MUST use the `elint-`
prefix. PDW data MUST conform to the schema specified in TSG.2.4.3.

### TSG.C.13.2 `elint-pdw` -- Pulse Descriptor Word

| Property | Value |
|----------|-------|
| **Kind identifier** | `elint-pdw` |
| **Status** | Runtime-registered |
| **Description** | Radar pulse descriptor words for emitter analysis |
| **Source adapter** | `NatsSourceAdapter` (from GNU Radio PDW extractor) |
| **Frequency range** | 1-100 kHz (pulse rate dependent on emitter) |
| **RF frequency range** | 0.1-100,000 MHz (radar spectrum) |
| **Modulation types** | None (CW), linear FM, Barker, polyphase, frequency hop |
| **Typical bandwidth** | Pulse-dependent: 10 kHz (CW) to 500 MHz (wideband) |
| **d2ts pipeline** | `filter` (RF bin sort) -> `iterate` (PRI analysis) -> clustering (deinterleave) -> `join` (EOB match) |
| **Rendering layer** | p5 (waterfall, spectrum), visx (PDW scatter, PRI histogram), DOM (emitter table) |
| **STIX mapping** | `observed-data` with `x-tsingou-elint-pdw` extension |

**Payload schema (runtime-registered, per TSG.2.4.3):**

```typescript
const ElintPdwPayload = Schema.Struct({
  rf_mhz: Schema.Number.pipe(Schema.between(0.1, 100000)),
  toa_us: Schema.Number.pipe(Schema.positive()),
  pa_dbm: Schema.optional(Schema.Number.pipe(Schema.between(-150, 50))),
  pw_us: Schema.optional(Schema.Number.pipe(Schema.positive())),
  pri_us: Schema.optional(Schema.Number.pipe(Schema.positive())),
  aoa_deg: Schema.optional(Schema.Number.pipe(Schema.between(0, 360))),
  mop_type: Schema.optional(Schema.Literal(
    'none', 'linear_fm', 'barker', 'polyphase', 'frequency_hop', 'unknown'
  )),
  emitter_id: Schema.optional(Schema.String),
})
```

**Example payload:**

```json
{
  "id": "sig_elint_01J9Y2FGKW",
  "sourceId": "elint-sdr-gnuradio-1",
  "timestamp": "2026-02-18T15:05:00.000123Z",
  "version": [151, 88431],
  "kind": "elint-pdw",
  "payload": {
    "rf_mhz": 9400.0,
    "toa_us": 1708271100000123.0,
    "pa_dbm": -42.3,
    "pw_us": 1.5,
    "pri_us": 1000.0,
    "aoa_deg": 127.5,
    "mop_type": "none",
    "emitter_id": "EMIT-X-001"
  },
  "metadata": {
    "discipline": "ELINT",
    "sdr.device": "HackRF-One",
    "sdr.flowgraph": "pdw-extractor-v3",
    "tlp": "TLP:RED"
  }
}
```

### TSG.C.13.3 `elint-spectrum` -- Spectrum Snapshot

| Property | Value |
|----------|-------|
| **Kind identifier** | `elint-spectrum` |
| **Status** | Runtime-registered |
| **Description** | FFT spectrum snapshot for frequency occupancy analysis |
| **Source adapter** | `NatsSourceAdapter` (from GNU Radio FFT block) |
| **Frequency range** | 10-1,000 Hz (snapshot delivery rate) |
| **RF frequency range** | Center frequency +/- bandwidth/2 |
| **d2ts pipeline** | `window` (spectrogram accumulation) -> `aggregate` (peak detection) -> `anomaly` (new signal detection) |
| **Rendering layer** | p5 (waterfall, spectrum plot), visx (occupancy chart) |
| **STIX mapping** | `observed-data` with `x-tsingou-rf-spectrum` extension |

**Payload schema (runtime-registered):**

```typescript
const ElintSpectrumPayload = Schema.Struct({
  centerFreqMhz: Schema.Number,
  bandwidthMhz: Schema.Number,
  binCount: Schema.Number.pipe(Schema.int(), Schema.positive()),
  magnitudeDbm: Schema.Array(Schema.Number),  // FFT bin magnitudes
  sampleRateHz: Schema.Number.pipe(Schema.positive()),
  windowFunction: Schema.optional(Schema.Literal(
    'hann', 'hamming', 'blackman', 'flattop', 'kaiser', 'rectangular'
  )),
})
```

### TSG.C.13.4 `elint-emitter` -- Identified Emitter Report

| Property | Value |
|----------|-------|
| **Kind identifier** | `elint-emitter` |
| **Status** | Runtime-registered |
| **Description** | Identified emitter report from deinterleaving and EOB matching |
| **Source adapter** | Derived (d2ts output from `elint-pdw` processing) |
| **Frequency range** | 0.01-10 Hz (emitter report rate) |
| **d2ts pipeline** | Input to threat assessment; `join` (geolocation) for spatial analysis |
| **Rendering layer** | R3F (emitter location map), DOM (emitter catalog, threat badge), visx (activity timeline) |
| **STIX mapping** | `observed-data` + `identity` (emitter) + `relationship` (attributed-to) |

**Payload schema (runtime-registered):**

```typescript
const ElintEmitterPayload = Schema.Struct({
  emitterId: Schema.String,
  radarType: Schema.optional(Schema.Literal(
    'early_warning', 'height_finder', 'acquisition', 'track_while_scan',
    'fire_control', 'airborne_intercept', 'sar_isar', 'weather',
    'navigation', 'iff', 'unknown'
  )),
  scanPattern: Schema.optional(Schema.Literal(
    'circular', 'sector', 'raster', 'helical', 'conical',
    'track_while_scan', 'palmer', 'loro', 'electronic', 'frequency_agile'
  )),
  rfMhz: Schema.Number,
  priUs: Schema.Number,
  priType: Schema.optional(Schema.Literal(
    'stable', 'jittered', 'stagger', 'dwell_switch', 'sliding', 'unknown'
  )),
  pwUs: Schema.optional(Schema.Number),
  threatLevel: Schema.optional(Schema.Literal('friendly', 'neutral', 'hostile', 'unknown')),
  eobMatchConfidence: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  latitude: Schema.optional(Schema.Number),
  longitude: Schema.optional(Schema.Number),
  firstSeenAt: Schema.DateFromSelf,
  lastSeenAt: Schema.DateFromSelf,
  pulseCount: Schema.Number.pipe(Schema.int()),
})
```

---

## TSG.C.14 FISINT Signal Kinds

### TSG.C.14.1 Overview

FISINT (Foreign Instrumentation Signals Intelligence) signal kinds carry
telemetry data from aerospace, surface, and subsurface system testing.
FISINT support is OPTIONAL (MAY) per TSG.2-6.

**Normative Statement TSG.C-3**: FISINT signal kinds, if implemented,
MUST use the `fisint-` prefix.

### TSG.C.14.2 `fisint-telemetry` -- Telemetry Data

| Property | Value |
|----------|-------|
| **Kind identifier** | `fisint-telemetry` |
| **Status** | Runtime-registered (optional) |
| **Description** | Vehicle/system telemetry from instrumentation signals |
| **Source adapter** | `HttpSourceAdapter` (telemetry API), `NatsSourceAdapter` (telemetry stream) |
| **Frequency range** | 1-1,000 Hz |
| **Modulation type** | PCM/FM, PCM/PM (telemetry-specific) |
| **d2ts pipeline** | `map` (decode telemetry frames) -> `window` (trajectory assembly) -> `anomaly` (parameter exceedance) |
| **Rendering layer** | R3F (3D trajectory), visx (parameter time-series), DOM (event markers) |
| **STIX mapping** | `observed-data` with `x-tsingou-fisint` extension |

**Payload schema (runtime-registered):**

```typescript
const FisintTelemetryPayload = Schema.Struct({
  vehicleId: Schema.String,
  frameNumber: Schema.Number.pipe(Schema.int()),
  parameters: Schema.Record({
    key: Schema.String,
    value: Schema.Number,
  }),
  latitude: Schema.optional(Schema.Number),
  longitude: Schema.optional(Schema.Number),
  altitude: Schema.optional(Schema.Number),
  velocity: Schema.optional(Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  })),
  missionPhase: Schema.optional(Schema.String),
})
```

**Example payload:**

```json
{
  "id": "sig_fisint_01J9Y4ZMLP",
  "sourceId": "fisint-telemetry-api",
  "timestamp": "2026-02-18T15:10:00.500Z",
  "version": [152, 567],
  "kind": "fisint-telemetry",
  "payload": {
    "vehicleId": "LAUNCH-2026-047",
    "frameNumber": 12847,
    "parameters": {
      "altitude_km": 142.7,
      "velocity_mps": 2341.5,
      "acceleration_g": 3.2,
      "fuel_remaining_pct": 67.3,
      "temperature_c": 812.4
    },
    "latitude": 28.396,
    "longitude": -80.605,
    "altitude": 142700,
    "missionPhase": "ascent"
  },
  "metadata": {
    "discipline": "FISINT",
    "tlp": "TLP:RED"
  }
}
```

---

## TSG.C.15 MASINT Signal Kinds

### TSG.C.15.1 Overview

MASINT (Measurement and Signature Intelligence) signal kinds carry sensor
measurement data from acoustic, seismic, chemical, nuclear, infrared, and
other physical measurement systems. MASINT support is OPTIONAL (MAY)
per TSG.2-9.

**Normative Statement TSG.C-4**: MASINT signal kinds, if implemented,
MUST use the `masint-` prefix.

### TSG.C.15.2 `masint-sensor` -- Generic Sensor Measurement

| Property | Value |
|----------|-------|
| **Kind identifier** | `masint-sensor` |
| **Status** | Runtime-registered (optional) |
| **Description** | Generic sensor measurement from MASINT collection systems |
| **Source adapter** | `NatsSourceAdapter`, `WebSocketSourceAdapter`, `OscAdapter` |
| **Frequency range** | 0.1-10,000 Hz (sensor dependent) |
| **d2ts pipeline** | `map` (calibrate) -> `window` (aggregate) -> `anomaly` (threshold) -> `join` (multi-sensor fusion) |
| **Rendering layer** | visx (time-series), p5 (spectrogram), DOM (alert/gauge) |
| **STIX mapping** | `observed-data` with `x-tsingou-masint` extension |

**Payload schema (runtime-registered):**

```typescript
const MasintSensorPayload = Schema.Struct({
  sensorId: Schema.String,
  sensorType: Schema.Literal(
    'acoustic', 'seismic', 'infrared', 'chemical', 'nuclear',
    'electromagnetic', 'thermal', 'pressure', 'vibration', 'generic'
  ),
  value: Schema.Number,
  unit: Schema.String,
  quality: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  latitude: Schema.optional(Schema.Number),
  longitude: Schema.optional(Schema.Number),
  detectionZoneId: Schema.optional(Schema.String),
  threshold: Schema.optional(Schema.Struct({
    warning: Schema.Number,
    critical: Schema.Number,
  })),
})
```

### TSG.C.15.3 `masint-acoustic` -- Acoustic/Hydrophone Data

| Property | Value |
|----------|-------|
| **Kind identifier** | `masint-acoustic` |
| **Status** | Runtime-registered (optional) |
| **Description** | Acoustic sensor data for ACINT (acoustic intelligence) |
| **Source adapter** | `WebSocketSourceAdapter` (real-time hydrophone), `NatsSourceAdapter` |
| **Frequency range** | 100-48,000 Hz (audio sample rate) |
| **Typical bandwidth** | 20 Hz - 20 kHz (audible); up to 200 kHz (ultrasonic) |
| **d2ts pipeline** | `map` (FFT) -> spectrogram -> `anomaly` (signal detection) -> `join` (classification DB) |
| **Rendering layer** | p5 (spectrogram, waveform), visx (frequency analysis) |
| **STIX mapping** | `observed-data` with `x-tsingou-acoustic` extension |

---

## TSG.C.16 CYBINT Signal Kinds

### TSG.C.16.1 Overview

CYBINT (Cyber/Digital Network Intelligence) signal kinds carry cyber threat
intelligence data. CYBINT is a MUST-support discipline (TSG.2-7) and has the
richest signal kind vocabulary due to native alignment with STIX 2.1.

**Normative Statement TSG.C-5**: CYBINT signal kinds MUST use the `cybint-`
prefix. Implementations MUST support at minimum `cybint-ioc` and
`cybint-alert`.

### TSG.C.16.2 `cybint-ioc` -- Indicator of Compromise

| Property | Value |
|----------|-------|
| **Kind identifier** | `cybint-ioc` |
| **Status** | Runtime-registered |
| **Description** | Indicators of Compromise from threat intelligence feeds |
| **Source adapter** | `HttpSourceAdapter` (TAXII poll, REST API), `NatsSourceAdapter` |
| **Frequency range** | 0.01-100 Hz (feed update rate) |
| **d2ts pipeline** | `map` (IOC extraction) -> `join` (correlation with network telemetry) -> `window` (temporal clustering) -> `anomaly` (new IOC burst) |
| **Rendering layer** | DOM (IOC table, ATT&CK matrix), visx (IOC timeline), R3F (infrastructure graph) |
| **STIX mapping** | `indicator` (primary), `relationship` (indicates -> malware/attack-pattern) |

**Payload schema (runtime-registered):**

```typescript
const CybintIocPayload = Schema.Struct({
  iocType: Schema.Literal(
    'ipv4', 'ipv6', 'domain', 'url', 'email', 'file-hash-md5',
    'file-hash-sha256', 'file-name', 'registry-key', 'mutex',
    'certificate', 'user-agent', 'cidr', 'asn', 'cve'
  ),
  iocValue: Schema.String,
  confidence: Schema.optional(Schema.Number.pipe(Schema.between(0, 100))),
  severity: Schema.optional(Schema.Literal('low', 'medium', 'high', 'critical')),
  source: Schema.optional(Schema.String),
  attackPatterns: Schema.optional(Schema.Array(Schema.String)),  // ATT&CK technique IDs
  firstSeen: Schema.optional(Schema.DateFromSelf),
  lastSeen: Schema.optional(Schema.DateFromSelf),
  tags: Schema.optional(Schema.Array(Schema.String)),
})
```

**Example payload:**

```json
{
  "id": "sig_cybint_01J9Y7NXKP",
  "sourceId": "cybint-otx-pulse",
  "timestamp": "2026-02-18T15:20:33.712Z",
  "version": [153, 892],
  "kind": "cybint-ioc",
  "payload": {
    "iocType": "ipv4",
    "iocValue": "198.51.100.23",
    "confidence": 85,
    "severity": "high",
    "source": "AlienVault OTX",
    "attackPatterns": ["T1071.001", "T1105"],
    "firstSeen": "2026-02-15T00:00:00.000Z",
    "lastSeen": "2026-02-18T12:00:00.000Z",
    "tags": ["apt29", "c2", "cozyBear"]
  },
  "metadata": {
    "discipline": "CYBINT",
    "source.reliability": "B",
    "source.accuracy": "2",
    "tlp": "TLP:AMBER"
  }
}
```

### TSG.C.16.3 `cybint-alert` -- Security Alert

| Property | Value |
|----------|-------|
| **Kind identifier** | `cybint-alert` |
| **Status** | Runtime-registered |
| **Description** | Security alerts from IDS/IPS, SIEM, EDR systems |
| **Source adapter** | `NatsSourceAdapter` (Suricata/Zeek), `WebSocketSourceAdapter` (SIEM stream) |
| **Frequency range** | 1-1,000 Hz |
| **d2ts pipeline** | `map` (normalize alert format) -> `join` (IOC correlation) -> `window` (campaign grouping) -> `anomaly` (alert volume spike) |
| **Rendering layer** | DOM (alert dashboard), visx (alert timeline), R3F (attack graph) |
| **STIX mapping** | `sighting` (alert = sighting of indicator) |

**Payload schema (runtime-registered):**

```typescript
const CybintAlertPayload = Schema.Struct({
  alertId: Schema.String,
  ruleName: Schema.String,
  ruleId: Schema.optional(Schema.String),
  severity: Schema.Literal('info', 'low', 'medium', 'high', 'critical'),
  category: Schema.optional(Schema.String),
  srcIp: Schema.optional(Schema.String),
  dstIp: Schema.optional(Schema.String),
  srcPort: Schema.optional(Schema.Number),
  dstPort: Schema.optional(Schema.Number),
  protocol: Schema.optional(Schema.String),
  sensorId: Schema.optional(Schema.String),
  raw: Schema.optional(Schema.String),
})
```

### TSG.C.16.4 `cybint-netflow` -- Network Flow Data

| Property | Value |
|----------|-------|
| **Kind identifier** | `cybint-netflow` |
| **Status** | Runtime-registered |
| **Description** | Network flow records (NetFlow, IPFIX, sFlow) for traffic analysis |
| **Source adapter** | `NatsSourceAdapter` |
| **Frequency range** | 100-100,000 Hz |
| **d2ts pipeline** | `window` (aggregate by 5-tuple) -> `aggregate` (byte/packet counts) -> `anomaly` (traffic anomaly) -> `join` (IOC correlation) |
| **Rendering layer** | visx (traffic charts), R3F (network topology), DOM (flow table) |
| **STIX mapping** | `network-traffic` (SCO), `observed-data` (SDO) |

---

## TSG.C.17 OSINT Signal Kinds

### TSG.C.17.1 Overview

OSINT (Open Source Intelligence) signal kinds carry intelligence derived from
publicly available information. OSINT is a MUST-support discipline (TSG.2-11)
alongside CYBINT.

**Normative Statement TSG.C-6**: OSINT signal kinds MUST use the `osint-`
prefix. Implementations MUST support at minimum `osint-article`.

### TSG.C.17.2 `osint-article` -- News/Publication Article

| Property | Value |
|----------|-------|
| **Kind identifier** | `osint-article` |
| **Status** | Runtime-registered |
| **Description** | Processed news article or publication with NLP-extracted entities |
| **Source adapter** | `RssSourceAdapter` (primary), `HttpSourceAdapter` (API scraper) |
| **Frequency range** | 0.001-1 Hz (publication rate) |
| **d2ts pipeline** | `map` (NLP entity extraction) -> `join` (entity cross-reference) -> `window` (topic tracking) -> `anomaly` (publication burst) |
| **Rendering layer** | DOM (article feed, word cloud), visx (entity timeline, topic heatmap), R3F (geo-event map) |
| **STIX mapping** | `report` (primary), `observed-data` |

**Payload schema (runtime-registered):**

```typescript
const OsintArticlePayload = Schema.Struct({
  title: Schema.String,
  url: Schema.optional(Schema.String),
  source: Schema.String,
  publishedAt: Schema.DateFromSelf,
  language: Schema.optional(Schema.String),
  summary: Schema.optional(Schema.String),
  entities: Schema.optional(Schema.Array(Schema.Struct({
    text: Schema.String,
    type: Schema.Literal('person', 'organization', 'location', 'event', 'product', 'other'),
    confidence: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  }))),
  topics: Schema.optional(Schema.Array(Schema.String)),
  sentiment: Schema.optional(Schema.Literal('positive', 'negative', 'neutral', 'mixed')),
  locations: Schema.optional(Schema.Array(Schema.Struct({
    name: Schema.String,
    latitude: Schema.optional(Schema.Number),
    longitude: Schema.optional(Schema.Number),
  }))),
})
```

**Example payload:**

```json
{
  "id": "sig_osint_01J9Y9QZLH",
  "sourceId": "osint-rss-reuters",
  "timestamp": "2026-02-18T15:30:00.000Z",
  "version": [154, 78],
  "kind": "osint-article",
  "payload": {
    "title": "Major Telecommunications Outage Reported Across Eastern Europe",
    "url": "https://www.reuters.com/technology/2026/02/18/telecom-outage",
    "source": "Reuters",
    "publishedAt": "2026-02-18T15:25:00.000Z",
    "language": "en",
    "summary": "Multiple telecommunications providers report widespread service disruptions...",
    "entities": [
      { "text": "Eastern Europe", "type": "location", "confidence": 0.95 },
      { "text": "Deutsche Telekom", "type": "organization", "confidence": 0.88 }
    ],
    "topics": ["telecommunications", "infrastructure", "outage"],
    "sentiment": "negative",
    "locations": [
      { "name": "Warsaw", "latitude": 52.2297, "longitude": 21.0122 },
      { "name": "Berlin", "latitude": 52.5200, "longitude": 13.4050 }
    ]
  },
  "metadata": {
    "discipline": "OSINT",
    "source.reliability": "B",
    "source.accuracy": "2",
    "tlp": "TLP:GREEN"
  }
}
```

### TSG.C.17.3 `osint-social` -- Social Media Signal

| Property | Value |
|----------|-------|
| **Kind identifier** | `osint-social` |
| **Status** | Runtime-registered |
| **Description** | Social media posts/messages with extracted entities and sentiment |
| **Source adapter** | `HttpSourceAdapter` (API poll), `WebSocketSourceAdapter` (streaming) |
| **Frequency range** | 0.1-1,000 Hz (platform dependent) |
| **d2ts pipeline** | `map` (entity extraction) -> `window` (volume tracking) -> `aggregate` (sentiment scoring) -> `anomaly` (trend detection) |
| **Rendering layer** | DOM (social feed), visx (sentiment chart, mention timeline), R3F (geo-tagged posts) |
| **STIX mapping** | `observed-data` with social extension |

### TSG.C.17.4 `osint-advisory` -- Security Advisory

| Property | Value |
|----------|-------|
| **Kind identifier** | `osint-advisory` |
| **Status** | Runtime-registered |
| **Description** | Security advisories from CERT/CC, CISA, NVD, vendor bulletins |
| **Source adapter** | `RssSourceAdapter`, `HttpSourceAdapter` |
| **Frequency range** | 0.001-0.1 Hz |
| **d2ts pipeline** | `map` (CVE extraction) -> `join` (asset inventory correlation) -> `window` (advisory volume) |
| **Rendering layer** | DOM (advisory panel), visx (advisory timeline) |
| **STIX mapping** | `vulnerability` (CVE), `report` (advisory document) |

---

## TSG.C.18 STIX-Derived Signal Kinds

### TSG.C.18.1 Overview

STIX-derived signal kinds represent data ingested from STIX 2.1 bundles via
the TAXII transport or direct STIX bundle import. Each STIX object type maps
to a corresponding Tsingou signal kind with the `stix-` prefix per the
bidirectional codec (TSG.13, ADR-009).

**Normative Statement TSG.C-7**: STIX-derived signal kinds MUST use the
`stix-` prefix followed by the STIX object type name (e.g., `stix-indicator`,
`stix-malware`). The mapping MUST be bijective: each STIX type maps to
exactly one signal kind and vice versa.

### TSG.C.18.2 STIX SDO (STIX Domain Object) Kinds

| Kind | STIX Type | Description | d2ts Pipeline | Rendering Layer |
|------|-----------|-------------|---------------|-----------------|
| `stix-indicator` | `indicator` | Patterns to detect activity | `join` (IOC correlation) | DOM (pattern table), visx (timeline) |
| `stix-observed-data` | `observed-data` | Observed cyber/physical events | `window` + `aggregate` | visx (event timeline) |
| `stix-malware` | `malware` | Malware instance or family | `join` (sample correlation) | DOM (malware catalog), R3F (relationship graph) |
| `stix-threat-actor` | `threat-actor` | Identified threat group | `join` (attribution) | R3F (actor graph), DOM (profile card) |
| `stix-attack-pattern` | `attack-pattern` | ATT&CK technique | `map` (technique tagging) | DOM (ATT&CK matrix heatmap) |
| `stix-campaign` | `campaign` | Named threat campaign | `join` (campaign grouping) | visx (campaign timeline), DOM (detail) |
| `stix-vulnerability` | `vulnerability` | CVE/vulnerability | `join` (asset correlation) | DOM (vuln table), visx (severity timeline) |
| `stix-infrastructure` | `infrastructure` | Adversary infrastructure | `join` (IOC mapping) | R3F (infrastructure map) |
| `stix-tool` | `tool` | Legitimate tools used maliciously | `join` (process correlation) | DOM (tool catalog) |
| `stix-intrusion-set` | `intrusion-set` | Named intrusion set | `join` (attribution) | R3F (attribution graph) |
| `stix-report` | `report` | Threat intelligence report | N/A (reference) | DOM (report viewer) |
| `stix-identity` | `identity` | Person, org, or group | `join` (entity resolution) | R3F (entity graph) |
| `stix-location` | `location` | Geographic location | `join` (geo-correlation) | R3F (map marker) |

### TSG.C.18.3 STIX SRO (STIX Relationship Object) Kinds

| Kind | STIX Type | Description | d2ts Pipeline | Rendering Layer |
|------|-----------|-------------|---------------|-----------------|
| `stix-relationship` | `relationship` | Edge between two SDOs | `join` (graph construction) | R3F (edge in entity graph) |
| `stix-sighting` | `sighting` | Observation of indicator | `window` (sighting frequency) | visx (sighting timeline), DOM (sighting log) |

### TSG.C.18.4 STIX SCO (STIX Cyber Observable) Kinds

| Kind | STIX Type | Description | d2ts Pipeline | Rendering Layer |
|------|-----------|-------------|---------------|-----------------|
| `stix-artifact` | `artifact` | File/memory content reference | N/A (reference) | DOM (artifact viewer) |
| `stix-ipv4-addr` | `ipv4-addr` | IPv4 address observable | `join` (network correlation) | DOM (IP table), R3F (geo-IP map) |
| `stix-ipv6-addr` | `ipv6-addr` | IPv6 address observable | `join` (network correlation) | DOM (IP table) |
| `stix-domain-name` | `domain-name` | DNS domain | `join` (DNS correlation) | DOM (domain table), R3F (infra graph) |
| `stix-url` | `url` | URL observable | `join` (URL correlation) | DOM (URL table) |
| `stix-file` | `file` | File with hashes | `join` (hash correlation) | DOM (file table) |
| `stix-email-addr` | `email-addr` | Email address | `join` (contact correlation) | DOM (email table) |
| `stix-network-traffic` | `network-traffic` | Network flow record | `window` + `aggregate` | visx (traffic chart), R3F (topology) |
| `stix-process` | `process` | OS process | `anomaly` (behavior) | DOM (process tree) |
| `stix-software` | `software` | Software instance | `join` (asset correlation) | DOM (software inventory) |

### TSG.C.18.5 STIX Field Mapping

For all STIX-derived signal kinds, the BaseSignal fields map as follows:

| BaseSignal Field | STIX Common Property | Transformation |
|-----------------|---------------------|---------------|
| `id` | `id` | STIX format: `{type}--{uuid}` -> SignalId |
| `sourceId` | `created_by_ref` | STIX Identity ref -> SourceId |
| `timestamp` | `created` | ISO 8601 -> DateFromSelf |
| `version` | (none) | Assigned at ingestion: `[tick, source_seq]` |
| `kind` | `type` | `stix-{type}` prefix applied |
| `payload` | Object-specific properties | Full STIX object body |
| `metadata.stix.type` | `type` | Original STIX type string |
| `metadata.stix.spec_version` | `spec_version` | Always `"2.1"` |
| `metadata.stix.modified` | `modified` | STIX modification timestamp |
| `metadata.stix.object_marking_refs` | `object_marking_refs` | TLP marking UUIDs |

---

## TSG.C.19 System Signal Kinds

### TSG.C.19.1 Overview

System signal kinds are reserved for internal platform diagnostics, lifecycle
events, and health monitoring. These signals are NOT exported to STIX and
are NOT visible to analyst rendering layers by default.

**Normative Statement TSG.C-8**: System signal kinds MUST use the `_` prefix.
Implementations MUST NOT export system signals to STIX. System signals
SHOULD be filterable from analyst views.

### TSG.C.19.2 `_heartbeat` -- Adapter Heartbeat

| Property | Value |
|----------|-------|
| **Kind identifier** | `_heartbeat` |
| **Status** | System (reserved) |
| **Description** | Periodic health ping from adapters |
| **Frequency** | 1/30 Hz (every 30 seconds) per adapter |
| **Rendering** | System health dashboard only |
| **STIX mapping** | NONE |

### TSG.C.19.3 `_diagnostic` -- Diagnostic Event

| Property | Value |
|----------|-------|
| **Kind identifier** | `_diagnostic` |
| **Status** | System (reserved) |
| **Description** | Internal diagnostic events (schema validation failures, queue overflow, etc.) |
| **Frequency** | Event-driven (0-10 Hz) |
| **Rendering** | System diagnostic panel only |
| **STIX mapping** | NONE |

### TSG.C.19.4 `_lifecycle` -- Adapter Lifecycle Event

| Property | Value |
|----------|-------|
| **Kind identifier** | `_lifecycle` |
| **Status** | System (reserved) |
| **Description** | Adapter registration, connection, disconnection, error, unregistration |
| **Frequency** | Event-driven (rare, < 0.1 Hz) |
| **Rendering** | Adapter management panel only |
| **STIX mapping** | NONE |

### TSG.C.19.5 `_dead-letter` -- Dead Letter Signal

| Property | Value |
|----------|-------|
| **Kind identifier** | `_dead-letter` |
| **Status** | System (reserved) |
| **Description** | Signals that failed validation, retained for diagnostic inspection |
| **Frequency** | Event-driven (should be rare) |
| **Rendering** | Dead letter queue inspector only |
| **STIX mapping** | NONE |

---

## TSG.C.20 Signal Kind Registration

### TSG.C.20.1 Compile-Time Registration

The 8 (soon 9) compile-time signal kinds are registered via the
`KnownSignalKind` schema literal in `schemas/base-signal.ts`:

```typescript
export const KnownSignalKind = Schema.Literal(
  'midi',
  'osc',
  'nats',
  'http',
  'serial',
  'rss',
  'websocket',
  'file-watch',
  // 'sdr',  // Planned: add when SdrAdapter is implemented
)
```

These kinds have typed extension schemas (e.g., `MidiSignal`, `HttpSignal`)
and participate in the `Signal` discriminated union for exhaustive pattern
matching.

### TSG.C.20.2 Runtime Registration

Discipline-specific, STIX-derived, and custom signal kinds are registered
via the `SchemaRegistry` backed by NATS KV (`tsingou-schemas`):

```typescript
// Registering a CYBINT IOC kind at runtime
const entry: SchemaRegistryEntry = {
  kind: 'cybint-ioc',
  version: 1,
  jsonSchema: JSONSchema.make(CybintIocPayload),
  description: 'Indicator of Compromise from threat intelligence feeds',
  createdAt: new Date(),
  createdBy: 'tsingou-system',
}

await kv.put('cybint-ioc', JSON.stringify(entry))
```

### TSG.C.20.3 Kind Promotion

When a runtime-registered kind becomes stable and widely used, it SHOULD be
promoted to a compile-time kind by:

1. Adding the literal to `KnownSignalKind`
2. Creating a typed extension schema file in `schemas/`
3. Adding the extension to the `Signal` union in `signal-union.ts`
4. Updating the barrel export in `schemas/index.ts`

**Normative Statement TSG.C-9**: Kind promotion MUST NOT remove the runtime
registry entry. The compile-time schema and runtime registry entry MUST
coexist during a transition period of at least one major version to prevent
breaking existing integrations.

---

## TSG.C.21 Signal Kind to Intelligence Discipline Matrix

### TSG.C.21.1 Complete Mapping

This matrix shows every signal kind's relationship to each intelligence
discipline. **P** = Primary, **S** = Secondary, **-** = Not applicable.

| Kind | CYBINT | OSINT | COMINT | ELINT | GEOINT | MASINT | FISINT |
|------|--------|-------|--------|-------|--------|--------|--------|
| `http` | **P** | **P** | S | - | S | S | S |
| `rss` | S | **P** | - | - | - | - | - |
| `nats` | **P** | - | **P** | **P** | - | **P** | **P** |
| `websocket` | **P** | S | - | - | - | S | S |
| `file-watch` | S | S | S | - | - | - | - |
| `serial` | - | - | - | S | - | **P** | - |
| `midi` | - | - | - | - | - | - | - |
| `osc` | - | - | - | - | - | S | - |
| `sdr` (planned) | - | - | S | **P** | - | - | - |
| `comint-cdr` | - | - | **P** | - | S | - | - |
| `comint-metadata` | - | - | **P** | - | - | - | - |
| `comint-traffic` | - | - | **P** | - | - | - | - |
| `elint-pdw` | - | - | - | **P** | - | - | - |
| `elint-spectrum` | - | - | - | **P** | - | - | - |
| `elint-emitter` | - | - | - | **P** | S | - | - |
| `fisint-telemetry` | - | - | - | - | S | - | **P** |
| `masint-sensor` | - | - | - | - | - | **P** | - |
| `masint-acoustic` | - | - | - | - | - | **P** | - |
| `cybint-ioc` | **P** | - | - | - | - | - | - |
| `cybint-alert` | **P** | - | - | - | - | - | - |
| `cybint-netflow` | **P** | - | - | - | - | - | - |
| `osint-article` | - | **P** | - | - | S | - | - |
| `osint-social` | - | **P** | - | - | S | - | - |
| `osint-advisory` | S | **P** | - | - | - | - | - |
| `stix-indicator` | **P** | S | - | - | - | - | - |
| `stix-malware` | **P** | - | - | - | - | - | - |
| `stix-threat-actor` | **P** | S | - | - | - | - | - |
| `stix-observed-data` | **P** | S | S | S | S | S | S |

---

## TSG.C.22 Signal Kind to Rendering Layer Matrix

### TSG.C.22.1 Recommended Primary Rendering Layers

| Kind | R3F (z:0) | visx (z:1) | p5 (z:2) | DOM (z:3) |
|------|-----------|-----------|----------|-----------|
| `http` | geo-overlay | timeline, charts | - | feed, table |
| `rss` | geo-events | timeline, heatmap | - | feed, word cloud |
| `nats` | correlation graph | rate chart | - | subject browser |
| `websocket` | correlation graph | rate sparkline | - | message feed |
| `file-watch` | - | activity timeline | - | event log, diff |
| `serial` | GPS track | time-series | spectrum | hex dump, table |
| `midi` | - | - | velocity heatmap | MIDI monitor |
| `osc` | sensor map | sensor dashboard | generative vis | address tree |
| `sdr` | emitter map | band occupancy | waterfall, FFT | - |
| `comint-cdr` | contact graph | comm timeline | - | selector detail |
| `elint-pdw` | - | PDW scatter, PRI hist | waterfall | emitter table |
| `elint-emitter` | emitter location | activity timeline | - | emitter catalog |
| `cybint-ioc` | infra graph | IOC timeline | - | IOC table, ATT&CK |
| `cybint-alert` | attack graph | alert timeline | - | alert dashboard |
| `osint-article` | geo-event map | entity timeline | - | article feed |
| `stix-indicator` | - | indicator timeline | - | pattern table |
| `stix-threat-actor` | actor graph | - | - | profile card |
| `stix-relationship` | graph edge | - | - | - |

---

## TSG.C.23 Normative Requirements Summary

| ID | Requirement | Level | Section |
|----|------------|-------|---------|
| TSG.C-1 | COMINT signal kinds MUST use `comint-` prefix | MUST | TSG.C.12.1 |
| TSG.C-2 | ELINT signal kinds MUST use `elint-` prefix; PDW schema per TSG.2.4.3 | MUST | TSG.C.13.1 |
| TSG.C-3 | FISINT signal kinds MUST use `fisint-` prefix | MUST (if implemented) | TSG.C.14.1 |
| TSG.C-4 | MASINT signal kinds MUST use `masint-` prefix | MUST (if implemented) | TSG.C.15.1 |
| TSG.C-5 | CYBINT kinds MUST use `cybint-` prefix; MUST support `cybint-ioc`, `cybint-alert` | MUST | TSG.C.16.1 |
| TSG.C-6 | OSINT kinds MUST use `osint-` prefix; MUST support `osint-article` | MUST | TSG.C.17.1 |
| TSG.C-7 | STIX-derived kinds MUST use `stix-` prefix; bijective type mapping | MUST | TSG.C.18.1 |
| TSG.C-8 | System kinds MUST use `_` prefix; MUST NOT export to STIX | MUST | TSG.C.19.1 |
| TSG.C-9 | Kind promotion MUST NOT remove runtime registry entry | MUST | TSG.C.20.3 |
| TSG.C-10 | All signal kinds MUST conform to naming convention in TSG.8.4.4 | MUST | TSG.C.1.3 |
| TSG.C-11 | Adapter-native kinds MUST have compile-time typed extension schemas | MUST | TSG.C.1.5 |
| TSG.C-12 | Discipline-specific kinds SHOULD register payload schemas in NATS KV registry | SHOULD | TSG.C.20.2 |
| TSG.C-13 | MIDI signals MUST NOT be exported to STIX | MUST NOT | TSG.C.9.7 |
| TSG.C-14 | System signals (`_` prefix) SHOULD be filterable from analyst views | SHOULD | TSG.C.19.1 |

---

## TSG.C.24 References

| Key | Reference |
|-----|-----------|
| [RFC2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997 |
| [RFC8174] | Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017 |
| [TSG.2] | RFC Section TSG.2: SIGINT/OSINT Domain Reference |
| [TSG.8] | RFC Section TSG.8: BaseSignal Schema |
| [TSG.9] | RFC Section TSG.9: Source Adapter Contract |
| [TSG.12] | RFC Section TSG.12: STIX Data Model |
| [TSG.13] | RFC Section TSG.13: BaseSignal <-> STIX Codec |
| [ADR-009] | ADR-009: STIX as Bidirectional Codec |
| [ADR-011] | ADR-011: SDR/GNU Radio Bridge |
| [STIX-2.1] | OASIS CTI TC. "STIX Version 2.1." https://docs.oasis-open.org/cti/stix/v2.1/stix-v2.1.html |
| [EFFECT-SCHEMA] | Effect-TS. "@effect/schema -- Schema validation and transformation." |
| [JP-2-0] | Joint Publication 2-0, Joint Intelligence (2013, revised 2022) |
| [ATT&CK] | MITRE ATT&CK Framework, Enterprise Matrix v14 (2024) |
| [SIGMF] | The SigMF Specification. "Signal Metadata Format." https://sigmf.org |
| [MIDI-SPEC] | MIDI Manufacturers Association. "MIDI 1.0 Detailed Specification." |
| [OSC-SPEC] | Wright, M. and Freed, A., "Open Sound Control: A New Protocol for Communicating with Sound Synthesizers." |
| [NATS] | NATS.io. "NATS -- Cloud Native Messaging System." https://nats.io |

---

*Appendix C -- Signal Kind Catalog. 14 normative statements. 9 adapter-native kinds,*
*15 discipline-specific kinds, 15 STIX-derived kinds, 4 system kinds = 43 total signal kinds.*
*Cross-references: TSG.2 (SIGINT Domain), TSG.8 (BaseSignal Schema), TSG.9 (Source Adapters),*
*TSG.12/13 (STIX Data Model/Codec).*
