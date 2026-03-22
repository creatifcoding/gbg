//! NATS Configuration

/// Configuration for NATS JetStream connection.
#[derive(Debug, Clone)]
pub struct NatsConfig {
    /// NATS server URL (e.g., "localhost:4222")
    pub server_url: String,

    /// JetStream stream name
    pub stream_name: String,

    /// Subject prefix (default: "tmnl.ava")
    pub subject_prefix: String,

    /// Maximum messages to retain in stream
    pub max_messages: i64,

    /// Reconnect attempts (0 = infinite)
    pub max_reconnect_attempts: u32,

    /// Base delay between reconnect attempts (milliseconds)
    pub reconnect_delay_ms: u64,
}

impl Default for NatsConfig {
    fn default() -> Self {
        Self {
            server_url: "localhost:4222".into(),
            stream_name: "TMNL_AVA".into(),
            subject_prefix: "tmnl.ava".into(),
            max_messages: 100_000,
            max_reconnect_attempts: 0, // Infinite
            reconnect_delay_ms: 100,
        }
    }
}

impl NatsConfig {
    /// Creates a new config with the given server URL.
    pub fn with_server(server_url: impl Into<String>) -> Self {
        Self {
            server_url: server_url.into(),
            ..Default::default()
        }
    }

    /// Sets the stream name.
    pub fn stream_name(mut self, name: impl Into<String>) -> Self {
        self.stream_name = name.into();
        self
    }

    /// Sets the subject prefix.
    pub fn subject_prefix(mut self, prefix: impl Into<String>) -> Self {
        self.subject_prefix = prefix.into();
        self
    }

    /// Formats a subject for artifacts.
    pub fn artifacts_subject(&self, view_id: &str) -> String {
        format!("{}.artifacts.{}", self.subject_prefix, view_id)
    }

    /// Formats a subject for deltas.
    pub fn deltas_subject(&self, view_id: &str) -> String {
        format!("{}.deltas.{}", self.subject_prefix, view_id)
    }

    /// Formats a subject for status events.
    pub fn status_subject(&self, view_id: &str) -> String {
        format!("{}.status.{}", self.subject_prefix, view_id)
    }

    /// Formats a subject for invalidation requests.
    pub fn invalidate_subject(&self, view_id: &str) -> String {
        format!("{}.invalidate.{}", self.subject_prefix, view_id)
    }

    /// Returns the wildcard pattern for all subjects.
    pub fn all_subjects_pattern(&self) -> String {
        format!("{}.*.*", self.subject_prefix)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = NatsConfig::default();
        assert_eq!(config.server_url, "localhost:4222");
        assert_eq!(config.stream_name, "TMNL_AVA");
        assert_eq!(config.subject_prefix, "tmnl.ava");
    }

    #[test]
    fn test_subject_formatting() {
        let config = NatsConfig::default();
        assert_eq!(
            config.artifacts_subject("map-view-1"),
            "tmnl.ava.artifacts.map-view-1"
        );
        assert_eq!(
            config.deltas_subject("scene3d-2"),
            "tmnl.ava.deltas.scene3d-2"
        );
    }

    #[test]
    fn test_builder_pattern() {
        let config = NatsConfig::with_server("nats://prod:4222")
            .stream_name("PROD_AVA")
            .subject_prefix("prod.ava");

        assert_eq!(config.server_url, "nats://prod:4222");
        assert_eq!(config.stream_name, "PROD_AVA");
        assert_eq!(config.subject_prefix, "prod.ava");
    }
}
