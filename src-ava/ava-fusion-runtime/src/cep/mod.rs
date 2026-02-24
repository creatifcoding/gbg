//! Complex Event Processing (CEP) engine.
//!
//! NFA-SASE implementation for temporal sequence pattern detection.
//! Consumes `SequencePattern` from `ava_fusion::sequence` and produces
//! `SequenceMatch` results.
//!
//! Architecture:
//!   - `SharedBuffer`: Arena-backed event storage (events stored once)
//!   - `evaluator`: Predicate expression compiler (AST + parser)
//!   - `NfaEngine`: Per-pattern NFA with Strict/Relaxed/NonDeterministic contiguity
//!   - `CepEngine`: Multi-pattern coordinator dispatching events to all active NFAs

pub mod evaluator;
pub mod nfa;
pub mod shared_buffer;

use ava_fusion::sequence::{SequenceMatch, SequencePattern};
use nfa::NfaEngine;
use shared_buffer::EventData;

// ---------------------------------------------------------------------------
// CepEngine — multi-pattern coordinator
// ---------------------------------------------------------------------------

/// Multi-pattern CEP engine.
///
/// Manages a registry of compiled NFA engines, dispatches incoming events
/// to all active patterns, and collects completed matches.
#[derive(Debug)]
pub struct CepEngine {
    /// Active NFA engines, one per registered pattern.
    engines: Vec<NfaEngine>,
}

impl CepEngine {
    /// Create an empty engine with no patterns.
    pub fn new() -> Self {
        Self {
            engines: Vec::new(),
        }
    }

    /// Register a sequence pattern.
    ///
    /// Compiles the pattern into an NFA engine. Only enabled patterns
    /// are registered. Returns `Err` if any predicate fails to parse.
    pub fn register(&mut self, pattern: SequencePattern) -> Result<(), String> {
        if !pattern.enabled {
            return Ok(());
        }
        let engine = NfaEngine::new(pattern)?;
        self.engines.push(engine);
        Ok(())
    }

    /// Register a pattern with a custom partial-match budget.
    pub fn register_with_budget(
        &mut self,
        pattern: SequencePattern,
        budget: usize,
    ) -> Result<(), String> {
        if !pattern.enabled {
            return Ok(());
        }
        let engine = NfaEngine::with_budget(pattern, budget)?;
        self.engines.push(engine);
        Ok(())
    }

    /// Process an event through all registered NFA engines.
    ///
    /// Returns all newly completed matches across all patterns.
    pub fn process_event(&mut self, event: EventData) -> Vec<SequenceMatch> {
        let mut all_matches = Vec::new();
        for engine in &mut self.engines {
            // Each engine has its own SharedBuffer, so we clone the event.
            let n = engine.process_event(event.clone());
            if n > 0 {
                all_matches.extend(engine.drain_completed());
            }
        }
        all_matches
    }

    /// Number of registered patterns.
    pub fn pattern_count(&self) -> usize {
        self.engines.len()
    }

    /// Total active partial matches across all patterns.
    pub fn total_active(&self) -> usize {
        self.engines.iter().map(|e| e.active_count()).sum()
    }

    /// Total events in all shared buffers.
    pub fn total_buffered(&self) -> usize {
        self.engines.iter().map(|e| e.buffer_len()).sum()
    }

    /// Evict old events from all shared buffers.
    pub fn evict_all_before(&mut self, cutoff: u64) -> usize {
        self.engines
            .iter_mut()
            .map(|e| e.evict_buffer_before(cutoff))
            .sum()
    }
}

impl Default for CepEngine {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use ava_fusion::sequence::{Contiguity, SequencePattern, SequenceStep};

    fn make_step(kind: &str) -> SequenceStep {
        SequenceStep {
            signal_kind: kind.into(),
            predicate: None,
            min_duration_ms: None,
            max_duration_ms: None,
            contiguity: Contiguity::Relaxed,
        }
    }

    fn make_pattern(id: &str, steps: Vec<SequenceStep>) -> SequencePattern {
        SequencePattern {
            id: id.into(),
            name: id.into(),
            steps,
            contiguity: Contiguity::Relaxed,
            cross_predicates: vec![],
            timeout_ms: 60_000,
            enabled: true,
        }
    }

    fn make_event(kind: &str, entity: &str, ts: u64) -> EventData {
        EventData {
            signal_kind: kind.into(),
            entity_id: entity.into(),
            timestamp: ts,
            fields: vec![],
        }
    }

    #[test]
    fn cep_engine_multi_pattern() {
        let mut engine = CepEngine::new();
        engine
            .register(make_pattern("p1", vec![make_step("ais"), make_step("absence")]))
            .unwrap();
        engine
            .register(make_pattern("p2", vec![make_step("adsb"), make_step("radar")]))
            .unwrap();
        assert_eq!(engine.pattern_count(), 2);

        // Feed AIS → absence → matches p1 only.
        engine.process_event(make_event("ais", "v1", 1000));
        let matches = engine.process_event(make_event("absence", "v1", 2000));
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].pattern_id, "p1");
    }

    #[test]
    fn cep_engine_disabled_pattern_skipped() {
        let mut engine = CepEngine::new();
        let mut pattern = make_pattern("p1", vec![make_step("ais")]);
        pattern.enabled = false;
        engine.register(pattern).unwrap();
        assert_eq!(engine.pattern_count(), 0);
    }

    #[test]
    fn cep_engine_total_active() {
        let mut engine = CepEngine::new();
        engine
            .register(make_pattern("p1", vec![make_step("ais"), make_step("absence")]))
            .unwrap();
        engine
            .register(make_pattern("p2", vec![make_step("ais"), make_step("radar")]))
            .unwrap();

        engine.process_event(make_event("ais", "v1", 1000));
        // Each pattern has 1 active partial match.
        assert_eq!(engine.total_active(), 2);
    }

    #[test]
    fn cep_engine_evict_all() {
        let mut engine = CepEngine::new();
        engine
            .register(make_pattern("p1", vec![make_step("ais"), make_step("absence")]))
            .unwrap();
        engine.process_event(make_event("ais", "v1", 1000));
        engine.process_event(make_event("ais", "v2", 2000));
        assert!(engine.total_buffered() > 0);

        let evicted = engine.evict_all_before(1500);
        assert_eq!(evicted, 1);
    }

    #[test]
    fn cep_engine_empty() {
        let mut engine = CepEngine::new();
        assert_eq!(engine.pattern_count(), 0);
        assert_eq!(engine.total_active(), 0);
        let matches = engine.process_event(make_event("ais", "v1", 1000));
        assert!(matches.is_empty());
    }
}
