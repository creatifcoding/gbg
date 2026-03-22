# DataFusion IPC Bridge Architecture — Comparison Report
**Agent**: spork-analyst
**Task**: #15
**Date**: 2026-02-20

---

## Problem Statement

DataFusion is coupled to Tokio's reactor, executor, and `tokio::sync` primitives. Asupersync runs its own event loop (polling-based, no Tokio). Running DataFusion _inside_ an asupersync task is not possible without a tokio runtime present in the same thread, which would conflict with asupersync's scheduler ownership.

**Required**: A process-boundary bridge that lets asupersync actors submit queries/batches to a separate DataFusion process and receive Arrow RecordBatches back.

---

## What Asupersync Provides (Relevant Primitives)

### Unix Domain Sockets (`src/net/unix/`)

Full async Unix socket support, cancel-aware, integrated with asupersync's reactor:

```rust
// Stream socket (connection-oriented, byte stream)
let stream = UnixStream::connect("/tmp/datafusion.sock").await?;
stream.write_all(&frame).await?;  // WritePermit-safe

// Datagram socket (connectionless, message-framed)
let (a, b) = UnixDatagram::pair()?;
a.send(b"hello").await?;

// FD passing via SCM_RIGHTS ancillary (src/net/unix/ancillary.rs)
let mut ancillary = SocketAncillary::new(128);
ancillary.add_fds(&[memfd.as_raw_fd()]);
// → can pass a memfd (shared memory) FD across the process boundary
```

**Critical capability**: `SCM_RIGHTS` FD passing is fully implemented (`ancillary.rs`). This means we can pass a `memfd_create` anonymous memory mapping FD from the DataFusion process to the asupersync process — **zero-copy Arrow RecordBatch transfer** is achievable.

### Async I/O layer (`src/io/`)

- `AsyncRead` / `AsyncWrite` traits with cancel-safety docs
- `WritePermit` — cancel-safe write: uncommitted data is discarded on drop
- `BufReader` / `BufWriter` for framed protocols
- `copy_bidirectional` for proxying byte streams

**Cancel safety note**: `write_all` is NOT cancel-safe (partial writes possible). For Arrow IPC framing over the socket, use `WritePermit` or manual length-prefixed writes with explicit rollback.

### gRPC (`src/grpc/`)

Full gRPC implementation, Tokio-free (asupersync's own HTTP/2 stack):
- `ServerBuilder` + `ServerConfig` — host gRPC services
- `ChannelBuilder` — connect as client
- All 4 streaming patterns: unary, server-streaming, client-streaming, bidirectional
- `GrpcCodec` — length-prefixed framing (5-byte header: 1 flag + 4 len)
- `HealthService` — gRPC health checking
- Interceptors: auth, rate-limit, timeout, tracing, logging

**Default message size limit**: 4 MB. For large RecordBatches this needs raising via `max_recv_message_size`.

**No tokio in Cargo.toml**: QUIC/HTTP3 deps that pulled Tokio in are explicitly commented out (lines 160-166 of Cargo.toml). The gRPC stack over HTTP/2 uses asupersync's own network stack — no Tokio dependency.

---

## Arrow IPC Format: How RecordBatches Are Serialized

Arrow IPC uses a two-format serialization system:

### File Format (random access)
```
[magic: "ARROW1"]
[Schema message]
[RecordBatch messages...]  ← each is a FlatBuffer header + data buffers
[Footer: schema + batch offsets]
[Footer length: i32]
[magic: "ARROW1"]
```

### Stream Format (sequential, preferred for IPC)
```
[Schema message]            ← sent once at start
[RecordBatch message]*      ← one per batch
[EOS sentinel]              ← empty message signals end of stream
```

Each message:
```
[continuation: 0xFFFFFFFF]     4 bytes  (stream format only, distinguishes from file)
[metadata_length: i32]         4 bytes  (FlatBuffer header size)
[FlatBuffer metadata]          N bytes  (column types, offsets, lengths)
[body buffers]                 M bytes  (aligned to 8 bytes, actual column data)
```

**For zero-copy**: The body buffers are the actual column data. If transferred via `memfd` + SCM_RIGHTS, the receiver can mmap the same pages the sender allocated — no data copy at any point.

---

## Option 1: Unix Socket + Arrow IPC Stream Format

### Architecture

```
asupersync process                    DataFusion process (Tokio)
─────────────────────────────         ─────────────────────────────
SensorFusionActor
  │
  │ UnixStream::connect("/var/run/ava-fusion.sock")
  ▼
IpcClientActor (GenServer)
  │
  │ write: [4-byte len][Arrow IPC query payload]
  │ read:  [4-byte len][Arrow IPC RecordBatch stream]
  ▼
UnixStream (asupersync reactor)  ←──────── UnixListener
                                           │
                                     tokio task
                                     tokio::net::UnixListener
                                     arrow::ipc::reader::StreamReader
                                     datafusion::prelude::SessionContext
```

### Protocol

1. **Query framing**: Custom length-prefixed protocol
   - Client sends: `[u32 len][SQL query string or Arrow IPC query batch]`
   - Server responds: Arrow IPC stream format (Schema + N RecordBatch messages + EOS)

2. **Connection model**: One persistent Unix socket connection per IpcClientActor. No connection pooling needed for local IPC.

3. **Cancel safety**: If the asupersync actor is cancelled mid-read, the socket is dropped. The DataFusion side sees EOF, cancels its Tokio task. Clean shutdown both sides.

### Implementation Sketch (asupersync side)

```rust
struct IpcClientActor {
    socket_path: &'static str,
    stream: Option<UnixStream>,
}

enum IpcCall {
    Query(String),     // SQL query → returns Vec<RecordBatch>
    BatchQuery(Vec<u8>), // pre-serialized Arrow IPC query
}

impl GenServer for IpcClientActor {
    type Call = IpcCall;
    type Reply = Result<Vec<u8>, IpcError>;  // Arrow IPC bytes

    async fn on_start(&mut self, cx: &Cx) {
        self.stream = Some(
            UnixStream::connect(self.socket_path).await.unwrap()
        );
    }

    async fn handle_call(&mut self, cx: &Cx, msg: IpcCall, reply: Reply<...>) {
        let stream = self.stream.as_mut().unwrap();

        // Write query
        let query_bytes = encode_query(msg);
        let len = (query_bytes.len() as u32).to_be_bytes();
        stream.write_all(&len).await?;
        stream.write_all(&query_bytes).await?;

        // Read Arrow IPC stream response
        let mut response = Vec::new();
        loop {
            let mut len_buf = [0u8; 4];
            stream.read_exact(&mut len_buf).await?;
            let frame_len = u32::from_be_bytes(len_buf) as usize;
            if frame_len == 0 { break; }  // EOS
            let mut frame = vec![0u8; frame_len];
            stream.read_exact(&mut frame).await?;
            response.extend_from_slice(&frame);
        }

        let _ = reply.send(Ok(response));
    }
}
```

### Tradeoffs

| Property | Assessment |
|----------|-----------|
| Latency | ~5-20µs per roundtrip (loopback Unix socket) |
| Throughput | Limited by memcpy: ~3-8 GB/s on modern hardware |
| Zero-copy path | Available via SCM_RIGHTS + memfd (requires extra complexity) |
| Backpressure | Inherent: bounded socket buffer, write blocks when full |
| Connection management | Simple: one socket per actor, reconnect on close |
| Implementation cost | Low: uses existing UnixStream primitives directly |
| Cancel safety | Clean: socket drop = EOF = DataFusion task cancels |
| Lab testability | Moderate: requires mock socket or virtual I/O |

---

## Option 2: NATS as Bridge (via existing NATS cluster)

### Architecture

```
asupersync process                     DataFusion process (Tokio)
────────────────────────               ────────────────────────────
SensorFusionActor
  │
  │ NATS publish: "ava.fusion.query.{req_id}"
  │   payload: Arrow IPC query + reply_to subject
  ▼
NATS client (asupersync)  ←─── NATS cluster ──→  NATS client (Tokio)
                                                   │
                                             DataFusion worker
                                             subscribes: "ava.fusion.query.>"
                                             processes: SQL/Arrow query
                                             publishes reply to reply_to
```

### Protocol

1. Request-reply using NATS Core request/reply pattern
2. Query payload: serialized SQL string or Arrow IPC `Schema + parameters`
3. Response: Arrow IPC stream (chunked into multiple NATS messages if > 1MB, reassembled by subscriber)

### Tradeoffs

| Property | Assessment |
|----------|-----------|
| Latency | ~100-500µs per roundtrip (NATS loopback) — 10-50x worse than Unix socket |
| Throughput | NATS message size default 1MB, configurable up to 64MB; requires chunking for large batches |
| Zero-copy path | None: data is always copied through NATS server and back |
| Backpressure | NATS JetStream only; Core request/reply has no flow control |
| Connection management | Already present — reuses existing NATS infrastructure |
| Implementation cost | Medium: need chunking protocol for large RecordBatches |
| Cancel safety | Request-reply with timeout; NATS reply subject expires |
| Lab testability | Poor: requires running NATS server or mock |
| Fan-out queries | Natural: multiple DataFusion workers subscribe to same subject |

**Key disadvantage**: NATS is optimized for messaging/pub-sub, not high-throughput bulk data transfer. A 100MB RecordBatch requires ~100 1MB messages, with reassembly logic. The latency overhead (NATS round-trip vs Unix socket round-trip) is 10-50x.

**Key advantage**: If you already have a NATS cluster and multiple DataFusion workers, this provides natural load balancing via NATS queue groups.

---

## Option 3: Arrow Flight SQL (gRPC over asupersync's gRPC stack)

### What Flight SQL Is

Arrow Flight SQL is a standard Arrow-native RPC protocol built on gRPC:
- **FlightInfo**: describes a dataset (schema + endpoints to fetch from)
- **DoGet**: fetch a stream of Arrow RecordBatches for a given ticket
- **DoPut**: upload RecordBatches to the server
- **GetFlightInfo(CommandStatementQuery)**: execute SQL, get back FlightInfo
- **CreatePreparedStatement / ExecuteQuery**: prepared statement support

The wire format: Arrow IPC stream format carried inside gRPC server-streaming responses. Each gRPC response message is one Arrow IPC message.

### Architecture

```
asupersync process                      DataFusion process (Tokio)
────────────────────────                ─────────────────────────────
FlightSqlClientActor (GenServer)
  │
  │ grpc::Channel → localhost:50051
  │
  │ GetFlightInfo("SELECT ...") → FlightInfo
  │ DoGet(ticket) → Stream<FlightData>
  │   each FlightData.data_body = Arrow IPC RecordBatch
  ▼
grpc::GrpcClient (asupersync)  ←──── gRPC/HTTP2 ────→  DataFusion Flight SQL server
                                                        (arrow-flight crate, Tokio)
```

### Asupersync gRPC Readiness Assessment

From `src/grpc/`:
- `ServerBuilder` — full server hosting capability
- `ChannelBuilder` — client with connect/request timeout
- All 4 streaming patterns including server streaming (`DoGet` is server-streaming)
- `GrpcCodec` — correct 5-byte framing
- Health service
- Auth interceptors
- Default 4MB message limit — **needs raising for large RecordBatches**

**What's missing for Flight SQL**:
- No Protobuf code generation (`protoc`) integration — Flight SQL uses `.proto` definitions
- No `arrow.flight.protocol.FlightService` stub generation
- Would need manual implementation of FlightData / FlightInfo message encoding

**Practical assessment**: The gRPC _transport_ is present and mature. Flight SQL _protocol_ requires implementing the Flight proto messages manually (or via a code-gen step). The `GrpcCodec` uses raw `Bytes` payloads — you can hand-roll Flight protocol messages using FlatBuffers/protobuf directly.

### Tradeoffs

| Property | Assessment |
|----------|-----------|
| Latency | ~50-200µs per roundtrip (TCP loopback with HTTP/2 overhead) |
| Throughput | HTTP/2 flow control; initial window 1MB, configurable; ~2-5 GB/s |
| Zero-copy path | None: gRPC frames are always copied through kernel TCP buffers |
| Backpressure | HTTP/2 stream-level flow control (server streaming) |
| Connection management | HTTP/2 multiplexing: one connection, many concurrent streams |
| Implementation cost | High: Flight proto stubs + FlightData message construction |
| Cancel safety | gRPC stream cancel = `RST_STREAM` on HTTP/2; DataFusion sees cancellation |
| Lab testability | Poor: requires real TCP stack or mock |
| Standard interop | Flight SQL is a standard — any Flight client (Python, Java, R) can query |
| Distance to production | Could talk to external DataFusion cloud services, not just local |

---

## Comparison Table

| Property | Unix Socket + Arrow IPC | NATS Bridge | gRPC Flight SQL |
|----------|------------------------|-------------|-----------------|
| **Latency (local)** | 5-20µs | 100-500µs | 50-200µs |
| **Throughput** | 3-8 GB/s (copy), ~30 GB/s (zero-copy via memfd) | ~500 MB/s (1MB chunks) | 2-5 GB/s |
| **Zero-copy path** | Yes (SCM_RIGHTS + memfd) | No | No |
| **Backpressure** | Kernel socket buffer | None (Core); JetStream only | HTTP/2 flow control |
| **Implementation cost** | Low — direct UnixStream | Medium — chunking protocol | High — Flight proto stubs |
| **Cancel safety** | Excellent (socket drop = EOF) | Good (request timeout) | Good (RST_STREAM) |
| **Lab testability** | Moderate (mock socket) | Poor (needs NATS) | Poor (needs TCP) |
| **Fan-out** | Manual (multiple sockets) | Natural (queue groups) | Manual (multiple channels) |
| **Reconnection** | Simple (on_stop → retry) | Handled by NATS client | ChannelBuilder reconnect |
| **Standard interop** | None (custom protocol) | None (custom chunking) | Full Flight SQL standard |
| **Dependency on existing infra** | None | NATS cluster required | None |
| **asupersync primitive used** | UnixStream (existing) | Messaging (existing) | grpc::GrpcClient (existing) |
| **Proto/codegen needed** | No | No | Yes (Flight .proto stubs) |
| **Message size limits** | None (streaming) | 1MB default (configurable) | 4MB default (configurable) |
| **Complexity** | Low | Medium | High |

---

## Recommendation

**Use Unix Socket + Arrow IPC Stream Format** for the initial bridge.

Rationale:

1. **Lowest latency** — 5-20µs round-trip vs 50-500µs for alternatives. For a sensor fusion pipeline where readings arrive at 10-1000 Hz, this matters.

2. **Direct use of existing asupersync primitives** — `UnixStream` is already implemented, cancel-aware, and integrated with the asupersync reactor. Zero new dependencies.

3. **Zero-copy upgrade path** — The `SCM_RIGHTS` + `memfd_create` path is available via `src/net/unix/ancillary.rs`. Start with regular stream copy; upgrade to memfd when profiling identifies it as a bottleneck.

4. **Cancel safety** — Socket drop gives clean EOF to DataFusion. No dangling Tokio tasks, no leaked connections.

5. **Lab testability** — Can mock with a `UnixDatagram::pair()` or in-memory channel for unit testing the IpcClientActor.

**Defer Flight SQL** until standard interop (Python clients, external services) becomes a requirement. The gRPC stack is capable, but Flight proto stubs add implementation overhead with no latency benefit for local IPC.

**Defer NATS bridge** unless multiple DataFusion worker processes need load-balancing. For a single co-located DataFusion sidecar, NATS adds 10-50x latency overhead with no benefit.

---

## Implementation Plan (Unix Socket + Arrow IPC)

### Phase 1: Basic IPC (no zero-copy)

1. `IpcClientActor` (GenServer) — manages Unix socket connection to DataFusion sidecar
2. `DataFusionBridge` (Effect.Service or Rust service actor) — wraps query submission + response parsing
3. Protocol: `[u32 query_len][query bytes]` → `[u32 batch_len][Arrow IPC bytes]*[u32 0]`
4. Supervision: `Restart(3/60s, Exponential 100ms→5s)` — sidecar may restart

### Phase 2: Zero-copy via memfd (optional, profile-driven)

1. Allocate `memfd_create("arrow_batch", MFD_CLOEXEC)`
2. Serialize RecordBatch into memfd
3. Send memfd FD via SCM_RIGHTS over the Unix socket control channel
4. Receiver receives FD, mmaps it, constructs Arrow buffer from mmap
5. Owner sends `SIGCONT`-equivalent notification; receiver mmaps; owner can free

### Phase 3: Flight SQL (when external interop needed)

1. Generate Flight proto stubs from `arrow.flight.protocol.proto`
2. Implement `FlightServiceClient` using `grpc::GrpcClient`
3. Implement `GetFlightInfo + DoGet` call pattern
4. Raise `max_recv_message_size` in `ChannelConfig` to 64MB+

---

## Appendix: Asupersync File Reference

| Component | Location | Used For |
|-----------|----------|---------|
| Unix stream | `src/net/unix/stream.rs` | Byte-stream IPC socket |
| Unix datagram | `src/net/unix/datagram.rs` | Connectionless IPC |
| SCM_RIGHTS FD passing | `src/net/unix/ancillary.rs` | Zero-copy memfd transfer |
| Async I/O traits | `src/io/mod.rs` | Cancel-safe read/write |
| WritePermit | `src/io/write_permit.rs` | Cancel-safe write framing |
| gRPC client | `src/grpc/client.rs` | Flight SQL client channel |
| gRPC server | `src/grpc/server.rs` | Flight SQL server hosting |
| gRPC codec | `src/grpc/codec.rs` | Message framing (5-byte header) |
| gRPC streaming | `src/grpc/streaming.rs` | Server-streaming (DoGet pattern) |
