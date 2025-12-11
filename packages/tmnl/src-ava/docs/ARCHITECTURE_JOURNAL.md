# AVA Architecture Journal

> Tracking architectural decisions, concerns, and evolution over time.

---

## 2025-12-11: Discovery/Validation Architecture Established

### Context

Prime identified a critical gap: **the UI has no way to discover what constitutes a valid `ViewProfileSpec`**. The compiler can translate specs to SQL, and adapters can connect to sources, but there's no layer for discovery or validation.

### Key Decisions

#### 1. Atomic Validate-and-Execute

**Decision**: Merge validation and execution into a single atomic operation.

**Rationale**:
- Eliminates round-trip overhead (no separate `/validate` then `/execute`)
- Prevents "validated but stale" problem (schema changed between validate and execute)
- Simpler client logic: send spec, get results OR errors

**Implementation**:
```protobuf
message ExecuteSpecResponse {
  oneof result {
    ExecutionSuccess success = 1;  // Data if valid
    ExecutionFailure failure = 2;  // ValidationError[] if invalid
  }
}
```

#### 2. Protobuf-First, gRPC-Native Transport

**Decision**: Use Protobuf as the canonical wire format, exposed via Cosmo Connect.

**Rationale**:
- Efficient binary serialization (especially for large RecordBatches)
- Strong typing across language boundaries
- gRPC streaming for real-time subscriptions
- Cosmo Connect bridges GraphQL federation with gRPC services

**Stack**:
- Rust: `prost` + `tonic` for proto generation and gRPC server
- TypeScript: `@connectrpc/connect-web` + `buf` for client generation
- Transport: Cosmo Router for federation, gRPC-Web for browser clients

#### 3. Subgraph Architecture

**Decision**: Each AVA service is a Cosmo subgraph.

**Services**:
- `ava-discovery-service` — Source enumeration and schema introspection
- `ava-execution-service` — Spec validation + execution (atomic)
- `ava-registry-service` — Template and assemblage storage

**Rationale**:
- Independent deployment and scaling
- Federation allows cross-service queries
- Clean separation of concerns

---

## Open Architectural Concerns

### OAC-001: Schema Caching Strategy

**Status**: Open

**Question**: How often should source schemas be refreshed?

**Options**:
1. **On-demand** — Fetch schema on every `ListSources()` call
2. **Periodic** — Background refresh every N seconds
3. **Event-driven** — Invalidate cache on adapter reconnect or schema change notification
4. **Hybrid** — Cache with TTL, refresh on cache miss

**Considerations**:
- Stale schemas lead to validation failures at execution time
- Frequent introspection has performance cost
- Some sources (streaming) may not have fixed schemas

**Leaning**: Hybrid with short TTL (30s) + event-driven invalidation

---

### OAC-002: Spec Versioning and Migration

**Status**: Open

**Question**: How do we handle `ViewProfileSpec` schema evolution?

**Scenarios**:
- New pipeline operator added → old specs still valid
- Operator field renamed → old specs invalid
- Source schema changes → saved specs reference stale columns

**Options**:
1. **Version field + migrations** — Spec has `version: u32`, apply migrations on load
2. **Immutable snapshots** — Old specs reference frozen schema versions
3. **Best-effort compatibility** — Validate on load, mark incompatible specs

**Considerations**:
- Templates saved in registry may become stale
- Agents may generate specs with outdated structure
- Need clear error messages when specs become invalid

**Leaning**: Version field + migration functions, with clear incompatibility errors

---

### OAC-003: Permission-Filtered Discovery

**Status**: Open

**Question**: Should `ListSources()` be filtered by user permissions?

**Scenarios**:
- User A can see `assets-db` but not `payroll-db`
- Discovery returns only permitted sources
- Validation errors reveal existence of hidden sources?

**Options**:
1. **Unfiltered** — All sources visible, permissions enforced at execution
2. **Pre-filtered** — Discovery only returns permitted sources
3. **Capability-based** — Sources visible, but schema details hidden without permission

**Considerations**:
- Information leakage via error messages
- UX: showing sources user can't access is confusing
- Admin vs regular user views

**Leaning**: Pre-filtered discovery, with execution-time permission check as fallback

---

### OAC-004: Streaming Source Discovery

**Status**: Open

**Question**: How do we discover schemas for streaming sources?

**Problem**: Streaming sources (Kafka, WebSocket, etc.) often don't have fixed schemas. Data is semi-structured (JSON, Avro with schema registry, etc.).

**Options**:
1. **Schema registry integration** — Query Confluent Schema Registry, etc.
2. **Sample-based inference** — Peek at N messages, infer schema
3. **User-declared schemas** — Require schema declaration at registration
4. **Dynamic columns** — Return `columns: []` and let UI handle free-form data

**Considerations**:
- Avro/Protobuf sources have schemas, JSON doesn't
- Sample-based inference can be wrong
- Some streaming sources are truly schemaless

**Leaning**: Tiered approach — use schema registry if available, fall back to user-declared, mark truly dynamic sources as `schemaless: true`

---

### OAC-005: Cross-Source Join Validation

**Status**: Open

**Question**: How do we validate joins between different source types?

**Example**:
```
assets (SQLite) JOIN metrics (Kafka stream) ON assets.id = metrics.asset_id
```

**Challenges**:
- Type compatibility: `Utf8` vs `String` vs `bytes`
- Cardinality differences (batch vs stream)
- Execution semantics differ

**Options**:
1. **Strict type matching** — Reject unless types are identical
2. **Coercion rules** — Define implicit casts (e.g., `Int32` → `Int64`)
3. **Source-type restrictions** — Only allow joins within same source type
4. **DataFusion handles it** — Trust DataFusion's type coercion

**Considerations**:
- DataFusion does have type coercion rules
- But we want validation errors before execution
- Cross-source joins may not even be supported initially

**Leaning**: Initially restrict to same-source-type joins; add cross-source with explicit cast operators later

---

### OAC-006: Arrow IPC vs JSON Response Format

**Status**: Open

**Question**: When should we return Arrow IPC vs JSON?

**Trade-offs**:
| Format | Size | Parse Speed | Browser Support | Human Readable |
|--------|------|-------------|-----------------|----------------|
| JSON | Large | Slow | Native | Yes |
| Arrow IPC | Small | Fast | Via apache-arrow-js | No |

**Options**:
1. **Client choice** — `OutputFormat` enum in request
2. **Size threshold** — JSON for < 1000 rows, Arrow for larger
3. **Capability detection** — Check if client supports Arrow
4. **Always Arrow** — Mandate Arrow, provide JS library

**Considerations**:
- Debugging easier with JSON
- Production should use Arrow for efficiency
- AG-Grid can consume both

**Leaning**: Client choice via `OutputFormat` enum, default to JSON for compatibility

---

### OAC-007: Cosmo Connect Authentication Flow

**Status**: Open

**Question**: How does authentication flow through the federation layer?

**Current Understanding**:
- Cosmo Router handles incoming requests
- Router can extract JWT/API key from headers
- How to propagate identity to backend gRPC services?

**Options**:
1. **Header propagation** — Router forwards `Authorization` header to subgraphs
2. **Token exchange** — Router validates, issues internal service token
3. **mTLS** — Service-to-service auth via certificates
4. **Sidecar proxy** — Istio/Envoy handles auth

**Considerations**:
- Need user identity for permission filtering (OAC-003)
- gRPC metadata can carry headers
- Don't want auth logic duplicated in every service

**Leaning**: Header propagation + middleware in each service that extracts user context

---

## Changelog

| Date | Entry | Author |
|------|-------|--------|
| 2025-12-11 | Initial architecture established: Discovery/Validation layer, Protobuf-first transport, Cosmo Connect integration | Val |
| 2025-12-11 | Documented 7 open architectural concerns (OAC-001 through OAC-007) | Val |
