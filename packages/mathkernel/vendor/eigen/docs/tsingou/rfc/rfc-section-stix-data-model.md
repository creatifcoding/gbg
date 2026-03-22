# TSG.12 STIX 2.1 Data Model

```
Section:     TSG.12
Title:       STIX 2.1 Data Model
Status:      DRAFT
Author:      stix-specialist
RFC:         TMNL-RFC-002
Depends:     TSG.8 (BaseSignal Schema), TSG.7 (Signal Pipeline)
```

---

## TSG.12.1 Introduction

This section defines how the Tsingou platform adopts STIX 2.1 (Structured Threat Information eXpression) [STIX21] as its canonical interoperability data model. STIX 2.1 provides a standardized vocabulary and serialization format for representing cyber threat intelligence (CTI), enabling Tsingou to exchange signal observations, analytical findings, and threat indicators with external CTI platforms.

Tsingou does NOT replace its internal BaseSignal format (TSG.8) with STIX. Rather, STIX serves as the **interoperability boundary** — a codec layer that translates between the lean, real-time BaseSignal representation and the rich, standards-compliant STIX representation required by external consumers.

### TSG.12.1.1 Normative References

| Key | Reference |
|-----|-----------|
| [STIX21] | OASIS, "STIX Version 2.1", Committee Specification 03, June 2020 |
| [RFC2119] | IETF, "Key words for use in RFCs to Indicate Requirement Levels", March 1997 |
| [RFC8174] | IETF, "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", May 2017 |
| [RFC4122] | IETF, "A Universally Unique IDentifier (UUID) URN Namespace", July 2005 |
| [STIXPATT] | OASIS, "STIX Patterning Language", Part 9 of STIX 2.1, June 2020 |

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in all capitals, as shown here.

### TSG.12.1.2 Scope

This section covers:

1. The subset of STIX 2.1 object types relevant to Tsingou signal intelligence
2. Custom STIX extensions (SCOs) for signal kinds without native STIX equivalents
3. The identity architecture for Tsingou-generated intelligence
4. STIX bundle structure for signal export
5. Deterministic UUID mapping between BaseSignal IDs and STIX IDs
6. Confidence and marking definition assignments

This section does NOT cover:
- The codec implementation (see TSG.13)
- The TAXII transport layer (see TSG.14)
- Platform-specific integration adapters (see TSG.15)

---

## TSG.12.2 STIX 2.1 Object Type Inventory

### TSG.12.2.1 Object Categories

STIX 2.1 defines 42 object types across four categories:

| Category | Count | Purpose |
|----------|-------|---------|
| STIX Domain Objects (SDOs) | 18 | High-level intelligence concepts |
| STIX Relationship Objects (SROs) | 2 | Links between objects |
| STIX Cyber-observable Objects (SCOs) | 18 | Technical observables |
| Meta Objects | 4 | Bundles, markings, extensions |

### TSG.12.2.2 Tsingou Relevance Classification

Implementations MUST support object types classified as CRITICAL. Implementations SHOULD support types classified as HIGH. Types classified as MEDIUM or LOW are OPTIONAL.

**SDO Relevance:**

| SDO Type | Relevance | Tsingou Use Case |
|----------|-----------|-----------------|
| observed-data | CRITICAL | Primary export container for all signal observations |
| indicator | CRITICAL | d2ts anomaly detection rules exported as STIX patterns |
| identity | CRITICAL | Source attribution for all Tsingou-generated intelligence |
| report | HIGH | Aggregated analysis reports from d2ts pipeline |
| note | HIGH | Analyst annotations on signal observations |
| grouping | HIGH | Logical grouping of related signals |
| opinion | MEDIUM | Analyst confidence assertions |
| malware | MEDIUM | Malware samples detected in signal payloads |
| vulnerability | MEDIUM | CVE references correlated with signals |
| threat-actor | MEDIUM | Attribution of signal sources to actors |
| attack-pattern | MEDIUM | MITRE ATT&CK technique mapping |
| intrusion-set | LOW | Campaign-level attribution |
| campaign | LOW | Multi-signal campaign tracking |
| tool | LOW | Tool identification from signals |
| infrastructure | LOW | Infrastructure mapping from network signals |
| course-of-action | LOW | Automated response recommendations |
| malware-analysis | LOW | Payload analysis results |
| location | LOW | Geospatial context for signals |

**SRO Relevance:**

| SRO Type | Relevance | Tsingou Use Case |
|----------|-----------|-----------------|
| relationship | CRITICAL | Links between signals, indicators, and entities |
| sighting | CRITICAL | Records when a signal matches a known indicator |

**SCO Relevance:**

| SCO Type | Relevance | Signal Kind Affinity |
|----------|-----------|---------------------|
| network-traffic | CRITICAL | http, websocket |
| ipv4-addr / ipv6-addr | CRITICAL | http, nats, websocket |
| url | CRITICAL | http, rss, websocket |
| domain-name | HIGH | http, rss |
| file | HIGH | file-watch |
| artifact | HIGH | serial, file-watch (raw bytes) |
| email-addr | MEDIUM | rss (author field) |
| software | MEDIUM | http (User-Agent), serial (device firmware) |
| user-account | LOW | http (auth), nats (credentials) |
| process | LOW | Sidecar process monitoring |
| autonomous-system | LOW | Network attribution |
| mac-addr | LOW | Serial device identification |
| directory | LOW | file-watch (parent directory) |
| windows-registry-key | NONE | Not applicable |
| x509-certificate | LOW | TLS signals |
| email-message | LOW | RSS-derived email content |
| mutex | NONE | Not applicable |
| windows-pe-* | NONE | Not applicable |

### TSG.12.2.3 Custom SCO Extensions

Five signal kinds lack native STIX 2.1 SCO equivalents. Implementations MUST define custom extensions per Section 11.2 of [STIX21].

**Custom Extension Registry:**

| Custom SCO Type | Signal Kind | Justification |
|----------------|-------------|---------------|
| x-tsingou-nats-message | nats | NATS messaging is not a standard CTI observable |
| x-tsingou-midi-event | midi | MIDI is not a standard CTI observable |
| x-tsingou-osc-message | osc | OSC is not a standard CTI observable |
| x-tsingou-serial-data | serial | Serial port data requires custom properties |
| x-tsingou-sdr-capture | (future: sdr) | SDR/RF captures are not standard CTI observables |

Each custom SCO MUST be registered via a STIX `extension-definition` object (see TSG.12.5).

---

## TSG.12.3 Signal Kind to STIX Mapping

### TSG.12.3.1 Mapping Architecture

Every BaseSignal (TSG.8) is exported to STIX as an `observed-data` SDO containing one or more SCO references. The `observed-data` serves as the temporal container, while the SCOs carry the signal payload content.

```
BaseSignal                     STIX Bundle
──────────                     ───────────
{                              {
  id: SignalId,                  type: "bundle",
  sourceId: SourceId,            objects: [
  timestamp: Date,                 {
  kind: "nats",                      type: "observed-data",
  payload: NatsPayload,              first_observed: timestamp,
  metadata: SignalMetadata           last_observed: timestamp,
}                                    number_observed: 1,
                                     object_refs: [
                                       "x-tsingou-nats-message--uuid"
                                     ]
                                   },
                                   {
                                     type: "x-tsingou-nats-message",
                                     id: "x-tsingou-nats-message--uuid",
                                     subject: "tsingou.signals.nats.temp",
                                     data: { ... },
                                     headers: { ... }
                                   },
                                   {
                                     type: "identity",
                                     id: "identity--tsingou-platform-uuid",
                                     name: "Tsingou SIGINT Platform",
                                     identity_class: "system"
                                   }
                                 ]
                               }
```

### TSG.12.3.2 Per-Kind Mapping Table

Implementations MUST map each signal kind according to this table:

| Signal Kind | Primary SCO | Secondary SCOs | observed-data object_refs |
|------------|-------------|---------------|--------------------------|
| nats | x-tsingou-nats-message | ipv4-addr (if headers contain remote) | [nats-msg, ?ip] |
| http | network-traffic | url, ipv4-addr/ipv6-addr, domain-name | [net-traffic, url, ip, ?domain] |
| websocket | network-traffic | url, ipv4-addr/ipv6-addr | [net-traffic, url, ip] |
| midi | x-tsingou-midi-event | software (device) | [midi-evt, ?software] |
| osc | x-tsingou-osc-message | ipv4-addr (remote), software | [osc-msg, ?ip, ?software] |
| serial | x-tsingou-serial-data | artifact (raw bytes), software (device) | [serial-data, ?artifact, ?software] |
| rss | url | artifact (content), email-addr (author) | [url, ?artifact, ?email] |
| file-watch | file | directory (parent), artifact (content) | [file, ?directory, ?artifact] |

The `?` prefix denotes OPTIONAL SCOs — included only when the corresponding payload field is non-empty.

### TSG.12.3.3 HTTP Signal Mapping (Detailed)

The HTTP signal kind maps to standard STIX network SCOs:

```
HttpPayload                              STIX SCOs
───────────                              ─────────
url ────────────────────────────────────► url { value: payload.url }
method + statusCode ────────────────────► (embedded in network-traffic extensions)
headers ────────────────────────────────► network-traffic { extensions: { http-request-ext } }
body ───────────────────────────────────► artifact { payload_bin: base64(body) }
sseEventType / sseEventId ─────────────► (custom property on network-traffic)
responseTimeMs ─────────────────────────► (custom property on observed-data)
```

**network-traffic SCO structure:**

```json
{
  "type": "network-traffic",
  "id": "network-traffic--<uuid>",
  "src_ref": "ipv4-addr--<client-uuid>",
  "dst_ref": "ipv4-addr--<server-uuid>",
  "dst_port": 443,
  "protocols": ["tcp", "http"],
  "extensions": {
    "http-request-ext": {
      "request_method": "GET",
      "request_value": "/api/data",
      "request_header": {
        "Content-Type": "application/json",
        "User-Agent": "Tsingou/1.0"
      }
    }
  }
}
```

### TSG.12.3.4 NATS Signal Mapping (Detailed)

NATS signals use the custom `x-tsingou-nats-message` SCO:

```json
{
  "type": "x-tsingou-nats-message",
  "id": "x-tsingou-nats-message--<uuid>",
  "spec_version": "2.1",
  "extensions": {
    "extension-definition--<nats-ext-uuid>": {
      "extension_type": "new-sco"
    }
  },
  "subject": "tsingou.signals.temperature.sensor-01",
  "data": {
    "temperature": 72.5,
    "unit": "fahrenheit",
    "sensor_id": "temp-001"
  },
  "headers": {
    "Nats-Msg-Id": "msg-12345"
  },
  "sequence": 42,
  "stream": "SIGNALS",
  "consumer": "tsingou-processor",
  "reply_to": null,
  "server_timestamp": "2026-02-18T10:30:00.000Z"
}
```

### TSG.12.3.5 MIDI Signal Mapping (Detailed)

MIDI signals use the custom `x-tsingou-midi-event` SCO:

```json
{
  "type": "x-tsingou-midi-event",
  "id": "x-tsingou-midi-event--<uuid>",
  "spec_version": "2.1",
  "extensions": {
    "extension-definition--<midi-ext-uuid>": {
      "extension_type": "new-sco"
    }
  },
  "channel": 0,
  "message_type": "note-on",
  "note": 60,
  "velocity": 100,
  "device_name": "Arturia KeyLab 61",
  "device_id": "usb-midi-001"
}
```

### TSG.12.3.6 File-Watch Signal Mapping (Detailed)

File-watch signals map to the standard STIX `file` SCO:

```json
{
  "type": "file",
  "id": "file--<uuid>",
  "spec_version": "2.1",
  "name": "config.yaml",
  "size": 4096,
  "hashes": {
    "SHA-256": "<hash-from-payload>"
  },
  "mime_type": "application/yaml",
  "parent_directory_ref": "directory--<uuid>"
}
```

With accompanying `directory` SCO:

```json
{
  "type": "directory",
  "id": "directory--<uuid>",
  "path": "/etc/tsingou/config/"
}
```

---

## TSG.12.4 Deterministic UUID Mapping

### TSG.12.4.1 UUID Generation Strategy

STIX 2.1 requires UUIDs in the format `<type>--<uuid>` [STIX21, Section 2.9]. Implementations MUST use UUID v5 (name-based, SHA-1) [RFC4122] to generate deterministic STIX IDs from BaseSignal IDs.

This ensures:
1. **Idempotency**: The same BaseSignal always produces the same STIX ID
2. **Round-trip fidelity**: STIX IDs can be reversed to recover the original SignalId
3. **Deduplication**: CTI platforms can detect and merge duplicate observations

### TSG.12.4.2 UUID Namespace

Implementations MUST use the following UUID v5 namespace for all Tsingou-generated STIX objects:

```
TSINGOU_STIX_NAMESPACE = UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")  // DNS namespace
  → v5(DNS_NS, "tsingou.stix.local")
  = <computed-namespace-uuid>
```

**Mapping formula:**

```
STIX_UUID = UUIDv5(TSINGOU_NS, BaseSignal.id)
STIX_ID   = "<stix-type>--" + STIX_UUID
```

**Example:**

```
BaseSignal.id = "sig_abc123def456"
Signal.kind   = "nats"

observed-data ID = "observed-data--" + UUIDv5(TSINGOU_NS, "sig_abc123def456")
                 = "observed-data--7f3a8b2c-4d5e-5f6a-8b9c-0d1e2f3a4b5c"

SCO ID = "x-tsingou-nats-message--" + UUIDv5(TSINGOU_NS, "sig_abc123def456:sco:0")
       = "x-tsingou-nats-message--a1b2c3d4-e5f6-5789-abcd-ef1234567890"
```

### TSG.12.4.3 Reverse Mapping

Implementations SHOULD maintain a lookup table mapping STIX UUIDs back to BaseSignal IDs:

```
Map<STIX_UUID, SignalId>
```

This table is populated during codec encoding and consulted during decoding, enabling round-trip conversion.

### TSG.12.4.4 UUID Collision Handling

UUID v5 with SHA-1 has a theoretical collision probability of 2^(-80). Implementations MUST NOT rely on collision-free guarantees and SHOULD implement:

1. Log warnings if a UUID collision is detected
2. Append a monotonic counter suffix to the namespace input on collision
3. Never silently overwrite an existing STIX object with a different BaseSignal

---

## TSG.12.5 Custom Extension Definitions

### TSG.12.5.1 Extension Registration

Each custom SCO MUST be accompanied by a STIX `extension-definition` object included in every bundle that references the custom type:

```json
{
  "type": "extension-definition",
  "id": "extension-definition--<stable-uuid>",
  "spec_version": "2.1",
  "name": "Tsingou NATS Message Observable",
  "description": "Custom STIX Cyber-observable Object for NATS messaging system messages captured by the Tsingou SIGINT platform.",
  "created": "2026-01-01T00:00:00.000Z",
  "modified": "2026-01-01T00:00:00.000Z",
  "created_by_ref": "identity--<tsingou-identity-uuid>",
  "schema": "https://tsingou.example.com/stix/extensions/x-tsingou-nats-message/v1.0/schema.json",
  "version": "1.0.0",
  "extension_types": ["new-sco"]
}
```

### TSG.12.5.2 Extension Definition Registry

| Extension ID (stable) | Custom SCO Type | Version | Schema URL |
|-----------------------|----------------|---------|------------|
| extension-definition--e1 | x-tsingou-nats-message | 1.0.0 | .../x-tsingou-nats-message/v1.0/schema.json |
| extension-definition--e2 | x-tsingou-midi-event | 1.0.0 | .../x-tsingou-midi-event/v1.0/schema.json |
| extension-definition--e3 | x-tsingou-osc-message | 1.0.0 | .../x-tsingou-osc-message/v1.0/schema.json |
| extension-definition--e4 | x-tsingou-serial-data | 1.0.0 | .../x-tsingou-serial-data/v1.0/schema.json |
| extension-definition--e5 | x-tsingou-sdr-capture | 1.0.0 | .../x-tsingou-sdr-capture/v1.0/schema.json |

Implementations MUST include the relevant `extension-definition` objects in every STIX bundle that contains custom SCOs. Implementations MUST NOT include extension definitions for types not present in the bundle.

### TSG.12.5.3 Custom SCO Property Specifications

**x-tsingou-nats-message:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| type | string | YES | MUST be "x-tsingou-nats-message" |
| id | identifier | YES | MUST use type prefix |
| subject | string | YES | NATS subject string |
| data | object | NO | Parsed message payload (JSON) |
| raw_data | string | NO | Base64-encoded raw bytes |
| headers | object | NO | NATS message headers |
| sequence | integer | NO | JetStream sequence number |
| stream | string | NO | JetStream stream name |
| consumer | string | NO | JetStream consumer name |
| reply_to | string | NO | NATS reply subject |
| server_timestamp | timestamp | NO | Server-assigned timestamp |

**x-tsingou-midi-event:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| type | string | YES | MUST be "x-tsingou-midi-event" |
| id | identifier | YES | MUST use type prefix |
| channel | integer (0-15) | YES | MIDI channel |
| message_type | string | YES | note-on, note-off, cc, program-change, etc. |
| note | integer (0-127) | NO | Note number (for note-on/off) |
| velocity | integer (0-127) | NO | Velocity (for note-on/off) |
| control_number | integer (0-127) | NO | CC number (for cc) |
| control_value | integer (0-127) | NO | CC value (for cc) |
| program | integer (0-127) | NO | Program number (for program-change) |
| pitch_bend | integer | NO | Pitch bend value (-8192 to 8191) |
| raw_bytes | string | NO | Base64-encoded raw MIDI bytes |
| device_name | string | NO | Source device name |
| device_id | string | NO | Source device identifier |

**x-tsingou-osc-message:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| type | string | YES | MUST be "x-tsingou-osc-message" |
| id | identifier | YES | MUST use type prefix |
| address | string | YES | OSC address pattern (starts with /) |
| args | list | NO | OSC argument values |
| arg_types | string | NO | OSC type tag string |
| timetag | timestamp | NO | OSC timetag |
| is_bundle | boolean | NO | Whether this is an OSC bundle |
| remote_address | string | NO | Sender IP:port |

**x-tsingou-serial-data:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| type | string | YES | MUST be "x-tsingou-serial-data" |
| id | identifier | YES | MUST use type prefix |
| port | string | YES | Serial port path (e.g., /dev/ttyUSB0) |
| baud_rate | integer | YES | Connection baud rate |
| raw_data | string | NO | Base64-encoded raw bytes |
| parsed_data | object | NO | Parsed payload (protocol-dependent) |
| parser_type | string | NO | Parser used (e.g., readline, modbus) |
| delimiter | string | NO | Line delimiter |
| vendor_id | string | NO | USB vendor ID |
| product_id | string | NO | USB product ID |
| manufacturer | string | NO | Device manufacturer name |

**x-tsingou-sdr-capture:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| type | string | YES | MUST be "x-tsingou-sdr-capture" |
| id | identifier | YES | MUST use type prefix |
| center_frequency_hz | number | YES | Center frequency in Hz |
| sample_rate_hz | number | YES | Sample rate in samples/sec |
| bandwidth_hz | number | NO | Capture bandwidth |
| gain_db | number | NO | Receiver gain in dB |
| antenna | string | NO | Antenna identifier |
| modulation | string | NO | Detected modulation type |
| signal_power_dbm | number | NO | Measured signal power |
| noise_floor_dbm | number | NO | Measured noise floor |
| sigmf_ref | string | NO | Reference to SigMF metadata file |

---

## TSG.12.6 Identity Architecture

### TSG.12.6.1 Platform Identity

Every STIX bundle generated by Tsingou MUST include an `identity` SDO representing the platform:

```json
{
  "type": "identity",
  "id": "identity--<stable-tsingou-uuid>",
  "spec_version": "2.1",
  "created": "2026-01-01T00:00:00.000Z",
  "modified": "2026-01-01T00:00:00.000Z",
  "name": "Tsingou SIGINT Visualization Platform",
  "identity_class": "system",
  "description": "Automated signal intelligence collection and analysis platform.",
  "sectors": ["technology"],
  "contact_information": "admin@tsingou.example.com"
}
```

All `observed-data` and `indicator` objects MUST reference this identity via `created_by_ref`.

### TSG.12.6.2 Source Identities

Each signal source adapter (TSG.9) SHOULD be represented as a separate `identity`:

```json
{
  "type": "identity",
  "id": "identity--<adapter-uuid>",
  "spec_version": "2.1",
  "name": "NATS Signal Adapter",
  "identity_class": "system",
  "description": "NATS JetStream message collection adapter."
}
```

The `created_by_ref` on `observed-data` objects SHOULD reference the specific adapter identity, not the platform identity, to preserve provenance.

### TSG.12.6.3 Analyst Identities

Human analysts interacting with the platform SHOULD be represented as `individual` identities for `note`, `opinion`, and manually created objects:

```json
{
  "type": "identity",
  "id": "identity--<analyst-uuid>",
  "spec_version": "2.1",
  "name": "Jane Analyst",
  "identity_class": "individual"
}
```

---

## TSG.12.7 Confidence and Marking

### TSG.12.7.1 Confidence Scale

STIX 2.1 uses a 0-100 integer confidence scale. Implementations MUST apply confidence values according to the following scheme:

| Source | Confidence Range | Rationale |
|--------|-----------------|-----------|
| Direct signal observation | 90-100 | Platform captured the signal directly |
| d2ts anomaly detection (statistical) | 60-80 | Algorithmic analysis, subject to false positives |
| d2ts correlation (graph-based) | 50-70 | Inferred relationships |
| External feed ingestion | 30-60 | Inherited confidence from upstream |
| Human analyst assertion | 70-95 | Analyst provides explicit confidence |

### TSG.12.7.2 Traffic Light Protocol (TLP)

Implementations MUST support TLP marking definitions per CISA's TLP standard:

| TLP Level | STIX Marking ID | Sharing Scope |
|-----------|-----------------|---------------|
| TLP:CLEAR | marking-definition--94868c89-83c2-464b-929b-a1a8aa3c8487 | Unrestricted |
| TLP:GREEN | marking-definition--bab4a63c-aed9-4b5f-a869-75b77dcc1ef3 | Community |
| TLP:AMBER | marking-definition--55d920b0-5e8b-4f79-9ee9-91f868d9b421 | Organization + partners |
| TLP:AMBER+STRICT | marking-definition--939a9414-2ddd-4d32-a0cd-b7c2c2b9e2c8 | Organization only |
| TLP:RED | marking-definition--e828b379-4e03-4974-9ac4-e53a884c97c1 | Named recipients only |

Default marking for automated observations: **TLP:AMBER** (shared within organization and trusted partners).

### TSG.12.7.3 Marking Assignment Rules

| Object Type | Default TLP | Override Allowed |
|------------|-------------|-----------------|
| observed-data (automated) | TLP:AMBER | YES — via adapter config |
| indicator (d2ts) | TLP:AMBER | YES — via pipeline config |
| indicator (analyst) | Per analyst | YES — at creation time |
| relationship | Inherit from source | NO — MUST match highest-TLP participant |
| sighting | Inherit from sighted object | NO |
| report | Per analyst | YES |
| identity (platform) | TLP:CLEAR | NO |

---

## TSG.12.8 STIX Bundle Structure

### TSG.12.8.1 Bundle Composition Rules

A STIX bundle exported by Tsingou MUST contain:

1. At least one `observed-data` or `indicator` SDO
2. All SCOs referenced by `object_refs` in any `observed-data`
3. The platform `identity` SDO (referenced by `created_by_ref`)
4. All `extension-definition` objects for custom SCOs in the bundle
5. Applicable `marking-definition` objects (or references to well-known markings)

A bundle SHOULD contain:
1. Source adapter `identity` SDO (if different from platform identity)
2. `relationship` SROs linking related observations
3. `sighting` SROs for indicator matches

### TSG.12.8.2 Minimal Bundle Example

```json
{
  "type": "bundle",
  "id": "bundle--<uuid>",
  "objects": [
    {
      "type": "identity",
      "id": "identity--<tsingou-uuid>",
      "spec_version": "2.1",
      "name": "Tsingou SIGINT Platform",
      "identity_class": "system",
      "created": "2026-01-01T00:00:00.000Z",
      "modified": "2026-01-01T00:00:00.000Z"
    },
    {
      "type": "extension-definition",
      "id": "extension-definition--<nats-ext-uuid>",
      "spec_version": "2.1",
      "name": "Tsingou NATS Message Observable",
      "created": "2026-01-01T00:00:00.000Z",
      "modified": "2026-01-01T00:00:00.000Z",
      "created_by_ref": "identity--<tsingou-uuid>",
      "schema": "https://tsingou.example.com/stix/extensions/x-tsingou-nats-message/v1.0/schema.json",
      "version": "1.0.0",
      "extension_types": ["new-sco"]
    },
    {
      "type": "observed-data",
      "id": "observed-data--<uuid>",
      "spec_version": "2.1",
      "created": "2026-02-18T10:30:00.000Z",
      "modified": "2026-02-18T10:30:00.000Z",
      "created_by_ref": "identity--<tsingou-uuid>",
      "first_observed": "2026-02-18T10:29:58.000Z",
      "last_observed": "2026-02-18T10:29:58.000Z",
      "number_observed": 1,
      "object_refs": [
        "x-tsingou-nats-message--<sco-uuid>"
      ],
      "object_marking_refs": [
        "marking-definition--55d920b0-5e8b-4f79-9ee9-91f868d9b421"
      ],
      "confidence": 95
    },
    {
      "type": "x-tsingou-nats-message",
      "id": "x-tsingou-nats-message--<sco-uuid>",
      "spec_version": "2.1",
      "extensions": {
        "extension-definition--<nats-ext-uuid>": {
          "extension_type": "new-sco"
        }
      },
      "subject": "tsingou.signals.temperature.sensor-01",
      "data": {
        "temperature": 72.5,
        "unit": "fahrenheit"
      },
      "sequence": 42,
      "stream": "SIGNALS"
    }
  ]
}
```

### TSG.12.8.3 Bundle Size Constraints

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Max objects per bundle | 10,000 | TAXII server max_content_length alignment |
| Max bundle size (bytes) | 10,485,760 (10MB) | HTTP payload limits |
| Max SCOs per observed-data | 50 | Practical readability limit |
| Recommended batch size | 100 observed-data | Balances latency vs throughput |

---

## TSG.12.9 Effect Schema Definitions

### TSG.12.9.1 Schema Strategy

All STIX types used by Tsingou MUST be defined as Effect Schema types for:
1. Runtime validation of STIX objects during codec encoding/decoding
2. JSON Schema generation for extension-definition schema URLs
3. Type-safe codec transforms between BaseSignal and STIX
4. Integration with the EventLog infrastructure (TSG.7)

### TSG.12.9.2 Core STIX Schemas (Conceptual)

```typescript
import { Schema } from "effect"

// STIX Identifier
const StixId = Schema.TemplateLiteral(
  Schema.String,  // type prefix
  Schema.Literal("--"),
  Schema.String   // UUID
)

// STIX Timestamp (RFC 3339)
const StixTimestamp = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/)
)

// Common SDO Properties
const StixSdoCommon = Schema.Struct({
  type: Schema.String,
  spec_version: Schema.Literal("2.1"),
  id: StixId,
  created: StixTimestamp,
  modified: StixTimestamp,
  created_by_ref: Schema.optional(StixId),
  revoked: Schema.optional(Schema.Boolean),
  labels: Schema.optional(Schema.Array(Schema.String)),
  confidence: Schema.optional(Schema.Number.pipe(
    Schema.int(),
    Schema.between(0, 100)
  )),
  lang: Schema.optional(Schema.String),
  external_references: Schema.optional(Schema.Array(Schema.Unknown)),
  object_marking_refs: Schema.optional(Schema.Array(StixId)),
  granular_markings: Schema.optional(Schema.Array(Schema.Unknown)),
})

// Observed Data SDO
const ObservedData = StixSdoCommon.pipe(
  Schema.extend(Schema.Struct({
    type: Schema.Literal("observed-data"),
    first_observed: StixTimestamp,
    last_observed: StixTimestamp,
    number_observed: Schema.Number.pipe(Schema.int(), Schema.positive()),
    object_refs: Schema.Array(StixId),
  }))
)

// STIX Bundle
const StixBundle = Schema.Struct({
  type: Schema.Literal("bundle"),
  id: StixId,
  objects: Schema.Array(Schema.Unknown),  // heterogeneous STIX objects
})
```

### TSG.12.9.3 Custom SCO Schemas (Conceptual)

```typescript
// x-tsingou-nats-message SCO
const TsingouNatsMessage = Schema.Struct({
  type: Schema.Literal("x-tsingou-nats-message"),
  id: StixId,
  spec_version: Schema.Literal("2.1"),
  extensions: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  subject: Schema.String,
  data: Schema.optional(Schema.Unknown),
  raw_data: Schema.optional(Schema.String),
  headers: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  sequence: Schema.optional(Schema.Number.pipe(Schema.int())),
  stream: Schema.optional(Schema.String),
  consumer: Schema.optional(Schema.String),
  reply_to: Schema.optional(Schema.NullOr(Schema.String)),
  server_timestamp: Schema.optional(StixTimestamp),
})
```

---

## TSG.12.10 Security Considerations

### TSG.12.10.1 Data Classification

STIX objects exported by Tsingou MAY contain sensitive operational data. Implementations MUST:

1. Apply TLP markings to all exported objects
2. Validate TLP compliance before publishing to TAXII collections
3. Strip or redact sensitive payload fields for lower-trust collections
4. Log all STIX export operations for audit trail

### TSG.12.10.2 Custom Extension Risks

Custom SCOs (x-tsingou-*) expose platform-specific schemas to external consumers. Implementations SHOULD:

1. Version all extension-definition schemas
2. Document breaking changes in schema URLs
3. Consider the information disclosure implications of each custom property
4. Provide stripped-down variants for public-facing TAXII collections

### TSG.12.10.3 UUID Predictability

Deterministic UUID v5 generation means that knowing a BaseSignal ID allows prediction of the STIX UUID. Implementations SHOULD:

1. Use a deployment-specific namespace UUID (not a well-known constant)
2. Rotate the namespace UUID periodically for high-security deployments
3. Never expose the namespace UUID to external consumers

---

## TSG.12.11 Implementation Notes

### TSG.12.11.1 Phased Implementation

| Phase | Scope | STIX Types |
|-------|-------|-----------|
| Phase 1 | Core signal export | observed-data, identity, 5 custom SCOs, 3 standard SCOs |
| Phase 2 | Analysis export | indicator, relationship, sighting, report |
| Phase 3 | Full interop | All CRITICAL and HIGH relevance types |
| Phase 4 | Bidirectional | STIX import → BaseSignal conversion |

### TSG.12.11.2 Validation Requirements

Implementations MUST validate all STIX output against:

1. STIX 2.1 JSON Schema (OASIS-provided)
2. Custom extension JSON Schemas (Tsingou-provided)
3. Bundle composition rules (TSG.12.8.1)
4. UUID format compliance ([RFC4122])
5. Timestamp format compliance (RFC 3339)

---

## References

| Key | Citation |
|-----|----------|
| [STIX21] | OASIS, "STIX Version 2.1", Committee Specification 03, June 2020 |
| [RFC2119] | IETF, "Key words for use in RFCs to Indicate Requirement Levels", March 1997 |
| [RFC8174] | IETF, "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", May 2017 |
| [RFC4122] | IETF, "A Universally Unique IDentifier (UUID) URN Namespace", July 2005 |
| [STIXPATT] | OASIS, "STIX Patterning Language", Part 9 of STIX 2.1, June 2020 |
| [TLP] | CISA, "Traffic Light Protocol (TLP) Definitions and Usage", Version 2.0 |

---

*End of Section TSG.12*
