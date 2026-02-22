# GetByShell IDE — Architectural Brief

> **Codename**: NATIVE EDITOR
> **Status**: Architecture Phase
> **Owner**: Val (architecture)
> **Date**: 2026-02-21
> **EDIN Phase**: Design
> **Revision**: 2 — Theia eliminated. Effect-native LSP layer.

---

## 1. Vision

**"I want my own damn Cursor."**

A native code editor embedded directly into the TMNL Tauri desktop app — not as a separate process, not as an iframe, not as a port-forwarded web app. Monaco Editor runs as a first-class React component inside the existing TMNL shell, themed with the VANTA design system, animated with the TMNL animation library, managed by Effect-TS atoms.

Language servers (typescript-language-server, rust-analyzer, pyright) run as child processes managed by an **Effect-native LSP service layer**. No Theia. No Inversify. No Socket.io. The LSP bridge is an Effect `HttpRouter` with `RpcServer.layerProtocolWebsocket` — JSON-RPC over WebSocket, with fiber-supervised process lifecycles and `Scope`-based cleanup.

Vim mode via `monaco-vim`. Filesystem via Tauri's native FS plugin. Everything else is Effect.

### Design Principles

1. **TMNL is the host** — Monaco is a component, not a shell
2. **VANTA is the aesthetic** — Void-black surfaces, cyan phosphor accents, monospace precision
3. **Effect-TS is everything** — State (atoms), services (Effect.Service), transport (HttpRouter), process management (fibers + Scope)
4. **No middleware frameworks** — No Theia, no Express, no Socket.io. Effect `HttpServer` handles all backend concerns
5. **The bar is the anchor** — GetByShell's machined-aluminum bar remains the primary navigation surface
6. **Language servers are child processes** — Spawned via `@effect/platform`, stdio piped through JSON-RPC, proxied to WebSocket

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    TMNL Tauri Desktop App (THE HOST)                  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │               React + Effect-TS + VANTA Design System          │  │
│  │                                                                 │  │
│  │  ┌──────────┐  ┌──────────────────────┐  ┌─────────────────┐  │  │
│  │  │GetByShell│  │   Monaco Editor       │  │  tldraw Canvas  │  │  │
│  │  │  Bar     │  │   (@typefox/          │  │  / AG-Grid      │  │  │
│  │  │  (48px)  │  │    monaco-editor-     │  │  Data Surface   │  │  │
│  │  │          │  │    react)             │  │                 │  │  │
│  │  │ ┌──────┐ │  │                       │  │                 │  │  │
│  │  │ │Clock │ │  │  ┌─────────────────┐  │  │                 │  │  │
│  │  │ │Status│ │  │  │ VANTA Syntax    │  │  │                 │  │  │
│  │  │ │Net   │ │  │  │ Theme           │  │  │                 │  │  │
│  │  │ │Wspc  │ │  │  └─────────────────┘  │  │                 │  │  │
│  │  │ └──────┘ │  │  ┌─────────────────┐  │  │                 │  │  │
│  │  │          │  │  │ monaco-vim      │  │  │                 │  │  │
│  │  │          │  │  └─────────────────┘  │  │                 │  │  │
│  │  └──────────┘  └───────────┬───────────┘  └─────────────────┘  │  │
│  │                            │                                    │  │
│  │  ┌─────────────────────────┴────────────────────────────────┐  │  │
│  │  │  TMNL Bottom Panel                                        │  │  │
│  │  │  • Agent chat (RVN)     • Terminal     • Diagnostics      │  │  │
│  │  └─────────────────────────┬────────────────────────────────┘  │  │
│  └────────────────────────────┼──────────────────────────────────┘  │
│                               │                                      │
│                               │  WebSocket (raw WS + JSON-RPC)       │
│                               ▼                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │        Effect-Native LSP Service Layer (Node.js/Bun)           │  │
│  │                                                                 │  │
│  │  ┌───────────────────────────────────────────────────────────┐ │  │
│  │  │  Effect HttpRouter + RpcServer.layerProtocolWebsocket     │ │  │
│  │  │                                                            │ │  │
│  │  │  GET /ws/lsp/:language  →  WebSocket upgrade               │ │  │
│  │  │       └─ JSON-RPC bidirectional channel                    │ │  │
│  │  │       └─ StreamMessageReader/Writer ↔ child process stdio  │ │  │
│  │  │                                                            │ │  │
│  │  │  GET /healthcheck       →  200 OK                          │ │  │
│  │  └───────────────────────────────────────────────────────────┘ │  │
│  │                                                                 │  │
│  │  ┌───────────────────────────────────────────────────────────┐ │  │
│  │  │  LspProcessManager (Effect.Service)                       │ │  │
│  │  │                                                            │ │  │
│  │  │  ┌─────────────────┐ ┌──────────────┐ ┌───────────────┐  │ │  │
│  │  │  │ typescript-     │ │ rust-        │ │ pyright       │  │ │  │
│  │  │  │ language-server │ │ analyzer     │ │               │  │ │  │
│  │  │  │ --stdio         │ │ (stdio)      │ │ --stdio       │  │ │  │
│  │  │  └────────┬────────┘ └──────┬───────┘ └───────┬───────┘  │ │  │
│  │  │           │                 │                  │           │ │  │
│  │  │     stdin/stdout       stdin/stdout       stdin/stdout     │ │  │
│  │  │     (JSON-RPC)         (JSON-RPC)         (JSON-RPC)      │ │  │
│  │  │                                                            │ │  │
│  │  │  Lifecycle: Effect.Scope → auto-kill on disconnect         │ │  │
│  │  │  Supervision: Fiber per process, restart on crash          │ │  │
│  │  │  Pooling: One process per language, shared across tabs     │ │  │
│  │  └───────────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │            Tauri Rust Backend                                   │  │
│  │                                                                 │  │
│  │  • Native filesystem access (Tauri FS plugin)                  │  │
│  │  • Window management (transparent, frameless)                  │  │
│  │  • System tray integration                                     │  │
│  │  • Spawns Effect LSP service (or it runs in-process via Bun)   │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Why No Theia

| Theia Provided | Effect-Native Replacement | Notes |
|---|---|---|
| Socket.io transport | `HttpRouter` + `request.upgradeChannel()` | Native WebSocket, no Socket.io overhead |
| JSON-RPC messaging | `@effect/rpc` + `RpcSerialization.layerJsonRpc()` | Type-safe, fiber-supervised |
| LSP server spawning | `@effect/platform` `Command.make()` | Child process with `StreamMessageReader/Writer` |
| Process lifecycle | `Effect.Scope` + fiber supervision | Auto-cleanup, restart policies |
| Filesystem service | **Tauri native FS plugin** | Already in the Tauri app |
| .vsix extension host | `monaco-vim` (vim), direct LSP (languages) | Skip .vsix entirely |
| Inversify DI | Effect `Context.Tag` + `Layer` | Already the project standard |
| Express HTTP server | Effect `HttpServer` | Already a dependency |

---

## 3. Package Topology

### `packages/tmnl` (THE HOST — everything lives here)

New dependencies:

| Package | Purpose |
|---|---|
| `@typefox/monaco-editor-react` | React wrapper for Monaco with LSP client lifecycle |
| `monaco-languageclient` | LSP client + worker factory |
| `vscode-ws-jsonrpc` | JSON-RPC over WebSocket transport (frontend side) |
| `monaco-editor` | Core Monaco editor (peer dep) |
| `monaco-vim` | Vim keybindings for Monaco (standalone, no .vsix) |
| `@effect/rpc` | JSON-RPC server for LSP proxy (if not already present) |
| `vscode-languageserver-protocol` | LSP type definitions |
| `vscode-jsonrpc` | `StreamMessageReader/Writer` for child process stdio |

New source files:

```
src/lib/editor/
├── index.ts                      # Public exports
├── atoms.ts                      # Effect-atom state: tabs, active doc, editor config
├── schemas.ts                    # Effect.Schema types: EditorTab, DocumentState, LspStatus
├── TmnlEditor.tsx                # Main editor surface — wraps MonacoEditorReactComp
├── TmnlEditorTabs.tsx            # Custom VANTA-styled tab bar
├── TmnlEditorStatusLine.tsx      # Custom status line (cursor pos, language, encoding)
├── theme/
│   ├── vanta-monaco-theme.ts     # Monaco defineTheme() with VANTA_COLORS
│   └── vanta-syntax-tokens.ts    # TextMate token colors (syntax highlighting)
└── lsp/
    ├── connection.ts             # WebSocket connection factory to Effect LSP service
    └── config.ts                 # LanguageClientConfig builders per language

src/lib/lsp-service/
├── index.ts                      # Public exports
├── LspProcessManager.ts          # Effect.Service — spawns/pools/supervises language servers
├── LspRouter.ts                  # Effect HttpRouter — /ws/lsp/:language endpoint
├── LspBridge.ts                  # stdio ↔ WebSocket bridge (StreamMessageReader/Writer)
├── schemas.ts                    # Effect.Schema: LspServerConfig, LspProcessState
└── servers/
    ├── typescript.ts             # Config for typescript-language-server --stdio
    ├── rust.ts                   # Config for rust-analyzer (stdio)
    └── python.ts                 # Config for pyright --stdio
```

### `packages/theia-ide` (DEPRECATED — archival only)

The Theia package is no longer needed. It may be kept as a reference or removed entirely.
All capabilities it provided are replaced by:

| Former Theia Role | Replacement |
|---|---|
| LSP routing | `src/lib/lsp-service/LspRouter.ts` (Effect HttpRouter) |
| Process management | `src/lib/lsp-service/LspProcessManager.ts` (Effect fibers + Scope) |
| Filesystem | Tauri native FS plugin (`@tauri-apps/plugin-fs`) |
| .vsix extensions | `monaco-vim` for vim; direct LSP for language intelligence |
| Settings/preferences | Effect atoms (`editorConfigAtom`) |
| Document model | Monaco's native `TextModel` + atom state |

---

## 4. Communication Protocol

### Transport Layer

**Raw WebSocket + JSON-RPC.** No Socket.io. No Express. Effect `HttpRouter` handles
the WebSocket upgrade, `@effect/rpc` handles JSON-RPC serialization.

```
TMNL Frontend (Tauri WebView)           Effect LSP Service (Node/Bun)
──────────────────────────────          ─────────────────────────────
MonacoEditorReactComp                   Effect HttpRouter
  │                                       │
  ├─ LanguageClientWrapper                ├─ GET /ws/lsp/typescript
  │    └─ WebSocket JSON-RPC ──────────▶  │    └─ upgradeChannel()
  │                                       │    └─ StreamMessageReader/Writer
  │                                       │    └─ ↔ typescript-language-server --stdio
  │                                       │
  ├─ (same pattern per language)          ├─ GET /ws/lsp/rust
  │                                       │    └─ ↔ rust-analyzer
  │                                       │
  └─ Health check                         └─ GET /healthcheck → 200 OK

File operations: Tauri FS plugin (invoke from frontend, no backend proxy needed)
Vim mode: monaco-vim (frontend only, no backend component)
```

### The Effect LSP Bridge (core primitive)

```typescript
// Pseudocode — the central pattern
const LspBridge = Effect.gen(function* () {
  const process = yield* Command.make('typescript-language-server', '--stdio').pipe(
    Command.start
  )

  const reader = new StreamMessageReader(process.stdout)
  const writer = new StreamMessageWriter(process.stdin)

  // WebSocket ← → stdio bidirectional pipe
  yield* Stream.fromReadableStream(websocket)
    .pipe(
      Stream.tap((msg) => Effect.sync(() => writer.write(JSON.parse(msg)))),
      Stream.runDrain
    )
    .pipe(Effect.fork)  // stdio→ws direction runs on separate fiber

  yield* Stream.fromCallback((emit) => {
    reader.listen((msg) => emit(JSON.stringify(msg)))
  }).pipe(
    Stream.tap((msg) => Effect.sync(() => websocket.send(msg))),
    Stream.runDrain
  )
})
```

### Initialization Sequence (CRITICAL ORDER)

```
 1. Tauri app starts
 2. Effect LSP service starts on :3035 (in-process Bun, or Tauri-spawned Node)
 3. TMNL React app mounts
 4. MonacoVscodeApiWrapper.init()          ← MUST be first, before editor
 5. VANTA Monaco theme registered           ← defineTheme() with VANTA_COLORS
 6. monaco-vim activated                    ← initVimMode(editor, statusBarElement)
 7. MonacoEditorReactComp renders
 8. LanguageClientWrapper connects           ← ws://localhost:3035/ws/lsp/typescript
 9. LSP service spawns typescript-language-server --stdio (if not already running)
10. JSON-RPC flows: Monaco ↔ WebSocket ↔ stdio ↔ language server
11. File tree loaded via Tauri FS plugin     ← invoke('read_dir', { path })
12. User has full LSP + vim + filesystem — inside TMNL's native shell
```

---

## 5. State Management

All editor state lives in Effect-TS atoms. **Not** Inversify. **Not** React useState.

### Atom Topology

```typescript
// ─── Document State ─────────────────────────────────────────
const EditorTab = Schema.TaggedStruct('EditorTab', {
  id:       Schema.String,
  uri:      Schema.String,           // file:///workspace/src/main.ts
  language: Schema.String,           // typescript, rust, python
  label:    Schema.String,           // main.ts
  dirty:    Schema.Boolean,
  pinned:   Schema.Boolean,
})

const EditorState = Schema.Struct({
  tabs:      Schema.Array(EditorTab),
  activeTab: Schema.NullOr(Schema.String),  // tab id
  layout:    Schema.Literal('single', 'split-h', 'split-v'),
})

// ─── Atoms ──────────────────────────────────────────────────
const editorStateAtom    = Atom.make<EditorState>({ tabs: [], activeTab: null, layout: 'single' })
const activeDocumentAtom = Atom.make((get) => {
  const state = get(editorStateAtom)
  return state.tabs.find(t => t.id === state.activeTab) ?? null
})

// ─── Operations (atom mutations, not service methods) ───────
const openTab    = (uri: string, language: string) => Atom.update(editorStateAtom, ...)
const closeTab   = (id: string) => Atom.update(editorStateAtom, ...)
const setActive  = (id: string) => Atom.set(editorStateAtom, ...)
const markDirty  = (id: string) => Atom.update(editorStateAtom, ...)

// ─── LSP Connection State ───────────────────────────────────
const LspStatus = Schema.Literal('disconnected', 'connecting', 'connected', 'error')
const lspStatusAtom = Atom.make<LspStatus>('disconnected')
```

---

## 6. VANTA Monaco Theme

The Monaco syntax theme is defined using `monaco.editor.defineTheme()` with VANTA design tokens. This replaces Theia's `ColorContribution` approach.

### Color Mapping

```typescript
import * as monaco from 'monaco-editor'
import { VANTA_COLORS } from '@/components/portal/tokens'

monaco.editor.defineTheme('vanta-void', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    // ─── Syntax ────────────────────────────────────
    { token: 'comment',        foreground: '525252', fontStyle: 'italic' },
    { token: 'keyword',        foreground: '22d3ee' },  // cyan
    { token: 'string',         foreground: '34d399' },  // emerald
    { token: 'number',         foreground: 'fbbf24' },  // amber
    { token: 'type',           foreground: 'a78bfa' },  // violet
    { token: 'function',       foreground: 'e5e5e5' },  // primary text
    { token: 'variable',       foreground: 'a3a3a3' },  // secondary text
    { token: 'operator',       foreground: '737373' },  // tertiary
    { token: 'delimiter',      foreground: '525252' },  // muted
    { token: 'tag',            foreground: 'fb7185' },  // rose
    { token: 'attribute.name', foreground: '22d3ee' },  // cyan
    { token: 'attribute.value',foreground: '34d399' },  // emerald
    // ─── Special ───────────────────────────────────
    { token: 'regexp',         foreground: 'fb7185' },  // rose
    { token: 'annotation',     foreground: 'fbbf24' },  // amber
    { token: 'constant',       foreground: 'a78bfa' },  // violet
  ],
  colors: {
    // ─── Editor Chrome ─────────────────────────────
    'editor.background':                '#000000',  // void
    'editor.foreground':                '#e5e5e5',  // primary text
    'editor.lineHighlightBackground':   '#0a0a0a',  // elevated
    'editor.selectionBackground':       'rgba(34, 211, 238, 0.15)',  // cyanGlow
    'editor.inactiveSelectionBackground':'rgba(34, 211, 238, 0.08)',
    'editorCursor.foreground':          '#22d3ee',  // cyan
    'editorLineNumber.foreground':      '#525252',  // muted
    'editorLineNumber.activeForeground':'#a3a3a3',  // secondary
    'editorIndentGuide.background':     '#0f0f0f',
    'editorIndentGuide.activeBackground':'#1a1a1a',
    'editorWhitespace.foreground':      '#525252',

    // ─── Gutter ────────────────────────────────────
    'editorGutter.background':          '#000000',
    'editorGutter.modifiedBackground':  '#fbbf24',  // amber
    'editorGutter.addedBackground':     '#34d399',  // emerald
    'editorGutter.deletedBackground':   '#fb7185',  // rose

    // ─── Widgets (autocomplete, hover, etc.) ───────
    'editorWidget.background':          '#030303',
    'editorWidget.border':              '#1a1a1a',
    'editorSuggestWidget.background':   '#030303',
    'editorSuggestWidget.border':       '#1a1a1a',
    'editorSuggestWidget.highlightForeground': '#22d3ee',
    'editorSuggestWidget.selectedBackground':  'rgba(34, 211, 238, 0.15)',
    'editorHoverWidget.background':     '#030303',
    'editorHoverWidget.border':         '#1a1a1a',

    // ─── Minimap (disabled but themed) ─────────────
    'minimap.background':               '#000000',

    // ─── Scrollbar ─────────────────────────────────
    'scrollbar.shadow':                 'transparent',
    'scrollbarSlider.background':       'rgba(255, 255, 255, 0.10)',
    'scrollbarSlider.hoverBackground':  'rgba(255, 255, 255, 0.15)',
    'scrollbarSlider.activeBackground': 'rgba(255, 255, 255, 0.20)',
  },
})
```

### Editor Options (TMNL Defaults)

```typescript
const TMNL_EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  theme: 'vanta-void',
  fontFamily: '"Share Tech Mono", "JetBrains Mono", "Fira Code", monospace',
  fontSize: 13,
  lineHeight: 1.6,
  letterSpacing: 0.3,
  cursorStyle: 'block',
  cursorBlinking: 'phase',
  cursorSmoothCaretAnimation: 'on',
  smoothScrolling: true,
  minimap: { enabled: false },
  renderLineHighlight: 'gutter',
  scrollBeyondLastLine: false,
  padding: { top: 12, bottom: 12 },
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  renderWhitespace: 'none',
  guides: {
    indentation: true,
    bracketPairs: true,
  },
  bracketPairColorization: {
    enabled: true,
    independentColorPoolPerBracketType: true,
  },
}
```

---

## 7. Component Architecture

### `<TmnlEditor />` — Main Editor Surface

```tsx
// Simplified — actual implementation uses Effect atoms
function TmnlEditor() {
  return (
    <div className="tmnl-editor" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TmnlEditorTabs />                    {/* Custom VANTA tab bar */}
      <div style={{ flex: 1 }}>
        <MonacoEditorReactComp
          vscodeApiConfig={vscodeApiConfig}
          editorAppConfig={editorAppConfig}
          languageClientConfig={lspConfig}
          style={{ height: '100%' }}
          onError={handleError}
        />
      </div>
      <TmnlEditorStatusLine />              {/* Custom status line */}
    </div>
  )
}
```

### `<TmnlEditorTabs />` — Custom Tab Bar

VANTA-styled tabs with:
- Machined groove dividers (same as BarLayout)
- Dirty indicator: pulsing amber dot
- Active tab: cyan top-border glow
- Close button: rose on hover
- Drag reorder (native HTML5 drag)
- Phosphor trace on active tab

### `<TmnlEditorStatusLine />` — Custom Status Line

Replaces Theia's status bar. Shows:
- Cursor position (Ln/Col)
- Language mode
- Encoding (UTF-8)
- LSP status indicator (phosphor green = connected, amber = connecting, rose = error)
- Indent mode (spaces/tabs)
- File size

---

## 8. Effect-Native LSP Service

The LSP service is a pure Effect program. No frameworks. No Theia.

### Service Definition

```typescript
// LspProcessManager.ts — Effect.Service
class LspProcessManager extends Context.Tag('tmnl/LspProcessManager')<
  LspProcessManager,
  {
    readonly spawn: (language: string) => Effect.Effect<LspProcess, LspError>
    readonly get:   (language: string) => Effect.Effect<Option.Option<LspProcess>>
    readonly kill:  (language: string) => Effect.Effect<void>
    readonly killAll: Effect.Effect<void>
  }
>() {}

// Internal state: one process per language, pooled
// Atom.make<Map<string, LspProcess>>() — the process registry
```

### Router Definition

```typescript
// LspRouter.ts — Effect HttpRouter
const LspRouter = HttpRouter.empty.pipe(
  HttpRouter.get('/healthcheck',
    Effect.succeed(HttpServerResponse.json({ status: 'ok', timestamp: Date.now() }))
  ),
  HttpRouter.get('/ws/lsp/:language',
    Effect.gen(function* () {
      const params = yield* HttpRouter.params
      const language = params.language  // "typescript", "rust", "python"
      const manager = yield* LspProcessManager
      const process = yield* manager.spawn(language)

      // WebSocket upgrade → bidirectional JSON-RPC bridge
      yield* Stream.empty.pipe(
        Stream.pipeThroughChannel(HttpServerRequest.upgradeChannel()),
        // ... bridge logic
      )

      return HttpServerResponse.empty()
    })
  ),
)
```

### Server Configs

```typescript
// servers/typescript.ts
const TypeScriptServer: LspServerConfig = {
  language: 'typescript',
  command: 'typescript-language-server',
  args: ['--stdio'],
  fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
  initializationOptions: {
    preferences: { includeInlayParameterNameHints: 'all' }
  },
}

// servers/rust.ts
const RustServer: LspServerConfig = {
  language: 'rust',
  command: 'rust-analyzer',
  args: [],
  fileExtensions: ['.rs'],
}

// servers/python.ts
const PythonServer: LspServerConfig = {
  language: 'python',
  command: 'pyright-langserver',
  args: ['--stdio'],
  fileExtensions: ['.py'],
}
```

### Process Lifecycle (Effect.Scope)

```typescript
// Each language server runs in a Scope
// When the last WebSocket client disconnects → Scope finalizer kills the process
// If the process crashes → fiber supervisor restarts it (with backoff)

const spawnLsp = (config: LspServerConfig) =>
  Effect.acquireRelease(
    // Acquire: spawn the process
    Command.make(config.command, ...config.args).pipe(
      Command.start,
      Effect.tap(() => Effect.log(`[LSP] Spawned ${config.language}`)),
    ),
    // Release: kill the process
    (process) => Effect.sync(() => {
      process.kill('SIGTERM')
      Effect.log(`[LSP] Killed ${config.language}`)
    })
  )
```

### Health Check

The Tauri frontend (or Rust backend) checks readiness:

```
GET http://localhost:3035/healthcheck → 200 { status: "ok", languages: ["typescript", "rust"] }
```

---

## 9. Process Architecture Options

Two viable models for running the Effect LSP service:

### Option A: Bun In-Process (Preferred for Dev)

The Effect LSP service runs inside the same Bun process as the Vite dev server.
Zero process management. Language servers are the only child processes.

```
Tauri WebView
  → loads http://localhost:1420 (Vite dev server, Bun)
  → Monaco connects to ws://localhost:3035/ws/lsp/typescript
  → Effect HttpServer on :3035 (same Bun process, separate port)
  → Spawns typescript-language-server --stdio as child process
```

### Option B: Tauri-Spawned Sidecar (Production)

The Effect LSP service is a bundled Node/Bun script that Tauri spawns as a sidecar.

```rust
// src-tauri/src/lsp_manager.rs
fn spawn_lsp_service() -> Child {
    Command::new("bun")
        .args(["run", "dist/lsp-service.js",
               "--port=3035"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("Failed to start LSP service")
}
```

### Option C: Tauri IPC Direct (Future — Zero WebSocket)

Skip WebSocket entirely. Language server stdio pipes through Tauri's Rust backend.
Monaco uses a custom `connectionProvider` that calls `invoke('lsp_send', { language, message })`.

```
Monaco → invoke('lsp_send') → Rust → child process stdin
         invoke('lsp_recv') ← Rust ← child process stdout
```

This eliminates the WebSocket hop entirely but requires a custom `monaco-languageclient`
connection provider. Documented here as a future optimization.

### Lifecycle

```
Tauri app start
  → Effect LSP service starts (in-process or sidecar)
  → React app mounts
  → Monaco connects to ws://localhost:3035/ws/lsp/:language
  → Language servers spawn on-demand (first connection per language)

Tauri app close
  → Effect.Scope finalizers fire
  → All language server child processes SIGTERM'd
  → Clean shutdown, no orphans
```

---

## 10. Migration Plan

### Phase 1: Monaco in TMNL (standalone, no LSP)

**Goal**: Monaco editor renders inside TMNL with VANTA theme and vim mode. No backend.

- [ ] `bun add @typefox/monaco-editor-react monaco-editor monaco-vim`
- [ ] Create `src/lib/editor/TmnlEditor.tsx` — wraps `MonacoEditorReactComp`
- [ ] Create `src/lib/editor/theme/vanta-monaco-theme.ts` — `defineTheme('vanta-void', ...)`
- [ ] Create `src/lib/editor/TmnlEditorTabs.tsx` — VANTA-styled, atom-driven
- [ ] Create `src/lib/editor/TmnlEditorStatusLine.tsx`
- [ ] Create `src/lib/editor/atoms.ts` — EditorTab, activeTab, layout state
- [ ] Wire `monaco-vim` — `initVimMode(editor, statusBar)`
- [ ] Wire into TMNL routing / layer system
- [ ] Editor opens local files via Tauri FS plugin (`@tauri-apps/plugin-fs`)
- [ ] **Deliverable**: Working code editor with vim, VANTA theme, tabs — no intelligence yet

### Phase 2: Effect LSP Service

**Goal**: Language servers spawn as child processes, proxied via Effect WebSocket.

- [ ] `bun add vscode-ws-jsonrpc vscode-jsonrpc vscode-languageserver-protocol`
- [ ] Create `src/lib/lsp-service/LspProcessManager.ts` — Effect.Service
- [ ] Create `src/lib/lsp-service/LspBridge.ts` — stdio ↔ WebSocket bridge
- [ ] Create `src/lib/lsp-service/LspRouter.ts` — Effect HttpRouter on :3035
- [ ] Create `src/lib/lsp-service/servers/typescript.ts` — config
- [ ] Create `src/lib/editor/lsp/connection.ts` — WebSocket connection factory
- [ ] Wire `LanguageClientWrapper` → `ws://localhost:3035/ws/lsp/typescript`
- [ ] Test: autocomplete, go-to-definition, hover, diagnostics
- [ ] **Deliverable**: Full TypeScript language intelligence in the editor

### Phase 3: Multi-Language + Production

**Goal**: Multiple language servers, production-ready process management.

- [ ] Add `servers/rust.ts` (rust-analyzer), `servers/python.ts` (pyright)
- [ ] Process pooling: one LSP instance per language, shared across tabs
- [ ] Restart policy: fiber supervisor with exponential backoff
- [ ] Health check endpoint with active language server list
- [ ] Bundle LSP service as Tauri sidecar for production builds
- [ ] **Deliverable**: TypeScript + Rust + Python intelligence

### Phase 4: Full IDE Experience

**Goal**: Feature parity with "just open a folder and code."

- [ ] File tree sidebar (TMNL native, Tauri FS)
- [ ] Multi-tab editing with split views (atom-driven layout)
- [ ] Command palette (TMNL native, Effect-based fuzzy search)
- [ ] Find in files (TMNL native, `rg` subprocess via Tauri shell)
- [ ] Diagnostics panel (LSP publishDiagnostics → TMNL bottom panel)
- [ ] Git integration (via `git` subprocess or `isomorphic-git`)
- [ ] **Deliverable**: Your own damn Cursor

---

## 11. Key Dependencies & Versions

### Frontend (packages/tmnl)

| Package | Version | Purpose |
|---|---|---|
| `@typefox/monaco-editor-react` | latest | React wrapper with LSP lifecycle |
| `monaco-languageclient` | `^10.x` | LSP client + worker factory |
| `monaco-editor` | `^0.52.x` | Core editor (peer dep) |
| `monaco-vim` | latest | Vim keybindings (standalone) |
| `vscode-ws-jsonrpc` | latest | JSON-RPC over WebSocket (client side) |

### LSP Service (packages/tmnl — same package, runs on backend)

| Package | Version | Purpose |
|---|---|---|
| `@effect/platform` | (already present) | Child process, HTTP server |
| `@effect/platform-node` or `-bun` | (already present) | Platform-specific runtime |
| `@effect/rpc` | latest | RPC server with WebSocket transport |
| `vscode-jsonrpc` | latest | `StreamMessageReader/Writer` for stdio bridge |
| `vscode-languageserver-protocol` | latest | LSP type definitions |

### Language Servers (system-installed, not npm deps)

| Server | Command | Languages |
|---|---|---|
| `typescript-language-server` | `--stdio` | TypeScript, JavaScript |
| `rust-analyzer` | (default stdio) | Rust |
| `pyright-langserver` | `--stdio` | Python |
| `lua-language-server` | (stdio) | Lua |
| `vscode-css-languageserver` | `--stdio` | CSS, SCSS |

---

## 12. Rejected Alternatives

### "Theia as Host" (REJECTED)

Embed TMNL components as Inversify `ReactWidget` instances inside Theia's Lumino shell.

**Why rejected:**
- Fighting Lumino's panel system for custom layouts
- Inversify DI conflicts with Effect-TS service architecture
- Can't use TMNL's layer system, animation library, or tldraw integration
- Every UI customization requires understanding Theia internals
- Two competing state management systems (Inversify vs Effect atoms)

### "Theia as Headless Backend" (REJECTED — Rev 2)

Run Theia as a headless Node.js service for LSP routing, filesystem, and .vsix hosting.

**Why rejected:**
- Theia pulls in Express, Socket.io, Inversify — redundant with Effect's `HttpRouter`, `@effect/rpc`
- 19+ `@theia/*` packages for what amounts to child process spawning + JSON-RPC proxy
- Socket.io transport conflicts with raw WebSocket used by `monaco-languageclient`
- Process management via Inversify when we already have Effect fibers + Scope
- .vsix plugin host is overkill — `monaco-vim` provides vim, LSP provides languages
- **Effect already has everything Theia provides, without the framework tax**

### "Raw Monaco without Any Backend" (REJECTED)

Use `@monaco-editor/react` with no LSP at all.

**Why rejected:**
- No autocomplete, no go-to-definition, no diagnostics
- A code editor without language intelligence is just a text area with syntax highlighting

### "VS Code as iframe" (REJECTED)

Embed code-server or VS Code web in an iframe.

**Why rejected:**
- No theme control (CSS isolation)
- No component-level integration
- Two separate DOM trees
- Can't compose with tldraw, AG-Grid, or TMNL components
- Iframe communication overhead

---

## 13. Open Questions

1. **`@codingame/monaco-vscode-api` necessity**: `@typefox/monaco-editor-react` may require this for the VS Code service layer. Need to determine if we can use a lighter integration without it, since we're not loading .vsix extensions.

2. **Language server discovery**: How do we find `typescript-language-server`, `rust-analyzer`, etc. on the user's system? Options: (a) bundle them with the Tauri app, (b) use Nix to manage them, (c) check `$PATH` at runtime with graceful fallback.

3. **Multi-window**: TMNL supports multiple Tauri windows. Can multiple Monaco instances share one Effect LSP service? The pooling model (one process per language) supports this naturally — multiple WebSocket connections fan into the same child process.

4. **Offline / degraded mode**: If a language server isn't installed, Monaco should still work as a basic editor. `lspStatusAtom` drives graceful degradation in the UI (dim the status indicator, show "no LSP" tooltip).

5. **Tauri IPC vs WebSocket**: Option C (direct Tauri invoke for LSP) eliminates the WebSocket hop entirely. Worth prototyping after Phase 2 to measure latency improvement.

6. **Document sync**: `monaco-languageclient` handles `textDocument/didOpen`, `didChange`, `didSave` automatically. But multi-tab state (which documents are open) needs to be managed by our atoms, not the LSP client. Need to ensure the atom state and LSP client state stay in sync.

7. **Effect platform target**: `@effect/platform-node` or `@effect/platform-bun`? If the LSP service runs in the same Bun process as Vite, use `-bun`. If Tauri spawns a sidecar, it could be either. Standardize on one.

---

## References

### Primary
- [monaco-languageclient (TypeFox)](https://github.com/TypeFox/monaco-languageclient)
- [@typefox/monaco-editor-react](https://github.com/TypeFox/monaco-languageclient/tree/main/packages/monaco-editor-react)
- [monaco-vim](https://github.com/brijeshb42/monaco-vim)
- [Effect HttpRouter / WebSocket](https://effect.website/docs/platform/http-server)
- [@effect/rpc — JSON-RPC over WebSocket](https://github.com/Effect-TS/effect/tree/main/packages/rpc)
- [vscode-jsonrpc — StreamMessageReader/Writer](https://github.com/microsoft/vscode-languageserver-node/tree/main/jsonrpc)

### Internal
- [VANTA Design Tokens](../../../src/components/portal/tokens.ts)
- [GetByShell BarLayout](../../../src-shell/components/BarLayout.tsx)
- [TMNL Animation Library](../../../src/lib/animation/)
- [Effect-Atom Patterns](../../.edin/EFFECT_PATTERNS.md)
- [TMNL-UI Tokens](../../../src/lib/tmnl-ui/tokens.ts)

### Research (DeepWiki sessions, 2026-02-21)
- Eclipse Theia architecture, theming, widget system — investigated and rejected
- TypeFox/monaco-languageclient — React component API, LSP WebSocket setup
- Effect-TS/effect — HttpRouter WebSocket upgrade, @effect/rpc WebSocket transport
- Theia Inversify `skipBaseClassChecks` fix — documented for posterity
