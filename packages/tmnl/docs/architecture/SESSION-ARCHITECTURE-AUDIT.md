# Session Architecture Audit — TMNL × pi

> **Status**: Living document — grounding for session API redesign.
> **Date**: 2026-02-28
> **Author**: Val (architectural conscience)

---

## Executive Summary

TMNL has **three session domains** that pretend to be one system:

1. **pi's SessionManager** — append-only tree of JSONL entries, branching, compaction, TUI-native
2. **Our HarnessEngine** — in-memory session refs with event store persistence, WS relay
3. **MorphChat's consumer layer** — atom families, adapter hooks, session drawer UI

The coupling between these layers is **leaky, lossy, and largely accidental**. Our `sessionId` is passed straight through to pi-ai's `SimpleStreamOptions.sessionId`, which some providers use for prompt cache keying — but we don't control or even observe that continuity. Meanwhile, our session store (JSONL) reinvents pi's session format with incompatible schemas, our status taxonomies diverge (execution vs metadata), and our consumer layer has no typed contract for session lifecycle.

---

## Domain Map

### Layer 1: pi's Session Model (Upstream)

| Aspect | Detail |
|--------|--------|
| **Storage** | `~/.pi/agent/sessions/<encoded-cwd>/<id>.jsonl` |
| **Format** | JSONL — first line is `SessionHeader`, rest are `SessionEntry` nodes |
| **Structure** | **Tree** — each entry has `id` + `parentId`, enabling in-place branching |
| **Entry Types** | `message`, `thinking_level_change`, `model_change`, `compaction`, `branch_summary`, `custom`, `custom_message`, `label`, `session_info` |
| **Navigation** | `/tree` (visual branch selector), `/resume` (session picker), `/fork` (extract branch) |
| **Compaction** | Summarizes old context → `CompactionEntry` with `firstKeptEntryId` |
| **Version** | v3 with auto-migration from older formats |
| **Leaf pointer** | `SessionManager.leafId` — the current tip of the active branch |
| **Identity** | `sessionId` generated at creation, used as `SimpleStreamOptions.sessionId` for provider-level cache keying |

**Key insight**: pi's session is a **content-addressable tree**, not a flat log. Branching is first-class. Compaction preserves full history but summarizes for LLM context.

### Layer 2: Our Harness Engine (Middle)

| Aspect | Detail |
|--------|--------|
| **Storage** | `~/.tmnl/harness-sessions/<sessionId>.jsonl` + `.session-index.json` |
| **Format** | JSONL — first line is `session_meta`, rest are `event` or `cursor` entries |
| **Structure** | **Flat log** — monotonic `seq`, no branching |
| **Entry Types** | `HarnessEventEnvelope` (wrapping `HarnessEvent` union), `HarnessReplayCursor` |
| **Session Create** | `openSession(nodeId, role)` → nanoid `sessionId`, in-memory `SessionRecord` + store upsert |
| **Session Resume** | `resumeSession(id, fromSeq)` → load from store, replay events |
| **Session List** | Index file or full scan of JSONL files |
| **Identity** | `chat-v2-piai-<nanoid>` prefix, passed through to pi-ai as `sessionId` |
| **Status** | Execution: `active \| closed \| failed` vs Metadata: `active \| archived \| starred` (lossy bridge) |

**Key insight**: This layer **reinvents** pi's session store but with a flat log instead of a tree. No branching, no compaction, no leaf navigation. The sessionId passthrough to pi-ai means pi might cache based on our ID, but we don't observe or leverage that.

### Layer 3: MorphChat Consumer (Downstream)

| Aspect | Detail |
|--------|--------|
| **Storage** | Atom families keyed by `instanceId` + localStorage via `ContentSnapshot` |
| **Session State** | `sessionId$`, `connection$`, `streaming$`, `messages$`, `messageIds$` per instance |
| **Session Ops** | `connectOp$`, `newSessionOp$`, `resumeSessionOp$`, `disposeOp$`, `hardReconnect` |
| **Session Meta** | `session-manager.ts` atoms for list/rename/star/archive/delete/fork |
| **Contract** | `MorphChatAdapter` — has NO session lifecycle methods, only send/cancel/clear |
| **UI** | `SessionDrawer` + `SessionCard` for browse/switch |

**Key insight**: The consumer layer has **no typed session lifecycle contract**. Session ops are scattered across hook-level escape hatches. The adapter interface was designed for single-session chat, not multi-session orchestration.

---

## Identity Flow (End-to-End)

```
Browser Panel
  └─ useHarnessAdapter.connectOp$
       └─ HarnessRuntimeBrowser.openSession(nodeId, role)
            └─ WS: remote:chat_v2_open_session
                 └─ HarnessRemoteWsServer → HarnessRuntimeLive
                      └─ PiAiHarnessEngine.openSession()
                           ├─ sessionId = `chat-v2-piai-${nanoid()}`
                           ├─ agentId = `agent-${nanoid()}`
                           ├─ store.upsertSession(envelope)
                           └─ PiAiPolicy.makeStreamOptions({ sessionId })
                                └─ pi-ai streamSimple(model, context, { sessionId })
                                     └─ Provider: prompt_cache_key / conversation_id headers
```

**Problems**:
1. `nodeId → sessionId` mapping is in-memory only (`nodeToSessionRef`). Process restart loses it.
2. `sessionId` passed to pi-ai but we never read back cache status or continuity signals.
3. Our `headSeq: 1` returned on open while 2 events already emitted (session_opened + tool_manifest).
4. Hydrated sessions rebuild with empty `context.messages` — model context continuity is broken.

---

## Status Model Divergence

```
Execution (HarnessSessionStatus):     active | closed | failed
Metadata  (SessionStatus):            active | archived | starred

Bridge (toEnvelopeStatus):
  archived → closed
  * → active
  
Bridge (toSessionStatus):
  closed → archived
  * → active

Lost in translation:
  - "failed" has no metadata representation
  - "starred" has no execution representation  
  - Round-trip: failed → active → active (information destroyed)
```

---

## What pi Has That We Don't

| Capability | pi | TMNL |
|-----------|-----|------|
| **Branching** | Tree structure with `parentId`, branch/merge | Flat log, no branching |
| **Compaction** | `CompactionEntry` with `firstKeptEntryId` | None — unbounded growth |
| **Leaf navigation** | `/tree` visual selector, `branch(entryId)` | No equivalent |
| **Session forking** | `createBranchedSession(leafId)` extracts path | `forkSession` copies full log |
| **Custom entries** | `custom` (hook state), `custom_message` (LLM context) | Only `HarnessEvent` union |
| **Labels/bookmarks** | `LabelEntry` on any node | None |
| **Auto-migration** | v1→v2→v3 transparent upgrade | Hardcoded v1 |
| **Context rebuild** | `buildSessionContext()` walks tree + compaction | Replay events (no context awareness) |

---

## What We Have That pi Doesn't

| Capability | TMNL | pi |
|-----------|------|-----|
| **Multi-instance** | Atom families per `instanceId`, concurrent panels | Single session at a time |
| **Real-time events** | `PubSub` + `Stream` + event processor | Sequential tool loop |
| **Session metadata** | Rich `HarnessSessionMeta` (provider, model, tokens, preview) | Minimal `SessionHeader` |
| **Remote transport** | WS relay with `requestId` correlation | Local process only |
| **Tool bridge** | Extension tools, interactive shell, genifer panels | Built-in tool set |
| **Content persistence** | LocalStorage write-through (new Phase C) | JSONL only |

---

## Critical Gaps

### 1. No Programmatic Session API
The `MorphChatAdapter` contract has `send`, `cancel`, `clear`, `dispose` — no `createSession`, `resumeSession`, `switchSession`, `forkSession`, `listSessions`. These are all escape hatches from `useHarnessAdapter`.

### 2. No Session Lifecycle State Machine
Session transitions (idle → connecting → connected → streaming → idle) are implicit in atom mutations. No XState machine, no transition guards, no history.

### 3. No Session Context Reconstruction
When hydrating a session, we replay events but don't rebuild the LLM `context.messages`. The model sees a fresh conversation. pi's `buildSessionContext()` walks the tree and builds proper context including compaction summaries.

### 4. No Branching
Every "new session" is a completely new conversation. There's no way to branch from message N and explore an alternative path while preserving the original.

### 5. No Compaction
Sessions grow unbounded. No summarization, no context window management, no `firstKeptEntryId`.

### 6. Transport ≠ Session ≠ Content (Finally Fixed)
Phase A/B of the clobber fix separated these, but the boundary is enforcement-by-convention (layer helpers), not structural (separate services/modules).

### 7. Event Fan-Out Is Global
The WS server relays ALL runtime events to ALL connections. No per-session subscription filtering. This works with 1 user but will not scale.

---

## Design Implications for Future Features

### Kanban Nodal Dispatch
Requires: session creation/switching as a programmatic API, multi-session orchestration, session metadata for task context, branching for alternative approaches.

### Long-Running Agents
Requires: session persistence across process restarts, compaction for unbounded conversations, context reconstruction on resume, session forking for parallel agent tracks.

### Multi-Agent Workflows
Requires: session isolation per agent, session metadata propagation (who created, which workflow), event routing per session (not global fan-out), branching for agent deliberation trees.

### Session-Aware Panels
Requires: typed session lifecycle in adapter contract, session identity as first-class in component props, session switch as declarative (not imperative hook escape hatch).

---

## Files Index

### Harness Layer (Session Authority)
- `src/lib/harness/schemas.ts` — HarnessSessionId, HarnessEvent union, session envelope
- `src/lib/harness/HarnessRuntime.ts` — Runtime service interface (openSession, resumeSession, etc.)
- `src/lib/harness/HarnessRuntimeBrowser.ts` — Browser impl (WS command mapping)
- `src/lib/harness/HarnessRuntimeLive.ts` — Server impl (delegates to engine)
- `src/lib/harness/PiAiHarnessEngine.ts` — Core engine (sessionsRef, event emit, pi-ai bridge)
- `src/lib/harness/PiAiPolicy.ts` — Stream options builder (sessionId passthrough)
- `src/lib/harness/PiAiStreamClient.ts` — Thin pi-ai wrapper
- `src/lib/harness/HarnessSessionStore.ts` — Base store interface
- `src/lib/harness/HarnessSessionStoreMemory.ts` — In-memory store
- `src/lib/harness/session/SessionStore.ts` — Extended store (list/updateMeta)
- `src/lib/harness/session/SessionStoreJSONL.ts` — File-based store
- `src/lib/harness/session/schemas.ts` — Session metadata schemas
- `src/lib/harness/HarnessBrowserTransport.ts` — WS transport layer
- `src/lib/harness/HarnessBrowserRemoteSchemas.ts` — Wire protocol schemas
- `src/lib/harness/server/HarnessRemoteWsServer.ts` — WS server (command dispatch)

### MorphChat Layer (Session Consumer)
- `src/lib/morphchat/hooks/useHarnessAdapter.ts` — Main adapter hook (session lifecycle)
- `src/lib/morphchat/atoms/session-manager.ts` — Session list/metadata atoms
- `src/lib/morphchat/hooks/useSessionManager.ts` — Session manager hook
- `src/lib/morphchat/schemas/adapter-types.ts` — Adapter contract (missing session ops)
- `src/lib/morphchat/adapters/harness-adapter.ts` — Legacy adapter (parallel lifecycle)
- `src/lib/morphchat/adapters/harness-event-processor.ts` — Event → atom mapping
- `src/lib/morphchat/persistence/content-store.ts` — localStorage persistence
- `src/lib/morphchat/components/session-drawer/ ` — Session browse/switch UI

### pi Upstream
- `pi-coding-agent/src/core/session-manager.ts` — SessionManager (tree, branching, compaction)
- `pi-ai/src/streaming.ts` — streamSimple (sessionId passthrough to providers)
- `pi-web-ui` — SessionsStore (IndexedDB for web chat)
