# Research: Palantir Knowledge Graph Integration for Tsingou

```
Document:     research-palantir-integration.md
Purpose:      Raw research compilation for RFC section TSG.33
Author:       graph-theory-specialist (Val)
Created:      2026-02-18
Target RFC:   TMNL-RFC-002, Section TSG.33
```

---

## 1. Palantir Platform Overview

### 1.1 Gotham vs. Foundry

Palantir operates two primary platforms:

- **Palantir Gotham**: Intelligence and defense-focused platform. Graph-centric analysis,
  link charts, geospatial mapping. Used by government agencies and intelligence analysts.
  Primary use cases: counter-terrorism, law enforcement, military analytics, fraud detection.

- **Palantir Foundry**: Enterprise data integration platform. Ontology-based data model
  with operational workflows. Broader commercial adoption. Supersedes Gotham for many
  use cases while maintaining backward compatibility.

Both platforms share the **Ontology** as their core data model.

### 1.2 The Ontology Model

The Palantir Ontology is an operational layer that sits on top of integrated digital assets
and connects them to their real-world counterparts. It serves as a digital twin of the
organization.

**Semantic elements** (data model):
- Object types: Schema definitions of entities (persons, organizations, assets)
- Properties: Typed attributes of object types
- Link types: Schema definitions of relationships between object types
- Interfaces: Polymorphic type definitions (object type polymorphism)

**Kinetic elements** (operational):
- Action types: Validated write operations (all mutations go through actions)
- Functions: Code-authored business logic executable in operational contexts
- Rules: Validation rules on action types
- Dynamic security: Object-level access control

### 1.3 Object Types

An object type is the schema definition of a real-world entity or event. Objects are
instances of object types. Analogous to: class (type) vs. instance (object).

Each object type has:
- **Primary key**: Unique identifier (auto-generated or user-defined)
- **Properties**: Typed attributes (string, integer, boolean, timestamp, etc.)
- **Backing dataset**: Foundry dataset that stores the object data (columns map to properties)
- **Actions**: Permitted write operations
- **Link types**: Relationships to other object types

**Base property types**:
Boolean, Byte, Date, Decimal, Double, Float, GeoPoint, GeoShape, Integer, Long,
Marking, Short, String, Timestamp

**Shared properties**: Properties that can be reused across multiple object types for
consistent data modeling.

### 1.4 Link Types

A link type defines a relationship between two object types. Links are instances of link types.

Link type characteristics:
- **Cardinality**: One-to-one, one-to-many, many-to-many
- **Directionality**: Links connect a "source" to a "target" object type
- **Object-backed links**: Links backed by their own dataset, allowing link-level properties
  (e.g., a "communication" link with "timestamp" and "duration" properties)
- **Dataset-backed links**: Foreign key relationships between backing datasets

### 1.5 Interfaces

Interfaces provide object type polymorphism. An interface defines a shape (set of properties)
that multiple object types can implement. This enables querying across multiple object types
that share common properties.

Example: A "Locatable" interface with latitude/longitude properties implemented by
PersonObjectType, VehicleObjectType, and FacilityObjectType.

### 1.6 Actions

All write operations in Palantir go through Action Types. An action type defines:
- **Parameters**: Input fields for the action
- **Rules**: Validation logic applied before execution
- **Logic**: The mutation to apply (create/modify/delete objects and links)
- **Side effects**: Webhooks, notifications, downstream triggers

This is a critical architectural constraint: direct object mutation is not permitted.
All changes are audited through the action system.

---

## 2. Palantir APIs

### 2.1 REST API (Foundry)

The Foundry API is a RESTful API using JSON with OAuth 2.0 authentication.

Key endpoints:
- `GET /api/v2/ontologies/{ontologyRid}/objectTypes` — List object types
- `GET /api/v2/ontologies/{ontologyRid}/objectTypes/{objectType}/objects` — List objects
- `POST /api/v2/ontologies/{ontologyRid}/objectTypes/{objectType}/search` — Search objects
- `POST /api/v2/ontologies/{ontologyRid}/actions/{actionType}/apply` — Execute action
- `GET /api/v2/ontologies/{ontologyRid}/objectTypes/{objectType}/objects/{primaryKey}` — Get object
- `POST /api/v2/ontologies/{ontologyRid}/queries/{queryApiName}/execute` — Execute query

### 2.2 REST API (Gotham)

Gotham API endpoints (legacy, still widely used in government):
- Object CRUD operations
- Link management
- Graph exploration
- Geospatial queries
- Search and filtering

### 2.3 TypeScript OSDK (Ontology SDK)

The Ontology Software Development Kit (OSDK) provides type-safe TypeScript bindings.

Package: `@osdk/foundry.*` and `@osdk/gotham.*` on NPM.

Key capabilities:
- Type-safe object queries with filtering
- Aggregation (count, average, max, min, sum) with groupBy
- Object subscriptions for real-time updates (OSDK v2.1+)
- Action execution with parameter validation
- Search arounds (link traversal)

Example query pattern:
```typescript
const aircraft = await client(Aircraft)
  .where({ timeUntilNextFlight: { $gt: 30 } })
  .aggregate({ $select: { $count: "unordered" } });
```

Requirements: Node 18+, OSDK v2.x.

### 2.4 Subscriptions (Real-Time)

OSDK v2.1 introduced Ontology subscriptions:
- Subscribe to changes on specific object types
- Receive real-time notifications when objects are created, modified, or deleted
- Filter subscriptions by property values
- WebSocket-based transport

---

## 3. Security Model

### 3.1 Discretionary Access Control

**Projects and Roles**: Primary access control mechanism.
- Projects organize resources
- Roles within projects define permissions (viewer, editor, owner)
- Users are assigned roles in projects

### 3.2 Mandatory Access Control

**Markings**: Additional layer that restricts access beyond project-level permissions.
- Markings define eligibility criteria
- Resources with markings require users to have matching markings
- Multiple markings on a resource: user must have ALL of them (conjunctive)
- Marking categories: can be conjunctive (AND) or disjunctive (OR)

**Classification-Based Access Controls (CBAC)**:
- Mandatory controls for sensitive government information
- Classification markings organized in categories
- Supports standard government classification schemes (UNCLASSIFIED, CONFIDENTIAL, SECRET, TOP SECRET)

### 3.3 Object-Level Security

**Object Security Policies**: Fine-grained control at the individual object level.
- Mandatory control properties: secure all other properties in the same datasource
- Users see only objects they have access to
- Filtering happens at the query level (users never see unauthorized data)

**Organizations**: Strict silos between user groups.
- Every user belongs to one organization
- Can be guest in other organizations
- Data marked with an organization requires membership

### 3.4 Action Security

All mutations go through Action Types, which enforce:
- Validation rules (parameter constraints)
- Approval workflows (multi-step approval)
- Audit trails (every action is logged)
- Side effects (notifications, webhooks)

---

## 4. STIX-to-Ontology Mapping

### 4.1 SDO to Object Type Mapping

| STIX SDO Type | Palantir Object Type | Properties |
|---------------|---------------------|-----------|
| threat-actor | ThreatActor | name, description, threat_actor_types, aliases, goals, sophistication |
| identity | Identity | name, identity_class, sectors, contact_information |
| indicator | Indicator | pattern, pattern_type, valid_from, valid_until, kill_chain_phases |
| malware | Malware | malware_types, is_family, aliases, capabilities |
| attack-pattern | AttackPattern | name, description, kill_chain_phases, external_references |
| infrastructure | Infrastructure | infrastructure_types, aliases, description |
| location | Location | latitude, longitude, country, region, city |
| campaign | Campaign | name, description, first_seen, last_seen, objective |
| intrusion-set | IntrusionSet | name, description, aliases, goals, resource_level |
| observed-data | ObservedData | first_observed, last_observed, number_observed |

### 4.2 SRO to Link Type Mapping

| STIX SRO Type | Palantir Link Type | Cardinality |
|---------------|-------------------|-------------|
| uses | Uses | many-to-many |
| targets | Targets | many-to-many |
| attributed-to | AttributedTo | many-to-many |
| indicates | Indicates | many-to-many |
| mitigates | Mitigates | many-to-many |
| located-at | LocatedAt | many-to-one |
| communicates-with | CommunicatesWith | many-to-many |
| controls | Controls | many-to-many |
| delivers | Delivers | many-to-many |

### 4.3 Sighting as Object-Backed Link

STIX Sighting SROs carry additional metadata (first_seen, last_seen, count, description).
These map to object-backed link types in Palantir, where the link itself has properties.

### 4.4 STIX Properties to Palantir Property Types

| STIX Type | Palantir Type |
|-----------|--------------|
| string | String |
| integer | Integer |
| boolean | Boolean |
| timestamp | Timestamp |
| number | Double |
| identifier | String (branded) |
| open-vocab | String (enumerated) |
| kill-chain-phase | String (serialized JSON) |
| external-reference | String (serialized JSON) |
| GeoJSON point | GeoPoint |
| GeoJSON shape | GeoShape |
| confidence (0-100) | Integer |

---

## 5. Integration Architecture Patterns

### 5.1 Batch Sync (ETL)

Transform STIX bundles into Palantir-compatible datasets:
1. Receive STIX Bundle via TAXII 2.1 or file upload
2. Parse and validate STIX objects
3. Transform to Palantir object/link format
4. Write to Foundry datasets via API
5. Ontology Manager maps datasets to object/link types

### 5.2 Streaming Sync (Real-Time)

NATS -> Tsingou d2ts -> Palantir via OSDK:
1. STIX objects arrive via NATS subjects
2. d2ts processes and enriches (centrality, community detection)
3. OSDK client pushes to Palantir via Action Types
4. Palantir subscriptions push changes back to Tsingou

### 5.3 Bidirectional Bridge

NATS <-> Palantir:
- Outbound: Tsingou analysis results (centrality scores, community labels) -> Palantir
- Inbound: Palantir analyst annotations, manual link creation -> Tsingou via NATS
- Conflict resolution: Palantir is system of record for analyst-curated data;
  Tsingou is system of record for computed analytics

### 5.4 Query Bridge

Tsingou queries Palantir Ontology for enrichment:
- Entity lookup by identifier
- Link traversal (search arounds)
- Aggregation queries
- Geospatial queries

---

## 6. AIP Integration

### 6.1 AIP Agent Studio

Palantir AIP allows building AI agents that operate on the Ontology:
- Agents use Ontology context (object types, links, actions)
- Agents can be published as Functions
- Agents execute Actions (validated, audited mutations)

### 6.2 Tsingou-AIP Bridge

Tsingou's d2ts-computed analytics (graph centrality, community detection, anomaly scores)
can be exposed to Palantir AIP agents:
1. Analytics results written to Palantir as computed properties on objects
2. AIP agents reason over these computed properties
3. Agent-generated insights flow back to Tsingou via NATS

---

## 7. References

- [PALANTIR-ONTOLOGY] https://www.palantir.com/docs/foundry/ontology/overview
- [PALANTIR-OBJECT-TYPES] https://www.palantir.com/docs/foundry/object-link-types/object-types-overview
- [PALANTIR-LINK-TYPES] https://www.palantir.com/docs/foundry/object-link-types/link-types-overview
- [PALANTIR-ACTIONS] https://www.palantir.com/docs/foundry/action-types/overview
- [PALANTIR-SECURITY] https://www.palantir.com/docs/foundry/security/classification-based-access-controls
- [PALANTIR-OSDK] https://www.palantir.com/docs/foundry/ontology-sdk/overview
- [PALANTIR-OSDK-TS] https://github.com/palantir/osdk-ts
- [PALANTIR-GOTHAM] https://www.palantir.com/platforms/gotham/
- [PALANTIR-AIP] https://www.palantir.com/docs/foundry/aip/overview
- [PALANTIR-SUBSCRIPTIONS] https://www.palantir.com/docs/foundry/ontology-sdk/typescript-subscriptions
- [PALANTIR-OBJECT-PERMISSIONING] https://www.palantir.com/docs/foundry/object-permissioning/overview
- [PALANTIR-MARKINGS] https://www.palantir.com/docs/foundry/security/markings
- [STIX-2.1] https://docs.oasis-open.org/cti/stix/v2.1/stix-v2.1.html
