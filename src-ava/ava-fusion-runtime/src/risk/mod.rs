//! Risk accumulation and temporal decay runtime.
//!
//! Provides computational functions that consume types from `ava_fusion::risk`:
//!
//! - **accumulation**: Leaky NoisyOr, NoisyMAX ordinal, convergence bonus
//! - **decay**: Apply `DecayModel` to indicator scores, evict below threshold
//! - **cusum**: CUSUM change-point detection for risk trend monitoring
//! - **alert_suppression**: 4-layer alert fatigue suppression

pub mod accumulation;
pub mod alert_suppression;
pub mod cusum;
pub mod decay;
