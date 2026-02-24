//! Branded newtypes for the fusion domain.
//!
//! Every identifier is a transparent `String` wrapper with `new()` and
//! `as_str()` convenience methods, following the ava-domain newtype pattern.
//!
//! [`FusionCapability`] mirrors the asupersync `CapSet` boolean fields
//! (SPAWN, TIME, RANDOM, IO, REMOTE) as a serde-friendly enum projection.
//! [`FusionObligationId`] mirrors asupersync's `ObligationId`.

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Macro: branded string newtype
// ---------------------------------------------------------------------------

macro_rules! branded_id {
    (
        $(#[doc = $doc:expr])*
        $name:ident
    ) => {
        $(#[doc = $doc])*
        #[typeshare::typeshare]
        #[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
        #[serde(transparent)]
        pub struct $name(pub String);

        impl $name {
            pub fn new(id: impl Into<String>) -> Self {
                Self(id.into())
            }

            pub fn as_str(&self) -> &str {
                &self.0
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str(&self.0)
            }
        }

        impl FromStr for $name {
            type Err = std::convert::Infallible;

            fn from_str(s: &str) -> Result<Self, Self::Err> {
                Ok(Self(s.to_owned()))
            }
        }
    };
}

// ---------------------------------------------------------------------------
// Domain identifiers
// ---------------------------------------------------------------------------

branded_id! {
    /// Globally unique identifier for a tracked entity (aircraft, vessel, host, etc.).
    EntityId
}

branded_id! {
    /// Identifier for a fused track that aggregates observations over time.
    TrackId
}

branded_id! {
    /// Identifier for a declared join path in the fusion ontology.
    JoinPathId
}

branded_id! {
    /// Identifier for a signal source (adapter, sensor, feed).
    SignalSourceId
}

branded_id! {
    /// Identifier for a sequence pattern definition (R9).
    SequencePatternId
}

branded_id! {
    /// Identifier for a risk profile attached to an entity (R3).
    RiskProfileId
}

branded_id! {
    /// Mirrors asupersync `ObligationId` — identifies a resource obligation
    /// that must be resolved before its owning region can close.
    FusionObligationId
}

// ---------------------------------------------------------------------------
// FusionCapability — asupersync CapSet projection
// ---------------------------------------------------------------------------

/// Projection of asupersync's `CapSet<SPAWN, TIME, RANDOM, IO, REMOTE>`
/// const-generic booleans into a serde-friendly enum for TypeScript/WASM
/// consumers.
///
/// Each variant maps 1:1 to a `CapSet` boolean field.
#[typeshare::typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FusionCapability {
    /// Permission to spawn tasks and regions.
    Spawn,
    /// Permission to use timers and timeouts.
    Time,
    /// Permission to access entropy / random values.
    Random,
    /// Permission for asynchronous I/O operations.
    Io,
    /// Permission for remote task spawning.
    Remote,
}

impl FusionCapability {
    /// All capability variants in declaration order.
    pub const ALL: [FusionCapability; 5] = [
        FusionCapability::Spawn,
        FusionCapability::Time,
        FusionCapability::Random,
        FusionCapability::Io,
        FusionCapability::Remote,
    ];
}

impl fmt::Display for FusionCapability {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FusionCapability::Spawn => f.write_str("SPAWN"),
            FusionCapability::Time => f.write_str("TIME"),
            FusionCapability::Random => f.write_str("RANDOM"),
            FusionCapability::Io => f.write_str("IO"),
            FusionCapability::Remote => f.write_str("REMOTE"),
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------------
    // Serde roundtrip: branded IDs
    // -----------------------------------------------------------------------

    macro_rules! test_id_serde {
        ($name:ident, $ty:ty) => {
            #[test]
            fn $name() {
                let id = <$ty>::new("test-value-123");
                let json = serde_json::to_string(&id).unwrap();
                // transparent serde: serializes as a plain string
                assert_eq!(json, "\"test-value-123\"");
                let parsed: $ty = serde_json::from_str(&json).unwrap();
                assert_eq!(parsed, id);
            }
        };
    }

    test_id_serde!(entity_id_serde, EntityId);
    test_id_serde!(track_id_serde, TrackId);
    test_id_serde!(join_path_id_serde, JoinPathId);
    test_id_serde!(signal_source_id_serde, SignalSourceId);
    test_id_serde!(sequence_pattern_id_serde, SequencePatternId);
    test_id_serde!(risk_profile_id_serde, RiskProfileId);
    test_id_serde!(fusion_obligation_id_serde, FusionObligationId);

    // -----------------------------------------------------------------------
    // Display / FromStr roundtrip
    // -----------------------------------------------------------------------

    macro_rules! test_id_display {
        ($name:ident, $ty:ty) => {
            #[test]
            fn $name() {
                let id = <$ty>::new("my-entity");
                assert_eq!(id.to_string(), "my-entity");
                let parsed: $ty = "my-entity".parse().unwrap();
                assert_eq!(parsed, id);
            }
        };
    }

    test_id_display!(entity_id_display, EntityId);
    test_id_display!(track_id_display, TrackId);
    test_id_display!(join_path_id_display, JoinPathId);
    test_id_display!(signal_source_id_display, SignalSourceId);
    test_id_display!(sequence_pattern_id_display, SequencePatternId);
    test_id_display!(risk_profile_id_display, RiskProfileId);
    test_id_display!(fusion_obligation_id_display, FusionObligationId);

    // -----------------------------------------------------------------------
    // as_str accessor
    // -----------------------------------------------------------------------

    #[test]
    fn entity_id_as_str() {
        let id = EntityId::new("abc");
        assert_eq!(id.as_str(), "abc");
    }

    // -----------------------------------------------------------------------
    // FusionCapability serde
    // -----------------------------------------------------------------------

    #[test]
    fn capability_serde_screaming_snake() {
        for cap in FusionCapability::ALL {
            let json = serde_json::to_string(&cap).unwrap();
            let parsed: FusionCapability = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, cap);
        }
        // Verify exact serialization for one variant
        let json = serde_json::to_string(&FusionCapability::Spawn).unwrap();
        assert_eq!(json, "\"SPAWN\"");
    }

    #[test]
    fn capability_all_variants_roundtrip() {
        let variants = [
            FusionCapability::Spawn,
            FusionCapability::Time,
            FusionCapability::Random,
            FusionCapability::Io,
            FusionCapability::Remote,
        ];
        for v in variants {
            let json = serde_json::to_string(&v).unwrap();
            let parsed: FusionCapability = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, v);
        }
    }

    #[test]
    fn capability_display() {
        assert_eq!(FusionCapability::Spawn.to_string(), "SPAWN");
        assert_eq!(FusionCapability::Time.to_string(), "TIME");
        assert_eq!(FusionCapability::Random.to_string(), "RANDOM");
        assert_eq!(FusionCapability::Io.to_string(), "IO");
        assert_eq!(FusionCapability::Remote.to_string(), "REMOTE");
    }

    #[test]
    fn capability_copy_semantics() {
        let a = FusionCapability::Io;
        let b = a;
        assert_eq!(a, b);
    }

    // -----------------------------------------------------------------------
    // Hash consistency
    // -----------------------------------------------------------------------

    #[test]
    fn entity_id_hash_consistent() {
        use std::collections::HashSet;
        let mut set = HashSet::new();
        set.insert(EntityId::new("x"));
        set.insert(EntityId::new("x"));
        assert_eq!(set.len(), 1);
    }
}
