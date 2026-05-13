# Synadia Agents SDK — References

Concrete file paths, API signatures, and code patterns for the
`synadia-agents` monorepo. All paths relative to repo root at
`../../submodules/synadia-agents/`.

## File Index

### Core SDKs

| File | Purpose |
|------|---------|
| `client-sdk/typescript/src/index.ts` | Caller SDK public exports |
| `client-sdk/typescript/src/agent.ts` | `Agent` class — `.prompt()`, `.info`, validation |
| `client-sdk/typescript/src/agents.ts` | `Agents` class — `.discover()`, `.close()` |
| `client-sdk/typescript/src/subjects.ts` | `AgentSubject` — verb-first subject builder |
| `client-sdk/typescript/src/stream/prompt-stream.ts` | `PromptStream` — async iterable over chunks |
| `client-sdk/typescript/src/prompt/envelope.ts` | Envelope encode/decode |
| `client-sdk/typescript/src/prompt/options.ts` | `PromptOptions` — timeout, attachments, abort |
| `client-sdk/typescript/src/discovery/agent-info.ts` | `buildAgentInfo` — validates `$SRV.INFO` response |
| `client-sdk/typescript/src/discovery/srv-ping.ts` | `discoverAgents` — stall/timer strategies |
| `client-sdk/typescript/src/heartbeat/tracker.ts` | `HeartbeatTracker` — passive liveness via `agents.hb.>` |
| `client-sdk/typescript/src/heartbeat/payload.ts` | Heartbeat payload shape + builder |
| `client-sdk/typescript/src/context.ts` | NATS CLI context loader (`~/.config/nats/context/`) |
| `client-sdk/typescript/src/errors.ts` | Error hierarchy: `NatsAgentError` → children |
| `client-sdk/typescript/src/version.ts` | SDK version constant |
| `agent-sdk/typescript/src/index.ts` | Host SDK public exports |
| `agent-sdk/typescript/src/service.ts` | `AgentService` — registration, heartbeat, prompt dispatch |
| `agent-sdk/typescript/src/testing/reference-agent.ts` | `ReferenceAgent` — gold-standard test agent |

### Agent Plugins

| File | Purpose |
|------|---------|
| `agents/pi/extensions/nats-channel.ts` | **PI extension** — full 800+ line channel implementation |
| `agents/pi/package.json` | PI package config (`pi.extensions` field) |
| `agents/pi/README.md` | PI extension docs (install, configure, verify, troubleshoot) |
| `agents/claude-code/server.ts` | Claude Code MCP bridge |
| `agents/claude-code/skills/configure/SKILL.md` | CC configuration skill |
| `agents/openclaw/src/gateway.ts` | OpenClaw NATS gateway |
| `agents/openclaw/src/channel.ts` | OpenClaw plugin entry point |
| `agents/openclaw/src/accounts.ts` | Account/context resolution |
| `agents/open-agent/src/bridge.ts` | Vercel open-agent bridge |
| `agents/open-agent/src/chunk-translator.ts` | UI part → NATS chunk translation |
| `agents/open-agent/src/agent.ts` | Tool loop agent + bash approval |
| `agents/hermes/README.md` | Hermes multi-session gateway docs |

### Headless Controllers

| File | Purpose |
|------|---------|
| `examples/pi-headless/src/index.ts` | PI headless entry point |
| `examples/pi-headless/src/controller.ts` | Controller — spawn/stop/list endpoints |
| `examples/pi-headless/src/pi-session-manager.ts` | Session lifecycle + stale pruning |
| `examples/pi-headless/src/managed-session.ts` | ManagedSession — serial queue + ReferenceAgent |
| `examples/pi-headless/src/subjects.ts` | Subject builders for control verbs |
| `examples/pi-headless/src/attachments.ts` | Attachment staging helpers |
| `examples/pi-headless/scripts/spawn.ts` | CLI: spawn a session |
| `examples/pi-headless/scripts/list.ts` | CLI: list active sessions |
| `examples/pi-headless/scripts/stop.ts` | CLI: stop a session |
| `examples/claude-code-headless/src/index.ts` | CC headless entry point |
| `examples/claude-code-headless/src/controller.ts` | CC controller |
| `examples/claude-code-headless/src/claude-session-manager.ts` | CC session manager |
| `examples/claude-code-headless/src/managed-session.ts` | CC managed session + cost tracking |
| `examples/claude-code-headless/src/chunk-encoder.ts` | Chunk encoder helpers |

### Examples & Testing

| File | Purpose |
|------|---------|
| `examples/agent-web-ui/server/bridge.ts` | WebSocket → NATS bridge (Bun) |
| `examples/agent-web-ui/server/wire.ts` | Bridge wire protocol types |
| `examples/dspy/src/index.ts` | DSPy ReAct agent on NATS |
| `examples/dspy/src/tools.ts` | Sandboxed filesystem tools |
| `client-sdk/typescript/examples/01-discover.ts` | Discover agents |
| `client-sdk/typescript/examples/02-prompt-text.ts` | Prompt with text |
| `client-sdk/typescript/examples/03-prompt-attachment.ts` | Prompt with files |
| `client-sdk/typescript/examples/04-query-reply.ts` | Mid-stream query flow |
| `client-sdk/typescript/examples/05-liveness.ts` | Heartbeat liveness |
| `client-sdk/typescript/examples/_run-reference-agent.ts` | Run reference agent standalone |

### Documentation

| File | Purpose |
|------|---------|
| `README.md` | Repo overview, quickstart, wire protocol summary |
| `README-DEV.md` | Local dev setup, build order, release ladder |
| `CLAUDE.md` | Agent coding guidelines (for Claude Code sessions) |
| `docs/using-nats-cli.md` | CLI cookbook: prompts, attachments, flags, gotchas |
| `client-sdk/typescript/docs/getting-started.md` | TS caller SDK getting started |
| `client-sdk/typescript/docs/protocol-mapping.md` | Protocol § → SDK mapping |
| `client-sdk/python/docs/protocol-mapping.md` | Python protocol mapping |
| `agent-sdk/python/docs/protocol-mapping.md` | Python host protocol mapping |
| `devtools/README.md` | devmode.sh usage |

---

## API Signatures (TypeScript)

### Caller SDK — `@synadia-ai/agents`

```typescript
// Constructor
new Agents({ nc: NatsConnection }): Agents

// Discovery
agents.discover(opts?: {
  filter?: { agent?: string; owner?: string };
  timeoutMs?: number;        // default: 2000
  stallMs?: number;          // default: 750
}): Promise<Agent[]>

// Targeted lookup
agents.lookupInstance(instanceId: string): Promise<Agent | undefined>

// Prompt
agent.prompt(text: string, opts?: {
  attachments?: string[] | Attachment[];  // file paths or objects
  maxWaitMs?: number;         // absolute ceiling (default: 600_000)
  inactivityTimeoutMs?: number; // per-chunk gap (default: 60_000)
  signal?: AbortSignal;
}): Promise<PromptStream>

// Stream iteration
for await (const msg of stream) {
  msg.type    // "response" | "status" | "query"
  msg.text    // for response chunks
  msg.status  // for status chunks ("ack", "done")
  msg.reply() // for query chunks — fire-and-forget answer
}

// Cleanup
await agents.close()
```

### Host SDK — `@synadia-ai/agent-service`

```typescript
// Constructor
new AgentService({
  nc: NatsConnection,
  agent: string,              // harness token (e.g. "my-agent")
  owner: string,              // namespace (e.g. $USER)
  name: string,               // session name
  description?: string,
  heartbeatIntervalS?: number, // default: 30
  keepaliveIntervalS?: number | null, // default: 30, null to disable
  maxPayloadBytes?: number,    // default: nc.info.max_payload
  attachmentsOk?: boolean,     // default: true
  extraEndpoints?: EndpointDef[],
}): AgentService

// Register prompt handler
service.onPrompt(async (envelope, response) => {
  envelope.prompt       // string
  envelope.attachments  // Attachment[] | undefined

  await response.send("text")           // emit response chunk
  const answer = await response.ask(    // emit query, await reply
    "Allow this?",
    { timeout: 120 }
  )
})

// Lifecycle
await service.start()   // register + begin heartbeats
await service.stop()    // drain + deregister

// Escape hatch
service.service         // underlying @nats-io/services instance
```

### Wire Helpers (exported from agent-sdk)

```typescript
import {
  encodeChunk,              // (type, data) → Uint8Array
  splitResponseText,        // (text, maxBytes) → string[]
  buildHeartbeatPayload,    // (opts) → HeartbeatPayload
  encodeHeartbeatPayload,   // (payload) → Uint8Array
} from "@synadia-ai/agent-service"
```

---

## Error Hierarchy

```
NatsAgentError
├── ValidationError
│   ├── PromptEmptyError          // prompt string was empty
│   ├── PayloadTooLargeError      // envelope exceeds max_payload
│   └── AttachmentsNotSupportedError // agent has attachments_ok: false
├── ServiceError                   // Nats-Service-Error-Code header (400/500)
├── StreamStalledError             // inactivityTimeoutMs gap exceeded
└── StreamMaxWaitExceededError     // absolute maxWaitMs ceiling hit
```

---

## Subject Construction

```typescript
import { AgentSubject } from "@synadia-ai/agents"

const subj = new AgentSubject("pi", "alice", "my-session")

subj.prompt    // "agents.prompt.pi.alice.my-session"
subj.heartbeat // "agents.hb.pi.alice.my-session"
subj.status    // "agents.status.pi.alice.my-session"
```

Token constraints: `[a-z0-9_-]`. Forbidden chars auto-encoded via base64url-nopad.

---

## NATS CLI Recipes

```bash
# Discover all agents
nats req '$SRV.INFO.agents' '' --replies=0 --timeout=2s

# Watch heartbeats (all agents)
nats sub 'agents.hb.*.*.*'

# Prompt a PI agent
nats req agents.prompt.pi.$USER.my-session "List files" \
  --wait-for-empty --reply-timeout 30s --timeout 120s

# Prompt with JSON envelope + attachment
nats req agents.prompt.pi.$USER.my-session \
  '{"prompt":"Analyze this","attachments":[{"filename":"data.csv","content":"'$(base64 -w0 data.csv)'"}]}' \
  --wait-for-empty --reply-timeout 30s --timeout 120s

# Check a specific agent's status
nats req agents.status.pi.$USER.my-session '' --timeout=2s

# Ping a specific instance
nats req '$SRV.PING.agents.<instance_id>' '' --timeout=2s
```

---

## Configuration Files

### PI Extension Config (`~/.pi/agent/nats-channel.json`)
```json
{
  "context": "prod",
  "sessionName": "my-session"
}
```

### NATS CLI Context (`~/.config/nats/context/<name>.json`)
```json
{
  "url": "nats://nats.example.com:4222",
  "token": "...",
  "creds": "~/.config/nats/nsc/keys/creds/...",
  "nkey": "~/.config/nats/nsc/keys/...",
  "user": "...",
  "password": "..."
}
```

Auth precedence: `creds` > `nkey` > `user_jwt + user_seed` > `user/password` > `token`.

---

## Protocol Version Compatibility

| Field | Value |
|-------|-------|
| Current version | `0.3` |
| Format | `MAJOR.MINOR` (no patch) |
| Compatibility | Same `MAJOR.MINOR` = full interop |
| Unknown fields | Tolerated per §5.6 and §6.6 |
| Unknown chunk types | Tolerated — caller skips gracefully |

---

## DeepWiki Queries

For SDK questions beyond this reference:

```
deepwiki_ask_question("synadia-ai/synadia-agents", "<your question>")
```

Useful angles:
- "How does AgentService handle max_payload splitting internally?"
- "Walk through the MuxInbox routing logic in the TypeScript caller SDK"
- "How does the Python SDK implement the stall discovery strategy?"
- "What happens when two PI sessions collide on the same subject?"

---

## Package Versions & Dependencies

### PI Channel Extension
```
@synadia-ai/nats-pi-channel@0.5.4
├── @nats-io/transport-node@^3.4.0
├── @nats-io/services@^3.4.0
├── @synadia-ai/agents (file: link to client-sdk)
└── @synadia-ai/agent-service (file: link to agent-sdk)
peer: @earendil-works/pi-coding-agent@*
```

### Caller SDK
```
@synadia-ai/agents
├── @nats-io/nats-core
└── @nats-io/services
```

### Host SDK
```
@synadia-ai/agent-service
├── @synadia-ai/agents (peer/dep)
├── @nats-io/nats-core
└── @nats-io/services
```

---

## Test Patterns

### Integration test with ReferenceAgent
```typescript
import { ReferenceAgent } from "@synadia-ai/agent-service/testing"
import { connect } from "@nats-io/transport-node"
import { Agents } from "@synadia-ai/agents"

const nc = await connect()
const ref = new ReferenceAgent({ nc, agent: "test", owner: "ci", name: "ref" })
await ref.start()

const agents = new Agents({ nc })
const [found] = await agents.discover({ filter: { agent: "test" } })

for await (const msg of await found!.prompt("hello")) {
  // assert chunk types, ordering, terminator
}

await ref.stop()
await agents.close()
await nc.close()
```

### Cross-SDK interop (Python client → TS agent)
```bash
# Terminal 1: Start TS reference agent
cd client-sdk/typescript
bun run examples/_run-reference-agent.ts

# Terminal 2: Run Python tests against it
cd client-sdk/python
uv run pytest tests/test_interop_e2e.py -v
```

Evidence artifacts written to `tests/_evidence/` — wire captures, latency measurements, SHA-256 attachment hashes.
