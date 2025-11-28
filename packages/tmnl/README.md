# tmnl

This library was generated with [Nx](https://nx.dev).

## Effect-TS Serialized Worker Pool Integration

This package includes a drop-in example integration demonstrating how to use Effect-TS Platform Worker serialized pool (`makePoolSerialized`) together with Effect's Transferable collector to offload heavy numeric chart processing to workers with zero-copy Transferable ArrayBuffer transfers.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Main Thread                              │
├─────────────────────────────────────────────────────────────────┤
│  RawTableDTO ──► rawToBinary() ──► RawTableBinary               │
│                                      │                          │
│                                      ▼                          │
│                          encodeWithTransferables()              │
│                          (registers ArrayBuffers)               │
│                                      │                          │
│                                      ▼                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              ProcessorPool (makePoolSerialized)            │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │  │
│  │  │Worker 1 │  │Worker 2 │  │Worker 3 │  │Worker N │      │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                      │                          │
│                                      ▼                          │
│                              ChartDTO (response)                 │
└─────────────────────────────────────────────────────────────────┘
```

### Files

| File | Description |
|------|-------------|
| `src/lib/worker-protocol.ts` | Plain TypeScript DTO types (serializable, no functions) |
| `src/lib/worker-schema.ts` | Effect Schema definitions for boundary validation |
| `src/lib/rawToBinary.ts` | Converts RawTableDTO → RawTableBinary with ArrayBuffer extraction |
| `src/lib/encodeWithTransferables.ts` | Worker.Options.encode using Transferable.addAll |
| `src/lib/processor-worker.ts` | Worker entry script with chunked processing |
| `src/lib/poolLayer.ts` | makeProcessorPoolLayer helper and Context.Tag |
| `src/lib/example-runner.ts` | Demo script showing complete flow |

### Key Concepts

#### Transferable ArrayBuffers

Numeric columns are extracted into `Float64Array` buffers. These `ArrayBuffer` objects are registered with `Transferable.addAll()` before posting to workers, enabling **zero-copy transfer**. After transfer, the original buffers become detached (length 0).

```typescript
// In encodeWithTransferables.ts
export function encodeWithTransferables<A extends ProcessorRequest>(message: A) {
  return Effect.gen(function* () {
    if (message._tag === 'Process') {
      const buffers = extractTransferableBuffers(message.payload.raw);
      if (buffers.length > 0) {
        // Register for zero-copy transfer
        yield* Transferable.addAll(buffers);
      }
    }
    return message;
  });
}
```

#### Deadline-Aware QoS Lanes (WHEN Constraints)

For HMI/SCADA systems with hard real-time requirements:

| Lane | D_hard | D_soft | Use Case |
|------|--------|--------|----------|
| critical | 100ms | 50ms | Alarm states, safety interlocks |
| high | 500ms | 200ms | Operator-triggered updates |
| normal | 2000ms | 1000ms | Periodic refresh, trending |
| low | 10000ms | 5000ms | Background analytics |

**Sizing Formula:**
```
N = ceil(λ × (P + L + T/B))

Where:
  N = pool size
  λ = request arrival rate (requests/sec)
  P = processing time per request (sec)
  L = communication latency overhead (sec)
  T = transfer size (bytes)
  B = bandwidth (bytes/sec)
```

For hard real-time deadlines: `N ≥ ceil(D_hard / P)`

#### Cooperative Cancellation

The processor checks for Effect interruption at chunk boundaries:

```typescript
for (let i = 0; i < rowCount; i++) {
  if (i > 0 && i % chunkSize === 0) {
    const isInterrupted = yield* Effect.interrupted;
    if (isInterrupted) {
      return yield* Effect.interrupt;
    }
    yield* Effect.yieldNow(); // Cooperative multitasking
  }
  // ... process row
}
```

### Usage Example

```typescript
import * as Effect from 'effect/Effect';
import { rawTableToBinary } from './lib/rawToBinary';
import { ProcessorPoolTag, makeProcessorPoolLayer } from './lib/poolLayer';
import type { RawTableDTO, ProcessorConfig } from './lib/worker-protocol';

// 1. Create raw data
const rawTable: RawTableDTO = {
  columns: ['category', 'value'],
  rows: [
    { category: 'A', value: 10 },
    { category: 'B', value: 20 },
    // ... more rows
  ]
};

// 2. Convert to binary format
const binaryTable = rawTableToBinary(rawTable);

// 3. Configure processing
const config: ProcessorConfig = {
  groupByColumn: 'category',
  aggregateColumn: 'value',
  aggregationFn: 'sum',
};

// 4. Create pool layer
const PoolLayer = makeProcessorPoolLayer(ProcessorPoolTag, {
  workerModulePath: './processor-worker.ts',
  poolSize: 4,
});

// 5. Execute
const program = Effect.gen(function* () {
  const pool = yield* ProcessorPoolTag;
  const response = yield* pool.executeEffect({
    _tag: 'Process',
    payload: { raw: binaryTable, config }
  });
  return response;
}).pipe(Effect.provide(PoolLayer));

Effect.runPromise(program).then(console.log);
```

### Running the Example

```bash
cd packages/tmnl
npm run example:worker-pool
```

### Security Notes

1. **No functions across boundary**: All DTOs are plain data (no functions, class instances, or DOM nodes)
2. **Sanitize HTML on main thread**: If chart titles/labels come from user input, sanitize before rendering
3. **Input validation**: Schemas validate data at worker boundary

### Monitoring Points

- **Transfer size**: `calculateTransferSize(binaryTable)` returns total bytes
- **Processing time**: Response includes `processingTimeMs`
- **Queue depth**: Monitor pool utilization for capacity planning
- **Interruption rate**: Track cancelled requests for deadline tuning

## Building

Run `nx build tmnl` to build the library.

## Running unit tests

Run `nx test tmnl` to execute the unit tests via [Vitest](https://vitest.dev/).
