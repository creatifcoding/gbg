//! AVA WASM Bindings
//!
//! Provides WebAssembly bindings for AVA domain types and operations.
//! These types mirror ava-domain but are WASM-compatible (no Arrow dependency).
//!
//! # Architecture
//!
//! ```text
//! TypeScript (Effect-TS)
//!         │
//!         ▼
//!    wasm-bindgen
//!         │
//!         ▼
//!    ava-wasm (this crate)
//!         │
//!         ▼
//!    JSON serialization
//! ```

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use js_sys::Promise;

// ============================================================================
// Domain Types (WASM-compatible mirrors of ava-domain)
// ============================================================================

/// View profile specification - the "blueprint" for a view
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewProfileSpec {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub assemblage_id: String,
    pub version: u32,
}

/// Channel role enumeration
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ChannelRole {
    State,
    Event,
    Metric,
    Command,
    Log,
}

/// View artifact - a concrete, instantiated view
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewArtifact {
    pub view_id: String,
    pub asset_id: Option<String>,
    pub created_at_ms: f64,
    pub logical_version: u32,
}

/// Reconciler event types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "content", rename_all = "camelCase")]
pub enum ReconcilerEvent {
    ViewRequested {
        view_id: String,
        timestamp_ms: f64,
    },
    ViewMounted {
        view_id: String,
        timestamp_ms: f64,
    },
    ViewUnmounted {
        view_id: String,
        reason: String,
        timestamp_ms: f64,
    },
}

// ============================================================================
// WASM Bindings
// ============================================================================

/// Initialize the WASM module (call once on load)
#[wasm_bindgen(start)]
pub fn init() {
    // Set panic hook for better error messages in browser console
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// AVA Client - main entry point for TypeScript
#[wasm_bindgen]
pub struct AvaClient {
    views: Vec<ViewArtifact>,
    event_log: Vec<ReconcilerEvent>,
}

#[wasm_bindgen]
impl AvaClient {
    /// Create a new AVA client
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            views: Vec::new(),
            event_log: Vec::new(),
        }
    }

    /// Request a view by spec (JSON string)
    #[wasm_bindgen(js_name = requestView)]
    pub fn request_view(&mut self, spec_json: &str) -> Result<String, JsError> {
        let spec: ViewProfileSpec = serde_json::from_str(spec_json)
            .map_err(|e| JsError::new(&format!("Invalid spec JSON: {}", e)))?;

        // Create artifact
        let artifact = ViewArtifact {
            view_id: spec.id.clone(),
            asset_id: None,
            created_at_ms: js_sys::Date::now(),
            logical_version: spec.version,
        };

        // Log event
        self.event_log.push(ReconcilerEvent::ViewRequested {
            view_id: spec.id.clone(),
            timestamp_ms: js_sys::Date::now(),
        });

        self.event_log.push(ReconcilerEvent::ViewMounted {
            view_id: spec.id.clone(),
            timestamp_ms: js_sys::Date::now(),
        });

        self.views.push(artifact.clone());

        serde_json::to_string(&artifact)
            .map_err(|e| JsError::new(&format!("Serialization error: {}", e)))
    }

    /// Get all mounted views (JSON array)
    #[wasm_bindgen(js_name = getViews)]
    pub fn get_views(&self) -> Result<String, JsError> {
        serde_json::to_string(&self.views)
            .map_err(|e| JsError::new(&format!("Serialization error: {}", e)))
    }

    /// Get event log (JSON array)
    #[wasm_bindgen(js_name = getEventLog)]
    pub fn get_event_log(&self) -> Result<String, JsError> {
        serde_json::to_string(&self.event_log)
            .map_err(|e| JsError::new(&format!("Serialization error: {}", e)))
    }

    /// Unmount a view by ID
    #[wasm_bindgen(js_name = unmountView)]
    pub fn unmount_view(&mut self, view_id: &str) -> Result<bool, JsError> {
        let initial_len = self.views.len();
        self.views.retain(|v| v.view_id != view_id);

        if self.views.len() < initial_len {
            self.event_log.push(ReconcilerEvent::ViewUnmounted {
                view_id: view_id.to_string(),
                reason: "client_request".to_string(),
                timestamp_ms: js_sys::Date::now(),
            });
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Get view count
    #[wasm_bindgen(js_name = viewCount)]
    pub fn view_count(&self) -> usize {
        self.views.len()
    }
}

/// Parse a ViewProfileSpec from JSON (standalone function)
#[wasm_bindgen(js_name = parseViewSpec)]
pub fn parse_view_spec(json: &str) -> Result<JsValue, JsError> {
    let spec: ViewProfileSpec = serde_json::from_str(json)
        .map_err(|e| JsError::new(&format!("Parse error: {}", e)))?;

    serde_wasm_bindgen::to_value(&spec)
        .map_err(|e| JsError::new(&format!("Conversion error: {}", e)))
}

/// Validate a ViewProfileSpec JSON (returns validation errors if any)
#[wasm_bindgen(js_name = validateViewSpec)]
pub fn validate_view_spec(json: &str) -> Result<JsValue, JsError> {
    let result: Result<ViewProfileSpec, _> = serde_json::from_str(json);

    match result {
        Ok(_) => Ok(JsValue::NULL),
        Err(e) => {
            let errors = vec![format!("Validation error: {}", e)];
            serde_wasm_bindgen::to_value(&errors)
                .map_err(|e| JsError::new(&format!("Conversion error: {}", e)))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: test_client_lifecycle requires WASM target due to js_sys::Date::now()
    // Run with: wasm-pack test --node

    #[test]
    fn test_parse_view_spec() {
        let json = r#"{"id":"v1","name":"Test View","assemblageId":"a1","version":1}"#;
        let spec: ViewProfileSpec = serde_json::from_str(json).unwrap();
        assert_eq!(spec.id, "v1");
        assert_eq!(spec.name, "Test View");
    }

    #[test]
    fn test_reconciler_event_serialization() {
        let event = ReconcilerEvent::ViewMounted {
            view_id: "v1".to_string(),
            timestamp_ms: 1234567890.0,
        };

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("viewMounted"));
        assert!(json.contains("v1"));
    }

    #[test]
    fn test_view_artifact_serialization() {
        let artifact = ViewArtifact {
            view_id: "v1".to_string(),
            asset_id: Some("asset-1".to_string()),
            created_at_ms: 1234567890.0,
            logical_version: 1,
        };

        let json = serde_json::to_string(&artifact).unwrap();
        assert!(json.contains("viewId"));
        assert!(json.contains("v1"));
        assert!(json.contains("assetId"));
    }

    #[test]
    fn test_channel_role_serialization() {
        let role = ChannelRole::State;
        let json = serde_json::to_string(&role).unwrap();
        assert_eq!(json, "\"STATE\"");

        let role2 = ChannelRole::Event;
        let json2 = serde_json::to_string(&role2).unwrap();
        assert_eq!(json2, "\"EVENT\"");
    }
}

// ============================================================================
// Async Operations (E6: WASM async runtime spike)
// ============================================================================

/// Async view request - demonstrates wasm-bindgen-futures
/// Returns a Promise that resolves to the artifact JSON
#[wasm_bindgen(js_name = requestViewAsync)]
pub async fn request_view_async(spec_json: String) -> Result<String, JsError> {
    // Parse the spec
    let spec: ViewProfileSpec = serde_json::from_str(&spec_json)
        .map_err(|e| JsError::new(&format!("Invalid spec JSON: {}", e)))?;

    // Simulate async operation (in real impl, this would query DataFusion)
    // Using a simple delay via Promise
    let promise = Promise::new(&mut |resolve, _reject| {
        // Immediately resolve for now
        resolve.call1(&JsValue::NULL, &JsValue::TRUE).unwrap();
    });

    // Await the promise
    let _ = JsFuture::from(promise).await
        .map_err(|e| JsError::new(&format!("Promise rejected: {:?}", e)))?;

    // Create artifact
    let artifact = ViewArtifact {
        view_id: spec.id.clone(),
        asset_id: None,
        created_at_ms: js_sys::Date::now(),
        logical_version: spec.version,
    };

    serde_json::to_string(&artifact)
        .map_err(|e| JsError::new(&format!("Serialization error: {}", e)))
}

/// Async batch operation - process multiple specs concurrently
#[wasm_bindgen(js_name = requestViewsBatch)]
pub async fn request_views_batch(specs_json: String) -> Result<String, JsError> {
    let specs: Vec<ViewProfileSpec> = serde_json::from_str(&specs_json)
        .map_err(|e| JsError::new(&format!("Invalid specs JSON: {}", e)))?;

    let mut artifacts = Vec::new();

    for spec in specs {
        let artifact = ViewArtifact {
            view_id: spec.id.clone(),
            asset_id: None,
            created_at_ms: js_sys::Date::now(),
            logical_version: spec.version,
        };
        artifacts.push(artifact);
    }

    serde_json::to_string(&artifacts)
        .map_err(|e| JsError::new(&format!("Serialization error: {}", e)))
}

// WASM tests are in tests/wasm.rs - run with: wasm-pack test --node
