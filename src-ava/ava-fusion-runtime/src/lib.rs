//! asupersync runtime integration for fusion pipeline actors.
//!
//! Bridges ava-fusion pure types to asupersync runtime primitives:
//! - Type conversion (FusionOutcome <-> Outcome, FusionBudget <-> Budget)
//! - GenServer actor implementations for 6 IIoT pipeline stages
//! - Supervision tree wiring
//! - NATS KV/Object Store atop JetStream

pub mod convert;
pub mod actors;
pub mod cep;
pub mod dataflow;
pub mod graph;
pub mod pipeline;
pub mod risk;
pub mod signal;
pub mod tracking;
pub mod nats_kv;
pub mod nats_object;
