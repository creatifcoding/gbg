## Target architecture (Emacs-first)

**Emacs mapping**

* **Buffer** = durable, shareable CRDT “document object” (content + arbitrary structured state).
* **Window** = a view onto a buffer (cursor/scroll/filters/mode state).
* **Frame** = a top-level container (one browser tab / app instance) holding a window layout.
* **Tab** = a named *window configuration* (layout + focused window + buffer set), not the buffer itself.

Key separation:

* **CRDT state (shared / durable):** buffer contents + buffer-local metadata.
* **UI state (per-user, often ephemeral):** window geometry, scroll, selection, local view prefs.

## Data layer: Buffer = “giant durable object”

### CRDT primitive

Use **Yjs** as the buffer substrate: it’s a high-performance CRDT with shared data types like `Map`/`Array` that merge without conflicts. ([Yjs Docs][1])

Recommended buffer shape (single `Y.Doc` per buffer):

* `root: Y.Map`

  * `meta: Y.Map` (title, tags, schemaVersion, createdAt, etc.)
  * `data: Y.Map` (arbitrary nested Yjs types; your hooks “mount” here)
  * `indexes: Y.Map` (optional, computed summaries if you *want* to replicate them)

### Sync + persistence (authoritative write path)

Use **Y-Sweet** as the sync + persistence backend for Yjs docs; it syncs edits across clients, supports presence/awareness, and persists documents (commonly to S3-compatible storage). ([Jamsocket][2])

That gives you:

* realtime collaboration (multiple clients)
* background persistence
* “presence” channels (cursor, selection, etc.)

## “Live queryable documents” in a lake

Treat the CRDT log as the *source of truth*, then project to analytics-friendly forms.

### Reliable stream for replay + materialization

Use an **ordered, replayable stream** of buffer updates to feed your warehouse/lake pipeline. Electric’s newly published **Durable Streams** protocol is explicitly about ordered, replayable streams with resumable offsets (catch-up + tail). ([GitHub][3])

Pipeline sketch:

1. **Buffer updates** (Yjs updates) → append to a durable stream (per-buffer or per-workspace).
2. Stream processor projects:

   * snapshots (periodic full doc state)
   * derived tables (entities extracted from the CRDT)
   * parquet/iceberg partitions (event-time, bufferId, schemaVersion, etc.)

### Where ElectricSQL fits

Electric is a Postgres sync engine focused on syncing subsets of Postgres data into local apps (read-path sync). ([ElectricSQL][4])
Electric also explicitly documents Yjs integrations/providers. ([ElectricSQL][5])

Practical hybrid:

* **Write path:** Yjs ↔ Y-Sweet (collab + persistence).
* **Read/query path:** derived Postgres tables ↔ Electric (reactive queries into the app).
* If you want “inspectors” that query the lake, you can surface them either via Postgres/Electric or via your own query service over Iceberg.

## Session + orchestration (Rivet)

Use **Rivet actors** as the long-lived session/workspace control-plane:

* workspace registry (which buffers are open, permissions, routing)
* derived-index computation (search indexes, embeddings, schema validators)
* “command server” for multi-user operations (rename buffer, fork buffer, publish snapshot, etc.)

Rivet positions itself as durable, long-lived in-memory actors with persistence/hibernation and realtime patterns. ([Rivet][6])

## React architecture: buffers/tabs/windows/frames

### State model

* **CRDT Store** (buffer state): external to React; React subscribes.
* **Workspace Store** (frames/tabs/windows): local store (Zustand/Jotai/XState—any works).
* **Command system**: Emacs-like “M-x”, keymaps, modes.

Suggested domain types (TS sketch)

```ts
type BufferId = string;
type WindowId = string;
type FrameId = string;
type TabId = string;

interface BufferHandle {
  id: BufferId;
  ydoc: import("yjs").Doc;
  // provider/awareness live here (YSweetProvider or equivalent)
  dispose(): void;
}

interface WindowState {
  id: WindowId;
  bufferId: BufferId;
  view: {
    cursor?: unknown;
    selection?: unknown;
    scroll?: { x: number; y: number };
    modeId?: string; // “major mode”
    paneState?: Record<string, unknown>; // arbitrary local view state
  };
}

interface TabState {
  id: TabId;
  name: string;
  // saved layout + focused window, referencing windows/buffers
  layout: unknown;
  focusedWindowId: WindowId;
}

interface FrameState {
  id: FrameId;
  tabs: TabState[];
  activeTabId: TabId;
}
```

### Hook/mount system (your “caller hooks and inspection” requirement)

Define a **Buffer Extension API**: packages can “mount” into a buffer’s `root.get("data")` subtree and add inspectors/panels.

* `registerMode(mode)` — renderer + keymap + commands
* `registerInspector(inspector)` — read-only panels driven by Electric queries or CRDT-derived selectors
* `registerBufferExtension(ext)` — allocates a stable Yjs path + migrations

Pattern:

* extensions get a `BufferContext` with `ydoc`, `root`, and a typed allocator: `ctx.mount("my.ext", schema)`

### Window layout + docking

Implement Emacs-style tiling first (splits), then optional “floating windows” later.

* Maintain layout as a pure tree (`Split(horizontal|vertical, a, b) | Leaf(windowId)`).
* Render with CSS Grid/Flex + draggable splitters.
* Tabs are *saved trees*.

## Minimal implementation plan (fast path)

1. **Core UI**

   * Frame → Tabs → Window layout (splits)
   * “Current buffer/current window” focus model
   * Command palette + keymap dispatch

2. **CRDT buffers**

   * Yjs doc per buffer
   * Y-Sweet provider connect/disconnect
   * Basic buffer ops: create/open/close/rename/fork

3. **Inspectors**

   * CRDT-only inspectors first (structure browser, meta editor, presence view)
   * Then derived-query inspectors (Postgres/Electric or lake query service)

4. **Materialization**

   * Stream Yjs updates into an ordered log (durable streams style)
   * Periodic snapshots + derived tables → Iceberg/Parquet

If you want, I can provide:

* a concrete “Buffer Extension” interface (typed mount points + migrations),
* an Emacs-like command/keymap resolver design,
* and a reference React component tree + store wiring that supports split windows + tabs without re-render storms.

[1]: https://docs.yjs.dev/?utm_source=chatgpt.com "Yjs Docs: Introduction"
[2]: https://docs.jamsocket.com/y-sweet?utm_source=chatgpt.com "Y-Sweet"
[3]: https://github.com/durable-streams/durable-streams?utm_source=chatgpt.com "durable-streams/durable-streams: The open protocol for ..."
[4]: https://electric-sql.com/?utm_source=chatgpt.com "ElectricSQL"
[5]: https://electric-sql.com/docs/integrations/yjs?utm_source=chatgpt.com "Yjs - Integrations"
[6]: https://www.rivet.dev/?utm_source=chatgpt.com "Rivet - Stateful Backends. Finally Solved."
