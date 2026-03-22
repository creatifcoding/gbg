# 10 — Pi Orchestrator Implementation Blueprint

> Definitive handoff doc. Every file, every schema, every service, exact patterns.
> Source: 08 (RPC protocol), 09 (orchestration design), pi RPC types, codebase patterns.

---

## Critical Path (execution order)

```
#492 schemas ──→ #498 ConfigResolver ──→ #499 PiAgentHandle ──→ #493 Orchestrator
       │                                         ↑                      │
       └──────→ #495 atoms ─────────────────────┘                      │
                    │                                                    │
                    └──→ #494 PiProvider ──→ #496 ExtUI Bridge ──→ #497 testbed
                                                                        │
                                                          #500 hooks ◄──┘
                                                          #501 tests ◄──┘
```

---

## FILE 1: `src/lib/pi-orchestrator/schemas/config.ts` (Task #492)

```typescript
import { Schema } from 'effect'

// ─── Thinking Levels ───
export const ThinkingLevel = Schema.Literal('off', 'minimal', 'low', 'medium', 'high')
export type ThinkingLevel = typeof ThinkingLevel.Type

// ─── Agent Roles ───
export const AgentRole = Schema.Literal(
  'scada-analyst',
  'code-assistant',
  'navigator',
  'inspector',
  'general'
)
export type AgentRole = typeof AgentRole.Type

// ─── Layer 1: Shared Config (base for ALL instances) ───
export class PiSharedConfig extends Schema.Class<PiSharedConfig>('PiSharedConfig')({
  cwd: Schema.String,
  provider: Schema.String,
  model: Schema.String,
  thinkingLevel: ThinkingLevel,
  tools: Schema.Array(Schema.String),
  contextFiles: Schema.Array(Schema.String),
  sharedExtensions: Schema.Array(Schema.String),
  sharedSkills: Schema.Array(Schema.String),
}) {}

// ─── Layer 2: Role-based overlay ───
export class PiRoleConfig extends Schema.Class<PiRoleConfig>('PiRoleConfig')({
  role: AgentRole,
  extensions: Schema.Array(Schema.String),
  skills: Schema.Array(Schema.String),
  tools: Schema.optionalWith(Schema.Array(Schema.String), { as: 'Option' }),
  systemPromptAppend: Schema.optionalWith(Schema.String, { as: 'Option' }),
  model: Schema.optionalWith(Schema.String, { as: 'Option' }),
  thinkingLevel: Schema.optionalWith(ThinkingLevel, { as: 'Option' }),
}) {}

// ─── Layer 3: Dynamic runtime mutations ───
export class PiDynamicConfig extends Schema.Class<PiDynamicConfig>('PiDynamicConfig')({
  additionalExtensions: Schema.Array(Schema.String),
  additionalSkills: Schema.Array(Schema.String),
  modelOverride: Schema.NullOr(Schema.String),
  thinkingOverride: Schema.NullOr(ThinkingLevel),
}) {
  static readonly empty = new PiDynamicConfig({
    additionalExtensions: [],
    additionalSkills: [],
    modelOverride: null,
    thinkingOverride: null,
  })
}

// ─── Merged config (result of 3-tier resolution) ───
export class PiMergedConfig extends Schema.Class<PiMergedConfig>('PiMergedConfig')({
  cwd: Schema.String,
  provider: Schema.String,
  model: Schema.String,
  thinkingLevel: ThinkingLevel,
  tools: Schema.Array(Schema.String),
  extensions: Schema.Array(Schema.String),
  skills: Schema.Array(Schema.String),
  contextFiles: Schema.Array(Schema.String),
  systemPromptAppend: Schema.NullOr(Schema.String),
}) {}
```

## FILE 2: `src/lib/pi-orchestrator/schemas/events.ts` (Task #492)

```typescript
import { Schema } from 'effect'
import { AgentRole, ThinkingLevel } from './config'

// ─── Orchestrator-level events ───
export const AgentAcquiredEvent = Schema.TaggedStruct('AgentAcquired', {
  agentId: Schema.String,
  role: AgentRole,
  timestamp: Schema.Number,
})

export const AgentReleasedEvent = Schema.TaggedStruct('AgentReleased', {
  agentId: Schema.String,
  reason: Schema.Literal('user', 'ttl', 'scope-close', 'crash'),
  timestamp: Schema.Number,
})

export const AgentCrashedEvent = Schema.TaggedStruct('AgentCrashed', {
  agentId: Schema.String,
  error: Schema.String,
  willRestart: Schema.Boolean,
  timestamp: Schema.Number,
})

export const AgentRestartedEvent = Schema.TaggedStruct('AgentRestarted', {
  agentId: Schema.String,
  previousId: Schema.String,
  role: AgentRole,
  timestamp: Schema.Number,
})

export const ConfigUpdatedEvent = Schema.TaggedStruct('ConfigUpdated', {
  agentId: Schema.String,
  field: Schema.String,
  previousValue: Schema.Unknown,
  newValue: Schema.Unknown,
  timestamp: Schema.Number,
})

export const OrchestratorEvent = Schema.Union(
  AgentAcquiredEvent,
  AgentReleasedEvent,
  AgentCrashedEvent,
  AgentRestartedEvent,
  ConfigUpdatedEvent,
)
export type OrchestratorEvent = typeof OrchestratorEvent.Type

// ─── Pi RPC event types (mapped from pi stdout) ───

export const PiAgentStartEvent = Schema.TaggedStruct('pi:agent_start', {
  agentId: Schema.String,
})

export const PiAgentEndEvent = Schema.TaggedStruct('pi:agent_end', {
  agentId: Schema.String,
  messages: Schema.Array(Schema.Unknown), // AgentMessage[]
})

export const PiTextDeltaEvent = Schema.TaggedStruct('pi:text_delta', {
  agentId: Schema.String,
  delta: Schema.String,
})

export const PiThinkingDeltaEvent = Schema.TaggedStruct('pi:thinking_delta', {
  agentId: Schema.String,
  delta: Schema.String,
})

export const PiToolCallStartEvent = Schema.TaggedStruct('pi:toolcall_start', {
  agentId: Schema.String,
  toolName: Schema.String,
  toolCallId: Schema.String,
})

export const PiToolCallDeltaEvent = Schema.TaggedStruct('pi:toolcall_delta', {
  agentId: Schema.String,
  toolCallId: Schema.String,
  delta: Schema.String,
})

export const PiToolExecutionStartEvent = Schema.TaggedStruct('pi:tool_execution_start', {
  agentId: Schema.String,
  toolName: Schema.String,
  toolCallId: Schema.String,
  args: Schema.Unknown,
})

export const PiToolExecutionUpdateEvent = Schema.TaggedStruct('pi:tool_execution_update', {
  agentId: Schema.String,
  toolCallId: Schema.String,
  content: Schema.String,
})

export const PiToolExecutionEndEvent = Schema.TaggedStruct('pi:tool_execution_end', {
  agentId: Schema.String,
  toolCallId: Schema.String,
  result: Schema.Unknown,
})

export const PiExtensionUIRequestEvent = Schema.TaggedStruct('pi:extension_ui_request', {
  agentId: Schema.String,
  requestId: Schema.String,
  method: Schema.Literal('select', 'confirm', 'input', 'editor', 'notify', 'setStatus', 'setWidget', 'setTitle', 'set_editor_text'),
  payload: Schema.Unknown,
})

export const PiCompactionEvent = Schema.TaggedStruct('pi:compaction', {
  agentId: Schema.String,
  phase: Schema.Literal('start', 'end'),
  tokensBefore: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  tokensAfter: Schema.optionalWith(Schema.Number, { as: 'Option' }),
})

export const PiAgentEvent = Schema.Union(
  PiAgentStartEvent,
  PiAgentEndEvent,
  PiTextDeltaEvent,
  PiThinkingDeltaEvent,
  PiToolCallStartEvent,
  PiToolCallDeltaEvent,
  PiToolExecutionStartEvent,
  PiToolExecutionUpdateEvent,
  PiToolExecutionEndEvent,
  PiExtensionUIRequestEvent,
  PiCompactionEvent,
)
export type PiAgentEvent = typeof PiAgentEvent.Type
```

## FILE 3: `src/lib/pi-orchestrator/schemas/health.ts` (Task #492)

```typescript
import { Schema } from 'effect'
import { ThinkingLevel } from './config'

// ─── Token usage per agent ───
export class TokenUsage extends Schema.Class<TokenUsage>('TokenUsage')({
  inputTokens: Schema.Number,
  outputTokens: Schema.Number,
  cacheReadTokens: Schema.Number,
  cacheWriteTokens: Schema.Number,
  totalCost: Schema.Number,
}) {
  static readonly zero = new TokenUsage({
    inputTokens: 0, outputTokens: 0,
    cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0,
  })
}

// ─── Tool execution record ───
export class ToolExecution extends Schema.Class<ToolExecution>('ToolExecution')({
  toolCallId: Schema.String,
  toolName: Schema.String,
  startedAt: Schema.Number,
  completedAt: Schema.NullOr(Schema.Number),
  status: Schema.Literal('pending', 'running', 'completed', 'error'),
  durationMs: Schema.NullOr(Schema.Number),
}) {}

// ─── Agent process health ───
export class AgentHealth extends Schema.Class<AgentHealth>('AgentHealth')({
  pid: Schema.NullOr(Schema.Number),
  uptime: Schema.Number,          // ms since spawn
  restartCount: Schema.Number,
  lastHeartbeat: Schema.Number,   // epoch ms
  memoryUsageMB: Schema.NullOr(Schema.Number),
  status: Schema.Literal('healthy', 'degraded', 'unresponsive', 'dead'),
}) {
  static readonly initial = new AgentHealth({
    pid: null, uptime: 0, restartCount: 0,
    lastHeartbeat: Date.now(), memoryUsageMB: null,
    status: 'healthy',
  })
}

// ─── Context window usage ───
export class ContextUsage extends Schema.Class<ContextUsage>('ContextUsage')({
  usedTokens: Schema.Number,
  maxTokens: Schema.Number,
  percentUsed: Schema.Number,
  compactionCount: Schema.Number,
  lastCompactedAt: Schema.NullOr(Schema.Number),
}) {
  static readonly initial = new ContextUsage({
    usedTokens: 0, maxTokens: 200000, percentUsed: 0,
    compactionCount: 0, lastCompactedAt: null,
  })
}

// ─── Extension status ───
export class ExtensionStatus extends Schema.Class<ExtensionStatus>('ExtensionStatus')({
  name: Schema.String,
  loaded: Schema.Boolean,
  toolCount: Schema.Number,
  error: Schema.NullOr(Schema.String),
}) {}

// ─── Session tree node ───
export class SessionTreeNode extends Schema.Class<SessionTreeNode>('SessionTreeNode')({
  sessionId: Schema.String,
  sessionName: Schema.NullOr(Schema.String),
  parentSessionId: Schema.NullOr(Schema.String),
  messageCount: Schema.Number,
  createdAt: Schema.Number,
  isCurrent: Schema.Boolean,
}) {}

// ─── Per-agent state snapshot ───
export class PiSessionState extends Schema.Class<PiSessionState>('PiSessionState')({
  isStreaming: Schema.Boolean,
  isCompacting: Schema.Boolean,
  provider: Schema.String,
  model: Schema.String,
  thinkingLevel: ThinkingLevel,
  sessionId: Schema.String,
  sessionName: Schema.NullOr(Schema.String),
  messageCount: Schema.Number,
  pendingMessageCount: Schema.Number,
  autoCompactionEnabled: Schema.Boolean,
}) {}
```

## FILE 4: `src/lib/pi-orchestrator/schemas/index.ts` (Task #492)

```typescript
export * from './config'
export * from './events'
export * from './health'
```

---

## FILE 5: `src/lib/pi-orchestrator/services/ConfigResolver.ts` (Task #498)

Key: mergeConfigs(shared, role) → PiMergedConfig
Key: buildLaunchArgs(merged, dynamic) → string[]
Uses: Option.getOrElse for role overrides

---

## FILE 6: `src/lib/pi-orchestrator/services/PiAgentHandle.ts` (Task #499)

Key: PiAgentHandle interface
Key: acquireAgent(role) → Effect.Effect<PiAgentHandle, never, Scope.Scope>
Uses: child_process.spawn for RPC, PubSub for events, ScopedRef for dynamic config
Uses: Effect.addFinalizer for cleanup (kill process + unsubscribe)

---

## FILE 7: `src/lib/pi-orchestrator/services/PiAgentOrchestrator.ts` (Task #493)

Key: Context.Tag('tmnl/pi/PiAgentOrchestrator')
Key: Layer.scoped construction
Uses: KeyedPool.makeWithTTL (not available? use Pool.make per-role + Map)
Uses: FiberMap<string> for node→fiber mapping
Uses: Supervisor.track + Effect.supervised
Uses: Ref<Map<string, PiAgentHandle>> for active registry

---

## FILE 8: `src/lib/pi-orchestrator/atoms/` (Task #495)

All Atom.make() — no Effect.Ref bridge.
Orchestrator event handlers call Atom.set/Atom.update directly.

---

## Codebase Pattern References

| Pattern | File | What To Copy |
|---------|------|-------------|
| Schema.TaggedStruct | `src/lib/terminal/v3/schemas/blocks.ts:54` | AIResponseBlockV3 |
| Schema.Literal | `src/lib/ai-core/schemas/stream.ts:181` | StreamStatus |
| Schema.Class | `src/lib/ai-core/providers/ChatDataProvider.ts:28` | ProviderState |
| Schema.TaggedError | `src/lib/ai-core/providers/ChatDataProvider.ts:90` | ChatSendError |
| Context.Tag | `src/lib/ai-core/providers/ChatDataProvider.ts:110` | ChatDataProvider |
| Atom.make | `src/lib/iiot/fermion/workOrderFermion.ts:63` | workOrderListAtom |
| Atom.family | `src/lib/conductor/atoms/index.ts:74` | agentAtom |
| Layer.succeed | `src/lib/ai-core/providers/ChatDataProvider.ts:131` | NoopProvider |

---

## RPC Protocol Field-by-Field (from pi's rpc-types.d.ts)

### RpcCommand (stdin → pi)
28 command types. Key ones:
- `prompt { message, images?, streamingBehavior? }`
- `steer { message, images? }`
- `follow_up { message, images? }`
- `abort {}`
- `get_state {} → RpcSessionState`
- `set_model { provider, modelId }`
- `set_thinking_level { level }`
- `compact { customInstructions? }`
- `get_messages {} → AgentMessage[]`
- `get_commands {} → RpcSlashCommand[]`
- `bash { command }`
- `fork { entryId }`
- `new_session { parentSession? }`
- `get_session_stats {} → SessionStats`

### RpcExtensionUIRequest (pi → stdout, needs response)
Methods: `select`, `confirm`, `input`, `editor`, `notify`, `setStatus`, `setWidget`, `setTitle`, `set_editor_text`

Interactive (need response): select, confirm, input, editor
Fire-and-forget: notify, setStatus, setWidget, setTitle, set_editor_text

### RpcExtensionUIResponse (stdin → pi)
- `{ id, value: string }` for select/input/editor
- `{ id, confirmed: boolean }` for confirm
- `{ id, cancelled: true }` for timeout/dismiss

---

## Spawn Strategy: Pluggable

```typescript
interface SpawnStrategy {
  readonly spawn: (args: readonly string[], options: SpawnOptions) =>
    Effect.Effect<ProcessHandle, SpawnError, Scope.Scope>
}

// Dev: Node.js child_process
const NodeSpawnStrategy: SpawnStrategy = { ... }

// Production Tauri: @tauri-apps/api/shell
const TauriSpawnStrategy: SpawnStrategy = { ... }
```

ProcessHandle interface:
```typescript
interface ProcessHandle {
  readonly stdin: { write: (data: string) => Effect.Effect<void> }
  readonly stdout: Stream.Stream<string>  // line-by-line
  readonly stderr: Stream.Stream<string>
  readonly pid: number | null
  readonly kill: Effect.Effect<void>
  readonly exitCode: Effect.Effect<number>
}
```

---

## Implementation Order (EXACT)

1. **schemas/** (4 files) — pure types, zero deps, instant
2. **services/ConfigResolver.ts** — pure function, depends only on schemas
3. **services/PiAgentHandle.ts** — needs ConfigResolver + child_process
4. **atoms/** (2 files) — depends on schemas for types
5. **services/PiAgentOrchestrator.ts** — needs Handle + atoms
6. **PiProvider.ts** — bridges Orchestrator to ChatDataProvider
7. **ExtensionUIBridge.tsx** — React component, needs atoms
8. **hooks/** — React hooks, needs atoms + orchestrator
9. **__tests__/** — validates everything
10. **testbed route** — integration proof

---

## Role Config Presets

```typescript
export const ROLE_CONFIGS: Record<AgentRole, Omit<PiRoleConfig, 'role'>> = {
  'scada-analyst': {
    extensions: [],
    skills: ['iiot-analyst', 'alarm-triage'],
    tools: Option.none(),          // All tools
    systemPromptAppend: Option.some(
      'You are a SCADA analyst. Focus on industrial process data, alarms, equipment health, and operational insights.'
    ),
    model: Option.none(),          // Use shared default
    thinkingLevel: Option.some('medium' as const),
  },
  'code-assistant': {
    extensions: [],
    skills: [],                    // Full skill set (default)
    tools: Option.none(),          // All tools
    systemPromptAppend: Option.none(),
    model: Option.none(),
    thinkingLevel: Option.none(),
  },
  'navigator': {
    extensions: [],
    skills: ['geoint-nav', 'map-tools'],
    tools: Option.some(['read', 'bash']),  // Restricted
    systemPromptAppend: Option.some(
      'You are a geospatial navigator. Focus on map data, coordinates, routing, and spatial analysis.'
    ),
    model: Option.none(),
    thinkingLevel: Option.some('low' as const),
  },
  'inspector': {
    extensions: [],
    skills: ['entity-inspector'],
    tools: Option.some(['read']),   // Read-only
    systemPromptAppend: Option.some(
      'You are an entity inspector. Analyze properties, relationships, and state of selected entities.'
    ),
    model: Option.none(),
    thinkingLevel: Option.some('low' as const),
  },
  'general': {
    extensions: [],
    skills: [],
    tools: Option.none(),
    systemPromptAppend: Option.none(),
    model: Option.none(),
    thinkingLevel: Option.none(),
  },
}
```
