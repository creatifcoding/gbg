//! Spec Registry - Central storage for ViewProfileSpecs
//!
//! The SpecRegistry provides thread-safe storage and retrieval of view specifications.
//! It maintains versioning and supports listing, filtering, and updating specs.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use ava_domain::{ViewProfileSpec, ViewId, AssemblageId};

use crate::error::RuntimeError;

/// Thread-safe registry for ViewProfileSpecs
#[derive(Debug, Clone)]
pub struct SpecRegistry {
    specs: Arc<RwLock<HashMap<ViewId, ViewProfileSpec>>>,
}

impl Default for SpecRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl SpecRegistry {
    /// Create a new empty registry
    pub fn new() -> Self {
        Self {
            specs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a new spec
    ///
    /// Returns error if a spec with the same view ID already exists.
    pub fn register(&self, spec: ViewProfileSpec) -> Result<(), RuntimeError> {
        let mut specs = self.specs.write().map_err(|e| {
            RuntimeError::internal(format!("Failed to acquire write lock: {}", e))
        })?;

        if specs.contains_key(&spec.id) {
            return Err(RuntimeError::SpecAlreadyExists(spec.id.as_str().to_string()));
        }

        specs.insert(spec.id.clone(), spec);
        Ok(())
    }

    /// Update an existing spec
    ///
    /// Returns error if the spec doesn't exist.
    pub fn update(&self, spec: ViewProfileSpec) -> Result<ViewProfileSpec, RuntimeError> {
        let mut specs = self.specs.write().map_err(|e| {
            RuntimeError::internal(format!("Failed to acquire write lock: {}", e))
        })?;

        if !specs.contains_key(&spec.id) {
            return Err(RuntimeError::SpecNotFound(spec.id.as_str().to_string()));
        }

        let old = specs.insert(spec.id.clone(), spec).unwrap();
        Ok(old)
    }

    /// Register or update a spec (upsert)
    pub fn upsert(&self, spec: ViewProfileSpec) -> Result<Option<ViewProfileSpec>, RuntimeError> {
        let mut specs = self.specs.write().map_err(|e| {
            RuntimeError::internal(format!("Failed to acquire write lock: {}", e))
        })?;

        let old = specs.insert(spec.id.clone(), spec);
        Ok(old)
    }

    /// Remove a spec from the registry
    ///
    /// Returns the removed spec if it existed.
    pub fn remove(&self, view_id: &ViewId) -> Result<Option<ViewProfileSpec>, RuntimeError> {
        let mut specs = self.specs.write().map_err(|e| {
            RuntimeError::internal(format!("Failed to acquire write lock: {}", e))
        })?;

        Ok(specs.remove(view_id))
    }

    /// Get a spec by view ID
    pub fn get(&self, view_id: &ViewId) -> Result<Option<ViewProfileSpec>, RuntimeError> {
        let specs = self.specs.read().map_err(|e| {
            RuntimeError::internal(format!("Failed to acquire read lock: {}", e))
        })?;

        Ok(specs.get(view_id).cloned())
    }

    /// Check if a spec exists
    pub fn contains(&self, view_id: &ViewId) -> Result<bool, RuntimeError> {
        let specs = self.specs.read().map_err(|e| {
            RuntimeError::internal(format!("Failed to acquire read lock: {}", e))
        })?;

        Ok(specs.contains_key(view_id))
    }

    /// List all specs
    pub fn list(&self) -> Result<Vec<ViewProfileSpec>, RuntimeError> {
        let specs = self.specs.read().map_err(|e| {
            RuntimeError::internal(format!("Failed to acquire read lock: {}", e))
        })?;

        Ok(specs.values().cloned().collect())
    }

    /// List specs filtered by assemblage
    pub fn list_by_assemblage(&self, assemblage_id: &AssemblageId) -> Result<Vec<ViewProfileSpec>, RuntimeError> {
        let specs = self.specs.read().map_err(|e| {
            RuntimeError::internal(format!("Failed to acquire read lock: {}", e))
        })?;

        Ok(specs
            .values()
            .filter(|s| &s.assemblage_id == assemblage_id)
            .cloned()
            .collect())
    }

    /// List specs filtered by tag
    pub fn list_by_tag(&self, key: &str, value: &str) -> Result<Vec<ViewProfileSpec>, RuntimeError> {
        let specs = self.specs.read().map_err(|e| {
            RuntimeError::internal(format!("Failed to acquire read lock: {}", e))
        })?;

        Ok(specs
            .values()
            .filter(|s| s.tags.get(key).map_or(false, |v| v == value))
            .cloned()
            .collect())
    }

    /// Get the number of registered specs
    pub fn len(&self) -> Result<usize, RuntimeError> {
        let specs = self.specs.read().map_err(|e| {
            RuntimeError::internal(format!("Failed to acquire read lock: {}", e))
        })?;

        Ok(specs.len())
    }

    /// Check if the registry is empty
    pub fn is_empty(&self) -> Result<bool, RuntimeError> {
        Ok(self.len()? == 0)
    }

    /// Clear all specs from the registry
    pub fn clear(&self) -> Result<(), RuntimeError> {
        let mut specs = self.specs.write().map_err(|e| {
            RuntimeError::internal(format!("Failed to acquire write lock: {}", e))
        })?;

        specs.clear();
        Ok(())
    }

    /// Get all view IDs in the registry
    pub fn view_ids(&self) -> Result<Vec<ViewId>, RuntimeError> {
        let specs = self.specs.read().map_err(|e| {
            RuntimeError::internal(format!("Failed to acquire read lock: {}", e))
        })?;

        Ok(specs.keys().cloned().collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn make_spec(id: &str, version: u32) -> ViewProfileSpec {
        ViewProfileSpec {
            id: ViewId::new(id),
            name: format!("View {}", id),
            description: Some(format!("Version {}", version)),
            assemblage_id: AssemblageId::new("test"),
            channels: vec![],
            tags: HashMap::new(),
            version,
        }
    }

    fn make_spec_with_assemblage(id: &str, assemblage: &str) -> ViewProfileSpec {
        ViewProfileSpec {
            id: ViewId::new(id),
            name: format!("View {}", id),
            description: None,
            assemblage_id: AssemblageId::new(assemblage),
            channels: vec![],
            tags: HashMap::new(),
            version: 1,
        }
    }

    fn make_spec_with_tag(id: &str, key: &str, value: &str) -> ViewProfileSpec {
        let mut tags = HashMap::new();
        tags.insert(key.to_string(), value.to_string());

        ViewProfileSpec {
            id: ViewId::new(id),
            name: format!("View {}", id),
            description: None,
            assemblage_id: AssemblageId::new("test"),
            channels: vec![],
            tags,
            version: 1,
        }
    }

    #[test]
    fn test_new_registry_is_empty() {
        let registry = SpecRegistry::new();
        assert!(registry.is_empty().unwrap());
        assert_eq!(registry.len().unwrap(), 0);
    }

    #[test]
    fn test_register_and_get() {
        let registry = SpecRegistry::new();
        let spec = make_spec("view-1", 1);

        registry.register(spec.clone()).unwrap();

        let retrieved = registry.get(&ViewId::new("view-1")).unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "View view-1");
    }

    #[test]
    fn test_register_duplicate_fails() {
        let registry = SpecRegistry::new();
        let spec1 = make_spec("view-1", 1);
        let spec2 = make_spec("view-1", 2);

        registry.register(spec1).unwrap();
        let result = registry.register(spec2);

        assert!(matches!(result, Err(RuntimeError::SpecAlreadyExists(_))));
    }

    #[test]
    fn test_update_existing() {
        let registry = SpecRegistry::new();
        let spec1 = make_spec("view-1", 1);
        let spec2 = make_spec("view-1", 2);

        registry.register(spec1).unwrap();
        let old = registry.update(spec2).unwrap();

        assert_eq!(old.version, 1);

        let retrieved = registry.get(&ViewId::new("view-1")).unwrap().unwrap();
        assert_eq!(retrieved.version, 2);
    }

    #[test]
    fn test_update_nonexistent_fails() {
        let registry = SpecRegistry::new();
        let spec = make_spec("view-1", 1);

        let result = registry.update(spec);

        assert!(matches!(result, Err(RuntimeError::SpecNotFound(_))));
    }

    #[test]
    fn test_upsert_insert() {
        let registry = SpecRegistry::new();
        let spec = make_spec("view-1", 1);

        let old = registry.upsert(spec).unwrap();
        assert!(old.is_none());

        assert_eq!(registry.len().unwrap(), 1);
    }

    #[test]
    fn test_upsert_update() {
        let registry = SpecRegistry::new();
        let spec1 = make_spec("view-1", 1);
        let spec2 = make_spec("view-1", 2);

        registry.upsert(spec1).unwrap();
        let old = registry.upsert(spec2).unwrap();

        assert!(old.is_some());
        assert_eq!(old.unwrap().version, 1);
    }

    #[test]
    fn test_remove() {
        let registry = SpecRegistry::new();
        let spec = make_spec("view-1", 1);

        registry.register(spec).unwrap();
        let removed = registry.remove(&ViewId::new("view-1")).unwrap();

        assert!(removed.is_some());
        assert!(registry.is_empty().unwrap());
    }

    #[test]
    fn test_remove_nonexistent() {
        let registry = SpecRegistry::new();

        let removed = registry.remove(&ViewId::new("view-1")).unwrap();

        assert!(removed.is_none());
    }

    #[test]
    fn test_contains() {
        let registry = SpecRegistry::new();
        let spec = make_spec("view-1", 1);

        assert!(!registry.contains(&ViewId::new("view-1")).unwrap());

        registry.register(spec).unwrap();

        assert!(registry.contains(&ViewId::new("view-1")).unwrap());
    }

    #[test]
    fn test_list() {
        let registry = SpecRegistry::new();

        for i in 0..5 {
            registry.register(make_spec(&format!("view-{}", i), 1)).unwrap();
        }

        let all = registry.list().unwrap();
        assert_eq!(all.len(), 5);
    }

    #[test]
    fn test_list_by_assemblage() {
        let registry = SpecRegistry::new();

        registry.register(make_spec_with_assemblage("v1", "fleet-a")).unwrap();
        registry.register(make_spec_with_assemblage("v2", "fleet-a")).unwrap();
        registry.register(make_spec_with_assemblage("v3", "fleet-b")).unwrap();

        let fleet_a = registry.list_by_assemblage(&AssemblageId::new("fleet-a")).unwrap();
        assert_eq!(fleet_a.len(), 2);

        let fleet_b = registry.list_by_assemblage(&AssemblageId::new("fleet-b")).unwrap();
        assert_eq!(fleet_b.len(), 1);
    }

    #[test]
    fn test_list_by_tag() {
        let registry = SpecRegistry::new();

        registry.register(make_spec_with_tag("v1", "env", "prod")).unwrap();
        registry.register(make_spec_with_tag("v2", "env", "prod")).unwrap();
        registry.register(make_spec_with_tag("v3", "env", "staging")).unwrap();

        let prod = registry.list_by_tag("env", "prod").unwrap();
        assert_eq!(prod.len(), 2);

        let staging = registry.list_by_tag("env", "staging").unwrap();
        assert_eq!(staging.len(), 1);
    }

    #[test]
    fn test_view_ids() {
        let registry = SpecRegistry::new();

        registry.register(make_spec("view-a", 1)).unwrap();
        registry.register(make_spec("view-b", 1)).unwrap();
        registry.register(make_spec("view-c", 1)).unwrap();

        let ids = registry.view_ids().unwrap();
        assert_eq!(ids.len(), 3);
    }

    #[test]
    fn test_clear() {
        let registry = SpecRegistry::new();

        for i in 0..5 {
            registry.register(make_spec(&format!("view-{}", i), 1)).unwrap();
        }

        assert_eq!(registry.len().unwrap(), 5);

        registry.clear().unwrap();

        assert!(registry.is_empty().unwrap());
    }

    #[test]
    fn test_default() {
        let registry = SpecRegistry::default();
        assert!(registry.is_empty().unwrap());
    }

    #[test]
    fn test_clone_independence() {
        let registry1 = SpecRegistry::new();
        registry1.register(make_spec("view-1", 1)).unwrap();

        let registry2 = registry1.clone();
        registry1.register(make_spec("view-2", 1)).unwrap();

        // Clones share the underlying data (Arc)
        assert_eq!(registry2.len().unwrap(), 2);
    }

    #[test]
    fn test_concurrent_access() {
        use std::thread;

        let registry = SpecRegistry::new();
        let mut handles = vec![];

        // Spawn writers
        for i in 0..10 {
            let r = registry.clone();
            handles.push(thread::spawn(move || {
                r.register(make_spec(&format!("view-{}", i), 1)).unwrap();
            }));
        }

        // Wait for all writes
        for h in handles {
            h.join().unwrap();
        }

        assert_eq!(registry.len().unwrap(), 10);

        // Spawn readers
        let mut handles = vec![];
        for _ in 0..10 {
            let r = registry.clone();
            handles.push(thread::spawn(move || {
                let _ = r.list().unwrap();
            }));
        }

        for h in handles {
            h.join().unwrap();
        }
    }
}
