# TSG.14 TAXII 2.1 Transport

```
Section:     TSG.14
Title:       TAXII 2.1 Transport
Status:      DRAFT
Author:      stix-specialist
RFC:         TMNL-RFC-002
Depends:     TSG.11 (NATS Messaging Fabric), TSG.12 (STIX 2.1 Data Model), TSG.13 (BaseSignal ↔ STIX Codec)
```

---

## TSG.14.1 Introduction

This section specifies how the Tsingou platform implements TAXII 2.1 [TAXII21] as the primary transport protocol for exchanging STIX-encoded intelligence with external CTI platforms. Tsingou operates both a TAXII Server (exposing signal observations to consumers) and a TAXII Client (ingesting external threat feeds).

### TSG.14.1.1 Normative References

| Key | Reference |
|-----|-----------|
| [TAXII21] | OASIS, "TAXII Version 2.1", Committee Specification 01, June 2020 |
| [STIX21] | OASIS, "STIX Version 2.1", Committee Specification 03, June 2020 |
| [RFC2119] | IETF, "Key words for use in RFCs to Indicate Requirement Levels", March 1997 |
| [RFC6749] | IETF, "The OAuth 2.0 Authorization Framework", October 2012 |
| [RFC8446] | IETF, "TLS Protocol Version 1.3", August 2018 |

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in BCP 14 [RFC2119] [RFC8174].

### TSG.14.1.2 Scope

This section covers:
1. Tsingou TAXII Server architecture and endpoints
2. NATS-to-TAXII bridge for real-time signal export
3. Tsingou TAXII Client for external feed ingestion
4. Collection topology and subject mapping
5. Authentication, authorization, and transport security
6. Pagination, filtering, and performance

This section does NOT cover:
- STIX object definitions (see TSG.12)
- Codec transforms (see TSG.13)
- Platform-specific connector logic (see TSG.15)

---

## TSG.14.2 TAXII Server Architecture

### TSG.14.2.1 Deployment Topology

```
┌─────────────────────────────────────────────────────────────┐
│                    Tsingou Platform                           │
│                                                             │
│  ┌──────────┐   ┌────────────┐   ┌──────────────────────┐  │
│  │  Signal    │   │  d2ts       │   │  TAXII Server         │  │
│  │  Pipeline  │──►│  Analysis   │──►│  (Effect HttpServer)  │  │
│  │  (TSG.7)   │   │  Engine     │   │                      │  │
│  └──────────┘   └────────────┘   │  GET  /taxii2/         │  │
│        │                          │  GET  /api/{root}/     │  │
│        │                          │  GET  /api/{root}/     │  │
│        ▼                          │       collections/     │  │
│  ┌──────────────────┐            │  GET  /api/{root}/     │  │
│  │  NATS JetStream    │◄──────────│       collections/     │  │
│  │  Signal Subjects   │  bridge   │       {id}/objects/   │  │
│  │                    │──────────►│  POST /api/{root}/     │  │
│  │  tsingou.signals.> │           │       collections/     │  │
│  │  tsingou.analysis.>│           │       {id}/objects/   │  │
│  └──────────────────┘            └──────────────────────┘  │
│                                           │                 │
└───────────────────────────────────────────┼─────────────────┘
                                            │ HTTPS
                                            ▼
                              ┌──────────────────────────┐
                              │  External CTI Consumers    │
                              │  (OpenCTI, MISP, etc.)     │
                              └──────────────────────────┘
```

### TSG.14.2.2 Effect Service Model

The TAXII Server is implemented as an Effect.Service with the following contract:

```typescript
interface TaxiiServer {
  // Server lifecycle
  readonly start: Effect<void, TaxiiServerError>
  readonly stop: Effect<void, TaxiiServerError>

  // Collection management
  readonly createCollection: (config: CollectionConfig) => Effect<TaxiiCollection, TaxiiServerError>
  readonly deleteCollection: (id: string) => Effect<void, TaxiiServerError>
  readonly listCollections: (apiRoot: string) => Effect<ReadonlyArray<TaxiiCollection>, TaxiiServerError>

  // Object management (internal API for bridge)
  readonly ingestObjects: (collectionId: string, objects: ReadonlyArray<StixObject>) => Effect<TaxiiStatus, TaxiiServerError>
  readonly queryObjects: (collectionId: string, filters: TaxiiFilters) => Effect<TaxiiEnvelope, TaxiiServerError>
}
```

### TSG.14.2.3 HTTP Router

The TAXII server exposes endpoints via `@effect/platform` HttpServer:

```typescript
const TaxiiRouter = HttpRouter.empty.pipe(
  // Discovery
  HttpRouter.get("/taxii2/", handleDiscovery),

  // API Root
  HttpRouter.get("/api/:root/", handleApiRoot),

  // Collections
  HttpRouter.get("/api/:root/collections/", handleListCollections),
  HttpRouter.get("/api/:root/collections/:id/", handleGetCollection),

  // Objects
  HttpRouter.get("/api/:root/collections/:id/objects/", handleGetObjects),
  HttpRouter.post("/api/:root/collections/:id/objects/", handlePostObjects),
  HttpRouter.delete("/api/:root/collections/:id/objects/:objectId/", handleDeleteObject),

  // Manifest
  HttpRouter.get("/api/:root/collections/:id/manifest/", handleGetManifest),

  // Status
  HttpRouter.get("/api/:root/status/:statusId/", handleGetStatus),

  // Object versions
  HttpRouter.get("/api/:root/collections/:id/objects/:objectId/versions/", handleGetVersions),
)
```

---

## TSG.14.3 Discovery and API Root Configuration

### TSG.14.3.1 Discovery Response

The discovery endpoint MUST return:

```json
{
  "title": "Tsingou SIGINT TAXII Server",
  "description": "STIX 2.1 intelligence exchange for the Tsingou signal intelligence platform",
  "contact": "admin@tsingou.example.com",
  "default": "https://tsingou.example.com/api/internal/",
  "api_roots": [
    "https://tsingou.example.com/api/internal/",
    "https://tsingou.example.com/api/partner/",
    "https://tsingou.example.com/api/public/"
  ]
}
```

### TSG.14.3.2 API Root Architecture

Implementations MUST provide three API Roots corresponding to trust boundaries:

| API Root | Path | Access Level | Collection Scope |
|----------|------|-------------|-----------------|
| Internal | `/api/internal/` | Full read/write, all signal kinds | All collections |
| Partner | `/api/partner/` | Read-only, filtered | Curated subset |
| Public | `/api/public/` | Read-only, declassified | Indicators and reports only |

**API Root response:**

```json
{
  "title": "Tsingou Internal API",
  "description": "Full-access API root for platform operators",
  "versions": ["taxii-2.1"],
  "max_content_length": 10485760
}
```

### TSG.14.3.3 max_content_length Determination

The `max_content_length` MUST be configured per API Root:

| API Root | max_content_length | Rationale |
|----------|-------------------|-----------|
| Internal | 10,485,760 (10MB) | Large batch ingestion supported |
| Partner | 5,242,880 (5MB) | Standard exchange batches |
| Public | 1,048,576 (1MB) | Lightweight consumer access |

---

## TSG.14.4 Collection Topology

### TSG.14.4.1 Collection Registry

Implementations MUST maintain the following collections on the Internal API Root:

| Collection ID | Title | NATS Subject | STIX Types | can_read | can_write |
|--------------|-------|-------------|-----------|----------|-----------|
| col-nats-obs | NATS Observations | tsingou.signals.nats.> | observed-data, x-tsingou-nats-message | true | true |
| col-http-obs | HTTP Observations | tsingou.signals.http.> | observed-data, network-traffic, url | true | true |
| col-ws-obs | WebSocket Observations | tsingou.signals.websocket.> | observed-data, network-traffic | true | true |
| col-midi-obs | MIDI Observations | tsingou.signals.midi.> | observed-data, x-tsingou-midi-event | true | true |
| col-osc-obs | OSC Observations | tsingou.signals.osc.> | observed-data, x-tsingou-osc-message | true | true |
| col-serial-obs | Serial Observations | tsingou.signals.serial.> | observed-data, x-tsingou-serial-data | true | true |
| col-rss-obs | RSS Observations | tsingou.signals.rss.> | observed-data, url, artifact | true | true |
| col-file-obs | File Observations | tsingou.signals.file-watch.> | observed-data, file | true | true |
| col-indicators | Threat Indicators | tsingou.analysis.indicators.> | indicator | true | false |
| col-correlations | Correlations | tsingou.analysis.correlations.> | relationship, sighting | true | false |
| col-reports | Analysis Reports | tsingou.analysis.reports.> | report, grouping | true | false |
| col-identities | Platform Identities | tsingou.identities.> | identity | true | false |
| col-all-signals | All Signal Observations | tsingou.signals.> | observed-data, * | true | false |

### TSG.14.4.2 Partner Collection Filtering

The Partner API Root MUST expose a filtered subset:

| Collection ID | Source Collection | Filter | Rationale |
|--------------|------------------|--------|-----------|
| col-partner-indicators | col-indicators | TLP:AMBER or below | Share threat indicators |
| col-partner-correlations | col-correlations | TLP:AMBER or below | Share correlations |
| col-partner-network | col-http-obs + col-ws-obs | TLP:GREEN or below | Share network observations |

### TSG.14.4.3 Public Collection Filtering

The Public API Root MUST expose only declassified content:

| Collection ID | Source Collection | Filter | Rationale |
|--------------|------------------|--------|-----------|
| col-public-indicators | col-indicators | TLP:CLEAR only | Community threat feeds |
| col-public-reports | col-reports | TLP:CLEAR only | Published analysis |

---

## TSG.14.5 NATS-to-TAXII Bridge

### TSG.14.5.1 Bridge Service Model

The bridge is an Effect.Service that subscribes to NATS subjects and publishes encoded STIX objects to TAXII collections:

```typescript
interface NatsTaxiiBridge {
  // Start bridge for all configured subject-collection mappings
  readonly start: Effect<void, BridgeError>
  readonly stop: Effect<void, BridgeError>

  // Runtime statistics
  readonly stats: Effect<BridgeStats, BridgeError>

  // Per-subject control
  readonly pause: (subject: string) => Effect<void, BridgeError>
  readonly resume: (subject: string) => Effect<void, BridgeError>
}

interface BridgeStats {
  readonly signalsReceived: number
  readonly bundlesPublished: number
  readonly objectsPublished: number
  readonly errorsEncountered: number
  readonly lastPublishTimestamp: Date | null
  readonly activeSubscriptions: number
  readonly bufferDepth: number
}
```

### TSG.14.5.2 Bridge Pipeline

```
NATS JetStream Consumer
  │  subscribe(tsingou.signals.>)
  ▼
Signal Demultiplexer
  │  Route by subject prefix to collection
  │  tsingou.signals.nats.* → col-nats-obs
  │  tsingou.signals.http.* → col-http-obs
  │  etc.
  ▼
Batch Accumulator
  │  Buffer signals per collection
  │  Flush on: batch_size (100) OR timeout (5s) OR buffer_bytes (5MB)
  ▼
StixCodec.encodeBatch
  │  BaseSignal[] → StixBundle
  ▼
TAXII Server.ingestObjects
  │  Internal API — bypasses HTTP for efficiency
  │  Returns TaxiiStatus with success/failure counts
  ▼
JetStream ACK
  │  Acknowledge consumed messages
  │  Retry on failure (up to 3 attempts)
  ▼
Metrics Emission
  │  Update BridgeStats counters
  │  Publish metrics to tsingou.metrics.bridge.>
```

### TSG.14.5.3 Bridge Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| batch_size | integer | 100 | Max signals per STIX bundle |
| flush_timeout_ms | integer | 5000 | Max time before flushing buffer |
| max_batch_bytes | integer | 5242880 | Max bundle size in bytes |
| retry_attempts | integer | 3 | Retries on ingestion failure |
| retry_backoff_ms | integer | 1000 | Initial retry backoff (doubles per retry) |
| consumer_ack_wait_ms | integer | 30000 | JetStream ack timeout |
| max_pending | integer | 10000 | Max unacked messages per consumer |
| deliver_policy | string | "new" | JetStream deliver policy |

### TSG.14.5.4 Delivery Guarantees

| Guarantee | Mechanism | Use Case |
|-----------|-----------|----------|
| At-most-once | Ack before TAXII ingest | Non-critical telemetry |
| At-least-once | Ack after successful TAXII ingest | Default for all collections |
| Exactly-once | Deterministic UUIDs + TAXII dedup | Regulatory compliance |

Implementations MUST use at-least-once delivery by default. The JetStream consumer MUST NOT acknowledge a message until the TAXII server confirms successful ingestion.

---

## TSG.14.6 TAXII Client

### TSG.14.6.1 Client Service Model

The TAXII Client ingests external feeds into Tsingou's NATS fabric:

```typescript
interface TaxiiClient {
  // Discover and connect to external TAXII server
  readonly connect: (config: TaxiiClientConfig) => Effect<TaxiiConnection, TaxiiClientError>

  // List collections on connected server
  readonly listCollections: (conn: TaxiiConnection) => Effect<ReadonlyArray<TaxiiCollection>, TaxiiClientError>

  // Pull objects from collection (one-shot)
  readonly pullObjects: (
    conn: TaxiiConnection,
    collectionId: string,
    filters: TaxiiFilters
  ) => Effect<StixBundle, TaxiiClientError>

  // Subscribe to collection changes (polling)
  readonly subscribe: (
    conn: TaxiiConnection,
    collectionId: string,
    pollIntervalMs: number
  ) => Stream<StixBundle>

  // Manifest-based delta sync
  readonly deltaSync: (
    conn: TaxiiConnection,
    collectionId: string,
    watermark: Date
  ) => Effect<SyncResult, TaxiiClientError>
}
```

### TSG.14.6.2 Client Configuration

```typescript
const TaxiiClientConfig = Schema.Struct({
  // Connection
  serverUrl: Schema.String,
  apiRoot: Schema.optional(Schema.String),

  // Authentication
  auth: Schema.Union(
    Schema.TaggedStruct("basic", {
      username: Schema.String,
      password: Schema.Redacted(Schema.String),
    }),
    Schema.TaggedStruct("bearer", {
      token: Schema.Redacted(Schema.String),
    }),
    Schema.TaggedStruct("oauth2", {
      clientId: Schema.String,
      clientSecret: Schema.Redacted(Schema.String),
      tokenUrl: Schema.String,
    }),
    Schema.TaggedStruct("mtls", {
      certPath: Schema.String,
      keyPath: Schema.String,
    }),
  ),

  // Polling
  pollIntervalMs: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  initialWatermark: Schema.optional(Schema.DateFromString),

  // Limits
  maxObjectsPerRequest: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  requestTimeoutMs: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
})
```

### TSG.14.6.3 Delta Synchronization

The client MUST implement manifest-based delta sync for efficient feed ingestion:

```
Tsingou TAXII Client                  External TAXII Server
────────────────────                  ─────────────────────

1. GET /manifest/?added_after=<watermark>
   ◄── manifest entries (IDs + dates)

2. Compare with local NATS KV cache
   Filter out already-ingested IDs

3. GET /objects/?match[id]=<new_ids>
   ◄── only new STIX objects

4. Decode via StixCodec → BaseSignal[]

5. Publish to NATS: tsingou.ingestion.<source>.>

6. Update watermark in NATS KV
```

**Watermark storage:**

Implementations MUST persist sync watermarks in NATS KV:

```
Bucket: tsingou-taxii-sync
Key:    sync.<source-name>.<collection-id>
Value:  { "watermark": "2026-02-18T12:00:00Z", "last_sync": "2026-02-18T12:05:00Z", "objects_synced": 1234 }
```

### TSG.14.6.4 Feed Registry

Implementations SHOULD maintain a registry of configured external feeds:

| Feed Name | Server URL | API Root | Collection | Poll Interval | Auth Type |
|-----------|-----------|----------|------------|---------------|-----------|
| Anomali Community | taxii.anomali.com | /api/v1/ | community-feed | 15 min | API Key |
| AlienVault OTX | otx.alienvault.com/taxii/ | /api/v1/ | pulse-feed | 30 min | API Key |
| MISP Shared | misp.partner.org | /taxii2/ | shared-events | 5 min | mTLS |
| OpenCTI Export | opencti.internal/taxii2/ | /api/v1/ | all-objects | 1 min | OAuth2 |

---

## TSG.14.7 Filtering and Pagination

### TSG.14.7.1 Server-Side Filtering

The Tsingou TAXII Server MUST support the following filters:

| Filter | Support Level | Implementation |
|--------|--------------|----------------|
| added_after | REQUIRED | Timestamp index on object store |
| match[id] | REQUIRED | Primary key lookup |
| match[type] | REQUIRED | Type index on object store |
| match[version] | REQUIRED | Modified timestamp filter |
| match[spec_version] | SHOULD | Always "2.1" for Tsingou |
| limit | REQUIRED | Result set truncation |

### TSG.14.7.2 Pagination Strategy

Implementations MUST use cursor-based pagination with opaque tokens:

```typescript
interface PaginationCursor {
  readonly collectionId: string
  readonly lastDateAdded: Date
  readonly lastObjectId: string
  readonly filters: TaxiiFilters
  readonly pageSize: number
}
```

The cursor is encoded as a base64 JSON string for the `next` token:

```
next = base64(JSON.stringify(cursor))
```

**Cursor expiration:** Implementations SHOULD expire cursors after 1 hour. Expired cursors MUST return HTTP 416 Requested Range Not Satisfiable.

### TSG.14.7.3 Default Page Size

| API Root | Default Page Size | Max Page Size |
|----------|------------------|---------------|
| Internal | 100 | 10,000 |
| Partner | 50 | 1,000 |
| Public | 25 | 500 |

---

## TSG.14.8 Authentication and Authorization

### TSG.14.8.1 Authentication Mechanisms

Implementations MUST support the following authentication mechanisms:

| Mechanism | API Root | Required | Implementation |
|-----------|----------|----------|----------------|
| OAuth 2.0 Client Credentials | Internal | YES | [RFC6749] Section 4.4 |
| API Key (Bearer token) | Partner | YES | Authorization: Bearer <key> |
| Mutual TLS | Partner | RECOMMENDED | [RFC8446] client certificates |
| HTTP Basic (over TLS) | Public | MAY | [RFC7617] for simple consumers |
| Anonymous | Public | MAY | Rate-limited, read-only |

### TSG.14.8.2 Authorization Matrix

| API Root | Role | Collections | Operations |
|----------|------|------------|-----------|
| Internal | admin | All | Read, Write, Delete |
| Internal | operator | All | Read, Write |
| Internal | viewer | All | Read |
| Partner | partner-org | Filtered subset | Read |
| Partner | partner-write | Designated write collections | Read, Write |
| Public | anonymous | Public only | Read |
| Public | community | Public only | Read |

### TSG.14.8.3 OAuth 2.0 Integration

```
Client (OpenCTI)                     Tsingou Auth Server
─────────────────                    ─────────────────────

1. POST /oauth/token
   grant_type=client_credentials
   client_id=opencti-connector
   client_secret=<secret>
   scope=taxii:read:internal

   ◄── { "access_token": "ey...", "expires_in": 3600 }

2. GET /api/internal/collections/
   Authorization: Bearer ey...

   ◄── { "collections": [...] }
```

---

## TSG.14.9 Error Handling

### TSG.14.9.1 TAXII Error Responses

All error responses MUST use the TAXII error object format:

```json
{
  "title": "Authentication Required",
  "description": "A valid OAuth 2.0 bearer token is required for this API Root",
  "error_id": "err-20260218-001",
  "error_code": "TAXII_AUTH_REQUIRED",
  "http_status": "401",
  "external_details": "https://docs.tsingou.example.com/taxii/errors/401"
}
```

### TSG.14.9.2 Error Code Registry

| Error Code | HTTP Status | Description |
|-----------|-------------|-------------|
| TAXII_AUTH_REQUIRED | 401 | Missing authentication credentials |
| TAXII_AUTH_INVALID | 401 | Invalid or expired credentials |
| TAXII_FORBIDDEN | 403 | Insufficient permissions for operation |
| TAXII_NOT_FOUND | 404 | Collection or object not found |
| TAXII_METHOD_NOT_ALLOWED | 405 | Operation not supported (e.g., DELETE) |
| TAXII_CONTENT_TYPE | 406 | Unsupported Accept header |
| TAXII_PAYLOAD_TOO_LARGE | 413 | Request exceeds max_content_length |
| TAXII_MEDIA_TYPE | 415 | Unsupported Content-Type header |
| TAXII_VALIDATION_FAILED | 422 | STIX object failed validation |
| TAXII_RATE_LIMITED | 429 | Rate limit exceeded |
| TAXII_INTERNAL_ERROR | 500 | Unexpected server error |
| TAXII_CURSOR_EXPIRED | 416 | Pagination cursor expired |

### TSG.14.9.3 Rate Limiting

| API Root | Rate Limit | Window | Burst |
|----------|-----------|--------|-------|
| Internal | 1000 req/min | Per client | 100 |
| Partner | 100 req/min | Per API key | 20 |
| Public | 30 req/min | Per IP | 10 |

Rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1708266000
Retry-After: 30
```

---

## TSG.14.10 Transport Security

### TSG.14.10.1 TLS Requirements

| Requirement | Level | Description |
|-------------|-------|-------------|
| TLS 1.3 | REQUIRED | Minimum protocol version |
| TLS 1.2 | MAY | Only for legacy client compatibility |
| HSTS | REQUIRED | Strict-Transport-Security header |
| Certificate transparency | RECOMMENDED | CT logs for public endpoints |
| OCSP stapling | RECOMMENDED | Certificate revocation checking |

### TSG.14.10.2 CORS Configuration

For browser-based consumers (Tsingou web frontend accessing its own TAXII server):

```http
Access-Control-Allow-Origin: https://tsingou.example.com
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Accept, Content-Type, Authorization
Access-Control-Expose-Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
Access-Control-Max-Age: 86400
```

Implementations MUST NOT set `Access-Control-Allow-Origin: *` on authenticated API Roots.

---

## TSG.14.11 Object Store

### TSG.14.11.1 Storage Backend

The TAXII server requires a persistent store for STIX objects. Implementations SHOULD use:

| Backend | Deployment | Latency | Capacity |
|---------|-----------|---------|----------|
| NATS JetStream KV | Primary (all deployments) | <5ms | Millions of objects |
| SQLite | Tauri desktop (offline) | <1ms | Hundreds of thousands |
| Elasticsearch | Large-scale (optional) | 10-50ms | Billions of objects |

### TSG.14.11.2 NATS KV Storage Schema

```
Bucket: tsingou-taxii-objects
  Key: obj.<collection_id>.<stix_type>.<stix_uuid>
  Value: { stix_object_json, date_added, collection_id }

Bucket: tsingou-taxii-manifest
  Key: manifest.<collection_id>.<stix_uuid>
  Value: { id, date_added, version, media_type }

Bucket: tsingou-taxii-status
  Key: status.<status_uuid>
  Value: { status_resource_json }
```

### TSG.14.11.3 Index Requirements

| Index | Fields | Purpose |
|-------|--------|---------|
| Primary | collection_id + stix_id | Object lookup |
| Type | collection_id + stix_type | Type filtering |
| Time | collection_id + date_added | added_after filter |
| Version | collection_id + stix_id + modified | Version queries |

---

## TSG.14.12 Performance Targets

### TSG.14.12.1 Throughput Benchmarks

| Operation | Target | Conditions |
|-----------|--------|-----------|
| GET /objects/ (100 per page) | <50ms p99 | Cached, filtered by type |
| POST /objects/ (100 objects) | <200ms p99 | Validation + store |
| GET /manifest/ (1000 entries) | <30ms p99 | Lightweight metadata |
| GET /objects/{id}/ (single) | <10ms p99 | Primary key lookup |
| Bridge throughput | 10,000 signals/sec | Batched, at-least-once |
| Client delta sync | <5s for 10K objects | Manifest-based |

### TSG.14.12.2 Scaling Strategy

```
Low Volume (<1K signals/min)
  └── Single TAXII server instance
       └── NATS KV object store

Medium Volume (1K-100K signals/min)
  └── Load-balanced TAXII server (2-4 instances)
       └── Shared NATS KV cluster
       └── Partitioned bridge (one per signal kind)

High Volume (>100K signals/min)
  └── TAXII server cluster with API gateway
       └── Elasticsearch object store
       └── Sharded bridge fleet with consumer groups
       └── CDN for public API Root
```

---

## TSG.14.13 Effect Layer Composition

### TSG.14.13.1 Service Dependency Graph

```
TaxiiServer
  ├── HttpServer          (@effect/platform)
  ├── TaxiiObjectStore    (NATS KV or SQLite)
  ├── StixCodec           (TSG.13)
  ├── AuthProvider        (OAuth 2.0 / API Key / mTLS)
  ├── RateLimiter         (Token bucket per client)
  └── MetricsCollector    (Prometheus-compatible)

NatsTaxiiBridge
  ├── NatsClient          (JetStream consumers)
  ├── StixCodec           (TSG.13)
  ├── TaxiiServer         (internal ingest API)
  └── Clock               (flush timing)

TaxiiClient
  ├── HttpClient          (@effect/platform)
  ├── StixCodec           (TSG.13)
  ├── NatsClient          (publish decoded signals)
  └── WatermarkStore      (NATS KV)
```

### TSG.14.13.2 Layer Assembly

```typescript
// TAXII Server full stack
const TaxiiServerFull = TaxiiServerLive.pipe(
  Layer.provide(HttpServerLive),
  Layer.provide(TaxiiObjectStoreLive),
  Layer.provide(StixCodecFull),
  Layer.provide(AuthProviderLive),
  Layer.provide(RateLimiterLive),
  Layer.provide(MetricsCollectorLive),
)

// Bridge full stack
const NatsTaxiiBridgeFull = NatsTaxiiBridgeLive.pipe(
  Layer.provide(NatsClientLive),
  Layer.provide(StixCodecFull),
  Layer.provide(TaxiiServerFull),
  Layer.provide(Clock.Live),
)

// Combined platform layer
const TaxiiPlatformLive = Layer.mergeAll(
  TaxiiServerFull,
  NatsTaxiiBridgeFull,
)
```

---

## TSG.14.14 Implementation Phases

| Phase | Scope | Dependencies |
|-------|-------|-------------|
| Phase 1 | TAXII Server (read-only): Discovery, API Root, Collections, Objects GET, Manifest | TSG.12, TSG.13 |
| Phase 2 | TAXII Server (write): Objects POST, Status, Bridge | Phase 1 + NATS |
| Phase 3 | TAXII Client: Pull, Delta Sync | Phase 1 |
| Phase 4 | Authentication: OAuth 2.0, API Keys, mTLS | Phase 2 |
| Phase 5 | Multi-root: Partner and Public API Roots with filtering | Phase 4 |
| Phase 6 | Performance: Pagination optimization, caching, rate limiting | Phase 5 |

---

## References

| Key | Citation |
|-----|----------|
| [TAXII21] | OASIS, "TAXII Version 2.1", Committee Specification 01, June 2020 |
| [STIX21] | OASIS, "STIX Version 2.1", Committee Specification 03, June 2020 |
| [RFC2119] | IETF, "Key words for use in RFCs to Indicate Requirement Levels", March 1997 |
| [RFC8174] | IETF, "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", May 2017 |
| [RFC6749] | IETF, "The OAuth 2.0 Authorization Framework", October 2012 |
| [RFC8446] | IETF, "TLS Protocol Version 1.3", August 2018 |
| [RFC7617] | IETF, "The 'Basic' HTTP Authentication Scheme", September 2015 |

---

*End of Section TSG.14*
