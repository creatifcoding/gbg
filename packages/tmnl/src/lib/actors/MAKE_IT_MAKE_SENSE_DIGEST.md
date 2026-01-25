# Actors Library — Make It Make Sense

> **TL;DR**: Emacs-style workspace management for the browser. Buffers are pointers to content, Windows are views into buffers, Tabs are layouts of windows.

## What Problem Does This Solve?

Managing multiple documents, terminals, and panels in a web app — with:
- **Shared state** across components (buffer registry)
- **Per-user isolation** (session state)
- **Persistence** across page reloads (SQLite WASM)
- **Reference counting** (auto-cleanup when nothing uses a buffer)

---

## Core Concepts

### Buffer = Pointer, Not Content

A buffer is **metadata pointing to content that lives elsewhere**. It's a handle, not the data.

```typescript
BufferType = 'document' | 'terminal' | 'webview' | 'widget' | 'canvas'

BufferMeta = {
  id: BufferId,
  type: BufferType,           // WHAT kind of thing
  name: string,               // Display name ("Untitled.md")
  uri: string,                // WHERE the content lives
  ysweetDocId?: string,       // → Y-Sweet collaborative doc
  documentId?: string,        // → Some other doc system
  filePath?: string,          // → Local file reference
}
```

| Type | Points To | Example |
|------|-----------|---------|
| `document` | Y-Sweet CRDT doc | A collaborative markdown file |
| `terminal` | Terminal session | PTY via Tauri backend |
| `webview` | Embedded iframe | External URL or local HTML |
| `widget` | React component | Settings panel, file browser |
| `canvas` | tldraw / ReactFlow | Diagram, whiteboard |

### Window = View Into a Buffer

A window is a **viewport** with its own scroll position, cursor, and mode.

```typescript
SessionWindow = {
  id: WindowId,
  bufferId: BufferId,         // Which buffer this window shows
  scroll: { x, y },           // Scroll position
  cursor?: { offset, line },  // Cursor position
  mode: { major, minor[] },   // Editor mode (e.g., "markdown", ["spell-check"])
  isFocused: boolean,
}
```

**Key insight**: Multiple windows can view the same buffer with different scroll/cursor positions.

### Tab = Layout Container

A tab is a **pane layout** containing windows.

```typescript
SessionTab = {
  id: TabId,
  name: string,               // "Main", "Research", etc.
  layout: PaneNode,           // Tree structure of panes
  activeWindowId: WindowId,   // Which window has focus
  isPinned: boolean,
  order: number,
}
```

### Session = User's State

A session is a **per-user collection** of tabs and windows.

```typescript
SessionState = {
  tabs: Record<TabId, SessionTab>,
  windows: Record<WindowId, SessionWindow>,
  activeTabId: TabId,
  focusedWindowId: WindowId,
  tabOrder: TabId[],
}
```

---

## Visual Model

```
┌─────────────────────────────────────────────────────────┐
│  Tab "Research" (layout container)                      │
│  ┌─────────────────────┬─────────────────────┐          │
│  │ Window A            │ Window B            │          │
│  │ bufferId: "buf-1"   │ bufferId: "buf-1"   │ ← Same buffer!
│  │ scroll: {x:0, y:50} │ scroll: {x:0, y:200}│ ← Different scroll
│  │ cursor: line 10     │ cursor: line 45     │ ← Different cursor
│  └─────────────────────┴─────────────────────┘          │
└─────────────────────────────────────────────────────────┘

Buffer "buf-1" (in WorkspaceService):
{
  type: 'document',
  uri: 'ydoc://abc123',
  ysweetDocId: 'abc123',
  refCount: 2,              ← Two windows have it open
  openedBy: ['user-1']
}
```

---

## Architecture

```
ActorProvider (React context + Effect ManagedRuntime)
     │
     ├── WorkspaceService (global buffer registry)
     │     ├── Ref<WorkspaceState>    ← Effect state
     │     ├── Atom<WorkspaceState>   ← React binding
     │     └── PubSub<WorkspaceEvent> ← Event stream
     │
     ├── SessionServiceFactory.forUser(userId)
     │     ├── Per-user state isolation
     │     └── Cached instances
     │
     └── ActorPersistence (SQLite WASM)
           └── actor_state table (key/value JSON)
```

---

## Usage (Intended)

```tsx
// In a component
function DocumentManager() {
  const { createBuffer, openBuffer, closeBuffer } = useWorkspace()
  const { createTab, createWindow, setActiveTab } = useSession({ userId })

  const handleOpenDocument = async (ysweetDocId: string) => {
    // Create or get existing buffer
    const buffer = await createBuffer(
      userId,
      'document',
      'My Document',
      `ydoc://${ysweetDocId}`,
      { ysweetDocId }
    )

    // Create a window viewing this buffer
    const window = await createWindow(buffer.id)

    // Or open in existing window (increments refCount)
    await openBuffer(userId, buffer.id)
  }
}
```

---

## Current Status (2026-01)

| Aspect | Status |
|--------|--------|
| Services | ✅ Complete (WorkspaceService, SessionService) |
| Schemas | ✅ Complete (Effect Schema with branded types) |
| Persistence | ✅ Complete (SQLite WASM) |
| React hooks | ✅ Complete (useWorkspace, useSession) |
| **Actual usage** | ❌ **None** — mounted but no consumers |
| Tests | ⚠️ Stubs only |

**The library is infrastructure waiting for features to plug into it.**

---

## Files Reference

| File | Purpose |
|------|---------|
| `index.ts` | Public API exports |
| `components/ActorProvider.tsx` | React provider (Effect runtime) |
| `services/WorkspaceService.ts` | Buffer registry |
| `services/SessionService.ts` | Tab/window state |
| `services/ActorPersistence.ts` | SQLite WASM layer |
| `schemas/index.ts` | Effect Schema definitions |
| `hooks/useWorkspace.ts` | Workspace React hook |
| `hooks/useSession.ts` | Session React hook |

---

## Relationship to Emacs

| Emacs | TMNL Actors |
|-------|-------------|
| Buffer | `BufferMeta` — shared, ref-counted |
| Window | `SessionWindow` — view with scroll/cursor |
| Tab | `SessionTab` — pane layout |
| Frame | (not implemented — could be browser window) |
| `C-x b` | `openBuffer()` |
| `C-x 2` | Split → create new window, same buffer |
| `C-x k` | `closeBuffer()` → decrements refCount |

---

## Why "Actors"?

Originally built on RivetKit (actor model library). Migrated to pure Effect services but kept the name. The "actor" concept maps to:
- **WorkspaceService** = Workspace actor (global state)
- **SessionService** = Session actor (per-user state)

The actor model's message-passing is now Effect's PubSub streams.
