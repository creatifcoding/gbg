//! Branded Identifier Types
//!
//! All identifiers are newtype wrappers around String for type safety.
//! Typeshare generates branded types in TypeScript.

use serde::{Deserialize, Serialize};
use typeshare::typeshare;

/// Unique identifier for an Asset (external to AVA, lives in AMS)
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct AssetId(pub String);

impl AssetId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Unique identifier for a View
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ViewId(pub String);

impl ViewId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Unique identifier for a Channel within a View
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ChannelId(pub String);

impl ChannelId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Unique identifier for an Assemblage
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct AssemblageId(pub String);

impl AssemblageId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Unique identifier for a Source (data provider)
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct SourceId(pub String);

impl SourceId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Logical sequence number for event ordering
/// Serialized as String for TypeScript (preserves u64 precision)
#[typeshare(serialized_as = "String")]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct EventSequence(pub u64);

impl EventSequence {
    pub fn new(seq: u64) -> Self {
        Self(seq)
    }

    pub fn next(&self) -> Self {
        Self(self.0 + 1)
    }
}

impl Default for EventSequence {
    fn default() -> Self {
        Self(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_asset_id_serialization() {
        let id = AssetId::new("asset-123");
        let json = serde_json::to_string(&id).unwrap();
        assert_eq!(json, "\"asset-123\"");

        let parsed: AssetId = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, id);
    }

    #[test]
    fn test_event_sequence_ordering() {
        let seq1 = EventSequence::new(1);
        let seq2 = EventSequence::new(2);
        assert!(seq1 < seq2);
        assert_eq!(seq1.next(), seq2);
    }
}
