---
name: synadia-agents-sdk
description: >
  Synadia Agent Protocol for NATS — SDK grounding for rapid development.
  Use when building, debugging, or integrating NATS-based agent channels
  (PI, Claude Code, OpenClaw, Hermes, custom agents). Covers wire protocol,
  caller/host SDK APIs, PI extension internals, headless controllers,
  mid-stream queries, discovery, heartbeats, and attachment staging.
---

# Synadia Agents SDK — Development Grounding

Canonical reference for the Synadia Agent Protocol for NATS (v0.3) and
the `synadia-agents` monorepo at `../../submodules/synadia-agents/`.

> **See also**: `REFERENCES.md` in this skill directory for file paths,
> code snippets, and concrete API signatures.

## When to Use

- Building or modifying a NATS agent channel (PI, Claude Code, custom)
- Integrating the caller SDK (`@synadia-ai/agents`) into a TypeScript service
- Hosting a new agent with the host SDK (`@synadia-ai/agent-service`)
- Debugging wire-level issues (missing terminators, ack timing, payload limits)
- Understanding attachment staging, session collision, or heartbeat liveness
- Implementing mid-stream query/approval flows (§7)
- Building headless controllers that spawn/stop/list agent sessions

## Submodule Location

```
../../submodules/synadia-agents/
├── client-sdk/typescript/     # @synadia-ai/agents (caller)
├── agent-sdk/typescript/      # @synadia-ai/agent-service (host)
├── agents/pi/                 # PI extension (nats-channel.ts)
├── agents/claude-code/        # Claude Code MCP bridge
├── agents/openclaw/           # OpenClaw gateway
├── agents/hermes/             # Hermes multi-session
├── agents/open-agent/         # Vercel open-agents bridge
├── examples/pi-headless/      # Headless PI controller
├── examples/claude-code-headless/  # Headless CC controller
├── examples/agent-web-ui/     # Vue 3 testing dashboard
└── examples/dspy/             # DSPy ReAct agent
```

## Core Concepts

### 1. Wire Protocol (v0.3)

**Subject layout** — verb-first, 5 tokens:
```
agents.{verb}.{agent}.{owner}.{session}
```

| Token | Values | Source |
|-------|--------|--------|
| `verb` | `prompt`, `hb`, `status`, `spawn`, `stop`, `list` | Protocol §2 |
| `agent` | `cc`, `pi`, `oc`, `hermes`, `open-agent`, `dspy` | Per-harness constant |
| `owner` | `$USER` | Derived, not configurable |
| `session` | CWD basename / override / auto-suffixed | Config or env var |

**Chunk types** — JSON objects on the reply subject:

| Type | Wire Shape | When |
|------|-----------|------|
| `status` | `{"type":"status","data":"ack"}` | **Leading ack** (mandatory first), keep-alives (30s default) |
| `response` | `{"type":"response","data":"..."}` | Text deltas from LLM |
| `query` | `{"type":"query","data":{"id","reply_subject","prompt"}}` | Mid-stream questions (§7) |
| Terminator | Empty body, no headers | End of every stream |
| Error | `Nats-Service-Error-Code: 400\|500` header, then terminator | Decode failures / handler crashes |

**Request envelope** — plain UTF-8 or JSON:
```json
{"prompt":"...","attachments":[{"filename":"...","content":"<base64>"}]}
```

### 2. SDK Architecture

```
Caller (discovers, prompts)        Host (registers, serves)
─────────────────────────          ─────────────────────────
@synadia-ai/agents                 @synadia-ai/agent-service
─────────────────────────          ─────────────────────────
Agents.discover() → Agent[]       AgentService.start()
Agent.prompt(text, opts)           service.onPrompt(handler)
  → PromptStream (AsyncIterable)   PromptResponse.send(text)
Agent.info (metadata)              PromptResponse.ask(question)
                                   ReferenceAgent (testing)
```

**Caller SDK classes:**
- `Agents` — wraps `NatsConnection`, does `$SRV.INFO.agents` discovery
- `Agent` — handle for one service instance, validates before publish
- `PromptStream` — `AsyncIterable<StreamMessage>`, iterates until terminator

**Host SDK classes:**
- `AgentService` — registers NATS micro service, manages heartbeats + keep-alive
- `PromptResponse` — helper to `.send()` chunks and `.ask()` queries
- `ReferenceAgent` — gold-standard test agent (`/testing` subpath)

### 3. PI Extension Lifecycle (`nats-channel.ts`)

The PI NATS channel extension hooks into PI's `ExtensionAPI`:

```
session_start
  → Connect to NATS (resolve context from ~/.config/nats/context/)
  → Resolve session name (collision-avoid: query $SRV, suffix -2, -3...)
  → Register NATS micro service "agents" with prompt + status endpoints
  → Start heartbeat loop (30s)

handleNatsMessage (on prompt endpoint)
  → Validate payload size against max_payload
  → decodeEnvelope() — validates base64, filenames
  → Stage attachments to ~/.pi/agent/attachments/{session}/{uuid}/{filename}
  → Push PendingRequest to requestQueue
  → drainQueue()

drainQueue()
  → If already processing, return (serial execution)
  → Pop next request
  → Prepend absolute file paths to prompt text
  → Start ACK keep-alive timer (20s interval)
  → Call pi.onPrompt(prompt, attachments)

message_update (PI event)
  → Split text into chunks respecting max_payload
  → encodeChunk() → publish to reply subject

agent_end (PI event)
  → Stop ACK timer
  → Publish empty-body terminator
  → drainQueue() for next request

session_shutdown
  → Clean up NATS connection
  → Remove ~/.pi/agent/attachments/{session}/
```

### 4. Discovery & Heartbeats

**Discovery** — standard NATS micro:
```bash
nats req '$SRV.INFO.agents' '' --replies=0 --timeout=2s
```

**Heartbeat payload** — published to `agents.hb.{a}.{o}.{s}` every 30s:
```json
{
  "agent": "pi",
  "owner": "user",
  "session": "my-session",
  "instance_id": "<ULID>",
  "ts": "<ISO8601>",
  "interval_s": 30
}
```

**Liveness** — caller considers agent `online` if last beat < `interval_s × 3`.

### 5. Mid-Stream Queries (§7)

Agent-side:
```typescript
const answer = await response.ask("Allow write to /etc/passwd?", { timeout: 120 });
```
1. Allocates fresh `_INBOX` reply subject
2. Subscribes with `max: 1`
3. Publishes `query` chunk with `reply_subject`
4. Blocks until reply or `QueryTimeout`

Caller-side:
```typescript
for await (const msg of stream) {
  if (msg.type === "query") {
    await msg.reply("yes");  // fire-and-forget to reply_subject
  }
}
```

### 6. Headless Controllers

Factory pattern — one process manages N sessions:

| Endpoint | Subject | Payload |
|----------|---------|---------|
| **spawn** | `agents.spawn.{type}.{owner}.control` | `SpawnSpec` (cwd, model, max_lifetime_s) |
| **list** | `agents.list.{type}.{owner}.control` | empty |
| **stop** | `agents.stop.{type}.{owner}.control` | `{"session_id": "..."}` |

Each spawned session registers its own `agents.prompt.*` subject independently.

### 7. Attachment Staging

| Agent | Staging Path | Cleanup |
|-------|-------------|---------|
| PI | `~/.pi/agent/attachments/{session}/{uuid}/` | Session shutdown |
| Claude Code | `~/.claude/channels/nats/attachments/{request_id}/` | Reply completion |
| OpenClaw | `~/.openclaw/attachments/{agentName}/{uuid}/` | Gateway stop |

File paths are prepended to the prompt text so the LLM can `read` them.

### 8. Configuration Precedence (PI)

1. **`$NATS_CONTEXT`** env var — wins over everything
2. **`config.context`** in `~/.pi/agent/nats-channel.json`
3. **`$NATS_URL`** — raw URL fallback (no auth context)
4. **Built-in default** — `demo.nats.io`

Session name: `$NATS_SESSION_NAME` > `config.sessionName` > `basename(CWD)`.

### 9. In-PI Commands

| Command | Action |
|---------|--------|
| `/nats-status` | Show subject, service ID, protocol version, queue depth |
| `/nats-configure` | Print current config |
| `/nats-configure <context>` | Switch NATS context (requires restart) |
| `/nats-configure session <name>` | Override session name |
| `/nats-configure session clear` | Revert to CWD basename |

## Development Patterns

### Install the PI extension
```bash
pi install npm:@synadia-ai/nats-pi-channel
```

### Verify PI is on NATS
```bash
nats req '$SRV.INFO.agents' '' --replies=0 --timeout=2s
nats sub 'agents.hb.*.*.*'   # watch heartbeats
```

### Prompt an agent from CLI
```bash
nats req agents.prompt.pi.$USER.my-session "What files are here?" \
  --wait-for-empty --reply-timeout 30s --timeout 120s
```
**Critical flags**: `--wait-for-empty` (terminator), `--reply-timeout 30s` (LLM warm-up gap).

### Prompt from TypeScript
```typescript
import { connect } from "@nats-io/transport-node";
import { Agents } from "@synadia-ai/agents";

const nc = await connect({ servers: "nats://localhost:4222" });
const agents = new Agents({ nc });
const [agent] = await agents.discover({ filter: { agent: "pi" } });

for await (const msg of await agent!.prompt("What files are here?")) {
  if (msg.type === "response") process.stdout.write(msg.text);
}

await agents.close();
await nc.close();
```

### Host a custom agent
```typescript
import { connect } from "@nats-io/transport-node";
import { AgentService } from "@synadia-ai/agent-service";

const nc = await connect({ servers: "nats://localhost:4222" });
const service = new AgentService({
  nc,
  agent: "my-agent",
  owner: "me",
  name: "main",
  description: "My custom agent",
});

service.onPrompt(async (envelope, response) => {
  await response.send(`You said: ${envelope.prompt}`);
});

await service.start();
```

### WebSocket connection (browser)
NATS is TCP/TLS — use `wsconnect` from `@nats-io/nats-core` for browser,
or proxy through a Bun/Node bridge (see `examples/agent-web-ui/server/`).

## Research Tools

When you need deeper answers about the SDK internals:

```
deepwiki_ask_question("synadia-ai/synadia-agents", "your question")
```

For local source reading:
```
../../submodules/synadia-agents/agents/pi/extensions/nats-channel.ts
../../submodules/synadia-agents/client-sdk/typescript/src/
../../submodules/synadia-agents/agent-sdk/typescript/src/
```

## Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|------|
| Use `nats req` without `--wait-for-empty` | Always pass `--wait-for-empty` or `--replies=0` |
| Set `--reply-timeout` < 5s | Use `--reply-timeout 30s` (LLM cold start gap) |
| Send `file:` paths in envelope `content` | Send base64-encoded content only |
| Use URL-safe base64 | Use standard RFC 4648 §4 base64 (padded, `+`/`/`) |
| Omit leading ack before handler work | SDK does this automatically — don't suppress it |
| Skip the terminator | SDK handles this — empty body, no headers, always |
| Assume agents handle concurrent prompts | PI is serial — requests queue and drain one at a time |
