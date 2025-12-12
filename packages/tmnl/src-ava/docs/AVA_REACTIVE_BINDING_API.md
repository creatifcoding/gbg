# AVA Unified Reactive Binding API Design

> **Bead**: I51 - Design unified reactive binding API
> **Status**: In Progress
> **Dependencies**: I49 (WASM Client Architecture)

## Overview

The Unified Reactive Binding API provides a single, backend-agnostic interface for subscribing to AVA views and receiving reactive channel data. The API abstracts over the underlying reactive library (effect-atom, legend-state, or others) while providing consistent semantics.

## Design Goals

1. **Backend-agnostic**: Works with effect-atom, legend-state, or custom backends
2. **Type-safe**: Full TypeScript support with Effect Schema types
3. **Auto-disposing**: Subscriptions clean up when components unmount
4. **Progressive**: Channels hydrate progressively, not all-at-once
5. **Composable**: Can combine multiple view subscriptions

## Core Interface

### `subscribeView` Function

```typescript
// src/lib/ava/binding.ts
import { Effect, Context, Layer } from 'effect';
import { Schema } from 'effect';

/**
 * Reactive channel data container
 * Backend-specific implementation (effect-atom or legend-state)
 */
interface Reactive<T> {
  /** Get current value synchronously */
  get(): T | undefined;

  /** Subscribe to changes */
  subscribe(callback: (value: T) => void): () => void;

  /** Effect-style accessor */
  readonly effect: Effect.Effect<T>;
}

/**
 * View subscription result
 */
interface ViewSubscription {
  /** Reactive channel data by channel ID */
  readonly channels: Record<string, Reactive<ChannelData>>;

  /** View metadata */
  readonly artifact: Reactive<ViewArtifact>;

  /** Subscription status */
  readonly status: Reactive<SubscriptionStatus>;

  /** Unsubscribe and cleanup */
  readonly unsubscribe: () => void;

  /** Force refresh */
  readonly invalidate: () => Effect.Effect<void>;
}

type SubscriptionStatus =
  | { _tag: 'Connecting' }
  | { _tag: 'Active'; since: number }
  | { _tag: 'Reconnecting'; attempt: number }
  | { _tag: 'Error'; error: AvaError }
  | { _tag: 'Closed' };

/**
 * Subscribe to a view and receive reactive channel data
 */
declare function subscribeView(
  spec: ViewProfileSpec,
  options?: SubscribeOptions
): Effect.Effect<ViewSubscription, AvaError, AvaClient>;
```

### Options

```typescript
interface SubscribeOptions {
  /** Which channels to hydrate immediately */
  hydrateChannels?: string[];

  /** Hydration strategy override per channel */
  channelStrategies?: Record<string, HydrationStrategy>;

  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;

  /** Max reconnect attempts (default: 5) */
  maxReconnectAttempts?: number;
}
```

## Backend Abstraction

### ReactiveBackend Service

```typescript
// Service tag for the reactive backend
class ReactiveBackend extends Context.Tag('ava/ReactiveBackend')<
  ReactiveBackend,
  {
    /** Create a new reactive container */
    readonly makeReactive: <T>(initial?: T) => Reactive<T>;

    /** Create a derived reactive from a source */
    readonly derive: <T, U>(
      source: Reactive<T>,
      fn: (value: T) => U
    ) => Reactive<U>;

    /** Batch multiple updates */
    readonly batch: (updates: () => void) => void;
  }
>() {}
```

### effect-atom Implementation

```typescript
// src/lib/ava/backends/effect-atom.ts
import { Atom } from '@effect-atom/atom-react';

const EffectAtomBackend = Layer.succeed(ReactiveBackend, {
  makeReactive: <T>(initial?: T) => {
    const atom = Atom.make(initial);
    return {
      get: () => Atom.get(atom),
      subscribe: (cb) => {
        const unsub = Atom.subscribe(atom, cb);
        return unsub;
      },
      effect: Effect.sync(() => Atom.get(atom)),
    };
  },

  derive: <T, U>(source: Reactive<T>, fn: (value: T) => U) => {
    const derived = Atom.make(fn(source.get()!));
    source.subscribe((value) => {
      Atom.set(derived, fn(value));
    });
    return {
      get: () => Atom.get(derived),
      subscribe: (cb) => Atom.subscribe(derived, cb),
      effect: Effect.sync(() => Atom.get(derived)),
    };
  },

  batch: (updates) => {
    // effect-atom batches automatically
    updates();
  },
});
```

### legend-state Implementation

```typescript
// src/lib/ava/backends/legend-state.ts
import { observable, observe, batch } from '@legendapp/state';

const LegendStateBackend = Layer.succeed(ReactiveBackend, {
  makeReactive: <T>(initial?: T) => {
    const obs = observable(initial);
    return {
      get: () => obs.get(),
      subscribe: (cb) => observe(obs, () => cb(obs.get())),
      effect: Effect.sync(() => obs.get()),
    };
  },

  derive: <T, U>(source: Reactive<T>, fn: (value: T) => U) => {
    const derived = observable<U>();
    observe(source as any, () => {
      derived.set(fn(source.get()!));
    });
    return {
      get: () => derived.get(),
      subscribe: (cb) => observe(derived, () => cb(derived.get()!)),
      effect: Effect.sync(() => derived.get()),
    };
  },

  batch: batch,
});
```

## Provider Pattern

### AvaProvider Component

```tsx
// src/lib/ava/provider.tsx
import { createContext, useContext, useMemo, useEffect } from 'react';

interface AvaProviderProps {
  /** Backend to use */
  backend: 'effect-atom' | 'legend-state' | Layer.Layer<ReactiveBackend>;

  /** WASM client config */
  clientConfig?: AvaClientConfig;

  children: React.ReactNode;
}

const AvaContext = createContext<{
  subscribeView: typeof subscribeView;
  runtime: Runtime.Runtime<AvaClient | ReactiveBackend>;
} | null>(null);

export function AvaProvider({ backend, clientConfig, children }: AvaProviderProps) {
  const runtime = useMemo(() => {
    const backendLayer = typeof backend === 'string'
      ? backend === 'effect-atom' ? EffectAtomBackend : LegendStateBackend
      : backend;

    const fullLayer = Layer.merge(
      AvaClientLive(clientConfig),
      backendLayer
    );

    return Layer.toRuntime(fullLayer).pipe(Effect.runSync);
  }, [backend, clientConfig]);

  const contextValue = useMemo(() => ({
    subscribeView: (spec: ViewProfileSpec, options?: SubscribeOptions) =>
      subscribeView(spec, options).pipe(Effect.provide(runtime)),
    runtime,
  }), [runtime]);

  useEffect(() => {
    return () => {
      Effect.runFork(Effect.runtime(runtime).pipe(Effect.andThen(Runtime.dispose)));
    };
  }, [runtime]);

  return (
    <AvaContext.Provider value={contextValue}>
      {children}
    </AvaContext.Provider>
  );
}

export function useAva() {
  const ctx = useContext(AvaContext);
  if (!ctx) throw new Error('useAva must be used within AvaProvider');
  return ctx;
}
```

## React Hooks

### useViewSubscription

```tsx
// src/lib/ava/hooks.ts
import { useEffect, useState, useCallback } from 'react';

interface UseViewSubscriptionResult<T extends string = string> {
  /** Channel data by ID */
  channels: Record<T, ChannelData | undefined>;

  /** Current artifact */
  artifact: ViewArtifact | undefined;

  /** Subscription status */
  status: SubscriptionStatus;

  /** Force refresh */
  invalidate: () => void;

  /** Error if any */
  error: AvaError | undefined;
}

export function useViewSubscription<T extends string = string>(
  spec: ViewProfileSpec | undefined,
  options?: SubscribeOptions
): UseViewSubscriptionResult<T> {
  const { subscribeView, runtime } = useAva();
  const [subscription, setSubscription] = useState<ViewSubscription | null>(null);
  const [channels, setChannels] = useState<Record<T, ChannelData | undefined>>({} as any);
  const [artifact, setArtifact] = useState<ViewArtifact>();
  const [status, setStatus] = useState<SubscriptionStatus>({ _tag: 'Connecting' });
  const [error, setError] = useState<AvaError>();

  useEffect(() => {
    if (!spec) return;

    const program = Effect.gen(function* () {
      const sub = yield* subscribeView(spec, options);
      setSubscription(sub);

      // Subscribe to artifact updates
      const unsubArtifact = sub.artifact.subscribe(setArtifact);

      // Subscribe to status
      const unsubStatus = sub.status.subscribe(setStatus);

      // Subscribe to each channel
      const channelUnsubs: (() => void)[] = [];
      for (const [id, reactive] of Object.entries(sub.channels)) {
        const unsub = reactive.subscribe((data) => {
          setChannels((prev) => ({ ...prev, [id]: data }));
        });
        channelUnsubs.push(unsub);
      }

      return () => {
        unsubArtifact();
        unsubStatus();
        channelUnsubs.forEach((u) => u());
        sub.unsubscribe();
      };
    });

    const fiber = Effect.runFork(program);

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [spec, options, subscribeView]);

  const invalidate = useCallback(() => {
    if (subscription) {
      Effect.runFork(subscription.invalidate());
    }
  }, [subscription]);

  return { channels, artifact, status, invalidate, error };
}
```

### useChannel (Single Channel)

```tsx
export function useChannel<T = unknown>(
  viewSpec: ViewProfileSpec | undefined,
  channelId: string
): {
  data: T | undefined;
  isLoading: boolean;
  error: AvaError | undefined;
} {
  const { channels, status, error } = useViewSubscription(viewSpec, {
    hydrateChannels: [channelId],
  });

  return {
    data: channels[channelId]?.data as T | undefined,
    isLoading: status._tag === 'Connecting' || status._tag === 'Reconnecting',
    error,
  };
}
```

## Usage Examples

### Basic Usage

```tsx
import { AvaProvider, useViewSubscription } from '@/lib/ava';

function App() {
  return (
    <AvaProvider backend="effect-atom">
      <Dashboard />
    </AvaProvider>
  );
}

function Dashboard() {
  const spec: ViewProfileSpec = {
    id: 'dashboard-1',
    name: 'Main Dashboard',
    assemblageId: 'metrics',
    channels: [
      { id: 'kpis', role: 'STATE' },
      { id: 'events', role: 'EVENT' },
    ],
  };

  const { channels, status } = useViewSubscription(spec);

  if (status._tag === 'Connecting') return <Loading />;
  if (status._tag === 'Error') return <Error error={status.error} />;

  return (
    <div>
      <KPIPanel data={channels.kpis?.data} />
      <EventStream data={channels.events?.data} />
    </div>
  );
}
```

### With AG-Grid

```tsx
import { useViewSubscription } from '@/lib/ava';
import { AgGridReact } from 'ag-grid-react';

function DataGridView() {
  const { channels, invalidate } = useViewSubscription(spec);
  const gridData = channels.state?.data as RowData[] ?? [];

  return (
    <div>
      <button onClick={invalidate}>Refresh</button>
      <AgGridReact
        rowData={gridData}
        columnDefs={columnDefs}
        getRowId={(params) => params.data.id}
      />
    </div>
  );
}
```

### Legend-State Backend

```tsx
import { AvaProvider } from '@/lib/ava';
import { enableReactTracking } from '@legendapp/state/react';

enableReactTracking({ auto: true });

function App() {
  return (
    <AvaProvider backend="legend-state">
      <Dashboard />
    </AvaProvider>
  );
}
```

## Auto-Dispose Behavior

Subscriptions automatically clean up when:

1. **Component unmounts**: `useViewSubscription` cleans up in useEffect return
2. **Spec changes**: Previous subscription disposed before new one created
3. **Provider unmounts**: Runtime disposed, all subscriptions cleaned up
4. **Manual unsubscribe**: Call `subscription.unsubscribe()` explicitly

```typescript
// Cleanup flow
const cleanup = () => {
  // 1. Unsubscribe from all reactive containers
  channelUnsubs.forEach(u => u());

  // 2. Unsubscribe from WASM stream
  wasmBridge.unsubscribe(viewId);

  // 3. Release cached assets
  assetCache.evict(viewId);

  // 4. Update status
  status.set({ _tag: 'Closed' });
};
```

## Error Handling

### Error Recovery

```typescript
const subscribeWithRetry = (spec: ViewProfileSpec) =>
  Effect.gen(function* () {
    const client = yield* AvaClient;
    const backend = yield* ReactiveBackend;

    const statusReactive = backend.makeReactive<SubscriptionStatus>({ _tag: 'Connecting' });

    const connect = Effect.gen(function* () {
      try {
        const stream = yield* client.subscribe(spec);
        statusReactive.set({ _tag: 'Active', since: Date.now() });
        return stream;
      } catch (e) {
        statusReactive.set({ _tag: 'Error', error: e as AvaError });
        throw e;
      }
    });

    // Retry with exponential backoff
    const retryPolicy = Schedule.exponential('100 millis').pipe(
      Schedule.compose(Schedule.recurs(5))
    );

    return yield* connect.pipe(
      Effect.retry(retryPolicy),
      Effect.catchAll((e) =>
        Effect.succeed({ error: e, status: statusReactive })
      )
    );
  });
```

## File Structure

```
src/lib/ava/
├── index.ts              # Public exports
├── binding.ts            # Core subscribeView function
├── provider.tsx          # AvaProvider component
├── hooks.ts              # React hooks
├── types.ts              # TypeScript types
├── backends/
│   ├── index.ts          # Backend exports
│   ├── effect-atom.ts    # effect-atom implementation
│   └── legend-state.ts   # legend-state implementation
└── __tests__/
    ├── binding.test.ts
    └── hooks.test.tsx
```

## Schema Types

```typescript
// src/lib/ava/types.ts
import { Schema } from 'effect';

export const SubscriptionStatus = Schema.Union(
  Schema.TaggedStruct('Connecting', {}),
  Schema.TaggedStruct('Active', {
    since: Schema.Number,
  }),
  Schema.TaggedStruct('Reconnecting', {
    attempt: Schema.Number,
  }),
  Schema.TaggedStruct('Error', {
    error: AvaError,
  }),
  Schema.TaggedStruct('Closed', {})
);
export type SubscriptionStatus = typeof SubscriptionStatus.Type;
```

## Testing Strategy

### Unit Tests

```typescript
// src/lib/ava/__tests__/binding.test.ts
import { describe, it, expect } from '@effect/vitest';

describe('subscribeView', () => {
  it.effect('creates subscription with channels', () =>
    Effect.gen(function* () {
      const sub = yield* subscribeView(testSpec);

      expect(sub.channels).toHaveProperty('state');
      expect(sub.status.get()).toEqual({ _tag: 'Connecting' });

      sub.unsubscribe();
    }).pipe(
      Effect.provide(TestLayers)
    )
  );
});
```

### Integration Tests

```tsx
// src/lib/ava/__tests__/hooks.test.tsx
import { renderHook, act } from '@testing-library/react-hooks';

describe('useViewSubscription', () => {
  it('subscribes and receives updates', async () => {
    const wrapper = ({ children }) => (
      <AvaProvider backend="effect-atom">
        {children}
      </AvaProvider>
    );

    const { result, waitForNextUpdate } = renderHook(
      () => useViewSubscription(testSpec),
      { wrapper }
    );

    expect(result.current.status._tag).toBe('Connecting');

    await waitForNextUpdate();

    expect(result.current.status._tag).toBe('Active');
    expect(result.current.channels.state).toBeDefined();
  });
});
```

## References

- [I49: WASM Client Architecture](./AVA_WASM_V2_ARCHITECTURE.md)
- [effect-atom Patterns](../../.edin/EFFECT_PATTERNS.md)
- [Legend-State Documentation](https://legendapp.com/open-source/state/)
- [Effect-TS Layer Documentation](https://effect.website/docs/guides/context-management)
