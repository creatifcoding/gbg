# ava-domain Pattern Reference Guide

**Purpose:** Canonical patterns extracted from `src-ava/ava-domain/` for exact replication in `ava-fusion`.  
**Source:** All 9 files in `src-ava/ava-domain/src/` read and catalogued.  
**Date:** 2026-02-20

---

## Module Inventory

```
src-ava/ava-domain/src/
  ids.rs          — Branded newtypes (AssetId, ViewId, ChannelId, AssemblageId, SourceId, EventSequence)
  channels.rs     — ADT enums with tag/content serde (ChannelRole, SourceKind, PipelineOperator)
  assemblages.rs  — Recursive enum with Box (AssemblagePredicate)
  views.rs        — Struct with inline enum content fields (ChannelData, ViewDelta)
  events.rs       — Event enums + NATS envelope structs with builder methods
  errors.rs       — thiserror enums with #[typeshare] + AvaError top-level wrapper
  traits.rs       — async_trait object-safe traits + type aliases
  discovery.rs    — Struct builder pattern + capability flags + Default impls + From<Arrow> impls
  lib.rs          — Module declaration + wildcard re-exports
```

---

## Pattern 1: Branded Newtype (ids.rs)

### Template

```rust
/// [Docstring: describes what this ID identifies]
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct XxxId(pub String);

impl XxxId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}
```

### Key rules

| Rule | Detail |
|---|---|
| Derive order | `Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize` — always this exact order |
| Hash required | All IDs derive `Hash` — they are used as `HashMap` keys |
| Inner field | `pub String` — public for pattern matching; `transparent` serde means it serializes as plain string |
| `new()` sig | `impl Into<String>` — not `&str` or `String`, always the Into pattern |
| `as_str()` | Always present — returns `&str` for display/comparison without cloning |
| No `Copy` | IDs are `Clone` only — strings are heap-allocated |

### Special case: numeric ID with u64 precision

```rust
/// Logical sequence number for event ordering
/// Serialized as String for TypeScript (preserves u64 precision)
#[typeshare(serialized_as = "String")]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct EventSequence(pub u64);

impl EventSequence {
    pub fn new(seq: u64) -> Self { Self(seq) }
    pub fn next(&self) -> Self { Self(self.0 + 1) }
}

impl Default for EventSequence {
    fn default() -> Self { Self(0) }
}
```

Differences from string newtypes:
- `Copy` present (u64 is Copy)
- `PartialOrd, Ord` present (for range operations)
- `#[typeshare(serialized_as = "String")]` — preserves u64 precision in JS
- `Default` impl — sequence counters start at 0

---

## Pattern 2: ADT Enum — Leaf Variants (channels.rs: ChannelRole, MaterializationTier)

### Unit variants (no payload)

```rust
/// [Description]
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ChannelRole {
    State,
    Event,
    Metric,
    Command,
    Log,
}
```

Rules:
- `Copy` present — unit enums are cheap to copy
- `serde(rename_all = "SCREAMING_SNAKE_CASE")` — no tag/content, variants serialize as string values
- `Hash` present — used in sets and maps

### camelCase unit variants

```rust
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MaterializationTier {
    OnDemand,
    Cached,
    Continuous,
}
```

Rule: camelCase is the default for most enums; SCREAMING_SNAKE_CASE is used for role-like constants.

---

## Pattern 3: ADT Enum — Struct Variants with tag+content (channels.rs: SourceKind, PipelineOperator)

```rust
/// [Description]
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind", content = "content")]
pub enum SourceKind {
    Sql,
    Stream,
    Api,
    Graph,
    Lake,
    Cache,
    Custom(String),   // ← tuple variant is allowed
}
```

```rust
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "op", content = "content")]
pub enum PipelineOperator {
    Filter { predicate: String },
    Project { columns: Vec<String> },
    Aggregate { group_by: Vec<String>, aggregates: Vec<AggregateExpr> },
    Join { source: SourceId, left_key: String, right_key: String, join_type: JoinType },
    Sort { columns: Vec<SortColumn> },
    Limit { count: u32, offset: Option<u32> },
    Window { partition_by: Vec<String>, order_by: Vec<SortColumn>, function: String },
}
```

### Tag field name convention

| Domain | Tag key | Example |
|---|---|---|
| Source kinds | `"kind"` | `{ "kind": "sql" }` |
| Pipeline ops | `"op"` | `{ "op": "filter", "content": {...} }` |
| Channel data | `"type"` | `{ "type": "inline", "value": ... }` |
| View deltas | `"type"` | `{ "type": "channelUpdated", "content": {...} }` |
| Events | `"event"` | `{ "event": "viewRequested", "content": {...} }` |
| Actions | `"action"` | `{ "action": "compile", "content": {...} }` |
| Errors | `"error"` | `{ "error": "notFound", "content": {...} }` |
| Constraints | `"constraint"` | `{ "constraint": "requiredChannels", "content": {...} }` |
| Reasons | `"reason"` | `{ "reason": "clientRequest" }` |
| Unmount reasons | `"reason"` | same |
| Invalidation reasons | `"type"` | same as events |

Rule: `tag` is semantically meaningful to the domain (not always "type"). Content key is always `"content"` OR `"value"` (only `ChannelData` uses `"value"`).

### No-payload variants in struct-variant enum

```rust
// SourceKind::Sql — no content, tag field present: { "kind": "sql" }
Sql,
// ChannelData::Pending — no content: { "type": "pending" }
Pending,
// FiberAction::Noop
Noop,
// UnmountReason::ClientRequest
ClientRequest,
// Lane (uses camelCase, no tag/content — unit enum)
```

---

## Pattern 4: Recursive Enum with Box (assemblages.rs)

```rust
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "op", content = "content")]
pub enum AssemblagePredicate {
    AssetType { type_name: String },
    HasTrait { trait_name: String },
    InSite { site_id: String },
    InSector { sector_id: String },
    PropertyEquals { key: String, value: String },
    PropertyIn { key: String, values: Vec<String> },
    And { predicates: Vec<AssemblagePredicate> },         // ← Vec recursion (no Box needed)
    Or { predicates: Vec<AssemblagePredicate> },          // ← Vec recursion
    Not { predicate: Box<AssemblagePredicate> },          // ← Box for single recursive field
    Always,
    Never,
}
```

Rules:
- `Vec<Self>` does NOT need `Box` — Vec is heap-allocated
- Single recursive field NEEDS `Box` — otherwise infinite size at compile time
- Companion constructor methods on impl block:

```rust
impl AssemblagePredicate {
    pub fn and(predicates: Vec<AssemblagePredicate>) -> Self {
        AssemblagePredicate::And { predicates }
    }

    pub fn or(predicates: Vec<AssemblagePredicate>) -> Self {
        AssemblagePredicate::Or { predicates }
    }

    pub fn not(predicate: AssemblagePredicate) -> Self {
        AssemblagePredicate::Not { predicate: Box::new(predicate) }
    }

    pub fn is_constant(&self) -> bool {
        matches!(self, AssemblagePredicate::Always | AssemblagePredicate::Never)
    }
}
```

Constructor methods wrap Box internally — callers never see Box.

---

## Pattern 5: Struct with Optional/Default Fields (assemblages.rs, views.rs, discovery.rs)

```rust
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssemblageSpec {
    pub id: AssemblageId,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,                           // ← optional scalar
    pub domain: String,
    pub predicate: AssemblagePredicate,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub constraints: Vec<AssemblageConstraint>,                // ← optional Vec
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub admissible_views: Vec<ViewId>,                         // ← optional Vec
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub metadata: HashMap<String, String>,                     // ← optional HashMap
}
```

### Three optional field patterns

| Type | Attribute | Deserialize behavior | Serialize behavior |
|---|---|---|---|
| `Option<T>` | `#[serde(skip_serializing_if = "Option::is_none")]` | `null` or absent → `None` | `None` → omit field |
| `Vec<T>` | `#[serde(default, skip_serializing_if = "Vec::is_empty")]` | absent → `[]` | `[]` → omit field |
| `HashMap<K,V>` | `#[serde(default, skip_serializing_if = "HashMap::is_empty")]` | absent → `{}` | `{}` → omit field |

Rule: `default` is needed for Vec/HashMap but NOT for Option (Option defaults to None already).

### Boolean with explicit default

```rust
#[serde(default)]
pub retryable: bool,    // views.rs:ChannelData::Error
```

Used when false should be the default when field is absent in JSON.

---

## Pattern 6: Struct with Inline Enum Content + Box (views.rs)

```rust
/// Delta representing changes to a view artifact
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type", content = "content")]
pub enum ViewDelta {
    ChannelUpdated { channel_id: ChannelId, row_count: u32, timestamp_ms: f64 },
    ChannelActivated { channel_id: ChannelId },
    ChannelDeactivated { channel_id: ChannelId },
    ArtifactReplaced { artifact: Box<ViewArtifact> },   // ← Box to avoid recursive size issue
}
```

Rule: `Box<LargeStruct>` inside enum variants prevents the enum from being the size of the largest variant.

---

## Pattern 7: Error Enums (errors.rs)

```rust
/// View-related errors
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Error)]
#[serde(rename_all = "camelCase", tag = "error", content = "content")]
pub enum ViewError {
    #[error("View not found: {view_id:?}")]
    NotFound { view_id: ViewId },
    #[error("View compilation failed: {message}")]
    CompilationFailed { view_id: ViewId, message: String },
    #[error("Invalid view spec: {message}")]
    InvalidSpec { message: String },
}
```

Rules:
- Derive order: `Debug, Clone, PartialEq, Serialize, Deserialize, Error` — `Error` always last
- `#[typeshare]` present — errors cross the wire to TypeScript
- Tag key is `"error"` for error enums
- `#[error("...")]` format strings use `{field_name:?}` for newtype IDs (Debug fmt), `{field}` for String

### Top-level error wrapper

```rust
/// Top-level AVA error that encompasses all domain errors
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Error)]
#[serde(rename_all = "camelCase", tag = "domain", content = "content")]
pub enum AvaError {
    #[error("View error: {0}")]
    View(ViewError),                    // ← tuple variant wrapping domain error
    #[error("Internal error: {message}")]
    Internal { message: String },       // ← escape hatch
}

impl From<ViewError> for AvaError {
    fn from(e: ViewError) -> Self { AvaError::View(e) }
}
```

Rules:
- Top-level wrapper uses `tag = "domain"` not `tag = "error"`
- `From<DomainError>` impl for each wrapped type — enables `?` operator
- Tuple variant for domain wrapping, struct variant for Internal escape hatch

---

## Pattern 8: NATS Envelope Struct with Builder Methods (events.rs)

```rust
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewArtifactEvent {
    pub view_id: ViewId,
    pub artifact: ViewArtifact,
    pub timestamp_ms: f64,
    pub sequence: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,
}

impl ViewArtifactEvent {
    pub fn new(artifact: ViewArtifact, sequence: u64) -> Self {
        Self {
            view_id: artifact.view_id.clone(),
            timestamp_ms: Self::now_ms(),
            artifact,
            sequence,
            correlation_id: None,
        }
    }

    pub fn with_correlation_id(mut self, id: impl Into<String>) -> Self {
        self.correlation_id = Some(id.into());
        self
    }

    fn now_ms() -> f64 {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs_f64() * 1000.0)
            .unwrap_or(0.0)
    }
}
```

Rules for event structs:
- `timestamp_ms: f64` — epoch milliseconds as f64 (not u64, not i64)
- `sequence: u64` — raw u64 (not EventSequence) for NATS sequence numbers
- `correlation_id: Option<String>` — always optional, for tracing
- `now_ms()` — private associated function, same implementation repeated across structs
- Builder methods (`with_correlation_id`, `with_client_id`) — consume self, return Self

---

## Pattern 9: Struct with Method Queries (views.rs, discovery.rs)

```rust
impl ViewProfileSpec {
    pub fn channel_by_role(&self, role: ChannelRole) -> Option<&ChannelPipelineSpec> {
        self.channels.iter().find(|c| c.role == role)
    }

    pub fn channel_by_id(&self, id: &ChannelId) -> Option<&ChannelPipelineSpec> {
        self.channels.iter().find(|c| &c.id == id)
    }
}
```

Rules:
- Query methods return `Option<&T>` not `Result<&T, _>` — absence is not an error
- Method takes `&self` — never `mut` for queries
- ID comparisons use `&c.id == id` not `c.id == *id` (let the `==` operator handle deref)

---

## Pattern 10: Capability Flags Struct with Smart Constructors (discovery.rs)

```rust
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceCapabilities {
    pub sql_query: bool,
    pub filtering: bool,
    // ... all bool fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_rows: Option<u64>,
}

impl SourceCapabilities {
    pub fn none() -> Self { /* all false */ }
    pub fn full_sql() -> Self { /* sql flags true */ }
    pub fn full_sql_writable() -> Self {
        Self { writable: true, ..Self::full_sql() }   // ← struct update syntax
    }
    pub fn streaming() -> Self { /* streaming flags */ }
    pub fn api() -> Self { /* api flags, max_rows: Some(1000) */ }
    pub fn with_max_rows(mut self, max: u64) -> Self { /* builder */ }
    pub fn with_streaming(mut self) -> Self { /* builder */ }
    pub fn with_writes(mut self) -> Self { /* builder */ }
    pub fn supports(&self, op: &str) -> bool { /* match op.to_lowercase() */ }
}

impl Default for SourceCapabilities {
    fn default() -> Self { Self::none() }
}
```

Rules:
- All-false constructor named `none()` — not `Default::default()`
- Named preset constructors (not a builder pattern starting from scratch)
- `..Self::preset()` struct update syntax for variants of a preset
- `Default` delegates to `none()`
- `Eq` present when all fields are `Eq` (all bool + Option<u64>)

---

## Pattern 11: From<Arrow> impl (discovery.rs)

```rust
impl From<&arrow::datatypes::Schema> for TableSchema {
    fn from(schema: &arrow::datatypes::Schema) -> Self {
        let columns = schema.fields().iter().map(|field| ColumnDescriptor {
            name: field.name().clone(),
            data_type: format!("{:?}", field.data_type()),
            nullable: field.is_nullable(),
            description: field.metadata().get("description").cloned(),
        }).collect();

        TableSchema { name: "data".to_string(), columns }
    }
}

impl From<arrow::datatypes::SchemaRef> for TableSchema {
    fn from(schema: arrow::datatypes::SchemaRef) -> Self {
        TableSchema::from(schema.as_ref())   // ← delegate to &Schema impl
    }
}
```

Rule: Implement both `From<&T>` and `From<Arc<T>>` (SchemaRef = Arc<Schema>). The Arc version delegates to the reference version.

---

## Pattern 12: Event Enum with Accessor Methods (events.rs)

```rust
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "content")]
pub enum ReconcilerEvent {
    ViewRequested { view_id: ViewId, spec: ViewProfileSpec, timestamp_ms: f64 },
    ViewMounted { view_id: ViewId, artifact: ViewArtifact, timestamp_ms: f64 },
    // ... more variants, all have view_id and timestamp_ms
}

impl ReconcilerEvent {
    pub fn view_id(&self) -> &ViewId {
        match self {
            ReconcilerEvent::ViewRequested { view_id, .. } => view_id,
            ReconcilerEvent::ViewMounted { view_id, .. } => view_id,
            // ... exhaustive match
        }
    }

    pub fn timestamp_ms(&self) -> f64 {
        match self {
            ReconcilerEvent::ViewRequested { timestamp_ms, .. } => *timestamp_ms,
            // ... exhaustive match, deref f64 with *
        }
    }
}
```

Rules:
- Common fields across all variants → accessor method
- Reference fields (`&ViewId`) return `&T`
- Copy fields (`f64`, `u64`, `u8`) return by value with `*` deref
- `..` wildcard in match arm captures other fields

---

## Pattern 13: lib.rs Structure

```rust
//! [Crate Name]
//!
//! [One-line description].
//! All types are annotated with `#[typeshare]` for TypeScript generation.
//!
//! # Modules
//!
//! - `ids` - [Description]
//! - `channels` - [Description]
//! - ...

pub mod ids;
pub mod channels;
pub mod views;
pub mod assemblages;
pub mod events;
pub mod errors;
pub mod traits;
pub mod discovery;

// Re-export all types at crate root for convenience
pub use ids::*;
pub use channels::*;
pub use views::*;
pub use assemblages::*;
pub use events::*;
pub use errors::*;
pub use traits::*;
pub use discovery::*;
```

Rules:
- `//!` crate-level doc with module inventory
- Declaration order = logical dependency order (ids first — everything else depends on ids)
- Wildcard re-exports — consumers write `use ava_domain::ViewId` not `use ava_domain::ids::ViewId`

---

## Pattern 14: Test Structure

### Serde roundtrip test (mandatory per type)

```rust
#[test]
fn test_[type]_serialization() {
    let value = TypeName {
        id: SomeId::new("test-value"),
        name: "Test Name".into(),
        description: Some("Optional description".into()),
        vec_field: vec![],
        hash_field: HashMap::new(),
    };

    let json = serde_json::to_string(&value).unwrap();
    let parsed: TypeName = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.id, value.id);
    // assert specific field content
}
```

### Content assertions

```rust
let json = serde_json::to_string(&value).unwrap();
assert!(json.contains("\"type\":\"camelCaseVariant\""));  // tag field
assert!(json.contains("expected-string-value"));           // content
// NOT: assert_eq!(json, expected_json_string)             // fragile
```

Rule: Use `contains()` not exact JSON equality — field ordering may vary.

### Test helper function

```rust
fn make_test_spec() -> ViewProfileSpec {
    ViewProfileSpec {
        id: ViewId::new("view-1"),
        // ... minimal valid construction
    }
}

#[test]
fn test_view_artifact_serialization() {
    let spec = make_test_spec();       // ← reuse across tests
    // ...
}
```

### Struct update in tests (views.rs pattern)

```rust
let binding_pending = ChannelBinding {
    data: Some(ChannelData::Pending),
    ..binding.clone()           // ← clone base, override specific field
};
```

### Exhaustive enum test

```rust
#[test]
fn test_[enum]_all_variants() {
    let variants = [
        ViewLifecycleStatus::Pending,
        ViewLifecycleStatus::Compiling,
        // ... all variants
    ];
    for status in variants {
        let json = serde_json::to_string(&status).unwrap();
        let parsed: ViewLifecycleStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, status);
    }
}
```

### Compile-time object-safety test (traits.rs)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // Compile-time test that traits are object-safe
    fn _assert_object_safety() {
        fn _source(_: &dyn SourceAdapter) {}
        fn _compiler(_: &dyn ChannelCompiler) {}
    }
}
```

Rule: No `#[test]` attr — this function just needs to compile. If trait is not object-safe, compilation fails.

---

## Pattern 15: async_trait Traits (traits.rs)

```rust
use std::sync::Arc;
use async_trait::async_trait;

#[async_trait]
pub trait SourceAdapter: Send + Sync {
    fn kind(&self) -> SourceKind;               // sync method OK
    fn id(&self) -> &SourceId;                  // sync, returns reference

    async fn connect(&mut self) -> Result<(), SourceError>;   // mut self for stateful
    async fn query(&self, query: &str) -> Result<arrow::array::RecordBatch, SourceError>;

    // Default implementation
    async fn subscribe(
        &self,
        _callback: Box<dyn Fn(arrow::array::RecordBatch) + Send + Sync>,
    ) -> Result<SubscriptionHandle, SourceError> {
        Err(SourceError::UnsupportedOperation {
            source_id: self.id().clone(),
            operation: "subscribe".into(),
        })
    }
}

pub type DynSourceAdapter = Arc<dyn SourceAdapter>;
```

Rules:
- `Send + Sync` bounds on trait — required for use across threads
- Type alias `Dyn[TraitName] = Arc<dyn TraitName>` — named at definition site
- Default impls return `Err(UnsupportedOperation)` — not panics, not unimplemented!()
- `&mut self` for methods that change internal state (connect, disconnect)
- `&self` for pure queries even if async

---

## Quick-Reference: Serde Tag Field Names by Module

| Module | Enum | tag | content |
|---|---|---|---|
| channels.rs | SourceKind | `"kind"` | `"content"` |
| channels.rs | PipelineOperator | `"op"` | `"content"` |
| channels.rs | JoinType | *(none — camelCase unit)* | — |
| assemblages.rs | AssemblagePredicate | `"op"` | `"content"` |
| assemblages.rs | AssemblageConstraint | `"constraint"` | `"content"` |
| views.rs | ChannelData | `"type"` | `"value"` |
| views.rs | ViewDelta | `"type"` | `"content"` |
| events.rs | ReconcilerEvent | `"event"` | `"content"` |
| events.rs | UnmountReason | `"reason"` | `"content"` |
| events.rs | Lane | *(none — camelCase unit)* | — |
| events.rs | FiberAction | `"action"` | `"content"` |
| events.rs | InvalidationReason | `"type"` | `"content"` |
| events.rs | ViewLifecycleStatus | *(none — camelCase unit)* | — |
| errors.rs | ViewError | `"error"` | `"content"` |
| errors.rs | ChannelError | `"error"` | `"content"` |
| errors.rs | AvaError (wrapper) | `"domain"` | `"content"` |

**Only exception to `"content"`:** `ChannelData` uses `"value"` as its content key.

---

## Quick-Reference: Derive Macro Order

| Type | Required derives | Notes |
|---|---|---|
| ID newtypes (string) | `Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize` | No Copy, no Ord |
| ID newtypes (u64) | `Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize` | Copy + Ord present |
| Unit enum | `Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize` | Copy present |
| ADT enum (struct variants) | `Debug, Clone, PartialEq, Serialize, Deserialize` | No Copy, no Eq |
| Struct (non-Copy fields) | `Debug, Clone, PartialEq, Serialize, Deserialize` | |
| Struct (all Copy/Eq fields) | `Debug, Clone, PartialEq, Eq, Serialize, Deserialize` | Eq present |
| Error enum | `Debug, Clone, PartialEq, Serialize, Deserialize, Error` | Error last |

---

## ava-fusion Application Checklist

When creating a new type in `ava-fusion`, verify:

- [ ] `#[typeshare]` annotation present (before derive block)
- [ ] Derive order matches table above exactly
- [ ] `#[serde(rename_all = "camelCase")]` on all structs
- [ ] Tag key chosen per domain convention (see table above)
- [ ] `Option<T>` fields use `skip_serializing_if = "Option::is_none"`
- [ ] `Vec<T>` fields use `default, skip_serializing_if = "Vec::is_empty"`
- [ ] `HashMap<K,V>` fields use `default, skip_serializing_if = "HashMap::is_empty"`
- [ ] ID newtypes have `new(impl Into<String>)` and `as_str()` methods
- [ ] Recursive enums use `Box<T>` for single-field recursion only
- [ ] Error enums derive `Error` last, with `#[error("...")]` on each variant
- [ ] Top-level error wrapper has `From<DomainError>` impls
- [ ] Tests include: serde roundtrip, content assertions with `contains()`, exhaustive variant loop
- [ ] Wildcard re-export in `lib.rs`

