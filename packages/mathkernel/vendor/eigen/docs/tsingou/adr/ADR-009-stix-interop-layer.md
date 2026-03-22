# ADR-009: STIX Interoperability Layer — Custom Internal Signals + STIX Bridge

**Status**: Accepted (revised from "STIX-native")
**Date**: 2026-02-18 (revised, expanded)
**Decision Makers**: Prime (user), Val (architect)
**Evidence**: Questionnaire `tsingou-sigint-scope` — Q4 initial: "STIX-native — Absolute." Revised: STIX support is absolute, but as interop — not internal format.
**RFC Sections**: TSG.12 (STIX Data Model), TSG.13 (STIX Codec), TSG.14 (TAXII Transport), TSG.15 (CTI Platform Interop)

---

## Context

STIX 2.1 is the industry standard for threat intelligence sharing (18 SDOs, 2 SROs, 18 SCOs, 4 meta-objects — 42 total types). The initial decision was to make `BaseSignal` literally a STIX `observed-data` object. On reflection: STIX is verbose, designed for sharing between organizations, and carries metadata overhead that penalizes high-throughput signal processing.

Tsingou's internal signal model needs to be:
- **Lean** — minimal overhead at 10k+ signals/sec through d2ts
- **Custom** — support non-cyber signals (MIDI, OSC, SDR IQ samples, serial telemetry) that STIX has no SCO for
- **Schema-first** — Effect.Schema with branded types, not STIX's JSON-LD-like format
- **Versioned** — d2ts `[tick, source_seq]` tuple, not STIX timestamps

But STIX interoperability is **non-negotiable** for CTI platform integration (MISP, OpenCTI, TheHive, Cortex).

### Problem Dimensions

1. **Performance**: STIX observed-data with embedded SCOs averages 500-2000 bytes per signal. BaseSignal averages 100-300 bytes. At 10k signals/sec, this is the difference between 2MB/s and 10MB/s through the d2ts pipeline.

2. **Schema mismatch**: Five of eight signal kinds (nats, midi, osc, serial, sdr) have no native STIX SCO equivalent. Using STIX internally would require custom extensions everywhere, negating the "standard" benefit.

3. **Versioning**: STIX uses `modified` timestamps for versioning. d2ts uses `[tick, source_seq]` tuples for differential dataflow semantics. These are fundamentally incompatible versioning models.

4. **Identity overhead**: Every STIX object requires `created_by_ref`, `object_marking_refs`, and `spec_version`. This metadata is redundant in an internal pipeline where all signals originate from known adapters.

---

## Revised Decision

**Custom `BaseSignal` internally. STIX serialization/deserialization as an interop layer.**

The STIX codec operates at the boundary between Tsingou's internal signal pipeline and external CTI consumers. All internal processing uses the lean BaseSignal format. STIX is materialized only when intelligence crosses the platform boundary.

### Internal Model (BaseSignal — TSG.8)

```typescript
const BaseSignal = Schema.Struct({
  id: SignalId,               // Branded string (nanoid — fast)
  sourceId: SourceId,         // Branded string
  timestamp: Schema.DateFromSelf,
  version: SignalVersion,     // [tick, source_seq] — d2ts versioning
  kind: SignalKind,           // "midi" | "osc" | "nats" | "http" | "serial" | "rss" | "websocket" | "file-watch"
  payload: Schema.Unknown,    // Source-specific typed data (refined per kind)
  metadata: Schema.optional(SignalMetadata),
})
```

Eight known signal kinds, each with typed payloads via Schema.extend:
- **midi**: channel, type, note, velocity, cc, pitchBend, raw, deviceName/deviceId
- **osc**: address, args, timetag, isBundle, remoteAddress
- **nats**: subject, data, headers, sequence, stream, consumer, replyTo, serverTimestamp
- **http**: url, method, statusCode, body, headers, sseEventType/Id, contentType, responseTimeMs
- **serial**: port, baudRate, raw, parsed, parserType, delimiter, vendorId/productId/manufacturer
- **rss**: feedUrl, feedTitle, itemGuid, title, link, pubDate, content, description, author, categories
- **websocket**: url, data, type (text/binary), protocol, byteLength, connectionSeq
- **file-watch**: path, event (create/modify/delete), content, size, mimeType, lineRange, hash

### STIX Interop Layer (StixCodec — TSG.13)

```
BaseSignal ←→ STIX 2.1
             ↑
    Bidirectional codec (Effect.Service)
             ↓
    ┌────────────────────────┐
    │ encodeSignal()         │  BaseSignal → STIX Bundle
    │ encodeBatch()          │  BaseSignal[] → STIX Bundle (batched)
    │ encodeStream()         │  Stream<BaseSignal> → Stream<StixBundle>
    │ decodeBundle()         │  STIX Bundle → BaseSignal[]
    │ decodeObservedData()   │  observed-data → BaseSignal
    │ decodeIndicatorPattern │  STIX indicator → SignalFilter
    │ encodeAnomaly()        │  d2ts anomaly → STIX indicator
    │ encodeSighting()       │  signal match → STIX sighting
    │ encodeRelationship()   │  correlation → STIX relationship
    └────────────────────────┘
```

Codec pipeline stages: Signal Validation → SCO Generation → SDO Generation → Bundle Assembly.

---

## Signal Kind to STIX Mapping (Complete)

| Signal Kind | Primary STIX SCO | Secondary SCOs | Custom Extension Required |
|------------|-----------------|----------------|--------------------------|
| nats | **x-tsingou-nats-message** | ipv4-addr (conditional) | YES |
| http | network-traffic | url, ipv4-addr/ipv6-addr, domain-name | NO |
| websocket | network-traffic | url, ipv4-addr/ipv6-addr | NO |
| midi | **x-tsingou-midi-event** | software (conditional) | YES |
| osc | **x-tsingou-osc-message** | ipv4-addr (conditional) | YES |
| serial | **x-tsingou-serial-data** | artifact, software (conditional) | YES |
| rss | url | artifact, email-addr (conditional) | NO |
| file-watch | file | directory, artifact (conditional) | NO |

### Custom STIX Extensions (5 Required)

Each custom SCO is registered via a STIX `extension-definition` object:

| Extension | Type | Registered Properties |
|-----------|------|----------------------|
| x-tsingou-nats-message | new-sco | subject, data, headers, sequence, stream, consumer, reply_to, server_timestamp |
| x-tsingou-midi-event | new-sco | channel, message_type, note, velocity, control_number, control_value, program, pitch_bend, raw_bytes, device_name, device_id |
| x-tsingou-osc-message | new-sco | address, args, arg_types, timetag, is_bundle, remote_address |
| x-tsingou-serial-data | new-sco | port, baud_rate, raw_data, parsed_data, parser_type, delimiter, vendor_id, product_id, manufacturer |
| x-tsingou-sdr-capture | new-sco | center_frequency_hz, sample_rate_hz, bandwidth_hz, gain_db, antenna, modulation, signal_power_dbm, noise_floor_dbm, sigmf_ref |

### STIX Export Structure

Every signal exports as: `observed-data` SDO → referencing one or more SCOs → wrapped in a `bundle` with identity and extension-definition objects.

```json
{
  "type": "bundle",
  "id": "bundle--<uuid>",
  "objects": [
    { "type": "identity", "name": "Tsingou SIGINT Platform", "identity_class": "system" },
    { "type": "extension-definition", "extension_types": ["new-sco"] },
    { "type": "observed-data", "object_refs": ["x-tsingou-nats-message--<uuid>"], "confidence": 95 },
    { "type": "x-tsingou-nats-message", "subject": "...", "data": { ... } }
  ]
}
```

---

## UUID Mapping Strategy

Deterministic UUID v5 (SHA-1 based) mapping from BaseSignal IDs to STIX IDs:

```
STIX_UUID = UUIDv5(TSINGOU_NAMESPACE, BaseSignal.id + ":" + stix_type)
STIX_ID   = "<stix-type>--" + STIX_UUID
```

This ensures:
1. **Idempotency**: Same signal always produces same STIX ID
2. **Round-trip fidelity**: STIX IDs can be reversed via lookup table
3. **Deduplication**: CTI platforms detect and merge duplicate observations

Deployment-specific namespace UUID prevents cross-deployment ID collisions.

---

## TAXII 2.1 Transport (TSG.14)

### NATS Subject → TAXII Collection Mapping

| NATS Subject Pattern | TAXII Collection | Content |
|---------------------|-----------------|---------|
| tsingou.signals.nats.> | col-nats-obs | observed-data + x-tsingou-nats-message |
| tsingou.signals.http.> | col-http-obs | observed-data + network-traffic + url |
| tsingou.signals.websocket.> | col-ws-obs | observed-data + network-traffic |
| tsingou.signals.midi.> | col-midi-obs | observed-data + x-tsingou-midi-event |
| tsingou.signals.osc.> | col-osc-obs | observed-data + x-tsingou-osc-message |
| tsingou.signals.serial.> | col-serial-obs | observed-data + x-tsingou-serial-data |
| tsingou.signals.rss.> | col-rss-obs | observed-data + url + artifact |
| tsingou.signals.file-watch.> | col-file-obs | observed-data + file |
| tsingou.analysis.indicators.> | col-indicators | indicator |
| tsingou.analysis.correlations.> | col-correlations | relationship, sighting |
| tsingou.analysis.reports.> | col-reports | report, grouping |

### Three API Roots (Trust Boundaries)

| API Root | Path | Access | Collections |
|----------|------|--------|------------|
| Internal | /api/internal/ | Full RW, all signals | All 13 collections |
| Partner | /api/partner/ | Read-only, TLP:AMBER | Filtered subset (indicators, correlations, network) |
| Public | /api/public/ | Read-only, TLP:CLEAR | Declassified indicators and reports only |

### NATS-to-TAXII Bridge

Service subscribes to NATS JetStream subjects, applies StixCodec.encodeBatch(), and ingests into the TAXII object store. Configuration:

| Parameter | Default | Description |
|-----------|---------|-------------|
| batch_size | 100 | Max signals per STIX bundle |
| flush_timeout_ms | 5000 | Max time before flushing buffer |
| retry_attempts | 3 | Retries on ingestion failure |
| delivery_guarantee | at-least-once | JetStream ack after successful ingest |

---

## CTI Platform Integration (TSG.15)

### Integration Priority

| Platform | Protocol | Direction | Priority | Effort |
|----------|---------|-----------|----------|--------|
| OpenCTI | TAXII 2.1 + GraphQL + SSE | Bidirectional | P0 | 3-5 days |
| MISP | REST API + STIX export | Bidirectional | P1 | 5-8 days |
| TheHive 5 | REST API | Bidirectional | P1 | 3-5 days |
| Cortex | REST API (via TheHive) | Bidirectional | P2 | 2-3 days |
| Anomali | TAXII 2.1 | Inbound only | P2 | 2-3 days |
| STIX Shifter | Python API | Outbound (pattern translation) | P2 | 5-8 days |

### OpenCTI (P0 — Native STIX)

OpenCTI's internal data model IS STIX 2.1. Tsingou STIX bundles flow directly into OpenCTI with zero format translation. Integration via:
- OpenCTI's built-in TAXII connector pulls from Tsingou's TAXII server
- Tsingou's TaxiiClient pulls OpenCTI's exported intelligence
- Real-time stream via OpenCTI's SSE endpoint

### MISP (P1 — Format Translation)

MISP uses Events/Attributes/Galaxies internally. Integration requires:
- Inbound: MISP STIX export endpoint → StixCodec → BaseSignal
- Outbound: BaseSignal → StixCodec → TAXII feed (MISP subscribes)
- Galaxy mapping: MISP galaxy clusters → STIX threat-actor/malware/attack-pattern SDOs

### TheHive (P1 — Alert/Case Bridge)

TheHive focuses on incident response. Integration via:
- Outbound: d2ts anomaly → STIX indicator → TheHive Alert (REST API)
- Inbound: TheHive case resolution → STIX sighting/relationship SROs → NATS
- Observable enrichment via Cortex analyzers

---

## Confidence and Marking

### Confidence Assignment

| Source | Confidence | Rationale |
|--------|-----------|-----------|
| Direct signal observation | 90-100 | Platform captured signal directly |
| d2ts statistical anomaly | 60-80 | Algorithmic, subject to false positives |
| d2ts graph correlation | 50-70 | Inferred relationships |
| External feed ingestion | 30-60 | Inherited from upstream |
| Human analyst | 70-95 | Explicit assertion |

### TLP Default Markings

| Object Type | Default TLP | Rationale |
|------------|-------------|-----------|
| observed-data (automated) | TLP:AMBER | Organization + partners |
| indicator (d2ts) | TLP:AMBER | Sensitive analysis output |
| indicator (analyst) | Per analyst | Explicit at creation |
| relationship/sighting | Inherit highest | Match most restrictive participant |
| identity (platform) | TLP:CLEAR | Public platform identification |

---

## Information Loss Matrix (Round-Trip)

| Signal Kind | Fields Lost in STIX | Severity | Mitigation |
|------------|-------------------|----------|------------|
| http | responseTimeMs, statusCode, sseEventType/Id | MEDIUM | x_tsingou_metadata custom property |
| websocket | connectionSeq, subprotocol (partial) | LOW | x_tsingou_metadata |
| rss | feedTitle | LOW | Wrap in report SDO |
| file-watch | lineRange | LOW | x_tsingou_metadata |
| all | version [tick, source_seq] | NONE | Preserved in x_tsingou_metadata |
| all | metadata (arbitrary) | NONE | Preserved in x_tsingou_metadata |
| nats, midi, osc, serial | NONE | NONE | Custom SCOs preserve all fields |

All lost fields SHOULD be preserved in a `x_tsingou_metadata` custom property on the `observed-data` SDO.

---

## Effect Layer Composition

```typescript
// StixCodec service with full dependency graph
const StixCodecFull = StixCodecLive.pipe(
  Layer.provide(UuidMapperLive),
  Layer.provide(IdentityProviderLive),
  Layer.provide(MarkingProviderLive),
  Layer.provide(ExtensionRegistryLive),
  Layer.provide(Clock.Live),
)

// TAXII Server full stack
const TaxiiServerFull = TaxiiServerLive.pipe(
  Layer.provide(HttpServerLive),
  Layer.provide(TaxiiObjectStoreLive),
  Layer.provide(StixCodecFull),
  Layer.provide(AuthProviderLive),
  Layer.provide(RateLimiterLive),
)

// CTI Bridge — all platform connectors
const CtiBridgeLive = Layer.mergeAll(
  OpenCtiConnectorLive,
  MispConnectorLive,
  TheHiveConnectorLive,
  GenericTaxiiConnectorLive,
).pipe(
  Layer.provide(NatsClientLive),
  Layer.provide(StixCodecFull),
  Layer.provide(CircuitBreakerLive),
)
```

---

## Implementation Phases

| Phase | Scope | Depends On |
|-------|-------|-----------|
| Phase 1 | StixCodec (encode all 8 signal kinds) | BaseSignal schemas |
| Phase 2 | TAXII Server (read-only collections) | Phase 1 |
| Phase 3 | NATS-to-TAXII Bridge (at-least-once) | Phase 2 + NATS |
| Phase 4 | TAXII Server (write + status + pagination) | Phase 2 |
| Phase 5 | TAXII Client (pull + delta sync) | Phase 1 |
| Phase 6 | OpenCTI connector (bidirectional) | Phase 2 + Phase 5 |
| Phase 7 | MISP connector | Phase 5 |
| Phase 8 | TheHive + Cortex connectors | Phase 1 |
| Phase 9 | Authentication (OAuth 2.0, mTLS) | Phase 4 |
| Phase 10 | Multi-root (partner/public filtering) | Phase 9 |

---

## Consequences

### Positive
- **Fast internal path** — nanoid + lean schema at pipeline speed, not STIX UUID + JSON-LD overhead
- **Full STIX interop** — bidirectional codec means any CTI platform can consume Tsingou output
- **Non-cyber signals work** — MIDI, OSC, SDR have clean internal representation; custom STIX extensions only needed at export boundary
- **TAXII as adapter** — external STIX feeds are just another source, not special-cased
- **Deterministic UUIDs** — round-trip fidelity between BaseSignal and STIX objects
- **Streaming codec** — batch and stream encoding keeps up with d2ts pipeline throughput
- **Trust boundaries** — three API Roots separate internal, partner, and public access

### Negative
- **Codec maintenance** — must keep STIX serializer in sync with STIX spec updates
- **Custom extensions** — 5 x-tsingou-* SCOs won't be understood by all STIX consumers
- **Two representations** — internal BaseSignal + export STIX means two schemas to maintain
- **Information loss** — some HTTP/WebSocket fields lack STIX equivalents (mitigated by custom properties)
- **Extension-definition overhead** — every bundle with custom SCOs must include extension-definition objects

### vs. Previous "STIX-native" Decision
- Internal format: custom (fast) instead of STIX (verbose)
- Export format: STIX 2.1 (unchanged)
- Import format: STIX → BaseSignal via codec (new)
- Net effect: same interop, better performance, cleaner non-cyber signal support

---

## Cross-References

| Document | Relationship |
|----------|-------------|
| TSG.8 (BaseSignal Schema) | Defines the internal signal format this ADR bridges from |
| TSG.12 (STIX Data Model) | Specifies the STIX types and custom extensions |
| TSG.13 (BaseSignal ↔ STIX Codec) | Implements the codec this ADR designs |
| TSG.14 (TAXII Transport) | Implements the transport this ADR specifies |
| TSG.15 (CTI Platform Interop) | Implements the platform connectors this ADR scopes |
| ADR-001 (Effect-TS Architecture) | Codec is an Effect.Service with Layer composition |
| ADR-005 (NATS Messaging) | NATS subjects map to TAXII collections |
| ADR-011 (SDR Integration) | SDR signals use x-tsingou-sdr-capture custom SCO |
