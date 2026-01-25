# AVA v2 Strategic Analysis

> **Status**: PHASE 1 COMPLETE ✅
> **Date**: 2026-01-08
> **Author**: Val (Prime's Architectural Conscience)
> **Session**: Strategic Planning - Completion Roadmap
>
> ## Completion Summary (2026-01-08)
>
> - ✅ **Gap 1 RESOLVED**: `avaV2Runtime = Atom.runtime((get) => createAvaV2Layer(get(avaV2ConfigAtom)))`
> - ✅ **Gap 2 N/A**: AvaProvider already existed, updated for runtime pattern compatibility
> - ✅ **Gap 3 RESOLVED**: Integration tests implemented in `ava-v2-integration.test.ts`
> - **Tests**: 144+ passing (15 integration + 32 hooks + atoms/schemas/services tests)

## Executive Summary

AVA v2 represents a fundamental shift from **tick-based pull model** to **event-driven reactive streaming**. The architecture spans Rust backend (complete) and TypeScript frontend (85% complete). This analysis synthesizes the original plans against current implementation to identify completion strategy.

---

## Original Vision vs Current State

### Architecture Vision (from ARCHITECTURE_V2.md)

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (TypeScript)                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ React Components                                         │   │
│  │   useViewSubscription(spec) → Result<ViewArtifact>      │   │
│  │   useChannel(viewId, channelId) → Result<ChannelData>   │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────┼────────────────────────────────┐   │
│  │ Effect-Atom Layer      ▼                                 │   │
│  │   avaRuntimeAtom = Atom.runtime(AvaClient.Default)      │   │
│  │   viewArtifactAtom = Atom.family(viewId => ...)         │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────┼────────────────────────────────┐   │
│  │ Effect Services        ▼                                 │   │
│  │   AvaClient (Context.Tag) → subscribe, invalidate       │   │
│  │   NatsClient (Context.Tag) → WebSocket connection       │   │
│  │   Effect Schema: ViewProfileSpec, ViewArtifact, etc.    │   │
│  └────────────────────────┬────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────────┘
                            │ NATS WebSocket (tmnl.ava.*)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Rust)                              │
│  ReconcilerV2 → ViewBroadcaster → NatsIntegration → JetStream  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Status Matrix

| Layer | Component | Planned | Implemented | Gap |
|-------|-----------|---------|-------------|-----|
| **Rust** | ReconcilerV2 | ✅ | ✅ | None |
| **Rust** | ViewBroadcaster | ✅ | ✅ | None |
| **Rust** | TriggerEngine | ✅ | ✅ | None |
| **Rust** | NatsIntegration | ✅ | ✅ | None |
| **Rust** | HydrationService | ✅ | ✅ | None |
| **TS** | Effect Schema | ✅ | ✅ | None |
| **TS** | NatsClient | ✅ | ✅ | None |
| **TS** | AvaClientV2 | ✅ | ✅ | None (FiberMap in service) |
| **TS** | Atoms v2 | ✅ | ✅ | **RESOLVED** - runtime.fn() pattern |
| **TS** | Hooks v2 | ✅ | ✅ | None |
| **TS** | AvaProvider | ✅ | ✅ | **EXISTS** - compatible w/ runtime |
| **TS** | Integration Tests | ✅ | ✅ | 15 tests in ava-v2-integration.test.ts |
| **TS** | AvaV2Testbed | ✅ | ✅ | Route: /testbed/ava-v2 |
| **TS** | MapBlock Integration | ✅ | ❌ | tmnl-uk4wf pending |

---

## Architectural Gap Analysis

### Gap 1: Fresh Layers Per Operation (CRITICAL)

**Original Plan** (from AVA_REACTIVE_BINDING_API.md):
```typescript
// Single runtime, persistent layer
const runtime = useMemo(() => {
  const fullLayer = Layer.merge(AvaClientLive(config), backendLayer)
  return Layer.toRuntime(fullLayer).pipe(Effect.runSync)
}, [config])
```

**Current Implementation** (atoms/v2/index.ts):
```typescript
// Each operation creates fresh layer
subscribe: Atom.fn<ViewId>()((viewId, ctx) =>
  Effect.gen(function* () {
    const config = ctx(avaV2ConfigAtom)
    const layer = createAvaV2Layer(config) // ← FRESH LAYER
    // ...
  })
)
```

**Impact**:
- FiberMap in AvaClientV2 is recreated per operation
- No persistent fiber tracking across subscribe/unsubscribe
- Manual HashMap for fiber management in atoms
- Auto-cleanup benefits not realized

**Resolution**: Implement AvaProvider with single shared runtime (tmnl-zjyrg)

### Gap 2: No AvaProvider Component

**Original Plan** (from AVA_REACTIVE_BINDING_API.md):
```tsx
export function AvaProvider({ backend, clientConfig, children }) {
  const runtime = useMemo(() => {
    const fullLayer = Layer.merge(AvaClientLive(clientConfig), backendLayer)
    return Layer.toRuntime(fullLayer).pipe(Effect.runSync)
  }, [backend, clientConfig])

  useEffect(() => {
    return () => {
      Effect.runFork(Effect.runtime(runtime).pipe(Effect.andThen(Runtime.dispose)))
    }
  }, [runtime])
  // ...
}
```

**Current State**: No provider component exists. Components must manage their own subscriptions.

**Resolution**: Create AvaProvider.tsx (tmnl-zjyrg)

### Gap 3: No Integration Tests with Live NATS

**Original Plan** (from AVA_V2_IMPLEMENTATION_STRATEGY.md):
```typescript
// Integration test: subscribe → receive artifact
it.effect('subscribes and receives artifact', () =>
  Effect.gen(function* () {
    const client = yield* AvaClient
    const stream = client.subscribeArtifact(ViewId('test-view'))
    const artifact = yield* Stream.runHead(stream)
    expect(artifact).toBeDefined()
  })
)
```

**Current State**: Only unit tests with mocks (46 tests). No live NATS validation.

**Resolution**: Create integration test suite (tmnl-jtf8p)

---

## Strategic Recommendations

### Priority Matrix

| Priority | Issue | Effort | Impact | Dependency Chain |
|----------|-------|--------|--------|------------------|
| **P0** | tmnl-zjyrg (AvaProvider) | Medium | High | Unblocks all |
| **P1** | tmnl-kr176 (Shared Runtime) | Medium | High | Needs AvaProvider |
| **P1** | tmnl-jtf8p (Integration Tests) | Medium | Critical | Validates everything |
| **P2** | tmnl-uk4wf (MapBlock) | Medium | Medium | Needs Integration Tests |
| **P2** | tmnl-hofdv (Testbed) | Low | Medium | Needs MapBlock |

### Tactical Execution Order

```
WEEK 1: Foundation (AvaProvider + Runtime Migration)
├── Day 1-2: AvaProvider.tsx
│   ├── Create React context with Atom.runtime
│   ├── Add useAvaRuntime() hook
│   └── Test lifecycle cleanup
├── Day 3-4: Refactor atoms to use runtime.fn()
│   ├── Remove subscriptionFibersAtom
│   ├── Use service FiberMap
│   └── Verify 46 tests pass
└── Day 5: Integration test setup
    ├── Docker NATS verification
    └── Basic connection test

WEEK 2: Validation + Integration
├── Day 1-2: Integration test suite
│   ├── Subscribe/receive artifact
│   ├── Delta stream verification
│   └── Invalidation roundtrip
├── Day 3-4: MapBlock integration
│   ├── useAvaMapData hook
│   ├── GeoJSON channel binding
│   └── Maplibre render
└── Day 5: AVA Testbed
    ├── Full flow demonstration
    └── Debug instrumentation
```

### Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| NATS WebSocket latency | Medium | High | Benchmark early, local-first testing |
| Layer lifecycle issues | Medium | High | Extensive cleanup verification |
| Type drift TS↔Rust | Low | Medium | Schema validation at boundaries |
| FiberMap misuse | Medium | Medium | Document patterns, add tests |

---

## Effect Patterns to Apply

### From effect-atom Submodule

```typescript
// 1. Atom.runtime pattern
const avaRuntime = Atom.runtime(createAvaV2Layer(config))

// 2. Runtime-scoped function atoms
const subscribe = avaRuntime.fn<ViewId>()((viewId) =>
  Effect.gen(function* () {
    const client = yield* AvaClientV2
    yield* FiberMap.run(client.subscriptionFibers, viewId, streamProgram)
  })
)

// 3. Test with layer replacement
const registry = Registry.make({
  initialValues: [Atom.initialValue(avaRuntime.layer, TestLayer)]
})
```

### From FiberMap Research (deepwiki)

```typescript
// 1. FiberMap.run for managed subscriptions
yield* FiberMap.run(fiberMap, viewId, streamProgram)

// 2. Auto-cleanup on Layer close
const AvaClientV2Live = Layer.scoped(AvaClientV2, Effect.gen(function* () {
  const fiberMap = yield* FiberMap.make<ViewId>()
  // All fibers auto-interrupted when Layer closes
}))

// 3. onlyIfMissing to prevent duplicates
yield* FiberMap.run(fiberMap, viewId, program, { onlyIfMissing: true })
```

---

## Beads Alignment

### Critical Path (Dependencies Set)

```
tmnl-zjyrg (AvaProvider)
    │
    ▼ blocks
tmnl-kr176 (Shared Runtime)
    │
    ▼ blocks
tmnl-jtf8p (Integration Tests)
    │
    ▼ blocks
tmnl-uk4wf (MapBlock)
    │
    ▼ blocks
tmnl-hofdv (Testbed)
```

### Ready to Start

1. **tmnl-zjyrg** - AvaProvider with Atom.runtime pattern
2. **tmnl-rgy9x** - [Rust] Implement gRPC ChannelData serialization (parallel track)

### Blocked

- tmnl-kr176 - Needs AvaProvider
- tmnl-jtf8p - Needs Shared Runtime
- tmnl-uk4wf - Needs Integration Tests

---

## Success Criteria

### Phase 1 Complete (AvaProvider + Runtime)
- [ ] AvaProvider creates single shared runtime
- [ ] Atoms use runtime.fn() pattern
- [ ] FiberMap cleanup verified on unmount
- [ ] All 46 tests pass

### Phase 2 Complete (Integration)
- [ ] Integration tests pass with live NATS
- [ ] Subscribe → artifact roundtrip verified
- [ ] Delta → incremental update verified
- [ ] Invalidation → recomputation verified

### Phase 3 Complete (Components)
- [ ] MapBlock renders AVA channel data
- [ ] Testbed demonstrates full reactive flow
- [ ] AG-Grid integration functional

---

## References

- [ARCHITECTURE_V2.md](../src-ava/docs/ARCHITECTURE_V2.md) - Core v2 architecture
- [AVA_REACTIVE_BINDING_API.md](../src-ava/docs/AVA_REACTIVE_BINDING_API.md) - React binding design
- [AVA_V2_IMPLEMENTATION_STRATEGY.md](../src-ava/docs/AVA_V2_IMPLEMENTATION_STRATEGY.md) - Implementation phases
- [AVA_V2_COMPLETION_STRATEGY.md](./AVA_V2_COMPLETION_STRATEGY.md) - Session completion tracking
- [effect-atom tests](../../submodules/effect-atom/packages/atom/test/) - Canonical test patterns
