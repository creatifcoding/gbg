//! Durable Streams Configuration

use std::time::Duration;

/// Configuration for the Durable Streams client
#[derive(Debug, Clone)]
pub struct DurableStreamsConfig {
    /// Base URL of the durable-streams server
    pub base_url: String,

    /// Request timeout
    pub timeout: Duration,

    /// Maximum retries for failed requests
    pub max_retries: u32,

    /// Delay between retries
    pub retry_delay: Duration,

    /// User agent string
    pub user_agent: String,
}

impl Default for DurableStreamsConfig {
    fn default() -> Self {
        Self {
            base_url: "http://localhost:3030".into(),
            timeout: Duration::from_secs(30),
            max_retries: 3,
            retry_delay: Duration::from_millis(100),
            user_agent: "tmnl-ava/1.0".into(),
        }
    }
}

impl DurableStreamsConfig {
    /// Create config with custom base URL
    pub fn with_url(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            ..Default::default()
        }
    }

    /// Set request timeout
    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Set max retries
    pub fn max_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }

    /// Build the stream URL for a given path
    pub fn stream_url(&self, path: &str) -> String {
        let path = path.trim_start_matches('/');
        format!("{}/v1/stream/{}", self.base_url.trim_end_matches('/'), path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stream_url() {
        let config = DurableStreamsConfig::with_url("http://localhost:3030");
        assert_eq!(
            config.stream_url("tmnl/artifacts"),
            "http://localhost:3030/v1/stream/tmnl/artifacts"
        );
        assert_eq!(
            config.stream_url("/tmnl/artifacts"),
            "http://localhost:3030/v1/stream/tmnl/artifacts"
        );
    }

    #[test]
    fn test_default_config() {
        let config = DurableStreamsConfig::default();
        assert_eq!(config.base_url, "http://localhost:3030");
        assert_eq!(config.timeout, Duration::from_secs(30));
    }
}
