//! View Types
//!
//! Views are composable data lenses over multiple sources.
//! ViewProfileSpec defines the configuration, ViewArtifact is the runtime instance.
//!
//! # Hydration Model (Hybrid)
//!
//! AVA uses a hybrid hydration model:
//! - **Server-hydrated**: Streams, batches, inline JSON are populated server-side
//! - **Client-fetched**: Static assets (3D models, textures) return `AssetRef` for client fetch
//!
//! This balances efficiency (no round-trips for live data) with flexibility (client caches assets).

use serde::{Deserialize, Serialize};
use typeshare::typeshare;
use std::collections::HashMap;

use crate::ids::{AssetId, ViewId, ChannelId, AssemblageId};
use crate::channels::{ChannelPipelineSpec, ChannelRole};

// ============================================================================
// Channel Data (Hydration Payloads)
// ============================================================================

/// Hydrated channel data - the actual payload for a channel
///
/// This enum represents what gets delivered to the client for each channel.
/// Server decides which variant based on source type and hydration strategy.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type", content = "value")]
pub enum ChannelData {
    /// Inline JSON data (scalars, small objects, config)
    /// Server-hydrated, directly usable by client
    Inline(serde_json::Value),

    /// Tabular row data (query results, telemetry batches)
    /// Server-hydrated as JSON array of objects for portability
    /// Client can convert to typed arrays if needed
    Rows(Vec<serde_json::Value>),

    /// Reference to external asset (3D models, textures, large blobs)
    /// Client-fetched: server returns pointer, client fetches via URI
    AssetRef {
        /// URI to fetch the asset (s3://, https://, file://)
        uri: String,
        /// MIME type hint for client
        #[serde(skip_serializing_if = "Option::is_none")]
        mime_type: Option<String>,
        /// ETag for cache validation
        #[serde(skip_serializing_if = "Option::is_none")]
        etag: Option<String>,
        /// Content hash for integrity
        #[serde(skip_serializing_if = "Option::is_none")]
        content_hash: Option<String>,
    },

    /// Handle to active stream (real-time position, events)
    /// Client uses this to subscribe to ongoing updates
    StreamHandle {
        /// Topic/subject to subscribe to
        topic: String,
        /// Current cursor position (for resume)
        #[serde(skip_serializing_if = "Option::is_none")]
        cursor: Option<u64>,
        /// Schema hint for decoding
        #[serde(skip_serializing_if = "Option::is_none")]
        schema_uri: Option<String>,
    },

    /// Channel hydration failed
    Error {
        /// Error code for programmatic handling
        code: String,
        /// Human-readable message
        message: String,
        /// Whether this is retryable
        #[serde(default)]
        retryable: bool,
    },

    /// Channel not yet hydrated (pending)
    Pending,
}

/// View profile specification - the "blueprint" for a view
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewProfileSpec {
    pub id: ViewId,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub assemblage_id: AssemblageId,
    pub channels: Vec<ChannelPipelineSpec>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub tags: HashMap<String, String>,
    pub version: u32,
}

impl ViewProfileSpec {
    pub fn channel_by_role(&self, role: ChannelRole) -> Option<&ChannelPipelineSpec> {
        self.channels.iter().find(|c| c.role == role)
    }

    pub fn channel_by_id(&self, id: &ChannelId) -> Option<&ChannelPipelineSpec> {
        self.channels.iter().find(|c| &c.id == id)
    }
}

/// Binding of a channel to its compiled state and hydrated data
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelBinding {
    /// Channel identifier
    pub channel_id: ChannelId,
    /// Role this channel plays (state, event, metrics, etc.)
    pub role: ChannelRole,
    /// Whether the channel is currently active/connected
    pub active: bool,
    /// Row count for tabular data (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub row_count: Option<u32>,
    /// Last update timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_updated_ms: Option<f64>,
    /// Hydrated data payload (populated by HydrationService)
    /// None = not yet hydrated, Some(Pending) = hydration in progress
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<ChannelData>,
}

impl ChannelBinding {
    /// Check if channel has been hydrated with actual data
    pub fn is_hydrated(&self) -> bool {
        matches!(&self.data, Some(d) if !matches!(d, ChannelData::Pending))
    }

    /// Check if channel hydration failed
    pub fn has_error(&self) -> bool {
        matches!(&self.data, Some(ChannelData::Error { .. }))
    }

    /// Get data if hydrated successfully (not pending, not error)
    pub fn hydrated_data(&self) -> Option<&ChannelData> {
        match &self.data {
            Some(ChannelData::Pending) => None,
            Some(ChannelData::Error { .. }) => None,
            Some(data) => Some(data),
            None => None,
        }
    }
}

/// View artifact - a concrete, instantiated view at a logical version
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewArtifact {
    pub view_id: ViewId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<AssetId>,
    pub spec: ViewProfileSpec,
    pub channel_bindings: Vec<ChannelBinding>,
    pub created_at_ms: f64,
    pub logical_version: u32,
}

impl ViewArtifact {
    pub fn binding(&self, channel_id: &ChannelId) -> Option<&ChannelBinding> {
        self.channel_bindings.iter().find(|b| &b.channel_id == channel_id)
    }

    pub fn all_channels_active(&self) -> bool {
        self.channel_bindings.iter().all(|b| b.active)
    }
}

/// Delta representing changes to a view artifact
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type", content = "content")]
pub enum ViewDelta {
    ChannelUpdated { channel_id: ChannelId, row_count: u32, timestamp_ms: f64 },
    ChannelActivated { channel_id: ChannelId },
    ChannelDeactivated { channel_id: ChannelId },
    ArtifactReplaced { artifact: Box<ViewArtifact> },
}

/// View family - a collection of related view profiles
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewFamily {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub members: Vec<ViewId>,
    pub domain: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::channels::{SourceSpec, SourceKind, MaterializationTier};
    use crate::ids::SourceId;

    fn make_test_spec() -> ViewProfileSpec {
        ViewProfileSpec {
            id: ViewId::new("view-1"),
            name: "Test View".into(),
            description: Some("A test view".into()),
            assemblage_id: AssemblageId::new("test-assemblage"),
            channels: vec![ChannelPipelineSpec {
                id: ChannelId::new("state"),
                role: ChannelRole::State,
                source: SourceSpec {
                    id: SourceId::new("db"),
                    kind: SourceKind::Sql,
                    connection: "sqlite::memory:".into(),
                    schema: None,
                },
                additional_sources: vec![],
                pipeline: vec![],
                materialization: MaterializationTier::OnDemand,
                refresh_ms: None,
            }],
            tags: HashMap::new(),
            version: 1,
        }
    }

    #[test]
    fn test_view_profile_spec_channel_lookup() {
        let spec = make_test_spec();
        assert!(spec.channel_by_role(ChannelRole::State).is_some());
        assert!(spec.channel_by_role(ChannelRole::Event).is_none());
        assert!(spec.channel_by_id(&ChannelId::new("state")).is_some());
    }

    #[test]
    fn test_view_artifact_serialization() {
        let spec = make_test_spec();
        let artifact = ViewArtifact {
            view_id: ViewId::new("artifact-1"),
            asset_id: Some(AssetId::new("asset-123")),
            spec,
            channel_bindings: vec![ChannelBinding {
                channel_id: ChannelId::new("state"),
                role: ChannelRole::State,
                active: true,
                row_count: Some(100),
                last_updated_ms: Some(1234567890.0),
                data: None,
            }],
            created_at_ms: 1234567890.0,
            logical_version: 1,
        };

        let json = serde_json::to_string(&artifact).unwrap();
        let parsed: ViewArtifact = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.view_id, artifact.view_id);
        assert!(parsed.all_channels_active());
    }

    // ========================================================================
    // ChannelData Tests
    // ========================================================================

    #[test]
    fn test_channel_data_inline_serialization() {
        let data = ChannelData::Inline(serde_json::json!({
            "temperature": 72.5,
            "unit": "fahrenheit"
        }));

        let json = serde_json::to_string(&data).unwrap();
        assert!(json.contains("\"type\":\"inline\""));

        let parsed: ChannelData = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, data);
    }

    #[test]
    fn test_channel_data_rows_serialization() {
        let data = ChannelData::Rows(vec![
            serde_json::json!({"id": 1, "name": "Alice"}),
            serde_json::json!({"id": 2, "name": "Bob"}),
        ]);

        let json = serde_json::to_string(&data).unwrap();
        assert!(json.contains("\"type\":\"rows\""));

        let parsed: ChannelData = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, data);
    }

    #[test]
    fn test_channel_data_asset_ref_serialization() {
        let data = ChannelData::AssetRef {
            uri: "s3://models/truck.glb".into(),
            mime_type: Some("model/gltf-binary".into()),
            etag: Some("abc123".into()),
            content_hash: None,
        };

        let json = serde_json::to_string(&data).unwrap();
        assert!(json.contains("\"type\":\"assetRef\""));
        assert!(json.contains("truck.glb"));

        let parsed: ChannelData = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, data);
    }

    #[test]
    fn test_channel_data_stream_handle_serialization() {
        let data = ChannelData::StreamHandle {
            topic: "vehicle.position.42".into(),
            cursor: Some(12345),
            schema_uri: Some("schema://vehicle/position/v1".into()),
        };

        let json = serde_json::to_string(&data).unwrap();
        assert!(json.contains("\"type\":\"streamHandle\""));
        assert!(json.contains("vehicle.position.42"));

        let parsed: ChannelData = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, data);
    }

    #[test]
    fn test_channel_data_error_serialization() {
        let data = ChannelData::Error {
            code: "SOURCE_UNAVAILABLE".into(),
            message: "Database connection timeout".into(),
            retryable: true,
        };

        let json = serde_json::to_string(&data).unwrap();
        assert!(json.contains("\"type\":\"error\""));
        assert!(json.contains("SOURCE_UNAVAILABLE"));

        let parsed: ChannelData = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, data);
    }

    #[test]
    fn test_channel_binding_hydration_helpers() {
        // Not hydrated
        let binding = ChannelBinding {
            channel_id: ChannelId::new("test"),
            role: ChannelRole::State,
            active: true,
            row_count: None,
            last_updated_ms: None,
            data: None,
        };
        assert!(!binding.is_hydrated());
        assert!(!binding.has_error());
        assert!(binding.hydrated_data().is_none());

        // Pending
        let binding_pending = ChannelBinding {
            data: Some(ChannelData::Pending),
            ..binding.clone()
        };
        assert!(!binding_pending.is_hydrated());

        // Hydrated with data
        let binding_hydrated = ChannelBinding {
            data: Some(ChannelData::Inline(serde_json::json!(42))),
            ..binding.clone()
        };
        assert!(binding_hydrated.is_hydrated());
        assert!(binding_hydrated.hydrated_data().is_some());

        // Error state
        let binding_error = ChannelBinding {
            data: Some(ChannelData::Error {
                code: "ERR".into(),
                message: "fail".into(),
                retryable: false,
            }),
            ..binding
        };
        assert!(binding_error.has_error());
        assert!(binding_error.hydrated_data().is_none());
    }

    #[test]
    fn test_hydrated_artifact_serialization() {
        let spec = make_test_spec();
        let artifact = ViewArtifact {
            view_id: ViewId::new("truck-42"),
            asset_id: None,
            spec,
            channel_bindings: vec![
                ChannelBinding {
                    channel_id: ChannelId::new("geometry"),
                    role: ChannelRole::State,
                    active: true,
                    row_count: None,
                    last_updated_ms: None,
                    data: Some(ChannelData::AssetRef {
                        uri: "s3://models/freightliner.glb".into(),
                        mime_type: Some("model/gltf-binary".into()),
                        etag: None,
                        content_hash: None,
                    }),
                },
                ChannelBinding {
                    channel_id: ChannelId::new("position"),
                    role: ChannelRole::Event,
                    active: true,
                    row_count: None,
                    last_updated_ms: Some(1234567890.0),
                    data: Some(ChannelData::StreamHandle {
                        topic: "vehicle.position.42".into(),
                        cursor: Some(999),
                        schema_uri: None,
                    }),
                },
            ],
            created_at_ms: 1234567890.0,
            logical_version: 1,
        };

        let json = serde_json::to_string_pretty(&artifact).unwrap();

        // Verify it serializes correctly
        assert!(json.contains("assetRef"));
        assert!(json.contains("streamHandle"));
        assert!(json.contains("freightliner.glb"));
        assert!(json.contains("vehicle.position.42"));

        // Verify round-trip
        let parsed: ViewArtifact = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.channel_bindings.len(), 2);
        assert!(parsed.channel_bindings[0].is_hydrated());
        assert!(parsed.channel_bindings[1].is_hydrated());
    }
}
