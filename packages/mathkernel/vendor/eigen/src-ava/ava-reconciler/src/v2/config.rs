//! Configuration for ReconcilerV2

use super::broadcaster::LagStrategy;

/// Configuration for ReconcilerV2
#[derive(Debug, Clone)]
pub struct ReconcilerConfigV2 {
    /// Default broadcaster buffer size
    pub default_buffer_size: usize,

    /// Default lag strategy for broadcasters
    pub default_lag_strategy: LagStrategy,

    /// Enable event log for debugging/replay
    pub enable_event_log: bool,

    /// Event log compaction threshold
    pub compaction_threshold: usize,

    /// Default time provider (for testing)
    pub time_provider: Option<fn() -> f64>,
}

impl Default for ReconcilerConfigV2 {
    fn default() -> Self {
        Self {
            default_buffer_size: 16,
            default_lag_strategy: LagStrategy::DropOldest,
            enable_event_log: true,
            compaction_threshold: 1000,
            time_provider: None,
        }
    }
}

impl ReconcilerConfigV2 {
    /// Create configuration for testing with custom time provider
    pub fn with_time_provider(mut self, provider: fn() -> f64) -> Self {
        self.time_provider = Some(provider);
        self
    }

    /// Create configuration with specific buffer size
    pub fn with_buffer_size(mut self, size: usize) -> Self {
        self.default_buffer_size = size;
        self
    }

    /// Create configuration with specific lag strategy
    pub fn with_lag_strategy(mut self, strategy: LagStrategy) -> Self {
        self.default_lag_strategy = strategy;
        self
    }

    /// Disable event log
    pub fn without_event_log(mut self) -> Self {
        self.enable_event_log = false;
        self
    }
}
