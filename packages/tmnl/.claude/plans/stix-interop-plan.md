# Plan: STIX/CTI Interoperability Documentation (ENCYCLOPEDIC SCALE)

## Agent: stix-specialist
## Task: #2 — Create STIX_INTEROP.md and refine ADR-009
## Target: 15,000+ LINES — Technical manual, not summary

---

## Research Completed

### Codebase Read (VERIFIED)
- ADR-009 at `docs/tsingou/adr/ADR-009-stix-interop-layer.md`: Establishes BaseSignal as internal, STIX as interop
- BaseSignal schema at `src/lib/tsingou-flow/schemas/base-signal.ts`: 7 fields (id, sourceId, timestamp, version, kind, payload, metadata)
- 8 signal kinds with typed payloads: midi, osc, nats, http, serial, rss, websocket, file-watch
- Schema registry at `src/lib/tsingou-flow/schemas/registry.ts`: NATS KV-backed dynamic schemas
- Adapter model at `src/lib/tsingou-flow/schemas/adapter.ts`: lifecycle events, health, errors

### STIX 2.1 Research (OASIS spec)
- 18 SDOs, 2 SROs, 18 SCOs, plus meta-objects (bundle, marking-definition, language-content, extension-definition)
- Custom extensions via `x-<source>-<name>` prefix
- observed-data uses `object_refs` to reference SCOs (deprecated `objects` property)
- STIX patterning language for indicators

### TAXII 2.1 Research
- Collections + Channels model; REST API at `{api-root}/collections/{id}/objects/`
- Pagination via `next`; filtering via `added_after`, `match[type]`, `match[id]`
- Content-Type: `application/taxii+json;version=2.1`

### Platform Research
- **MISP**: Events/Attributes/Objects/Galaxies/Tags; misp-stix Python converter; REST API; ZMQ pub/sub
- **OpenCTI**: STIX-native; GraphQL API; RabbitMQ workers; import/export/stream connectors
- **TheHive 5**: Cases/Alerts/Observables/Tasks; REST API v1; TLPv2
- **Cortex**: 300+ Analyzers/Responders; REST API; observable enrichment

---

## SCALE STRATEGY: How to Hit 15k+ Lines

The document achieves 15k+ lines through:

1. **Full STIX 2.1 Reference Catalog** (~4,000 lines)
   - Every SDO (18): full property table, required/optional fields, Tsingou relevance, example JSON
   - Every SRO (2): full property table, relationship types, example JSON
   - Every SCO (18): full property table, extensions, example JSON
   - Meta objects (4): bundle, marking-definition, language-content, extension-definition

2. **Exhaustive Per-Kind Codec Sections** (~4,500 lines, ~500/kind)
   Each of the 9 signal kinds gets:
   - Complete field-by-field mapping table (BaseSignal field → STIX property)
   - Full Effect.Schema codec code example (encode transform)
   - Full Effect.Schema codec code example (decode transform)
   - Example BaseSignal JSON input
   - Example STIX Bundle JSON output
   - Edge cases table (null fields, overflow values, invalid states)
   - Round-trip verification pseudocode
   - ASCII diagram of the data flow

3. **TAXII Transport Deep-Dive** (~1,500 lines)
   - Full endpoint specification tables
   - NATS ↔ TAXII collection mapping with configuration YAML
   - Request/response examples for every TAXII endpoint
   - Authentication flow diagrams
   - Error response catalog

4. **Platform Integration Chapters** (~3,000 lines, ~750/platform)
   Each platform (MISP, OpenCTI, TheHive, Cortex) gets:
   - Architecture overview with ASCII diagram
   - Data model mapping table
   - API endpoint reference (relevant subset)
   - Authentication configuration
   - Full Effect service definition code
   - Ingest pipeline code example
   - Export pipeline code example
   - Error handling strategy
   - Configuration schema

5. **Effect.Schema Architecture** (~1,500 lines)
   - Complete STIX common properties schema
   - Complete StixBundle schema
   - Per-SDO/SRO/SCO Effect.Schema definitions (at least the 10 most Tsingou-relevant)
   - StixCodecService full service definition
   - Layer composition diagram
   - Tagged error hierarchy
   - Per-kind codec registry implementation

6. **Custom Extension Specifications** (~800 lines)
   - 5 custom SCOs: full JSON Schema definition, Effect.Schema, example instances
   - extension-definition registration object
   - Custom property namespace documentation

7. **Appendices** (~700 lines)
   - Complete cross-reference matrix (all signal fields × all STIX properties)
   - STIX vocabulary tables (attack-motivation, indicator-type, etc.)
   - Configuration reference
   - Glossary

**Estimated total: ~16,000 lines**

---

## Deliverable 1: `docs/tsingou/STIX_INTEROP.md` — Full Document Outline

```
# STIX 2.1 Interoperability — Codec Design & Technical Reference

## Table of Contents (auto-generated, ~50 entries)

## 1. Executive Summary (~100 lines)
   ### 1.1 Purpose
   ### 1.2 Scope
   ### 1.3 Non-Goals
   ### 1.4 Architecture Overview (ASCII diagram)
   ### 1.5 Document Conventions
   ### 1.6 Related Documents (cross-references to ADRs, SPEC.md, FLOW_ARCHITECTURE.md)

## 2. STIX 2.1 Complete Reference Model (~4,000 lines)

   ### 2.1 STIX Architecture Overview (~200 lines)
   - Object model hierarchy (ASCII diagram)
   - Bundle structure
   - Object identification (STIX UUIDs, deterministic vs random)
   - Versioning model (created/modified)
   - Confidence levels
   - Data markings (TLP, statement)
   - Granular markings
   - Object relationships graph (ASCII)

   ### 2.2 STIX Domain Objects (SDOs) — Complete Reference (~2,000 lines)
   For EACH of the 18 SDOs, provide:
   - Type identifier and description
   - Complete property table (name, type, required?, description)
   - Tsingou relevance rating (High/Medium/Low/None) with rationale
   - Which signal kinds can generate this SDO
   - Example JSON (complete, valid STIX 2.1)
   - Effect.Schema definition (for codec-relevant SDOs)

   #### 2.2.1 attack-pattern (~110 lines)
   #### 2.2.2 campaign (~110 lines)
   #### 2.2.3 course-of-action (~110 lines)
   #### 2.2.4 grouping (~110 lines)
   #### 2.2.5 identity (~110 lines)
   #### 2.2.6 indicator (~120 lines) — HIGH relevance, includes STIX patterning
   #### 2.2.7 infrastructure (~110 lines)
   #### 2.2.8 intrusion-set (~110 lines)
   #### 2.2.9 location (~110 lines)
   #### 2.2.10 malware (~120 lines)
   #### 2.2.11 malware-analysis (~120 lines)
   #### 2.2.12 note (~100 lines)
   #### 2.2.13 observed-data (~150 lines) — CRITICAL, primary export target
   #### 2.2.14 opinion (~100 lines)
   #### 2.2.15 report (~110 lines)
   #### 2.2.16 threat-actor (~120 lines)
   #### 2.2.17 tool (~110 lines)
   #### 2.2.18 vulnerability (~110 lines)

   ### 2.3 STIX Relationship Objects (SROs) — Complete Reference (~400 lines)
   #### 2.3.1 relationship (~200 lines)
   - Full property table
   - Relationship type vocabulary (complete list)
   - Source/target constraints
   - Example JSON
   - Effect.Schema
   #### 2.3.2 sighting (~200 lines)
   - Full property table
   - observed_data_refs usage
   - where_sighted_refs
   - Example JSON
   - Effect.Schema

   ### 2.4 STIX Cyber-observable Objects (SCOs) — Complete Reference (~1,800 lines)
   For EACH of the 18 SCOs:
   - Type identifier and description
   - Complete property table
   - Extensions (if any)
   - Signal kind affinity (which BaseSignal kinds produce this SCO)
   - Example JSON
   - Effect.Schema definition

   #### 2.4.1 artifact (~100 lines)
   #### 2.4.2 autonomous-system (~80 lines)
   #### 2.4.3 directory (~80 lines)
   #### 2.4.4 domain-name (~80 lines)
   #### 2.4.5 email-addr (~80 lines)
   #### 2.4.6 email-message (~120 lines) — includes headers, body, attachments
   #### 2.4.7 file (~150 lines) — includes hashes, extensions (pdf, pe, archive)
   #### 2.4.8 ipv4-addr (~80 lines)
   #### 2.4.9 ipv6-addr (~80 lines)
   #### 2.4.10 mac-addr (~70 lines)
   #### 2.4.11 mutex (~70 lines)
   #### 2.4.12 network-traffic (~150 lines) — includes socket extensions, HTTP request
   #### 2.4.13 process (~120 lines) — includes extensions (windows service)
   #### 2.4.14 software (~80 lines)
   #### 2.4.15 url (~70 lines)
   #### 2.4.16 user-account (~100 lines) — includes unix extensions
   #### 2.4.17 windows-registry-key (~100 lines)
   #### 2.4.18 x509-certificate (~100 lines)

   ### 2.5 STIX Meta Objects (~300 lines)
   #### 2.5.1 bundle (~80 lines)
   #### 2.5.2 marking-definition (~80 lines) — TLP, statement
   #### 2.5.3 language-content (~70 lines)
   #### 2.5.4 extension-definition (~70 lines) — critical for x-tsingou-*

   ### 2.6 STIX Common Properties Reference (~200 lines)
   - Complete table of properties shared across all STIX objects
   - type, spec_version, id, created_by_ref, created, modified
   - revoked, labels, confidence, lang, external_references
   - object_marking_refs, granular_markings, extensions

   ### 2.7 STIX Patterning Language Reference (~300 lines)
   - Comparison expressions
   - Observation expressions (AND, OR, FOLLOWEDBY)
   - Object path syntax
   - Qualifiers (WITHIN, REPEATS, START/STOP)
   - Examples for each SCO type relevant to Tsingou
   - Pattern generation from d2ts anomaly detection rules

## 3. BaseSignal → STIX Codec: Export Path (~4,500 lines)

   ### 3.1 Common Mapping Rules (~400 lines)
   #### 3.1.1 Identity Mapping
   - BaseSignal.id → deterministic STIX UUID v5 (namespace UUID + signal id)
   - UUID v5 namespace: `6ba7b810-9dad-11d1-80b4-00c04fd430c8` (URL namespace)
   - Algorithm specification with code example
   #### 3.1.2 Source Identity
   - BaseSignal.sourceId → STIX identity SDO
   - Identity cache (avoid duplicate identity objects in bundle)
   - Identity type: "system" for adapters
   #### 3.1.3 Timestamp Mapping
   - BaseSignal.timestamp → observed-data.first_observed AND last_observed
   - Single signal: first_observed === last_observed
   - Aggregated signals: min/max of timestamp range
   - number_observed: count of aggregated signals
   #### 3.1.4 Version Mapping
   - d2ts [tick, source_seq] → x_tsingou_version custom property
   - No direct STIX equivalent for multi-dimensional versioning
   #### 3.1.5 Kind Dispatch
   - SignalKind → codec lookup table
   - Fallback for unknown kinds: generic artifact export
   #### 3.1.6 Metadata Mapping
   - BaseSignal.metadata → STIX custom properties (x_tsingou_meta_*)
   - Recursive flattening for nested metadata
   #### 3.1.7 Bundle Assembly
   - Collect all generated objects (SCOs, SDOs, SROs)
   - Deduplicate by STIX ID
   - Add identity objects
   - Add marking definitions (configurable TLP level)
   - Wrap in bundle

   Effect.Schema code: CommonMappingCodec (~100 lines of code example)

   ### 3.2 HTTP Signal → STIX (~500 lines)
   #### 3.2.1 Mapping Overview (ASCII diagram)
   #### 3.2.2 Field-by-Field Mapping Table
   | BaseSignal Field | STIX Object | STIX Property | Transform | Notes |
   (every field of HttpPayload mapped)
   #### 3.2.3 SCO Generation Rules
   - url SCO from HttpPayload.url
   - network-traffic SCO with http-request-ext
   - domain-name SCO extracted from URL
   - ipv4-addr/ipv6-addr if resolved
   #### 3.2.4 Effect.Schema Encode Transform (~80 lines code)
   #### 3.2.5 Effect.Schema Decode Transform (~80 lines code)
   #### 3.2.6 Example: BaseSignal Input JSON (~30 lines)
   #### 3.2.7 Example: STIX Bundle Output JSON (~60 lines)
   #### 3.2.8 Edge Cases Table
   #### 3.2.9 Round-Trip Verification

   ### 3.3 RSS Signal → STIX (~500 lines)
   (same sub-structure as 3.2)
   - artifact SCO for content (base64-encoded HTML/text)
   - url SCO for link
   - identity SDO for author
   - labels from categories
   - note SDO for title+description when no IOCs
   - indicator SDOs when IOC extraction is enabled

   ### 3.4 NATS Signal → STIX (~500 lines)
   (same sub-structure)
   - x-tsingou-nats-message custom SCO (full spec inline)
   - artifact SCO for serialized data payload
   - JetStream metadata in custom extension properties
   - Subject hierarchy → STIX labels

   ### 3.5 WebSocket Signal → STIX (~500 lines)
   (same sub-structure)
   - network-traffic SCO with websocket protocol
   - url SCO for connection URL
   - artifact SCO for message data
   - Connection sequence tracking

   ### 3.6 File Watch Signal → STIX (~500 lines)
   (same sub-structure)
   - file SCO: name, size, mime_type, hashes
   - artifact SCO for file content (when available)
   - directory SCO for parent directory
   - File event type → x_tsingou_file_event custom property

   ### 3.7 Serial Signal → STIX (~500 lines)
   (same sub-structure)
   - x-tsingou-serial-data custom SCO (full spec inline)
   - artifact SCO for raw binary data
   - USB device metadata in custom properties

   ### 3.8 MIDI Signal → STIX (~500 lines)
   (same sub-structure)
   - x-tsingou-midi-event custom SCO (full spec inline)
   - artifact SCO for sysex data
   - Device identification properties
   - Complete MIDI message type mapping table

   ### 3.9 OSC Signal → STIX (~500 lines)
   (same sub-structure)
   - x-tsingou-osc-message custom SCO (full spec inline)
   - network-traffic SCO (UDP source)
   - OSC argument type serialization rules
   - Bundle vs single message handling

   ### 3.10 SDR Signal → STIX (~500 lines)
   (same sub-structure)
   - artifact SCO with SigMF metadata annotation
   - x-tsingou-sdr-capture custom SCO (full spec inline)
   - IQ sample reference (inline base64 vs external URL threshold)
   - RF metadata property mapping
   - Frequency/bandwidth/modulation properties

   ### 3.11 Higher-Order Exports (~300 lines)
   #### 3.11.1 Anomaly Detection → Indicator SDO
   - d2ts anomaly rules → STIX pattern language translation
   - Pattern examples for each signal kind
   - Validity period from detection window
   - Kill chain phase mapping
   #### 3.11.2 Correlation → Relationship SRO
   - d2ts join results → relationship with relationship_type
   - Temporal correlation → "related-to" with temporal context
   #### 3.11.3 Correlation → Sighting SRO
   - When to use sighting vs relationship
   - observed_data_refs from correlated signals
   #### 3.11.4 Analysis Session → Grouping SDO
   - Session signals → grouping with context: "suspicious-activity"
   #### 3.11.5 Signal Collection → Report SDO
   - Curated exports → report SDO with object_refs

## 4. STIX → BaseSignal Codec: Import Path (~1,500 lines)

   ### 4.1 Bundle Ingestion Pipeline (~300 lines)
   #### 4.1.1 Architecture (ASCII diagram)
   #### 4.1.2 Parse Phase
   - Bundle validation against STIX 2.1 schema
   - Object extraction and classification
   - Reference resolution (object_refs, created_by_ref)
   #### 4.1.3 Transform Phase
   - SDO/SRO/SCO type dispatch
   - Per-type transform rules
   #### 4.1.4 Emit Phase
   - BaseSignal construction
   - Version assignment (import tick counter)
   - Source ID assignment (TAXII server identifier)
   #### 4.1.5 Effect service code: StixIngestService (~100 lines)

   ### 4.2 SCO → Signal Kind Resolution (~400 lines)
   #### 4.2.1 Resolution Algorithm
   - Priority-based type matching
   - Custom extension detection (x-tsingou-* → original kind)
   - Fallback chain for ambiguous types
   #### 4.2.2 Resolution Table
   | STIX SCO Type | Resolved Signal Kind | Conditions | Payload Construction |
   (complete table for all 18 standard SCOs + 5 custom)
   #### 4.2.3 Composite Resolution
   - observed-data with multiple SCOs → multiple BaseSignals or merged signal
   - network-traffic + url → single HTTP signal
   #### 4.2.4 Effect.Schema decode transforms per SCO type

   ### 4.3 SDO Import Rules (~300 lines)
   #### 4.3.1 observed-data → BaseSignal (primary path)
   #### 4.3.2 indicator → BaseSignal (kind: "stix-indicator")
   #### 4.3.3 report → metadata enrichment
   #### 4.3.4 identity → source registry entry
   #### 4.3.5 Other SDOs → metadata context

   ### 4.4 STIX/TAXII Source Adapter (~300 lines)
   #### 4.4.1 StixTaxiiAdapter Service Definition (Effect.Service)
   #### 4.4.2 Configuration Schema (Effect.Schema)
   #### 4.4.3 Polling Loop Implementation
   #### 4.4.4 Authentication Methods
   - API key (header)
   - Bearer token (OAuth2)
   - Client certificate (mTLS)
   - Basic auth
   #### 4.4.5 Incremental Sync (added_after tracking)
   #### 4.4.6 Error Recovery and Retry Strategy

   ### 4.5 Error Handling (~200 lines)
   #### 4.5.1 Error Taxonomy
   | Error Type | Cause | Recovery | Signal Emitted? |
   #### 4.5.2 Unknown SCO Types
   #### 4.5.3 Missing Required Fields
   #### 4.5.4 Schema Validation Failures
   #### 4.5.5 Reference Resolution Failures
   #### 4.5.6 Metrics and Observability

## 5. Custom STIX Extensions: x-tsingou-* Specification (~800 lines)

   ### 5.1 Extension Namespace (~100 lines)
   - Naming convention: `x-tsingou-<domain>` for SCOs
   - Property convention: `x_tsingou_<name>` for custom properties
   - STIX 2.1 compliance requirements
   - extension-definition registration

   ### 5.2 x-tsingou-nats-message Custom SCO (~130 lines)
   #### 5.2.1 Type Definition
   #### 5.2.2 Property Table (complete)
   #### 5.2.3 Required Properties
   #### 5.2.4 JSON Schema Definition
   #### 5.2.5 Effect.Schema Definition
   #### 5.2.6 Example Instance JSON
   #### 5.2.7 Validation Rules

   ### 5.3 x-tsingou-midi-event Custom SCO (~130 lines)
   (same sub-structure)

   ### 5.4 x-tsingou-osc-message Custom SCO (~130 lines)
   (same sub-structure)

   ### 5.5 x-tsingou-serial-data Custom SCO (~130 lines)
   (same sub-structure)

   ### 5.6 x-tsingou-sdr-capture Custom SCO (~130 lines)
   (same sub-structure)

   ### 5.7 Custom Properties on Standard Objects (~100 lines)
   - x_tsingou_signal_id
   - x_tsingou_source_id
   - x_tsingou_version
   - x_tsingou_kind
   - x_tsingou_session_id
   - x_tsingou_adapter_id

   ### 5.8 Extension Definition Object (~50 lines)
   - Complete JSON for the extension-definition SDO
   - Registration with consumer platforms

## 6. TAXII 2.1 Transport Layer (~1,500 lines)

   ### 6.1 TAXII 2.1 Protocol Reference (~400 lines)
   #### 6.1.1 Discovery Endpoint
   - Request/response examples
   - Tsingou server configuration
   #### 6.1.2 API Root
   - Request/response examples
   #### 6.1.3 Collections Endpoint
   - GET collections list
   - GET single collection
   - Request/response examples with all fields
   #### 6.1.4 Objects Endpoint
   - GET objects (with filtering: added_after, match[type], match[id], match[spec_version])
   - POST objects (publish new STIX objects)
   - Request/response examples
   - Pagination handling (next, limit)
   #### 6.1.5 Manifest Endpoint
   - GET manifest (lightweight object list)
   #### 6.1.6 Envelope Format
   - Complete JSON structure
   - more field for pagination
   #### 6.1.7 Status Resource
   - Async processing status
   #### 6.1.8 Error Handling
   - HTTP status codes
   - TAXII error object format

   ### 6.2 NATS ↔ TAXII Collection Mapping (~400 lines)
   #### 6.2.1 Mapping Architecture (ASCII diagram)
   #### 6.2.2 Collection Configuration Table
   | NATS Subject Pattern | TAXII Collection ID | Collection Title | Description | Media Type | Can Read | Can Write |
   (comprehensive table with 10+ collections)
   #### 6.2.3 Subject Hierarchy Design
   #### 6.2.4 NATS JetStream → TAXII Pagination Bridge
   #### 6.2.5 Configuration YAML (~50 lines example)
   #### 6.2.6 Effect.Schema Configuration Definition

   ### 6.3 Tsingou as TAXII Server (~350 lines)
   #### 6.3.1 Server Architecture (ASCII diagram)
   #### 6.3.2 Route Configuration (Effect HttpServer)
   #### 6.3.3 Authentication Middleware
   #### 6.3.4 Rate Limiting
   #### 6.3.5 Content Negotiation
   #### 6.3.6 Complete Endpoint Implementation Reference

   ### 6.4 Tsingou as TAXII Client (~350 lines)
   #### 6.4.1 Client Architecture (ASCII diagram)
   #### 6.4.2 Feed Configuration Schema
   #### 6.4.3 Polling Schedule (cron-based)
   #### 6.4.4 Incremental Sync Algorithm
   #### 6.4.5 Authentication Configuration
   #### 6.4.6 Certificate Pinning
   #### 6.4.7 Retry and Backoff Strategy
   #### 6.4.8 StixTaxiiClientService Effect definition

## 7. Platform Interoperability (~3,000 lines)

   ### 7.1 MISP Integration (~750 lines)
   #### 7.1.1 MISP Architecture Overview (ASCII diagram, ~50 lines)
   #### 7.1.2 MISP Data Model Reference (~150 lines)
   - Events (complete property table)
   - Attributes (complete property table + 60+ attribute types)
   - Objects (template-based, property table)
   - Galaxies (clusters, elements)
   - Tags (local vs global, taxonomy-based)
   #### 7.1.3 MISP ↔ STIX Mapping (~100 lines)
   - MISP Attribute types → STIX SCO types (complete table)
   - MISP Object templates → STIX observed-data + SCOs
   - MISP Galaxy clusters → STIX SDOs (threat-actor, malware, tool, etc.)
   - MISP Tags → STIX labels + marking-definitions
   #### 7.1.4 BaseSignal → MISP Event Pipeline (~100 lines)
   - Export flow: BaseSignal[] → STIX Bundle → misp-stix → MISP Event
   - Direct API push: BaseSignal[] → MISP Attribute creation
   - Effect service definition
   #### 7.1.5 MISP Event → BaseSignal Pipeline (~100 lines)
   - Import flow: MISP Event → misp-stix → STIX Bundle → BaseSignal[]
   - MISP feed polling: ZMQ subscriber → NATS bridge
   - Effect service definition
   #### 7.1.6 MISP REST API Reference (~100 lines)
   - POST /events (create event)
   - POST /attributes (add attribute)
   - POST /events/restSearch (search)
   - GET /events/view/{id} (retrieve)
   - Authentication: Authorization header with MISP API key
   #### 7.1.7 Configuration Schema (~50 lines)
   #### 7.1.8 Error Handling (~50 lines)
   #### 7.1.9 MISP Feed Sync Configuration (~50 lines)

   ### 7.2 OpenCTI Integration (~750 lines)
   #### 7.2.1 OpenCTI Architecture Overview (ASCII diagram, ~50 lines)
   - GraphQL API, Elasticsearch, Redis, RabbitMQ, MinIO
   #### 7.2.2 OpenCTI Data Model (~100 lines)
   - STIX-native internal representation
   - Internal knowledge graph
   - Entity types (complete list)
   #### 7.2.3 Connector Architecture (~150 lines)
   - Import connector (external → OpenCTI)
   - Export connector (OpenCTI → external)
   - Stream connector (real-time bidirectional)
   - Connector registration and lifecycle
   #### 7.2.4 Tsingou → OpenCTI Pipeline (~100 lines)
   - STIX Bundle direct import via GraphQL mutation
   - TAXII feed subscription
   - Stream connector for real-time sync
   - Effect service definition
   #### 7.2.5 OpenCTI → Tsingou Pipeline (~100 lines)
   - GraphQL subscription for new intelligence
   - TAXII collection polling
   - Stream connector events
   #### 7.2.6 GraphQL API Reference (~100 lines)
   - Key mutations: stixCoreObjectImport, stixCyberObservableAdd
   - Key queries: stixCoreObjects, indicators, observedDatas
   - Subscription: stixCoreObjectsListPush
   - Authentication: Bearer token
   #### 7.2.7 Tsingou OpenCTI Connector Specification (~100 lines)
   - Connector config JSON
   - Worker implementation skeleton
   - Effect service definition
   #### 7.2.8 Configuration Schema (~50 lines)

   ### 7.3 TheHive Integration (~750 lines)
   #### 7.3.1 TheHive 5 Architecture Overview (ASCII diagram, ~50 lines)
   #### 7.3.2 TheHive Data Model (~100 lines)
   - Cases (property table)
   - Alerts (property table)
   - Observables (property table + type taxonomy)
   - Tasks (property table)
   - Task Logs (property table)
   #### 7.3.3 Observable Type Mapping (~100 lines)
   | TheHive Observable Type | STIX SCO Type | BaseSignal Kind | Transform |
   (complete table)
   #### 7.3.4 Tsingou → TheHive Pipeline (~100 lines)
   - Alert creation from anomaly detection
   - Observable push from STIX SCOs
   - Case creation from analysis sessions
   - Effect service definition
   #### 7.3.5 TheHive → Tsingou Pipeline (~100 lines)
   - Webhook subscription for case updates
   - Observable export → BaseSignal
   - Alert → BaseSignal enrichment
   #### 7.3.6 REST API v1 Reference (~100 lines)
   - POST /api/v1/alert (create alert)
   - POST /api/v1/case (create case)
   - POST /api/v1/case/{id}/observable (add observable)
   - GET /api/v1/query (search)
   - Authentication: Bearer token or API key
   #### 7.3.7 TLP Mapping (~50 lines)
   - TLPv2 (TheHive 5) ↔ STIX marking-definition
   #### 7.3.8 Configuration Schema (~50 lines)
   #### 7.3.9 Error Handling (~50 lines)

   ### 7.4 Cortex Integration (~750 lines)
   #### 7.4.1 Cortex Architecture Overview (ASCII diagram, ~50 lines)
   #### 7.4.2 Cortex Data Model (~100 lines)
   - Analyzers (property table, 300+ types catalog)
   - Responders (property table)
   - Jobs (lifecycle, states)
   - Reports (structure, taxonomies)
   #### 7.4.3 Observable Enrichment Pipeline (~150 lines)
   - BaseSignal → STIX SCO → Cortex Analyzer → enriched data → BaseSignal metadata
   - Analyzer selection rules (dataType → analyzer mapping)
   - Batch analysis for multiple observables
   - Effect service definition
   #### 7.4.4 Automated Response Pipeline (~100 lines)
   - Anomaly detection → Cortex Responder trigger
   - Responder action types
   - Effect service definition
   #### 7.4.5 Cortex REST API Reference (~100 lines)
   - POST /api/analyzer/{id}/run (run analyzer)
   - GET /api/job/{id} (get job status)
   - GET /api/job/{id}/report (get report)
   - POST /api/responder/{id}/run (run responder)
   - Authentication: Bearer token or API key
   #### 7.4.6 Analyzer Report → BaseSignal Mapping (~100 lines)
   - Report taxonomy → signal metadata
   - Artifact extraction → new signals
   #### 7.4.7 Configuration Schema (~50 lines)
   #### 7.4.8 Error Handling (~50 lines)

   ### 7.5 Platform Compatibility Matrix (~200 lines)
   - Feature support matrix across all 4 platforms
   - STIX version support
   - Custom extension handling
   - Real-time vs batch sync
   - Authentication methods
   - Data volume limits

## 8. Effect.Schema Codec Architecture (~1,500 lines)

   ### 8.1 Architecture Overview (~200 lines)
   #### 8.1.1 Layer Diagram (ASCII)
   #### 8.1.2 Service Dependency Graph
   #### 8.1.3 Design Principles

   ### 8.2 STIX Schema Definitions in Effect.Schema (~500 lines)
   #### 8.2.1 StixCommonProperties
   #### 8.2.2 StixBundle
   #### 8.2.3 StixIdentity (SDO)
   #### 8.2.4 StixObservedData (SDO)
   #### 8.2.5 StixIndicator (SDO)
   #### 8.2.6 StixRelationship (SRO)
   #### 8.2.7 StixSighting (SRO)
   #### 8.2.8 StixNetworkTraffic (SCO)
   #### 8.2.9 StixUrl (SCO)
   #### 8.2.10 StixFile (SCO)
   #### 8.2.11 StixArtifact (SCO)
   #### 8.2.12 StixDomainName (SCO)
   #### 8.2.13 StixIPv4Addr (SCO)
   #### 8.2.14 StixMarkingDefinition
   (each with full Effect.Schema code, ~30-40 lines each)

   ### 8.3 StixCodecService Definition (~300 lines)
   #### 8.3.1 Service Interface (Effect.Service)
   #### 8.3.2 Encode Operations
   - toStixBundle(signals: BaseSignal[]): Effect<StixBundle, StixEncodeError>
   - toObservedData(signal: BaseSignal): Effect<StixObservedData, StixEncodeError>
   - toIndicator(anomaly: AnomalyAlert): Effect<StixIndicator, StixEncodeError>
   - toSighting(correlation: Correlation): Effect<StixSighting, StixEncodeError>
   - toRelationship(join: JoinResult): Effect<StixRelationship, StixEncodeError>
   #### 8.3.3 Decode Operations
   - fromStixBundle(bundle: StixBundle): Effect<BaseSignal[], StixDecodeError>
   - fromObservedData(od: StixObservedData): Effect<BaseSignal, StixDecodeError>
   #### 8.3.4 Codec Registry
   - Per-kind codec registration
   - Fallback codec for unknown kinds
   #### 8.3.5 Layer Composition
   - StixCodecService.Default
   - StixCodecService.Live (with dependencies)
   - Test layer with mocks

   ### 8.4 Per-Kind Codec Implementation Patterns (~300 lines)
   #### 8.4.1 HttpCodec (complete implementation)
   #### 8.4.2 FileWatchCodec (complete implementation)
   #### 8.4.3 GenericCodec (fallback pattern)
   #### 8.4.4 CustomScoCodec (for x-tsingou-* kinds)

   ### 8.5 Error Hierarchy (~200 lines)
   #### 8.5.1 StixEncodeError (Schema.TaggedStruct)
   #### 8.5.2 StixDecodeError (Schema.TaggedStruct)
   #### 8.5.3 StixValidationError (Schema.TaggedStruct)
   #### 8.5.4 UnmappableSignalError (Schema.TaggedStruct)
   #### 8.5.5 TaxiiTransportError (Schema.TaggedStruct)
   #### 8.5.6 PlatformIntegrationError (Schema.TaggedStruct)
   #### 8.5.7 Error recovery strategies

## 9. Testing Strategy (~500 lines)

   ### 9.1 Round-Trip Tests (~100 lines)
   - BaseSignal → STIX → BaseSignal identity verification
   - Per-kind round-trip test template
   - Property preservation assertions

   ### 9.2 Per-Kind Codec Tests (~150 lines)
   - Test template with @effect/vitest
   - One test suite per signal kind
   - Example test: HttpSignal round-trip

   ### 9.3 STIX Validation Tests (~100 lines)
   - Generated bundles against stix2-validator
   - Required property presence
   - Type constraint validation
   - Reference integrity (object_refs resolve)

   ### 9.4 Platform Interop Tests (~100 lines)
   - Mock MISP endpoint tests
   - Mock OpenCTI GraphQL tests
   - Mock TheHive API tests
   - Mock Cortex analyzer/responder tests

   ### 9.5 Property-Based Tests (~50 lines)
   - Schema.Arbitrary for BaseSignal fuzz testing
   - Invariant: encode(decode(stix)) === stix (modulo normalization)

## 10. Appendices (~700 lines)

   ### Appendix A: Complete Cross-Reference Matrix (~200 lines)
   - All BaseSignal fields × All STIX properties
   - Per-kind breakdown

   ### Appendix B: STIX Vocabulary Tables (~200 lines)
   - attack-motivation-ov
   - indicator-type-ov
   - malware-type-ov
   - relationship-type (complete list)
   - threat-actor-type-ov
   - tool-type-ov

   ### Appendix C: Custom Extension JSON Schema (~150 lines)
   - Complete JSON Schema for each x-tsingou-* SCO

   ### Appendix D: Configuration Reference (~100 lines)
   - TAXII server configuration
   - TAXII client configuration
   - Platform integration configuration

   ### Appendix E: Glossary (~50 lines)
   - CTI, STIX, TAXII, SCO, SDO, SRO, IOC, TLP, etc.
```

---

## Deliverable 2: Refined ADR-009

### Expansions (target: ADR grows from ~116 lines to ~800 lines)

1. **Complete mapping table** — Replace 12-row table with 9 per-kind tables (every payload field → STIX property)
2. **Custom SCO specifications** — 5 custom SCOs with full property tables and JSON examples
3. **TAXII ↔ NATS mapping** — Comprehensive collection configuration with access policies
4. **Error handling** — Codec error taxonomy with recovery strategies
5. **Extension Definition** — Complete extension-definition JSON object
6. **Platform Compatibility Matrix** — STIX feature support across MISP, OpenCTI, TheHive, Cortex
7. **Sequence diagrams** — ASCII diagrams for export, import, and sync flows
8. **Decision rationale expansion** — Deeper analysis of custom-vs-STIX tradeoffs

---

## Execution Order

1. Write STIX_INTEROP.md Section 1 (Executive Summary)
2. Write STIX_INTEROP.md Section 2 (STIX 2.1 Complete Reference — biggest section, ~4k lines)
3. Write STIX_INTEROP.md Section 3 (Export Codec — 9 signal kinds, ~4.5k lines)
4. Write STIX_INTEROP.md Section 4 (Import Codec, ~1.5k lines)
5. Write STIX_INTEROP.md Section 5 (Custom Extensions, ~800 lines)
6. Write STIX_INTEROP.md Section 6 (TAXII Transport, ~1.5k lines)
7. Write STIX_INTEROP.md Section 7 (Platform Interop, ~3k lines)
8. Write STIX_INTEROP.md Sections 8-10 (Effect.Schema + Testing + Appendices, ~2.7k lines)
9. Refine ADR-009 (~800 lines expanded)
10. Final cross-reference verification

**Estimated total STIX_INTEROP.md: ~16,000 lines**
**Estimated total ADR-009 expanded: ~800 lines**
**Combined: ~16,800 lines**
