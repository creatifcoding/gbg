# AVA Fusion Live Ingestion Architecture Plan

> **Status**: Architecture Plan
> **Date**: 2026-02-21
> **Scope**: ava-web as real HTTP/WebSocket ingestion layer feeding the TMNL IIoT pipeline
> **Key Insight**: asupersync v0.2.5 ships native NATS client — zero bridge processes needed

---

## 1. System Overview

ava-web becomes the edge-facing ingestion gateway for IIoT sensor data. Devices push
telemetry via HTTP POST or persistent WebSocket connections. ava-web validates, authenticates,
and publishes directly to NATS using asupersync's native `NatsClient`. The existing TMNL
IIoT pipeline (HolonetBridge + EventDistribution) subscribes to the same NATS subjects
without modification.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Edge / Field Devices                                │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────────────┐   │
│  │  PLC/RTU  │  │  Gateway  │  │  Sensor   │  │  Bulk CSV Uploader    │   │
│  │  (HTTP)   │  │  (WS)     │  │  (HTTP)   │  │  (multipart)          │   │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └──────────┬────────────┘   │
│        │              │              │                    │                 │
└────────┼──────────────┼──────────────┼────────────────────┼─────────────────┘
         │              │              │                    │
         ▼              ▼              ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ava-web  (GenServer-native)                         │
│                                                                             │
│  ┌────────────────┐  ┌─────────────────┐  ┌────────────────────────────┐   │
│  │ MacaroonAuth   │  │ MetricsMiddleware│  │  RateLimitMiddleware       │   │
│  │ (device tokens)│  │ (prometheus)     │  │  (per-device)              │   │
│  └───────┬────────┘  └────────┬────────┘  └───────────┬────────────────┘   │
│          │                    │                        │                    │
│  ┌───────▼────────────────────▼────────────────────────▼────────────────┐   │
│  │                         Router                                       │   │
│  │  POST /api/v1/readings     → ReadingsIngestionHandler                │   │
│  │  POST /api/v1/alarms       → AlarmsIngestionHandler                  │   │
│  │  POST /api/v1/equipment    → EquipmentIngestionHandler               │   │
│  │  POST /api/v1/bulk         → BulkIngestionHandler (multipart)        │   │
│  │  GET  /ws/v1/telemetry     → WebSocketIngestionHandler               │   │
│  │  GET  /api/v1/health       → HealthHandler                           │   │
│  │  GET  /metrics             → MetricsHandler (prometheus)             │   │
│  │  POST /api/v1/commands     → CommandDispatchHandler (cloud→edge)     │   │
│  └───────────────────────────────┬──────────────────────────────────────┘   │
│                                  │                                          │
│  ┌───────────────────────────────▼──────────────────────────────────────┐   │
│  │                    NatsClient (asupersync native)                     │   │
│  │  client.publish(cx, subject, payload)       ← fire-and-forget        │   │
│  │  client.subscribe(cx, subject) → Subscription                        │   │
│  │  client.queue_subscribe(cx, subject, group) ← load-balanced          │   │
│  │  Bounded channel (256 msgs) for backpressure                         │   │
│  └───────────────────────────────┬──────────────────────────────────────┘   │
│                                  │                                          │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            NATS Server (JetStream)                          │
│  iiot.readings.{siteId}.{areaId}.{deviceId}    ← sensor telemetry          │
│  iiot.alarms.{siteId}.{areaId}.{deviceId}      ← alarm lifecycle           │
│  iiot.equipment.{siteId}.{areaId}.{equipmentId} ← state transitions        │
│  iiot.invalidations.{cacheKey}                  ← cache coherence           │
│  iiot.commands.{deviceId}                       ← reverse channel           │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TMNL IIoT Pipeline (existing — NO CHANGES)               │
│                                                                             │
│  ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────────┐   │
│  │  HolonetBridge   │───▶│ EventDistribution │───▶│ ChannelService      │   │
│  │  (NATS subscriber)│   │ (4 channels)      │   │ (broadcast outlets) │   │
│  └─────────────────┘    └──────────────────┘    └──────────┬───────────┘   │
│                                                             │               │
│  ┌──────────────────────────────────────────────────────────▼───────────┐   │
│  │  iiot:readings (maxLag 10K)  │  iiot:alarms (maxLag 1K)             │   │
│  │  iiot:equipment (maxLag 1K)  │  iiot:invalidations (maxLag 1K)      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Consumers: RPC handlers, WebSocket server, ReactivityBridge, Persistence  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. NATS Subject Topology

### 2.1 Extended Subject Hierarchy

The existing TMNL subjects use flat two-level addressing (`iiot.readings.{deviceId}`).
The fusion plan extends this to ISA-95-aligned hierarchical addressing for site-scoped
routing and authorization:

```
iiot.readings.{siteId}.{areaId}.{deviceId}
iiot.alarms.{siteId}.{areaId}.{deviceId}
iiot.equipment.{siteId}.{areaId}.{equipmentId}
iiot.invalidations.{cacheKey}
iiot.commands.{deviceId}
```

### 2.2 Subject Design Rationale

| Segment | Purpose | Example |
|---------|---------|---------|
| `iiot` | Domain prefix (matches existing) | `iiot` |
| `readings`/`alarms`/etc. | Event type | `readings` |
| `{siteId}` | ISA-95 L3 site identifier | `plant-north` |
| `{areaId}` | ISA-95 L2 area within site | `boiler-room` |
| `{deviceId}` | Leaf device or equipment ID | `temp-sensor-42` |

### 2.3 Wildcard Subscription Patterns

```
iiot.readings.>                          ← all readings (HolonetBridge default)
iiot.readings.plant-north.>              ← single site
iiot.readings.plant-north.boiler-room.>  ← single area
iiot.readings.plant-north.boiler-room.temp-sensor-42  ← single device
iiot.*.plant-north.>                     ← all event types for one site
```

### 2.4 Backwards Compatibility

The existing `iiot-subjects.ts` uses `iiot.readings.{deviceId}` (two-level).
The extended topology adds `{siteId}.{areaId}` as intermediate segments.
HolonetBridge's wildcard subscription (`iiot.readings.*`) must be updated to
`iiot.readings.>` (recursive wildcard) to capture both flat and hierarchical
subjects during the migration period.

**Migration strategy**: Existing subjects with flat deviceId continue to work
because `iiot.readings.>` matches any depth. New ava-web ingestion publishes
to the hierarchical form. TMNL subscribes with `>` wildcard.

---

## 3. Ingestion Handlers (GenServer Actors)

### 3.1 ReadingsIngestionActor

Stateless handler for HTTP POST `/api/v1/readings`. Validates, authenticates, publishes.

```rust
/// POST /api/v1/readings
///
/// Request body (JSON):
/// {
///   "deviceId": "temp-sensor-42",
///   "siteId": "plant-north",
///   "areaId": "boiler-room",
///   "readings": [
///     { "value": 98.6, "timestamp": "2026-02-21T10:00:00Z", "quality": "good" },
///     { "value": 99.1, "timestamp": "2026-02-21T10:00:01Z", "quality": "good" }
///   ]
/// }
///
/// Response: 202 Accepted (fire-and-forget to NATS)
/// Response: 429 Too Many Requests (NATS backpressure)
/// Response: 401 Unauthorized (missing/invalid macaroon)
/// Response: 403 Forbidden (site scope mismatch)

use serde::{Deserialize, Serialize};
use asupersync::messaging::nats::NatsClient;

#[derive(Deserialize)]
pub struct ReadingsPayload {
    pub device_id: String,
    pub site_id: String,
    pub area_id: String,
    pub readings: Vec<ReadingEntry>,
}

#[derive(Deserialize, Serialize)]
pub struct ReadingEntry {
    pub value: f64,
    pub timestamp: String,  // ISO 8601
    #[serde(default = "default_quality")]
    pub quality: String,
}

fn default_quality() -> String { "good".into() }

/// Handler — stateless, uses shared NatsClient from AppState.
async fn ingest_readings(
    auth: AuthenticatedToken,  // extracted by MacaroonAuth middleware
    State(nats): State<Arc<NatsClient>>,
    Json(payload): Json<ReadingsPayload>,
) -> impl IntoResponse {
    // 1. Validate site scope from macaroon caveats
    //    auth.token has ResourceScope caveat restricting to iiot.readings.{siteId}.**
    let subject = format!(
        "iiot.readings.{}.{}.{}",
        payload.site_id, payload.area_id, payload.device_id
    );

    // 2. Serialize readings batch to NATS payload (MessagePack for compactness)
    let nats_payload = rmp_serde::to_vec(&payload.readings)
        .map_err(|_| AppError::bad_request("serialization failed"))?;

    // 3. Publish to NATS (fire-and-forget, bounded channel backpressure)
    match nats.publish(&cx, &subject, &nats_payload).await {
        Ok(()) => StatusCode::ACCEPTED,
        Err(_) => StatusCode::TOO_MANY_REQUESTS,  // NATS bounded channel full
    }
}
```

### 3.2 WebSocketIngestionActor

Persistent WebSocket connections for streaming telemetry. Each connection is a
supervised GenServer actor that owns a NatsClient reference.

```rust
/// GET /ws/v1/telemetry → WebSocket upgrade
///
/// Protocol: Binary MessagePack frames
///
/// Client → Server frame:
/// {
///   "type": "reading" | "alarm" | "equipment",
///   "deviceId": "...",
///   "siteId": "...",
///   "areaId": "...",
///   "payload": { ... }
/// }
///
/// Server → Client frame:
/// {
///   "type": "ack" | "error" | "command",
///   "seq": u64,
///   "payload": { ... }
/// }

pub struct WsIngestionActor {
    nats: Arc<NatsClient>,
    device_id: String,
    site_id: String,
    area_id: String,
    seq: u64,
    metrics: WsIngestionMetrics,
}

struct WsIngestionMetrics {
    readings_ingested: u64,
    alarms_ingested: u64,
    errors: u64,
    last_message_at: Option<f64>,
}

impl GenServer for WsIngestionActor {
    type Call = WsCall;
    type Reply = WsReply;
    type Cast = WsCast;
    type Info = WsInfo;

    fn handle_info(
        &mut self,
        cx: &Cx,
        msg: Self::Info,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(async move {
            match msg {
                WsInfo::Frame(frame) => {
                    // Deserialize MessagePack frame
                    let msg: WsIngressFrame = match rmp_serde::from_slice(&frame) {
                        Ok(m) => m,
                        Err(_) => {
                            self.metrics.errors += 1;
                            return; // Drop malformed frames, don't kill connection
                        }
                    };

                    // Route to correct NATS subject
                    let subject = match msg.msg_type.as_str() {
                        "reading" => format!(
                            "iiot.readings.{}.{}.{}",
                            self.site_id, self.area_id, msg.device_id
                        ),
                        "alarm" => format!(
                            "iiot.alarms.{}.{}.{}",
                            self.site_id, self.area_id, msg.device_id
                        ),
                        "equipment" => format!(
                            "iiot.equipment.{}.{}.{}",
                            self.site_id, self.area_id, msg.device_id
                        ),
                        _ => {
                            self.metrics.errors += 1;
                            return;
                        }
                    };

                    // Publish to NATS — fire-and-forget
                    let _ = self.nats.publish(cx, &subject, &msg.payload).await;
                    self.seq += 1;
                    self.metrics.readings_ingested += 1;
                }
                WsInfo::System(sys) => {
                    // Handle Down/Exit/Timeout system messages
                }
            }
        })
    }

    fn cast_overflow_policy(&self) -> CastOverflowPolicy {
        CastOverflowPolicy::DropOldest // Shed stale frames under load
    }
}
```

### 3.3 BulkIngestionActor

Multipart file upload handler for batch CSV/JSON uploads.

```rust
/// POST /api/v1/bulk
///
/// Content-Type: multipart/form-data
/// Fields:
///   - file: CSV or JSON file with readings
///   - siteId: target site
///   - areaId: target area
///   - format: "csv" | "json" (default: auto-detect from filename)
///
/// Response: 202 Accepted with { "queued": <count> }

async fn ingest_bulk(
    auth: AuthenticatedToken,
    State(nats): State<Arc<NatsClient>>,
    mp: Multipart,
) -> impl IntoResponse {
    let site_id = mp.field("siteId")
        .ok_or(AppError::bad_request("missing siteId"))?
        .data_as_str();
    let area_id = mp.field("areaId")
        .ok_or(AppError::bad_request("missing areaId"))?
        .data_as_str();

    let file = mp.field("file")
        .ok_or(AppError::bad_request("missing file field"))?;

    // Parse based on content type / extension
    let readings: Vec<BulkReading> = match file.content_type.as_deref() {
        Some("text/csv") => parse_csv(&file.data)?,
        _ => serde_json::from_slice(&file.data)?,
    };

    let mut queued = 0u64;
    for reading in &readings {
        let subject = format!(
            "iiot.readings.{}.{}.{}",
            site_id, area_id, reading.device_id
        );
        let payload = rmp_serde::to_vec(reading)?;
        if nats.publish(&cx, &subject, &payload).await.is_ok() {
            queued += 1;
        }
    }

    Json(BulkResponse { queued })
}
```

---

## 4. Authentication (Macaroon Device Tokens)

### 4.1 Token Issuance

Device tokens are minted by a provisioning service (out of scope for ava-web).
Each token carries caveats that restrict the device to specific NATS subjects:

```rust
let issuer = MacaroonIssuer::new(root_key.clone(), "device:sensor-42", "ava-web");

let token = issuer.mint()
    // Time-bound: valid for 24 hours
    .time_before(now_ms + 86_400_000)
    // Site-scoped: can only publish to plant-north subjects
    .resource_scope("/api/v1/readings")
    // Custom caveats for NATS subject restriction
    .custom("site", "plant-north")
    .custom("area", "boiler-room")
    .custom("device", "temp-sensor-42")
    // Rate limit: 1000 requests per 60 seconds
    .rate_limit(1000, 60)
    .finish();

let bearer = token_to_bearer(&token);
// => "Bearer <base64>"
```

### 4.2 Verification Context

The ava-web MacaroonAuth middleware builds a `VerificationContext` that includes
the site/area/device from the request body, enabling the macaroon's custom caveats
to enforce subject-level authorization:

```rust
let auth = MacaroonAuth::with_context_builder(root_key, |req| {
    // Parse the body to extract site/area/device for caveat verification
    // NOTE: This requires buffering the body — acceptable for the JSON payloads
    // (typically < 10KB). For WebSocket, caveats are checked at upgrade time only.
    let ctx = VerificationContext::new()
        .with_time(now_ms())
        .with_resource(&req.path);

    // If body contains site/area/device, add as custom claims
    if let Ok(body) = serde_json::from_slice::<serde_json::Value>(&req.body) {
        if let Some(site) = body.get("siteId").and_then(|v| v.as_str()) {
            ctx = ctx.with_custom("site", site);
        }
        if let Some(area) = body.get("areaId").and_then(|v| v.as_str()) {
            ctx = ctx.with_custom("area", area);
        }
        if let Some(device) = body.get("deviceId").and_then(|v| v.as_str()) {
            ctx = ctx.with_custom("device", device);
        }
    }

    ctx
});
```

### 4.3 Token Refresh

Dedicated endpoint for token refresh (requires a valid but soon-to-expire token):

```
POST /api/v1/auth/refresh
Authorization: Bearer <current-token>

Response: { "token": "Bearer <new-token>", "expires_at": 1740000000000 }
```

---

## 5. Backpressure Strategy

### 5.1 Three-Tier Backpressure

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Backpressure Cascade                            │
│                                                                      │
│  Tier 1: NatsClient bounded channel (256 msgs)                      │
│  ├─ publish() returns Err when channel full                         │
│  └─ Non-blocking — caller decides what to do                        │
│                                                                      │
│  Tier 2: HTTP handler → 429 Too Many Requests                       │
│  ├─ Includes Retry-After header (exponential backoff hint)          │
│  └─ Device retries with jitter                                      │
│                                                                      │
│  Tier 3: WebSocket GenServer mailbox overflow                        │
│  ├─ CastOverflowPolicy::DropOldest for sensor readings              │
│  ├─ Latest-value-wins semantics (stale readings shed first)          │
│  └─ Server sends { "type": "backpressure", "shed_count": N } frame  │
│                                                                      │
│  Tier 4 (future): JetStream consumer pull-based flow control         │
│  └─ NATS JetStream pull subscriptions for downstream consumers       │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 HTTP Backpressure Response

```rust
async fn ingest_readings(/* ... */) -> impl IntoResponse {
    match nats.publish(&cx, &subject, &payload).await {
        Ok(()) => Response::new(StatusCode::ACCEPTED, ""),
        Err(NatsPublishError::ChannelFull) => {
            Response::new(StatusCode::TOO_MANY_REQUESTS, "NATS backpressure")
                .header("retry-after", "1")  // retry in 1 second
        }
        Err(NatsPublishError::Disconnected) => {
            Response::new(StatusCode::SERVICE_UNAVAILABLE, "NATS unavailable")
                .header("retry-after", "5")
        }
    }
}
```

### 5.3 WebSocket Flow Control

```rust
// In WsIngestionActor, when NATS publish fails:
if nats.publish(cx, &subject, &payload).await.is_err() {
    self.metrics.shed_count += 1;
    // Send backpressure signal to client
    let bp_frame = WsEgressFrame {
        msg_type: "backpressure".into(),
        seq: self.seq,
        payload: serde_json::json!({
            "shed_count": self.metrics.shed_count,
            "hint": "reduce_rate"
        }),
    };
    let _ = self.ws.send(cx, WsMessage::binary(
        rmp_serde::to_vec(&bp_frame).unwrap()
    )).await;
}
```

---

## 6. Data Flow Sequences

### 6.1 HTTP Reading Ingestion (Happy Path)

```
Device              ava-web                   NATS              TMNL
  │                    │                        │                 │
  │ POST /api/v1/readings                       │                 │
  │ Authorization: Bearer <mac>                 │                 │
  │ { siteId, areaId, deviceId, readings }      │                 │
  │───────────────────▶│                        │                 │
  │                    │                        │                 │
  │                    │ 1. MacaroonAuth         │                 │
  │                    │    verify(token, ctx)   │                 │
  │                    │    ✓ HMAC valid         │                 │
  │                    │    ✓ TimeBefore ok      │                 │
  │                    │    ✓ site caveat ok     │                 │
  │                    │                        │                 │
  │                    │ 2. Serialize payload   │                 │
  │                    │    (MessagePack)        │                 │
  │                    │                        │                 │
  │                    │ 3. NatsClient.publish() │                 │
  │                    │───────────────────────▶│                 │
  │                    │                        │                 │
  │                    │         (fire+forget)   │                 │
  │                    │                        │ NATS distributes │
  │  202 Accepted      │                        │────────────────▶│
  │◀───────────────────│                        │                 │
  │                    │                        │ HolonetBridge    │
  │                    │                        │ subscribes iiot.>│
  │                    │                        │                 │
  │                    │                        │                 │ EventDistribution
  │                    │                        │                 │ → ChannelService
  │                    │                        │                 │ → subscribers
```

### 6.2 WebSocket Telemetry Stream (Persistent Connection)

```
Device              ava-web                   NATS              TMNL
  │                    │                        │                 │
  │ GET /ws/v1/telemetry                        │                 │
  │ Upgrade: websocket │                        │                 │
  │ Authorization: Bearer <mac>                 │                 │
  │───────────────────▶│                        │                 │
  │                    │ MacaroonAuth verify     │                 │
  │  101 Switching     │                        │                 │
  │◀───────────────────│                        │                 │
  │                    │                        │                 │
  │ WS Binary frame    │ Spawn WsIngestionActor │                 │
  │ [msgpack: reading] │ (supervised GenServer)  │                 │
  │───────────────────▶│                        │                 │
  │                    │ NatsClient.publish()    │                 │
  │                    │───────────────────────▶│─────────────────▶│
  │                    │                        │                 │
  │ WS Binary frame    │                        │                 │
  │ [msgpack: reading] │                        │                 │
  │───────────────────▶│ NatsClient.publish()   │                 │
  │                    │───────────────────────▶│─────────────────▶│
  │                    │                        │                 │
  │  ... (continuous stream, one WS frame per reading batch) ...  │
  │                    │                        │                 │
  │                    │ (NATS backpressure)     │                 │
  │  WS Binary frame   │                        │                 │
  │  [backpressure msg]│                        │                 │
  │◀───────────────────│                        │                 │
  │                    │                        │                 │
  │ (device reduces    │                        │                 │
  │  send rate)        │                        │                 │
```

### 6.3 Reverse Command Channel (Cloud to Edge)

```
TMNL                NATS              ava-web            Device
  │                   │                 │                   │
  │ Publish           │                 │                   │
  │ iiot.commands.    │                 │                   │
  │   {deviceId}      │                 │                   │
  │──────────────────▶│                 │                   │
  │                   │ Subscription    │                   │
  │                   │ delivery        │                   │
  │                   │────────────────▶│                   │
  │                   │                 │                   │
  │                   │                 │ WS Binary frame   │
  │                   │                 │ [command msg]      │
  │                   │                 │──────────────────▶│
  │                   │                 │                   │
  │                   │                 │ WS Binary frame   │
  │                   │                 │ [command ack]      │
  │                   │                 │◀──────────────────│
```

---

## 7. Wire Formats

### 7.1 HTTP JSON Ingestion Schema

```json
{
  "$schema": "draft-07",
  "title": "ReadingsIngestionPayload",
  "type": "object",
  "required": ["deviceId", "siteId", "areaId", "readings"],
  "properties": {
    "deviceId": { "type": "string", "minLength": 1 },
    "siteId": { "type": "string", "minLength": 1 },
    "areaId": { "type": "string", "minLength": 1 },
    "readings": {
      "type": "array",
      "minItems": 1,
      "maxItems": 10000,
      "items": {
        "type": "object",
        "required": ["value", "timestamp"],
        "properties": {
          "value": { "type": "number" },
          "timestamp": { "type": "string", "format": "date-time" },
          "quality": {
            "type": "string",
            "enum": ["good", "good_local_override", "uncertain",
                     "uncertain_sensor_calibration", "bad",
                     "bad_sensor_failure", "bad_no_communication"],
            "default": "good"
          }
        }
      }
    }
  }
}
```

### 7.2 NATS Payload (MessagePack)

NATS payloads use MessagePack for compactness over JSON. This reduces
per-message overhead by ~40% for typical sensor readings:

```
JSON:   {"value":98.6,"timestamp":"2026-02-21T10:00:00Z","quality":"good"}
         → 68 bytes

MsgPack: [98.6, "2026-02-21T10:00:00Z", 0]  (quality as enum index)
         → 38 bytes
```

### 7.3 WebSocket Frame Protocol

Binary MessagePack frames. Text frames are rejected.

**Ingress (device → server):**
```rust
#[derive(Deserialize)]
struct WsIngressFrame {
    /// "reading" | "alarm" | "equipment" | "heartbeat"
    msg_type: String,
    /// Device identifier (must match auth token)
    device_id: String,
    /// Sequence number (monotonically increasing per connection)
    seq: u64,
    /// Type-specific payload (MessagePack bytes)
    payload: Vec<u8>,
}
```

**Egress (server → device):**
```rust
#[derive(Serialize)]
struct WsEgressFrame {
    /// "ack" | "error" | "command" | "backpressure"
    msg_type: String,
    /// Sequence number being acknowledged
    seq: u64,
    /// Type-specific payload
    payload: serde_json::Value,
}
```

---

## 8. Router Assembly

```rust
use ava_web::{Router, get, post, HttpServer, ServerConfig};
use ava_web::auth::MacaroonAuth;
use ava_web::metrics::{MetricsCollector, MetricsMiddleware, MetricsHandler};
use std::sync::Arc;
use std::time::Duration;

pub fn build_ingestion_router(
    nats: Arc<NatsClient>,
    root_key: AuthKey,
    metrics: Arc<MetricsCollector>,
) -> Router {
    // Auth middleware — site-scoped macaroon verification
    let auth = MacaroonAuth::with_context_builder(root_key, build_iiot_context);

    // Metrics middleware
    let metrics_mw = MetricsMiddleware::new(Arc::clone(&metrics));

    // Rate limiting middleware (per-device, extracted from token)
    let rate_limit = RateLimitMiddleware::new(/* config */);

    Router::new()
        // Ingestion routes (authenticated + metered)
        .route("/api/v1/readings", post(readings_handler(Arc::clone(&nats))))
        .route("/api/v1/alarms", post(alarms_handler(Arc::clone(&nats))))
        .route("/api/v1/equipment", post(equipment_handler(Arc::clone(&nats))))
        .route("/api/v1/bulk", post(bulk_handler(Arc::clone(&nats))))

        // WebSocket telemetry (authenticated at upgrade, then persistent)
        .route("/ws/v1/telemetry", get(ws_telemetry_handler(Arc::clone(&nats))))

        // Reverse command channel
        .route("/api/v1/commands", post(command_dispatch_handler(Arc::clone(&nats))))

        // Health + metrics (unauthenticated)
        .route("/api/v1/health", get(health_handler(Arc::clone(&nats))))
        .route("/metrics", get(MetricsHandler::new(Arc::clone(&metrics))))

        // Auth refresh
        .route("/api/v1/auth/refresh", post(token_refresh_handler()))

        // Middleware stack (applied in order: rate_limit → auth → metrics)
        .middleware(metrics_mw)
        .middleware(auth)
        .middleware(rate_limit)
}

pub async fn start_ingestion_server(config: IngestionServerConfig) -> io::Result<()> {
    let nats = NatsClient::connect(&cx, &config.nats_url).await?;
    let metrics = Arc::new(MetricsCollector::new());

    let router = build_ingestion_router(
        Arc::new(nats),
        config.root_key,
        metrics,
    );

    let server_config = ServerConfig::default()
        .max_connections(50_000)       // High fan-in from many devices
        .max_body_size(64 * 1024 * 1024)  // 64MB for bulk uploads
        .idle_timeout(Duration::from_secs(300)); // 5min for WS keep-alive

    HttpServer::bind(&config.bind_addr)
        .await?
        .config(server_config)
        .serve(router)
}
```

---

## 9. Performance Targets

| Metric | Target | Mechanism |
|--------|--------|-----------|
| Sustained throughput | 100K readings/sec per instance | Zero-copy HTTP body → NATS publish |
| P50 latency (HTTP receive → NATS publish) | < 1ms | Fire-and-forget, no persistence in ava-web |
| P99 latency (HTTP receive → NATS publish) | < 10ms | Bounded NATS channel prevents head-of-line |
| WebSocket frame rate | 50K frames/sec per connection | Binary MessagePack, zero-copy Bytes |
| Bulk upload | 1M readings per upload (64MB) | Multipart zero-copy parsing (BMH search) |
| Max concurrent connections | 50K (HTTP + WS combined) | ServerConfig.max_connections |
| Memory per WS connection | < 8KB (actor state + buffers) | GenServer mailbox capacity 64 |
| Backpressure reaction time | < 1ms (NATS channel full → 429) | Non-blocking bounded channel |

### 9.1 Zero-Copy Path Analysis

```
HTTP Body (Vec<u8>)
  │
  ▼ Bytes::from(vec)               ← O(1) ownership transfer
Request.body (Bytes)
  │
  ▼ serde deserialize              ← O(n) parse, unavoidable
ReadingsPayload
  │
  ▼ rmp_serde::to_vec()            ← O(n) reserialize to MessagePack
Vec<u8> (NATS payload)
  │
  ▼ NatsClient.publish(&payload)   ← O(1) send to bounded channel
                                      channel internal: memcpy into slot
```

For WebSocket binary frames:
```
WS Frame (AsBytes)
  │
  ▼ WsMessage::Binary(bytes)       ← O(1) zero-copy (same Bytes type)
  │
  ▼ rmp_serde::from_slice(&bytes)  ← O(n) parse, zero-copy slice reference
WsIngressFrame
  │
  ▼ NatsClient.publish(payload)    ← O(1) channel send
```

---

## 10. Testing Strategy

### 10.1 Lab Runtime (Deterministic)

ava-web's lab module provides deterministic testing with virtual time and chaos injection.

```rust
#[test]
fn test_reading_ingestion_happy_path() {
    let nats = MockNatsClient::new();
    let router = build_ingestion_router(
        Arc::new(nats.clone()),
        test_key(),
        Arc::new(MetricsCollector::new()),
    );

    let mut server = LabTestServer::new(router).seed(42);

    let token = test_issuer().mint()
        .time_before(u64::MAX)
        .custom("site", "test-site")
        .custom("area", "test-area")
        .custom("device", "sensor-1")
        .finish();

    let resp = server.post("/api/v1/readings")
        .header("authorization", token_to_bearer(&token))
        .json(&json!({
            "siteId": "test-site",
            "areaId": "test-area",
            "deviceId": "sensor-1",
            "readings": [
                { "value": 42.0, "timestamp": "2026-02-21T00:00:00Z" }
            ]
        }))
        .send();

    resp.assert_status(202);

    // Verify NATS received the message
    let published = nats.published_messages();
    assert_eq!(published.len(), 1);
    assert_eq!(published[0].subject, "iiot.readings.test-site.test-area.sensor-1");
}
```

### 10.2 Chaos Injection

```rust
#[test]
fn test_ingestion_under_chaos() {
    let nats = MockNatsClient::new()
        .with_publish_failure_rate(0.15);  // 15% NATS failures

    let router = build_ingestion_router(/* ... */);

    let mut server = LabTestServer::new(router)
        .seed(42)
        .chaos(ChaosPreset::Heavy);  // 10% cancel, 20% delay, 15% I/O error

    // Send 1000 readings
    let mut accepted = 0;
    let mut rate_limited = 0;
    for i in 0..1000 {
        let resp = server.post("/api/v1/readings")
            .header("authorization", token_to_bearer(&token))
            .json(&make_reading(i))
            .send();

        match resp.status() {
            202 => accepted += 1,
            429 => rate_limited += 1,
            _ => panic!("unexpected status: {}", resp.status()),
        }
    }

    // Under Heavy chaos + 15% NATS failure: expect ~70-85% acceptance
    assert!(accepted > 700, "accepted={accepted}, expected >700");
    assert!(rate_limited > 0, "should have some 429s under chaos");
}
```

### 10.3 End-to-End (ava-web to Mock HolonetBridge)

```rust
#[test]
fn test_e2e_ingestion_to_holonet() {
    // 1. Start real NATS (from docker compose)
    let nats_url = "nats://localhost:4222";

    // 2. Start ava-web ingestion server
    let server = start_ingestion_server(IngestionServerConfig {
        nats_url: nats_url.into(),
        bind_addr: "127.0.0.1:0".into(),
        root_key: test_key(),
    }).await;

    // 3. Subscribe to NATS subject (simulating HolonetBridge)
    let subscriber = NatsClient::connect(&cx, nats_url).await.unwrap();
    let sub = subscriber.subscribe(&cx, "iiot.readings.>").await.unwrap();

    // 4. POST a reading to ava-web
    let resp = http_client.post(&format!("http://{}/api/v1/readings", server.addr()))
        .header("authorization", token_to_bearer(&token))
        .json(&reading_payload)
        .send().await;

    assert_eq!(resp.status(), 202);

    // 5. Verify arrival on NATS
    let msg = sub.next(&cx).await.unwrap();
    assert_eq!(msg.subject, "iiot.readings.plant-north.boiler-room.temp-sensor-42");

    // 6. Deserialize and verify payload
    let readings: Vec<ReadingEntry> = rmp_serde::from_slice(&msg.payload).unwrap();
    assert_eq!(readings[0].value, 98.6);
}
```

### 10.4 Load Testing

```bash
# Using wrk or hey for HTTP throughput baseline
hey -n 100000 -c 200 \
  -m POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"siteId":"s","areaId":"a","deviceId":"d","readings":[{"value":1,"timestamp":"2026-01-01T00:00:00Z"}]}' \
  http://localhost:3000/api/v1/readings

# Expected: >100K req/sec with <10ms P99
```

---

## 11. Deployment Topology

### 11.1 Single-Node (Development)

```
┌──────────────────────────────────────────────┐
│ docker compose                               │
│                                              │
│  ┌────────────┐  ┌────────────┐             │
│  │ ava-web    │  │ NATS       │             │
│  │ :3000      │──│ :4222      │             │
│  └────────────┘  └────────────┘             │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ TMNL (bun dev)                        │  │
│  │ HolonetBridge → EventDistribution     │  │
│  │ subscribes to nats://localhost:4222    │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### 11.2 Multi-Node (Production)

```
                    ┌─────────────┐
    Edge devices ──▶│ Load        │
                    │ Balancer    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼────┐  ┌───▼────┐  ┌───▼────┐
         │ ava-web │  │ava-web │  │ava-web │  (N instances)
         │ :3000   │  │ :3000  │  │ :3000  │
         └────┬────┘  └───┬────┘  └───┬────┘
              │            │            │
              └────────────┼────────────┘
                           │
                    ┌──────▼──────┐
                    │ NATS Cluster │  (3-node JetStream)
                    │ :4222       │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼────┐  ┌───▼────┐  ┌───▼────┐
         │ TMNL    │  │ TMNL   │  │ TMNL   │  (queue_subscribe)
         │ node 1  │  │ node 2 │  │ node 3 │
         └─────────┘  └────────┘  └────────┘
```

NATS `queue_subscribe` ensures each message is processed by exactly one TMNL node.

---

## 12. Configuration

```rust
/// Ingestion server configuration.
#[derive(Debug, Clone)]
pub struct IngestionServerConfig {
    /// ava-web bind address (e.g., "0.0.0.0:3000")
    pub bind_addr: String,
    /// NATS server URL (e.g., "nats://localhost:4222")
    pub nats_url: String,
    /// Macaroon root key for device token verification
    pub root_key: AuthKey,
    /// Max concurrent connections
    pub max_connections: usize,
    /// Max HTTP body size (bytes)
    pub max_body_size: usize,
    /// WebSocket idle timeout (seconds)
    pub ws_idle_timeout_secs: u64,
    /// NATS publish channel capacity
    pub nats_channel_capacity: usize,
    /// Enable Prometheus metrics endpoint
    pub metrics_enabled: bool,
    /// Enable TLS (for production)
    pub tls_enabled: bool,
    pub tls_cert_path: Option<String>,
    pub tls_key_path: Option<String>,
}

impl Default for IngestionServerConfig {
    fn default() -> Self {
        Self {
            bind_addr: "0.0.0.0:3000".into(),
            nats_url: "nats://localhost:4222".into(),
            root_key: AuthKey::from_seed(0),  // MUST be overridden
            max_connections: 50_000,
            max_body_size: 64 * 1024 * 1024,  // 64MB
            ws_idle_timeout_secs: 300,
            nats_channel_capacity: 256,
            metrics_enabled: true,
            tls_enabled: false,
            tls_cert_path: None,
            tls_key_path: None,
        }
    }
}
```

---

## 13. Open Questions / Future Work

| Item | Status | Notes |
|------|--------|-------|
| JetStream persistent streams | Future | Currently using core NATS publish (at-most-once). JetStream adds at-least-once with replay. |
| NATS auth token forwarding | Future | Currently NATS uses dev token. Production needs per-service NATS credentials. |
| Schema evolution | Future | MessagePack payloads are unversioned. Add version byte prefix when schemas change. |
| TLS termination | Future | ava-web supports TLS via asupersync. Needs cert management integration. |
| Horizontal auto-scaling | Future | NATS consumer groups + K8s HPA on ingestion latency metric. |
| iiot-subjects.ts update | Required | Change wildcard from `*` to `>` for hierarchical subject compatibility. |
| Sparkplug → ava-web bridge | Optional | Existing SparkplugAdapter connects to MQTT. Could add MQTT→ava-web adapter. |

---

## 14. Decision Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| MessagePack over JSON for NATS payloads | ~40% smaller, faster serialization. Devices send JSON over HTTP; ava-web transcodes to MsgPack for NATS. | JSON (larger), Protobuf (schema management overhead), raw binary (no self-describing) |
| Fire-and-forget NATS publish | Sub-millisecond ingestion latency. At-most-once is acceptable for sensor readings (next reading arrives in seconds). | JetStream publish (adds ~5ms for persistence ack), request/reply (adds RTT) |
| GenServer per WS connection | Supervised lifecycle, automatic cleanup on disconnect, mailbox-based backpressure via DropOldest. | Shared state with mutex (contention), per-connection task (no supervision) |
| Macaroon auth (not JWT) | Site-scoped caveats, offline attenuation (device can restrict its own token), constant-time HMAC verification. Already implemented in ava-web. | JWT (no attenuation, larger tokens), mTLS (cert management complexity), API keys (no scoping) |
| Hierarchical NATS subjects | ISA-95-aligned, enables site-level filtering and authorization. `>` wildcard backwards-compatible with existing flat subjects. | Flat subjects (no site scoping), encoded paths (harder to wildcard) |
| HTTP + WS dual ingestion | HTTP for batch/request-response devices (PLCs, gateways). WS for persistent streaming (high-rate sensors). Both share the same NATS publish path. | WS-only (not all devices support persistent connections), HTTP-only (high overhead for high-rate streams) |
