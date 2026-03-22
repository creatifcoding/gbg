//! Durable Streams HTTP Client
//!
//! Implements the Durable Streams Protocol v1.0 for persistent, offset-based streaming.

use reqwest::Client;
use std::sync::Arc;

use super::config::DurableStreamsConfig;
use super::error::DurableStreamsError;

/// Offset for reading from a stream
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Offset {
    /// Read from the beginning of the stream
    Beginning,
    /// Read from a specific offset token
    At(String),
}

impl Offset {
    /// Convert to query parameter value
    pub fn as_query_value(&self) -> &str {
        match self {
            Self::Beginning => "-1",
            Self::At(s) => s.as_str(),
        }
    }
}

impl From<String> for Offset {
    fn from(s: String) -> Self {
        if s == "-1" {
            Self::Beginning
        } else {
            Self::At(s)
        }
    }
}

/// Content type for streams
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ContentType {
    /// application/json (with message boundary preservation)
    Json,
    /// application/octet-stream
    Binary,
    /// text/plain
    Text,
}

impl ContentType {
    /// Get MIME type string
    pub fn as_mime(&self) -> &'static str {
        match self {
            Self::Json => "application/json",
            Self::Binary => "application/octet-stream",
            Self::Text => "text/plain",
        }
    }
}

/// Result of reading from a stream
#[derive(Debug)]
pub struct ReadResult {
    /// Data read from the stream
    pub data: Vec<u8>,
    /// Next offset for subsequent reads
    pub next_offset: String,
    /// Whether we've caught up to the tail
    pub up_to_date: bool,
}

/// Durable Streams HTTP client
pub struct DurableStreamsClient {
    config: DurableStreamsConfig,
    http: Client,
}

impl DurableStreamsClient {
    /// Create a new client
    pub fn new(config: DurableStreamsConfig) -> Result<Self, DurableStreamsError> {
        let http = Client::builder()
            .timeout(config.timeout)
            .user_agent(&config.user_agent)
            .build()?;

        Ok(Self { config, http })
    }

    /// Create a new client with shared ownership
    pub fn new_shared(config: DurableStreamsConfig) -> Result<Arc<Self>, DurableStreamsError> {
        Ok(Arc::new(Self::new(config)?))
    }

    /// Create a stream (PUT)
    ///
    /// Creates a new stream at the given path. Idempotent - returns Ok if stream
    /// already exists with matching configuration.
    pub async fn create_stream(
        &self,
        path: &str,
        content_type: ContentType,
    ) -> Result<String, DurableStreamsError> {
        let url = self.config.stream_url(path);

        let response = self
            .http
            .put(&url)
            .header("Content-Type", content_type.as_mime())
            .send()
            .await?;

        let status = response.status().as_u16();

        match status {
            200 | 201 | 204 => {
                // Stream created or already exists
                let next_offset = response
                    .headers()
                    .get("Stream-Next-Offset")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("0")
                    .to_string();
                Ok(next_offset)
            }
            409 => Err(DurableStreamsError::ContentTypeMismatch {
                expected: content_type.as_mime().into(),
                actual: "existing stream has different content type".into(),
            }),
            _ => {
                let message = response.text().await.unwrap_or_default();
                Err(DurableStreamsError::CreateFailed {
                    path: path.into(),
                    status,
                    message,
                })
            }
        }
    }

    /// Append data to a stream (POST)
    ///
    /// Returns the new tail offset after the append.
    pub async fn append(&self, path: &str, data: &[u8]) -> Result<String, DurableStreamsError> {
        let url = self.config.stream_url(path);

        let response = self
            .http
            .post(&url)
            .header("Content-Type", "application/json")
            .body(data.to_vec())
            .send()
            .await?;

        let status = response.status().as_u16();

        match status {
            200 | 204 => {
                let next_offset = response
                    .headers()
                    .get("Stream-Next-Offset")
                    .and_then(|v| v.to_str().ok())
                    .ok_or_else(|| DurableStreamsError::MissingHeader("Stream-Next-Offset".into()))?
                    .to_string();
                Ok(next_offset)
            }
            404 => Err(DurableStreamsError::NotFound(path.into())),
            _ => {
                let message = response.text().await.unwrap_or_default();
                Err(DurableStreamsError::AppendFailed {
                    path: path.into(),
                    status,
                    message,
                })
            }
        }
    }

    /// Append JSON value to a stream
    pub async fn append_json<T: serde::Serialize>(
        &self,
        path: &str,
        value: &T,
    ) -> Result<String, DurableStreamsError> {
        let data = serde_json::to_vec(value)?;
        self.append(path, &data).await
    }

    /// Read from a stream (GET)
    ///
    /// Reads data starting from the given offset.
    pub async fn read(&self, path: &str, offset: Offset) -> Result<ReadResult, DurableStreamsError> {
        let url = format!("{}?offset={}", self.config.stream_url(path), offset.as_query_value());

        let response = self.http.get(&url).send().await?;

        let status = response.status().as_u16();

        match status {
            200 => {
                let next_offset = response
                    .headers()
                    .get("Stream-Next-Offset")
                    .and_then(|v| v.to_str().ok())
                    .ok_or_else(|| DurableStreamsError::MissingHeader("Stream-Next-Offset".into()))?
                    .to_string();

                let up_to_date = response
                    .headers()
                    .get("Stream-Up-To-Date")
                    .and_then(|v| v.to_str().ok())
                    .map(|v| v == "true")
                    .unwrap_or(false);

                let data = response.bytes().await?.to_vec();

                Ok(ReadResult {
                    data,
                    next_offset,
                    up_to_date,
                })
            }
            404 => Err(DurableStreamsError::NotFound(path.into())),
            410 => Err(DurableStreamsError::OffsetGone(path.into())),
            _ => {
                let message = response.text().await.unwrap_or_default();
                Err(DurableStreamsError::ReadFailed {
                    path: path.into(),
                    status,
                    message,
                })
            }
        }
    }

    /// Check if a stream exists (HEAD)
    pub async fn exists(&self, path: &str) -> Result<bool, DurableStreamsError> {
        let url = self.config.stream_url(path);
        let response = self.http.head(&url).send().await?;
        Ok(response.status().is_success())
    }

    /// Get stream metadata (HEAD)
    ///
    /// Returns the current tail offset if the stream exists.
    pub async fn metadata(&self, path: &str) -> Result<Option<String>, DurableStreamsError> {
        let url = self.config.stream_url(path);
        let response = self.http.head(&url).send().await?;

        if response.status().is_success() {
            let offset = response
                .headers()
                .get("Stream-Next-Offset")
                .and_then(|v| v.to_str().ok())
                .map(String::from);
            Ok(offset)
        } else if response.status().as_u16() == 404 {
            Ok(None)
        } else {
            Err(DurableStreamsError::ReadFailed {
                path: path.into(),
                status: response.status().as_u16(),
                message: "HEAD request failed".into(),
            })
        }
    }

    /// Delete a stream (DELETE)
    pub async fn delete(&self, path: &str) -> Result<(), DurableStreamsError> {
        let url = self.config.stream_url(path);
        let response = self.http.delete(&url).send().await?;

        match response.status().as_u16() {
            200 | 204 | 404 => Ok(()),
            status => {
                let message = response.text().await.unwrap_or_default();
                Err(DurableStreamsError::ReadFailed {
                    path: path.into(),
                    status,
                    message,
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_offset_query_value() {
        assert_eq!(Offset::Beginning.as_query_value(), "-1");
        assert_eq!(Offset::At("123_456".into()).as_query_value(), "123_456");
    }

    #[test]
    fn test_content_type_mime() {
        assert_eq!(ContentType::Json.as_mime(), "application/json");
        assert_eq!(ContentType::Binary.as_mime(), "application/octet-stream");
        assert_eq!(ContentType::Text.as_mime(), "text/plain");
    }
}
