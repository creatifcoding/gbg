# AVA WASM V2 Client Architecture

> **Bead**: I49 - Design embedded WASM client architecture
> **Status**: In Progress
> **Target**: Sub-ms artifact delivery

## Overview

The AVA WASM v2 client provides high-speed, embedded execution of the AVA runtime directly in the browser. Unlike v1's JSON-based request/response model, v2 implements:

1. **Streaming subscriptions** - Artifacts arrive via message passing, not polling
2. **Zero-copy bindings** - Direct Arrow memory sharing where possible
3. **Hybrid hydration** - Server hydrates streams, client resolves AssetRefs
4. **Effect-TS integration** - Native TypeScript reactive primitives

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TypeScript (Effect-TS)                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  AvaClientTS    │  │  effect-atom    │  │  React Components           │  │
│  │  (facade)       │◄─┤  (state)        │◄─┤  (consumers)                │  │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────────────────┘  │
└───────────┼──────────────────────┼──────────────────────────────────────────┘
            │                      │
            ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Message Passing Layer                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  MessagePort / BroadcastChannel / postMessage                        │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │
│  │  │ Subscribe   │ │ Invalidate  │ │ Artifact    │ │ AssetReq    │   │   │
│  │  │ {viewId}    │ │ {viewId}    │ │ {payload}   │ │ {uri}       │   │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└───────────┬─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WASM Runtime (ava-wasm v2)                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  WasmBridge     │  │  ViewSubscriber │  │  AssetResolver              │  │
│  │  (msg dispatch) │  │  (stream mgmt)  │  │  (fetch/cache)              │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────────┬──────────────┘  │
│           │                    │                          │                  │
│           ▼                    ▼                          ▼                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Embedded AvaRuntimeV2                             │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │
│  │  │ SpecRegistry│ │ReconcilerV2 │ │HydrationSvc │ │ ViewCompiler│   │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Initialization API

### WASM Module Loading

```typescript
// src/lib/ava/client.ts
import { Effect, Layer, Stream } from 'effect';
import { Schema } from 'effect';

// Schema for initialization config
const AvaClientConfig = Schema.Struct({
  wasmUrl: Schema.String.pipe(Schema.optional),  // defaults to bundled
  workerMode: Schema.Literal('dedicated', 'shared', 'inline').pipe(
    Schema.optional
  ),
  maxConcurrentViews: Schema.Number.pipe(Schema.optional),
  assetCacheSize: Schema.Number.pipe(Schema.optional),
});

type AvaClientConfig = typeof AvaClientConfig.Type;

// Service definition
class AvaClient extends Context.Tag('ava/AvaClient')<
  AvaClient,
  {
    readonly subscribe: (spec: ViewProfileSpec) => Stream.Stream<ViewArtifact>;
    readonly invalidate: (viewId: ViewId) => Effect.Effect<void>;
    readonly unsubscribe: (viewId: ViewId) => Effect.Effect<void>;
    readonly resolveAsset: (ref: AssetRef) => Effect.Effect<Blob>;
  }
>() {}

// Initialization
const AvaClientLive = Layer.scoped(
  AvaClient,
  Effect.gen(function* () {
    // 1. Load WASM module
    const wasm = yield* loadWasmModule();

    // 2. Initialize runtime bridge
    const bridge = yield* initializeBridge(wasm);

    // 3. Setup message handlers
    yield* Effect.addFinalizer(() => bridge.shutdown());

    return {
      subscribe: (spec) => bridge.subscribe(spec),
      invalidate: (viewId) => bridge.invalidate(viewId),
      unsubscribe: (viewId) => bridge.unsubscribe(viewId),
      resolveAsset: (ref) => bridge.resolveAsset(ref),
    };
  })
);
```

### Worker Mode Selection

| Mode | Use Case | Tradeoffs |
|------|----------|-----------|
| `inline` | Simple apps, debugging | Blocks main thread during heavy computation |
| `dedicated` | Default for most apps | Isolated, good performance, one-per-client |
| `shared` | Multi-tab coordination | Shared state, complex lifecycle |

## Subscription Model

### Stream-Based API

```typescript
// Subscribe returns an Effect Stream
const artifactStream = yield* avaClient.subscribe(spec);

// Consume with Effect-TS
yield* Stream.runForEach(artifactStream, (artifact) =>
  Effect.gen(function* () {
    // Process each artifact
    yield* updateGridData(artifact.channel_bindings);
  })
);

// Or convert to effect-atom for React
const viewAtom = Atom.fromStream(
  artifactStream.pipe(
    Stream.map(artifact => artifact.channel_bindings)
  )
);
```

### Message Protocol

```typescript
// Messages from TypeScript → WASM
type ClientMessage =
  | { type: 'subscribe'; viewId: string; spec: ViewProfileSpec }
  | { type: 'unsubscribe'; viewId: string }
  | { type: 'invalidate'; viewId: string }
  | { type: 'resolveAsset'; requestId: string; ref: AssetRef };

// Messages from WASM → TypeScript
type RuntimeMessage =
  | { type: 'artifact'; viewId: string; payload: ViewArtifact }
  | { type: 'error'; viewId: string; error: AvaError }
  | { type: 'assetResolved'; requestId: string; data: ArrayBuffer }
  | { type: 'assetError'; requestId: string; error: string };
```

## TypeScript Bindings

### Effect Schema Definitions

```typescript
// Mirror ava-domain types with Effect Schema
const ViewId = Schema.String.pipe(Schema.brand('ViewId'));
type ViewId = typeof ViewId.Type;

const AssetRef = Schema.Struct({
  uri: Schema.String,
  mimeType: Schema.NullOr(Schema.String),
  sizeHint: Schema.NullOr(Schema.Number),
});
type AssetRef = typeof AssetRef.Type;

const ChannelData = Schema.Union(
  Schema.TaggedStruct('Rows', {
    data: Schema.Array(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  }),
  Schema.TaggedStruct('Inline', {
    json: Schema.Unknown,
  }),
  Schema.TaggedStruct('StreamHandle', {
    streamId: Schema.String,
    cursor: Schema.Number,
  }),
  Schema.TaggedStruct('AssetRef', {
    uri: Schema.String,
    mimeType: Schema.NullOr(Schema.String),
  }),
  Schema.TaggedStruct('Error', {
    message: Schema.String,
  })
);
type ChannelData = typeof ChannelData.Type;

const ChannelBinding = Schema.Struct({
  channelId: Schema.String,
  role: Schema.Literal('STATE', 'EVENT', 'METRIC', 'COMMAND', 'LOG'),
  active: Schema.Boolean,
  rowCount: Schema.NullOr(Schema.Number),
  lastUpdatedMs: Schema.NullOr(Schema.Number),
  data: Schema.NullOr(ChannelData),
});
type ChannelBinding = typeof ChannelBinding.Type;

const ViewArtifact = Schema.Struct({
  viewId: ViewId,
  assetId: Schema.NullOr(Schema.String),
  spec: ViewProfileSpec,
  channelBindings: Schema.Array(ChannelBinding),
  createdAtMs: Schema.Number,
  logicalVersion: Schema.Number,
});
type ViewArtifact = typeof ViewArtifact.Type;
```

### wasm-bindgen Integration

```rust
// ava-wasm/src/v2/bridge.rs

use wasm_bindgen::prelude::*;
use js_sys::{Function, Uint8Array};

/// V2 WASM Bridge - handles message passing
#[wasm_bindgen]
pub struct WasmBridge {
    runtime: AvaRuntimeV2,
    message_callback: Option<Function>,
}

#[wasm_bindgen]
impl WasmBridge {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<WasmBridge, JsError> {
        let runtime = AvaRuntimeV2::new(RuntimeConfigV2::default());
        Ok(Self {
            runtime,
            message_callback: None,
        })
    }

    /// Set the callback for outgoing messages
    #[wasm_bindgen(js_name = setMessageCallback)]
    pub fn set_message_callback(&mut self, callback: Function) {
        self.message_callback = Some(callback);
    }

    /// Process incoming message from TypeScript
    #[wasm_bindgen(js_name = processMessage)]
    pub fn process_message(&mut self, message: &str) -> Result<(), JsError> {
        let msg: ClientMessage = serde_json::from_str(message)?;

        match msg {
            ClientMessage::Subscribe { view_id, spec } => {
                self.handle_subscribe(view_id, spec)
            }
            ClientMessage::Unsubscribe { view_id } => {
                self.handle_unsubscribe(&view_id)
            }
            ClientMessage::Invalidate { view_id } => {
                self.handle_invalidate(&view_id)
            }
            ClientMessage::ResolveAsset { request_id, ref_ } => {
                self.handle_resolve_asset(request_id, ref_)
            }
        }
    }

    /// Send message to TypeScript via callback
    fn send_message(&self, msg: RuntimeMessage) -> Result<(), JsError> {
        if let Some(callback) = &self.message_callback {
            let json = serde_json::to_string(&msg)?;
            callback.call1(&JsValue::NULL, &JsValue::from_str(&json))?;
        }
        Ok(())
    }
}
```

## AssetRef Resolution Strategy

### Hybrid Resolution Model

AssetRefs use a hybrid resolution strategy:

1. **WASM-side caching**: Small assets (< 64KB) are cached in WASM memory
2. **TypeScript-side fetch**: Large assets are fetched via JS fetch API
3. **Background prefetch**: Assets are prefetched based on view adjacency

```typescript
// Asset resolution flow
const resolveAsset = (ref: AssetRef): Effect.Effect<Blob> =>
  Effect.gen(function* () {
    // 1. Check TypeScript-side cache
    const cached = yield* checkCache(ref.uri);
    if (cached) return cached;

    // 2. Check if WASM has it
    const wasmCached = yield* checkWasmCache(ref.uri);
    if (wasmCached) return wasmCached;

    // 3. Fetch from network
    const response = yield* Effect.tryPromise(() => fetch(ref.uri));
    const blob = yield* Effect.tryPromise(() => response.blob());

    // 4. Cache for future use
    yield* cacheAsset(ref.uri, blob);

    return blob;
  });
```

### URI Schemes

| Scheme | Resolution | Example |
|--------|------------|---------|
| `ava://` | Internal WASM registry | `ava://view-123/channel-state` |
| `asset://` | Asset service | `asset://bucket/file.parquet` |
| `https://` | Direct fetch | `https://cdn.example.com/data.json` |
| `blob:` | In-memory blob | `blob:uuid-here` |

## Message Passing Protocol

### Channel Setup

```typescript
// Using MessageChannel for dedicated worker
const { port1, port2 } = new MessageChannel();

// port1 → TypeScript side
// port2 → WASM Worker side

// Setup structured clone transfer for zero-copy
port1.onmessage = (event) => {
  const msg = event.data as RuntimeMessage;
  // Handle message
};

// Send to WASM with transfer
port1.postMessage(msg, [buffer]); // Transfer ownership
```

### Message Types

```typescript
// Discriminated union for type safety
type ProtocolMessage = {
  id: string;           // Correlation ID for request/response
  timestamp: number;    // For latency tracking
  payload: ClientMessage | RuntimeMessage;
};

// Batch messages for efficiency
type BatchMessage = {
  type: 'batch';
  messages: ProtocolMessage[];
};
```

## Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| Artifact delivery | < 1ms | Zero-copy message passing |
| First paint | < 16ms | Progressive hydration |
| Memory overhead | < 10MB | Lazy loading, eviction |
| WASM binary size | < 500KB | LTO, wasm-opt, tree-shaking |

### Optimization Techniques

1. **Zero-copy Arrow buffers**: Share ArrayBuffer directly between WASM and JS
2. **Message batching**: Aggregate small updates into batched messages
3. **Lazy channel hydration**: Only hydrate visible channels
4. **Predictive prefetch**: Load likely-next views in background
5. **Compression**: Use zstd for large payloads over message channel

## Integration with effect-atom

```typescript
// Create runtime atom with WASM layer
const avaRuntimeAtom = Atom.runtime(AvaClientLive);

// Subscribe to view as atom
const viewArtifactAtom = avaRuntimeAtom.atom(
  Effect.gen(function* () {
    const client = yield* AvaClient;
    return yield* client.subscribe(viewSpec).pipe(
      Stream.runHead,
      Effect.flatten
    );
  })
);

// Auto-updating stream atom
const viewStreamAtom = avaRuntimeAtom.stream(
  Effect.gen(function* () {
    const client = yield* AvaClient;
    return client.subscribe(viewSpec);
  })
);

// Use in React
function ViewComponent({ viewId }: { viewId: string }) {
  const artifact = useAtomValue(viewArtifactAtom);

  return Result.match(artifact, {
    onSuccess: (a) => <DataGrid data={a.channelBindings[0].data} />,
    onFailure: (e) => <ErrorBoundary error={e} />,
  });
}
```

## Error Handling

### Error Types

```typescript
const AvaError = Schema.Union(
  Schema.TaggedStruct('ViewNotFound', {
    viewId: ViewId,
  }),
  Schema.TaggedStruct('HydrationFailed', {
    viewId: ViewId,
    channel: Schema.String,
    reason: Schema.String,
  }),
  Schema.TaggedStruct('AssetResolutionFailed', {
    uri: Schema.String,
    reason: Schema.String,
  }),
  Schema.TaggedStruct('WasmError', {
    message: Schema.String,
    stack: Schema.NullOr(Schema.String),
  })
);
```

### Recovery Strategies

1. **Retry with backoff**: Transient failures retry automatically
2. **Fallback to server**: If WASM fails, fall back to server-side rendering
3. **Graceful degradation**: Show stale data while rehydrating

## File Structure (Proposed)

```
src-ava/ava-wasm/
├── src/
│   ├── lib.rs              # Module root
│   ├── v1/                 # Legacy (current) implementation
│   │   └── mod.rs
│   └── v2/                 # New streaming implementation
│       ├── mod.rs
│       ├── bridge.rs       # WasmBridge struct
│       ├── messages.rs     # Message types
│       ├── subscriber.rs   # View subscription management
│       └── assets.rs       # Asset resolution
├── Cargo.toml
└── tests/
    └── wasm.rs

src/lib/ava/                # TypeScript client
├── index.ts                # Public exports
├── client.ts               # AvaClient service
├── schemas.ts              # Effect Schema definitions
├── atoms.ts                # effect-atom bindings
├── worker.ts               # Worker initialization
└── hooks.ts                # React hooks
```

## Implementation Phases

### Phase 1: Bridge Foundation
- [ ] Message protocol types (Rust + TypeScript)
- [ ] WasmBridge basic structure
- [ ] Worker setup and lifecycle

### Phase 2: Subscription Flow
- [ ] subscribe_view_hydrated integration
- [ ] Stream-to-callback bridge
- [ ] Artifact serialization optimization

### Phase 3: Asset Resolution
- [ ] AssetRef detection and extraction
- [ ] TypeScript fetch integration
- [ ] Caching layer

### Phase 4: Performance
- [ ] Zero-copy ArrayBuffer sharing
- [ ] Message batching
- [ ] WASM size optimization

## Dependencies

### Rust (Cargo.toml)
```toml
[dependencies]
wasm-bindgen = "0.2"
wasm-bindgen-futures = "0.4"
js-sys = "0.3"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
ava-runtime = { path = "../ava-runtime" }

[dev-dependencies]
wasm-bindgen-test = "0.3"
```

### TypeScript (package.json)
```json
{
  "dependencies": {
    "effect": "^3.0",
    "@effect/schema": "^0.74",
    "@effect-atom/atom-react": "^0.1"
  }
}
```

## References

- [WASM Bindgen Guide](https://rustwasm.github.io/wasm-bindgen/)
- [Effect-TS Documentation](https://effect.website)
- [effect-atom Patterns](../../.edin/EFFECT_PATTERNS.md)
- [HydrationService (I47)](../ava-runtime/src/v2/hydration.rs)
- [ReconcilerV2 Integration (I48)](../ava-runtime/src/v2/runtime.rs)
