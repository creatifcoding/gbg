# RFC-002 Section TSG.33: Palantir Knowledge Graph Integration

```
Section:       TSG.33 — Palantir Knowledge Graph Integration
Parent RFC:    RFC-002 (Tsingou — Signal Intelligence Visualization Platform)
Status:        DRAFT
Author:        graph-theory-specialist (Val)
Created:       2026-02-18
Research Base: research-palantir-integration.md (7 sections, 13 references)
```

> This section specifies the integration between Tsingou's signal intelligence
> visualization platform and the Palantir knowledge graph ecosystem (Foundry and
> Gotham). The integration is bidirectional: Tsingou exports computed graph analytics
> (centrality, community structure, anomaly scores) to Palantir's Ontology, and
> imports analyst-curated intelligence (manual links, annotations, entity resolutions)
> from Palantir back to Tsingou's d2ts pipeline. The integration is OPTIONAL —
> Tsingou operates independently without Palantir. The key words "MUST", "MUST NOT",
> "SHOULD", "SHOULD NOT", and "MAY" are to be interpreted as described in [RFC2119]
> and [RFC8174].

---

## Table of Contents

1. [Conventions and Terminology](#tsg331-conventions-and-terminology)
2. [Palantir Ontology Model](#tsg332-palantir-ontology-model)
3. [STIX-to-Ontology Mapping](#tsg333-stix-to-ontology-mapping)
4. [API Integration Architecture](#tsg334-api-integration-architecture)
5. [NATS-Palantir Bridge](#tsg335-nats-palantir-bridge)
6. [Graph Query Patterns](#tsg336-graph-query-patterns)
7. [Security Model Alignment](#tsg337-security-model-alignment)
8. [AIP Agent Integration](#tsg338-aip-agent-integration)
9. [Synchronization Modes](#tsg339-synchronization-modes)
10. [Conflict Resolution](#tsg3310-conflict-resolution)
11. [Normative Constraints](#tsg3311-normative-constraints)
12. [Worked Examples](#tsg3312-worked-examples)
13. [Cross-References](#tsg3313-cross-references-to-other-rfc-sections)
14. [Effect-TS Service Architecture](#tsg3314-effect-ts-service-architecture)
15. [Open Questions](#tsg3315-open-questions)
16. [References](#tsg3316-references)

---

## TSG.33.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### TSG.33.1.1 Terminology

| Term | Definition |
|------|-----------|
| **Ontology** | Palantir's semantic data model: objects, properties, links, actions, functions [PALANTIR-ONTOLOGY] |
| **Object Type** | Schema definition of a real-world entity or event in the Palantir Ontology [PALANTIR-OBJECT-TYPES] |
| **Object** | An instance of an object type; corresponds to a single real-world entity or event |
| **Property** | A typed attribute of an object type (string, integer, timestamp, GeoPoint, etc.) |
| **Link Type** | Schema definition of a relationship between two object types [PALANTIR-LINK-TYPES] |
| **Link** | An instance of a link type connecting two objects |
| **Action Type** | Schema definition of a validated write operation [PALANTIR-ACTIONS] |
| **Interface** | Polymorphic type definition allowing queries across multiple object types |
| **Marking** | Mandatory access control label restricting visibility [PALANTIR-MARKINGS] |
| **CBAC** | Classification-Based Access Controls for government classification schemes |
| **OSDK** | Ontology Software Development Kit — type-safe client libraries [PALANTIR-OSDK] |
| **Backing Dataset** | Foundry dataset that stores object data; columns map to properties |
| **Object-Backed Link** | Link type with its own backing dataset, enabling link-level properties |
| **AIP** | Artificial Intelligence Platform — Palantir's AI/ML layer on the Ontology [PALANTIR-AIP] |
| **SDO** | STIX Domain Object — entity in the STIX 2.1 graph model [STIX-2.1] |
| **SRO** | STIX Relationship Object — relationship in the STIX 2.1 graph model [STIX-2.1] |
| **Bridge** | Tsingou component that mediates between NATS messaging and Palantir APIs |
| **System of Record** | The authoritative source for a given data category |

### TSG.33.1.2 Architectural Position

The Palantir integration is an OPTIONAL module in the Tsingou architecture. All Tsingou
functionality specified in other sections of this RFC operates independently of Palantir.
The Palantir bridge adds:

1. **Knowledge graph persistence**: Long-term storage of analyst-curated intelligence
2. **Enterprise integration**: Connection to broader organizational data estates
3. **Collaborative analysis**: Multi-analyst workflows with conflict resolution
4. **AIP augmentation**: AI agent reasoning over Tsingou-computed analytics

Implementations MUST NOT create hard dependencies on Palantir APIs. The bridge module
MUST be independently deployable and removable without affecting core Tsingou functionality.

---

## TSG.33.2 Palantir Ontology Model

### TSG.33.2.1 Ontology Architecture

The Palantir Ontology is a semantic layer that sits on top of raw data stores and maps
digital assets to their real-world counterparts. It consists of two complementary layers
[PALANTIR-ONTOLOGY]:

**Semantic layer** (data model):

| Element | Purpose | Tsingou Analog |
|---------|---------|---------------|
| Object Types | Entity schema definitions | STIX SDO types |
| Properties | Typed entity attributes | STIX SDO properties |
| Link Types | Relationship schema definitions | STIX SRO types |
| Interfaces | Polymorphic type abstractions | STIX SCO categories |
| Shared Properties | Cross-type consistent attributes | STIX common properties |

**Kinetic layer** (operational):

| Element | Purpose | Tsingou Analog |
|---------|---------|---------------|
| Action Types | Validated write operations | d2ts mutation operators |
| Functions | Executable business logic | d2ts computation operators |
| Rules | Pre-action validation | Effect Schema validation |
| Dynamic Security | Object-level access control | NATS account isolation |

### TSG.33.2.2 Object Types in Detail

An object type in the Palantir Ontology is defined by [PALANTIR-OBJECT-TYPES]:

```
ObjectType {
  apiName:        string            // Machine-readable identifier
  displayName:    string            // Human-readable label
  description:    string            // Documentation
  primaryKey:     PropertyApiName   // Unique identifier property
  properties:     Property[]        // Typed attributes
  interfaces:     InterfaceApiName[] // Implemented interfaces
  backingDataset: DatasetRid        // Storage location
  actions:        ActionTypeApiName[] // Permitted mutations
}
```

**Property base types** supported by the Ontology [PALANTIR-PROPERTIES]:

| Palantir Type | JSON Type | Range/Precision | STIX Equivalent |
|--------------|-----------|-----------------|----------------|
| Boolean | boolean | true/false | boolean |
| Byte | integer | -128 to 127 | — |
| Short | integer | -32,768 to 32,767 | — |
| Integer | integer | -2^31 to 2^31-1 | integer |
| Long | integer | -2^63 to 2^63-1 | — |
| Float | number | IEEE 754 single | — |
| Double | number | IEEE 754 double | number |
| Decimal | string | Arbitrary precision | — |
| String | string | UTF-8, unbounded | string |
| Date | string | ISO 8601 date | — |
| Timestamp | string | ISO 8601 datetime | timestamp |
| GeoPoint | object | {lat, lng} | — |
| GeoShape | object | GeoJSON | — |
| Marking | string | Security label | — |

### TSG.33.2.3 Link Types in Detail

Link types define typed, directed relationships between object types
[PALANTIR-LINK-TYPES]:

```
LinkType {
  apiName:        string            // Machine-readable identifier
  displayName:    string            // Human-readable label
  sourceObjectType: ObjectTypeApiName // Source ("from") object type
  targetObjectType: ObjectTypeApiName // Target ("to") object type
  cardinality:    Cardinality       // ONE_ONE | ONE_MANY | MANY_MANY
  backingDataset: DatasetRid?       // Optional: for object-backed links
  properties:     Property[]?       // Optional: link-level properties
}
```

**Cardinality modes**:

| Cardinality | Semantics | STIX Equivalent |
|------------|-----------|----------------|
| ONE_ONE | Exactly one source, one target | Rare in STIX (most are many-to-many) |
| ONE_MANY | One source, many targets | located-at (many entities at one location) |
| MANY_MANY | Many sources, many targets | Most STIX SRO types (uses, targets, etc.) |

**Object-backed links**: When a link type has its own backing dataset, links carry
properties beyond source/target identity. This is essential for intelligence relationships
where metadata matters: a "communicated-with" link needs timestamp, duration, channel,
and confidence properties.

STIX Sighting SROs, which carry `first_seen`, `last_seen`, `count`, and `description`,
MUST be mapped to object-backed link types in Palantir to preserve this metadata.

### TSG.33.2.4 Interfaces and Polymorphism

Interfaces enable querying across heterogeneous object types [PALANTIR-ONTOLOGY]:

```
Interface {
  apiName:    string            // e.g., "StixEntity"
  properties: Property[]        // Shared property schema
  // Object types implementing this interface guarantee these properties
}
```

**Tsingou-defined interfaces for STIX integration**:

| Interface | Required Properties | Implementing Object Types |
|-----------|-------------------|--------------------------|
| StixEntity | stixId, stixType, created, modified, confidence | All SDO object types |
| Locatable | latitude, longitude, country | Location, Identity, Infrastructure |
| TemporalEntity | firstSeen, lastSeen | Campaign, IntrusionSet, ObservedData |
| TTPEntity | killChainPhases, externalReferences | AttackPattern, Malware |
| AnalyzedEntity | centralityScore, communityId, coreNumber | All SDO object types |

The `AnalyzedEntity` interface is Tsingou-specific: it carries computed graph analytics
produced by the d2ts pipeline (TSG.28) and exported to Palantir. This allows Palantir
users to filter and query by Tsingou-computed metrics without running Tsingou themselves.

### TSG.33.2.5 Action Types and Mutation Control

All writes to the Palantir Ontology flow through Action Types [PALANTIR-ACTIONS].
This is a fundamental architectural constraint with important implications for the
Tsingou bridge:

```
ActionType {
  apiName:     string
  parameters:  Parameter[]      // Typed input parameters
  rules:       Rule[]           // Pre-execution validation
  logic:       ActionLogic      // Object/link mutations
  sideEffects: SideEffect[]     // Post-execution triggers
}
```

**Action type categories for Tsingou bridge**:

| Action Type | Purpose | Trigger |
|------------|---------|---------|
| CreateStixEntity | Import new SDO from Tsingou | New STIX object arrives via NATS |
| UpdateStixEntity | Update properties of existing entity | STIX object modified/enriched |
| CreateStixRelationship | Import new SRO from Tsingou | New STIX relationship detected |
| RecordSighting | Log observation of indicator | STIX Sighting SRO received |
| UpdateAnalytics | Write computed centrality/community scores | d2ts analytics pipeline output |
| AnnotateEntity | Analyst adds notes/tags in Palantir | Manual analyst action (inbound to Tsingou) |
| ResolveEntities | Merge duplicate entities | Entity resolution triggered |
| RevokeEntity | Mark entity as invalid | STIX revocation received |

Implementations MUST define Action Types for all Tsingou -> Palantir writes. Direct
dataset manipulation (bypassing actions) MUST NOT be used, as it circumvents audit
trails and validation rules.

---

## TSG.33.3 STIX-to-Ontology Mapping

### TSG.33.3.1 SDO to Object Type Mapping (Table 33-1)

The following table defines the canonical mapping from STIX 2.1 SDO types to
Palantir Object Types. Implementations MUST support all mappings marked REQUIRED.
Implementations SHOULD support all mappings marked RECOMMENDED.

| STIX SDO Type | Palantir Object Type | Status | Primary Key | Key Properties |
|---------------|---------------------|--------|-------------|----------------|
| `threat-actor` | ThreatActor | REQUIRED | stixId | name, threatActorTypes, aliases, sophistication, resourceLevel, primaryMotivation |
| `identity` | Identity | REQUIRED | stixId | name, identityClass, sectors, contactInformation, description |
| `indicator` | Indicator | REQUIRED | stixId | pattern, patternType, patternVersion, validFrom, validUntil, killChainPhases |
| `malware` | Malware | REQUIRED | stixId | name, malwareTypes, isFamily, aliases, capabilities, firstSeen, lastSeen |
| `attack-pattern` | AttackPattern | REQUIRED | stixId | name, description, killChainPhases, externalReferences |
| `infrastructure` | Infrastructure | REQUIRED | stixId | name, infrastructureTypes, aliases, description, firstSeen, lastSeen |
| `location` | Location | REQUIRED | stixId | latitude, longitude, precision, country, region, city, streetAddress |
| `campaign` | Campaign | REQUIRED | stixId | name, description, firstSeen, lastSeen, objective, aliases |
| `intrusion-set` | IntrusionSet | REQUIRED | stixId | name, description, aliases, goals, resourceLevel, primaryMotivation |
| `observed-data` | ObservedData | RECOMMENDED | stixId | firstObserved, lastObserved, numberObserved, objectRefs |
| `tool` | Tool | RECOMMENDED | stixId | name, toolTypes, aliases, toolVersion, killChainPhases |
| `vulnerability` | Vulnerability | RECOMMENDED | stixId | name, description, externalReferences |
| `course-of-action` | CourseOfAction | RECOMMENDED | stixId | name, description, actionType |
| `grouping` | Grouping | RECOMMENDED | stixId | name, description, context, objectRefs |
| `report` | Report | RECOMMENDED | stixId | name, description, published, reportTypes, objectRefs |
| `note` | Note | RECOMMENDED | stixId | abstract, content, authors, objectRefs |
| `opinion` | Opinion | RECOMMENDED | stixId | opinion, explanation, authors, objectRefs |
| `malware-analysis` | MalwareAnalysis | RECOMMENDED | stixId | product, analysisStarted, analysisEnded, result, analysisScoRefs |

### TSG.33.3.2 Common Properties (Table 33-2)

All STIX-derived object types MUST include these common properties, mapped from
STIX common properties [STIX-2.1]:

| STIX Property | Palantir Property | Type | Required |
|---------------|------------------|------|----------|
| `id` | stixId | String | REQUIRED |
| `type` | stixType | String | REQUIRED |
| `spec_version` | specVersion | String | REQUIRED |
| `created` | created | Timestamp | REQUIRED |
| `modified` | modified | Timestamp | REQUIRED |
| `created_by_ref` | createdByRef | String | RECOMMENDED |
| `revoked` | revoked | Boolean | REQUIRED |
| `confidence` | confidence | Integer | RECOMMENDED |
| `lang` | lang | String | RECOMMENDED |
| `labels` | labels | String (JSON array) | RECOMMENDED |
| `external_references` | externalReferences | String (JSON array) | RECOMMENDED |
| `object_marking_refs` | objectMarkingRefs | String (JSON array) | RECOMMENDED |
| `granular_markings` | granularMarkings | String (JSON array) | RECOMMENDED |

### TSG.33.3.3 Tsingou-Computed Properties (Table 33-3)

The d2ts pipeline computes graph analytics (TSG.28) that are exported to Palantir as
additional properties on all STIX-derived object types:

| Tsingou Property | Palantir Property | Type | Computation Source |
|-----------------|------------------|------|-------------------|
| PageRank score | tsgPageRank | Double | TSG.28.3.5 |
| Betweenness centrality | tsgBetweenness | Double | TSG.28.3.2 |
| Harmonic closeness | tsgCloseness | Double | TSG.28.3.3 |
| Eigenvector centrality | tsgEigenvector | Double | TSG.28.3.4 |
| HITS authority | tsgHitsAuthority | Double | TSG.28.3.6 |
| HITS hub | tsgHitsHub | Double | TSG.28.3.6 |
| Community ID | tsgCommunityId | String | TSG.28.4.3 (Leiden) |
| Community label | tsgCommunityLabel | String | Analyst-assigned |
| Core number | tsgCoreNumber | Integer | TSG.28.5.1 |
| Anomaly score | tsgAnomalyScore | Double | TSG.27 |
| Last analysis timestamp | tsgLastAnalyzed | Timestamp | Pipeline metadata |

These properties are prefixed with `tsg` to distinguish Tsingou-computed values from
Palantir-native properties. Implementations MUST use this prefix convention to prevent
naming collisions with existing Ontology properties.

### TSG.33.3.4 SRO to Link Type Mapping (Table 33-4)

STIX Relationship Objects (SROs) map to Palantir Link Types:

| STIX Relationship | Palantir Link Type | Cardinality | Object-Backed | Link Properties |
|-------------------|-------------------|-------------|---------------|----------------|
| `uses` | StixUses | MANY_MANY | No | — |
| `targets` | StixTargets | MANY_MANY | No | — |
| `attributed-to` | StixAttributedTo | MANY_MANY | No | — |
| `indicates` | StixIndicates | MANY_MANY | No | — |
| `mitigates` | StixMitigates | MANY_MANY | No | — |
| `located-at` | StixLocatedAt | MANY_ONE | No | — |
| `communicates-with` | StixCommunicatesWith | MANY_MANY | Yes | timestamp, protocol, confidence |
| `controls` | StixControls | MANY_MANY | No | — |
| `delivers` | StixDelivers | MANY_MANY | No | — |
| `based-on` | StixBasedOn | MANY_MANY | No | — |
| `derived-from` | StixDerivedFrom | MANY_MANY | No | — |
| `consists-of` | StixConsistsOf | MANY_MANY | No | — |
| `hosts` | StixHosts | MANY_MANY | No | — |
| `has` | StixHas | MANY_MANY | No | — |
| `authored-by` | StixAuthoredBy | MANY_MANY | No | — |

Link types are prefixed with `Stix` to distinguish from native Palantir link types.

### TSG.33.3.5 Sighting Mapping

STIX Sighting SROs carry metadata beyond source/target identity:

```json
{
  "type": "sighting",
  "sighting_of_ref": "indicator--...",
  "where_sighted_refs": ["identity--..."],
  "first_seen": "2025-06-15T08:30:00Z",
  "last_seen": "2025-06-15T08:45:00Z",
  "count": 3,
  "description": "Observed C2 beacon pattern",
  "confidence": 85
}
```

Sightings MUST be mapped to an object-backed link type `StixSighting` with properties:

| Link Property | Type | Source |
|--------------|------|--------|
| firstSeen | Timestamp | `first_seen` |
| lastSeen | Timestamp | `last_seen` |
| count | Integer | `count` |
| description | String | `description` |
| confidence | Integer | `confidence` |
| observedDataRefs | String (JSON array) | `observed_data_refs` |

This preserves the full sighting metadata that would be lost with a simple link type.

### TSG.33.3.6 Mapping Validation

The STIX-to-Ontology mapping MUST be validated at multiple levels:

**Schema validation**: Every STIX property mapped to a Palantir property MUST have
compatible types. Type mismatches MUST be caught at mapping time, not at write time.

**Completeness validation**: Unmapped STIX properties MUST be serialized to a catch-all
`stixRawJson` String property on the object type. No STIX data SHALL be silently dropped
during mapping.

**Roundtrip fidelity**: Converting STIX -> Palantir -> STIX MUST produce an object
semantically equivalent to the original. Properties may be reordered, but values MUST
NOT change. Implementations SHOULD include roundtrip tests for all mapped SDO types.

**Version tracking**: Each mapped object MUST carry `specVersion` indicating the STIX
version it was translated from. The bridge MUST handle STIX 2.0 and 2.1 objects
(the primary versions in active use).

---

## TSG.33.4 API Integration Architecture

### TSG.33.4.1 API Selection Matrix

Palantir exposes multiple API surfaces. The Tsingou bridge selects the appropriate
API based on the operation:

| Operation | API | Endpoint Pattern | Auth |
|-----------|-----|-----------------|------|
| Object CRUD | Foundry REST v2 | `/api/v2/ontologies/{rid}/objectTypes/{type}/objects` | OAuth 2.0 |
| Object search | Foundry REST v2 | `POST .../search` | OAuth 2.0 |
| Action execution | Foundry REST v2 | `POST .../actions/{action}/apply` | OAuth 2.0 |
| Aggregations | Foundry REST v2 | `POST .../aggregate` | OAuth 2.0 |
| Type-safe queries | OSDK TypeScript | `client(ObjectType).where(filter)` | OAuth 2.0 |
| Real-time subscriptions | OSDK v2.1+ | `client(ObjectType).subscribe()` | OAuth 2.0 |
| Query functions | Functions API | `POST .../queries/{name}/execute` | OAuth 2.0 |
| Graph traversal | Gotham Graph API | Gotham-specific endpoints | Gotham auth |

### TSG.33.4.2 OSDK TypeScript Client Architecture

The Tsingou bridge SHOULD use the Palantir OSDK TypeScript client (`@osdk/foundry.*`,
`@osdk/gotham.*`) for type-safe API access [PALANTIR-OSDK-TS].

**Client initialization**:

```typescript
import { createClient } from "@osdk/client";
import { createPlatformClient } from "@osdk/foundry";

const client = createClient(
  "https://foundry.palantir.example.com",
  "tsingou-bridge",
  async () => getOAuthToken()
);
```

**Object queries with filtering**:

```typescript
// Query threat actors with high Tsingou-computed centrality
const highCentrality = await client(ThreatActor)
  .where({ tsgPageRank: { $gt: 0.5 } })
  .fetchPage({ $pageSize: 100 });

// Aggregation: count entities by community
const communityCounts = await client(ThreatActor)
  .aggregate({
    $select: { $count: "unordered" },
    $groupBy: { tsgCommunityId: "exact" }
  });
```

**Action execution**:

```typescript
// Write computed analytics back to Palantir
await client.applyAction(UpdateAnalytics, {
  stixId: "threat-actor--abc123",
  tsgPageRank: 0.73,
  tsgBetweenness: 0.41,
  tsgCommunityId: "cluster-7",
  tsgCoreNumber: 4,
  tsgLastAnalyzed: new Date().toISOString()
});
```

**Subscriptions (OSDK v2.1+)**:

```typescript
// Subscribe to analyst annotations flowing from Palantir to Tsingou
const subscription = client(ThreatActor).subscribe({
  onChange: (event) => {
    // Publish change to NATS for d2ts ingestion
    natsPublish("palantir.changes.threat-actor", event);
  },
  onError: (error) => {
    // Handle subscription errors
    logger.error("Palantir subscription error", error);
  }
});
```

Requirements: Node.js 18+, OSDK v2.1.x, OAuth 2.0 client credentials.

### TSG.33.4.3 REST API Fallback

When the OSDK is unavailable or insufficient, the bridge SHOULD fall back to direct
REST API calls:

```typescript
// Direct REST call for operations not covered by OSDK
const response = await fetch(
  `${FOUNDRY_URL}/api/v2/ontologies/${ONTOLOGY_RID}/objectTypes/ThreatActor/objects`,
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      where: {
        type: "gt",
        field: "tsgPageRank",
        value: 0.5
      },
      pageSize: 100
    })
  }
);
```

Implementations MUST handle:
- **Rate limiting**: Palantir APIs enforce rate limits. The bridge MUST implement
  exponential backoff with jitter.
- **Pagination**: Result sets are paginated (default page size varies). The bridge
  MUST handle cursor-based pagination for complete result retrieval.
- **Error handling**: HTTP 429 (rate limit), 401 (auth expired), 403 (permission denied),
  404 (object not found), 409 (conflict). Each error type requires specific handling.

### TSG.33.4.4 Authentication and Token Management

The Tsingou bridge authenticates to Palantir via OAuth 2.0 client credentials flow:

```
Bridge -> Palantir Auth: POST /oauth2/token
  grant_type=client_credentials
  client_id=tsingou-bridge
  client_secret=<secret>
  scope=api:ontology-read api:ontology-write

Palantir Auth -> Bridge: 200 OK
  access_token=<token>
  expires_in=3600
  token_type=bearer
```

**Token lifecycle management**:
- Tokens MUST be refreshed before expiry (RECOMMENDED: refresh at 80% of lifetime)
- Token refresh failures MUST trigger circuit breaker (Section TSG.33.4.5)
- Client secrets MUST be stored in a secure credential store (not in source code or
  environment variables on disk)
- Token caching MUST be process-local (not shared across bridge instances)

### TSG.33.4.5 Circuit Breaker Pattern

The bridge MUST implement a circuit breaker to prevent cascade failures when
Palantir is unavailable:

```
States:
  CLOSED:   Normal operation. Requests pass through to Palantir.
  OPEN:     Palantir unreachable. Requests fail fast without calling Palantir.
  HALF_OPEN: Probe mode. Single request sent to test recovery.

Transitions:
  CLOSED -> OPEN:     After N consecutive failures (RECOMMENDED: N = 5)
  OPEN -> HALF_OPEN:  After timeout period (RECOMMENDED: 30 seconds)
  HALF_OPEN -> CLOSED: Probe succeeds
  HALF_OPEN -> OPEN:   Probe fails

During OPEN state:
  - Outbound writes are queued in NATS JetStream for later replay
  - Inbound reads return stale cached data with freshness indicator
  - Metrics track time-in-open-state for alerting
```

Implementations MUST implement the circuit breaker pattern. Palantir unavailability
MUST NOT cause Tsingou core functionality to degrade.

---

## TSG.33.5 NATS-Palantir Bridge

### TSG.33.5.1 Bridge Architecture

The NATS-Palantir Bridge is a standalone service that mediates between Tsingou's
NATS messaging fabric and Palantir's REST/OSDK APIs:

```
                    NATS Subjects                    Palantir APIs
                         |                                |
          +--------------+--+-----------+     +-----------+----------+
          |              |  |           |     |           |          |
    tsingou.stix.*  tsingou.analytics.*  palantir.changes.*
          |              |  |           |     |           |          |
          v              v  v           v     v           v          v
    +-----+-----+  +----+----+  +------+-----+   +------+------+
    | Ingest     |  | Analyt. |  | Change     |   | Query       |
    | Forwarder  |  | Writer  |  | Listener   |   | Proxy       |
    +-----+------+  +----+----+  +------+-----+   +------+------+
          |              |              |                  |
          +--------------+--------------+------------------+
                         |
                  +------+------+
                  | Bridge Core |
                  | - Auth mgmt |
                  | - Circuit   |
                  |   breaker   |
                  | - Mapping   |
                  | - Queuing   |
                  +------+------+
                         |
                  +------+------+
                  | OSDK Client |
                  +-------------+
```

**Bridge components**:

| Component | Direction | NATS Subject | Palantir API | Purpose |
|-----------|-----------|-------------|-------------|---------|
| Ingest Forwarder | Tsingou -> Palantir | `tsingou.stix.{type}.*` | CreateStixEntity action | Forward new STIX objects |
| Analytics Writer | Tsingou -> Palantir | `tsingou.analytics.{type}.*` | UpdateAnalytics action | Write computed metrics |
| Change Listener | Palantir -> Tsingou | `palantir.changes.{type}.*` | OSDK subscription | Propagate analyst edits |
| Query Proxy | Palantir -> Tsingou | `palantir.query.{request-id}` | OSDK query | Serve enrichment requests |

### TSG.33.5.2 Outbound Flow: Tsingou to Palantir

When the d2ts pipeline produces new or updated STIX objects:

```
1. STIX object published to NATS subject tsingou.stix.{sdo-type}.{stix-id}
2. Ingest Forwarder subscribes to tsingou.stix.>
3. Forwarder applies STIX-to-Ontology mapping (TSG.33.3)
4. Forwarder calls Palantir Action Type:
   - New object: CreateStixEntity action
   - Updated object: UpdateStixEntity action
   - New relationship: CreateStixRelationship action
5. On success: ACK to NATS JetStream
6. On failure: NACK for redelivery (with backoff)
```

**Batching**: The forwarder SHOULD batch multiple STIX objects into a single
Palantir API call where the API supports it. RECOMMENDED batch size: 50 objects.
RECOMMENDED batch window: 1 second.

**Ordering**: STIX objects MUST be forwarded in causal order within the same entity.
Updates to the same entity MUST NOT be reordered. Cross-entity ordering is not required.

### TSG.33.5.3 Outbound Flow: Analytics to Palantir

When the d2ts pipeline produces graph analytics (TSG.28):

```
1. Centrality/community results published to tsingou.analytics.{type}.{stix-id}
2. Analytics Writer subscribes to tsingou.analytics.>
3. Writer batches updates per entity (coalesce rapid re-computations)
4. Writer calls UpdateAnalytics action with tsg-prefixed properties
5. Debounce: at most one update per entity per 5 seconds
```

**Debouncing**: Analytics recompute frequently during active analysis. The bridge
MUST debounce updates to prevent overwhelming Palantir's write capacity. RECOMMENDED:
coalesce updates to the same entity within a 5-second window, sending only the
latest values.

### TSG.33.5.4 Inbound Flow: Palantir to Tsingou

When analysts make changes in Palantir (annotations, manual links, entity resolution):

```
1. OSDK subscription detects object/link change in Palantir
2. Change Listener translates change to STIX format:
   - Object creation -> STIX SDO
   - Link creation -> STIX SRO
   - Property update -> STIX SDO with modified timestamp
   - Entity merge -> Custom merge event
3. Change published to NATS subject palantir.changes.{sdo-type}.{stix-id}
4. d2ts ingests change as new STIX object (standard pipeline)
```

**Subscription scope**: The Change Listener SHOULD subscribe only to object types
that are part of the STIX-Ontology mapping. Changes to non-STIX object types in
Palantir are ignored.

### TSG.33.5.5 NATS Subject Namespace

| Subject Pattern | Direction | Purpose | Payload |
|----------------|-----------|---------|---------|
| `tsingou.stix.{sdo-type}.{stix-id}` | Outbound | New/updated STIX objects | STIX JSON |
| `tsingou.stix.relationship.{stix-id}` | Outbound | New/updated STIX relationships | STIX JSON |
| `tsingou.stix.sighting.{stix-id}` | Outbound | New sightings | STIX JSON |
| `tsingou.analytics.{sdo-type}.{stix-id}` | Outbound | Computed graph metrics | Analytics JSON |
| `palantir.changes.{sdo-type}.{stix-id}` | Inbound | Analyst edits from Palantir | STIX JSON |
| `palantir.query.{request-id}` | Inbound | Query responses from Palantir | Query result JSON |
| `palantir.bridge.status` | Internal | Bridge health/metrics | Status JSON |

All subjects use the `tsingou.` or `palantir.` prefix to distinguish bridge traffic
from other NATS subjects in the system.

---

## TSG.33.6 Graph Query Patterns

### TSG.33.6.1 Entity Lookup

Simple entity retrieval by STIX identifier:

```typescript
// OSDK: type-safe lookup
const actor = await client(ThreatActor)
  .where({ stixId: "threat-actor--abc123" })
  .fetchPage({ $pageSize: 1 });

// REST: direct API call
const response = await fetch(
  `${BASE}/objectTypes/ThreatActor/objects/${primaryKey}`
);
```

### TSG.33.6.2 Link Traversal (Search Around)

Expand from an entity to its related entities:

```typescript
// Find all malware used by a threat actor
const malwareUsed = await client(ThreatActor)
  .where({ stixId: "threat-actor--abc123" })
  .searchAroundLink(StixUses, Malware)
  .fetchPage({ $pageSize: 100 });

// Find all entities targeted by an intrusion set
const targets = await client(IntrusionSet)
  .where({ stixId: "intrusion-set--xyz789" })
  .searchAroundLink(StixTargets, Identity)
  .fetchPage({ $pageSize: 100 });
```

### TSG.33.6.3 Multi-Hop Traversal

Contact chaining (TSG.28.8.2) through Palantir's graph:

```typescript
// 2-hop expansion: actor -> uses -> malware -> targets -> identity
const hop1 = await expandLinks(seedActor, StixUses, Malware);
const hop2 = await expandLinks(hop1, StixTargets, Identity);

// Combine into expanded network graph
const subgraph = mergeGraphs(seedActor, hop1, hop2);
```

Multi-hop traversal through Palantir's API requires sequential queries (one per hop).
For graphs requiring > 3 hops, implementations SHOULD perform the traversal in
Tsingou's d2ts pipeline (which maintains the full graph in memory) rather than
making N sequential Palantir API calls.

### TSG.33.6.4 Aggregation Queries

Compute statistics across the Ontology:

```typescript
// Count entities by STIX type
const typeCounts = await client(StixEntity) // interface query
  .aggregate({
    $select: { $count: "unordered" },
    $groupBy: { stixType: "exact" }
  });

// Distribution of Tsingou-computed community sizes
const communityDistribution = await client(ThreatActor)
  .aggregate({
    $select: { $count: "unordered" },
    $groupBy: { tsgCommunityId: "exact" }
  });

// Average centrality by entity type
const centralityByType = await client(StixEntity)
  .aggregate({
    $select: {
      avgPageRank: { $avg: "tsgPageRank" },
      maxBetweenness: { $max: "tsgBetweenness" }
    },
    $groupBy: { stixType: "exact" }
  });
```

**Aggregation limit**: Palantir aggregations return a maximum of 10,000 buckets.
For higher cardinality groupings, implementations MUST paginate or pre-filter.

### TSG.33.6.5 Geospatial Queries

Query entities by location:

```typescript
// Find all infrastructure within 50km of a coordinate
const nearbyInfra = await client(Infrastructure)
  .where({
    latitude: { $gte: lat - delta, $lte: lat + delta },
    longitude: { $gte: lng - delta, $lte: lng + delta }
  })
  .fetchPage({ $pageSize: 500 });
```

For precise geospatial queries, implementations SHOULD use Palantir's native GeoPoint
filtering rather than bounding box approximations. The Tsingou R3F layer (TSG.21)
renders geospatial results as 3D markers on the globe visualization.

---

## TSG.33.7 Security Model Alignment

### TSG.33.7.1 Tsingou-Palantir Security Mapping

Tsingou's security model (NATS account isolation) must align with Palantir's
multi-layered security model:

| Security Concern | Tsingou Mechanism | Palantir Mechanism | Bridge Responsibility |
|-----------------|-------------------|-------------------|----------------------|
| Authentication | NATS credentials (NKey/JWT) | OAuth 2.0 | Token exchange |
| Authorization | NATS account permissions | Projects + Roles | Permission mapping |
| Data classification | NATS subject hierarchy | Markings + CBAC | Classification propagation |
| Object-level access | Not native (filter at query) | Object Security Policies | Marking enforcement |
| Audit trail | NATS JetStream persistence | Action audit log | Dual logging |
| Tenant isolation | NATS accounts | Organizations | Account-to-org mapping |

### TSG.33.7.2 Classification Propagation

STIX objects carry `object_marking_refs` pointing to `marking-definition` objects
(e.g., TLP markings). These MUST be propagated to Palantir markings:

| STIX TLP Marking | Palantir Marking | Access Implication |
|-----------------|-----------------|-------------------|
| `TLP:CLEAR` | Unmarked (public) | All authenticated users |
| `TLP:GREEN` | Community marking | Organization members |
| `TLP:AMBER` | Restricted marking | Named group members |
| `TLP:AMBER+STRICT` | Strict restricted | Individual recipients only |
| `TLP:RED` | Top-level restricted | Specific named users |

Implementations MUST map STIX TLP markings to corresponding Palantir markings.
The bridge MUST NOT downgrade classification: a TLP:AMBER object MUST NOT become
unmarked in Palantir.

**CBAC integration**: For government deployments using Classification-Based Access
Controls, the bridge MUST support mapping STIX `object_marking_refs` to CBAC
marking categories. This mapping is deployment-specific and MUST be configurable.

### TSG.33.7.3 Audit Trail Requirements

All bridge operations MUST be logged for audit:

| Event | Audit Record | Storage |
|-------|-------------|---------|
| STIX object forwarded to Palantir | stixId, timestamp, action, result | NATS JetStream + Palantir action log |
| Analytics written to Palantir | stixId, properties, timestamp | NATS JetStream + Palantir action log |
| Palantir change ingested by Tsingou | stixId, changeType, timestamp | NATS JetStream |
| Authentication event | clientId, timestamp, success/fail | Bridge service log |
| Circuit breaker state change | oldState, newState, reason, timestamp | Bridge service log + alert |

Audit records MUST be retained for a minimum of 1 year. For government deployments,
retention requirements may be longer (7 years per NARA guidelines).

### TSG.33.7.4 Principle of Least Privilege

The Tsingou bridge service account in Palantir MUST be granted only the minimum
permissions required:

| Permission | Scope | Purpose |
|-----------|-------|---------|
| Read objects | STIX-mapped object types only | Query and search |
| Execute actions | Bridge-specific action types only | Create/update/revoke |
| Read links | STIX-mapped link types only | Graph traversal |
| Subscribe to changes | STIX-mapped object types only | Inbound change detection |

The bridge account MUST NOT have:
- Ontology management permissions (create/modify object types)
- User management permissions
- Marking management permissions
- Delete permissions (revocation uses soft-delete via `revoked` property)

---

## TSG.33.8 AIP Agent Integration

### TSG.33.8.1 Overview

Palantir AIP (Artificial Intelligence Platform) enables building AI agents that
reason over the Ontology [PALANTIR-AIP]. Tsingou's graph analytics, exported as
object properties (Section TSG.33.3.3), provide rich context for AIP agents.

### TSG.33.8.2 Tsingou Analytics as Agent Context

AIP agents can be configured to use Tsingou-computed properties:

| Agent Use Case | Tsingou Property Used | Agent Behavior |
|---------------|----------------------|---------------|
| Threat prioritization | tsgPageRank, tsgBetweenness | Rank threats by graph centrality |
| Group analysis | tsgCommunityId, tsgCommunityLabel | Reason about threat actor clusters |
| Network resilience | tsgCoreNumber | Identify hardened network cores |
| Anomaly investigation | tsgAnomalyScore | Prioritize unusual entities |
| Key player identification | tsgBetweenness, tsgCloseness | Identify disruption targets |

### TSG.33.8.3 Agent-to-Tsingou Feedback Loop

AIP agents generate insights that flow back to Tsingou:

```
1. AIP agent analyzes Tsingou-computed properties in Palantir
2. Agent generates hypothesis (e.g., "Entity X is likely a coordinator")
3. Agent executes AnnotateEntity action in Palantir
4. Change Listener detects annotation
5. Annotation published to NATS palantir.changes.{type}.{id}
6. d2ts ingests annotation as enrichment metadata
7. R3F layer displays agent-generated insights as entity overlays
```

This creates a human-AI-computation loop:
- **Tsingou**: Computational analysis (graph algorithms, differential dataflow)
- **AIP Agent**: AI reasoning (LLM-based analysis, pattern recognition)
- **Human Analyst**: Expert judgment (validation, curation, decision-making)

### TSG.33.8.4 Agents as Functions

AIP agents published as Functions can be called from the Tsingou bridge:

```typescript
// Query an AIP agent for entity assessment
const assessment = await client.executeQuery(
  "assessThreatActor",
  { stixId: "threat-actor--abc123" }
);

// Publish agent assessment to NATS
natsPublish(
  "palantir.agent.assessment.threat-actor",
  assessment
);
```

Implementations MAY integrate AIP agent outputs as an enrichment source in the
d2ts pipeline. Agent assessments SHOULD carry confidence scores and MUST be
distinguishable from human analyst annotations and computed analytics.

---

## TSG.33.9 Synchronization Modes

### TSG.33.9.1 Batch Synchronization

Full or incremental sync of STIX data between Tsingou and Palantir:

```
Mode: BATCH
Trigger: Scheduled (e.g., hourly) or manual
Direction: Bidirectional

Outbound (Tsingou -> Palantir):
  1. Query NATS JetStream for all STIX objects since last sync timestamp
  2. Apply STIX-to-Ontology mapping
  3. Batch upsert via Palantir Action Types (50 objects per batch)
  4. Update sync watermark in NATS KV

Inbound (Palantir -> Tsingou):
  1. Query Palantir for all objects modified since last sync timestamp
  2. Apply Ontology-to-STIX reverse mapping
  3. Publish to NATS tsingou.stix.{type}.{id}
  4. Update sync watermark in NATS KV
```

Batch sync is suitable for:
- Initial data load (bootstrapping Palantir with existing STIX data)
- Recovery after bridge outage (replay missed events)
- Periodic full reconciliation (detect drift between systems)

### TSG.33.9.2 Streaming Synchronization

Real-time sync using NATS subscriptions and OSDK subscriptions:

```
Mode: STREAMING
Trigger: Event-driven (continuous)
Direction: Bidirectional
Latency: < 5 seconds end-to-end

Outbound: NATS subscriber -> STIX-to-Ontology mapping -> OSDK action
Inbound: OSDK subscription -> Ontology-to-STIX mapping -> NATS publish
```

Streaming sync is the primary mode during active analysis. It provides near-real-time
synchronization with lower latency than batch.

### TSG.33.9.3 Hybrid Mode (RECOMMENDED)

The RECOMMENDED synchronization mode combines streaming and batch:

1. **Streaming**: Primary mode during operation. Near-real-time bidirectional sync.
2. **Batch reconciliation**: Periodic (RECOMMENDED: hourly) full reconciliation to
   detect and repair any drift caused by lost messages, reordering, or bugs.
3. **Circuit breaker fallback**: During Palantir outage (circuit breaker OPEN),
   outbound events are queued in NATS JetStream. When circuit closes, queued
   events are replayed in order.

Implementations MUST support at least streaming synchronization. Implementations
SHOULD support hybrid mode for production deployments.

---

## TSG.33.10 Conflict Resolution

### TSG.33.10.1 System of Record Policy

When the same entity is modified in both Tsingou and Palantir, a conflict occurs.
The following system-of-record policy resolves conflicts:

| Data Category | System of Record | Rationale |
|--------------|-----------------|-----------|
| STIX object properties | Tsingou | Authoritative STIX source (TAXII feed) |
| Computed analytics (tsg* properties) | Tsingou | Tsingou owns the computation |
| Analyst annotations | Palantir | Analysts work in Palantir |
| Manual links (analyst-created) | Palantir | Analysts curate relationships |
| Entity resolution decisions | Palantir | Analysts validate merges |
| Classification markings | Palantir | Security officers set markings |
| Community labels (human-readable) | Palantir | Analysts name communities |

### TSG.33.10.2 Conflict Detection

The bridge detects conflicts by comparing `modified` timestamps:

```
On receiving update from Palantir for entity X:
  1. Retrieve entity X from Tsingou (NATS KV or d2ts state)
  2. Compare modified timestamps:
     - If Palantir.modified > Tsingou.modified: Palantir wins (analyst edit is newer)
     - If Tsingou.modified > Palantir.modified: Tsingou wins (STIX update is newer)
     - If equal: No conflict
  3. Apply system-of-record policy for property-level conflicts:
     - tsg* properties: always Tsingou
     - Analyst-owned properties: always Palantir
     - STIX properties: last-writer-wins by timestamp
```

### TSG.33.10.3 Conflict Logging

All detected conflicts MUST be logged with sufficient detail for human review:

```json
{
  "type": "conflict",
  "stixId": "threat-actor--abc123",
  "property": "description",
  "tsingouValue": "APT group targeting critical infrastructure",
  "palantirValue": "APT group targeting energy sector (analyst-verified)",
  "tsingouModified": "2025-06-15T08:30:00Z",
  "palantirModified": "2025-06-15T08:45:00Z",
  "resolution": "palantir_wins",
  "reason": "palantir_timestamp_newer"
}
```

Conflict logs MUST be accessible to analysts for review. Implementations SHOULD
surface unresolved conflicts in the Tsingou DOM layer (TSG.24) as alerts.

---

## TSG.33.11 Normative Constraints

### TSG.33.11.1 Integration Constraints

**PC-1: Optional dependency.** The Palantir bridge MUST be an optional module.
Tsingou MUST operate fully without Palantir. No core module SHALL import Palantir
bridge code unconditionally.

**PC-2: Action-only writes.** All Tsingou -> Palantir writes MUST go through
Palantir Action Types. Direct dataset manipulation is forbidden. This ensures
audit trail completeness and validation rule enforcement.

**PC-3: Prefix convention.** All Tsingou-computed properties in Palantir MUST be
prefixed with `tsg` (e.g., `tsgPageRank`, `tsgCommunityId`). All Tsingou-created
link types MUST be prefixed with `Stix` (e.g., `StixUses`, `StixTargets`).

**PC-4: Roundtrip fidelity.** Converting STIX -> Palantir -> STIX MUST produce
semantically equivalent output. Unmapped STIX properties MUST be preserved in
`stixRawJson` catch-all property.

### TSG.33.11.2 Reliability Constraints

**PC-5: Circuit breaker.** The bridge MUST implement circuit breaker pattern.
Palantir unavailability MUST NOT degrade core Tsingou functionality.

**PC-6: Ordered delivery.** STIX updates to the same entity MUST be delivered
to Palantir in causal order. Cross-entity ordering is NOT required.

**PC-7: At-least-once delivery.** The bridge MUST guarantee at-least-once delivery
for outbound writes. NATS JetStream acknowledgment MUST NOT be sent until the
Palantir API confirms the write.

**PC-8: Idempotent writes.** All Palantir Action Types used by the bridge MUST be
idempotent. Replayed messages (after NACK/retry) MUST NOT create duplicate objects.

### TSG.33.11.3 Security Constraints

**PC-9: Classification preservation.** STIX TLP markings MUST be mapped to Palantir
markings. Classification MUST NOT be downgraded during mapping.

**PC-10: Least privilege.** The bridge service account MUST have only the minimum
permissions required (Section TSG.33.7.4).

**PC-11: Audit completeness.** All bridge operations MUST be logged. Audit records
MUST be retained for a minimum of 1 year.

**PC-12: Credential security.** OAuth client secrets MUST be stored in a secure
credential store. Tokens MUST be process-local and refreshed before expiry.

### TSG.33.11.4 Performance Constraints

**PC-13: Analytics debounce.** The bridge MUST debounce analytics writes to the
same entity (RECOMMENDED: 5-second coalesce window).

**PC-14: Batch size.** Outbound batch writes SHOULD use batches of 50 objects.
Batch windows SHOULD NOT exceed 1 second to bound latency.

**PC-15: Aggregation limits.** The bridge MUST handle Palantir's 10,000-bucket
aggregation limit by paginating or pre-filtering high-cardinality groupings.

### TSG.33.11.5 Constraint Summary (Table 33-5)

| ID | Constraint | Level | Section |
|----|-----------|-------|---------|
| PC-1 | Optional dependency | MUST | TSG.33.1.2 |
| PC-2 | Action-only writes | MUST | TSG.33.2.5 |
| PC-3 | Prefix convention (tsg*, Stix*) | MUST | TSG.33.3.3 |
| PC-4 | Roundtrip fidelity | MUST | TSG.33.3.6 |
| PC-5 | Circuit breaker | MUST | TSG.33.4.5 |
| PC-6 | Ordered entity delivery | MUST | TSG.33.5.2 |
| PC-7 | At-least-once delivery | MUST | TSG.33.5.2 |
| PC-8 | Idempotent writes | MUST | TSG.33.5.2 |
| PC-9 | Classification preservation | MUST | TSG.33.7.2 |
| PC-10 | Least privilege | MUST | TSG.33.7.4 |
| PC-11 | Audit completeness (1 year) | MUST | TSG.33.7.3 |
| PC-12 | Credential security | MUST | TSG.33.4.4 |
| PC-13 | Analytics debounce (5s) | MUST | TSG.33.5.3 |
| PC-14 | Batch size (50 objects) | SHOULD | TSG.33.5.2 |
| PC-15 | Aggregation limit handling | MUST | TSG.33.6.4 |

---

## TSG.33.12 Worked Examples

### TSG.33.12.1 Example: Initial STIX Bundle Import

**Scenario**: An analyst receives a TAXII 2.1 collection containing 2,500 STIX objects
(1,800 SDOs + 700 SROs) representing a threat intelligence assessment of a nation-state
cyber campaign.

**Step 1: Ingest to Tsingou**
```
TAXII 2.1 poll -> STIX Bundle -> NATS tsingou.stix.{type}.{id}
1,800 SDOs published across 18 STIX types
700 SROs published as relationships
```

**Step 2: d2ts Analysis**
```
d2ts pipeline computes:
- PageRank for all 1,800 entities
- Leiden community detection: 23 communities identified
- k-core decomposition: maximum coreness = 7
- Betweenness centrality: top-5 entities identified
Total computation: ~3 seconds
```

**Step 3: Palantir Export (Batch Mode)**
```
Bridge Ingest Forwarder:
- Batches 1,800 SDOs into 36 batches of 50
- Each batch triggers CreateStixEntity action
- Total API calls: 36 object batches + 14 relationship batches
- Wall time: ~45 seconds (rate-limited)

Bridge Analytics Writer:
- Writes tsg* properties for all 1,800 entities
- Batches of 50: 36 batches
- Wall time: ~30 seconds (debounced)
```

**Step 4: Palantir Verification**
```
Analyst opens Palantir Object Explorer:
- 1,800 objects visible across 18 STIX-derived object types
- All objects carry tsgPageRank, tsgCommunityId, tsgCoreNumber
- 700 links visible connecting objects
- Filter by tsgPageRank > 0.5: 47 high-centrality entities highlighted
```

### TSG.33.12.2 Example: Analyst Annotation Feedback Loop

**Scenario**: An analyst working in Palantir's Graph application identifies a
previously unknown connection between two threat actors by manual link analysis.

**Step 1: Analyst Action in Palantir**
```
Analyst creates manual link:
  Source: ThreatActor "APT-Phoenix" (threat-actor--aaa111)
  Target: Infrastructure "C2 server" (infrastructure--bbb222)
  Type: StixControls
  Note: "Attribution confirmed by HUMINT source"
```

**Step 2: Change Detection**
```
OSDK subscription detects new link
Change Listener translates to STIX SRO:
{
  "type": "relationship",
  "relationship_type": "controls",
  "source_ref": "threat-actor--aaa111",
  "target_ref": "infrastructure--bbb222",
  "description": "Attribution confirmed by HUMINT source",
  "confidence": 90,
  "created_by_ref": "identity--analyst-palantir"
}
```

**Step 3: Tsingou Ingestion**
```
SRO published to NATS palantir.changes.relationship.{id}
d2ts ingests new edge into graph
Centrality recomputation triggered (warm-start):
  - APT-Phoenix PageRank increases from 0.42 to 0.58
  - Community structure unchanged (same community)
  - New 3-node motif detected (feed-forward loop)
```

**Step 4: Analytics Update to Palantir**
```
Analytics Writer pushes updated tsgPageRank for APT-Phoenix
Palantir now shows updated centrality reflecting analyst's contribution
```

### TSG.33.12.3 Example: Classification Handling

**Scenario**: A STIX bundle contains objects at mixed classification levels:
some TLP:CLEAR, some TLP:AMBER, and some TLP:RED.

**Step 1: Mapping Validation**
```
For each STIX object:
  Extract object_marking_refs
  Map TLP marking to Palantir marking:
    TLP:CLEAR -> no additional marking
    TLP:AMBER -> "RESTRICTED-TSINGOU" Palantir marking
    TLP:RED -> "TOP-RESTRICTED-TSINGOU" Palantir marking
```

**Step 2: Action Execution with Markings**
```
CreateStixEntity action includes marking parameter:
{
  "stixId": "threat-actor--secret123",
  "name": "APT-ShadowBear",
  "marking": "TOP-RESTRICTED-TSINGOU",
  "stixType": "threat-actor",
  ...
}
Palantir enforces: only users with TOP-RESTRICTED-TSINGOU marking can see this object
```

**Step 3: Query Filtering**
```
Analyst without TOP-RESTRICTED-TSINGOU marking:
  Query: client(ThreatActor).fetchPage()
  Result: APT-ShadowBear is NOT in results (filtered by Palantir security)

Analyst with TOP-RESTRICTED-TSINGOU marking:
  Query: client(ThreatActor).fetchPage()
  Result: APT-ShadowBear IS in results (authorized)
```

**Invariant**: The bridge NEVER returns data to users that Palantir's security
model would restrict. Palantir enforces access control; the bridge respects it.

---

## TSG.33.13 Cross-References to Other RFC Sections

| This Section | References | Relationship |
|-------------|-----------|-------------|
| TSG.33.2 (Ontology model) | TSG.12 (STIX Data Model) | STIX SDO/SRO definitions mapped to Ontology |
| TSG.33.3 (STIX mapping) | TSG.13 (BaseSignal-STIX Codec) | Codec produces STIX objects consumed by bridge |
| TSG.33.3.3 (Computed properties) | TSG.28 (Graph Theory) | Centrality/community scores exported to Palantir |
| TSG.33.3.3 (Anomaly score) | TSG.27 (Statistical Analysis) | Anomaly detection scores exported |
| TSG.33.4 (API architecture) | TSG.32 (Effect-TS Architecture) | Bridge service authored in Effect-TS |
| TSG.33.5 (NATS bridge) | TSG.11 (NATS Fabric) | NATS subjects for bridge communication |
| TSG.33.6 (Query patterns) | TSG.28.6 (Path Analysis) | Multi-hop traversal shared concepts |
| TSG.33.7 (Security) | TSG.35 (Error Handling) | Error handling for auth and permission failures |
| TSG.33.8 (AIP agents) | TSG.28.8 (Intelligence Applications) | Agent reasoning over graph analytics |
| TSG.33.9 (Sync modes) | TSG.14 (TAXII Transport) | TAXII provides inbound STIX data |
| TSG.33.10 (Conflict resolution) | TSG.10 (State Management) | Atom state consistency during conflicts |
| TSG.33.12 (Worked examples) | TSG.28.12 (Graph worked examples) | Analytics output from graph theory section |

---

## TSG.33.14 Effect-TS Service Architecture

### TSG.33.14.1 Bridge as Effect Service

The Palantir bridge is implemented as an Effect-TS service following the project's
service authoring patterns (TSG.32). The service exposes the bridge as a Layer that
can be optionally provided to the Tsingou runtime:

```typescript
// Service interface
class PalantirBridge extends Effect.Service<PalantirBridge>()(
  "PalantirBridge",
  {
    effect: Effect.gen(function* () {
      const nats = yield* NatsService;
      const config = yield* PalantirConfig;
      const client = yield* createOsdkClient(config);
      const circuitBreaker = yield* CircuitBreaker.make({
        failureThreshold: 5,
        resetTimeout: Duration.seconds(30)
      });

      return {
        forwardStixObject: (stix: StixObject) =>
          circuitBreaker.execute(
            Effect.tryPromise(() =>
              client.applyAction(CreateStixEntity, mapStixToOntology(stix))
            )
          ),
        writeAnalytics: (entityId: string, analytics: Analytics) =>
          circuitBreaker.execute(
            Effect.tryPromise(() =>
              client.applyAction(UpdateAnalytics, {
                stixId: entityId,
                ...analytics
              })
            )
          ),
        queryEntity: (stixId: string) =>
          circuitBreaker.execute(
            Effect.tryPromise(() =>
              client(ThreatActor)
                .where({ stixId })
                .fetchPage({ $pageSize: 1 })
            )
          ),
        subscribe: () =>
          Stream.asyncScoped((emit) =>
            Effect.gen(function* () {
              const sub = client(ThreatActor).subscribe({
                onChange: (event) => emit.single(event),
                onError: (err) => emit.fail(err)
              });
              yield* Effect.addFinalizer(() =>
                Effect.sync(() => sub.unsubscribe())
              );
            })
          )
      };
    }),
    dependencies: [NatsService.Default, PalantirConfig.Default]
  }
) {}
```

### TSG.33.14.2 Configuration Schema

Bridge configuration is defined using Effect Schema for runtime validation:

```typescript
const PalantirConfig = Schema.TaggedStruct("PalantirConfig", {
  foundryUrl: Schema.NonEmptyString.pipe(
    Schema.pattern(/^https:\/\//)
  ),
  ontologyRid: Schema.NonEmptyString,
  clientId: Schema.NonEmptyString,
  clientSecret: Schema.Redacted(Schema.NonEmptyString),
  batchSize: Schema.Int.pipe(
    Schema.between(1, 200)
  ).pipe(Schema.withDefault(() => 50)),
  debounceMs: Schema.Int.pipe(
    Schema.between(100, 30000)
  ).pipe(Schema.withDefault(() => 5000)),
  circuitBreakerThreshold: Schema.Int.pipe(
    Schema.between(1, 20)
  ).pipe(Schema.withDefault(() => 5)),
  circuitBreakerResetMs: Schema.Int.pipe(
    Schema.between(5000, 120000)
  ).pipe(Schema.withDefault(() => 30000))
});
```

### TSG.33.14.3 Error Types

Bridge errors are modeled as tagged errors following the project's error handling
patterns (TSG.35):

```typescript
class PalantirAuthError extends Data.TaggedError("PalantirAuthError")<{
  readonly message: string;
  readonly statusCode: number;
}> {}

class PalantirRateLimitError extends Data.TaggedError("PalantirRateLimitError")<{
  readonly retryAfterMs: number;
}> {}

class PalantirNotFoundError extends Data.TaggedError("PalantirNotFoundError")<{
  readonly stixId: string;
  readonly objectType: string;
}> {}

class PalantirConflictError extends Data.TaggedError("PalantirConflictError")<{
  readonly stixId: string;
  readonly tsingouModified: Date;
  readonly palantirModified: Date;
}> {}

class PalantirCircuitOpenError extends Data.TaggedError(
  "PalantirCircuitOpenError"
)<{
  readonly openSince: Date;
  readonly failureCount: number;
}> {}

type PalantirError =
  | PalantirAuthError
  | PalantirRateLimitError
  | PalantirNotFoundError
  | PalantirConflictError
  | PalantirCircuitOpenError;
```

### TSG.33.14.4 STIX-to-Ontology Mapping Schema

The mapping between STIX properties and Palantir properties is defined
declaratively using Effect Schema transforms:

```typescript
// STIX ThreatActor -> Palantir ThreatActor mapping
const ThreatActorMapping = Schema.transform(
  StixThreatActor,          // Source: STIX schema
  PalantirThreatActor,      // Target: Palantir schema
  {
    decode: (stix) => ({
      stixId: stix.id,
      stixType: stix.type,
      name: stix.name,
      threatActorTypes: JSON.stringify(stix.threat_actor_types),
      aliases: JSON.stringify(stix.aliases ?? []),
      sophistication: stix.sophistication ?? null,
      resourceLevel: stix.resource_level ?? null,
      primaryMotivation: stix.primary_motivation ?? null,
      created: stix.created,
      modified: stix.modified,
      confidence: stix.confidence ?? null,
      revoked: stix.revoked ?? false,
      stixRawJson: JSON.stringify(stix),
      // Tsingou-computed properties initialized to null
      tsgPageRank: null,
      tsgBetweenness: null,
      tsgCommunityId: null,
      tsgCoreNumber: null,
      tsgLastAnalyzed: null
    }),
    encode: (palantir) => ({
      type: "threat-actor" as const,
      spec_version: "2.1",
      id: palantir.stixId,
      name: palantir.name,
      threat_actor_types: JSON.parse(palantir.threatActorTypes),
      aliases: JSON.parse(palantir.aliases),
      sophistication: palantir.sophistication,
      resource_level: palantir.resourceLevel,
      primary_motivation: palantir.primaryMotivation,
      created: palantir.created,
      modified: palantir.modified,
      confidence: palantir.confidence,
      revoked: palantir.revoked
    })
  }
);
```

This bidirectional mapping enables roundtrip fidelity testing (PC-4): encoding
then decoding a STIX object produces the original object (modulo property ordering).

### TSG.33.14.5 Atom State for Bridge Status

Bridge operational state is exposed via effect-atom for UI consumption:

```typescript
// Bridge health atom — consumed by DOM layer status panels
export const bridgeStatusAtom = Atom.make<BridgeStatus>({
  circuitState: "CLOSED",
  lastSuccessfulSync: null,
  pendingOutbound: 0,
  pendingInbound: 0,
  errorCount: 0,
  palantirReachable: true
});

// Conflict queue atom — consumed by DOM layer alert panels
export const conflictQueueAtom = Atom.make<ConflictRecord[]>([]);

// Sync metrics atom — consumed by visx layer dashboards
export const syncMetricsAtom = Atom.make<SyncMetrics>({
  objectsForwarded: 0,
  analyticsWritten: 0,
  changesIngested: 0,
  conflictsDetected: 0,
  lastBatchReconciliation: null
});
```

React components subscribe to these atoms via `useAtomValue()`:
- **DOM layer**: Bridge status indicator, conflict alert panel
- **visx layer**: Sync throughput charts, latency histograms
- **R3F layer**: Entity highlighting based on sync status (synced vs. pending vs. conflict)

### TSG.33.14.6 Layer Composition

The Palantir bridge is composed as an optional layer in the Tsingou service stack:

```typescript
// Core Tsingou runtime (always present)
const TsingouCoreLive = Layer.mergeAll(
  NatsService.Default,
  D2tsService.Default,
  StixCodecService.Default,
  // ... other core services
);

// Palantir bridge (optional)
const PalantirBridgeLive = PalantirBridge.Default.pipe(
  Layer.provide(TsingouCoreLive)
);

// Full runtime with Palantir
const TsingouWithPalantirLive = Layer.mergeAll(
  TsingouCoreLive,
  PalantirBridgeLive
);

// Full runtime without Palantir (also valid)
const TsingouStandaloneLive = TsingouCoreLive;
```

The optional nature of the Palantir layer (PC-1) is enforced by the Layer
composition model: `TsingouCoreLive` compiles and operates without
`PalantirBridgeLive`. No core service depends on `PalantirBridge`.

---

## TSG.33.15 Open Questions

1. **Gotham vs. Foundry API selection**: Palantir is migrating capabilities from Gotham
   to Foundry. Which API surface should be the primary target? Gotham has richer graph
   exploration but is being deprecated for new features. Foundry has the modern OSDK but
   may lack some graph-specific operations.

2. **OSDK subscription reliability**: OSDK v2.1 subscriptions are relatively new. What
   are the failure modes? How does the subscription behave during Palantir maintenance
   windows? Is there a message buffer, or are changes lost during disconnection?

3. **Ontology management automation**: Should the bridge automatically create/modify
   Palantir object types and link types based on STIX schema changes? Or should Ontology
   management be a manual administrative task? Auto-creation risks Ontology pollution;
   manual management risks schema drift.

4. **Performance at scale**: For large STIX datasets (> 100,000 objects), what is the
   practical throughput of the Palantir Action API? Rate limits are not publicly
   documented. Load testing against a representative Palantir instance is required.

5. **Multi-tenant bridge**: In a multi-organization deployment (manufacturing commons
   analog), should each organization have its own bridge instance, or should a single
   bridge serve multiple organizations with Palantir Organization-based isolation?

6. **Offline operation**: For field deployments (Tauri desktop, disconnected from
   Palantir), how should the bridge handle extended offline periods? NATS JetStream
   can queue messages, but replay after days-long disconnection may overwhelm Palantir.

7. **AIP agent trust**: When AIP agent outputs are ingested by Tsingou, what confidence
   level should be assigned? How should agent-generated intelligence be distinguished
   from human-curated and machine-computed intelligence?

---

## TSG.33.16 References

### Palantir Documentation

- [PALANTIR-ONTOLOGY] Palantir. "Ontology Overview."
  https://www.palantir.com/docs/foundry/ontology/overview

- [PALANTIR-OBJECT-TYPES] Palantir. "Object Types Overview."
  https://www.palantir.com/docs/foundry/object-link-types/object-types-overview

- [PALANTIR-LINK-TYPES] Palantir. "Link Types Overview."
  https://www.palantir.com/docs/foundry/object-link-types/link-types-overview

- [PALANTIR-PROPERTIES] Palantir. "Property Base Types."
  https://www.palantir.com/docs/foundry/object-link-types/base-types

- [PALANTIR-ACTIONS] Palantir. "Action Types Overview."
  https://www.palantir.com/docs/foundry/action-types/overview

- [PALANTIR-OSDK] Palantir. "Ontology SDK Overview."
  https://www.palantir.com/docs/foundry/ontology-sdk/overview

- [PALANTIR-OSDK-TS] Palantir. "Typescript Related OSDK Libraries."
  https://github.com/palantir/osdk-ts

- [PALANTIR-SUBSCRIPTIONS] Palantir. "Subscribe to Ontology Changes with TypeScript OSDK."
  https://www.palantir.com/docs/foundry/ontology-sdk/typescript-subscriptions

- [PALANTIR-GOTHAM] Palantir. "Gotham Platform."
  https://www.palantir.com/platforms/gotham/

- [PALANTIR-AIP] Palantir. "AIP Overview."
  https://www.palantir.com/docs/foundry/aip/overview

- [PALANTIR-MARKINGS] Palantir. "Markings."
  https://www.palantir.com/docs/foundry/security/markings

- [PALANTIR-CBAC] Palantir. "Classification-Based Access Controls."
  https://www.palantir.com/docs/foundry/security/classification-based-access-controls

- [PALANTIR-OBJECT-PERMISSIONING] Palantir. "Object Permissioning Overview."
  https://www.palantir.com/docs/foundry/object-permissioning/overview

- [PALANTIR-AGENT-STUDIO] Palantir. "AIP Agent Studio Overview."
  https://www.palantir.com/docs/foundry/agent-studio/overview

### Standards

- [STIX-2.1] OASIS. "STIX Version 2.1." Committee Specification 01, 2021.
  https://docs.oasis-open.org/cti/stix/v2.1/stix-v2.1.html

- [TAXII-2.1] OASIS. "TAXII Version 2.1." Committee Specification 01, 2021.
  https://docs.oasis-open.org/cti/taxii/v2.1/taxii-v2.1.html

### Normative References

- [RFC2119] Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
  BCP 14, RFC 2119, March 1997.

- [RFC8174] Leiba, B. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words."
  BCP 14, RFC 8174, May 2017.

### Cross-Referenced RFC Sections

- [TSG.11] NATS Messaging Fabric — `rfc-section-nats-fabric.md`
- [TSG.12] STIX 2.1 Data Model — `rfc-section-stix-data-model.md`
- [TSG.13] BaseSignal-STIX Codec — `rfc-section-stix-codec.md`
- [TSG.14] TAXII 2.1 Transport — `rfc-section-taxii-transport.md`
- [TSG.27] Statistical Analysis — `rfc-section-statistical-analysis.md`
- [TSG.28] Graph Theory & Link Analysis — `rfc-section-graph-theory.md`
- [TSG.32] Effect-TS Architecture — `rfc-section-effect-architecture.md`
- [TSG.35] Error Handling — `rfc-section-error-handling.md`
