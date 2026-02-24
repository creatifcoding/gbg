//! Fusion ontology types (TSGC-001) for multi-source data fusion.
//!
//! Pure types crate — no runtime, no async, no tokio.
//! WASM-safe: serde + typeshare + thiserror only.
//!
//! Mirrors asupersync runtime types (FusionOutcome, FusionBudget, FusionObligationState)
//! as serde-friendly projections for TypeScript/WASM consumers.

#![forbid(unsafe_code)]

pub mod ids;
pub mod geo;
pub mod signal;
pub mod entity;
pub mod track;
pub mod confidence;
pub mod calibration;
pub mod temporal;
pub mod blocking;
pub mod tier3;
pub mod join_path;
pub mod absence;
pub mod risk;
pub mod sequence;
pub mod output;
pub mod ontology;

// Re-export all public types at crate root for convenience.
pub use ids::*;
pub use geo::*;
pub use signal::*;
pub use entity::*;
pub use track::*;
pub use confidence::*;
pub use calibration::*;
pub use temporal::*;
pub use blocking::*;
pub use tier3::*;
pub use join_path::*;
pub use absence::*;
pub use risk::*;
pub use sequence::*;
pub use output::*;
pub use ontology::*;
