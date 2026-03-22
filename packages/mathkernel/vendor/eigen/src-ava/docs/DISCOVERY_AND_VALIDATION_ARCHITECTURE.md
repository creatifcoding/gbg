# AVA Discovery and Validation Architecture

## Problem Statement

The current AVA implementation has a critical gap: **the UI has no way to discover what constitutes a valid `ViewProfileSpec`**. The compiler can translate specs to SQL, and adapters can connect to sources, but there's no layer that:

1. Enumerates available data sources and their schemas
2. Validates specs against those schemas before compilation
3. Provides a catalog of available/saved specs
4. Exposes this information to external consumers (UI, agents)

Without this, the UI is flying blind — it cannot construct valid pipelines because it doesn't know what sources exist, what columns they have, or what operations are supported.

## Design Principles

### 1. Atomic Validate-and-Execute

**No separate validation step.** When the client sends a spec for execution:
1. Server validates internally
2. If valid → execute immediately, return results
3. If invalid → return validation errors, no execution

This eliminates round-trip overhead and prevents the "validated but stale" problem.

### 2. Protobuf-First, gRPC-Native

**Transport layer**: Cosmo Connect (GraphQL Federation → gRPC)

- All messages defined as Protobuf
- gRPC streaming for real-time subscriptions
- HTTP/JSON as fallback gateway (auto-generated from proto)
- Arrow IPC for bulk data transfer (RecordBatch serialization)

### 3. Subgraph Architecture

Each AVA service is a **Cosmo subgraph** that:
- Exposes a GraphQL schema (federated)
- Implements gRPC service handlers
- Can be deployed independently
- Participates in the Cosmo Router mesh

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              UI / Agent                                      │
│                                                                              │
│         "What sources exist?"              "Execute this spec"               │
│                │                                  │                          │
└────────────────┼──────────────────────────────────┼──────────────────────────┘
                 │                                  │
                 ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Cosmo Router (Federation)                            │
│                                                                              │
│  GraphQL Gateway ←──── gRPC-Web ←──── Protobuf Messages                     │
│                                                                              │
│  Subgraph routing:                                                          │
│    @ava/discovery  → ava-discovery-service                                  │
│    @ava/execution  → ava-execution-service                                  │
│    @ava/registry   → ava-registry-service                                   │
└───────────┬─────────────────────────────────────────────────┬───────────────┘
            │                                                 │
            ▼                                                 ▼
┌──────────────────────────────┐          ┌──────────────────────────────────┐
│   ava-discovery-service      │          │    ava-execution-service          │
│   (gRPC + Subgraph)          │          │    (gRPC + Subgraph)              │
│                              │          │                                    │
│  rpc ListSources()           │          │  rpc ExecuteSpec(ViewProfileSpec) │
│  rpc GetSource(id)           │          │    → validates internally          │
│  rpc GetSchema(id)           │          │    → compiles to SQL               │
│  rpc GetCapabilities(id)     │          │    → executes via adapters         │
│                              │          │    → returns Result | Errors       │
│  Introspects:                │          │                                    │
│    └─► AdapterRegistry       │          │  rpc SubscribeView(id)            │
│                              │          │    → streaming RecordBatch         │
└──────────────────────────────┘          │                                    │
                                          │  Uses:                             │
                                          │    └─► SpecValidator               │
                                          │    └─► ViewCompiler                │
                                          │    └─► AdapterRegistry             │
                                          └──────────────────────────────────┘
                                                         │
┌──────────────────────────────┐                         │
│   ava-registry-service       │                         │
│   (gRPC + Subgraph)          │                         │
│                              │                         │
│  rpc ListTemplates()         │                         │
│  rpc GetTemplate(id)         │                         │
│  rpc SaveSpec(spec)          │                         │
│  rpc ListAssemblages()       │                         │
│                              │                         │
└──────────────────────────────┘                         │
                                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ava-core (Rust library)                         │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │  SpecValidator  │  │  ViewCompiler   │  │    AdapterRegistry          │ │
│  │                 │  │                 │  │                             │ │
│  │  validate()     │  │  compile()      │  │  MemoryAdapter              │ │
│  │  → Result<      │  │  → CompiledView │  │  SqliteAdapter              │ │
│  │    ValidatedSpec│  │  → SQL + Plan   │  │  (future adapters...)       │ │
│  │    ValidationErr│  │                 │  │                             │ │
│  │  >              │  │                 │  │  → SourceTableProvider      │ │
│  └─────────────────┘  └─────────────────┘  │    (DataFusion federation)  │ │
│                                            └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Protobuf Definitions

### discovery.proto

```protobuf
syntax = "proto3";
package ava.discovery.v1;

import "google/protobuf/empty.proto";

// Service for discovering available data sources
service DiscoveryService {
  // List all available sources
  rpc ListSources(google.protobuf.Empty) returns (ListSourcesResponse);

  // Get a specific source by ID
  rpc GetSource(GetSourceRequest) returns (SourceDescriptor);

  // Get schema for a source
  rpc GetSchema(GetSchemaRequest) returns (SourceSchema);

  // Get capabilities for a source
  rpc GetCapabilities(GetCapabilitiesRequest) returns (SourceCapabilities);
}

message ListSourcesResponse {
  repeated SourceDescriptor sources = 1;
}

message GetSourceRequest {
  string source_id = 1;
}

message GetSchemaRequest {
  string source_id = 1;
  optional string table_name = 2;  // If omitted, returns all tables
}

message GetCapabilitiesRequest {
  string source_id = 1;
}

// Complete description of a data source
message SourceDescriptor {
  string id = 1;
  string name = 2;
  optional string description = 3;
  SourceKind kind = 4;
  bool connected = 5;
  SourceSchema schema = 6;
  SourceCapabilities capabilities = 7;
  map<string, string> tags = 8;
}

enum SourceKind {
  SOURCE_KIND_UNSPECIFIED = 0;
  SOURCE_KIND_SQL = 1;
  SOURCE_KIND_STREAM = 2;
  SOURCE_KIND_API = 3;
}

message SourceSchema {
  repeated TableSchema tables = 1;
  optional string default_table = 2;
}

message TableSchema {
  string name = 1;
  repeated ColumnDescriptor columns = 2;
}

message ColumnDescriptor {
  string name = 1;
  string data_type = 2;  // Arrow type as string
  bool nullable = 3;
  optional string description = 4;
}

message SourceCapabilities {
  bool sql_query = 1;
  bool filtering = 2;
  bool projection = 3;
  bool aggregation = 4;
  bool joins = 5;
  bool window_functions = 6;
  bool streaming = 7;
  bool writable = 8;
  optional uint64 max_rows = 9;
}
```

### execution.proto

```protobuf
syntax = "proto3";
package ava.execution.v1;

// Service for executing view specs (validates internally)
service ExecutionService {
  // Execute a spec - validates then executes atomically
  // Returns either results OR validation errors, never both
  rpc ExecuteSpec(ExecuteSpecRequest) returns (ExecuteSpecResponse);

  // Execute and get compiled SQL (for debugging)
  rpc CompileSpec(CompileSpecRequest) returns (CompileSpecResponse);

  // Subscribe to a view for streaming updates
  rpc SubscribeView(SubscribeViewRequest) returns (stream ViewUpdate);
}

message ExecuteSpecRequest {
  ViewProfileSpec spec = 1;
  OutputFormat output_format = 2;
}

enum OutputFormat {
  OUTPUT_FORMAT_UNSPECIFIED = 0;
  OUTPUT_FORMAT_JSON = 1;       // JSON array of records
  OUTPUT_FORMAT_ARROW_IPC = 2;  // Arrow IPC format (efficient)
}

message ExecuteSpecResponse {
  oneof result {
    ExecutionSuccess success = 1;
    ExecutionFailure failure = 2;
  }
}

message ExecutionSuccess {
  bytes data = 1;  // JSON or Arrow IPC depending on output_format
  uint64 row_count = 2;
  uint64 execution_time_ms = 3;
}

message ExecutionFailure {
  repeated ValidationError errors = 1;
}

message CompileSpecRequest {
  ViewProfileSpec spec = 1;
}

message CompileSpecResponse {
  oneof result {
    CompilationSuccess success = 1;
    ExecutionFailure failure = 2;
  }
}

message CompilationSuccess {
  string sql = 1;
  string logical_plan = 2;  // Debug representation
}

message SubscribeViewRequest {
  string view_id = 1;
  OutputFormat output_format = 2;
}

message ViewUpdate {
  oneof update {
    bytes data = 1;           // Incremental data
    ViewError error = 2;      // Stream error
    ViewComplete complete = 3; // Stream ended
  }
}

message ViewError {
  string message = 1;
  string code = 2;
}

message ViewComplete {
  uint64 total_rows = 1;
}

// --- ViewProfileSpec (the main payload) ---

message ViewProfileSpec {
  string id = 1;
  string name = 2;
  optional string assemblage_id = 3;
  repeated ChannelPipelineSpec channels = 4;
  uint32 version = 5;
}

message ChannelPipelineSpec {
  string id = 1;
  ChannelRole role = 2;
  SourceSpec source = 3;
  repeated SourceSpec additional_sources = 4;
  repeated PipelineOperator pipeline = 5;
  MaterializationTier materialization = 6;
  optional uint64 refresh_ms = 7;
}

enum ChannelRole {
  CHANNEL_ROLE_UNSPECIFIED = 0;
  CHANNEL_ROLE_STATE = 1;
  CHANNEL_ROLE_EVENT = 2;
  CHANNEL_ROLE_METRIC = 3;
  CHANNEL_ROLE_COMMAND = 4;
}

message SourceSpec {
  string id = 1;
  SourceKind kind = 2;
  string connection = 3;
  optional string schema_name = 4;
}

message PipelineOperator {
  oneof operator {
    FilterOp filter = 1;
    ProjectOp project = 2;
    AggregateOp aggregate = 3;
    JoinOp join = 4;
    SortOp sort = 5;
    LimitOp limit = 6;
    WindowOp window = 7;
  }
}

message FilterOp {
  string predicate = 1;
}

message ProjectOp {
  repeated string columns = 1;
}

message AggregateOp {
  repeated string group_by = 1;
  repeated AggregateExpr aggregates = 2;
}

message AggregateExpr {
  string function = 1;
  string column = 2;
  string alias = 3;
}

message JoinOp {
  string source_id = 1;
  string left_key = 2;
  string right_key = 3;
  JoinType join_type = 4;
}

enum JoinType {
  JOIN_TYPE_UNSPECIFIED = 0;
  JOIN_TYPE_INNER = 1;
  JOIN_TYPE_LEFT = 2;
  JOIN_TYPE_RIGHT = 3;
  JOIN_TYPE_FULL = 4;
  JOIN_TYPE_CROSS = 5;
}

message SortOp {
  repeated SortColumn columns = 1;
}

message SortColumn {
  string column = 1;
  bool descending = 2;
  bool nulls_first = 3;
}

message LimitOp {
  uint32 count = 1;
  optional uint32 offset = 2;
}

message WindowOp {
  repeated string partition_by = 1;
  repeated SortColumn order_by = 2;
  string function = 3;
}

enum MaterializationTier {
  MATERIALIZATION_TIER_UNSPECIFIED = 0;
  MATERIALIZATION_TIER_ON_DEMAND = 1;
  MATERIALIZATION_TIER_CACHED = 2;
  MATERIALIZATION_TIER_MATERIALIZED = 3;
}

// --- Validation Errors ---

message ValidationError {
  oneof error {
    SourceNotFoundError source_not_found = 1;
    ColumnNotFoundError column_not_found = 2;
    TypeMismatchError type_mismatch = 3;
    InvalidAggregationError invalid_aggregation = 4;
    UnsupportedOperationError unsupported_operation = 5;
    CircularDependencyError circular_dependency = 6;
  }
}

message SourceNotFoundError {
  string source_id = 1;
  ErrorLocation location = 2;
}

message ColumnNotFoundError {
  string column = 1;
  string source_id = 2;
  repeated string available_columns = 3;
  ErrorLocation location = 4;
}

message TypeMismatchError {
  string expected = 1;
  string actual = 2;
  string context = 3;
  ErrorLocation location = 4;
}

message InvalidAggregationError {
  string function = 1;
  string reason = 2;
  ErrorLocation location = 3;
}

message UnsupportedOperationError {
  string operation = 1;
  string source_id = 2;
  ErrorLocation location = 3;
}

message CircularDependencyError {
  repeated string cycle = 1;
}

message ErrorLocation {
  optional string channel_id = 1;
  optional uint32 pipeline_index = 2;
  optional string field = 3;
}
```

### registry.proto

```protobuf
syntax = "proto3";
package ava.registry.v1;

import "google/protobuf/empty.proto";
import "ava/execution/v1/execution.proto";

// Service for managing spec templates and assemblages
service RegistryService {
  // List all spec templates
  rpc ListTemplates(google.protobuf.Empty) returns (ListTemplatesResponse);

  // Get a specific template
  rpc GetTemplate(GetTemplateRequest) returns (ava.execution.v1.ViewProfileSpec);

  // Save a spec as a template
  rpc SaveSpec(SaveSpecRequest) returns (SaveSpecResponse);

  // Delete a template
  rpc DeleteTemplate(DeleteTemplateRequest) returns (google.protobuf.Empty);

  // List assemblages
  rpc ListAssemblages(google.protobuf.Empty) returns (ListAssemblagesResponse);

  // Get a specific assemblage
  rpc GetAssemblage(GetAssemblageRequest) returns (Assemblage);
}

message ListTemplatesResponse {
  repeated TemplateMetadata templates = 1;
}

message TemplateMetadata {
  string id = 1;
  string name = 2;
  optional string description = 3;
  string created_at = 4;  // ISO 8601
  string updated_at = 5;
  uint32 version = 6;
}

message GetTemplateRequest {
  string template_id = 1;
}

message SaveSpecRequest {
  ava.execution.v1.ViewProfileSpec spec = 1;
  optional string description = 2;
}

message SaveSpecResponse {
  string template_id = 1;
  uint32 version = 2;
}

message DeleteTemplateRequest {
  string template_id = 1;
}

message ListAssemblagesResponse {
  repeated Assemblage assemblages = 1;
}

message GetAssemblageRequest {
  string assemblage_id = 1;
}

message Assemblage {
  string id = 1;
  string name = 2;
  optional string description = 3;
  repeated string channel_ids = 4;  // Which channels belong to this assemblage
}
```

## Cosmo Connect Integration

### Subgraph Schema (GraphQL)

Each gRPC service is exposed as a Cosmo subgraph via `@cosmo/connect`:

```graphql
# discovery.graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

type Query {
  sources: [SourceDescriptor!]!
  source(id: ID!): SourceDescriptor
  sourceSchema(sourceId: ID!, tableName: String): SourceSchema
  sourceCapabilities(sourceId: ID!): SourceCapabilities
}

type SourceDescriptor @key(fields: "id") {
  id: ID!
  name: String!
  description: String
  kind: SourceKind!
  connected: Boolean!
  schema: SourceSchema!
  capabilities: SourceCapabilities!
  tags: [Tag!]!
}

# ... rest maps from proto
```

### Router Configuration

```yaml
# cosmo-router.yaml
version: "1"
subgraphs:
  - name: ava-discovery
    routing_url: grpc://ava-discovery:50051
    schema:
      file: ./subgraphs/discovery.graphql

  - name: ava-execution
    routing_url: grpc://ava-execution:50052
    schema:
      file: ./subgraphs/execution.graphql

  - name: ava-registry
    routing_url: grpc://ava-registry:50053
    schema:
      file: ./subgraphs/registry.graphql

federation:
  enabled: true

gateway:
  # HTTP/JSON fallback
  http:
    enabled: true
    path: /graphql
  # gRPC-Web for browser clients
  grpc_web:
    enabled: true
```

## UI Flow (Revised)

### Phase 1: Discovery

```typescript
// Using Cosmo Connect client (gRPC-Web)
import { createClient } from '@connectrpc/connect-web';
import { DiscoveryService } from './gen/ava/discovery/v1/discovery_connect';

const discovery = createClient(DiscoveryService, transport);

// Discover available sources
const { sources } = await discovery.listSources({});

sources.forEach(source => {
  console.log(`${source.name} (${source.kind})`);
  console.log(`  Columns: ${source.schema.tables[0].columns.map(c => c.name)}`);
  console.log(`  Supports: aggregation=${source.capabilities.aggregation}`);
});
```

### Phase 2: Spec Construction

```typescript
// User builds pipeline via UI
const spec: ViewProfileSpec = {
  id: 'user-view-1',
  name: 'Active Fleet by Site',
  channels: [{
    id: 'state',
    role: ChannelRole.STATE,
    source: { id: 'assets-db', kind: SourceKind.SQL, connection: '' },
    pipeline: [
      { filter: { predicate: "status = 'active'" } },
      { project: { columns: ['id', 'name', 'site_id', 'value'] } },
      { aggregate: {
        groupBy: ['site_id'],
        aggregates: [{ function: 'sum', column: 'value', alias: 'total' }]
      }},
    ],
    materialization: MaterializationTier.ON_DEMAND,
  }],
  version: 1,
};
```

### Phase 3: Execute (Validates Internally)

```typescript
import { ExecutionService } from './gen/ava/execution/v1/execution_connect';

const execution = createClient(ExecutionService, transport);

// Single call: validates + executes
const response = await execution.executeSpec({
  spec,
  outputFormat: OutputFormat.ARROW_IPC,
});

// Handle result
if (response.result.case === 'success') {
  const { data, rowCount, executionTimeMs } = response.result.value;

  // Decode Arrow IPC to RecordBatch
  const table = tableFromIPC(data);

  // Feed to AG-Grid
  gridApi.setRowData(table.toArray());

  console.log(`${rowCount} rows in ${executionTimeMs}ms`);

} else if (response.result.case === 'failure') {
  const { errors } = response.result.value;

  errors.forEach(err => {
    // Show error in UI at location
    if (err.error.case === 'columnNotFound') {
      const { column, availableColumns, location } = err.error.value;
      showError(`Unknown column "${column}"`, location);
      showSuggestions(availableColumns);
    }
  });
}
```

### Streaming Subscription

```typescript
// Subscribe to live view updates
const stream = execution.subscribeView({
  viewId: 'user-view-1',
  outputFormat: OutputFormat.ARROW_IPC,
});

for await (const update of stream) {
  if (update.update.case === 'data') {
    const batch = tableFromIPC(update.update.value);
    gridApi.applyTransaction({ add: batch.toArray() });

  } else if (update.update.case === 'error') {
    console.error(`Stream error: ${update.update.value.message}`);

  } else if (update.update.case === 'complete') {
    console.log(`Stream complete: ${update.update.value.totalRows} rows`);
  }
}
```

## Implementation Phases

### Phase D1: Discovery Types (ava-domain)

Add discovery types to ava-domain:
- `SourceDescriptor`
- `SourceSchema`
- `TableSchema`
- `ColumnDescriptor`
- `SourceCapabilities`

### Phase D2: Validation Types (ava-compiler)

Add validation types to ava-compiler:
- `ValidationError` enum
- `ErrorLocation`
- `ValidationResult`

### Phase D3: SpecValidator (ava-compiler)

Implement validation service:
- `SpecValidator::validate(spec, schemas)`
- Column reference validation
- Type compatibility checks
- Capability checks

### Phase D4: SourceDiscoveryService (ava-runtime)

Implement discovery service:
- `list_sources()` → enumerate adapters
- `get_source_schema(id)` → introspect adapter
- `get_source_capabilities(id)` → derive from adapter kind

### Phase D5: SpecRegistry (ava-runtime)

Implement spec storage:
- In-memory template storage
- CRUD for saved specs
- Assemblage management

### Phase D6: Discovery API (ava-api)

Implement gRPC service + Cosmo subgraph:
- `DiscoveryService` (gRPC)
- `discovery.graphql` (subgraph schema)
- Proto generation setup

### Phase D7: Execution API (ava-api)

Implement gRPC service + Cosmo subgraph:
- `ExecutionService` (gRPC)
- Atomic validate-then-execute
- Arrow IPC response encoding
- Streaming subscription support

### Phase D8: Integration Tests

End-to-end tests:
- Discovery → Execute flow (single round-trip)
- Error case handling (validation errors returned)
- Streaming subscription tests
- Cosmo Router integration tests

## Crate Dependencies

```
ava-domain (types + proto generation)
    │
    ├──► ava-compiler (validation + compilation)
    │         │
    │         └──► ava-runtime (services)
    │                   │
    │                   └──► ava-api (gRPC services)
    │                             │
    │                             └──► Cosmo subgraphs
    │
    └──► ava-adapters (data sources)
              │
              └──► ava-runtime (discovery queries adapters)
```

## Proto Generation

### Rust (prost + tonic)

```toml
# ava-domain/Cargo.toml
[dependencies]
prost = "0.12"
tonic = "0.11"

[build-dependencies]
tonic-build = "0.11"
```

```rust
// ava-domain/build.rs
fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .compile(
            &[
                "proto/ava/discovery/v1/discovery.proto",
                "proto/ava/execution/v1/execution.proto",
                "proto/ava/registry/v1/registry.proto",
            ],
            &["proto"],
        )?;
    Ok(())
}
```

### TypeScript (connect-es)

```bash
# Generate TypeScript from protos
npx buf generate --template buf.gen.yaml
```

```yaml
# buf.gen.yaml
version: v1
plugins:
  - plugin: es
    out: src/gen
    opt: target=ts
  - plugin: connect-es
    out: src/gen
    opt: target=ts
```

## Open Questions

1. **Schema caching**: How often to refresh source schemas? On-demand vs periodic?

2. **Spec versioning**: How to handle spec schema evolution?

3. **Permissions**: Should discovery be filtered by user permissions?

4. **Streaming discovery**: How to discover streaming source schemas (no fixed schema)?

5. **Cross-source joins**: How to validate join compatibility across different source types?

6. **Arrow IPC vs JSON**: When to use each? Size threshold? Client capability detection?

7. **Cosmo Connect auth**: How does auth flow through the federation layer?
