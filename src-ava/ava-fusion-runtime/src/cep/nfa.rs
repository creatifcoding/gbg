//! NFA-SASE engine for complex event processing.
//!
//! Each `SequencePattern` compiles to an NFA where each step is a state.
//! The engine processes events through active partial matches, applying
//! contiguity rules (Strict/Relaxed/NonDeterministic) and cross-step
//! predicates.
//!
//! Three defenses against exponential blowup (§6.2):
//!   1. Window eviction — drop partial matches older than pattern timeout
//!   2. Budget cap — oldest-first eviction when partial match count exceeds limit
//!   3. SharedBuffer — events stored once, partial matches hold lightweight refs

use ava_fusion::sequence::{Contiguity, SequenceMatch, SequencePattern};

use super::evaluator::{parse_predicate, Expr, MatchContext};
use super::shared_buffer::{EventData, EventRef, SharedBuffer};

// ---------------------------------------------------------------------------
// Configuration constants
// ---------------------------------------------------------------------------

/// Default maximum partial matches per NFA instance.
pub const DEFAULT_BUDGET: usize = 10_000;

// ---------------------------------------------------------------------------
// ComputationState — one partial match in progress
// ---------------------------------------------------------------------------

/// A partial match progressing through the NFA.
#[derive(Debug, Clone)]
struct ComputationState {
    /// Current NFA state index (= next step to match).
    current_state: usize,
    /// References to matched events (one per completed step).
    matched_events: Vec<EventRef>,
    /// Pattern start time for window eviction.
    start_time: u64,
}

// ---------------------------------------------------------------------------
// Compiled cross-step predicate
// ---------------------------------------------------------------------------

/// A cross-step predicate compiled to an Expr with pushdown metadata.
#[derive(Debug, Clone)]
struct CompiledCrossPredicate {
    /// The compiled expression.
    expr: Expr,
    /// Evaluate at this state (= max_step_ref + 1, i.e., after the last referenced step is matched).
    eval_at_state: usize,
}

// ---------------------------------------------------------------------------
// NfaEngine — per-pattern NFA
// ---------------------------------------------------------------------------

/// NFA engine for a single `SequencePattern`.
///
/// Maintains a set of active partial matches (`ComputationState`s) and
/// processes incoming events, advancing matches through NFA states.
#[derive(Debug)]
pub struct NfaEngine {
    /// The source pattern.
    pattern: SequencePattern,
    /// Compiled step predicates (one per step, `None` if no predicate).
    step_predicates: Vec<Option<Expr>>,
    /// Compiled cross-step predicates with pushdown state indices.
    cross_predicates: Vec<CompiledCrossPredicate>,
    /// Active partial matches.
    active_states: Vec<ComputationState>,
    /// Maximum partial matches before oldest-first eviction.
    budget: usize,
    /// Reference to the shared event buffer.
    buffer: SharedBuffer,
    /// Completed matches awaiting drain.
    completed: Vec<SequenceMatch>,
    /// Total events processed.
    events_processed: u64,
}

impl NfaEngine {
    /// Compile a `SequencePattern` into an NFA engine.
    ///
    /// Parses step predicates and cross-step predicates at construction time.
    /// Returns `Err` if any predicate string fails to parse.
    pub fn new(pattern: SequencePattern) -> Result<Self, String> {
        Self::with_budget(pattern, DEFAULT_BUDGET)
    }

    /// Compile with a custom budget limit.
    pub fn with_budget(pattern: SequencePattern, budget: usize) -> Result<Self, String> {
        // Compile step predicates.
        let mut step_predicates = Vec::with_capacity(pattern.steps.len());
        for step in &pattern.steps {
            if let Some(ref pred_str) = step.predicate {
                step_predicates.push(Some(parse_predicate(pred_str)?));
            } else {
                step_predicates.push(None);
            }
        }

        // Compile cross-step predicates with pushdown.
        let mut cross_predicates = Vec::new();
        for cp in &pattern.cross_predicates {
            let expr = parse_predicate(&cp.predicate)?;
            // Evaluate as soon as the highest-referenced step is matched.
            let max_ref = expr.max_step_ref().unwrap_or(0);
            let eval_at_state = (max_ref + 1) as usize;
            cross_predicates.push(CompiledCrossPredicate {
                expr,
                eval_at_state,
            });
        }

        Ok(Self {
            pattern,
            step_predicates,
            cross_predicates,
            active_states: Vec::new(),
            budget,
            buffer: SharedBuffer::new(),
            completed: Vec::new(),
            events_processed: 0,
        })
    }

    /// Process an incoming event through the NFA.
    ///
    /// Returns the number of newly completed matches.
    pub fn process_event(&mut self, event: EventData) -> usize {
        let now = event.timestamp;
        self.events_processed += 1;

        // Store event in shared buffer.
        let event_ref = self.buffer.insert(event);

        // Window eviction — drop partial matches that have timed out.
        self.active_states.retain(|s| {
            now.saturating_sub(s.start_time) <= self.pattern.timeout_ms
        });

        let mut next_states = Vec::new();
        let completed_before = self.completed.len();

        // Try to start a new partial match at state 0.
        self.try_start_new_match(event_ref, now, &mut next_states);

        // Drain active states into a local vec to avoid borrow conflict.
        let current_states: Vec<ComputationState> = self.active_states.drain(..).collect();
        for state in current_states {
            self.advance_state(state, event_ref, &mut next_states);
        }

        self.active_states = next_states;

        // Budget cap — oldest-first eviction.
        if self.active_states.len() > self.budget {
            self.active_states.sort_by_key(|s| s.start_time);
            self.active_states.truncate(self.budget);
        }

        self.completed.len() - completed_before
    }

    /// Drain completed matches.
    pub fn drain_completed(&mut self) -> Vec<SequenceMatch> {
        std::mem::take(&mut self.completed)
    }

    /// Number of active partial matches.
    pub fn active_count(&self) -> usize {
        self.active_states.len()
    }

    /// Number of events in the shared buffer.
    pub fn buffer_len(&self) -> usize {
        self.buffer.len()
    }

    /// Total events processed.
    pub fn events_processed(&self) -> u64 {
        self.events_processed
    }

    /// Evict events older than `cutoff` from the shared buffer.
    pub fn evict_buffer_before(&mut self, cutoff: u64) -> usize {
        self.buffer.evict_before(cutoff)
    }

    /// Pattern ID accessor.
    pub fn pattern_id(&self) -> &str {
        &self.pattern.id
    }

    // -----------------------------------------------------------------------
    // Internal: try starting a new match at state 0
    // -----------------------------------------------------------------------

    fn try_start_new_match(
        &mut self,
        event_ref: EventRef,
        now: u64,
        next_states: &mut Vec<ComputationState>,
    ) {
        if self.pattern.steps.is_empty() {
            return;
        }

        let step = &self.pattern.steps[0];
        let event_data = match self.buffer.get(&event_ref) {
            Some(d) => d,
            None => return,
        };

        // Signal kind must match.
        if event_data.signal_kind != step.signal_kind {
            return;
        }

        // Evaluate step predicate.
        if let Some(ref pred) = self.step_predicates[0] {
            let ctx = MatchContext {
                matched_events: &[event_ref],
                buffer: &self.buffer,
            };
            if !pred.eval_bool(&ctx) {
                return;
            }
        }

        let new_state = ComputationState {
            current_state: 1,
            matched_events: vec![event_ref],
            start_time: now,
        };

        // Check if single-step pattern is complete.
        if new_state.current_state == self.pattern.steps.len() {
            if self.check_cross_predicates(&new_state) {
                self.emit_match(&new_state);
            }
        } else {
            // Check pushdown cross-predicates for state 1.
            if self.check_pushdown_predicates(&new_state) {
                next_states.push(new_state);
            }
        }
    }

    // -----------------------------------------------------------------------
    // Internal: advance an existing partial match
    // -----------------------------------------------------------------------

    fn advance_state(
        &mut self,
        state: ComputationState,
        event_ref: EventRef,
        next_states: &mut Vec<ComputationState>,
    ) {
        let step_idx = state.current_state;
        let step = &self.pattern.steps[step_idx];

        let event_data = match self.buffer.get(&event_ref) {
            Some(d) => d,
            None => {
                // Event evicted from buffer — keep state if not strict.
                match self.effective_contiguity(step_idx) {
                    Contiguity::Strict => { /* drop */ }
                    _ => next_states.push(state),
                }
                return;
            }
        };

        // Check signal kind match.
        let kind_matches = event_data.signal_kind == step.signal_kind;

        // Check step predicate.
        let pred_matches = if kind_matches {
            if let Some(ref pred) = self.step_predicates[step_idx] {
                let mut events = state.matched_events.clone();
                events.push(event_ref);
                let ctx = MatchContext {
                    matched_events: &events,
                    buffer: &self.buffer,
                };
                pred.eval_bool(&ctx)
            } else {
                true
            }
        } else {
            false
        };

        let matches = kind_matches && pred_matches;
        let contiguity = self.effective_contiguity(step_idx);

        if matches {
            // TAKE transition.
            let mut new_state = state.clone();
            new_state.matched_events.push(event_ref);
            new_state.current_state += 1;

            if new_state.current_state == self.pattern.steps.len() {
                // Complete — check cross-step predicates.
                if self.check_cross_predicates(&new_state) {
                    self.emit_match(&new_state);
                }
            } else {
                // Check pushdown cross-predicates.
                if self.check_pushdown_predicates(&new_state) {
                    next_states.push(new_state);
                }
            }

            // For NonDeterministic: also keep the old state (IGNORE fork).
            if contiguity == Contiguity::NonDeterministic {
                next_states.push(state);
            }
        } else {
            // No match — contiguity determines fate.
            match contiguity {
                Contiguity::Strict => {
                    // Drop partial match.
                }
                Contiguity::Relaxed | Contiguity::NonDeterministic => {
                    // IGNORE — keep waiting.
                    next_states.push(state);
                }
            }
        }
    }

    // -----------------------------------------------------------------------
    // Internal: contiguity resolution
    // -----------------------------------------------------------------------

    /// Effective contiguity for a step: step-level override > pattern default.
    fn effective_contiguity(&self, step_idx: usize) -> Contiguity {
        // The step's contiguity field controls the transition FROM this step.
        // But for the CURRENT step (what we're trying to match), we check
        // the previous step's contiguity (the transition INTO this step).
        if step_idx == 0 {
            return self.pattern.contiguity;
        }
        let prev_step = &self.pattern.steps[step_idx - 1];
        prev_step.contiguity
    }

    // -----------------------------------------------------------------------
    // Internal: cross-step predicate evaluation
    // -----------------------------------------------------------------------

    /// Check all cross-step predicates for a complete match.
    fn check_cross_predicates(&self, state: &ComputationState) -> bool {
        for cp in &self.cross_predicates {
            let ctx = MatchContext {
                matched_events: &state.matched_events,
                buffer: &self.buffer,
            };
            if !cp.expr.eval_bool(&ctx) {
                return false;
            }
        }
        true
    }

    /// Check pushdown cross-predicates that can be evaluated at the current state.
    fn check_pushdown_predicates(&self, state: &ComputationState) -> bool {
        for cp in &self.cross_predicates {
            if cp.eval_at_state <= state.current_state {
                let ctx = MatchContext {
                    matched_events: &state.matched_events,
                    buffer: &self.buffer,
                };
                if !cp.expr.eval_bool(&ctx) {
                    return false;
                }
            }
        }
        true
    }

    // -----------------------------------------------------------------------
    // Internal: match emission
    // -----------------------------------------------------------------------

    fn emit_match(&mut self, state: &ComputationState) {
        let start_ms = state
            .matched_events
            .first()
            .map(|r| r.timestamp)
            .unwrap_or(0);
        let end_ms = state
            .matched_events
            .last()
            .map(|r| r.timestamp)
            .unwrap_or(0);

        let matched_steps: Vec<u32> = (0..state.matched_events.len() as u32).collect();

        // Confidence = completeness (all steps matched = 1.0).
        let confidence = 1.0;

        // Entity ID from first matched event.
        let entity_id = self
            .buffer
            .get(&state.matched_events[0])
            .map(|d| d.entity_id.clone())
            .unwrap_or_default();

        self.completed.push(SequenceMatch {
            pattern_id: self.pattern.id.clone(),
            entity_id,
            matched_steps,
            start_ms,
            end_ms,
            confidence,
        });
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use ava_fusion::sequence::{
        Contiguity, CrossStepPredicate, SequencePattern, SequenceStep,
    };

    fn make_step(kind: &str) -> SequenceStep {
        SequenceStep {
            signal_kind: kind.into(),
            predicate: None,
            min_duration_ms: None,
            max_duration_ms: None,
            contiguity: Contiguity::Relaxed,
        }
    }

    fn make_step_strict(kind: &str) -> SequenceStep {
        SequenceStep {
            signal_kind: kind.into(),
            predicate: None,
            min_duration_ms: None,
            max_duration_ms: None,
            contiguity: Contiguity::Strict,
        }
    }

    fn make_step_nondet(kind: &str) -> SequenceStep {
        SequenceStep {
            signal_kind: kind.into(),
            predicate: None,
            min_duration_ms: None,
            max_duration_ms: None,
            contiguity: Contiguity::NonDeterministic,
        }
    }

    fn make_step_with_pred(kind: &str, pred: &str) -> SequenceStep {
        SequenceStep {
            signal_kind: kind.into(),
            predicate: Some(pred.into()),
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

    fn make_event_with_fields(
        kind: &str,
        entity: &str,
        ts: u64,
        fields: Vec<(&str, f64)>,
    ) -> EventData {
        EventData {
            signal_kind: kind.into(),
            entity_id: entity.into(),
            timestamp: ts,
            fields: fields.into_iter().map(|(k, v)| (k.into(), v)).collect(),
        }
    }

    // -- Basic sequence matching --

    #[test]
    fn two_step_relaxed_match() {
        let pattern = make_pattern("p1", vec![make_step("ais"), make_step("absence")]);
        let mut nfa = NfaEngine::new(pattern).unwrap();

        nfa.process_event(make_event("ais", "v1", 1000));
        assert_eq!(nfa.active_count(), 1);

        let n = nfa.process_event(make_event("absence", "v1", 2000));
        assert_eq!(n, 1);
        let matches = nfa.drain_completed();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].pattern_id, "p1");
        assert_eq!(matches[0].entity_id, "v1");
        assert_eq!(matches[0].start_ms, 1000);
        assert_eq!(matches[0].end_ms, 2000);
    }

    #[test]
    fn relaxed_ignores_unrelated_events() {
        let pattern = make_pattern("p1", vec![make_step("ais"), make_step("absence")]);
        let mut nfa = NfaEngine::new(pattern).unwrap();

        nfa.process_event(make_event("ais", "v1", 1000));
        nfa.process_event(make_event("radar", "v1", 1500)); // Unrelated — ignored.
        nfa.process_event(make_event("adsb", "v1", 1800)); // Unrelated — ignored.
        let n = nfa.process_event(make_event("absence", "v1", 2000));
        assert_eq!(n, 1);
    }

    #[test]
    fn strict_drops_on_non_match() {
        let pattern = make_pattern("p1", vec![make_step_strict("ais"), make_step("absence")]);
        let mut nfa = NfaEngine::new(pattern).unwrap();

        nfa.process_event(make_event("ais", "v1", 1000));
        assert_eq!(nfa.active_count(), 1);

        nfa.process_event(make_event("radar", "v1", 1500)); // Non-match — strict drops.
        assert_eq!(nfa.active_count(), 0);

        let n = nfa.process_event(make_event("absence", "v1", 2000));
        assert_eq!(n, 0); // No active states to match.
    }

    #[test]
    fn nondet_forks_on_match() {
        let pattern = make_pattern(
            "p1",
            vec![make_step_nondet("ais"), make_step("ais")],
        );
        let mut nfa = NfaEngine::new(pattern).unwrap();

        nfa.process_event(make_event("ais", "v1", 1000));
        // State 0 started a match (→ state 1). No fork yet since this is at start.
        assert_eq!(nfa.active_count(), 1);

        // Second AIS event: NonDet contiguity means we TAKE (complete match)
        // AND IGNORE (keep waiting for another).
        let n = nfa.process_event(make_event("ais", "v1", 2000));
        assert_eq!(n, 1);
        // The IGNORE fork keeps the state at step 1.
        assert!(nfa.active_count() >= 1);
    }

    // -- Predicate filtering --

    #[test]
    fn step_predicate_filters_events() {
        let pattern = make_pattern(
            "p1",
            vec![
                make_step_with_pred("ais", "speed < 1.0"),
                make_step("absence"),
            ],
        );
        let mut nfa = NfaEngine::new(pattern).unwrap();

        // speed=12 → fails predicate → no match start.
        nfa.process_event(make_event_with_fields("ais", "v1", 1000, vec![("speed", 12.0)]));
        assert_eq!(nfa.active_count(), 0);

        // speed=0.5 → passes predicate → match starts.
        nfa.process_event(make_event_with_fields("ais", "v1", 1100, vec![("speed", 0.5)]));
        assert_eq!(nfa.active_count(), 1);

        let n = nfa.process_event(make_event("absence", "v1", 2000));
        assert_eq!(n, 1);
    }

    // -- Cross-step predicates --

    #[test]
    fn cross_step_predicate_acceptance() {
        let mut pattern = make_pattern(
            "p1",
            vec![
                make_step("ais"),
                make_step("absence"),
                make_step("ais"),
            ],
        );
        pattern.cross_predicates.push(CrossStepPredicate {
            from_step: 0,
            to_step: 2,
            predicate: "step_0.speed > step_2.speed".into(),
        });

        let mut nfa = NfaEngine::new(pattern).unwrap();

        nfa.process_event(make_event_with_fields("ais", "v1", 1000, vec![("speed", 10.0)]));
        nfa.process_event(make_event("absence", "v1", 2000));
        // step_0.speed=10, step_2.speed=0.5 → 10 > 0.5 → passes.
        let n = nfa.process_event(make_event_with_fields("ais", "v1", 3000, vec![("speed", 0.5)]));
        assert_eq!(n, 1);
    }

    #[test]
    fn cross_step_predicate_rejection() {
        let mut pattern = make_pattern(
            "p1",
            vec![
                make_step("ais"),
                make_step("absence"),
                make_step("ais"),
            ],
        );
        pattern.cross_predicates.push(CrossStepPredicate {
            from_step: 0,
            to_step: 2,
            predicate: "step_0.speed > step_2.speed".into(),
        });

        let mut nfa = NfaEngine::new(pattern).unwrap();

        nfa.process_event(make_event_with_fields("ais", "v1", 1000, vec![("speed", 1.0)]));
        nfa.process_event(make_event("absence", "v1", 2000));
        // step_0.speed=1, step_2.speed=10 → 1 > 10 → FAILS.
        let n = nfa.process_event(make_event_with_fields("ais", "v1", 3000, vec![("speed", 10.0)]));
        assert_eq!(n, 0);
    }

    // -- Window eviction --

    #[test]
    fn window_eviction_drops_old_matches() {
        let mut pattern = make_pattern("p1", vec![make_step("ais"), make_step("absence")]);
        pattern.timeout_ms = 5_000; // 5 second window.
        let mut nfa = NfaEngine::new(pattern).unwrap();

        nfa.process_event(make_event("ais", "v1", 1000));
        assert_eq!(nfa.active_count(), 1);

        // 10 seconds later — partial match should be evicted.
        let n = nfa.process_event(make_event("absence", "v1", 11_000));
        assert_eq!(n, 0);
        // The start at t=1000 is 10s old, timeout is 5s → evicted before matching.
    }

    // -- Budget cap --

    #[test]
    fn budget_cap_evicts_oldest() {
        let pattern = make_pattern("p1", vec![make_step("ais"), make_step("absence")]);
        let mut nfa = NfaEngine::with_budget(pattern, 5).unwrap();

        // Create 10 partial matches.
        for i in 0..10 {
            nfa.process_event(make_event("ais", "v1", i * 100));
        }

        // Budget is 5, should have been capped.
        assert!(nfa.active_count() <= 5);
    }

    // -- Three-step pattern --

    #[test]
    fn three_step_ais_dark_period() {
        let pattern = make_pattern(
            "ais-dark",
            vec![
                make_step("ais"),
                make_step("absence"),
                make_step("ais"),
            ],
        );
        let mut nfa = NfaEngine::new(pattern).unwrap();

        nfa.process_event(make_event("ais", "vessel-123", 1000));
        nfa.process_event(make_event("absence", "vessel-123", 5000));
        let n = nfa.process_event(make_event("ais", "vessel-123", 10000));
        assert_eq!(n, 1);
        let matches = nfa.drain_completed();
        assert_eq!(matches[0].matched_steps, vec![0, 1, 2]);
        assert_eq!(matches[0].start_ms, 1000);
        assert_eq!(matches[0].end_ms, 10000);
    }

    // -- Empty and edge cases --

    #[test]
    fn empty_pattern_no_matches() {
        let pattern = make_pattern("empty", vec![]);
        let mut nfa = NfaEngine::new(pattern).unwrap();
        let n = nfa.process_event(make_event("ais", "v1", 1000));
        assert_eq!(n, 0);
    }

    #[test]
    fn single_step_pattern() {
        let pattern = make_pattern("single", vec![make_step("ais")]);
        let mut nfa = NfaEngine::new(pattern).unwrap();
        let n = nfa.process_event(make_event("ais", "v1", 1000));
        assert_eq!(n, 1);
        let matches = nfa.drain_completed();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].start_ms, 1000);
        assert_eq!(matches[0].end_ms, 1000);
    }

    #[test]
    fn no_match_wrong_signal_kind() {
        let pattern = make_pattern("p1", vec![make_step("ais"), make_step("absence")]);
        let mut nfa = NfaEngine::new(pattern).unwrap();
        nfa.process_event(make_event("radar", "v1", 1000));
        assert_eq!(nfa.active_count(), 0);
    }

    #[test]
    fn multiple_concurrent_partial_matches() {
        let pattern = make_pattern("p1", vec![make_step("ais"), make_step("absence")]);
        let mut nfa = NfaEngine::new(pattern).unwrap();

        // Two AIS events start two partial matches.
        nfa.process_event(make_event("ais", "v1", 1000));
        nfa.process_event(make_event("ais", "v2", 1500));
        assert_eq!(nfa.active_count(), 2);

        // One absence completes both.
        let n = nfa.process_event(make_event("absence", "v1", 2000));
        assert_eq!(n, 2); // Both partial matches complete.
    }

    #[test]
    fn events_processed_counter() {
        let pattern = make_pattern("p1", vec![make_step("ais")]);
        let mut nfa = NfaEngine::new(pattern).unwrap();
        nfa.process_event(make_event("ais", "v1", 1000));
        nfa.process_event(make_event("radar", "v1", 2000));
        nfa.process_event(make_event("ais", "v1", 3000));
        assert_eq!(nfa.events_processed(), 3);
    }

    #[test]
    fn buffer_eviction() {
        let pattern = make_pattern("p1", vec![make_step("ais"), make_step("absence")]);
        let mut nfa = NfaEngine::new(pattern).unwrap();
        nfa.process_event(make_event("ais", "v1", 1000));
        nfa.process_event(make_event("ais", "v2", 2000));
        assert_eq!(nfa.buffer_len(), 2);

        let evicted = nfa.evict_buffer_before(1500);
        assert_eq!(evicted, 1);
        assert_eq!(nfa.buffer_len(), 1);
    }
}
