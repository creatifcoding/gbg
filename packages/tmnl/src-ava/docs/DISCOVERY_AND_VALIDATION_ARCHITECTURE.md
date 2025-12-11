# AVA Discovery and Validation Architecture

## Problem Statement

The current AVA implementation has a critical gap: **the UI has no way to discover what constitutes a valid `ViewProfileSpec`**. The compiler can translate specs to SQL, and adapters can connect to sources, but there's no layer that:

1. Enumerates available data sources and their schemas
2. Validates specs against those schemas before compilation
3. Provides a catalog of available/saved specs
4. Exposes this information to external consumers (UI, agents)

Without this, the UI is flying blind — it cannot construct valid pipelines because it doesn't know what sources exist, what columns they have, or what operations are supported.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                 UI / Agent                               │
│                                                                          │
│  "What sources exist?"    "Is this spec valid?"    "Execute this spec"  │
└────────────┬─────────────────────┬─────────────────────┬────────────────┘
             │                     │                     │
             ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              ava-api                                     │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │ Discovery API   │  │ Validation API  │  │ Execution API           │ │
│  │                 │  │                 │  │                         │ │
│  │ GET /sources    │  │ POST /validate  │  │ POST /views/execute     │ │
│  │ GET /sources/:id│  │                 │  │ WS /views/:id/subscribe │ │
│  │ GET /schemas    │  │                 │  │                         │ │
│  │ GET /specs      │  │                 │  │                         │ │
│  │ GET /assemblages│  │                 │  │                         │ │
│  └────────┬────────┘  └────────┬────────┘  └────────────┬────────────┘ │
└───────────┼────────────────────┼────────────────────────┼───────────────┘
            │                    │                        │
            ▼                    ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            ava-runtime                                   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                    SourceDiscoveryService                            ││
│  │                                                                      ││
│  │  - list_sources() → Vec<SourceDescriptor>                           ││
│  │  - get_source_schema(id) → SchemaRef                                ││
│  │  - get_source_capabilities(id) → SourceCapabilities                 ││
│  │                                                                      ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                       SpecRegistry                                   ││
│  │                                                                      ││
│  │  - list_templates() → Vec<ViewProfileSpec>                          ││
│  │  - get_template(id) → Option<ViewProfileSpec>                       ││
│  │  - save_spec(spec) → SpecId                                         ││
│  │  - list_assemblages() → Vec<Assemblage>                             ││
│  │                                                                      ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           ava-compiler                                   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                       SpecValidator                                  ││
│  │                                                                      ││
│  │  - validate(spec, schemas) → Result<ValidatedSpec, ValidationError> ││
│  │  - validate_pipeline(pipeline, source_schema) → Result<(), Error>   ││
│  │  - validate_column_refs(columns, schema) → Result<(), Error>        ││
│  │  - validate_join_compatibility(left, right, keys) → Result<()>      ││
│  │                                                                      ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                       ViewCompiler (existing)                        ││
│  │                                                                      ││
│  │  - compile(spec) → CompiledView                                     ││
│  │  - compile_to_dataframe(ctx, spec) → DataFrame                      ││
│  │                                                                      ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           ava-adapters                                   │
│                                                                          │
│  AdapterRegistry ─── MemoryAdapter ─── SqliteAdapter ─── (future...)    │
│                                                                          │
│  Each adapter exposes:                                                   │
│    - schema() → SchemaRef                                               │
│    - kind() → SourceKind                                                │
│    - query(sql) → RecordBatch                                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Types

### SourceDescriptor

Describes a data source for UI discovery:

```rust
/// Complete description of a data source for UI discovery
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceDescriptor {
    /// Unique source identifier
    pub id: SourceId,

    /// Human-readable name
    pub name: String,

    /// Optional description
    pub description: Option<String>,

    /// Source type (Sql, Stream, Api, etc.)
    pub kind: SourceKind,

    /// Connection status
    pub connected: bool,

    /// Schema information
    pub schema: SourceSchema,

    /// What operations this source supports
    pub capabilities: SourceCapabilities,

    /// Metadata tags
    pub tags: HashMap<String, String>,
}

/// Schema information for a source
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSchema {
    /// Available tables/collections (for multi-table sources)
    pub tables: Vec<TableSchema>,

    /// Default table (for single-table sources)
    pub default_table: Option<String>,
}

/// Schema for a single table
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableSchema {
    pub name: String,
    pub columns: Vec<ColumnDescriptor>,
}

/// Describes a single column
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnDescriptor {
    pub name: String,
    pub data_type: String,  // Arrow type as string for serialization
    pub nullable: bool,
    pub description: Option<String>,
}
```

### SourceCapabilities

What operations a source supports:

```rust
/// Capabilities of a data source
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceCapabilities {
    /// Supports SQL queries
    pub sql_query: bool,

    /// Supports filtering (WHERE clause)
    pub filtering: bool,

    /// Supports projection (SELECT specific columns)
    pub projection: bool,

    /// Supports aggregation (GROUP BY, SUM, AVG, etc.)
    pub aggregation: bool,

    /// Supports joins with other sources
    pub joins: bool,

    /// Supports window functions
    pub window_functions: bool,

    /// Supports streaming subscriptions
    pub streaming: bool,

    /// Supports write operations
    pub writable: bool,

    /// Maximum rows per query (if limited)
    pub max_rows: Option<u64>,
}

impl SourceCapabilities {
    /// Full SQL capabilities (MemoryAdapter, SqliteAdapter)
    pub fn full_sql() -> Self {
        Self {
            sql_query: true,
            filtering: true,
            projection: true,
            aggregation: true,
            joins: true,
            window_functions: true,
            streaming: false,
            writable: false,
            max_rows: None,
        }
    }

    /// Stream source capabilities
    pub fn streaming() -> Self {
        Self {
            sql_query: false,
            filtering: true,
            projection: true,
            aggregation: false,
            joins: false,
            window_functions: false,
            streaming: true,
            writable: false,
            max_rows: None,
        }
    }
}
```

### ValidationError

Detailed validation errors for UI feedback:

```rust
/// Validation error with location information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum ValidationError {
    /// Referenced source doesn't exist
    SourceNotFound {
        source_id: String,
        location: ErrorLocation,
    },

    /// Referenced column doesn't exist in source
    ColumnNotFound {
        column: String,
        source_id: String,
        available_columns: Vec<String>,
        location: ErrorLocation,
    },

    /// Type mismatch (e.g., joining incompatible types)
    TypeMismatch {
        expected: String,
        actual: String,
        context: String,
        location: ErrorLocation,
    },

    /// Invalid aggregation function
    InvalidAggregation {
        function: String,
        reason: String,
        location: ErrorLocation,
    },

    /// Operation not supported by source
    UnsupportedOperation {
        operation: String,
        source_id: String,
        location: ErrorLocation,
    },

    /// Circular dependency detected
    CircularDependency {
        cycle: Vec<String>,
    },
}

/// Location of an error within a spec
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorLocation {
    pub channel_id: Option<String>,
    pub pipeline_index: Option<usize>,
    pub field: Option<String>,
}
```

## API Endpoints

### Discovery API

```
GET /api/v1/sources
  → { sources: SourceDescriptor[] }

GET /api/v1/sources/:id
  → SourceDescriptor

GET /api/v1/sources/:id/schema
  → SourceSchema

GET /api/v1/specs/templates
  → { templates: ViewProfileSpec[] }

GET /api/v1/specs/templates/:id
  → ViewProfileSpec

GET /api/v1/assemblages
  → { assemblages: Assemblage[] }

GET /api/v1/assemblages/:id
  → Assemblage
```

### Validation API

```
POST /api/v1/validate
  Body: ViewProfileSpec
  → { valid: boolean, errors: ValidationError[] }

POST /api/v1/validate/pipeline
  Body: { sourceId: string, pipeline: PipelineOperator[] }
  → { valid: boolean, errors: ValidationError[] }
```

### Execution API

```
POST /api/v1/views/execute
  Body: ViewProfileSpec
  → { data: RecordBatch (as JSON or Arrow IPC) }

POST /api/v1/views/compile
  Body: ViewProfileSpec
  → { sql: string, plan: LogicalPlan (debug) }

WS /api/v1/views/:id/subscribe
  → Stream of RecordBatch updates
```

## UI Flow

### 1. Discovery Phase

```typescript
// UI startup: discover available sources
const sources = await fetch('/api/v1/sources').then(r => r.json());

// Build a source selector
sources.forEach(source => {
  console.log(`${source.name} (${source.kind})`);
  console.log(`  Columns: ${source.schema.tables[0].columns.map(c => c.name)}`);
  console.log(`  Supports: ${JSON.stringify(source.capabilities)}`);
});
```

### 2. Spec Construction Phase

```typescript
// User selects source and builds pipeline
const spec: ViewProfileSpec = {
  id: 'user-view-1',
  name: 'My Fleet View',
  assemblageId: 'fleet',
  channels: [{
    id: 'state',
    role: 'STATE',
    source: { id: 'assets-db', kind: 'sql', connection: '...' },
    pipeline: [
      { op: 'filter', content: { predicate: "status = 'active'" } },
      { op: 'project', content: { columns: ['id', 'name', 'location'] } },
    ],
    materialization: 'onDemand',
  }],
  version: 1,
};
```

### 3. Validation Phase

```typescript
// Validate before execution
const validation = await fetch('/api/v1/validate', {
  method: 'POST',
  body: JSON.stringify(spec),
}).then(r => r.json());

if (!validation.valid) {
  validation.errors.forEach(err => {
    console.error(`${err.type}: ${JSON.stringify(err)}`);
    // Show error in UI at err.location
  });
  return;
}
```

### 4. Execution Phase

```typescript
// Execute validated spec
const result = await fetch('/api/v1/views/execute', {
  method: 'POST',
  body: JSON.stringify(spec),
}).then(r => r.json());

// Render result.data in AG-Grid or other visualization
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

Implement REST endpoints:
- `GET /sources`
- `GET /sources/:id`
- `GET /specs/templates`
- `GET /assemblages`

### Phase D7: Validation API (ava-api)

Implement validation endpoint:
- `POST /validate`
- Wire to SpecValidator

### Phase D8: Integration Tests

End-to-end tests:
- Discovery → Validation → Execution flow
- Error case handling
- UI mock client

## Dependencies

```
ava-domain (types)
    │
    ├──► ava-compiler (validation)
    │         │
    │         └──► ava-runtime (discovery, registry)
    │                   │
    │                   └──► ava-api (REST/WS)
    │
    └──► ava-adapters (sources)
              │
              └──► ava-runtime (discovery queries adapters)
```

## Open Questions

1. **Schema caching**: How often to refresh source schemas? On-demand vs periodic?

2. **Spec versioning**: How to handle spec schema evolution?

3. **Permissions**: Should discovery be filtered by user permissions?

4. **Streaming discovery**: How to discover streaming source schemas (no fixed schema)?

5. **Cross-source joins**: How to validate join compatibility across different source types?
