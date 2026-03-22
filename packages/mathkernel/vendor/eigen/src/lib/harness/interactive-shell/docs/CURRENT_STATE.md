# Interactive Shell — Current Implementation State

> **Date**: 2026-02-22
> **Branch**: master
> **Feature**: #F641 (CLOSED — vertical slice complete)
> **Status**: Bootable, tool registered, needs runtime PTY fix + parity features

---

## What Exists

### Server Side

| File | Purpose | Status |
|---|---|---|
| `InteractiveShellService.ts` | Effect.Service with elastic Worker pool | ✅ Boots, constructs |
| `pty-worker-schema.ts` | Schema.TaggedRequest RPC (PtySpawn/Write/Resize/Kill) | ✅ |
| `pty-worker-runner.ts` | BunWorkerRunner handler using `Bun.Terminal` | ✅ Compiles, needs PTY fix |
| `schemas.ts` | Effect Schema for WS protocol (commands + events) | ✅ |
| `tool.ts` | Tool executor — routes spawn/write/kill/read | ✅ Registered |
| `shell-client-atoms.ts` | Browser-side plain function bridge | ✅ |
| `index.ts` | Barrel export | ✅ |

### Client Side

| File | Purpose | Status |
|---|---|---|
| `terminal-core.tsx` | Shared WASM lifecycle, theme, FitAddon, imperative API | ✅ |
| `terminal-output.tsx` | Read-only terminal wrapper | ✅ |
| `interactive-terminal.tsx` | Read-write terminal with status bar + kill | ✅ forwardRef |
| `interactive-shell-renderer.tsx` | Tool renderer — spawns terminal for shell sessions | ✅ |

### Integration

| Wire | Status |
|---|---|
| Tool registered in `PiAiToolRuntimeBuiltins` | ✅ |
| Shell commands in `HarnessBrowserRemoteSchemas` | ✅ |
| WS server handles shell commands | ✅ |
| `useHarnessAdapter` daemon fiber for shell events | ✅ |
| Shared singleton service in `HarnessRuntimeLive` | ✅ |

---

## Architecture

```
┌─ HarnessRuntimeLive ─────────────────────────────────────────┐
│                                                               │
│  InteractiveShellServiceLive (SINGLETON)                      │
│  ├─ BunWorker pool (1-8 threads, elastic)                    │
│  │  └─ pty-worker-runner.ts (Bun.Terminal PTY spawn)         │
│  ├─ Session Map<string, ShellSession>                        │
│  ├─ Stream.asyncPush<ShellEvent> (global event stream)       │
│  └─ emit: shell:data / shell:started / shell:exited / error │
│                                                               │
│  PiAiToolRuntimeBuiltins                                     │
│  └─ interactive_shell tool → yield* InteractiveShellService  │
│                                                               │
│  HarnessRemoteWsServer                                       │
│  └─ yield* InteractiveShellService for event relay + cmds    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
         │ WS
         ▼
┌─ Browser ─────────────────────────────────────────────────────┐
│                                                               │
│  useHarnessAdapter                                           │
│  ├─ Main fiber: chat events                                  │
│  └─ Shell fiber: remote:shell_event → dispatchShellEvent()   │
│                                                               │
│  shell-client-atoms.ts                                       │
│  ├─ subscribeShellEvents(sessionId, cb)                      │
│  ├─ dispatchShellEvent(event)                                │
│  ├─ sendShellInput/Resize/Kill (via registered cmd sender)   │
│  └─ registerShellCommandSender / clear                       │
│                                                               │
│  InteractiveShellRenderer                                    │
│  └─ InteractiveTerminal (forwardRef)                         │
│     └─ TerminalCore (ghostty-web WASM)                       │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Service API

```typescript
interface InteractiveShellServiceShape {
  // Session lifecycle
  spawn(args: InteractiveShellToolArgs): Effect<ShellSessionInfo>
  kill(sessionId, signal?): Effect<void, SessionNotFoundError>

  // Terminal I/O
  write(sessionId, data): Effect<void, SessionNotFoundError>
  resize(sessionId, cols, rows): Effect<void, SessionNotFoundError>
  readOutput(sessionId, lines?): Effect<string, SessionNotFoundError>

  // Queries
  getSession(sessionId): Effect<ShellSessionInfo, SessionNotFoundError>
  listSessions(): Effect<ReadonlyArray<ShellSessionInfo>>

  // Events (for WS relay)
  events: Stream<ShellEvent>
}
```

---

## Tool Schema (Current)

```typescript
{
  command?: string       // Spawn new session
  cwd?: string           // Working directory
  name?: string          // Session name
  sessionId?: string     // Interact with existing
  input?: string         // Raw text to write
  kill?: boolean         // Kill session
  signal?: number        // Kill signal
  cols?: number          // Terminal width
  rows?: number          // Terminal height
}
```

---

## WS Protocol (Current)

### Client → Server Commands

```typescript
ShellInputCommand   = { _tag: 'remote:shell_input',  sessionId, data }
ShellResizeCommand  = { _tag: 'remote:shell_resize', sessionId, cols, rows }
ShellKillCommand    = { _tag: 'remote:shell_kill',   sessionId, signal? }
```

### Server → Client Events

```typescript
ShellDataEvent    = { _tag: 'shell:data',    sessionId, data }
ShellStartedEvent = { _tag: 'shell:started', sessionId, info: ShellSessionInfo }
ShellExitedEvent  = { _tag: 'shell:exited',  sessionId, exitCode, signal? }
ShellErrorEvent   = { _tag: 'shell:error',   sessionId, message }
```

---

## Known Issues

### PTY Backend (Blocked)

`Bun.Terminal` and `node-pty` both have issues on NixOS+Bun:

- `@zenyr/bun-pty`: "PTY spawn failed" on NixOS
- `node-pty` / `@lydell/node-pty`: Bun's `.bun/` hoisting breaks native addon resolution
- Pi extension's `node-pty` works because it's pre-compiled at a fixed path

**Workaround options**:
1. Symlink pi extension's compiled `pty.node` into project
2. Create `NodePtyBackendLive` layer that loads from known working path
3. Use `Bun.spawn` + raw fd manipulation (less ideal)

### Output Reading (Incomplete)

Current `readOutput()` does `stripVTControlCharacters(rawOutputBuffer)` then returns last N lines. This gives the agent stripped plain text but:
- No viewport rendering (TUI apps produce gibberish)
- No ANSI re-emission (no styled output)
- No pagination / offset / incremental reads
- No position tracking for drain mode

### Input Methods (Incomplete)

Only raw text `write()`. No:
- Named key encoding (`inputKeys`)
- Hex escape sequences (`inputHex`)
- Bracketed paste (`inputPaste`)

### Modes (Not Implemented)

Schema has `mode` field but executor only supports blocking spawn. No:
- Hands-free (return immediately, periodic updates)
- Dispatch (return immediately, notified on completion)
- Background / attach / detach

---

## File Sizes

```
InteractiveShellService.ts    ~290 lines
pty-worker-schema.ts          ~80 lines
pty-worker-runner.ts          ~120 lines
schemas.ts                    ~130 lines
tool.ts                       ~170 lines
shell-client-atoms.ts         ~100 lines
index.ts                      ~30 lines
terminal-core.tsx             ~200 lines
terminal-output.tsx           ~60 lines
interactive-terminal.tsx      ~130 lines
interactive-shell-renderer.tsx ~180 lines
────────────────────────────────────────
Total:                        ~1,490 lines
```

Compare pi extension: ~3,080 lines across 10 files.
Estimated delta to feature parity: ~1,500 lines of new/modified code.
