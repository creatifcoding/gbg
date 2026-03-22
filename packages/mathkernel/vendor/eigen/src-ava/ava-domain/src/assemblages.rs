//! Assemblage Types
//!
//! Assemblages are view filter predicates that gate which views apply to which assets.
//! They define the "rails" for valid view configurations.

use serde::{Deserialize, Serialize};
use typeshare::typeshare;
use std::collections::HashMap;

use crate::ids::{AssemblageId, ViewId};

/// Predicate operator for assemblage matching
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
    And { predicates: Vec<AssemblagePredicate> },
    Or { predicates: Vec<AssemblagePredicate> },
    Not { predicate: Box<AssemblagePredicate> },
    Always,
    Never,
}

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

/// Constraint on view composition within an assemblage
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "constraint", content = "content")]
pub enum AssemblageConstraint {
    RequiredChannels { roles: Vec<String> },
    MaxConcurrentViews { count: u32 },
    RequiredMaterialization { tier: String },
    CostEnvelope { max_cost_units: u32 },
    AllowedSources { kinds: Vec<String> },
}

/// Complete assemblage specification
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssemblageSpec {
    pub id: AssemblageId,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub domain: String,
    pub predicate: AssemblagePredicate,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub constraints: Vec<AssemblageConstraint>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub admissible_views: Vec<ViewId>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub metadata: HashMap<String, String>,
}

impl AssemblageSpec {
    pub fn is_view_admissible(&self, view_id: &ViewId) -> bool {
        self.admissible_views.is_empty() || self.admissible_views.contains(view_id)
    }
}

/// Assemblage membership result
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssemblageMembership {
    pub assemblage_id: AssemblageId,
    pub is_member: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_predicate_composition() {
        let p1 = AssemblagePredicate::AssetType { type_name: "Truck".into() };
        let p2 = AssemblagePredicate::HasTrait { trait_name: "gps-enabled".into() };

        let combined = AssemblagePredicate::and(vec![p1.clone(), p2.clone()]);

        match combined {
            AssemblagePredicate::And { predicates } => assert_eq!(predicates.len(), 2),
            _ => panic!("Expected And predicate"),
        }

        let negated = AssemblagePredicate::not(p1);
        match negated {
            AssemblagePredicate::Not { .. } => {}
            _ => panic!("Expected Not predicate"),
        }
    }

    #[test]
    fn test_assemblage_spec_serialization() {
        let spec = AssemblageSpec {
            id: AssemblageId::new("wms-trucks"),
            name: "WMS Trucks".into(),
            description: Some("All trucks in warehouse management".into()),
            domain: "wms".into(),
            predicate: AssemblagePredicate::and(vec![
                AssemblagePredicate::AssetType { type_name: "Truck".into() },
                AssemblagePredicate::InSite { site_id: "warehouse-1".into() },
            ]),
            constraints: vec![AssemblageConstraint::RequiredChannels {
                roles: vec!["STATE".into(), "EVENT".into()],
            }],
            admissible_views: vec![ViewId::new("truck-dashboard"), ViewId::new("truck-telemetry")],
            metadata: HashMap::new(),
        };

        let json = serde_json::to_string_pretty(&spec).unwrap();
        let parsed: AssemblageSpec = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, spec.id);
        assert!(parsed.is_view_admissible(&ViewId::new("truck-dashboard")));
        assert!(!parsed.is_view_admissible(&ViewId::new("other-view")));
    }
}
