//! Alert fatigue suppression — 4-layer filter.
//!
//! Prevents operator alert fatigue via:
//! 1. **Hysteresis** (deadband) — enter alert at `score > threshold`,
//!    exit only at `score < threshold - delta`.
//! 2. **Score-delta significance** — only alert when `|score - last_alerted| > Δ`.
//! 3. **Rate limiting** (token bucket) — max N alerts per entity per window.
//! 4. **Cooldown** — minimum interval between consecutive alerts.
//!
//! Designed for use in the `AlarmEvaluator` actor, BEFORE emitting alarms
//! downstream. This is actor-level state, not inside the dataflow graph.
//!
//! Reference: Synthesis §7.4.

use std::collections::HashMap;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/// Configuration for the 4-layer alert suppression filter.
#[derive(Debug, Clone)]
pub struct AlertSuppressionConfig {
    /// Risk score threshold to enter the alert zone.
    pub threshold: f64,
    /// Hysteresis deadband: exit alert at `score < threshold - delta`.
    /// Typical: `threshold * 0.10..0.15`.
    pub hysteresis_delta: f64,
    /// Score-delta significance: suppress unless
    /// `|score - last_alerted_score| > score_delta`.
    /// Typical: 0.15.
    pub score_delta: f64,
    /// Token bucket: maximum alerts per refill window.
    pub bucket_capacity: u32,
    /// Token bucket: refill window in milliseconds.
    /// Typical: 3_600_000 (1 hour).
    pub bucket_window_ms: u64,
    /// Cooldown: minimum milliseconds between consecutive alerts.
    /// Typical: 30_000..60_000 (30-60s).
    pub cooldown_ms: u64,
}

impl Default for AlertSuppressionConfig {
    fn default() -> Self {
        Self {
            threshold: 0.6,
            hysteresis_delta: 0.09, // 0.6 * 0.15 = 0.09
            score_delta: 0.15,
            bucket_capacity: 3,
            bucket_window_ms: 3_600_000, // 1 hour
            cooldown_ms: 30_000,         // 30 seconds
        }
    }
}

// ---------------------------------------------------------------------------
// Per-entity alert state
// ---------------------------------------------------------------------------

/// Per-entity state tracked across evaluations.
#[derive(Debug, Clone)]
struct EntityAlertState {
    /// Whether the entity is currently in the alert zone (hysteresis latch).
    alarmed: bool,
    /// Score at the last emitted alert (for delta-significance check).
    last_alerted_score: f64,
    /// Timestamp of the last emitted alert (epoch ms).
    last_alert_time_ms: u64,
    /// Token bucket: remaining tokens.
    tokens: u32,
    /// Token bucket: timestamp of last refill (epoch ms).
    bucket_refill_ms: u64,
}

impl EntityAlertState {
    fn new() -> Self {
        Self {
            alarmed: false,
            last_alerted_score: 0.0,
            last_alert_time_ms: 0,
            tokens: 0, // Filled on first refill check.
            bucket_refill_ms: 0,
        }
    }
}

// ---------------------------------------------------------------------------
// Alert suppression result
// ---------------------------------------------------------------------------

/// Result of the suppression check, indicating which layer blocked (if any).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SuppressionVerdict {
    /// All 4 layers passed — emit the alert.
    Emit,
    /// Layer 1: score is outside the hysteresis alert zone.
    SuppressedHysteresis,
    /// Layer 2: score change is below the significance delta.
    SuppressedScoreDelta,
    /// Layer 3: rate limit exhausted (token bucket empty).
    SuppressedRateLimit,
    /// Layer 4: cooldown period has not elapsed.
    SuppressedCooldown,
}

impl SuppressionVerdict {
    /// Whether the alert should be emitted.
    pub fn should_emit(&self) -> bool {
        matches!(self, SuppressionVerdict::Emit)
    }
}

// ---------------------------------------------------------------------------
// AlertSuppressor
// ---------------------------------------------------------------------------

/// 4-layer alert fatigue suppression filter.
///
/// Maintains per-entity state for hysteresis, score-delta, rate limiting,
/// and cooldown. Call `evaluate()` with the entity's current risk score
/// and the current timestamp. The filter returns whether to emit.
pub struct AlertSuppressor {
    config: AlertSuppressionConfig,
    states: HashMap<String, EntityAlertState>,
}

impl AlertSuppressor {
    /// Create a new suppressor with the given configuration.
    pub fn new(config: AlertSuppressionConfig) -> Self {
        Self {
            config,
            states: HashMap::new(),
        }
    }

    /// Create with default configuration.
    pub fn with_defaults() -> Self {
        Self::new(AlertSuppressionConfig::default())
    }

    /// Evaluate whether an alert should be emitted for an entity.
    ///
    /// - `entity_id`: unique entity identifier.
    /// - `score`: current composite risk score (0.0-1.0).
    /// - `now_ms`: current timestamp (epoch ms).
    ///
    /// Returns the verdict. If `Emit`, the internal state is updated
    /// (token consumed, timestamps advanced). If suppressed, state is
    /// still updated for hysteresis tracking but no token is consumed.
    pub fn evaluate(&mut self, entity_id: &str, score: f64, now_ms: u64) -> SuppressionVerdict {
        let state = self
            .states
            .entry(entity_id.to_string())
            .or_insert_with(|| {
                let mut s = EntityAlertState::new();
                s.tokens = self.config.bucket_capacity;
                s.bucket_refill_ms = now_ms;
                s
            });

        // --- Layer 1: Hysteresis ---
        let in_zone = if state.alarmed {
            // Already alarmed: stay alarmed unless score drops below exit threshold.
            if score < self.config.threshold - self.config.hysteresis_delta {
                state.alarmed = false;
                false
            } else {
                true
            }
        } else {
            // Not alarmed: enter only if score exceeds entry threshold.
            if score > self.config.threshold {
                state.alarmed = true;
                true
            } else {
                false
            }
        };

        if !in_zone {
            return SuppressionVerdict::SuppressedHysteresis;
        }

        // --- Layer 2: Score-delta significance ---
        let significant = (score - state.last_alerted_score).abs() > self.config.score_delta;
        // First alert for this entity always passes (last_alerted_score = 0.0, score > threshold).
        // Except when re-entering: the delta from 0.0 to score is typically large enough.
        if !significant && state.last_alert_time_ms > 0 {
            return SuppressionVerdict::SuppressedScoreDelta;
        }

        // --- Layer 3: Rate limiting (token bucket) ---
        // Refill tokens if the window has elapsed.
        if now_ms >= state.bucket_refill_ms + self.config.bucket_window_ms {
            state.tokens = self.config.bucket_capacity;
            state.bucket_refill_ms = now_ms;
        }
        if state.tokens == 0 {
            return SuppressionVerdict::SuppressedRateLimit;
        }

        // --- Layer 4: Cooldown ---
        if state.last_alert_time_ms > 0
            && now_ms < state.last_alert_time_ms + self.config.cooldown_ms
        {
            return SuppressionVerdict::SuppressedCooldown;
        }

        // All layers passed — emit.
        state.tokens -= 1;
        state.last_alerted_score = score;
        state.last_alert_time_ms = now_ms;

        SuppressionVerdict::Emit
    }

    /// Check if an entity is currently in the alarmed state (hysteresis latch).
    pub fn is_alarmed(&self, entity_id: &str) -> bool {
        self.states
            .get(entity_id)
            .map(|s| s.alarmed)
            .unwrap_or(false)
    }

    /// Number of tracked entities.
    pub fn entity_count(&self) -> usize {
        self.states.len()
    }

    /// Remaining tokens for an entity's rate limiter.
    pub fn remaining_tokens(&self, entity_id: &str) -> u32 {
        self.states
            .get(entity_id)
            .map(|s| s.tokens)
            .unwrap_or(0)
    }

    /// Remove an entity's state (e.g., when entity is no longer tracked).
    pub fn remove_entity(&mut self, entity_id: &str) {
        self.states.remove(entity_id);
    }

    /// Clear all entity states.
    pub fn clear(&mut self) {
        self.states.clear();
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> AlertSuppressionConfig {
        AlertSuppressionConfig {
            threshold: 0.6,
            hysteresis_delta: 0.1,
            score_delta: 0.15,
            bucket_capacity: 3,
            bucket_window_ms: 3_600_000,
            cooldown_ms: 30_000,
        }
    }

    // -- Layer 1: Hysteresis --

    #[test]
    fn hysteresis_below_threshold_suppressed() {
        let mut s = AlertSuppressor::new(config());
        let v = s.evaluate("e1", 0.5, 1000);
        assert_eq!(v, SuppressionVerdict::SuppressedHysteresis);
        assert!(!s.is_alarmed("e1"));
    }

    #[test]
    fn hysteresis_above_threshold_emits() {
        let mut s = AlertSuppressor::new(config());
        let v = s.evaluate("e1", 0.7, 1000);
        assert_eq!(v, SuppressionVerdict::Emit);
        assert!(s.is_alarmed("e1"));
    }

    #[test]
    fn hysteresis_stays_alarmed_in_deadband() {
        let mut s = AlertSuppressor::new(config());
        // Enter alert zone.
        s.evaluate("e1", 0.7, 1000);
        // Score drops to 0.55, which is below threshold (0.6) but above
        // exit threshold (0.6 - 0.1 = 0.5). Still alarmed.
        let _v = s.evaluate("e1", 0.55, 60_000);
        // This should pass hysteresis but may be suppressed by score-delta.
        // Score changed from 0.7 to 0.55 → delta = 0.15. Equal to threshold,
        // not strictly greater. So score-delta suppresses.
        assert!(s.is_alarmed("e1"));
    }

    #[test]
    fn hysteresis_exits_below_deadband() {
        let mut s = AlertSuppressor::new(config());
        // Enter alert zone.
        s.evaluate("e1", 0.7, 1000);
        // Drop below exit threshold (0.5).
        let v = s.evaluate("e1", 0.45, 60_000);
        assert_eq!(v, SuppressionVerdict::SuppressedHysteresis);
        assert!(!s.is_alarmed("e1"));
    }

    #[test]
    fn hysteresis_reentry_requires_full_threshold() {
        let mut s = AlertSuppressor::new(config());
        // Enter → exit → must cross full threshold to re-enter.
        s.evaluate("e1", 0.7, 1000);
        s.evaluate("e1", 0.45, 60_000); // Exit.
        let v = s.evaluate("e1", 0.55, 120_000);
        // 0.55 is above exit threshold but below entry threshold (0.6).
        assert_eq!(v, SuppressionVerdict::SuppressedHysteresis);
        assert!(!s.is_alarmed("e1"));
    }

    // -- Layer 2: Score-delta significance --

    #[test]
    fn score_delta_suppresses_small_change() {
        let mut s = AlertSuppressor::new(config());
        // First alert.
        s.evaluate("e1", 0.7, 1000);
        // Score changes by 0.05 (< delta of 0.15). Suppressed.
        let v = s.evaluate("e1", 0.75, 60_000);
        assert_eq!(v, SuppressionVerdict::SuppressedScoreDelta);
    }

    #[test]
    fn score_delta_emits_on_large_change() {
        let mut s = AlertSuppressor::new(config());
        // First alert at 0.7.
        s.evaluate("e1", 0.7, 1000);
        // Score jumps to 0.9 (delta = 0.2 > 0.15). Emits.
        let v = s.evaluate("e1", 0.9, 60_000);
        assert_eq!(v, SuppressionVerdict::Emit);
    }

    // -- Layer 3: Rate limiting --

    #[test]
    fn rate_limit_exhausts_tokens() {
        let mut s = AlertSuppressor::new(config());
        // Capacity = 3. Use all 3 tokens with sufficiently different scores.
        assert_eq!(s.evaluate("e1", 0.70, 1000), SuppressionVerdict::Emit);
        assert_eq!(s.evaluate("e1", 0.90, 60_000), SuppressionVerdict::Emit);
        assert_eq!(s.evaluate("e1", 0.65, 120_000), SuppressionVerdict::Emit);
        // 4th alert within the window — no tokens left.
        let v = s.evaluate("e1", 0.85, 180_000);
        assert_eq!(v, SuppressionVerdict::SuppressedRateLimit);
        assert_eq!(s.remaining_tokens("e1"), 0);
    }

    #[test]
    fn rate_limit_refills_after_window() {
        let mut s = AlertSuppressor::new(config());
        // Exhaust tokens.
        s.evaluate("e1", 0.70, 1000);
        s.evaluate("e1", 0.90, 60_000);
        s.evaluate("e1", 0.65, 120_000);
        assert_eq!(s.remaining_tokens("e1"), 0);
        // After window elapses (1 hour), tokens refill.
        let v = s.evaluate("e1", 0.85, 3_700_000);
        assert_eq!(v, SuppressionVerdict::Emit);
        assert_eq!(s.remaining_tokens("e1"), 2); // Started with 3, used 1.
    }

    // -- Layer 4: Cooldown --

    #[test]
    fn cooldown_suppresses_rapid_alerts() {
        let mut s = AlertSuppressor::new(config());
        // First alert.
        s.evaluate("e1", 0.70, 1000);
        // Second alert 10s later (< 30s cooldown). Big delta (0.2).
        let v = s.evaluate("e1", 0.90, 11_000);
        assert_eq!(v, SuppressionVerdict::SuppressedCooldown);
    }

    #[test]
    fn cooldown_allows_after_elapsed() {
        let mut s = AlertSuppressor::new(config());
        s.evaluate("e1", 0.70, 1000);
        // 40s later (> 30s cooldown) with significant delta.
        let v = s.evaluate("e1", 0.90, 41_000);
        assert_eq!(v, SuppressionVerdict::Emit);
    }

    // -- Multi-entity isolation --

    #[test]
    fn entities_are_independent() {
        let mut s = AlertSuppressor::new(config());
        s.evaluate("e1", 0.70, 1000);
        // e2 should start fresh — not affected by e1's state.
        let v = s.evaluate("e2", 0.65, 2000);
        assert_eq!(v, SuppressionVerdict::Emit);
        assert!(s.is_alarmed("e1"));
        assert!(s.is_alarmed("e2"));
        assert_eq!(s.entity_count(), 2);
    }

    // -- Combined integration tests --

    #[test]
    fn full_lifecycle() {
        let mut s = AlertSuppressor::new(config());
        let base_ms = 1_000_000u64;

        // 1. First alert: score 0.7, passes all layers.
        assert_eq!(s.evaluate("ship", 0.7, base_ms), SuppressionVerdict::Emit);
        assert!(s.is_alarmed("ship"));

        // 2. Small bump 1 min later: score-delta suppresses (0.72 - 0.7 = 0.02).
        assert_eq!(
            s.evaluate("ship", 0.72, base_ms + 60_000),
            SuppressionVerdict::SuppressedScoreDelta
        );

        // 3. Significant rise 2 min later: score 0.9, delta = 0.2, emits.
        assert_eq!(
            s.evaluate("ship", 0.9, base_ms + 120_000),
            SuppressionVerdict::Emit
        );

        // 4. Score drops into deadband (0.55): still alarmed, but suppressed by
        //    score-delta (0.9 - 0.55 = 0.35 > 0.15) and cooldown check.
        // At 130s (only 10s after last alert), cooldown blocks.
        assert_eq!(
            s.evaluate("ship", 0.55, base_ms + 130_000),
            SuppressionVerdict::SuppressedCooldown
        );

        // 5. After cooldown (160s = 40s since last alert), same score.
        // Delta = |0.55 - 0.9| = 0.35 > 0.15. Emits.
        assert_eq!(
            s.evaluate("ship", 0.55, base_ms + 160_000),
            SuppressionVerdict::Emit
        );

        // 6. Tokens exhausted (3 used). Next one blocked by rate limit.
        // Need significant delta from 0.55: try 0.8 (delta = 0.25).
        assert_eq!(
            s.evaluate("ship", 0.80, base_ms + 200_000),
            SuppressionVerdict::SuppressedRateLimit
        );

        // 7. Score plummets below exit threshold (0.5 - 0.1 = 0.5, score 0.4 < 0.5).
        let v = s.evaluate("ship", 0.4, base_ms + 300_000);
        assert_eq!(v, SuppressionVerdict::SuppressedHysteresis);
        assert!(!s.is_alarmed("ship"));

        // 8. After 1 hour, re-enter with fresh tokens.
        let v = s.evaluate("ship", 0.75, base_ms + 3_700_000);
        assert_eq!(v, SuppressionVerdict::Emit);
        assert_eq!(s.remaining_tokens("ship"), 2);
    }

    // -- Utility methods --

    #[test]
    fn remove_entity_clears_state() {
        let mut s = AlertSuppressor::new(config());
        s.evaluate("e1", 0.7, 1000);
        assert_eq!(s.entity_count(), 1);
        s.remove_entity("e1");
        assert_eq!(s.entity_count(), 0);
        assert!(!s.is_alarmed("e1"));
    }

    #[test]
    fn clear_removes_all() {
        let mut s = AlertSuppressor::new(config());
        s.evaluate("e1", 0.7, 1000);
        s.evaluate("e2", 0.8, 2000);
        assert_eq!(s.entity_count(), 2);
        s.clear();
        assert_eq!(s.entity_count(), 0);
    }

    #[test]
    fn verdict_should_emit() {
        assert!(SuppressionVerdict::Emit.should_emit());
        assert!(!SuppressionVerdict::SuppressedHysteresis.should_emit());
        assert!(!SuppressionVerdict::SuppressedScoreDelta.should_emit());
        assert!(!SuppressionVerdict::SuppressedRateLimit.should_emit());
        assert!(!SuppressionVerdict::SuppressedCooldown.should_emit());
    }

    #[test]
    fn default_config_values() {
        let cfg = AlertSuppressionConfig::default();
        assert!((cfg.threshold - 0.6).abs() < 1e-10);
        assert!((cfg.hysteresis_delta - 0.09).abs() < 1e-10);
        assert!((cfg.score_delta - 0.15).abs() < 1e-10);
        assert_eq!(cfg.bucket_capacity, 3);
        assert_eq!(cfg.bucket_window_ms, 3_600_000);
        assert_eq!(cfg.cooldown_ms, 30_000);
    }
}
