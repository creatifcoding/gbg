# @effect/cluster — Distributed Entity Patterns Research

**Date**: 2026-02-09
**Researcher**: Val (cluster-researcher agent)
**Sources**: Submodule source code (`submodules/effect/packages/cluster/src/`), DeepWiki `@Effect-TS/effect`
**Purpose**: Understand cluster-level entity lifecycle observation for metropolitan-scale IIoT platform

---

## 1. Entity Lifecycle — Creation, Destruction, Migration

### 1.1 Entity Creation / Activation

**VERIFIED via `Entity.ts:239-273` (toLayer implementation)**

When `Entity.toLayer(build, options)` is called:
1. It calls `sharding.registerEntity(entity, build, options)` wrapped in `Layer.scopedDiscard`
2. The `Sharding.registerEntity` implementation (`Sharding.ts:1271-1321`) creates an `EntityManager` for the entity type
3. Individual entity **instances** are created lazily by the `EntityManager` when the first message for that `entityId` arrives
4. The `build` effect (handler factory) is executed per-entity-instance inside a dedicated `Scope` (`entityManager.ts:151-165`)

**Key insight**: Entity TYPE registration is eager (at `toLayer` time). Entity INSTANCE creation is lazy (on first message).

### 1.2 Entity Destruction / Deactivation

**VERIFIED via `entityManager.ts:337-351` and `entityReaper.ts` reference**

Entity instances are destroyed when:
- **Idle timeout**: `EntityReaper` checks `lastActiveCheck` against `maxIdleTime` (default: 1 minute per `ShardingConfig.ts:143`)
- **Shard reassignment**: `EntityManager.interruptShard(shardId)` removes all entities on that shard (`entityManager.ts:491-506`)
- **Runner shutdown**: The `Sharding` scope finalizer triggers shutdown cascade (`Sharding.ts:1378-1395`)

Destruction sequence:
1. Entity's `Scope` finalizer fires
2. `activeServers.delete(address.entityId)` removes from active map
3. `write(0, { _tag: "Eof" })` signals end to RpcServer
4. Waits for `endLatch.await` with `entityTerminationTimeout` (default: 15s)
5. All forked fibers in entity scope are interrupted

### 1.3 Entity Migration

**VERIFIED via `Sharding.ts:303-371` (shard acquisition loop)**

Migration is NOT an atomic operation. It is:
1. Shard is released on old runner (entities interrupted)
2. `RunnerStorage` lock is released
3. `HashRing` recomputation assigns shard to new runner
4. New runner acquires shard lock
5. Next message to that entityId creates a fresh instance on new runner

**There is NO state transfer between nodes.** Entity state must be reconstructed from:
- `MessageStorage` (for durable/persisted messages)
- External state stores (your own database)
- `EntityResource` (re-acquired on new node)

### 1.4 Lifecycle Hooks

**VERIFIED: No explicit lifecycle hooks exist.**

| Hook Pattern | Available? | Alternative |
|---|---|---|
| `onCreate` / `onActivate` | NO | Use the `build` Effect in `toLayer` — it runs per-instance |
| `onDestroy` / `onDeactivate` | NO | Use `Scope.addFinalizer` inside the `build` Effect |
| `onMigrate` | NO | Does not exist — migration = destroy + create elsewhere |
| `onMessage` middleware | NO (per-entity) | `Rpc.Middleware` exists at RPC level, not entity level |
| `onIdle` / `onReap` | NO | `EntityReaper` handles this internally |

### 1.5 Forked Fibers Inside Entity Handlers

**VERIFIED via `Entity.ts:336-346` (toLayerMailbox) and `entityManager.ts:152-162`**

- Fibers forked with `Effect.forkScoped` inside the `build` effect survive across multiple RPC calls to the same entity instance
- They are tied to the entity instance's `Scope`
- When the entity is destroyed (reaped, shard moved, etc.), all scoped fibers are interrupted
- `toLayerMailbox` explicitly uses `Effect.forkScoped` for the behavior fiber

**Safe to fork observers inside entity handlers.** They will live for the entity instance lifetime.

---

## 2. Cluster-Level Entity Observation

### 2.1 Registration Events (Type-Level)

**VERIFIED via `Sharding.ts:68-73` and `Sharding.ts:227-228`**

```typescript
readonly getRegistrationEvents: Stream.Stream<ShardingRegistrationEvent>
```

This stream emits:
- `EntityRegistered({ entity })` — when an entity TYPE is registered (once per `toLayer`)
- `SingletonRegistered({ address })` — when a singleton is registered

**This is TYPE registration only, NOT instance creation/destruction.**

Source: `ShardingRegistrationEvent.ts:14-39` — only two variants exist.

### 2.2 Instance-Level Observation

**VERIFIED: NO built-in mechanism exists for observing individual entity instance creation/destruction across the cluster.**

| What You Want | Available? | Source |
|---|---|---|
| Stream of entity instance creations | NO | Not in API |
| Stream of entity instance destructions | NO | Not in API |
| Active entity count (per runner) | YES | `Sharding.activeEntityCount` (`Sharding.ts:187`) |
| Active entity count (cluster-wide) | NO | Would need to aggregate per-runner |
| Entity instance addresses | NO | Not exposed |
| Entity state changes | NO | Entities are opaque to the cluster |

### 2.3 Implications for Our Design

**Cluster-level observation must be built by us.** Options:

**Option A (70% confidence): Handler-level observation**
- Inside each entity's `build` effect, publish creation/destruction events via `Scope.addFinalizer` and PubSub
- Entity handlers emit domain events when state changes
- This is per-node but can be aggregated via NATS/EventDistribution

**Option B (15% confidence): Custom EntityManager wrapper**
- Wrap or extend `EntityManager` to intercept `entities.get()` calls
- Would require forking the cluster package — maintenance burden

**Option C (10% confidence): MessageStorage middleware**
- Intercept `MessageStorage.saveRequest` / `saveReply` to infer entity activity
- Fragile, couples to internal storage format

**Option D (5% confidence): Polling `activeEntityCount`**
- Periodically poll `Sharding.activeEntityCount` per runner
- Only gives aggregate count, not per-entity details

**Recommendation: Option A.** This aligns with our existing ReactivityBridge approach (handler-level integration).

---

## 3. Entity Serialization and Distribution

### 3.1 RPC Routing

**VERIFIED via `Sharding.ts:818-854` (sendOutgoing)**

Message routing flow:
1. Client calls `entity.client` -> `Sharding.makeClient`
2. `makeClient` creates a proxy that resolves `entityId` -> `EntityAddress` -> `ShardId`
3. `ShardId` is computed via `HashRing` based on `entityId` hash
4. `shardAssignments` map determines which `RunnerAddress` owns the shard
5. If local: `sendLocal` -> `EntityManager.send`
6. If remote: `Runners.send` -> RPC over transport (Socket/HTTP/WebSocket)

### 3.2 State Survival

**VERIFIED: Entity state does NOT survive node failure by default.**

State reconstruction options:
- **Persisted messages** (`ClusterSchema.Persisted` annotation): Messages survive in `MessageStorage` and are replayed after shard movement
- **EntityResource**: Resources are re-acquired (not transferred) on new node
- **External state**: Application must manage its own persistence

### 3.3 Message Durability

**VERIFIED via `ClusterSchema.ts:12-14`**

```typescript
export class Persisted extends Context.Reference<Persisted>()("@effect/cluster/ClusterSchema/Persisted", {
  defaultValue: constFalse
}) {}
```

- RPCs annotated with `.annotate(ClusterSchema.Persisted, true)` are saved to `MessageStorage` before delivery
- Non-persisted RPCs are fire-and-forget — lost if the runner crashes
- `Uninterruptible` annotation controls interrupt behavior during shutdown/migration

---

## 4. Machine + Entity Composition

### 4.1 No Direct Integration

**VERIFIED via grep of entire cluster package: "Machine" only appears in `MachineId.ts` and `Snowflake.ts` (for machine ID in snowflake generation).**

`@effect/cluster/Entity` and `@effect/experimental/Machine` are **independent systems**:

| Feature | Entity (cluster) | Machine (experimental) |
|---|---|---|
| Distribution | Yes (sharded) | No (local) |
| Message protocol | RpcGroup-based | Procedure-based |
| State management | External / handler scope | Built-in state transitions |
| Mailbox | Optional (toLayerMailbox) | Built-in via Machine.boot |
| Lifecycle | Managed by EntityManager/Reaper | Managed by Scope |

### 4.2 Composition Patterns

**UNCERTAIN — derived from architecture analysis, not verified in existing code.**

To compose Machine behavior inside an Entity:

```typescript
// Pattern: Machine-in-Entity
const MyEntity = Entity.make("MyEntity", [
  Rpc.make("processEvent", { payload: MyEvent, success: Schema.Void })
])

const MyEntityLayer = MyEntity.toLayerMailbox(
  Effect.gen(function* () {
    // Boot a Machine inside the entity scope
    const machine = yield* Machine.boot(myMachineDefinition)

    return (mailbox, replier) => Effect.gen(function* () {
      // Process mailbox messages through the machine
      while (true) {
        const request = yield* mailbox.take
        const result = yield* machine.send(mapToMachineInput(request))
        yield* replier.succeed(request, result)
      }
    })
  })
)
```

### 4.3 Fiber Lifecycle Inside Entity.toLayer

**VERIFIED via `entityManager.ts:151-165` and `Entity.ts:302-346`**

Inside the `build` effect for `toLayer`:
- `yield* Effect.scope` gives you the entity instance's scope
- `Effect.forkScoped` ties a fiber to this scope
- The scope survives across RPC calls to the same entity
- The scope is closed when the entity is reaped, migrated, or shutdown

Inside `toLayerMailbox`:
- The behavior function runs as a forked scoped fiber
- It processes messages from the mailbox in a loop
- The fiber is interrupted when the entity scope closes
- `catchAllCause` ensures pending requests get failure replies

**We can safely fork observers (e.g., Machine actors, PubSub subscribers) inside entity handlers. They survive the entity instance lifetime.**

---

## 5. Cluster Transport Options

### 5.1 Available Transports

**VERIFIED via `SocketRunner.ts`, `HttpRunner.ts`, `SingleRunner.ts`, `TestRunner.ts`**

| Transport | Module | Protocol | Use Case |
|---|---|---|---|
| **TCP Socket** | `SocketRunner` | Binary via `@effect/platform/SocketServer` | Production multi-node |
| **HTTP** | `HttpRunner.layerHttp` | HTTP POST via `HttpRouter` | REST-style inter-runner |
| **WebSocket** | `HttpRunner.layerWebsocket` | WS via `HttpRouter` | Persistent connection inter-runner |
| **Single Node** | `SingleRunner` | In-process (no network) | Single-node with SQL durability |
| **Test** | `TestRunner` | In-memory (no persistence) | Unit tests |

### 5.2 NATS as Transport

**VERIFIED: NOT natively supported.**

NATS would require implementing:
1. A custom `RpcClientProtocol` (like `HttpRunner.layerClientProtocolHttp`)
2. A custom `RunnerStorage` (or keep SQL for discovery)
3. NATS subjects for runner-to-runner communication

This is feasible but would be custom work. The `RpcClientProtocol` interface (`Runners.ts:620-623`) is the extension point:

```typescript
export class RpcClientProtocol extends Context.Tag("@effect/cluster/Runners/RpcClientProtocol")<
  RpcClientProtocol,
  (address: RunnerAddress) => Effect.Effect<RpcClient_.Protocol["Type"], never, Scope>
>() {}
```

### 5.3 Node Discovery

**VERIFIED via `Sharding.ts:888-1001` (RunnerStorage sync loop)**

- **No gossip protocol.** Discovery is via polling `RunnerStorage` (shared database).
- Runners register with `RunnerStorage.register(runner, true)` on startup
- `Sharding` periodically reads all runners via `runnerStorage.getRunners`
- Default refresh interval: 3 seconds (`ShardingConfig.ts:150`)
- Health checks run as a singleton on one node (`Sharding.ts:1334-1373`)
- Unhealthy runners are removed from the HashRing

### 5.4 Shard Assignment Algorithm

**VERIFIED via `Sharding.ts:952-968`**

- Uses `HashRing` (consistent hashing) from `effect/HashRing`
- Each runner has a `weight` (default 1) that determines shard count proportionality
- `config.shardsPerGroup` (default 300) shards per shard group
- When a runner joins/leaves, shards are rebalanced via HashRing recomputation
- Shard locks are acquired in `RunnerStorage` (SQL advisory locks by default)

---

## 6. EntityResource Deep Dive

### 6.1 How It Works

**VERIFIED via `EntityResource.ts:63-110`**

```
EntityResource.make({ acquire, idleTimeToLive })
  1. Entity.keepAlive(true) — prevents reaping
  2. RcRef.make({ acquire, idleTimeToLive }) — reference-counted resource
  3. Scope.addFinalizer — sets shuttingDown flag on entity restart
  4. Effect.scoped(RcRef.get(ref)) — initializes the resource eagerly
  5. Returns { get, close } interface
```

### 6.2 CloseScope

**VERIFIED via `EntityResource.ts:44-48`**

`CloseScope` is a `Context.Tag` that provides a `Scope` which is:
- **NOT closed** during shard movements or node restarts
- **Only closed** when `EntityResource.close` is explicitly called
- Allows resources to survive entity restarts

When the entity's scope closes during a shard movement:
1. The finalizer sets `shuttingDown = true`
2. This prevents the `RcRef` finalizer from closing the `CloseScope`
3. When the entity restarts on a new node, `acquire` re-runs but `CloseScope` resources persist

### 6.3 Implications for IIoT

EntityResource is ideal for:
- NATS connections that should survive entity restarts
- Database connection pools per-entity
- Subscription state that needs explicit cleanup

---

## 7. Key Findings Summary

### What @effect/cluster Provides

1. **Sharded entity distribution** with consistent hashing
2. **Lazy entity instance creation** (on first message)
3. **Automatic idle reaping** with configurable timeout
4. **Message durability** via `Persisted` annotation + `MessageStorage`
5. **Multiple transport options** (Socket, HTTP, WebSocket)
6. **EntityResource** for resources that survive entity restarts
7. **Singleton support** for cluster-wide unique processes
8. **Workflow engine** for durable workflows
9. **Test infrastructure** (`TestRunner`, `Entity.makeTestClient`)

### What @effect/cluster Does NOT Provide

1. **Entity instance lifecycle observation** — no stream of instance create/destroy events
2. **Cross-cluster event bus** — no built-in domain event distribution
3. **Entity state transfer on migration** — state is NOT transferred, must be reconstructed
4. **Machine integration** — Entity and Machine are independent
5. **NATS transport** — only Socket, HTTP, WebSocket natively
6. **Gossip protocol** — discovery is via shared database polling

### Implications for Our Entity Lifecycle Observation Design

1. **Observation MUST be per-node with aggregation** — no cluster-level instance events exist
2. **Handler-level integration is correct approach** — entity handlers emit domain events via PubSub/ChannelService
3. **Forked observers inside entities are safe** — they survive the entity instance lifetime
4. **EntityResource is the right pattern for persistent connections** (NATS, DB pools)
5. **Shard movement = entity restart** — our observers must be restart-tolerant
6. **ReactivityBridge (handler-level) is validated** — this aligns with cluster's architecture

### Testing Patterns

- `TestRunner.layer` for in-memory cluster testing
- `Entity.makeTestClient` for testing entity handlers without full cluster
- `SingleRunner.layer` for SQL-backed single-node testing

---

## Appendix: File Reference

| File | Purpose | Key Lines |
|---|---|---|
| `Entity.ts` | Entity definition, `toLayer`, `toLayerMailbox`, `makeTestClient` | 120-147 (toLayer), 155-187 (toLayerMailbox), 497-589 (makeTestClient) |
| `Sharding.ts` | Core sharding service, entity registration, shard management | 68-73 (getRegistrationEvents), 200-1428 (implementation) |
| `EntityResource.ts` | Persistent resources inside entities | 63-110 (make) |
| `EntityProxy.ts` | Derives RpcGroup/HttpApiGroup from Entity | 47-76 (toRpcGroup) |
| `ShardingRegistrationEvent.ts` | Registration event types | 14-39 (type definition) |
| `ShardingConfig.ts` | Configuration with defaults | 21-124 (config model), 132-152 (defaults) |
| `Runner.ts` | Runner model (address + groups + weight) | 38-42 (Schema.Class) |
| `Runners.ts` | Runner-to-runner communication, RPC client protocol | 34-112 (Runners service), 620-623 (RpcClientProtocol) |
| `HttpRunner.ts` | HTTP/WebSocket transport layers | 32-265 (layers) |
| `SocketRunner.ts` | TCP socket transport layer | 33-46 (layer) |
| `SingleRunner.ts` | Single-node SQL-backed deployment | 23-41 (layer) |
| `TestRunner.ts` | In-memory test deployment | 21-28 (layer) |
| `ClusterSchema.ts` | Annotations (Persisted, Uninterruptible, ShardGroup) | 12-57 |
| `ClusterWorkflowEngine.ts` | Durable workflow engine using Entity | 46-659 |
| `internal/entityManager.ts` | Per-entity-type instance management | 46-643 |
