# Durable Streams Effect Library

Effect-TS wrappers for `@durable-streams/client` and `@durable-streams/server` packages.
Provides service-based access to durable, resumable streams with full Effect patterns.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EFFECT DURABLE STREAMS LIBRARY                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                     SERVER WRAPPER                                     │ │
│  │                     (server-wrapper.ts)                                │ │
│  │                                                                         │ │
│  │  DurableStreamServer ← Effect.Service wrapping @durable-streams/server │ │
│  │  ├─ DurableStreamServerLive (Layer.scoped - lifecycle managed)        │ │
│  │  ├─ DurableStreamServerConfigured(config) → Layer                     │ │
│  │  ├─ DurableStreamServerPersistent(dataDir) → Layer (LMDB-backed)      │ │
│  │  └─ DurableStreamServerDefault → Layer (in-memory)                    │ │
│  │                                                                         │ │
│  │  Features:                                                              │ │
│  │  • Scoped lifecycle (acquire/release on start/stop)                    │ │
│  │  • Lifecycle events via PubSub (StreamCreated/Deleted/Started/Stopped) │ │
│  │  • Stats and health monitoring                                          │ │
│  │                                                                         │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    │ DurableStreamFullStack()               │
│                                    │ (combines server + client)             │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                     CLIENT BRIDGE                                      │ │
│  │                     (service.ts)                                       │ │
│  │                                                                         │ │
│  │  DurableStreamClient ← Effect.Service wrapping @durable-streams/client │ │
│  │  ├─ create(config) → EffectStreamHandle<T>                             │ │
│  │  ├─ connect(config) → EffectStreamHandle<T>                            │ │
│  │  ├─ getOrCreate(config) → EffectStreamHandle<T>                        │ │
│  │  ├─ exists(url) → boolean                                              │ │
│  │  └─ delete(url) → void                                                 │ │
│  │                                                                         │ │
│  │  EffectStreamHandle<T>:                                                 │ │
│  │  ├─ append(data) → Effect<void>                                        │ │
│  │  ├─ appendBatch(items) → Effect<void>                                  │ │
│  │  ├─ read(config?) → Effect<JsonBatch<T>>                               │ │
│  │  ├─ subscribe(config?) → Effect<Stream<JsonBatch<T>>, Scope>           │ │
│  │  ├─ head() → Effect<StreamMetadata>                                    │ │
│  │  └─ delete() → Effect<void>                                            │ │
│  │                                                                         │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                     NATIVE HTTP CLIENT                                 │ │
│  │                     (native-client.ts)                                 │ │
│  │                                                                         │ │
│  │  NativeStreamClient ← Fallback when @durable-streams/client unavailable│ │
│  │  ├─ Pure HTTP fetch-based implementation                               │ │
│  │  ├─ No external dependencies                                           │ │
│  │  └─ Same API surface as DurableStreamClient                            │ │
│  │                                                                         │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                     CUSTOM HTTP API SERVER                             │ │
│  │                     (server/*.ts)                                       │ │
│  │                                                                         │ │
│  │  Full Effect HttpApi server with SQLite persistence                    │ │
│  │  • For advanced use when @durable-streams/server doesn't fit           │ │
│  │  • Uses @effect/sql-sqlite-bun                                         │ │
│  │  • EventLog integration for observability                              │ │
│  │                                                                         │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Usage

### Client Only (connect to external server)

```typescript
import { Effect, Layer } from 'effect';
import { DurableStreamClient, DurableStreamClientConfigured } from '@/lib/durable-streams';

const program = Effect.gen(function* () {
  const client = yield* DurableStreamClient;

  // Get or create a stream
  const handle = yield* client.getOrCreate({
    url: 'http://localhost:4437/my-stream',
    contentType: 'application/json',
  });

  // Append data
  yield* handle.append({ event: 'user.created', userId: '123' });

  // Read all entries
  const batch = yield* handle.read({ offset: '-1' });
  console.log('Entries:', batch.items);

  // Subscribe to live updates
  const stream = yield* handle.subscribe({ live: 'auto' });
  yield* stream.pipe(
    Stream.tap((batch) => Console.log('Received:', batch.items)),
    Stream.runDrain
  );
});

Effect.runPromise(
  program.pipe(
    Effect.scoped,
    Effect.provide(DurableStreamClientConfigured({
      baseUrl: 'http://localhost:4437',
    }))
  )
);
```

### Server Only (run the server)

```typescript
import { Effect } from 'effect';
import { DurableStreamServer, DurableStreamServerPersistent } from '@/lib/durable-streams';

const program = Effect.gen(function* () {
  const server = yield* DurableStreamServer;
  const url = yield* server.url;
  console.log(`Server running at ${url}`);

  // Subscribe to lifecycle events
  const events = yield* server.subscribe;
  yield* events.pipe(
    Stream.tap((event) => Console.log('Event:', event)),
    Stream.runDrain
  );
});

Effect.runPromise(
  program.pipe(
    Effect.scoped,
    Effect.provide(DurableStreamServerPersistent('/data/streams'))
  )
);
```

### Full Stack (Server + Client together)

```typescript
import { Effect } from 'effect';
import {
  DurableStreamServer,
  DurableStreamClient,
  DurableStreamFullStack,
} from '@/lib/durable-streams';

const program = Effect.gen(function* () {
  // Both server and client are available
  const server = yield* DurableStreamServer;
  const client = yield* DurableStreamClient;

  const url = yield* server.url;
  console.log('Server:', url);

  // Client auto-connects to server's URL
  const handle = yield* client.getOrCreate({ url: '/test-stream' });
  yield* handle.append({ hello: 'world' });

  const batch = yield* handle.read();
  console.log('Data:', batch.items);
});

Effect.runPromise(
  program.pipe(
    Effect.scoped,
    Effect.provide(DurableStreamFullStack({
      dataDir: '/tmp/streams', // Optional: persistent storage
    }))
  )
);
```

## Integration with Block System

The `DurableBlockStream` service uses this library for remote synchronization:

```typescript
import { DurableBlockStream, DurableBlockStreamRemote, makeRemoteBlockStream } from '@/lib/blocks';

// Create a remote block runtime connected to durable streams server
const blockRuntime = makeRemoteBlockStream({
  url: 'http://localhost:4437/blocks/chat-123',
});

// Use with block atoms
const ops = makeRemoteBlockOps(blockRuntime, chatId);
await ops.createBlock({ blockId: 'b1', blockTypeName: 'text' });
```

## Error Handling

All operations return `Effect<T, DurableStreamError>`:

```typescript
const result = yield* client.getOrCreate({ url: '/stream' }).pipe(
  Effect.catchTag('DurableStreamError', (e) => {
    console.error(`${e.code}: ${e.message} at ${e.url}`);
    return Effect.fail(new MyAppError(e.message));
  })
);
```

## Environment Notes

- **Server wrapper** requires `@durable-streams/server` which has LMDB native dependency
- **LMDB** needs `libstdc++.so.6` on Linux (use Docker or Nix for reliable builds)
- **Client bridge** works in all environments (pure HTTP)
- **Native HTTP client** is a fallback with no external dependencies
