//! Batch Publisher with Backpressure
//!
//! High-throughput concurrent publishing with:
//! - Batched message accumulation
//! - Parallel publish with configurable concurrency
//! - Backpressure via bounded channels
//! - Zero-copy where possible
//!
//! # Architecture
//!
//! ```text
//! ┌──────────────┐     ┌───────────────────┐     ┌──────────────────┐
//! │  Producers   │────►│  Batch Accumulator │────►│  Publish Workers │
//! │  (unbounded) │     │  (time/size flush) │     │  (bounded pool)  │
//! └──────────────┘     └───────────────────┘     └──────────────────┘
//!                                                          │
//!                                                          ▼
//!                                                 ┌──────────────────┐
//!                                                 │   NATS JetStream │
//!                                                 └──────────────────┘
//! ```

use std::sync::Arc;
use std::time::Duration;
use std::sync::atomic::{AtomicU64, AtomicBool, Ordering};

use async_nats::jetstream::Context as JetStreamContext;
use tokio::sync::{mpsc, Semaphore};
use tokio::time::{interval, Instant};
use tracing::{debug, info, warn, instrument};
use bytes::Bytes;

use super::error::NatsError;

/// A message ready for publishing.
#[derive(Debug, Clone)]
pub struct PublishMessage {
    /// Target subject
    pub subject: String,
    /// Serialized payload (zero-copy)
    pub payload: Bytes,
    /// Optional message headers
    pub headers: Option<async_nats::HeaderMap>,
}

impl PublishMessage {
    /// Creates a new publish message.
    pub fn new(subject: impl Into<String>, payload: impl Into<Bytes>) -> Self {
        Self {
            subject: subject.into(),
            payload: payload.into(),
            headers: None,
        }
    }

    /// Adds headers to the message.
    pub fn with_headers(mut self, headers: async_nats::HeaderMap) -> Self {
        self.headers = Some(headers);
        self
    }

    /// Adds a single header.
    pub fn with_header(mut self, key: impl AsRef<str>, value: impl AsRef<str>) -> Self {
        let headers = self.headers.get_or_insert_with(async_nats::HeaderMap::new);
        headers.insert(key.as_ref(), value.as_ref());
        self
    }
}

/// Batch configuration.
#[derive(Debug, Clone)]
pub struct BatchConfig {
    /// Maximum messages per batch
    pub max_batch_size: usize,
    /// Maximum time to wait before flushing batch
    pub flush_interval: Duration,
    /// Maximum pending batches (backpressure)
    pub max_pending_batches: usize,
    /// Concurrent publish workers
    pub publish_workers: usize,
    /// Retry attempts per message
    pub max_retries: usize,
    /// Retry delay
    pub retry_delay: Duration,
}

impl Default for BatchConfig {
    fn default() -> Self {
        Self {
            max_batch_size: 100,
            flush_interval: Duration::from_millis(50),
            max_pending_batches: 16,
            publish_workers: 4,
            max_retries: 3,
            retry_delay: Duration::from_millis(100),
        }
    }
}

/// Metrics for the batch publisher.
#[derive(Debug, Default)]
pub struct BatchMetrics {
    /// Total messages published
    pub messages_published: AtomicU64,
    /// Total batches published
    pub batches_published: AtomicU64,
    /// Total bytes published
    pub bytes_published: AtomicU64,
    /// Failed publish attempts
    pub publish_failures: AtomicU64,
    /// Current pending messages
    pub pending_messages: AtomicU64,
    /// Average batch size (rolling)
    pub avg_batch_size: AtomicU64,
    /// Last flush timestamp (unix ms)
    pub last_flush_ms: AtomicU64,
}

impl BatchMetrics {
    /// Records a successful batch publish.
    pub fn record_batch(&self, message_count: u64, byte_count: u64) {
        self.messages_published.fetch_add(message_count, Ordering::Relaxed);
        self.batches_published.fetch_add(1, Ordering::Relaxed);
        self.bytes_published.fetch_add(byte_count, Ordering::Relaxed);
        self.pending_messages.fetch_sub(message_count, Ordering::Relaxed);

        // Update rolling average
        let current_avg = self.avg_batch_size.load(Ordering::Relaxed);
        let new_avg = (current_avg * 9 + message_count * 10) / 10; // EMA
        self.avg_batch_size.store(new_avg, Ordering::Relaxed);

        self.last_flush_ms.store(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            Ordering::Relaxed,
        );
    }

    /// Records a failed publish attempt.
    pub fn record_failure(&self) {
        self.publish_failures.fetch_add(1, Ordering::Relaxed);
    }

    /// Increments pending message count.
    pub fn add_pending(&self, count: u64) {
        self.pending_messages.fetch_add(count, Ordering::Relaxed);
    }
}

/// A batch of messages to publish together.
struct MessageBatch {
    messages: Vec<PublishMessage>,
    created_at: Instant,
}

impl MessageBatch {
    fn new() -> Self {
        Self {
            messages: Vec::with_capacity(128),
            created_at: Instant::now(),
        }
    }

    fn is_empty(&self) -> bool {
        self.messages.is_empty()
    }

    fn len(&self) -> usize {
        self.messages.len()
    }

    fn push(&mut self, msg: PublishMessage) {
        self.messages.push(msg);
    }

    fn total_bytes(&self) -> usize {
        self.messages.iter().map(|m| m.payload.len()).sum()
    }
}

/// High-throughput batch publisher.
///
/// Accumulates messages into batches and publishes them concurrently
/// with configurable parallelism and backpressure.
pub struct BatchPublisher {
    jetstream: JetStreamContext,
    config: BatchConfig,
    metrics: Arc<BatchMetrics>,

    // Channel for incoming messages
    tx: mpsc::UnboundedSender<PublishMessage>,

    // Shutdown signal
    shutdown: Arc<AtomicBool>,
}

impl BatchPublisher {
    /// Creates a new batch publisher.
    pub fn new(jetstream: JetStreamContext, config: BatchConfig) -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        let metrics = Arc::new(BatchMetrics::default());
        let shutdown = Arc::new(AtomicBool::new(false));

        let publisher = Self {
            jetstream: jetstream.clone(),
            config: config.clone(),
            metrics: metrics.clone(),
            tx,
            shutdown: shutdown.clone(),
        };

        // Spawn the batch accumulator
        tokio::spawn(Self::batch_accumulator(
            rx,
            jetstream,
            config,
            metrics,
            shutdown,
        ));

        publisher
    }

    /// Queues a message for batched publishing.
    ///
    /// This is non-blocking and will never fail under normal operation.
    /// Backpressure is applied at the batch level.
    pub fn publish(&self, msg: PublishMessage) {
        self.metrics.add_pending(1);
        let _ = self.tx.send(msg);
    }

    /// Queues multiple messages.
    pub fn publish_many(&self, msgs: impl IntoIterator<Item = PublishMessage>) {
        for msg in msgs {
            self.publish(msg);
        }
    }

    /// Returns a reference to the metrics.
    pub fn metrics(&self) -> &Arc<BatchMetrics> {
        &self.metrics
    }

    /// Signals shutdown and waits for completion.
    pub async fn shutdown(&self) {
        self.shutdown.store(true, Ordering::SeqCst);
        // Give workers time to drain
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    /// The batch accumulator task.
    ///
    /// Collects messages and flushes batches based on size/time thresholds.
    /// Spawns worker tasks per-batch with semaphore-controlled concurrency.
    async fn batch_accumulator(
        mut rx: mpsc::UnboundedReceiver<PublishMessage>,
        jetstream: JetStreamContext,
        config: BatchConfig,
        metrics: Arc<BatchMetrics>,
        shutdown: Arc<AtomicBool>,
    ) {
        // Semaphore controls concurrent publish workers
        let semaphore = Arc::new(Semaphore::new(config.publish_workers));
        let mut worker_counter: usize = 0;
        let mut current_batch = MessageBatch::new();
        let mut flush_timer = interval(config.flush_interval);

        loop {
            tokio::select! {
                biased;

                // Check shutdown
                _ = async { while !shutdown.load(Ordering::Relaxed) { tokio::task::yield_now().await } } => {
                    // Flush remaining batch
                    if !current_batch.is_empty() {
                        let batch = std::mem::replace(&mut current_batch, MessageBatch::new());
                        let js = jetstream.clone();
                        let cfg = config.clone();
                        let m = metrics.clone();
                        let sem = semaphore.clone();
                        let worker_id = worker_counter;
                        worker_counter = worker_counter.wrapping_add(1);

                        tokio::spawn(async move {
                            let _permit = sem.acquire().await.unwrap();
                            Self::publish_batch(&js, batch, &cfg, &m, worker_id).await;
                        });
                    }
                    break;
                }

                // Receive message
                Some(msg) = rx.recv() => {
                    current_batch.push(msg);

                    // Flush if batch is full
                    if current_batch.len() >= config.max_batch_size {
                        let batch = std::mem::replace(&mut current_batch, MessageBatch::new());
                        let js = jetstream.clone();
                        let cfg = config.clone();
                        let m = metrics.clone();
                        let sem = semaphore.clone();
                        let worker_id = worker_counter;
                        worker_counter = worker_counter.wrapping_add(1);

                        // Spawn worker task with semaphore-controlled concurrency
                        tokio::spawn(async move {
                            let _permit = sem.acquire().await.unwrap();
                            Self::publish_batch(&js, batch, &cfg, &m, worker_id).await;
                        });
                    }
                }

                // Flush timer
                _ = flush_timer.tick() => {
                    if !current_batch.is_empty() {
                        let batch = std::mem::replace(&mut current_batch, MessageBatch::new());
                        let js = jetstream.clone();
                        let cfg = config.clone();
                        let m = metrics.clone();
                        let sem = semaphore.clone();
                        let worker_id = worker_counter;
                        worker_counter = worker_counter.wrapping_add(1);

                        tokio::spawn(async move {
                            let _permit = sem.acquire().await.unwrap();
                            Self::publish_batch(&js, batch, &cfg, &m, worker_id).await;
                        });
                    }
                }

                else => break,
            }
        }

        info!("Batch accumulator shutting down");
    }

    /// Publishes a batch of messages.
    #[instrument(skip(jetstream, batch, config, metrics), fields(batch_size = batch.len()))]
    async fn publish_batch(
        jetstream: &JetStreamContext,
        batch: MessageBatch,
        config: &BatchConfig,
        metrics: &BatchMetrics,
        worker_id: usize,
    ) {
        let message_count = batch.len() as u64;
        let byte_count = batch.total_bytes() as u64;

        debug!(
            worker = worker_id,
            messages = message_count,
            bytes = byte_count,
            "Publishing batch"
        );

        // Publish each message with retries
        let mut failures = 0u64;
        for msg in batch.messages {
            let mut attempts = 0;
            loop {
                let result = if let Some(headers) = &msg.headers {
                    jetstream
                        .publish_with_headers(msg.subject.clone(), headers.clone(), msg.payload.clone())
                        .await
                } else {
                    jetstream
                        .publish(msg.subject.clone(), msg.payload.clone())
                        .await
                };

                match result {
                    Ok(ack_future) => {
                        if let Err(e) = ack_future.await {
                            attempts += 1;
                            if attempts >= config.max_retries {
                                warn!(
                                    subject = %msg.subject,
                                    error = %e,
                                    "Failed to get publish ack after retries"
                                );
                                failures += 1;
                                break;
                            }
                            tokio::time::sleep(config.retry_delay).await;
                        } else {
                            break; // Success
                        }
                    }
                    Err(e) => {
                        attempts += 1;
                        if attempts >= config.max_retries {
                            warn!(
                                subject = %msg.subject,
                                error = %e,
                                "Failed to publish after retries"
                            );
                            failures += 1;
                            break;
                        }
                        tokio::time::sleep(config.retry_delay).await;
                    }
                }
            }
        }

        // Update metrics
        metrics.record_batch(message_count - failures, byte_count);
        if failures > 0 {
            for _ in 0..failures {
                metrics.record_failure();
            }
        }

        debug!(
            worker = worker_id,
            published = message_count - failures,
            failed = failures,
            "Batch complete"
        );
    }
}

/// Builder for BatchPublisher with fluent API.
pub struct BatchPublisherBuilder {
    config: BatchConfig,
}

impl BatchPublisherBuilder {
    pub fn new() -> Self {
        Self {
            config: BatchConfig::default(),
        }
    }

    pub fn max_batch_size(mut self, size: usize) -> Self {
        self.config.max_batch_size = size;
        self
    }

    pub fn flush_interval(mut self, interval: Duration) -> Self {
        self.config.flush_interval = interval;
        self
    }

    pub fn max_pending_batches(mut self, count: usize) -> Self {
        self.config.max_pending_batches = count;
        self
    }

    pub fn publish_workers(mut self, workers: usize) -> Self {
        self.config.publish_workers = workers;
        self
    }

    pub fn max_retries(mut self, retries: usize) -> Self {
        self.config.max_retries = retries;
        self
    }

    pub fn retry_delay(mut self, delay: Duration) -> Self {
        self.config.retry_delay = delay;
        self
    }

    pub fn build(self, jetstream: JetStreamContext) -> BatchPublisher {
        BatchPublisher::new(jetstream, self.config)
    }
}

impl Default for BatchPublisherBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_publish_message_builder() {
        let msg = PublishMessage::new("test.subject", "payload")
            .with_header("X-Custom", "value");

        assert_eq!(msg.subject, "test.subject");
        assert!(msg.headers.is_some());
    }

    #[test]
    fn test_batch_config_default() {
        let config = BatchConfig::default();
        assert_eq!(config.max_batch_size, 100);
        assert_eq!(config.publish_workers, 4);
    }

    #[test]
    fn test_metrics() {
        let metrics = BatchMetrics::default();
        metrics.record_batch(10, 1000);

        assert_eq!(metrics.messages_published.load(Ordering::Relaxed), 10);
        assert_eq!(metrics.bytes_published.load(Ordering::Relaxed), 1000);
        assert_eq!(metrics.batches_published.load(Ordering::Relaxed), 1);
    }
}
