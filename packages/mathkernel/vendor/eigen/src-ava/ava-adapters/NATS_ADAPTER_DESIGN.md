# NatsAdapter Design Document

## Overview

The NatsAdapter bridges AVA's internal artifact broadcast to NATS JetStream, enabling frontend consumption via Connection Ports.

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ReconcilerV2 (existing)                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ recompute_and_broadcast()                                   │ │
│  │   └── ViewBroadcaster::broadcast(artifact)                  │ │
│  │         └── tokio::sync::broadcast::Sender<ViewArtifact>    │ │
│  └─────────────────────────────┬──────────────────────────────┘ │
└────────────────────────────────┼────────────────────────────────┘
                                 │ subscribe
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NatsPublisher (NEW)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ - Receives artifacts from broadcast channel                 │ │
│  │ - Serializes to JSON                                        │ │
│  │ - Publishes to JetStream: tmnl.ava.artifacts.{view_id}      │ │
│  └─────────────────────────────┬──────────────────────────────┘ │
└────────────────────────────────┼────────────────────────────────┘
                                 │ JetStream publish
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NATS JetStream                              │
│  Stream: TMNL_AVA                                                │
│  Subjects: tmnl.ava.artifacts.* | tmnl.ava.deltas.*              │
└─────────────────────────────────────────────────────────────────┘
```

## NATS Subject Patterns

| Subject Pattern | Payload | Purpose |
|----------------|---------|---------|
| `tmnl.ava.artifacts.{view_id}` | ViewArtifact JSON | Full view state |
| `tmnl.ava.deltas.{view_id}` | ViewDelta JSON | Incremental updates |
| `tmnl.ava.status.{view_id}` | ReconcilerEvent | Lifecycle events |
| `tmnl.ava.invalidate.{view_id}` | InvalidationRequest | Trigger recompute |

## Files to Create

### 1. `ava-adapters/src/nats/mod.rs`
Module root with re-exports.

### 2. `ava-adapters/src/nats/config.rs`
NATS connection configuration.

```rust
pub struct NatsConfig {
    /// NATS server URL (e.g., "localhost:4222")
    pub server_url: String,
    /// JetStream stream name
    pub stream_name: String,
    /// Subject prefix (default: "tmnl.ava")
    pub subject_prefix: String,
    /// Reconnect attempts (0 = infinite)
    pub max_reconnect_attempts: u32,
    /// Reconnect delay base (ms)
    pub reconnect_delay_ms: u64,
}

impl Default for NatsConfig {
    fn default() -> Self {
        Self {
            server_url: "localhost:4222".into(),
            stream_name: "TMNL_AVA".into(),
            subject_prefix: "tmnl.ava".into(),
            max_reconnect_attempts: 0,
            reconnect_delay_ms: 100,
        }
    }
}
```

### 3. `ava-adapters/src/nats/publisher.rs`
The core publisher that listens to ViewBroadcaster and publishes to NATS.

```rust
use async_nats::jetstream::{self, Context as JetStreamContext};
use tokio::sync::broadcast;
use ava_domain::views::ViewArtifact;

pub struct NatsPublisher {
    jetstream: JetStreamContext,
    subject_prefix: String,
}

impl NatsPublisher {
    pub async fn new(config: NatsConfig) -> Result<Self, NatsError> {
        let client = async_nats::ConnectOptions::new()
            .event_callback(|event| async move {
                tracing::debug!("NATS event: {:?}", event);
            })
            .connect(&config.server_url)
            .await?;

        let jetstream = async_nats::jetstream::new(client);

        // Ensure stream exists
        jetstream.get_or_create_stream(jetstream::stream::Config {
            name: config.stream_name.clone(),
            subjects: vec![format!("{}.*.*", config.subject_prefix)],
            retention: jetstream::stream::RetentionPolicy::WorkQueue,
            max_messages: 100_000,
            ..Default::default()
        }).await?;

        Ok(Self {
            jetstream,
            subject_prefix: config.subject_prefix,
        })
    }

    /// Subscribes to ViewBroadcaster and publishes artifacts to NATS
    pub async fn run(
        &self,
        mut rx: broadcast::Receiver<ViewArtifact>,
    ) -> Result<(), NatsError> {
        loop {
            match rx.recv().await {
                Ok(artifact) => {
                    self.publish_artifact(&artifact).await?;
                }
                Err(broadcast::error::RecvError::Lagged(n)) => {
                    tracing::warn!("NatsPublisher lagged {} messages", n);
                }
                Err(broadcast::error::RecvError::Closed) => {
                    tracing::info!("ViewBroadcaster closed, shutting down");
                    break;
                }
            }
        }
        Ok(())
    }

    async fn publish_artifact(&self, artifact: &ViewArtifact) -> Result<(), NatsError> {
        let subject = format!(
            "{}.artifacts.{}",
            self.subject_prefix,
            artifact.view_id.as_str()
        );

        let payload = serde_json::to_vec(artifact)?;

        let ack = self.jetstream.publish(subject, payload.into()).await?;
        ack.await?;

        tracing::debug!(
            view_id = %artifact.view_id,
            version = artifact.logical_version,
            "Published artifact to NATS"
        );

        Ok(())
    }

    pub async fn publish_delta(&self, view_id: &ViewId, delta: &ViewDelta) -> Result<(), NatsError> {
        let subject = format!("{}.deltas.{}", self.subject_prefix, view_id.as_str());
        let payload = serde_json::to_vec(delta)?;

        let ack = self.jetstream.publish(subject, payload.into()).await?;
        ack.await?;

        Ok(())
    }
}
```

### 4. `ava-adapters/src/nats/subscriber.rs`
For receiving invalidation requests from frontend.

```rust
pub struct NatsSubscriber {
    jetstream: JetStreamContext,
    subject_prefix: String,
}

impl NatsSubscriber {
    /// Subscribe to invalidation requests
    pub async fn subscribe_invalidations(
        &self,
    ) -> Result<impl Stream<Item = InvalidationRequest>, NatsError> {
        let consumer = self.jetstream
            .get_stream(&self.stream_name).await?
            .create_consumer(consumer::pull::Config {
                durable_name: Some("tmnl-invalidations".into()),
                filter_subject: format!("{}.invalidate.*", self.subject_prefix),
                ..Default::default()
            })
            .await?;

        let messages = consumer.messages().await?;

        Ok(messages.filter_map(|msg| async {
            match msg {
                Ok(m) => {
                    let _ = m.ack().await;
                    serde_json::from_slice(&m.payload).ok()
                }
                Err(_) => None,
            }
        }))
    }
}
```

### 5. `ava-adapters/src/nats/error.rs`
Error types for NATS operations.

```rust
#[derive(Debug, thiserror::Error)]
pub enum NatsError {
    #[error("NATS connection failed: {0}")]
    Connection(#[from] async_nats::ConnectError),

    #[error("JetStream error: {0}")]
    JetStream(#[from] async_nats::jetstream::Error),

    #[error("Publish error: {0}")]
    Publish(#[from] async_nats::jetstream::context::PublishError),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Stream closed")]
    StreamClosed,
}
```

## ReconcilerV2 Integration

Modify `ava-reconciler/src/v2/reconciler.rs`:

```rust
// In ReconcilerV2::new() or ::with_nats()
impl ReconcilerV2 {
    pub fn with_nats(mut self, publisher: NatsPublisher) -> Self {
        // Store publisher
        self.nats_publisher = Some(publisher);

        // Spawn task that forwards from broadcast to NATS
        let rx = self.broadcaster.subscribe();
        tokio::spawn(async move {
            if let Some(pub) = &self.nats_publisher {
                pub.run(rx).await;
            }
        });

        self
    }
}
```

## Cargo.toml Changes

### `ava-adapters/Cargo.toml`

```toml
[dependencies]
# ... existing ...

# NATS
async-nats = "0.38"
tracing = "0.1"

[features]
default = []
nats = ["async-nats"]
```

### `Cargo.toml` (workspace)

```toml
[workspace.dependencies]
# ... existing ...
async-nats = "0.38"
tracing = "0.1"
```

## Testing Strategy

### Unit Tests
- `NatsConfig::default()` produces valid config
- Subject formatting is correct
- Serialization/deserialization roundtrips

### Integration Tests
- Requires running NATS server
- Use `testcontainers` for CI
- Verify artifact publish → subscribe flow

```rust
#[tokio::test]
async fn test_artifact_roundtrip() {
    // Start test NATS container
    let nats = testcontainers::images::nats::Nats::default();
    let container = nats.start().await;

    let config = NatsConfig {
        server_url: format!("localhost:{}", container.get_host_port_ipv4(4222)),
        ..Default::default()
    };

    let publisher = NatsPublisher::new(config.clone()).await.unwrap();

    // Create artifact
    let artifact = ViewArtifact { ... };

    // Publish
    publisher.publish_artifact(&artifact).await.unwrap();

    // Subscribe and verify
    let subscriber = NatsSubscriber::new(config).await.unwrap();
    let mut stream = subscriber.subscribe_artifacts("test-view").await.unwrap();

    let received = stream.next().await.unwrap();
    assert_eq!(received.view_id, artifact.view_id);
}
```

## Frontend Alignment

The NATS subject patterns align with Connection Ports:

| NATS Subject | Connection Ports streamId |
|--------------|---------------------------|
| `tmnl.ava.artifacts.map-view-1` | `tmnl.ava.artifacts.map-view-1` |
| `tmnl.ava.deltas.scene3d-2` | `tmnl.ava.deltas.scene3d-2` |

Frontend uses `useConnectionPort(streamId, schema)` → subscribes to matching NATS subject via WebSocket bridge.

## Next Steps

1. Add `async-nats` to workspace dependencies
2. Create `ava-adapters/src/nats/` module
3. Implement NatsPublisher
4. Wire into ReconcilerV2
5. Add WebSocket bridge (or use NATS WebSocket gateway)
6. Test end-to-end with frontend Connection Ports
