//! Adapter Registry
//!
//! Thread-safe registry for managing source adapters.
//!
//! Uses DashMap for concurrent access without explicit locking at the API level.

use std::sync::Arc;
use dashmap::DashMap;

use ava_domain::{DynSourceAdapter, SourceId};

/// Thread-safe registry for managing source adapters.
///
/// # Features
///
/// - Lock-free concurrent access via DashMap
/// - Type-erased adapter storage (`Arc<dyn SourceAdapter>`)
/// - Enumeration of all registered adapters
///
/// # Example
///
/// ```ignore
/// use ava_adapters::{AdapterRegistry, MemoryAdapter};
/// use ava_domain::SourceId;
///
/// let registry = AdapterRegistry::new();
///
/// // Create and register an adapter
/// let adapter = MemoryAdapter::new(SourceId::new("my-source"), vec![batch]);
/// registry.register(Arc::new(adapter));
///
/// // Retrieve by ID
/// if let Some(adapter) = registry.get(&SourceId::new("my-source")) {
///     let result = adapter.query("SELECT * FROM data").await?;
/// }
///
/// // List all registered IDs
/// let ids: Vec<SourceId> = registry.list_ids();
/// ```
#[derive(Default)]
pub struct AdapterRegistry {
    /// Map of SourceId → Arc<dyn SourceAdapter>
    adapters: DashMap<SourceId, DynSourceAdapter>,
}

impl std::fmt::Debug for AdapterRegistry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AdapterRegistry")
            .field("adapter_count", &self.adapters.len())
            .field("adapter_ids", &self.list_ids())
            .finish()
    }
}

impl AdapterRegistry {
    /// Creates a new empty registry.
    pub fn new() -> Self {
        Self {
            adapters: DashMap::new(),
        }
    }

    /// Creates a registry with pre-allocated capacity.
    ///
    /// Useful when the approximate number of adapters is known upfront.
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            adapters: DashMap::with_capacity(capacity),
        }
    }

    /// Registers an adapter in the registry.
    ///
    /// If an adapter with the same ID already exists, it will be replaced
    /// and the old adapter will be returned.
    ///
    /// # Arguments
    ///
    /// * `adapter` - The adapter to register (wrapped in Arc)
    ///
    /// # Returns
    ///
    /// The previously registered adapter with the same ID, if any.
    pub fn register(&self, adapter: DynSourceAdapter) -> Option<DynSourceAdapter> {
        let id = adapter.id().clone();
        self.adapters.insert(id, adapter)
    }

    /// Unregisters an adapter by its ID.
    ///
    /// # Returns
    ///
    /// The unregistered adapter, if it was present.
    pub fn unregister(&self, id: &SourceId) -> Option<DynSourceAdapter> {
        self.adapters.remove(id).map(|(_, v)| v)
    }

    /// Gets an adapter by its ID.
    ///
    /// Returns a clone of the Arc, allowing multiple concurrent readers.
    pub fn get(&self, id: &SourceId) -> Option<DynSourceAdapter> {
        self.adapters.get(id).map(|entry| Arc::clone(&*entry))
    }

    /// Checks if an adapter with the given ID is registered.
    pub fn contains(&self, id: &SourceId) -> bool {
        self.adapters.contains_key(id)
    }

    /// Returns the number of registered adapters.
    pub fn len(&self) -> usize {
        self.adapters.len()
    }

    /// Returns true if no adapters are registered.
    pub fn is_empty(&self) -> bool {
        self.adapters.is_empty()
    }

    /// Lists all registered adapter IDs.
    pub fn list_ids(&self) -> Vec<SourceId> {
        self.adapters.iter().map(|entry| entry.key().clone()).collect()
    }

    /// Lists all registered adapters.
    ///
    /// Returns clones of the Arc pointers, not the underlying adapters.
    pub fn list_adapters(&self) -> Vec<DynSourceAdapter> {
        self.adapters.iter().map(|entry| Arc::clone(&*entry)).collect()
    }

    /// Clears all registered adapters.
    pub fn clear(&self) {
        self.adapters.clear();
    }

    /// Retains only the adapters that satisfy the predicate.
    ///
    /// # Arguments
    ///
    /// * `f` - Predicate function; adapter is kept if this returns `true`
    pub fn retain<F>(&self, f: F)
    where
        F: FnMut(&SourceId, &mut DynSourceAdapter) -> bool,
    {
        self.adapters.retain(f);
    }
}

// AdapterRegistry is Send + Sync because DashMap is Send + Sync
// and DynSourceAdapter = Arc<dyn SourceAdapter + Send + Sync>

#[cfg(test)]
mod tests {
    use super::*;
    use crate::MemoryAdapter;
    use arrow::array::{Int32Array, StringArray};
    use arrow::datatypes::{DataType, Field, Schema};
    use arrow::record_batch::RecordBatch;

    fn make_test_batch() -> RecordBatch {
        let schema = Arc::new(Schema::new(vec![
            Field::new("id", DataType::Int32, false),
            Field::new("name", DataType::Utf8, true),
        ]));

        RecordBatch::try_new(
            schema,
            vec![
                Arc::new(Int32Array::from(vec![1, 2, 3])),
                Arc::new(StringArray::from(vec![Some("a"), Some("b"), Some("c")])),
            ],
        ).unwrap()
    }

    #[test]
    fn test_registry_new() {
        let registry = AdapterRegistry::new();
        assert!(registry.is_empty());
        assert_eq!(registry.len(), 0);
    }

    #[test]
    fn test_registry_register_get() {
        let registry = AdapterRegistry::new();
        let batch = make_test_batch();
        let adapter = MemoryAdapter::new(SourceId::new("test"), vec![batch]);

        registry.register(Arc::new(adapter));

        assert!(registry.contains(&SourceId::new("test")));
        assert_eq!(registry.len(), 1);

        let retrieved = registry.get(&SourceId::new("test"));
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id().as_str(), "test");
    }

    #[test]
    fn test_registry_unregister() {
        let registry = AdapterRegistry::new();
        let batch = make_test_batch();
        let adapter = MemoryAdapter::new(SourceId::new("test"), vec![batch]);

        registry.register(Arc::new(adapter));
        assert_eq!(registry.len(), 1);

        let removed = registry.unregister(&SourceId::new("test"));
        assert!(removed.is_some());
        assert_eq!(registry.len(), 0);
        assert!(!registry.contains(&SourceId::new("test")));
    }

    #[test]
    fn test_registry_replace() {
        let registry = AdapterRegistry::new();

        let batch1 = make_test_batch();
        let adapter1 = MemoryAdapter::new(SourceId::new("test"), vec![batch1]);
        registry.register(Arc::new(adapter1));

        let batch2 = make_test_batch();
        let adapter2 = MemoryAdapter::new(SourceId::new("test"), vec![batch2.clone(), batch2]);
        let old = registry.register(Arc::new(adapter2));

        assert!(old.is_some());
        assert_eq!(registry.len(), 1);
    }

    #[test]
    fn test_registry_list_ids() {
        let registry = AdapterRegistry::new();

        let batch = make_test_batch();
        registry.register(Arc::new(MemoryAdapter::new(SourceId::new("a"), vec![batch.clone()])));
        registry.register(Arc::new(MemoryAdapter::new(SourceId::new("b"), vec![batch.clone()])));
        registry.register(Arc::new(MemoryAdapter::new(SourceId::new("c"), vec![batch])));

        let ids = registry.list_ids();
        assert_eq!(ids.len(), 3);
        // Note: DashMap doesn't guarantee order, so we check membership
        assert!(ids.contains(&SourceId::new("a")));
        assert!(ids.contains(&SourceId::new("b")));
        assert!(ids.contains(&SourceId::new("c")));
    }

    #[test]
    fn test_registry_clear() {
        let registry = AdapterRegistry::new();
        let batch = make_test_batch();

        registry.register(Arc::new(MemoryAdapter::new(SourceId::new("a"), vec![batch.clone()])));
        registry.register(Arc::new(MemoryAdapter::new(SourceId::new("b"), vec![batch])));
        assert_eq!(registry.len(), 2);

        registry.clear();
        assert!(registry.is_empty());
    }

    #[test]
    fn test_registry_retain() {
        let registry = AdapterRegistry::new();
        let batch = make_test_batch();

        registry.register(Arc::new(MemoryAdapter::new(SourceId::new("keep_a"), vec![batch.clone()])));
        registry.register(Arc::new(MemoryAdapter::new(SourceId::new("drop_b"), vec![batch.clone()])));
        registry.register(Arc::new(MemoryAdapter::new(SourceId::new("keep_c"), vec![batch])));

        registry.retain(|id, _| id.as_str().starts_with("keep"));

        assert_eq!(registry.len(), 2);
        assert!(registry.contains(&SourceId::new("keep_a")));
        assert!(registry.contains(&SourceId::new("keep_c")));
        assert!(!registry.contains(&SourceId::new("drop_b")));
    }
}
