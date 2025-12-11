//! View Types
//!
//! Views are composable data lenses over multiple sources.
//! ViewProfileSpec defines the configuration, ViewArtifact is the runtime instance.

use serde::{Deserialize, Serialize};
use typeshare::typeshare;
use std::collections::HashMap;

use crate::ids::{AssetId, ViewId, ChannelId, AssemblageId};
use crate::channels::{ChannelPipelineSpec, ChannelRole};

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

/// Binding of a channel to its compiled state
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelBinding {
    pub channel_id: ChannelId,
    pub role: ChannelRole,
    pub active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub row_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_updated_ms: Option<f64>,
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
            }],
            created_at_ms: 1234567890.0,
            logical_version: 1,
        };

        let json = serde_json::to_string(&artifact).unwrap();
        let parsed: ViewArtifact = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.view_id, artifact.view_id);
        assert!(parsed.all_channels_active());
    }
}
