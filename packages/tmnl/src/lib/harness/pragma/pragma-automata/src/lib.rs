//! # pragma-automata
//!
//! FSM-based intent classification and annotation pipeline for PRAGMA.
//!
//! - Deterministic FSM intent classifier (DATA, FORM, LAYOUT, FEEDBACK, MIXED, IDLE)
//! - Ambiguity detection and disambiguation
//! - Tiered model router (MiniLM hot path, bert-base deep path)
//! - Annotation prefix block builder (JSON generation-context)

// Modules will be populated in P4 implementation phase
// pub mod fsm;
// pub mod ambiguity;
// pub mod router;
// pub mod prefix;
// pub mod annotate;
