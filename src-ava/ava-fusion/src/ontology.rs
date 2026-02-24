//! Root ontology aggregator types.
//!
//! [`FusionOntology`] (v1) and [`FusionOntologyV2`] serve as the top-level
//! configuration structures for the fusion system. They reference all other
//! modules and provide the declarative layer between raw signal ingestion
//! and d2ts join execution.
//!
//! Source: TSGC-001 §6.2, TSGC-001-v2 §18.

use serde::{Deserialize, Serialize};
use typeshare::typeshare;

use crate::{
    AbsenceThresholds, BlockingDefaults, CalibrationConfig, CanonicalSequence,
    ConfidenceModel, CorrelationMatrix, DeadReckoningConfig, ESRConfig, EntityClassDef,
    JoinPathEntry, JoinPathEntryV2, PredicateWeights, ReferenceSource,
    RiskAccumulationMethod, RiskDecay, RiskThreshold, SequencePattern, SpoofingDiscount,
};

// ---------------------------------------------------------------------------
// IdentityResolverDef — identity resolution configuration
// ---------------------------------------------------------------------------

/// Definition of an identity resolver in the fusion ontology.
///
/// Resolvers bridge identifier namespaces (e.g. ICAO -> tail number,
/// MMSI -> vessel name).
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityResolverDef {
    /// Resolver identifier (e.g. "faa-registry-lookup").
    pub id: String,
    /// Source identifier namespace.
    pub from_namespace: String,
    /// Target identifier namespace.
    pub to_namespace: String,
    /// NATS subject for resolver requests.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nats_subject: Option<String>,
}

// ---------------------------------------------------------------------------
// FusionThresholds — global tuning parameters
// ---------------------------------------------------------------------------

/// Global threshold configuration for the fusion ontology.
///
/// Includes the fusion confidence floor and default predicate weights.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FusionThresholds {
    /// Minimum confidence for a fusion to be emitted (default 0.65).
    pub fusion_confidence: f64,
    /// Default predicate weights for soft-key fusion.
    pub predicate_weights: PredicateWeights,
}

impl Default for FusionThresholds {
    fn default() -> Self {
        Self {
            fusion_confidence: 0.65,
            predicate_weights: PredicateWeights::default(),
        }
    }
}

// ---------------------------------------------------------------------------
// FusionOntology — v1 root (TSGC-001 §6.2)
// ---------------------------------------------------------------------------

/// Root configuration for the fusion ontology (v1).
///
/// Defines the entity classes, join paths, identity resolvers, and
/// global thresholds that govern fusion behaviour. Each enabled
/// JoinPathEntry compiles to a d2ts operator in the dataflow graph.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FusionOntology {
    /// Ontology version (e.g. "1.0").
    pub version: String,
    /// Scenario name (e.g. "airfield-harbor-monitoring").
    pub scenario: String,
    /// Registered entity classes.
    pub entity_classes: Vec<EntityClassDef>,
    /// Declared join paths.
    pub join_paths: Vec<JoinPathEntry>,
    /// Identity resolvers.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub resolvers: Vec<IdentityResolverDef>,
    /// Global fusion thresholds.
    pub thresholds: FusionThresholds,
}

// ---------------------------------------------------------------------------
// FusionOntologyV2 — v2 root with all R1-R9 extensions
// ---------------------------------------------------------------------------

/// Root configuration for the fusion ontology (v2).
///
/// Extends v1 with R1-R9 amendment fields: temporal joins, blocking,
/// Tier 3 methods, absence detection, risk accumulation, sequence
/// patterns, confidence calibration, and reference data management.
///
/// Source: TSGC-001-v2 §18 (unified schema specification).
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FusionOntologyV2 {
    /// Ontology version (e.g. "2.0").
    pub version: String,
    /// Scenario name.
    pub scenario: String,

    // -- Inherited from v1 --
    /// Registered entity classes.
    pub entity_classes: Vec<EntityClassDef>,
    /// Declared join paths (v2 with extension fields).
    pub join_paths: Vec<JoinPathEntryV2>,
    /// Identity resolvers.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub resolvers: Vec<IdentityResolverDef>,
    /// Global fusion thresholds.
    pub thresholds: FusionThresholds,

    // -- R4: Confidence model --
    /// Confidence combination strategy.
    pub confidence_model: ConfidenceModel,
    /// Evidence correlation discount matrix (R4.2).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation_matrix: Option<CorrelationMatrix>,
    /// Correlation discount factor (default 0.3).
    pub correlation_discount_factor: f64,
    /// Spoofing-aware confidence degradation (R4.1).
    pub spoofing_discount: SpoofingDiscount,
    /// Confidence calibration configuration (R4.5).
    pub calibration: CalibrationConfig,

    // -- R5: Reference data --
    /// Registered reference data sources.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub reference_sources: Vec<ReferenceSource>,

    // -- R6: Blocking --
    /// Default blocking parameters.
    pub blocking_defaults: BlockingDefaults,

    // -- R2: Absence detection --
    /// Expected Signal Registry configuration.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_signals: Option<ESRConfig>,
    /// Absence severity thresholds.
    pub absence_thresholds: AbsenceThresholds,
    /// Dead reckoning configuration.
    pub dead_reckoning: DeadReckoningConfig,

    // -- R3: Risk accumulation --
    /// Risk classification thresholds.
    pub risk_thresholds: RiskThreshold,
    /// Risk indicator decay configuration.
    pub risk_decay: RiskDecay,
    /// Risk accumulation method.
    pub risk_method: RiskAccumulationMethod,

    // -- R9: Sequence patterns --
    /// Active sequence pattern definitions.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub sequence_patterns: Vec<SequencePattern>,
    /// Canonical (pre-built) sequences shipped with the system.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub canonical_sequences: Vec<CanonicalSequence>,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        DataType, EnabledState, EntityClass, FusionTier, IdentifierNamespace, JoinPathSide,
        JoinType, OutputType, SignalKind,
    };

    fn make_entity_class() -> EntityClassDef {
        EntityClassDef {
            entity_class: EntityClass::Aircraft,
            primary_namespace: IdentifierNamespace::IcaoHex,
            primary_signal: SignalKind::AdsB,
            supported_signals: vec![SignalKind::AdsB, SignalKind::Radar],
        }
    }

    fn make_resolver() -> IdentityResolverDef {
        IdentityResolverDef {
            id: "faa-lookup".into(),
            from_namespace: "ICAO hex".into(),
            to_namespace: "tail number".into(),
            nats_subject: Some("tsingou.resolve.faa.*".into()),
        }
    }

    fn make_v1_join_path() -> JoinPathEntry {
        JoinPathEntry {
            id: "adsb-x-adsb".into(),
            left: JoinPathSide {
                signal_kind: SignalKind::AdsB,
                key_path: "payload.icao".into(),
                data_type: DataType::Event,
            },
            right: JoinPathSide {
                signal_kind: SignalKind::AdsB,
                key_path: "payload.icao".into(),
                data_type: DataType::Event,
            },
            join_type: JoinType::Identity,
            tier: FusionTier::Tier1Kinematic,
            output: OutputType::FusedTrack,
            enabled: EnabledState::Enabled,
            resolver: None,
        }
    }

    fn make_v2_join_path() -> JoinPathEntryV2 {
        JoinPathEntryV2 {
            id: "adsb-x-ais".into(),
            left: JoinPathSide {
                signal_kind: SignalKind::AdsB,
                key_path: "metadata.geo".into(),
                data_type: DataType::Event,
            },
            right: JoinPathSide {
                signal_kind: SignalKind::Ais,
                key_path: "metadata.geo".into(),
                data_type: DataType::Event,
            },
            join_type: JoinType::Spatial,
            tier: FusionTier::Tier2Attribute,
            output: OutputType::CorrelatedPair,
            enabled: EnabledState::Enabled,
            resolver: None,
            blocking: None,
            temporal_window_ms: Some(10_000),
            late_arrival_policy: Some("drop".into()),
            confidence_model: None,
            tier3_method: None,
            join_mode: None,
        }
    }

    // -- IdentityResolverDef --

    #[test]
    fn identity_resolver_def_serde_roundtrip() {
        let rd = make_resolver();
        let json = serde_json::to_string(&rd).unwrap();
        assert!(json.contains("\"fromNamespace\""));
        assert!(json.contains("\"toNamespace\""));
        let parsed: IdentityResolverDef = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, rd);
    }

    #[test]
    fn identity_resolver_def_optional_nats() {
        let rd = IdentityResolverDef {
            id: "manual".into(),
            from_namespace: "MMSI".into(),
            to_namespace: "vessel name".into(),
            nats_subject: None,
        };
        let json = serde_json::to_string(&rd).unwrap();
        assert!(!json.contains("\"natsSubject\""));
    }

    // -- FusionThresholds --

    #[test]
    fn fusion_thresholds_default() {
        let t = FusionThresholds::default();
        assert!((t.fusion_confidence - 0.65).abs() < 1e-10);
    }

    // -- FusionOntology (v1) --

    #[test]
    fn fusion_ontology_v1_serde_roundtrip() {
        let ontology = FusionOntology {
            version: "1.0".into(),
            scenario: "airfield-harbor".into(),
            entity_classes: vec![make_entity_class()],
            join_paths: vec![make_v1_join_path()],
            resolvers: vec![make_resolver()],
            thresholds: FusionThresholds::default(),
        };
        let json = serde_json::to_string(&ontology).unwrap();
        assert!(json.contains("\"version\""));
        assert!(json.contains("\"scenario\""));
        assert!(json.contains("\"entityClasses\""));
        assert!(json.contains("\"joinPaths\""));
        let parsed: FusionOntology = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.version, "1.0");
        assert_eq!(parsed.entity_classes.len(), 1);
        assert_eq!(parsed.join_paths.len(), 1);
    }

    #[test]
    fn fusion_ontology_v1_empty_resolvers_omitted() {
        let ontology = FusionOntology {
            version: "1.0".into(),
            scenario: "test".into(),
            entity_classes: vec![],
            join_paths: vec![],
            resolvers: vec![],
            thresholds: FusionThresholds::default(),
        };
        let json = serde_json::to_string(&ontology).unwrap();
        assert!(!json.contains("\"resolvers\""));
    }

    // -- FusionOntologyV2 --

    #[test]
    fn fusion_ontology_v2_serde_roundtrip() {
        let ontology = FusionOntologyV2 {
            version: "2.0".into(),
            scenario: "airfield-harbor-v2".into(),
            entity_classes: vec![make_entity_class()],
            join_paths: vec![make_v2_join_path()],
            resolvers: vec![],
            thresholds: FusionThresholds::default(),
            confidence_model: ConfidenceModel::default(),
            correlation_matrix: Some(CorrelationMatrix::default()),
            correlation_discount_factor: 0.3,
            spoofing_discount: SpoofingDiscount::default(),
            calibration: CalibrationConfig::default(),
            reference_sources: vec![],
            blocking_defaults: BlockingDefaults::default(),
            expected_signals: None,
            absence_thresholds: AbsenceThresholds::default(),
            dead_reckoning: DeadReckoningConfig::default(),
            risk_thresholds: RiskThreshold::default(),
            risk_decay: RiskDecay::default(),
            risk_method: RiskAccumulationMethod::default(),
            sequence_patterns: vec![],
            canonical_sequences: vec![],
        };
        let json = serde_json::to_string(&ontology).unwrap();
        assert!(json.contains("\"confidenceModel\""));
        assert!(json.contains("\"correlationDiscountFactor\""));
        assert!(json.contains("\"blockingDefaults\""));
        assert!(json.contains("\"absenceThresholds\""));
        assert!(json.contains("\"riskThresholds\""));
        assert!(json.contains("\"riskMethod\""));
        // Empty vecs should be omitted
        assert!(!json.contains("\"resolvers\""));
        assert!(!json.contains("\"referenceSources\""));
        assert!(!json.contains("\"sequencePatterns\""));
        assert!(!json.contains("\"canonicalSequences\""));
        let parsed: FusionOntologyV2 = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.version, "2.0");
        assert_eq!(parsed.confidence_model, ConfidenceModel::WeightedAverage);
        assert!((parsed.correlation_discount_factor - 0.3).abs() < 1e-10);
    }
}
