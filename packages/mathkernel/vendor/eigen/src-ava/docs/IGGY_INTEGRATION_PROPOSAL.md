# Apache Iggy Integration Proposal for AVA Runtime

> **Status**: PROPOSAL
> **Author**: Val (Architectural Conscience)
> **Date**: 2025-12-21
> **Version**: 1.0

---

## Executive Summary

This proposal outlines the integration of Apache Iggy as the unified event streaming backbone for AVA (Asset View Agent) runtime. Iggy replaces both the in-memory EventLog and tokio::broadcast-based ViewBroadcaster, enabling:

1. **Multi-process distribution** — Multiple AVA runtimes sharing view state
2. **Durability & replay** — Persistent event log with time-travel capability
3. **External consumers** — Dashboards, analytics services subscribing to artifacts

---

## Architectural Decisions (Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Integration Model** | Iggy-First | All subscribers through Iggy; microsecond latency acceptable |
| **EventLog** | Unified on Iggy | Replace in-memory EventLog; single source of truth |
| **ava-streams crate** | Direct integration | Use `iggy` crate directly in `ava-reconciler` |
| **Deployment** | External cluster | Production-grade; shared Iggy cluster for services |
| **Serialization** | Protobuf | Existing AVA protos; schema evolution; cross-language |
| **Consumer Groups** | Configurable | Sensible defaults with runtime override |

---

## Topic Structure

```
ava/
├── commands/
│   └── {view_id}/
│       └── commands         # Subscribe, Invalidate, Unsubscribe
│           ├── Partition 0  # Single partition (ordered per view)
│           └── Retention: 1 day
│
├── events/
│   └── {view_id}/
│       └── lifecycle        # SourceChanged, Recomputed, Error
│           ├── Partition 0
│           └── Retention: 7 days
│
└── artifacts/
    └── {view_id}/
        └── output           # ViewArtifact payloads
            ├── Partition 0
            └── Retention: configurable (default 7 days)
```

### Stream/Topic Naming Convention

```
Stream:  ava-{namespace}-{view_id}
Topic:   {category}  (commands | events | artifacts)
```

Example:
- Stream: `ava-prod-view-asset-summary`
- Topic: `artifacts`
- Consumer: `dashboard-user-123` (durable, per-client)
- Consumer Group: `ava-runtime-ha` (load-balanced, for HA runtimes)

---

## Consumer Mechanics (Durable Streams)

### Two Consumer Patterns

| Pattern | Iggy ConsumerKind | Use Case | Offset Storage |
|---------|-------------------|----------|----------------|
| **Durable Consumer** | `Consumer` | Per-client streams (dashboards, analytics) | Server-persisted per consumer ID |
| **Consumer Group** | `ConsumerGroup` | HA/load-balanced (multiple AVA runtimes) | Server-managed with partition assignment |

### Durable Consumer (Per-Client)

Each external client gets a **named Consumer** with server-persisted offsets:

```rust
// Dashboard client subscribing to artifacts
let consumer = Consumer {
    kind: ConsumerKind::Consumer,
    id: Identifier::from_str("dashboard-user-123")?,
};

// Resume from last offset automatically
let config = IggyConsumerConfig::builder()
    .consumer_kind(ConsumerKind::Consumer)
    .consumer_name("dashboard-user-123")
    .polling_strategy(PollingStrategy::next()) // Server tracks offset
    .auto_commit(AutoCommit::When(AutoCommitWhen::ConsumingEachMessage))
    .build();
```

**Key Properties:**
- Each client sees **ALL messages** (no partitioning)
- Client reconnects resume from stored offset
- Offset persisted on server (survives client restart)
- Independent consumption (clients don't affect each other)

### Consumer Group (HA/Load-Balanced)

Multiple AVA runtimes share a **Consumer Group** for high availability:

```rust
// Multiple AVA runtimes join same group
let config = IggyConsumerConfig::builder()
    .consumer_kind(ConsumerKind::ConsumerGroup)
    .consumer_name("ava-runtime-ha")
    .create_consumer_group_if_not_exists(true)
    .auto_join_consumer_group(true)
    .build();
```

**Key Properties:**
- Partitions distributed across group members
- Only ONE member processes each message (no duplicates)
- Rebalancing on member join/leave
- Used for AVA runtime HA, NOT for external clients

### Offset Management

```rust
// AutoCommit strategies
pub enum AutoCommit {
    Disabled,                              // Manual offset control
    Interval(IggyDuration),                // Commit every N ms
    When(AutoCommitWhen),                  // Commit on specific events
    After(AutoCommitAfter),                // Commit after processing
}

pub enum AutoCommitWhen {
    PollingMessages,                       // On poll (before processing)
    ConsumingAllMessages,                  // After batch processed
    ConsumingEachMessage,                  // Per-message (safest)
    ConsumingEveryNthMessage(u32),         // Every N messages
}
```

### Topic Structure (Revised for Durable Streams)

```
ava/
├── views/
│   └── {view_id}/
│       ├── commands         # Single partition (ordered)
│       │   └── Consumers: [ava-reconciler-{instance}]
│       │
│       ├── events           # Single partition (ordered)
│       │   └── Consumers: [dashboard-*, analytics-*, debugger-*]
│       │
│       └── artifacts        # Single partition (ordered)
│           └── Consumers: [dashboard-user-123, analytics-batch, ...]
│
└── global/
    ├── all-events           # Fan-out topic for global subscribers
    │   └── Multi-partition (high throughput)
    │
    └── health               # System health events
        └── Consumers: [monitoring-prometheus, alerting-*]
```

### Client Registration Flow

```
┌─────────────────────┐
│ Client Connects     │
│ (Dashboard, etc.)   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│ Create Consumer     │────▶│ Iggy Server         │
│ ID: client-{uuid}   │     │ - Registers consumer│
└─────────┬───────────┘     │ - Creates offset=0  │
          │                 └─────────────────────┘
          ▼
┌─────────────────────┐
│ Subscribe to Topic  │
│ PollingStrategy::   │
│   next() or offset()│
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│ Poll Messages       │────▶│ Server returns      │
│ auto_commit: true   │     │ - Messages from     │
└─────────────────────┘     │   stored offset     │
                            │ - Updates offset    │
                            └─────────────────────┘
```

---

## Message Schemas

### Proto Definitions (extend existing)

```protobuf
// proto/ava/messaging/v1/commands.proto

syntax = "proto3";
package ava.messaging.v1;

import "ava/common/v1/common.proto";
import "ava/registry/v1/registry.proto";

message AvaCommand {
  oneof command {
    SubscribeCommand subscribe = 1;
    InvalidateCommand invalidate = 2;
    UnsubscribeCommand unsubscribe = 3;
  }

  string correlation_id = 10;
  int64 timestamp_ms = 11;
}

message SubscribeCommand {
  ava.registry.v1.ViewProfileSpec spec = 1;
  string consumer_id = 2;
}

message InvalidateCommand {
  string view_id = 1;
  optional string reason = 2;
}

message UnsubscribeCommand {
  string view_id = 1;
  string consumer_id = 2;
}
```

```protobuf
// proto/ava/messaging/v1/events.proto

syntax = "proto3";
package ava.messaging.v1;

import "ava/common/v1/common.proto";
import "ava/artifacts/v1/artifacts.proto";

message AvaEvent {
  oneof event {
    ViewRequestedEvent view_requested = 1;
    SourceChangedEvent source_changed = 2;
    ViewRecomputedEvent view_recomputed = 3;
    ViewMountedEvent view_mounted = 4;
    ViewUnmountedEvent view_unmounted = 5;
    ViewErrorEvent view_error = 6;
  }

  string view_id = 10;
  int64 timestamp_ms = 11;
  uint64 sequence_number = 12;
}

message ViewRequestedEvent {
  ava.registry.v1.ViewProfileSpec spec = 1;
  string requester_id = 2;
}

message SourceChangedEvent {
  string source_id = 1;
  repeated string affected_view_ids = 2;
}

message ViewRecomputedEvent {
  double duration_ms = 1;
  uint64 logical_version = 2;
}

message ViewMountedEvent {
  ava.artifacts.v1.ViewArtifact artifact = 1;
}

message ViewUnmountedEvent {
  string reason = 1;
}

message ViewErrorEvent {
  string error_code = 1;
  string error_message = 2;
  optional string stack_trace = 3;
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AVA Runtime                                     │
│                                                                              │
│  ┌─────────────────┐     ┌──────────────────────┐                           │
│  │ gRPC/REST API   │────▶│   IggyCommandSink    │──────┐                    │
│  │ (ava-api)       │     │   (Producer)         │      │                    │
│  └─────────────────┘     └──────────────────────┘      │                    │
│                                                         │                    │
│  ┌─────────────────────────────────────────────┐       │                    │
│  │              ReconcilerV2 (Iggy-ified)      │       │                    │
│  │                                              │       │                    │
│  │  ┌────────────────┐   ┌────────────────┐   │       │                    │
│  │  │ CommandSource  │   │ EventSink      │   │       │                    │
│  │  │ (Consumer)     │   │ (Producer)     │───┼───────┤                    │
│  │  └───────┬────────┘   └────────────────┘   │       │                    │
│  │          │                                  │       │                    │
│  │          ▼                                  │       │                    │
│  │  ┌────────────────┐   ┌────────────────┐   │       │                    │
│  │  │ TriggerEngine  │──▶│ ArtifactSink   │───┼───────┤                    │
│  │  │ (recompute)    │   │ (Producer)     │   │       │                    │
│  │  └────────────────┘   └────────────────┘   │       │                    │
│  │                                              │       │                    │
│  └─────────────────────────────────────────────┘       │                    │
│                                                         │                    │
└─────────────────────────────────────────────────────────┼────────────────────┘
                                                          │
                                                          ▼
                                               ┌────────────────────┐
                                               │   Iggy Cluster     │
                                               │   (External)       │
                                               │                    │
                                               │  ┌──────────────┐  │
                                               │  │ ava/commands │  │
                                               │  │ ava/events   │  │
                                               │  │ ava/artifacts│  │
                                               │  └──────────────┘  │
                                               │                    │
                                               └─────────┬──────────┘
                                                         │
                    ┌────────────────────────────────────┼────────────────────────────────────┐
                    │                                    │                                    │
                    ▼                                    ▼                                    ▼
         ┌─────────────────────┐            ┌─────────────────────┐            ┌─────────────────────┐
         │  AVA Runtime #2     │            │  Web Dashboard      │            │  Analytics Service  │
         │  (consumer group:   │            │  (consumer group:   │            │  (consumer group:   │
         │   ava-runtime-ha)   │            │   dashboard-web)    │            │   analytics-batch)  │
         │                     │            │                     │            │                     │
         │  CommandSource ────▶│            │  ArtifactSource ───▶│            │  ArtifactSource ───▶│
         │  for HA failover    │            │  for live updates   │            │  for aggregation    │
         └─────────────────────┘            └─────────────────────┘            └─────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (ava-iggy crate)

Create `ava-iggy` crate with:
- Iggy client configuration from environment/config
- Topic naming utilities
- Protobuf serialization/deserialization wrappers
- Connection management and reconnection

```rust
// ava-iggy/src/lib.rs

pub mod config;
pub mod topics;
pub mod producers;
pub mod consumers;

// Re-export iggy prelude
pub use iggy::prelude::*;
```

**Key Types:**
```rust
pub struct AvaIggyConfig {
    pub connection_string: String,  // iggy://user:pass@host:port
    pub namespace: String,          // e.g., "prod", "staging"
    pub consumer_group_prefix: String,
    pub default_retention_days: u32,
}

pub struct TopicPath {
    pub stream: String,
    pub topic: String,
}

impl TopicPath {
    pub fn commands(namespace: &str, view_id: &str) -> Self { ... }
    pub fn events(namespace: &str, view_id: &str) -> Self { ... }
    pub fn artifacts(namespace: &str, view_id: &str) -> Self { ... }
}
```

### Phase 2: Producers (CommandSink, EventSink, ArtifactSink)

```rust
// ava-iggy/src/producers/artifact_sink.rs

pub struct ArtifactSink {
    producer: IggyProducer,
    config: AvaIggyConfig,
}

impl ArtifactSink {
    pub async fn publish(&self, artifact: &ViewArtifact) -> Result<(), IggyError> {
        let topic = TopicPath::artifacts(&self.config.namespace, &artifact.view_id.0);
        let payload = artifact.encode_to_vec(); // prost
        let message = IggyMessage::new(None, payload, None);
        self.producer.send_one(message).await
    }
}
```

### Phase 3: Consumers (CommandSource, EventSource, ArtifactSource)

```rust
// ava-iggy/src/consumers/command_source.rs

pub struct CommandSource {
    consumer: IggyConsumer,
    config: AvaIggyConfig,
}

impl CommandSource {
    pub async fn consume<F>(&mut self, handler: F, shutdown: oneshot::Receiver<()>) -> Result<(), IggyError>
    where
        F: Fn(AvaCommand) -> Pin<Box<dyn Future<Output = Result<(), AvaError>> + Send>>,
    {
        // Wrap handler to deserialize protobuf
        let proto_handler = |msg: ReceivedMessage| async {
            let cmd = AvaCommand::decode(msg.payload.as_slice())?;
            handler(cmd).await
        };

        self.consumer.consume_messages(&proto_handler, shutdown).await
    }
}
```

### Phase 4: ReconcilerV2 Integration

Replace internal event loop with Iggy-backed command processing:

```rust
// ava-reconciler/src/v2/reconciler_iggy.rs

pub struct ReconcilerV2Iggy {
    config: ReconcilerConfigV2,
    command_source: CommandSource,
    event_sink: EventSink,
    artifact_sink: ArtifactSink,
    fibers: Arc<RwLock<HashMap<ViewId, ViewFiberV2>>>,
}

impl ReconcilerV2Iggy {
    pub async fn run(&mut self) -> Result<(), AvaError> {
        let (shutdown_tx, shutdown_rx) = oneshot::channel();

        // Main event loop - consume commands from Iggy
        self.command_source.consume(|cmd| async {
            match cmd.command {
                Some(Command::Subscribe(sub)) => {
                    self.handle_subscribe(sub).await?;
                }
                Some(Command::Invalidate(inv)) => {
                    self.handle_invalidate(inv).await?;
                }
                Some(Command::Unsubscribe(unsub)) => {
                    self.handle_unsubscribe(unsub).await?;
                }
                None => {}
            }
            Ok(())
        }, shutdown_rx).await
    }

    async fn handle_subscribe(&self, cmd: SubscribeCommand) -> Result<(), AvaError> {
        // Create fiber, register triggers
        // ...

        // Emit event
        self.event_sink.publish(AvaEvent {
            event: Some(Event::ViewRequested(ViewRequestedEvent {
                spec: Some(cmd.spec),
                requester_id: cmd.consumer_id,
            })),
            view_id: spec.id.clone(),
            timestamp_ms: now_ms(),
            sequence_number: next_seq(),
        }).await?;

        Ok(())
    }

    async fn recompute_and_publish(&self, view_id: &ViewId) -> Result<(), AvaError> {
        let start = Instant::now();

        // Compute artifact
        let artifact = self.compute_artifact(view_id).await?;

        // Publish to Iggy
        self.artifact_sink.publish(&artifact).await?;

        // Emit recomputed event
        self.event_sink.publish(AvaEvent {
            event: Some(Event::ViewRecomputed(ViewRecomputedEvent {
                duration_ms: start.elapsed().as_secs_f64() * 1000.0,
                logical_version: artifact.logical_version,
            })),
            view_id: view_id.0.clone(),
            timestamp_ms: now_ms(),
            sequence_number: next_seq(),
        }).await?;

        Ok(())
    }
}
```

### Phase 5: Migration Path

1. **Parallel operation**: Run both old (broadcast) and new (Iggy) paths during transition
2. **Feature flag**: `RECONCILER_BACKEND=iggy|broadcast`
3. **Gradual rollout**: Start with non-critical views
4. **Validation**: Compare artifact hashes between paths
5. **Cutover**: Disable broadcast path after validation

---

## Configuration

### Environment Variables

```bash
# Iggy connection
AVA_IGGY_URL=iggy://ava:secret@iggy.cluster.local:8090
AVA_IGGY_NAMESPACE=prod

# Consumer group
AVA_CONSUMER_GROUP=ava-runtime-$(hostname)

# Retention
AVA_ARTIFACT_RETENTION_DAYS=7
AVA_EVENT_RETENTION_DAYS=30

# Feature flags
AVA_RECONCILER_BACKEND=iggy  # or "broadcast" for legacy
```

### Rust Config Struct

```rust
#[derive(Debug, Clone, Deserialize)]
pub struct AvaIggyConfig {
    #[serde(default = "default_url")]
    pub url: String,

    #[serde(default = "default_namespace")]
    pub namespace: String,

    #[serde(default = "default_consumer_group")]
    pub consumer_group: String,

    #[serde(default = "default_retention")]
    pub artifact_retention_days: u32,

    #[serde(default = "default_retention")]
    pub event_retention_days: u32,
}
```

---

## Testing Strategy

### Unit Tests

- Topic path generation
- Protobuf serialization roundtrip
- Config parsing

### Integration Tests

- Producer → Consumer roundtrip (local Iggy)
- Consumer group partition assignment
- Reconnection handling
- Offset commit verification

### E2E Tests

- Full reconciler flow via Iggy
- Multi-runtime HA failover
- Late subscriber catch-up
- Back-pressure handling

### Test Infrastructure

```bash
# docker-compose.test.yml
services:
  iggy:
    image: apache/iggy:latest
    ports:
      - "8090:8090"
    volumes:
      - iggy-data:/data
```

---

## Operational Considerations

### Monitoring

- Iggy metrics endpoint (Prometheus)
- Consumer lag alerts
- Message throughput dashboards
- Error rate tracking

### Backup & Recovery

- Iggy persistence to durable storage
- Snapshot exports for disaster recovery
- Consumer offset checkpoints

### Scaling

- Horizontal: Add partitions for high-throughput views
- Vertical: Iggy's io_uring scales with cores
- Consumer groups: Auto-balanced partition assignment

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Iggy cluster unavailable | Low | High | Circuit breaker, local fallback queue |
| Consumer lag causing delays | Medium | Medium | Monitoring, auto-scaling consumers |
| Protobuf schema incompatibility | Low | Medium | Schema registry, versioned topics |
| Network partition | Low | High | Iggy clustering, multi-AZ deployment |

---

## Success Criteria

1. **Functional**: All existing ReconcilerV2 tests pass with Iggy backend
2. **Performance**: Artifact delivery latency < 10ms P99
3. **Durability**: 100% message delivery guarantee
4. **Scalability**: 2+ AVA runtimes consuming same view
5. **Observability**: Full event trace in Iggy topics

---

## Timeline Estimate

| Phase | Scope | Estimate |
|-------|-------|----------|
| 1. Foundation | ava-iggy crate | 1 sprint |
| 2. Producers | Sinks | 1 sprint |
| 3. Consumers | Sources | 1 sprint |
| 4. Integration | ReconcilerV2Iggy | 2 sprints |
| 5. Migration | Parallel + cutover | 1 sprint |

**Total**: ~6 sprints

---

## Next Steps

1. Create beads for Phase 1 tasks
2. Add `iggy` dependency to workspace
3. Define proto messages for commands/events
4. Implement ava-iggy crate skeleton
5. Set up integration test infrastructure

---

## References

- [Apache Iggy Documentation](https://iggy.apache.org/docs/)
- [Iggy Rust SDK](https://github.com/apache/iggy/tree/main/core/sdk)
- [AVA Architecture v2](./ARCHITECTURE_V2.md)
- [AVA Proto Definitions](../proto/ava/)
