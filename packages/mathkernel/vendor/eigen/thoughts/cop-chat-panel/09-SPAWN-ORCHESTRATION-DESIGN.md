# 09 — Pi Spawn & Management Orchestration — Effect Architecture

> Aligned model from questionnaire `pi-spawn-orchestration-design`

## Aligned Decisions

| Axis | Decision | Effect Pattern |
|------|----------|----------------|
| **Cardinality** | Per-agent instance | `KeyedPool<AgentRole, PiInstance>` |
| **Ownership** | Session-scoped | `Layer.scoped` + `Effect.addFinalizer` |
| **Recovery** | Supervised fiber tree | `Supervisor.track` + `Effect.supervised` |
| **Config** | ALL THREE: Shared + Role-based + Dynamic | `Layer.merge` + `Layer.provide` + `ScopedRef` |
| **Sessions** | Hybrid (pi owns sessions, COP overlays) | pi `--session` + COP block atoms |
| **Production** | Embedded SDK (in-process Effect-managed) | `createAgentSession()` via `Layer.scoped` |
| **Observability** | ALL 8 dimensions | Atoms per dimension |

---

## Architecture: The Three-Layer Config Model

```
┌────────────────────────────────────────────────────────────────┐
│                    Config Composition                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Layer 1: SHARED (base)                                  │  │
│  │  • Project AGENTS.md context files                       │  │
│  │  • Core skills (coding, search, navigation)              │  │
│  │  • Built-in tools (read, bash, edit, write)              │  │
│  │  • Default provider + model                              │  │
│  │                                                           │  │
│  │  SharedConfigLayer = Layer.succeed(PiSharedConfig, {...}) │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │ Layer.provide                           │
│  ┌────────────────────▼─────────────────────────────────────┐  │
│  │  Layer 2: ROLE-BASED (per agent type)                    │  │
│  │  • SCADA Analyst: +iiot-skills, +alarm-extension         │  │
│  │  • Code Assistant: +full-tools, +git-extension           │  │
│  │  • Navigator: +map-skills, --tools read,bash             │  │
│  │  • Inspector: +entity-skills, +inspector-extension       │  │
│  │                                                           │  │
│  │  RoleConfigLayer = Layer.effect(PiRoleConfig,            │  │
│  │    Effect.gen(function* () {                              │  │
│  │      const shared = yield* PiSharedConfig                │  │
│  │      const role = yield* AgentRole                       │  │
│  │      return mergeConfig(shared, ROLE_CONFIGS[role])      │  │
│  │    })                                                     │  │
│  │  )                                                        │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │ ScopedRef.set (hot-swap)                │
│  ┌────────────────────▼─────────────────────────────────────┐  │
│  │  Layer 3: DYNAMIC (runtime mutations)                    │  │
│  │  • Extension hot-reload via pi /reload                   │  │
│  │  • Skill loading based on conversation context           │  │
│  │  • Model switching based on task complexity              │  │
│  │  • Thinking level adjustment                             │  │
│  │                                                           │  │
│  │  DynamicConfigRef = ScopedRef<PiDynamicConfig>           │  │
│  │  // Mutated at runtime, old config released cleanly      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### Config Schemas

```typescript
import { Schema } from 'effect'

// Layer 1: Shared across all instances
const PiSharedConfig = Schema.Struct({
  cwd: Schema.String,
  provider: Schema.String,
  model: Schema.String,
  thinkingLevel: Schema.Literal('off', 'minimal', 'low', 'medium', 'high'),
  tools: Schema.Array(Schema.String),
  contextFiles: Schema.Array(Schema.String),       // AGENTS.md paths
  sharedExtensions: Schema.Array(Schema.String),    // Always-loaded extensions
  sharedSkills: Schema.Array(Schema.String),        // Always-loaded skills
})

// Layer 2: Per-role overlay
const AgentRole = Schema.Literal(
  'scada-analyst', 'code-assistant', 'navigator', 
  'inspector', 'general'
)

const PiRoleConfig = Schema.Struct({
  role: AgentRole,
  extensions: Schema.Array(Schema.String),    // Role-specific extensions
  skills: Schema.Array(Schema.String),        // Role-specific skills
  tools: Schema.optionalWith(Schema.Array(Schema.String), { as: 'Option' }),
  systemPromptAppend: Schema.optionalWith(Schema.String, { as: 'Option' }),
  model: Schema.optionalWith(Schema.String, { as: 'Option' }),  // Override
  thinkingLevel: Schema.optionalWith(
    Schema.Literal('off', 'minimal', 'low', 'medium', 'high'),
    { as: 'Option' }
  ),
})

// Layer 3: Dynamic runtime mutations
const PiDynamicConfig = Schema.Struct({
  additionalExtensions: Schema.Array(Schema.String),
  additionalSkills: Schema.Array(Schema.String),
  modelOverride: Schema.NullOr(Schema.String),
  thinkingOverride: Schema.NullOr(
    Schema.Literal('off', 'minimal', 'low', 'medium', 'high')
  ),
})
```

---

## Architecture: KeyedPool + FiberMap for Per-Agent Instances

```
┌────────────────────────────────────────────────────────────────────┐
│                    PiAgentOrchestrator                              │
│                    (Effect.Service)                                 │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  KeyedPool<AgentRole, PiAgentHandle>                        │  │
│  │                                                              │  │
│  │  Key: AgentRole ('scada-analyst' | 'code-assistant' | ...)  │  │
│  │  Value: PiAgentHandle { session, eventStream, config }      │  │
│  │                                                              │  │
│  │  acquire: (role) => spawnPiAgent(role)                      │  │
│  │  min: (role) => 0           // No warm standby              │  │
│  │  max: (role) => 3           // Max 3 per role               │  │
│  │  timeToLive: 5 minutes      // Idle timeout                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  FiberMap<AgentNodeId, PiAgentFiber>                        │  │
│  │                                                              │  │
│  │  Each Conductor agent node → one fiber managing its pi      │  │
│  │  FiberMap.run(agentNodeId, agentLifecycleFiber)             │  │
│  │  Auto-removed on completion, auto-interrupted on scope close│  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Supervisor.track                                            │  │
│  │                                                              │  │
│  │  All agent fibers supervised by a single supervisor          │  │
│  │  supervisor.value → Array<RuntimeFiber>                     │  │
│  │  Feed into observability atoms (active agents, fiber count) │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### The Core Service Shape

```typescript
import { Context, Effect, Stream, Scope, KeyedPool, FiberMap, 
         Supervisor, ScopedRef, PubSub } from 'effect'
import { Atom } from '@effect-rx/rx'

// ─── The Agent Handle (what you get from the pool) ───

interface PiAgentHandle {
  readonly id: string                           // Unique instance ID
  readonly role: AgentRole                      // scada-analyst, etc.
  readonly session: AgentSession                // pi SDK AgentSession
  readonly events: Stream.Stream<AgentEvent>    // Event stream
  readonly config: ScopedRef<PiDynamicConfig>   // Dynamic config ref
  
  // Operations (delegate to session)
  readonly prompt: (text: string) => Effect.Effect<void>
  readonly steer: (text: string) => Effect.Effect<void>
  readonly followUp: (text: string) => Effect.Effect<void>
  readonly abort: Effect.Effect<void>
  readonly compact: Effect.Effect<void>
  readonly setModel: (provider: string, model: string) => Effect.Effect<void>
  readonly getState: Effect.Effect<PiSessionState>
  readonly getMessages: Effect.Effect<readonly AgentMessage[]>
}

// ─── The Orchestrator Service ───

interface PiAgentOrchestratorShape {
  /** Acquire an agent for the given role (from KeyedPool) */
  readonly acquire: (role: AgentRole) => Effect.Effect<PiAgentHandle, never, Scope.Scope>

  /** Get or create agent for a specific Conductor node */
  readonly getForNode: (nodeId: string, role: AgentRole) => Effect.Effect<PiAgentHandle>

  /** Release a specific agent back to the pool */
  readonly release: (agentId: string) => Effect.Effect<void>

  /** Invalidate and restart an agent */
  readonly restart: (agentId: string) => Effect.Effect<PiAgentHandle>

  /** Get all active agent handles */
  readonly getActive: Effect.Effect<ReadonlyArray<PiAgentHandle>>

  /** Get supervisor for fiber observability */
  readonly supervisor: Supervisor.Supervisor<Array<Fiber.RuntimeFiber<any, any>>>

  /** Hot-swap dynamic config for an agent */
  readonly updateDynamicConfig: (
    agentId: string,
    update: (current: PiDynamicConfig) => PiDynamicConfig
  ) => Effect.Effect<void>

  /** Broadcast event to all active agents */
  readonly broadcast: (event: OrchestratorEvent) => Effect.Effect<void>

  /** Stream of orchestrator-level events */
  readonly events: Stream.Stream<OrchestratorEvent>
}

class PiAgentOrchestrator extends Context.Tag('tmnl/pi/PiAgentOrchestrator')<
  PiAgentOrchestrator,
  PiAgentOrchestratorShape
>() {}
```

---

## Spawn Flow: acquireAgent

```typescript
const acquireAgent = (role: AgentRole): Effect.Effect<
  PiAgentHandle, never, Scope.Scope | PiSharedConfig | PiRoleConfig
> =>
  Effect.gen(function* () {
    const shared = yield* PiSharedConfig
    const roleConfig = yield* resolveRoleConfig(role)
    const scope = yield* Effect.scope

    // Merge config layers: shared + role
    const mergedConfig = mergeConfigs(shared, roleConfig)

    // Create dynamic config ref (Layer 3)
    const dynamicRef = yield* ScopedRef.make(() => ({
      additionalExtensions: [],
      additionalSkills: [],
      modelOverride: null,
      thinkingOverride: null,
    }))

    // Build final pi launch args from merged + dynamic
    const launchArgs = yield* buildLaunchArgs(mergedConfig, dynamicRef)

    // === PRODUCTION PATH: Embedded SDK ===
    const authStorage = new AuthStorage()
    const modelRegistry = new ModelRegistry(authStorage)

    const loader = new DefaultResourceLoader({
      cwd: mergedConfig.cwd,
      additionalExtensionPaths: [
        ...mergedConfig.sharedExtensions,
        ...roleConfig.extensions,
      ],
      skillsOverride: (current) => ({
        skills: [
          ...current.skills,
          ...mergedConfig.sharedSkills.map(pathToSkill),
          ...roleConfig.skills.map(pathToSkill),
        ],
        diagnostics: current.diagnostics,
      }),
      systemPromptOverride: roleConfig.systemPromptAppend
        ? () => `${DEFAULT_SYSTEM_PROMPT}\n\n${roleConfig.systemPromptAppend}`
        : undefined,
    })
    yield* Effect.promise(() => loader.reload())

    const { session } = yield* Effect.tryPromise(() =>
      createAgentSession({
        cwd: mergedConfig.cwd,
        model: getModel(mergedConfig.provider, mergedConfig.model),
        thinkingLevel: mergedConfig.thinkingLevel,
        authStorage,
        modelRegistry,
        resourceLoader: loader,
        sessionManager: SessionManager.create(mergedConfig.cwd),
      })
    )

    // Register cleanup: dispose session on scope close
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => session.dispose())
    )

    // Create event stream from session subscription
    const eventPubSub = yield* PubSub.unbounded<AgentEvent>()
    const unsubscribe = session.subscribe((event) => {
      Effect.runSync(PubSub.publish(eventPubSub, event))
    })
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => unsubscribe())
    )

    const handle: PiAgentHandle = {
      id: yield* Effect.sync(() => crypto.randomUUID()),
      role,
      session,
      events: Stream.fromPubSub(eventPubSub),
      config: dynamicRef,

      prompt: (text) => Effect.promise(() => session.prompt(text)),
      steer: (text) => Effect.promise(() => session.steer(text)),
      followUp: (text) => Effect.promise(() => session.followUp(text)),
      abort: Effect.promise(() => session.abort()),
      compact: Effect.promise(() => session.compact()),
      setModel: (provider, model) =>
        Effect.gen(function* () {
          const m = getModel(provider, model)
          if (m) yield* Effect.promise(() => session.setModel(m))
        }),
      getState: Effect.sync(() => ({
        isStreaming: session.isStreaming,
        model: session.model,
        thinkingLevel: session.thinkingLevel,
        messageCount: session.messages.length,
      })),
      getMessages: Effect.sync(() => session.messages),
    }

    return handle
  })
```

---

## The Orchestrator Layer (Scoped)

```typescript
const PiAgentOrchestratorLive = Layer.scoped(
  PiAgentOrchestrator,
  Effect.gen(function* () {
    // Create supervisor for all agent fibers
    const supervisor = yield* Supervisor.track

    // Create keyed pool: AgentRole → PiAgentHandle
    const pool = yield* KeyedPool.makeWithTTL({
      acquire: (role: AgentRole) => acquireAgent(role),
      min: (_role) => 0,        // Lazy — no warm instances
      max: (_role) => 3,        // Max 3 concurrent per role
      timeToLive: '5 minutes',  // Idle agents cleaned up
    })

    // FiberMap for Conductor node → agent fiber mapping
    const fiberMap = yield* FiberMap.make<string>()

    // PubSub for orchestrator-level events
    const orchestratorEvents = yield* PubSub.unbounded<OrchestratorEvent>()

    // Active handles registry
    const activeHandles = yield* Ref.make<Map<string, PiAgentHandle>>(new Map())

    return PiAgentOrchestrator.of({
      acquire: (role) =>
        Effect.gen(function* () {
          const handle = yield* pool.get(role)
          yield* Ref.update(activeHandles, (m) => new Map([...m, [handle.id, handle]]))
          yield* PubSub.publish(orchestratorEvents, {
            _tag: 'AgentAcquired', agentId: handle.id, role
          })
          return handle
        }),

      getForNode: (nodeId, role) =>
        Effect.gen(function* () {
          // Check if fiber already running for this node
          const existing = yield* FiberMap.get(fiberMap, nodeId)
          if (Option.isSome(existing)) {
            // Return the handle from the existing fiber
            const handles = yield* Ref.get(activeHandles)
            // ... lookup by nodeId
          }

          // Acquire new agent
          const handle = yield* pool.get(role)
          yield* Ref.update(activeHandles, (m) => new Map([...m, [handle.id, handle]]))

          // Run agent lifecycle in supervised fiber
          yield* FiberMap.run(fiberMap, nodeId,
            agentLifecycle(handle).pipe(
              Effect.supervised(supervisor)
            )
          )

          return handle
        }),

      release: (agentId) =>
        Effect.gen(function* () {
          const handles = yield* Ref.get(activeHandles)
          const handle = handles.get(agentId)
          if (handle) {
            yield* pool.invalidate(handle)
            yield* Ref.update(activeHandles, (m) => {
              const next = new Map(m)
              next.delete(agentId)
              return next
            })
          }
        }),

      restart: (agentId) =>
        Effect.gen(function* () {
          const handles = yield* Ref.get(activeHandles)
          const old = handles.get(agentId)
          if (!old) return yield* Effect.die('Agent not found')

          yield* pool.invalidate(old)
          const fresh = yield* pool.get(old.role)
          yield* Ref.update(activeHandles, (m) => {
            const next = new Map(m)
            next.delete(agentId)
            next.set(fresh.id, fresh)
            return next
          })
          return fresh
        }),

      getActive: Ref.get(activeHandles).pipe(
        Effect.map((m) => Array.from(m.values()))
      ),

      supervisor,

      updateDynamicConfig: (agentId, update) =>
        Effect.gen(function* () {
          const handles = yield* Ref.get(activeHandles)
          const handle = handles.get(agentId)
          if (handle) {
            const current = yield* ScopedRef.get(handle.config)
            yield* ScopedRef.set(handle.config, Effect.succeed(update(current)))
          }
        }),

      broadcast: (event) =>
        PubSub.publish(orchestratorEvents, event).pipe(Effect.asVoid),

      events: Stream.fromPubSub(orchestratorEvents),
    })
  })
)
```

---

## Atom Layer (React Subscription)

```typescript
import { Atom } from '@effect-rx/rx'

// ─── Orchestrator state atoms ───

/** All active agent handles */
export const activeAgentsAtom = Atom.make<ReadonlyArray<PiAgentHandle>>([])

/** Per-agent streaming state: Map<agentId, boolean> */
export const agentStreamingAtom = Atom.make<ReadonlyMap<string, boolean>>(new Map())

/** Per-agent token usage */
export const agentTokenUsageAtom = Atom.make<ReadonlyMap<string, TokenUsage>>(new Map())

/** Per-agent tool execution timeline */
export const agentToolTimelineAtom = Atom.make<ReadonlyMap<string, ToolExecution[]>>(new Map())

/** Current model per agent */
export const agentModelAtom = Atom.make<ReadonlyMap<string, { provider: string; model: string }>>(new Map())

/** Process health per agent */
export const agentHealthAtom = Atom.make<ReadonlyMap<string, AgentHealth>>(new Map())

/** Extension status per agent */
export const agentExtensionsAtom = Atom.make<ReadonlyMap<string, ExtensionStatus[]>>(new Map())

/** Context window usage per agent */
export const agentContextUsageAtom = Atom.make<ReadonlyMap<string, ContextUsage>>(new Map())

/** Pending message queue depth per agent */
export const agentQueueDepthAtom = Atom.make<ReadonlyMap<string, number>>(new Map())

/** Session tree per agent (branches, forks) */
export const agentSessionTreeAtom = Atom.make<ReadonlyMap<string, SessionTree>>(new Map())

/** Supervisor fiber count (total across all agents) */
export const supervisorFiberCountAtom = Atom.make<number>(0)
```

---

## Dynamic Config Hot-Swap Flow

```
User selects "Switch to high thinking" in COP panel
  │
  ▼
ChatPanel dispatches:
  orchestrator.updateDynamicConfig(agentId, (c) => ({
    ...c, thinkingOverride: 'high'
  }))
  │
  ▼
ScopedRef.set releases old config, acquires new
  │
  ▼
PiAgentHandle applies via session.setThinkingLevel('high')
  │
  ▼
Atom updates: agentModelAtom reflects new thinking level
```

For extension hot-reload:
```
COP detects context change (e.g., user navigates to IIoT panel)
  │
  ▼
orchestrator.updateDynamicConfig(agentId, (c) => ({
    ...c, additionalSkills: [...c.additionalSkills, 'iiot-analyst']
  }))
  │
  ▼
PiAgentHandle reloads: session.prompt('/reload')
  │
  ▼
pi process hot-reloads extensions/skills
```

---

## Session Hybrid Model

```
┌──────────────────────────────────────────────────────┐
│                    pi Session Layer                    │
│                                                        │
│  pi manages:                                           │
│  • Message history (UserMessage, AssistantMessage)     │
│  • Tool call results (ToolResultMessage)               │
│  • Session tree (branching, forking)                   │
│  • Compaction (auto + manual)                          │
│  • Model/thinking state                                │
│  • Session persistence (.jsonl files)                  │
└──────────────────┬───────────────────────────────────┘
                   │ events → atom updates
                   ▼
┌──────────────────────────────────────────────────────┐
│                   COP Overlay Layer                    │
│                                                        │
│  COP manages (in effect-atom):                         │
│  • COPBlockV3 array (typed chat blocks)               │
│  • UserBlockV3 (context chips, @-mentions)            │
│  • AgentOutputBlockV3 (agent identity, streaming)     │
│  • BreakoutPanelConfig (spawned panels)               │
│  • panelContextAtom (focused panel, cross-panel data) │
│  • Extension UI bridge state (dialog queue)           │
│  • Scroll position, selection state                   │
│  • IIoT domain catalog rendering                      │
└──────────────────────────────────────────────────────┘
```

**Key insight:** pi events map to COP blocks. The mapping is deterministic:
- `agent_start` → append new `AgentOutputBlockV3` (streaming=true)
- `text_delta` → append to current block's content
- `tool_execution_start` → create `ToolCallBlockV3` (pending)
- `tool_execution_end` → complete `ToolCallBlockV3` with result
- `agent_end` → mark current block streaming=false

COP can fork pi sessions and navigate the session tree while maintaining its own block overlay.

---

## Effect Primitives Summary

| Primitive | Usage | Why |
|-----------|-------|-----|
| `KeyedPool<AgentRole, PiAgentHandle>` | Per-role agent pooling | Elastic instances, automatic cleanup, TTL |
| `FiberMap<AgentNodeId, Fiber>` | Conductor node → fiber mapping | Auto-interrupt on scope close, auto-remove on complete |
| `Supervisor.track` | Monitor all agent fibers | Observability, fiber count, health checks |
| `Effect.supervised` | Wrap agent lifecycle fibers | Supervisor tracks creation/termination |
| `ScopedRef<PiDynamicConfig>` | Dynamic config hot-swap | Old config released cleanly, new config acquired |
| `Layer.scoped` | Orchestrator service lifecycle | Cleanup all agents when app scope closes |
| `Layer.merge` | Combine shared + role configs | Type-safe dependency composition |
| `Layer.provide` | Feed shared into role layer | No requirement leakage |
| `PubSub.unbounded<AgentEvent>` | Per-agent event distribution | Multiple subscribers (atoms, UI, logging) |
| `Stream.fromPubSub` | Reactive event streams | Compose, filter, map agent events |
| `Effect.addFinalizer` | Cleanup on scope close | Dispose session, unsubscribe, kill process |
| `Scope.make` / `Scope.close` | Manual scope control | Per-session agent lifetime management |
| `Ref.make<Map<id, Handle>>` | Active handles registry | Concurrent-safe state tracking |

---

## File Structure

```
src/lib/pi-orchestrator/
├── index.ts                          # Barrel exports
├── schemas/
│   ├── config.ts                     # PiSharedConfig, PiRoleConfig, PiDynamicConfig
│   ├── events.ts                     # OrchestratorEvent, AgentEvent mappings
│   ├── health.ts                     # AgentHealth, ContextUsage, TokenUsage
│   └── index.ts
├── services/
│   ├── PiAgentOrchestrator.ts        # Main orchestrator service
│   ├── PiAgentHandle.ts              # Handle interface + acquireAgent
│   ├── ConfigResolver.ts             # Shared→Role→Dynamic config merge
│   └── index.ts
├── atoms/
│   ├── orchestrator.ts               # activeAgentsAtom, supervisorFiberCountAtom
│   ├── per-agent.ts                  # agentStreamingAtom, agentTokenUsageAtom, etc.
│   └── index.ts
├── hooks/
│   ├── usePiAgent.ts                 # React hook: acquire agent for component
│   ├── usePiOrchestrator.ts          # React hook: orchestrator operations
│   └── index.ts
└── __tests__/
    ├── config-merge.test.ts
    ├── orchestrator.test.ts
    └── pool-lifecycle.test.ts
```

---

## Critical Path

```
Config schemas → ConfigResolver → acquireAgent → PiAgentOrchestrator → Atoms → Hooks
      ↓                                ↓
  Role configs              FiberMap + Supervisor + KeyedPool
```

This design gives us:
1. **Elastic per-agent instances** via KeyedPool with TTL
2. **Three-tier config** (shared base → role overlay → dynamic hot-swap)
3. **Supervised fiber tree** for automatic crash recovery
4. **Session-scoped lifetime** with clean finalizer-based teardown
5. **Full observability** across all 8 dimensions via Atom.make()
6. **Hybrid sessions** — pi owns message persistence, COP owns block UI

---

## References

- Effect Pool: `Pool.make`, `Pool.makeWithTTL` — fixed/elastic pool with Scope lifetime
- Effect KeyedPool: `KeyedPool.makeWithTTL` — keyed elastic pool, per-key min/max/TTL
- Effect Supervisor: `Supervisor.track`, `Effect.supervised` — fiber lifecycle monitoring
- Effect FiberMap: `FiberMap.make`, `FiberMap.run` — keyed fiber management, auto-cleanup
- Effect FiberHandle: `FiberHandle.make`, `FiberHandle.run` — single fiber management
- Effect ScopedRef: `ScopedRef.make`, `ScopedRef.set` — mutable ref with resource cleanup
- Effect Layer: `Layer.scoped`, `Layer.merge`, `Layer.provide`, `Layer.provideMerge`
- Effect Scope: `Scope.make`, `Scope.close`, `Effect.addFinalizer`, `Effect.acquireRelease`
- Pi SDK: `createAgentSession`, `DefaultResourceLoader`, `SessionManager`
