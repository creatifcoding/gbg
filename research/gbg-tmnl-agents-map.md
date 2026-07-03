# GBG TMNL agents map

Status: cleaned synthesis from the agents scout output. Scope: `packages/tmnl/src/lib/agents` and direct task-log durability surfaces in the GBG repo.

## Executive finding

`packages/tmnl/src/lib/agents` is the agent-calling and agent-task durability substrate adjacent to the harness runtime. It bridges Pi OAuth into `@effect/ai` `LanguageModel` layers, isolates provider-specific OAuth middleware, defines agent harness config, and provides a NATS/JetStream-backed task log durability plane with local outbox/archive/hydration fallback.

This is not just UI code. It is a Layer-first SDK surface for calling models and retaining agent-task evidence.

## Evidence anchors

- `packages/tmnl/src/lib/agents/index.ts`
- `packages/tmnl/src/lib/agents/docs/ARCHITECTURE.md`
- `packages/tmnl/src/lib/agents/auth/PiAuthBridge.ts`
- `packages/tmnl/src/lib/agents/providers/openai.ts`
- `packages/tmnl/src/lib/agents/providers/anthropic.ts`
- `packages/tmnl/src/lib/agents/providers/index.ts`
- `packages/tmnl/src/lib/agents/AgentHarnessConfig.ts`
- `packages/tmnl/src/lib/agents/atoms/auth.ts`
- `packages/tmnl/src/lib/agents/tasks/services/NatsTransportService.ts`
- `packages/tmnl/src/lib/agents/tasks/services/CodecService.ts`
- `packages/tmnl/src/lib/agents/tasks/services/AgentTaskLogDurabilityService.ts`
- `packages/tmnl/src/lib/agents/tasks/services/AgentTaskLogOutboxService.ts`
- `packages/tmnl/src/lib/agents/tasks/services/AgentTaskLogOutboxQueueStore.ts`
- `packages/tmnl/src/lib/agents/tasks/services/LogArchiveStoreService.ts`
- `packages/tmnl/src/lib/agents/tasks/services/LogHydrationService.ts`
- `packages/tmnl/src/lib/agents/tasks/services/AgentTaskMicroHostService.ts`
- `packages/tmnl/src/lib/agents/tasks/services/AgentTaskCommandRouterService.ts`
- `packages/tmnl/src/lib/agents/tasks/atoms/surface.ts`
- `packages/tmnl/src/lib/agents/tasks/views/inline-task-log-view.tsx`
- `packages/tmnl/src/lib/agents/tasks/views/use-inline-task-log-controller.ts`
- `packages/tmnl/src/lib/agents/docs/two-phase-commit-sketch.md`

## What this subsystem is

`src/lib/agents/` provides a Layer-first bridge between Pi OAuth and `@effect/ai` LanguageModel services.

The public barrel (`agents/index.ts`) exports:

- auth services (`PiAuthBridge`, `PiAuthBridgeLive`, provider status/errors);
- provider factories (`makeOpenAiCodexLayer`, `makeOpenAiLayer`, `makeOpenAiLayerFromEnv`, `makeAnthropicLayer`, `makeAnthropicLayerFromEnv`);
- provider registry (`getProvider`, `getProviderLayer`, `listProviders`);
- `AgentHarnessConfig` and config layer;
- auth/status atoms.

## Pi OAuth → LanguageModel bridging

### OpenAI / Codex path

`makeOpenAiCodexLayer` is not a generic OpenAI wrapper. It is Pi OAuth/Codex endpoint middleware:

- reads Pi OAuth token through `PiAuthBridge`;
- injects Codex-specific headers;
- rewrites request body shape by moving developer/system text into top-level `instructions`;
- forces `store:false` and `stream:true`;
- normalizes Codex SSE fields to match `@effect/ai-openai` schemas;
- supports `streamText()` only because the Codex endpoint requires streaming.

### Anthropic path

`makeAnthropicLayer` adapts Pi OAuth to Anthropic’s API shape:

- removes `x-api-key` behavior used by normal SDK paths;
- uses `Authorization: Bearer <token>`;
- injects Claude Code beta/identity headers;
- requires the system prompt to identify as Claude Code for OAuth token validation.

### Environment-variable paths

Standard API-key layers exist for OpenAI and Anthropic. They are useful, but the distinctive SDK behavior is the Pi OAuth bridge and provider-specific middleware.

## Agent harness config

`AgentHarnessConfig.ts` exposes runtime knobs used by the harness/tool layer:

- working directory;
- bash timeout;
- max tool rounds;
- extension allowlist-related environment posture;
- related agent/harness defaults.

This connects `src/lib/agents` to `src/lib/harness`: the agents layer supplies auth/provider/config primitives; the harness layer consumes them while executing sessions and tools.

## Provider registry

`providers/index.ts` provides a registry-style surface:

- provider IDs;
- layer factories;
- list/get helpers;
- model/provider presets.

Implication: owned SDK consumers should receive Layer factories and registry entries, not raw HTTP/token helpers.

## Task-log durability plane

The `agents/tasks` subtree provides an operational log/durability subsystem.

Observed design:

- Transport subject convention: `agent.task.{taskId}.logs`.
- `CodecService` parses raw JSONL into assembled log entries, with dedupe/sort/enrichment.
- `NatsTransportService` provides NATS transport.
- JetStream stream name: `AGENT_TASK_LOGS`.
- Publish subject: `agent.task.{taskId}.logs`.
- Message ID uses `entry.id` for idempotency.
- Publish returns schema-backed durability receipts.

## Local outbox / WAL

Local persistence is a transactional outbox / write-ahead log, not the authority:

- `AgentTaskLogOutboxQueueStore` keeps queued entries;
- `AgentTaskLogOutboxService` drains/publishes/acks;
- the scout notes `Effect.uninterruptibleMask` around drain/publish/ack commit boundaries;
- `two-phase-commit-sketch.md` states JetStream is final durability authority while local outbox handles unacked replay.

## Archive and hydration

Archive/hydration services support bounded offline/replay behavior:

- local archive stores manifest + chunks;
- sensitive keys are redacted before spill (`token`, `authorization`, `api key`, `secret`, `password`, `cookie`, `session`);
- hydration order is cache → archive → NATS fallback;
- hydration windows and query DSL appear in schemas/tests.

This complements the harness JSONL session store: agent-task logs can be durable over NATS/JetStream while UI surfaces hydrate from local/archive sources.

## Microhost / control plane

`AgentTaskMicroHostService` hosts a discoverable NATS microservice on `agent.task.*.commands`.

`AgentTaskCommandRouterService`:

- validates command payloads;
- emits audit logs into the same task-log stream;
- returns queued acknowledgements;
- fan-outs command events to `agent.task.{taskId}.commands.events`.

This is an agent task control plane, not a frontend coupling.

## UI decoupling

Task views are adapters over atom surfaces:

- `AgentTaskLogAtomSurface` exposes mock, NATS, and NATS+micro compositions;
- `InlineTaskLogView` accepts an injected `atomSurfaceAtom` and defaults to a mock runtime;
- the controller uses optional services and degrades when outbox/archive/hydration services are absent.

This mirrors the harness runtime split: UI consumes a surface; services own transport/durability.

## Implications for an owned agent SDK

- Export **Layer factories + provider registry**, not ad-hoc API calls.
- Keep provider-specific OAuth middleware isolated by provider.
- Surface provider capability flags:
  - Codex = stream-only;
  - Anthropic OAuth = Claude Code identity + bearer headers;
  - env-key providers = conventional SDK path.
- Treat JetStream as task-log truth; local archive/outbox is replay/cache, not authority.
- Keep consumer UI wired through atom surfaces, not concrete NATS or archive services.
- Preserve Effect-version discipline; docs warn multiple Effect versions cause tag invisibility.

## Pinned dependency context from scout

- `effect@3.21.2`
- `@effect/platform@0.94.1`
- `@effect/experimental@0.58.0`
- `@mariozechner/pi-coding-agent@0.73.1`
- `nats@2.29.3`
- `nats.ws@1.30.3`

## Relationship to harness

```text
packages/tmnl/src/lib/agents
  ├─ Pi OAuth → @effect/ai provider layers
  ├─ provider registry + AgentHarnessConfig
  └─ agent-task log durability/control plane

packages/tmnl/src/lib/harness
  ├─ session/runtime/event-loop over @mariozechner/pi-ai
  ├─ tool runtime + extension/domain tool loading
  ├─ JSONL session replay/fork/snapshot
  └─ browser/server remote projection
```

The two should be shown as adjacent SDK planes: `agents` supplies provider/auth/durability capabilities; `harness` executes Pi-facing sessions and tools.
