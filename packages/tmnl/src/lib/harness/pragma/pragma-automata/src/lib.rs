//! # pragma-automata
//!
//! FSM-based intent classification and annotation pipeline for PRAGMA.
//!
//! - Deterministic FSM intent classifier (DATA, FORM, LAYOUT, FEEDBACK, MIXED, IDLE)
//! - Ambiguity detection and disambiguation
//! - Annotation prefix block builder (JSON generation-context)

pub mod fsm;
pub mod ambiguity;
pub mod prefix;
