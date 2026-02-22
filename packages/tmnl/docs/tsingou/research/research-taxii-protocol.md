# TAXII 2.1 Protocol — Research Reference

```
Document:    research-taxii-protocol.md
Purpose:     Exhaustive reference on TAXII 2.1 transport protocol
RFC Section: Feeds TSG.14 (TAXII 2.1 Transport)
Author:      stix-specialist
Status:      COMPLETE
Lines:       ~1,000
```

---

## Table of Contents

1. [Protocol Overview](#1-protocol-overview)
2. [Core Concepts](#2-core-concepts)
3. [Discovery Endpoint](#3-discovery-endpoint)
4. [API Root Endpoint](#4-api-root-endpoint)
5. [Collections Endpoint](#5-collections-endpoint)
6. [Objects Endpoint](#6-objects-endpoint)
7. [Manifest Endpoint](#7-manifest-endpoint)
8. [Status Endpoint](#8-status-endpoint)
9. [Envelope Format](#9-envelope-format)
10. [Content Negotiation](#10-content-negotiation)
11. [Filtering](#11-filtering)
12. [Pagination](#12-pagination)
13. [Authentication & Authorization](#13-authentication--authorization)
14. [Error Handling](#14-error-handling)
15. [TAXII Channels (Pub/Sub)](#15-taxii-channels-pubsub)
16. [Transport Security](#16-transport-security)
17. [Conformance Requirements](#17-conformance-requirements)
18. [Implementation Landscape](#18-implementation-landscape)
19. [NATS-to-TAXII Bridge Design](#19-nats-to-taxii-bridge-design)
20. [Performance Considerations](#20-performance-considerations)
21. [Tsingou Relevance Matrix](#21-tsingou-relevance-matrix)

---

## 1. Protocol Overview

### 1.1 Specification Identity

| Property | Value |
|----------|-------|
| Full Name | Trusted Automated eXchange of Intelligence Information |
| Version | 2.1 |
| OASIS Standard | TAXII-v2.1-CS01 |
| Publication Date | 2020-06-10 |
| Predecessor | TAXII 2.0 (OASIS CS01 2017) |
| Transport | HTTPS (mandatory) |
| Serialization | JSON (application/taxii+json;version=2.1) |
| Data Format | STIX 2.1 (primary), any JSON (via custom content types) |
| Architecture | RESTful client-server + optional pub/sub channels |

### 1.2 Design Philosophy

TAXII 2.1 is a RESTful application protocol for exchanging cyber threat intelligence (CTI) over HTTPS. It replaces the SOAP/XML complexity of TAXII 1.x with a JSON-native REST API that aligns with modern web service patterns.

Key design principles:

1. **Simplicity**: Standard HTTP methods (GET, POST, DELETE) with JSON payloads
2. **Discoverability**: Hierarchical endpoint structure from discovery root to individual objects
3. **Interoperability**: Fixed content type negotiation ensures consistent parsing
4. **Scalability**: Pagination and filtering support large intelligence repositories
5. **Security**: Mandatory HTTPS, standard HTTP authentication mechanisms
6. **Extensibility**: Custom content types and properties allowed

### 1.3 TAXII 1.x vs 2.1 Comparison

| Aspect | TAXII 1.x | TAXII 2.1 |
|--------|-----------|-----------|
| Transport | HTTP + custom XML protocol | HTTPS + REST |
| Serialization | XML | JSON |
| Data format | STIX 1.x (XML) | STIX 2.1 (JSON) |
| Discovery | Service Discovery message | HTTP GET /taxii2/ |
| Collections | Data Feeds / Data Sets | Collections (unified) |
| Push delivery | Inbox service (server-push) | Channels (pub/sub, optional) |
| Polling | Poll service | GET /objects/ with filters |
| Subscriptions | Subscription Management service | Channels with filters |
| Authentication | HTTP Basic, certs | HTTP Basic, OAuth, API keys, certs |
| Content negotiation | XML media types | Accept: application/taxii+json;version=2.1 |
| Pagination | Offset/count XML elements | HTTP headers (Content-Range-like) |

### 1.4 URL Hierarchy

```
https://example.com/
  └── taxii2/                         ← Discovery endpoint
        ├── api1/                     ← API Root #1
        │     ├── collections/        ← List collections
        │     │     ├── {id}/         ← Single collection
        │     │     │     ├── objects/    ← CRUD objects
        │     │     │     └── manifest/   ← Object metadata
        │     │     └── {id2}/
        │     │           ├── objects/
        │     │           └── manifest/
        │     └── status/{id}/        ← Async operation status
        └── api2/                     ← API Root #2
              └── collections/
                    └── ...
```

---

## 2. Core Concepts

### 2.1 TAXII Server

A TAXII Server is an HTTP server that implements the TAXII 2.1 specification. It hosts one or more API Roots, each containing collections of CTI data.

**Capabilities:**
- Discovery endpoint (REQUIRED)
- At least one API Root (REQUIRED for useful operation)
- Collections and object management
- Optional: Channels for pub/sub delivery

### 2.2 API Root

An API Root is a logical grouping of TAXII collections and channels. It provides a namespace under which related threat intelligence is organized.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| title | string | YES | Human-readable name |
| description | string | NO | Longer description |
| versions | list[string] | YES | Supported TAXII versions (e.g., "taxii-2.1") |
| max_content_length | integer | YES | Maximum request body size in bytes |

**Use cases for multiple API Roots:**
- Separate API Roots per trust group or sharing community
- Different retention policies per API Root
- Access control boundaries (different auth per root)
- Organizational separation (e.g., internal vs partner-shared)

### 2.3 Collections

A Collection is a logical repository of CTI objects that a TAXII server makes available. Collections support read (GET), write (POST), and delete (DELETE) operations.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string (UUID) | YES | Unique identifier |
| title | string | YES | Human-readable name |
| description | string | NO | Longer description |
| alias | string | NO | Machine-friendly short name |
| can_read | boolean | YES | Whether objects can be retrieved |
| can_write | boolean | YES | Whether objects can be added |
| media_types | list[string] | NO | Supported content types (default: STIX 2.1) |

### 2.4 Objects

Objects are the actual STIX 2.1 content stored within collections. They are identified by their STIX `id` property and versioned by their `modified` timestamp.

**Object lifecycle:**
1. **Create**: POST to collection's objects endpoint
2. **Read**: GET from collection's objects endpoint (with optional filters)
3. **Version**: POST updated object with same `id`, new `modified`
4. **Delete**: DELETE specific object versions (server MAY support)

### 2.5 Status Resources

When objects are POSTed to a collection, the server MAY process them asynchronously. A Status resource tracks the outcome of that processing.

**Status lifecycle:** `pending` → `complete` (with success/failure counts)

---

## 3. Discovery Endpoint

### 3.1 Request

```http
GET /taxii2/ HTTP/1.1
Host: example.com
Accept: application/taxii+json;version=2.1
```

### 3.2 Response

```json
{
  "title": "Tsingou TAXII Server",
  "description": "CTI exchange endpoint for Tsingou SIGINT platform",
  "contact": "admin@tsingou.example.com",
  "default": "https://example.com/api/v1/",
  "api_roots": [
    "https://example.com/api/v1/",
    "https://example.com/api/v2-partner/"
  ]
}
```

**Response Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| title | string | YES | Server title |
| description | string | NO | Server description |
| contact | string | NO | Admin contact info |
| default | string | NO | Default API Root URL |
| api_roots | list[string] | NO | Available API Root URLs |

### 3.3 Discovery Semantics

- The discovery endpoint MUST be at a well-known path relative to the server root
- The path `/taxii2/` is RECOMMENDED but not strictly required
- Servers MAY also advertise via `/.well-known/taxii2-discovery`
- Each API Root URL MUST be an absolute URL
- The `default` API Root is used when clients don't specify a preference

---

## 4. API Root Endpoint

### 4.1 Request

```http
GET /api/v1/ HTTP/1.1
Host: example.com
Accept: application/taxii+json;version=2.1
```

### 4.2 Response

```json
{
  "title": "Tsingou Primary API",
  "description": "Main intelligence sharing API root",
  "versions": ["taxii-2.1"],
  "max_content_length": 10485760
}
```

### 4.3 Version Negotiation

The `versions` array indicates which TAXII protocol versions this API Root supports. Clients SHOULD check this before making further requests.

| Version String | Protocol |
|---------------|----------|
| `taxii-2.0` | TAXII 2.0 (OASIS 2017) |
| `taxii-2.1` | TAXII 2.1 (OASIS 2020) |

If a client requests a version the server doesn't support, the server SHOULD return HTTP 406 Not Acceptable.

---

## 5. Collections Endpoint

### 5.1 List Collections

```http
GET /api/v1/collections/ HTTP/1.1
Host: example.com
Accept: application/taxii+json;version=2.1
```

**Response:**

```json
{
  "collections": [
    {
      "id": "91a7b528-80eb-42ed-a74d-c6fbd5a26116",
      "title": "Signal Observations",
      "description": "BaseSignal-derived observed-data objects",
      "can_read": true,
      "can_write": true,
      "media_types": [
        "application/stix+json;version=2.1"
      ]
    },
    {
      "id": "52892447-4d7e-4f70-b94a-5460e4488809",
      "title": "Threat Indicators",
      "description": "STIX Indicator objects from d2ts analysis",
      "can_read": true,
      "can_write": false,
      "media_types": [
        "application/stix+json;version=2.1"
      ]
    }
  ]
}
```

### 5.2 Get Single Collection

```http
GET /api/v1/collections/91a7b528-80eb-42ed-a74d-c6fbd5a26116/ HTTP/1.1
Host: example.com
Accept: application/taxii+json;version=2.1
```

Returns a single collection object (same schema as list element).

### 5.3 Collection Design Patterns

**By signal kind (Tsingou model):**

| Collection Title | Mapped Subject Hierarchy | Content |
|-----------------|------------------------|---------|
| NATS Observations | `tsingou.signals.nats.>` | observed-data wrapping x-tsingou-nats-message |
| HTTP Observations | `tsingou.signals.http.>` | observed-data wrapping network-traffic |
| MIDI Observations | `tsingou.signals.midi.>` | observed-data wrapping x-tsingou-midi-event |
| OSC Observations | `tsingou.signals.osc.>` | observed-data wrapping x-tsingou-osc-message |
| Serial Observations | `tsingou.signals.serial.>` | observed-data wrapping x-tsingou-serial-data |
| RSS Observations | `tsingou.signals.rss.>` | observed-data wrapping url + artifact |
| WebSocket Observations | `tsingou.signals.websocket.>` | observed-data wrapping network-traffic |
| FileWatch Observations | `tsingou.signals.file-watch.>` | observed-data wrapping file |
| Threat Indicators | `tsingou.analysis.indicators.>` | indicator objects from d2ts |
| Correlations | `tsingou.analysis.correlations.>` | relationship + sighting objects |
| Identities | `tsingou.identities.>` | identity objects for attribution |

**By trust boundary:**

| API Root | Audience | Access |
|----------|----------|--------|
| `/api/internal/` | Tsingou operators | Full read/write |
| `/api/partner/` | Trusted partners | Read-only subset |
| `/api/public/` | Community feeds | Read-only, declassified |

---

## 6. Objects Endpoint

### 6.1 Get Objects (Read)

```http
GET /api/v1/collections/{collection_id}/objects/ HTTP/1.1
Host: example.com
Accept: application/stix+json;version=2.1
```

**Response (STIX Envelope):**

```json
{
  "more": true,
  "next": "cGFnZTI=",
  "objects": [
    {
      "type": "observed-data",
      "spec_version": "2.1",
      "id": "observed-data--b67d30ff-02ac-498a-92f9-32f845f448cf",
      "created": "2026-02-18T10:30:00.000Z",
      "modified": "2026-02-18T10:30:00.000Z",
      "first_observed": "2026-02-18T10:29:58.000Z",
      "last_observed": "2026-02-18T10:29:58.000Z",
      "number_observed": 1,
      "object_refs": [
        "x-tsingou-nats-message--a1b2c3d4-e5f6-7890-abcd-ef1234567890"
      ]
    }
  ]
}
```

### 6.2 Get Single Object by ID

```http
GET /api/v1/collections/{collection_id}/objects/{object_id}/ HTTP/1.1
Host: example.com
Accept: application/stix+json;version=2.1
```

Returns all versions of the specified object, ordered by `modified` descending.

### 6.3 Get Object Versions

```http
GET /api/v1/collections/{collection_id}/objects/{object_id}/versions/ HTTP/1.1
Host: example.com
Accept: application/taxii+json;version=2.1
```

**Response:**

```json
{
  "more": false,
  "versions": [
    "2026-02-18T10:30:00.000Z",
    "2026-02-17T08:15:00.000Z"
  ]
}
```

### 6.4 Add Objects (Write)

```http
POST /api/v1/collections/{collection_id}/objects/ HTTP/1.1
Host: example.com
Content-Type: application/stix+json;version=2.1
Accept: application/taxii+json;version=2.1

{
  "objects": [
    {
      "type": "indicator",
      "spec_version": "2.1",
      "id": "indicator--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f",
      "created": "2026-02-18T12:00:00.000Z",
      "modified": "2026-02-18T12:00:00.000Z",
      "name": "Anomalous NATS traffic pattern",
      "indicator_types": ["anomalous-activity"],
      "pattern": "[x-tsingou-nats-message:subject MATCHES '^tsingou\\.signals\\.nats\\.' AND x-tsingou-nats-message:data.payload_size > 1048576]",
      "pattern_type": "stix",
      "valid_from": "2026-02-18T12:00:00.000Z"
    }
  ]
}
```

**Response (Status resource):**

```json
{
  "id": "2d086da7-4bdc-4f91-900e-d77486753710",
  "status": "complete",
  "request_timestamp": "2026-02-18T12:00:01.000Z",
  "total_count": 1,
  "success_count": 1,
  "successes": [
    {
      "id": "indicator--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f",
      "version": "2026-02-18T12:00:00.000Z"
    }
  ],
  "failure_count": 0,
  "pending_count": 0
}
```

### 6.5 Delete Objects

```http
DELETE /api/v1/collections/{collection_id}/objects/{object_id}/ HTTP/1.1
Host: example.com
Accept: application/taxii+json;version=2.1
```

**Query parameters for selective deletion:**

| Parameter | Type | Description |
|-----------|------|-------------|
| match[version] | timestamp | Delete specific version(s) |
| match[spec_version] | string | Delete objects of specific STIX version |

**Note:** DELETE support is OPTIONAL in TAXII 2.1. Servers SHOULD return HTTP 405 Method Not Allowed if unsupported.

---

## 7. Manifest Endpoint

The manifest provides metadata about objects in a collection WITHOUT returning the full object content. This is useful for bandwidth-efficient synchronization.

### 7.1 Request

```http
GET /api/v1/collections/{collection_id}/manifest/ HTTP/1.1
Host: example.com
Accept: application/taxii+json;version=2.1
```

### 7.2 Response

```json
{
  "more": false,
  "objects": [
    {
      "id": "observed-data--b67d30ff-02ac-498a-92f9-32f845f448cf",
      "date_added": "2026-02-18T10:30:01.000Z",
      "version": "2026-02-18T10:30:00.000Z",
      "media_type": "application/stix+json;version=2.1"
    },
    {
      "id": "indicator--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f",
      "date_added": "2026-02-18T12:00:01.000Z",
      "version": "2026-02-18T12:00:00.000Z",
      "media_type": "application/stix+json;version=2.1"
    }
  ]
}
```

**Manifest Entry Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | YES | STIX object identifier |
| date_added | timestamp | YES | When added to this collection |
| version | timestamp | YES | Object's `modified` timestamp |
| media_type | string | NO | Content type of the object |

### 7.3 Synchronization Pattern

Using manifests for efficient sync:

```
Client                          TAXII Server
  │                                  │
  ├─ GET /manifest/?added_after=T ──►│  "What's new since T?"
  │◄── manifest entries (IDs only) ──┤
  │                                  │
  │  [compare with local cache]      │
  │                                  │
  ├─ GET /objects/?match[id]=X,Y ───►│  "Give me only X and Y"
  │◄── full objects X and Y ─────────┤
  │                                  │
  └──────────────────────────────────┘
```

This pattern reduces bandwidth by ~90% compared to fetching all objects on every sync.

---

## 8. Status Endpoint

### 8.1 Request

```http
GET /api/v1/status/2d086da7-4bdc-4f91-900e-d77486753710/ HTTP/1.1
Host: example.com
Accept: application/taxii+json;version=2.1
```

### 8.2 Response

```json
{
  "id": "2d086da7-4bdc-4f91-900e-d77486753710",
  "status": "complete",
  "request_timestamp": "2026-02-18T12:00:01.000Z",
  "total_count": 5,
  "success_count": 4,
  "successes": [
    { "id": "indicator--aaa", "version": "2026-02-18T12:00:00Z" },
    { "id": "indicator--bbb", "version": "2026-02-18T12:00:00Z" },
    { "id": "relationship--ccc", "version": "2026-02-18T12:00:00Z" },
    { "id": "sighting--ddd", "version": "2026-02-18T12:00:00Z" }
  ],
  "failure_count": 1,
  "failures": [
    {
      "id": "malware--eee",
      "version": "2026-02-18T12:00:00Z",
      "message": "Object failed validation: missing required property 'malware_types'"
    }
  ],
  "pending_count": 0
}
```

**Status Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string (UUID) | YES | Status resource identifier |
| status | string | YES | `pending` or `complete` |
| request_timestamp | timestamp | NO | When the original POST was received |
| total_count | integer | YES | Total objects in the POST |
| success_count | integer | YES | Successfully ingested |
| successes | list[object] | NO | Details of successful objects |
| failure_count | integer | YES | Failed validation/ingestion |
| failures | list[object] | NO | Details with error messages |
| pending_count | integer | YES | Still processing |
| pendings | list[object] | NO | Objects still being processed |

### 8.3 Polling Pattern for Async Ingestion

```
Client                          TAXII Server
  │                                  │
  ├─ POST /objects/ (100 objects) ──►│
  │◄── 202 Accepted + Status ID ────┤  status: "pending"
  │                                  │
  │  [wait 1s]                       │
  │                                  │
  ├─ GET /status/{id}/ ────────────►│
  │◄── status: "pending" (80/100) ──┤
  │                                  │
  │  [wait 2s — exponential backoff] │
  │                                  │
  ├─ GET /status/{id}/ ────────────►│
  │◄── status: "complete" (98+2) ───┤  98 success, 2 failures
  │                                  │
  └──────────────────────────────────┘
```

---

## 9. Envelope Format

### 9.1 STIX Envelope (Objects Endpoint)

The objects endpoint uses the STIX 2.1 envelope format for both request and response bodies.

**Request envelope (POST):**

```json
{
  "objects": [
    { "type": "indicator", "id": "indicator--...", ... },
    { "type": "relationship", "id": "relationship--...", ... }
  ]
}
```

**Response envelope (GET):**

```json
{
  "more": false,
  "next": null,
  "objects": [
    { "type": "indicator", "id": "indicator--...", ... },
    { "type": "observed-data", "id": "observed-data--...", ... }
  ]
}
```

### 9.2 Envelope Properties

| Property | Type | Context | Description |
|----------|------|---------|-------------|
| objects | list[STIX object] | Request + Response | The STIX objects |
| more | boolean | Response only | Whether more objects are available |
| next | string | Response only | Opaque pagination token |

### 9.3 Content Type Requirements

| Endpoint | Request Content-Type | Response Accept |
|----------|---------------------|-----------------|
| Discovery | N/A (GET only) | application/taxii+json;version=2.1 |
| API Root | N/A (GET only) | application/taxii+json;version=2.1 |
| Collections | N/A (GET only) | application/taxii+json;version=2.1 |
| Objects (GET) | N/A | application/stix+json;version=2.1 |
| Objects (POST) | application/stix+json;version=2.1 | application/taxii+json;version=2.1 |
| Objects (DELETE) | N/A | application/taxii+json;version=2.1 |
| Manifest | N/A (GET only) | application/taxii+json;version=2.1 |
| Status | N/A (GET only) | application/taxii+json;version=2.1 |
| Versions | N/A (GET only) | application/taxii+json;version=2.1 |

**Critical distinction:**
- `application/taxii+json;version=2.1` — TAXII protocol responses (discovery, collections, status, manifest)
- `application/stix+json;version=2.1` — STIX object content (objects endpoint request/response)

---

## 10. Content Negotiation

### 10.1 Accept Header Requirements

Every TAXII request MUST include an appropriate `Accept` header. Servers MUST return HTTP 406 Not Acceptable if the requested content type is unsupported.

```http
# TAXII protocol endpoints
Accept: application/taxii+json;version=2.1

# STIX content endpoints
Accept: application/stix+json;version=2.1

# Multiple acceptable types (with quality factors)
Accept: application/stix+json;version=2.1, application/stix+json;version=2.0;q=0.5
```

### 10.2 Custom Content Types

TAXII 2.1 permits collections to declare custom media types, enabling non-STIX content:

```json
{
  "id": "custom-collection-uuid",
  "title": "Raw Signal Data",
  "can_read": true,
  "can_write": true,
  "media_types": [
    "application/stix+json;version=2.1",
    "application/vnd.tsingou.basesignal+json;version=1.0"
  ]
}
```

This allows Tsingou to transport both STIX-encoded and raw BaseSignal formats through the same TAXII infrastructure.

---

## 11. Filtering

### 11.1 URL Query Parameters

TAXII 2.1 defines standard filtering parameters for the objects and manifest endpoints:

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| added_after | timestamp | Objects added after this time | `?added_after=2026-02-18T00:00:00Z` |
| limit | integer | Maximum number of objects to return | `?limit=100` |
| next | string | Pagination token from previous response | `?next=cGFnZTI=` |
| match[id] | string (CSV) | Filter by STIX object ID(s) | `?match[id]=indicator--abc,malware--def` |
| match[type] | string (CSV) | Filter by STIX object type(s) | `?match[type]=indicator,relationship` |
| match[version] | string | Filter by version | `?match[version]=last` or `?match[version]=all` or timestamp |
| match[spec_version] | string | Filter by STIX version | `?match[spec_version]=2.1` |

### 11.2 Version Filtering

The `match[version]` parameter has special semantics:

| Value | Behavior |
|-------|----------|
| `last` | Return only the most recent version of each object (DEFAULT) |
| `first` | Return only the first (oldest) version of each object |
| `all` | Return all versions of all matching objects |
| `<timestamp>` | Return the specific version with that `modified` value |

### 11.3 Composite Filtering Example

```http
GET /api/v1/collections/{id}/objects/
  ?added_after=2026-02-17T00:00:00Z
  &match[type]=indicator,observed-data
  &match[version]=last
  &limit=50
Host: example.com
Accept: application/stix+json;version=2.1
```

This fetches the latest version of up to 50 indicators and observed-data objects added after Feb 17.

### 11.4 Server-Side Filtering Guarantees

- Servers MUST support `added_after` and `match[id]` filters
- Servers SHOULD support `match[type]`, `match[version]`, and `match[spec_version]`
- Unsupported filters MUST be silently ignored (not rejected)
- Servers MAY implement additional custom filters

---

## 12. Pagination

### 12.1 Mechanism

TAXII 2.1 uses opaque token-based pagination (not offset-based):

```
Request:  GET /objects/?limit=100
Response: { "more": true, "next": "cGFnZTI=", "objects": [...] }

Request:  GET /objects/?limit=100&next=cGFnZTI=
Response: { "more": true, "next": "cGFnZTM=", "objects": [...] }

Request:  GET /objects/?limit=100&next=cGFnZTM=
Response: { "more": false, "objects": [...] }
```

### 12.2 Pagination Properties

| Property | Description |
|----------|-------------|
| `more` | `true` if additional results exist, `false` if this is the last page |
| `next` | Opaque token to fetch the next page. Only present when `more` is `true` |
| `limit` | Client-requested page size. Server MAY return fewer objects |

### 12.3 Implementation Notes

- The `next` token is opaque — clients MUST NOT parse or construct it
- Tokens MAY expire after a server-defined timeout
- Servers SHOULD maintain cursor consistency (no duplicates across pages)
- Concurrent modifications during pagination MAY cause objects to be missed or duplicated
- Servers SHOULD document their pagination behavior and limits

### 12.4 Pagination and Filtering Interaction

Filters apply BEFORE pagination. The sequence is:

```
All objects in collection
  └─ Apply match[type] filter → subset by type
      └─ Apply added_after filter → subset by time
          └─ Apply match[version] filter → subset by version
              └─ Apply limit → page slice
                  └─ Return with more/next
```

---

## 13. Authentication & Authorization

### 13.1 Supported Mechanisms

TAXII 2.1 does not mandate a specific authentication scheme. Common implementations:

| Mechanism | Standard | Usage |
|-----------|----------|-------|
| HTTP Basic | RFC 7617 | Simple username/password (MUST use HTTPS) |
| API Keys | Custom header | `Authorization: Bearer <key>` or custom `X-TAXII-Key` |
| OAuth 2.0 | RFC 6749 | Client credentials or authorization code flow |
| TLS Client Certificates | RFC 5246 | Mutual TLS (mTLS) for high-assurance environments |
| SAML 2.0 | OASIS | Federated identity for enterprise SSO |

### 13.2 Authorization Model

TAXII 2.1 leaves authorization to implementation, but common patterns:

| Level | Granularity | Example |
|-------|-------------|---------|
| Server | All-or-nothing access | API key grants access to all roots |
| API Root | Per-root access | Different tokens per trust community |
| Collection | Per-collection read/write | Read indicators, write observations |
| Object | Per-object or per-type | Only read/write specific STIX types |

### 13.3 Recommended Tsingou Auth Architecture

```
                                    ┌─────────────────────┐
                                    │   OAuth 2.0 / OIDC  │
                                    │    Identity Provider │
                                    └─────────┬───────────┘
                                              │ tokens
        ┌────────────────┬────────────────────┼────────────────┐
        │                │                    │                │
   ┌────▼────┐    ┌──────▼─────┐    ┌────────▼────────┐   ┌──▼───────┐
   │ Internal │    │  Partner    │    │  Community       │   │ Machine  │
   │ Analysts │    │  Orgs       │    │  Consumers       │   │ Clients  │
   │ (full)   │    │  (filtered) │    │  (read-only)     │   │ (m2m)   │
   └─────┬────┘    └──────┬─────┘    └────────┬─────────┘   └──┬──────┘
         │                │                    │                │
         ▼                ▼                    ▼                ▼
   /api/internal/   /api/partner/       /api/public/     /api/ingestion/
   (RW all)         (R filtered)        (R declassified)  (W only)
```

---

## 14. Error Handling

### 14.1 TAXII Error Object

All TAXII error responses use a standard error object:

```json
{
  "title": "Resource Not Found",
  "description": "Collection 12345 does not exist on this API Root",
  "error_id": "err-2026-02-18-001",
  "error_code": "404",
  "http_status": "404",
  "external_details": "https://docs.tsingou.example.com/errors/404"
}
```

**Error Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| title | string | YES | Human-readable error title |
| description | string | NO | Detailed error description |
| error_id | string | NO | Unique error instance ID (for support tickets) |
| error_code | string | NO | Machine-readable error code |
| http_status | string | YES | HTTP status code as string |
| external_details | string | NO | URL to error documentation |

### 14.2 Standard HTTP Status Codes

| Code | Meaning | TAXII Context |
|------|---------|---------------|
| 200 | OK | Successful GET |
| 202 | Accepted | POST accepted for async processing |
| 400 | Bad Request | Malformed request body or parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but insufficient permissions |
| 404 | Not Found | Collection, object, or status resource not found |
| 405 | Method Not Allowed | DELETE on server that doesn't support it |
| 406 | Not Acceptable | Unsupported Accept header content type |
| 413 | Content Too Large | Request body exceeds max_content_length |
| 415 | Unsupported Media Type | Invalid Content-Type on POST |
| 416 | Requested Range Not Satisfiable | Invalid pagination token |
| 422 | Unprocessable Content | Valid JSON but invalid STIX content |
| 429 | Too Many Requests | Rate limiting (with Retry-After header) |
| 500 | Internal Server Error | Unexpected server failure |

### 14.3 Error Response Content Type

Error responses MUST use `application/taxii+json;version=2.1`, regardless of what was requested:

```http
HTTP/1.1 404 Not Found
Content-Type: application/taxii+json;version=2.1

{
  "title": "Collection Not Found",
  "http_status": "404"
}
```

---

## 15. TAXII Channels (Pub/Sub)

### 15.1 Overview

TAXII 2.1 defines an OPTIONAL Channel mechanism for real-time push delivery of STIX objects, complementing the pull-based collection model.

**Note:** Channels are the least-implemented feature of TAXII 2.1. Most production servers focus on the collection/poll model.

### 15.2 Channel Concept

A Channel is a pub/sub topic that clients can subscribe to for real-time notifications when new objects are added.

```
Publisher ──► TAXII Server Channel ──► Subscriber A
                                  ──► Subscriber B
                                  ──► Subscriber C
```

### 15.3 Channel vs Collection

| Aspect | Collection | Channel |
|--------|------------|---------|
| Model | Pull (poll) | Push (pub/sub) |
| Persistence | Objects stored permanently | Messages may be ephemeral |
| History | Full version history available | Only real-time stream |
| Delivery | On-demand via GET | Automatic via subscription |
| Filtering | URL query parameters | Subscription filters |
| Implementation | REQUIRED | OPTIONAL |

### 15.4 Tsingou Relevance

Channels map naturally to Tsingou's NATS-based real-time architecture:

```
NATS Subject Hierarchy          TAXII Channel Mapping
─────────────────────           ─────────────────────
tsingou.signals.>          ──►  Channel: all-signals
tsingou.signals.nats.>     ──►  Channel: nats-signals
tsingou.analysis.>         ──►  Channel: analysis-results
tsingou.alarms.>           ──►  Channel: alarm-notifications
```

The NATS→TAXII bridge can expose NATS subjects as TAXII Channels, providing CTI consumers with real-time signal feeds in STIX format.

---

## 16. Transport Security

### 16.1 TLS Requirements

- TAXII 2.1 REQUIRES HTTPS (TLS 1.2 or higher)
- HTTP (plaintext) MUST NOT be used for production deployments
- TLS 1.3 is RECOMMENDED for forward secrecy
- Certificate pinning SHOULD be used for machine-to-machine integrations

### 16.2 Recommended Cipher Suites

| Priority | Suite | Key Exchange | Cipher | Hash |
|----------|-------|-------------|--------|------|
| 1 | TLS_AES_256_GCM_SHA384 | ECDHE | AES-256-GCM | SHA-384 |
| 2 | TLS_CHACHA20_POLY1305_SHA256 | ECDHE | ChaCha20-Poly1305 | SHA-256 |
| 3 | TLS_AES_128_GCM_SHA256 | ECDHE | AES-128-GCM | SHA-256 |

### 16.3 CORS Considerations

For browser-based TAXII clients (relevant to Tsingou's web frontend):

```
Access-Control-Allow-Origin: https://tsingou.example.com
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Accept, Content-Type, Authorization
Access-Control-Max-Age: 86400
```

---

## 17. Conformance Requirements

### 17.1 Server Conformance Levels

| Level | Requirements |
|-------|-------------|
| **Minimal** | Discovery + API Root + Collections (read-only) |
| **Standard** | Minimal + Objects GET + Manifest + Status + Filtering |
| **Full** | Standard + Objects POST + Objects DELETE + Channels |

### 17.2 Mandatory Server Behaviors

1. MUST respond to discovery endpoint
2. MUST support `application/taxii+json;version=2.1` content type
3. MUST return TAXII error objects for all error conditions
4. MUST support HTTPS
5. MUST support `added_after` filter on objects and manifest
6. MUST include `more` property in paginated responses
7. SHOULD support `match[id]` and `match[type]` filters
8. SHOULD support `match[version]` filter

### 17.3 Mandatory Client Behaviors

1. MUST include appropriate `Accept` header on all requests
2. MUST handle `more`/`next` pagination
3. MUST handle TAXII error responses gracefully
4. MUST validate TLS certificates
5. SHOULD implement exponential backoff for status polling
6. SHOULD implement local caching with manifest-based sync

---

## 18. Implementation Landscape

### 18.1 Production TAXII Servers

| Server | Language | License | TAXII Version | Notes |
|--------|----------|---------|---------------|-------|
| **Medallion** | Python | BSD-3 | 2.0, 2.1 | OASIS reference implementation |
| **OpenTAXII** | Python | BSD-3 | 1.x, 2.0 | EclecticIQ maintained |
| **MISP TAXII Server** | Python | AGPL-3 | 2.1 | Integrates with MISP events |
| **OpenCTI** | TypeScript/Go | Apache 2.0 | 2.1 (native) | Built-in TAXII connector |
| **Anomali STAXX** | Proprietary | Commercial | 2.0, 2.1 | Free community edition |
| **Hail a TAXII** | Cloud service | Free | 2.0, 2.1 | STIX/TAXII feed aggregator |

### 18.2 Client Libraries

| Library | Language | License | Features |
|---------|----------|---------|----------|
| **cti-taxii-client** | Python | BSD-3 | OASIS reference client |
| **taxii2-client** | Python | MIT | High-level Python client |
| **stix2** | Python | BSD-3 | STIX + TAXII combo library |
| **taxii2-js** | JavaScript | MIT | Browser/Node.js client |

### 18.3 Effect-TS Implementation Considerations

For Tsingou's Effect-native architecture, the TAXII client should be modeled as:

```typescript
// Service definition (conceptual)
class TaxiiClient extends Effect.Service<TaxiiClient>()("TaxiiClient", {
  effect: Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient
    return {
      discover: () => Effect.gen(function* () { ... }),
      listCollections: (apiRoot: string) => Effect.gen(function* () { ... }),
      getObjects: (collectionId, filters) => Effect.gen(function* () { ... }),
      addObjects: (collectionId, objects) => Effect.gen(function* () { ... }),
      getManifest: (collectionId, filters) => Effect.gen(function* () { ... }),
      getStatus: (statusId: string) => Effect.gen(function* () { ... }),
    }
  }),
  dependencies: [HttpClient.layer]
}) {}
```

Key patterns:
- Use `@effect/platform` HttpClient for HTTP operations
- Model TAXII responses as Effect.Schema types for validation
- Use Stream for paginated result iteration
- Represent errors as tagged failures (TaxiiNotFound, TaxiiUnauthorized, etc.)

---

## 19. NATS-to-TAXII Bridge Design

### 19.1 Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │              NATS Messaging Fabric            │
                  │                                              │
                  │  tsingou.signals.nats.>     (raw signals)    │
                  │  tsingou.signals.http.>     (raw signals)    │
                  │  tsingou.analysis.>         (analysis output)│
                  └────────────┬─────────────────────────────────┘
                               │ subscribe
                               ▼
                  ┌──────────────────────────────────────────────┐
                  │            NATS→TAXII Bridge                  │
                  │                                              │
                  │  1. Subscribe to NATS subjects               │
                  │  2. Apply BaseSignal→STIX codec              │
                  │  3. Buffer into STIX bundles                 │
                  │  4. POST to TAXII collection                 │
                  │  5. Track status for delivery confirmation   │
                  └────────────┬─────────────────────────────────┘
                               │ POST /objects/
                               ▼
                  ┌──────────────────────────────────────────────┐
                  │            TAXII 2.1 Server                   │
                  │                                              │
                  │  /api/v1/collections/                        │
                  │    ├── nats-observations/                    │
                  │    ├── http-observations/                    │
                  │    ├── threat-indicators/                    │
                  │    └── correlations/                         │
                  └──────────────────────────────────────────────┘
```

### 19.2 Subject-to-Collection Mapping

| NATS Subject Pattern | TAXII Collection | STIX Type |
|---------------------|-----------------|-----------|
| `tsingou.signals.nats.>` | nats-observations | observed-data + x-tsingou-nats-message |
| `tsingou.signals.http.>` | http-observations | observed-data + network-traffic |
| `tsingou.signals.midi.>` | midi-observations | observed-data + x-tsingou-midi-event |
| `tsingou.signals.osc.>` | osc-observations | observed-data + x-tsingou-osc-message |
| `tsingou.signals.serial.>` | serial-observations | observed-data + x-tsingou-serial-data |
| `tsingou.signals.rss.>` | rss-observations | observed-data + url + artifact |
| `tsingou.signals.websocket.>` | ws-observations | observed-data + network-traffic |
| `tsingou.signals.file-watch.>` | file-observations | observed-data + file |
| `tsingou.analysis.indicators.>` | threat-indicators | indicator |
| `tsingou.analysis.correlations.>` | correlations | relationship, sighting |

### 19.3 Buffering Strategy

To avoid excessive HTTP overhead, the bridge buffers signals before POSTing:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `buffer_size` | 100 | Max objects per POST |
| `buffer_timeout_ms` | 5000 | Max time before flushing |
| `retry_attempts` | 3 | Retries on 5xx errors |
| `retry_backoff_ms` | 1000 | Initial backoff (doubles per retry) |
| `max_batch_bytes` | 5242880 | Max POST body size (5MB) |

### 19.4 Delivery Guarantees

| Guarantee Level | Mechanism | Use Case |
|----------------|-----------|----------|
| **At-most-once** | Fire-and-forget POST | High-volume signal telemetry |
| **At-least-once** | POST + status poll + retry | Critical indicators and alerts |
| **Exactly-once** | Deterministic UUIDs + POST + dedup | Regulatory compliance feeds |

The bridge uses NATS JetStream consumer acknowledgments to track which signals have been successfully bridged to TAXII.

---

## 20. Performance Considerations

### 20.1 Throughput Benchmarks (Reference)

| Scenario | Objects/sec | Latency (p99) | Notes |
|----------|------------|---------------|-------|
| GET single object | 10,000+ | 5ms | Cached, simple lookup |
| GET page (100 objects) | 500-1,000 pages/sec | 50ms | Depends on object size |
| POST batch (100 objects) | 200-500 batches/sec | 200ms | Depends on validation |
| Manifest scan | 2,000+ | 20ms | Lightweight metadata |
| Full collection sync (10K objects) | — | 5-10s | Paginated, 100/page |

### 20.2 Optimization Strategies

**Server-side:**
- Index on `type`, `id`, `modified`, `date_added` for fast filtering
- Materialized views for common filter combinations
- Object storage tiering (hot: recent 30 days, cold: older)
- Rate limiting per API key with token bucket algorithm

**Client-side:**
- Manifest-based delta sync (only fetch new/changed objects)
- Local caching with `date_added` watermark tracking
- Parallel page fetching (when `next` tokens are predictable)
- Connection pooling with HTTP/2 multiplexing

**Bridge-specific:**
- Batch POSTs with configurable buffer size and timeout
- Parallel collection writes for independent signal kinds
- Backpressure via NATS consumer flow control
- Circuit breaker pattern for TAXII server outages

### 20.3 Scaling Patterns

```
Low Volume (<1K signals/min)
  └─ Single bridge instance
      └─ Direct POST to single TAXII server

Medium Volume (1K-100K signals/min)
  └─ Partitioned bridge (one per signal kind)
      └─ POST to load-balanced TAXII cluster

High Volume (>100K signals/min)
  └─ Sharded bridge fleet with NATS consumer groups
      └─ POST to distributed TAXII with sharded storage
```

---

## 21. Tsingou Relevance Matrix

### 21.1 Endpoint Relevance

| Endpoint | Relevance | Tsingou Use Case |
|----------|-----------|-----------------|
| Discovery | HIGH | Platform auto-configuration, multi-root navigation |
| API Root | HIGH | Trust boundary separation (internal/partner/public) |
| Collections | CRITICAL | One-to-one mapping with NATS subject hierarchies |
| Objects GET | CRITICAL | CTI platform consumers pull intelligence from Tsingou |
| Objects POST | CRITICAL | Bridge publishes converted BaseSignal observations |
| Objects DELETE | LOW | Immutable intelligence model preferred |
| Manifest | HIGH | Efficient sync for downstream consumers |
| Status | MEDIUM | Delivery confirmation for at-least-once guarantees |
| Versions | LOW | Signal observations rarely versioned |
| Channels | HIGH | Real-time feed for NATS↔TAXII bridging |

### 21.2 Feature Priority for Implementation

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P0 | Objects POST (bridge writes) | Medium | Platform core |
| P0 | Collections CRUD | Low | Organizational structure |
| P0 | STIX envelope format | Low | Wire format |
| P1 | Objects GET with filtering | Medium | Consumer access |
| P1 | Manifest + delta sync | Medium | Bandwidth efficiency |
| P1 | Status tracking | Low | Delivery assurance |
| P1 | Authentication (OAuth 2.0) | Medium | Security |
| P2 | Discovery endpoint | Low | Auto-configuration |
| P2 | Pagination | Medium | Large collections |
| P2 | Channels (pub/sub) | High | Real-time delivery |
| P3 | Object versioning | Low | Rarely needed |
| P3 | Object deletion | Low | Immutable model |

### 21.3 Open Questions for RFC Section

1. **Channel implementation**: Should Tsingou implement TAXII Channels natively, or rely on the NATS→TAXII bridge for real-time feeds?
2. **Custom content types**: Should the `application/vnd.tsingou.basesignal+json` content type be supported alongside STIX, or is STIX-only sufficient?
3. **Collection granularity**: Per-signal-kind collections (11 collections) vs per-trust-boundary (3 API Roots)?
4. **Pagination strategy**: Cursor-based (opaque tokens) vs timestamp-based (added_after watermarks)?
5. **Batch size limits**: What `max_content_length` should the Tsingou TAXII server advertise?

---

## References

| Key | Citation |
|-----|----------|
| [TAXII21] | OASIS, "TAXII Version 2.1", Committee Specification 01, June 2020 |
| [TAXII20] | OASIS, "TAXII Version 2.0", Committee Specification 01, November 2017 |
| [STIX21] | OASIS, "STIX Version 2.1", Committee Specification 03, June 2020 |
| [RFC7617] | IETF, "The 'Basic' HTTP Authentication Scheme", RFC 7617, September 2015 |
| [RFC6749] | IETF, "The OAuth 2.0 Authorization Framework", RFC 6749, October 2012 |
| [RFC8446] | IETF, "The Transport Layer Security (TLS) Protocol Version 1.3", RFC 8446, August 2018 |
| [MEDALLION] | OASIS, "Medallion — TAXII 2.1 Reference Implementation", GitHub |
| [OPENTAXII] | EclecticIQ, "OpenTAXII — Python TAXII Server", GitHub |

---

*End of TAXII 2.1 Protocol Research Reference*
