# 08 — Pi RPC Provider Research

> Research findings for using pi as the underlying AI agent in the COP Chat Panel.

## Decision: Pi as AI Backend via RPC Mode

**pi** offers three integration surfaces. We choose **RPC** for process isolation + full capability access.

| Surface | Method | Best For |
|---------|--------|----------|
| **SDK** | `createAgentSession()` in-process | Same Node.js process, type-safe, full control |
| **RPC** | `pi --mode rpc` child process | Subprocess isolation, extensions, language-agnostic |
| **JSON** | `pi --mode json` one-shot | Single prompt → output capture |

### Why RPC over SDK?

1. **Process isolation** — pi crash ≠ Tauri app crash
2. **Full extension support** — pi loads its own extensions, skills, prompt templates, context files (including our `.pi/extensions/` and project AGENTS.md)
3. **Session management** — Persistence, forking, compaction, tree navigation — all built in
4. **Multi-model** — Access to all configured providers (Anthropic, OpenAI, Google, etc.) via pi's model registry
5. **Tool ecosystem** — All pi's built-in tools (read, bash, edit, write) + extension tools
6. **Extension UI protocol** — Bidirectional dialog forwarding (select, confirm, input)

### Why not SDK?

- SDK requires bundling `@mariozechner/pi-coding-agent` into the Vite build
- SDK's `DefaultResourceLoader` does filesystem discovery at runtime — works, but heavier in-process
- RPC gives natural process boundary for cleanup (kill process = clean slate)

---

## Protocol Summary

### Starting

```bash
pi --mode rpc \
  --provider anthropic \
  --model claude-sonnet-4-20250514 \
  --thinking medium \
  --cwd /path/to/project \
  --no-session  # or --session /path/to/session.jsonl
```

### Commands (stdin → pi)

| Command | Purpose | Returns |
|---------|---------|---------|
| `prompt` | Send user message | Events stream asynchronously |
| `steer` | Interrupt mid-stream | Delivered after current tool |
| `follow_up` | Queue for after completion | Delivered when agent stops |
| `abort` | Cancel current operation | Immediate |
| `get_state` | Session state snapshot | Model, streaming, compaction |
| `set_model` | Switch model | New model info |
| `bash` | Execute shell command | stdout, exitCode |
| `compact` | Compress context | Summary, tokensBefore |
| `get_messages` | Full conversation | AgentMessage[] |
| `get_commands` | Available /commands | Extension + prompt + skill commands |

### Events (pi → stdout)

| Event | Maps To |
|-------|---------|
| `agent_start` | Set streaming = true |
| `agent_end` | Set streaming = false, update messages |
| `message_update` (text_delta) | Append to current AI response block |
| `message_update` (thinking_delta) | Append to thinking section |
| `message_update` (toolcall_start/delta/end) | Create/update ToolCallBlock |
| `tool_execution_start` | Show tool execution indicator |
| `tool_execution_update` | Stream partial tool output |
| `tool_execution_end` | Complete tool result block |
| `extension_ui_request` (select) | Show inline poll/selector in chat |
| `extension_ui_request` (confirm) | Show confirm dialog |
| `extension_ui_request` (notify) | Show system notification block |
| `auto_compaction_start/end` | Show compaction indicator |
| `auto_retry_start/end` | Show retry indicator |

### Extension UI Sub-Protocol

```
pi stdout → extension_ui_request { id, method: "select", options: [...] }
↓
COP chat panel renders inline selector
↓
User selects option
↓
chat panel stdin → extension_ui_response { id, value: "Allow" }
↓
pi extension handler receives response, continues execution
```

---

## Architecture: PiProvider Stack

```
┌─────────────────────────────────────────────────────────┐
│                    React Components                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  ChatPanel   │  │ AgentSelector│  │  ToolBlock   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│              effect-atom (Reactive State)                 │
│  ┌───────────────┐  ┌────────────────┐  ┌────────────┐ │
│  │piAgentStateAtm│  │piToolExecsAtom │  │piExtUIAtom │ │
│  │(streaming/idle)│  │(active tools)  │  │(dialogs)   │ │
│  └───────┬───────┘  └────────┬───────┘  └──────┬─────┘ │
└──────────┼─────────────────────┼──────────────────┼──────┘
           │                     │                  │
           ▼                     ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│          PiProvider (ChatDataProviderShape)               │
│  ┌──────────────────────────────────────────────────┐   │
│  │ sendMessage() → rpcClient.prompt()               │   │
│  │ abort()       → rpcClient.abort()                │   │
│  │ getMessages() → rpcClient.getMessages()          │   │
│  │ isStreaming   → track agent_start/end events     │   │
│  │ stateChanges  → Stream from event listener       │   │
│  └──────────────────────┬───────────────────────────┘   │
└──────────────────────────┼───────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│         PiRpcClientService (Effect.Service)              │
│  ┌──────────────────────────────────────────────────┐   │
│  │ child_process.spawn('pi', ['--mode', 'rpc', ...])│   │
│  │                                                    │   │
│  │ stdin ──── JSON commands ────→ pi process          │   │
│  │ stdout ←── JSON events ────── pi process           │   │
│  │                                                    │   │
│  │ readline interface → parse JSON lines              │   │
│  │ PubSub<PiRpcEvent> → notify subscribers            │   │
│  │ pending requests Map → correlate id-based responses│   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                pi subprocess (--mode rpc)                 │
│  Extensions ✓  Skills ✓  Tools ✓  Models ✓  Sessions ✓  │
└─────────────────────────────────────────────────────────┘
```

---

## Schema Mapping

### pi → ai-core Message Mapping

| pi Message Type | ai-core Equivalent |
|-----------------|-------------------|
| `UserMessage` | `UserMessage` (role: 'user') |
| `AssistantMessage` | `AssistantMessage` (role: 'assistant') |
| `ToolResultMessage` | `ToolResultPart` inside message |
| `BashExecutionMessage` | `SystemMessage` (displayed as code block) |
| `CustomMessage` | `SystemMessage` (extension content) |
| `CompactionSummaryMessage` | `SystemMessage` (compaction indicator) |

### pi Event → Chat Block Mapping

| pi Event | COP Block Type |
|----------|---------------|
| `text_delta` | Append to `AgentOutputBlockV3` |
| `thinking_delta` | Thinking section in `AgentOutputBlockV3` |
| `toolcall_start` | Create `ToolCallBlockV3` (pending) |
| `toolcall_delta` | Update args in `ToolCallBlockV3` |
| `tool_execution_start` | Set executing state |
| `tool_execution_update` | Stream partial result |
| `tool_execution_end` | Complete `ToolCallBlockV3` with result |
| `extension_ui_request` | `ExtensionUIBlockV3` (new block type) |

---

## Key Implementation Details

### 1. Process Lifecycle (Effect.Scope)

```typescript
const PiRpcClientServiceLive = Layer.scoped(
  PiRpcClientService,
  Effect.gen(function* () {
    const config = yield* PiAgentConfig
    const scope = yield* Effect.scope
    
    // Spawn pi process
    const proc = spawn('pi', [
      '--mode', 'rpc',
      '--provider', config.provider,
      '--model', config.model,
      ...(config.noSession ? ['--no-session'] : []),
      ...(config.extensions ?? []).flatMap(e => ['-e', e]),
      ...(config.skills ?? []).flatMap(s => ['--skill', s]),
    ], { cwd: config.cwd })
    
    // Register cleanup
    yield* Scope.addFinalizer(scope, Effect.sync(() => {
      proc.kill('SIGTERM')
    }))
    
    // ... build service shape
  })
)
```

### 2. Event Stream (Effect.Stream from readline)

```typescript
const eventStream = Stream.async<PiRpcEvent>((emit) => {
  const rl = readline.createInterface({ input: proc.stdout })
  rl.on('line', (line) => {
    const parsed = JSON.parse(line)
    // Responses go to pending request map
    if (parsed.type === 'response') {
      pendingRequests.get(parsed.id)?.resolve(parsed)
    }
    // Events go to stream
    else {
      emit.single(parsed)
    }
  })
  rl.on('close', () => emit.end())
})
```

### 3. Extension UI Forwarding

```typescript
// In PiRpcClientService
const handleExtensionUI = (request: RpcExtensionUIRequest) => 
  Effect.gen(function* () {
    // Push to piExtensionUIAtom for React rendering
    yield* Atom.update(piExtensionUIAtom, (queue) => [...queue, request])
    
    // Wait for response from React (via Deferred)
    const deferred = yield* Deferred.make<RpcExtensionUIResponse>()
    pendingUIRequests.set(request.id, deferred)
    
    const response = yield* Deferred.await(deferred)
    
    // Write response to pi stdin
    proc.stdin.write(JSON.stringify(response) + '\n')
  })
```

### 4. Provider Registration

```typescript
// In src/lib/ai-core/providers/index.ts
export const BUILT_IN_PROVIDERS = {
  noop: NoopProvider,
  'ai-sdk': AISDKProvider,
  'pi-rpc': PiProvider,  // ← NEW
} as const

export type ChatDataProviderType = 'noop' | 'ai-sdk' | 'terminal-v3' | 'pi-rpc'
```

---

## File Structure

```
src/lib/ai-core/providers/pi/
├── index.ts                    # Barrel exports
├── schemas.ts                  # PiAgentConfig, PiRpcEvent, PiToolExecution, PiSessionState
├── PiRpcClientService.ts       # Effect.Service wrapping child_process + JSON protocol
├── PiProvider.ts               # ChatDataProvider implementation
├── atoms.ts                    # piAgentStateAtom, piToolExecutionsAtom, piExtensionUIAtom
├── ExtensionUIBridge.tsx       # React component forwarding extension_ui_request → chat UI
└── __tests__/
    ├── schemas.test.ts         # Schema encode/decode round-trip
    ├── PiRpcClientService.test.ts  # Mock process integration
    └── PiProvider.test.ts      # ChatDataProvider contract tests
```

---

## Dependencies

### Already Available
- `child_process` (Node.js built-in, available in Tauri's Node sidecar or Vite dev)
- `readline` (Node.js built-in)
- `effect` (Scope, Stream, PubSub, Deferred)
- `effect-atom` (Atom.make, Atom.family)
- `@mariozechner/pi-coding-agent` types (for reference, NOT imported at runtime)

### Key Constraint: Tauri + Vite
In **Vite dev mode**, `child_process` is available via Node.js.
In **Tauri production**, we'll need a Tauri sidecar or Tauri shell API:
```rust
// tauri.conf.json
"shell": { "sidecar": true, "scope": [{ "name": "pi", "cmd": "pi", "args": true }] }
```

This means PiRpcClientService needs a **pluggable spawn strategy**:
- Dev: `child_process.spawn`
- Tauri: `@tauri-apps/api/shell` Command

---

## Critical Path

```
#492 (schemas) ──→ #493 (client service) ──→ #494 (provider) ──→ #496 (ext UI bridge) ──→ #497 (testbed)
                                          ↘
                                           #495 (atoms) ─────→ #496
```

**Zero external dependencies** — can start #492 immediately.

---

## References

- Pi RPC docs: `~/.npm-packages/lib/node_modules/@mariozechner/pi-coding-agent/docs/rpc.md`
- Pi SDK docs: `~/.npm-packages/lib/node_modules/@mariozechner/pi-coding-agent/docs/sdk.md`
- Pi Extension docs: `~/.npm-packages/lib/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`
- RPC Client types: `~/.npm-packages/lib/node_modules/@mariozechner/pi-coding-agent/dist/modes/rpc/rpc-client.d.ts`
- RPC Protocol types: `~/.npm-packages/lib/node_modules/@mariozechner/pi-coding-agent/dist/modes/rpc/rpc-types.d.ts`
- Existing ChatDataProvider: `src/lib/ai-core/providers/ChatDataProvider.ts`
- Existing AISDKProvider: `src/lib/ai-core/providers/AISDKProvider.ts`
