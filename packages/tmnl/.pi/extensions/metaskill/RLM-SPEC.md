# RLM Spec — Recursive Language Model Features for ms

**Status**: Design
**Version**: 0.1.0
**Date**: 2026-03-03
**Depends on**: `rlm-research.md` (reference), primitives system (rendering), api.ts (codemod API)

---

## Goal

Add three capabilities to the `ms` tool that implement the RLM pattern (Zhang et al. 2025) adapted for a persistent, session-spanning JavaScript REPL:

1. **Persistent state** — REPL variables that survive across sessions
2. **Sub-LM dispatch** — spawn sub-agent calls from within eval
3. **Context loading** — project knowledge as inspectable objects (not token-loaded)

The ms eval loop is already a REPL. These features turn it into an RLM.

---

## Non-Goals

- Full DSPy parity (we're JS, not Python; no Pyodide sandbox)
- Training/RL optimization of RLM trajectories (inference-only)
- Multi-turn REPL session within a single tool call (ms is single-shot eval)
- Replacing pi's subagent system (we wrap it, not rebuild it)

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                ms eval loop                      │
│   new Function('ms', code)(api)                  │
│                                                   │
│   ms.*           existing codemod API (24 fns)   │
│   ms.store()     ─┐                              │
│   ms.get()        │  Layer 1: Persistent State   │
│   ms.query()      │  (bun:sqlite collections)    │
│   ms.delete()     │                              │
│   ms.collections()┘                              │
│                                                   │
│   ms.llm()       ─┐                              │
│   ms.llm_batch()  │  Layer 2: Sub-LM Dispatch   │
│                   ─┘  (pi subagent bridge)       │
│                                                   │
│   ms.context     ─┐                              │
│   ms.vars()       │  Layer 3: Context & State    │
│   ms.history()   ─┘  (variables_info + history)  │
│                                                   │
│   return { _v }   existing primitive rendering   │
│   SUBMIT equiv    (return value = final answer)  │
└─────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────┐    ┌──────────────────┐
│ .pi/rlm/    │    │ pi subagent API  │
│ store.db    │    │ (parallel exec)  │
└─────────────┘    └──────────────────┘
```

---

## Layer 1: Persistent State

### Storage Backend

**bun:sqlite** — zero external deps, native to Bun, single file, full JSON query support.

**Location**: `.pi/rlm/store.db`

### Schema

```sql
CREATE TABLE IF NOT EXISTS collections (
  name     TEXT PRIMARY KEY,
  schema   JSON,           -- optional Effect Schema descriptor (future)
  created  TEXT NOT NULL DEFAULT (datetime('now')),
  updated  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS objects (
  collection TEXT NOT NULL,
  key        TEXT NOT NULL,
  data       JSON NOT NULL,
  tags       JSON NOT NULL DEFAULT '[]',
  created    TEXT NOT NULL DEFAULT (datetime('now')),
  updated    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (collection, key),
  FOREIGN KEY (collection) REFERENCES collections(name)
);

CREATE INDEX IF NOT EXISTS idx_objects_tags
  ON objects(collection, tags);
```

### API Surface

```typescript
// Store an object in a collection (upsert)
ms.store(collection: string, key: string, data: any, tags?: string[]): void

// Get a single object by key
ms.get(collection: string, key: string): object | null

// Query objects in a collection
// filter: { tags?: string | string[], [jsonPath]: value }
ms.query(collection: string, filter?: object): object[]

// List all keys in a collection
ms.keys(collection: string): string[]

// Delete an object
ms.delete(collection: string, key: string): boolean

// List all collections with counts
ms.collections(): Array<{ name: string, count: number, updated: string }>

// Wipe a collection
ms.clear(collection: string): number  // returns deleted count
```

### Auto-Creation

Collections are created implicitly on first `ms.store()`. No upfront registration needed. The `collections` table tracks metadata.

### Tag Queries

Tags are stored as JSON arrays. Query uses SQLite JSON functions:

```sql
-- ms.query('research', { tags: 'effect' })
SELECT key, json_extract(data, '$') as data, tags
FROM objects
WHERE collection = 'research'
  AND EXISTS (
    SELECT 1 FROM json_each(tags) WHERE value = 'effect'
  )

-- ms.query('research', { tags: ['effect', 'v4'] })  (AND)
SELECT key, json_extract(data, '$') as data, tags
FROM objects
WHERE collection = 'research'
  AND (SELECT COUNT(*) FROM json_each(tags)
       WHERE value IN ('effect','v4')) = 2
```

### JSON Path Queries

```sql
-- ms.query('decisions', { 'choice': 'npm-alias' })
SELECT key, json_extract(data, '$') as data, tags
FROM objects
WHERE collection = 'decisions'
  AND json_extract(data, '$.choice') = 'npm-alias'
```

### Lifecycle

- **Extension init** (`session_start`): Open database, run migrations
- **Each `ms.store()`**: INSERT OR REPLACE + update collection timestamp
- **Each `ms.get()`**: SELECT, return parsed JSON or null
- **Extension teardown**: Close database (WAL mode, safe for crash)

### Git Integration

```gitignore
# .pi/rlm/.gitignore
# The .db file is the source of truth.
# Track it if you want team-shared knowledge.
# Ignore WAL/SHM files.
*.db-wal
*.db-shm
```

Decision: `.pi/rlm/store.db` is git-tracked by default. Team knowledge compounds.

---

## Layer 2: Sub-LM Dispatch

### Design

The ms tool runs in pi's extension context. Pi provides `subagent()` for spawning child agents. We bridge this into the eval loop.

### API Surface

```typescript
// Single sub-LM call (async)
ms.llm(prompt: string, opts?: {
  model?: string,     // e.g. 'anthropic/claude-haiku-4-5'
  inject?: string[],  // stored object refs: 'collection:key'
  maxTokens?: number,
}): Promise<string>

// Parallel batch (async)
ms.llm_batch(prompts: Array<string | {
  prompt: string,
  model?: string,
  inject?: string[],
}>, opts?: {
  concurrency?: number,  // default: 3
}): Promise<string[]>
```

### Implementation

```typescript
// In api.ts — bridge to pi subagent
async function llmCall(
  pi: ExtensionAPI,
  prompt: string,
  opts: LlmOpts = {}
): Promise<string> {
  // Inject stored objects into prompt if requested
  let fullPrompt = prompt
  if (opts.inject?.length) {
    const injected = opts.inject.map(ref => {
      const [col, key] = ref.split(':')
      const obj = db.get(col, key)
      return obj ? `<context name="${ref}">\n${JSON.stringify(obj, null, 2)}\n</context>` : ''
    }).filter(Boolean).join('\n')
    fullPrompt = injected + '\n\n' + prompt
  }

  // Use pi's subagent infrastructure
  const result = await subagent({
    agent: 'default',  // or a custom lightweight agent
    task: fullPrompt,
    model: opts.model,
  })

  return result.text
}

// Batch: Promise.allSettled with concurrency limiter
async function llmBatch(
  pi: ExtensionAPI,
  prompts: LlmBatchInput[],
  opts: { concurrency?: number } = {}
): Promise<string[]> {
  const limit = opts.concurrency ?? 3
  const results: string[] = []

  for (let i = 0; i < prompts.length; i += limit) {
    const batch = prompts.slice(i, i + limit)
    const settled = await Promise.allSettled(
      batch.map(p => {
        const prompt = typeof p === 'string' ? p : p.prompt
        const pOpts = typeof p === 'string' ? {} : p
        return llmCall(pi, prompt, pOpts)
      })
    )
    results.push(...settled.map(r =>
      r.status === 'fulfilled' ? r.value : `[error: ${r.reason}]`
    ))
  }

  return results
}
```

### Safety

| Concern | Mitigation |
|---|---|
| Cost explosion | `maxCalls` config (default: 20 per ms invocation) |
| Timeout | Per-call timeout (default: 30s) |
| Token limit | `maxTokens` per sub-call (default: 4096) |
| Concurrency | Batch concurrency cap (default: 3) |
| Model selection | `sub_lm` default to cheap model (haiku) |

### Context Injection

Stored objects can be injected into sub-LM prompts via the `inject` parameter:

```javascript
const analysis = await ms.llm(
  'What breaks in v3 code given these schema changes?',
  { inject: ['research:schema-v4', 'decisions:v4-isolation'] }
)
// Sub-agent receives the stored objects as <context> blocks
// Root LM context stays clean — only sees the result string
```

This is the RLM pattern: root LM delegates context-heavy work to sub-LMs.

---

## Layer 3: Context & State

### `ms.context`

A lazily-loaded summary of project knowledge. The LM sees metadata (names, types, counts), not full content. Mirrors DSPy's `variables_info`.

```typescript
ms.context: {
  skills: { count: number, names: string[] },
  collections: Array<{ name: string, count: number }>,
  cwd: string,
  project: string,
}
```

Built on first access, cached for the eval duration.

### `ms.vars()`

List all persistent variables (stored objects) with metadata — not full content:

```typescript
ms.vars(): Array<{
  collection: string,
  key: string,
  type: string,       // typeof data
  size: number,       // JSON.stringify(data).length
  tags: string[],
  preview: string,    // first 120 chars of JSON
  updated: string,
}>
```

This is the equivalent of DSPy's `variables_info` — the LM decides what to `ms.get()` based on metadata.

### `ms.history()`

Returns the last N ms tool invocations from the current session (reconstructed from session entries):

```typescript
ms.history(n?: number): Array<{
  code: string,
  result: string,  // truncated
  timestamp: string,
}>
```

Mirrors DSPy's `REPLHistory`. Enables the LM to avoid re-running code and build on prior results.

**Implementation**: Uses `pi.appendEntry('ms-history', { code, result })` on each ms call. Reconstructed from `ctx.sessionManager.getBranch()` on session start.

---

## Tool Guide Updates

The tool guide (`tool-guide.ts`) gets a new section:

```
## PERSISTENT STATE (RLM)
ms.store(collection, key, data, tags?) — persist an object
ms.get(collection, key) — retrieve by key
ms.query(collection, filter?) — search by tags or JSON paths
ms.collections() — list all collections
ms.vars() — metadata of all stored objects (preview, not full content)

Pattern — store research findings for later sessions:
  ms.store('research', 'schema-v4', {
    finding: 'v4 removes _tag auto-gen',
    tags: ['effect-v4', 'breaking'],
  })

Pattern — retrieve across sessions:
  const findings = ms.query('research', { tags: 'effect-v4' })
  return { _v: 'tbl', d: findings }

## SUB-LM CALLS
ms.llm(prompt, opts?) — single sub-agent call (async)
ms.llm_batch(prompts, opts?) — parallel batch (async)

Pattern — partition + map (RLM):
  const chunks = splitContext(bigText, 4000)
  const analyses = await ms.llm_batch(
    chunks.map(c => `Analyze: ${c}`)
  )
  ms.store('research', 'analysis', { results: analyses })

PREFER ms.llm_batch over sequential ms.llm for bulk work.
PREFER inject over pasting stored objects into prompts.
```

---

## Steering Integration

New steering annotations for RLM operations:

| Condition | Icon | Annotation |
|---|---|---|
| `ms.store()` called | 📦 | `Stored {key} in {collection}` |
| `ms.llm()` called | 🤖 | `Sub-LM call: {prompt preview}` |
| Large collection (>50 objects) | 📊 | `Collection {name} has {n} objects — consider pruning` |
| No collections exist | 💡 | `No stored objects yet. Use ms.store() to persist findings.` |
| `ms.query()` returns 0 results | 🔍 | `No matches. Try broader tags or check ms.collections()` |

---

## File Plan

```
.pi/extensions/metaskill/
├── index.ts           ~ wire store + llm into ms API object
├── api.ts             ~ add store/get/query/llm/llm_batch functions
├── store.ts           + NEW: bun:sqlite persistence layer
├── llm-bridge.ts      + NEW: sub-LM dispatch via pi subagent
├── steer.ts           ~ add RLM steering annotations
├── RLM-SPEC.md        + this file

.pi/rlm/
├── store.db           + SQLite database (created on first ms.store)
├── .gitignore         + ignore WAL/SHM files
```

### Dependencies

- `bun:sqlite` — built into Bun, zero install
- Pi subagent API — already available via `subagent()` function tool
- Existing ms infrastructure — eval loop, primitives, steering, tool guide

### No New Dependencies

Everything is built on what's already there. No new npm packages. No new pi extensions. Just new functions on the existing `ms` API object.

---

## Implementation Order

### Phase 1: Persistent State (store.ts)

1. Create `store.ts` with `Database` wrapper
2. Add `ms.store()`, `ms.get()`, `ms.query()`, `ms.keys()`, `ms.delete()`, `ms.collections()`, `ms.clear()`
3. Wire into `api.ts` → `index.ts`
4. Auto-create `.pi/rlm/` directory and database on first store
5. Tests: unit tests for all CRUD + query operations
6. Update tool guide with PERSISTENT STATE section

### Phase 2: Context & State (context + vars + history)

1. Add `ms.context` (lazy property)
2. Add `ms.vars()` (metadata view of stored objects)
3. Add `ms.history()` with session entry persistence
4. Wire appendEntry on each ms call for history reconstruction
5. Tests: vars metadata, history reconstruction, context shape

### Phase 3: Sub-LM Dispatch (llm-bridge.ts)

1. Create `llm-bridge.ts` with `llmCall()` and `llmBatch()`
2. Add `ms.llm()` and `ms.llm_batch()` to API
3. Implement context injection (`inject` parameter)
4. Safety: call counter, timeout, concurrency cap
5. Tests: mock subagent calls, injection, batch concurrency
6. Update tool guide with SUB-LM CALLS section

### Phase 4: Steering + Polish

1. Add RLM steering annotations
2. Primitive rendering for stored objects (`ms.vars()` → `tbl`)
3. Update SKILL.md, GRAPH.md, CHANGELOG.md
4. E2E test: store → new session → retrieve → render

---

## DSPy Parity Map

| DSPy Feature | ms Implementation | Phase |
|---|---|---|
| `SUBMIT(output)` | `return { _v: '...', ... }` | ✅ exists |
| `llm_query(prompt)` | `ms.llm(prompt)` | Phase 3 |
| `llm_query_batched(prompts)` | `ms.llm_batch(prompts)` | Phase 3 |
| `variables_info` metadata | `ms.vars()` | Phase 2 |
| `REPLHistory` | `ms.history()` | Phase 2 |
| `CodeInterpreter` state persistence | `ms.store()/ms.get()` (across sessions!) | Phase 1 |
| `max_iterations` loop | Single-shot (each ms call = 1 iteration) | N/A — different model |
| `max_llm_calls` safety | Call counter per ms invocation | Phase 3 |
| Custom tools | `ms.*` API (24+ functions) | ✅ exists |
| Sandboxed execution | `new Function('ms', code)` | ✅ exists |

### Where We Exceed DSPy

| Feature | DSPy | ms + RLM |
|---|---|---|
| Cross-session persistence | ❌ state dies after forward() | ✅ bun:sqlite survives forever |
| Knowledge accumulation | ❌ cold start every call | ✅ compounds across sessions |
| Typed rendering | ❌ returns text | ✅ 12-type primitive system |
| Governance | ❌ none | ✅ health checks, steering, conformance |
| Git-trackable knowledge | ❌ ephemeral | ✅ .db committed to repo |
| Context injection | ❌ manual prompt construction | ✅ `inject: ['collection:key']` |
