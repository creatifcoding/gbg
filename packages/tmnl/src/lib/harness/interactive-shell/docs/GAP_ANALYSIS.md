# Interactive Shell — Gap Analysis

> **Reference**: pi extension at `~/.pi/agent/extensions/interactive-shell/`
> **TMNL harness**: `src/lib/harness/interactive-shell/`
> **Date**: 2026-02-22
> **Status**: Post-#F641 vertical slice, pre-parity pass

---

## Architecture Comparison

### pi extension (TUI-native)

```
┌──────────────────────────────────────────────────────┐
│  Agent (LLM)                                         │
│  └─ interactive_shell tool call                      │
│     └─ tool-schema.ts (TypeBox params)               │
│        └─ index.ts (executor)                        │
│           ├─ session-manager.ts (ShellSessionManager)│
│           │  └─ pty-session.ts (PtyTerminalSession)  │
│           │     ├─ node-pty (PTY spawn)              │
│           │     ├─ @xterm/headless (virtual term)    │
│           │     └─ @xterm/addon-serialize            │
│           ├─ key-encoding.ts (named keys → escapes)  │
│           ├─ headless-monitor.ts (dispatch/hands-free)│
│           ├─ overlay-component.ts (pi TUI widget)    │
│           └─ config.ts (JSON config merge)           │
└──────────────────────────────────────────────────────┘
```

### TMNL harness (browser-rendered)

```
┌──────────────────────────────────────────────────────┐
│  Agent (LLM)                                         │
│  └─ interactive_shell tool call                      │
│     └─ tool.ts (Effect Schema params + executor)     │
│        └─ InteractiveShellService.ts (Effect.Service) │
│           └─ Worker.makePoolSerialized (elastic pool) │
│              └─ pty-worker-runner.ts (BunWorkerRunner)│
│                 └─ Bun.Terminal (PTY spawn)           │
│                                                       │
│  WS relay:                                            │
│  └─ HarnessRemoteWsServer.ts                         │
│     └─ shell_write / shell_resize / shell_kill cmds  │
│     └─ shell_event stream (data/exit/error)          │
│                                                       │
│  Browser client:                                      │
│  └─ shell-client-atoms.ts (plain fn bridge)          │
│     └─ useHarnessAdapter.ts (WS event fiber)         │
│        └─ InteractiveShellRenderer.tsx                │
│           └─ InteractiveTerminal.tsx (forwardRef)     │
│              └─ TerminalCore.tsx (ghostty-web WASM)   │
└──────────────────────────────────────────────────────┘
```

---

## Parity Matrix

### 🟢 What we have (parity or better)

| Feature | pi extension | TMNL harness | Notes |
|---|---|---|---|
| **Spawn session** | ✅ node-pty | ✅ Bun.Terminal | Different backend, same result |
| **Write raw input** | ✅ `pty.write()` | ✅ `proc.terminal.write()` | |
| **Resize** | ✅ `pty.resize()` | ✅ `proc.terminal.resize()` | |
| **Kill session** | ✅ `pty.kill()` | ✅ `proc.kill()` | |
| **Session management** | ✅ `ShellSessionManager` | ✅ `InteractiveShellService` | Effect-native |
| **Event relay (WS)** | N/A (TUI-native) | ✅ Full WS protocol | We have the edge here — browser rendering |
| **Client rendering** | ✅ TUI overlay (pi widget) | ✅ ghostty-web canvas | Browser-native, pixel-perfect |
| **Tool registration** | ✅ TypeBox schema | ✅ Effect Schema | |
| **Elastic scaling** | ❌ Single-threaded | ✅ Worker pool (1-8 threads) | We're ahead |
| **Raw output buffer** | ✅ 1MB cap with trim | ✅ 512KB cap with trim | Close enough |

### 🔴 Critical Gaps — Agent Can't "See" the Terminal

| Feature | pi extension | TMNL harness | Priority |
|---|---|---|---|
| **Screen dump / viewport read** | ✅ `getViewportLines()` — xterm-headless renders ANSI → cell buffer → plain text. Agent reads *what the user sees*. | ❌ We only have `rawOutputBuffer` (raw PTY bytes). No virtual terminal state. | **P0** |
| **Tail read with ANSI** | ✅ `getTailLines({ ansi: true })` — serializer addon re-emits styled text | ❌ Only raw buffer + `stripVTControlCharacters` | **P0** |
| **Log slice pagination** | ✅ `getLogSlice({ offset, limit })` — arbitrary ranges | ❌ Only last N lines from raw buffer | **P1** |
| **Incremental read** | ✅ `getRawStream({ sinceLast: true })` — server tracks position, returns only new data | ❌ No position tracking | **P1** |
| **Drain mode** | ✅ Raw stream delta since last read | ❌ | **P1** |

#### Why this matters

The agent currently spawns a process and gets back a sessionId. When it queries output, it gets raw PTY bytes with `stripVTControlCharacters` applied. But:

1. **TUI applications** (vim, htop, tmux) use cursor positioning, alternate screen buffer, etc. Raw bytes are gibberish — the agent needs the *rendered viewport* (what a human would see).
2. **Colorized output** (cargo, jest, git diff) benefits from styled tail lines that the agent can pass back as context.
3. **Long-running processes** accumulate MBs of output. Without pagination and incremental reads, the agent either gets a truncated tail or blows its context window.

#### Architectural Decision Required

**Option A**: `@xterm/headless` in PTY worker thread
- Pro: Exact parity with pi extension. Cell-by-cell rendering, serialize addon.
- Con: Node.js addon, may need compilation. Adds ~200KB.
- Verdict: **Recommended**. PTY worker already runs in a separate thread. xterm-headless is pure JS (no native addon). It's the gold standard for server-side terminal state.

**Option B**: ghostty WASM on server
- Pro: Consistent with client renderer.
- Con: WASM in Worker thread may have compat issues. No serialize addon equivalent.
- Verdict: Overkill. ghostty-web is optimized for rendering, not headless state extraction.

**Option C**: Smarter raw buffer parsing
- Pro: Zero dependencies.
- Con: 80% solution. Can't handle alternate screen, cursor positioning, or styled output.
- Verdict: Fallback only.

### 🔴 Critical Gaps — Agent Can't "Type" Properly

| Feature | pi extension | TMNL harness | Priority |
|---|---|---|---|
| **Named key sequences** | ✅ `inputKeys: ["ctrl+c", "up", "enter"]` → full key encoder with xterm modifiers | ❌ Only raw text via `write()` | **P0** |
| **Hex escape sequences** | ✅ `inputHex: ["0x1b", "0x5b", "0x41"]` → raw bytes | ❌ | **P1** |
| **Bracketed paste** | ✅ `inputPaste: "multi\nline"` → `ESC[200~...ESC[201~` | ❌ | **P1** |
| **Key encoding module** | ✅ 300-line `key-encoding.ts` with ctrl+alt+shift combos, F-keys, keypad | ❌ | **P0** |

#### What the pi extension's key encoder handles

```
Named keys:    up, down, left, right, home, end, pageup, pagedown,
               f1-f12, insert, delete, tab, enter, escape, backspace, space
Ctrl combos:   ctrl+a through ctrl+z, ctrl+[, ctrl+\, ctrl+], ctrl+^, ctrl+_
Alt combos:    alt+<any> (sends ESC prefix)
Shift combos:  shift+tab (backtab), shift+<arrow> (xterm modifier encoding)
Multi-mod:     ctrl+alt+delete, ctrl+shift+up, etc. (xterm modifier codes)
Syntax:        "ctrl+c" or "c-c", "alt+x" or "m-x", "shift+tab" or "s-tab"
Keypad:        kp0-kp9, kp/, kp*, kp-, kp+, kp., kpenter
Bracketed:     inputPaste wraps text in ESC[200~/ESC[201~ envelope
Hex raw:       inputHex: ["0x1b", "0x5b", "0x41"] → ESC[A (Up arrow)
```

Without this, the agent can't:
- Send `ctrl+c` to interrupt a running process
- Navigate TUI menus (up/down/enter)
- Send `ctrl+d` for EOF
- Use F-keys in editors
- Paste multiline code without shells auto-executing each line

### 🔴 Critical Gaps — Modes & Lifecycle

| Feature | pi extension | TMNL harness | Priority |
|---|---|---|---|
| **Hands-free mode** | ✅ Returns immediately, periodic updates, auto-exit-on-quiet | ❌ Only blocking spawn | **P0** |
| **Dispatch mode** | ✅ Returns immediately, notified on completion via `triggerTurn` | ❌ | **P1** |
| **Background sessions** | ✅ Dismiss overlay, process keeps running, `/attach` to reopen | ❌ | **P2** |
| **Attach/reattach** | ✅ Reconnect to background session | ❌ | **P2** |
| **List background** | ✅ `listBackground: true` | ❌ | **P2** |
| **Timeout** | ✅ Auto-kill after N ms | ❌ | **P1** |
| **Rate limiting** | ✅ 60s between queries (configurable) | ❌ | **P2** |
| **HeadlessDispatchMonitor** | ✅ Watches for quiet/exit, captures completion output | ❌ | **P1** |

#### Mode semantics

**Hands-free**: Agent spawns a process, tool returns **immediately** with `sessionId`. Agent checks back periodically. The monitor watches for "quiet" (output stops for N ms) and sends update events. User can take over at any time by typing in the terminal.

**Dispatch**: Like hands-free but the agent doesn't poll at all. A `HeadlessDispatchMonitor` watches the process and fires a `triggerTurn` callback when the process exits or goes quiet. The agent gets a single notification with tail output.

**Background**: User dismisses the terminal overlay but the process keeps running. Agent can `attach` to reopen the overlay, or `listBackground` to see what's running.

Our harness currently only has one mode: spawn → block until exit. The tool executor sleeps 200ms then reads output. There's no return-immediately, no periodic updates, no completion notification.

### 🟡 Gaps — Composer Integration (New Feature, No pi Equivalent)

| Feature | Status | Priority |
|---|---|---|
| **Inline terminal in composer** | Not started — user wants expandable-up terminal in composer's terminal mode | **P0** |
| **Tap inline → inspect in panel** | Not started — click inline terminal to open full panel view | **P1** |

This is net-new functionality that doesn't exist in the pi extension. The composer has a "terminal mode" concept. The idea:

1. Composer can expand upward to reveal an inline interactive terminal
2. Terminal renders via the same `TerminalCore` (ghostty-web)
3. Tapping the inline terminal opens a full panel/inspector view
4. Long-term: multiple sessions, tabbed terminals

### 🟡 Gaps — Output Quality

| Feature | pi extension | TMNL harness | Priority |
|---|---|---|---|
| **DSR response** (cursor position query) | ✅ `splitAroundDsr()` intercepts `ESC[6n`, responds with cursor pos from xterm buffer | ❌ TUI apps that query cursor will hang | **P1** |
| **Write queue ordering** | ✅ `WriteQueue` ensures ordered writes to xterm | ❌ Raw stream, no ordering guarantee | **P2** |
| **ANSI re-emission** | ✅ `@xterm/addon-serialize` for styled output | ❌ Only raw bytes or stripped text | **P1** |
| **Scrollback config** | ✅ 5000 lines default, configurable | ❌ Hardcoded in ghostty-web | **P2** |
| **Config file support** | ✅ Global + project JSON merge | ❌ No config system | **P2** |

---

## Tool Schema Gaps

### pi extension parameters we don't support

```typescript
// Output reading modes
outputLines?: number;        // Lines to return (default 20, max 200)
outputMaxChars?: number;     // Max chars (default 5KB, max 50KB)
outputOffset?: number;       // Line offset for pagination
drain?: boolean;             // Only NEW output since last query
incremental?: boolean;       // Server-tracked position, next N unseen

// Input modes
inputKeys?: string[];        // Named keys: ["ctrl+c", "up", "enter"]
inputHex?: string[];         // Raw hex: ["0x1b", "0x5b", "0x41"]
inputPaste?: string;         // Bracketed paste mode

// Lifecycle
mode?: "interactive" | "hands-free" | "dispatch";
background?: boolean;        // Run headless / dismiss overlay
attach?: string;             // Reattach to background session
listBackground?: boolean;    // List all background sessions
dismissBackground?: boolean | string;
timeout?: number;            // Auto-kill after N ms

// Hands-free config
handsFree?: {
  updateMode?: "on-quiet" | "interval";
  updateInterval?: number;
  quietThreshold?: number;
  updateMaxChars?: number;
  maxTotalChars?: number;
  autoExitOnQuiet?: boolean;
};

// Session settings (mutable)
settings?: {
  updateInterval?: number;
  quietThreshold?: number;
};

// Handoff (pi TUI specific, may not apply)
handoffPreview?: { enabled, lines, maxChars };
handoffSnapshot?: { enabled, lines, maxChars };

// Metadata
name?: string;               // Human-readable session name
reason?: string;             // Shown in overlay header
```

### What our schema currently supports

```typescript
// From src/lib/harness/interactive-shell/schemas.ts
command?: string;
sessionId?: string;
kill?: boolean;
input?: string;              // Raw text only
mode?: "interactive" | "hands-free" | "dispatch";  // Schema exists, not implemented
name?: string;
cwd?: string;
timeout?: number;            // Schema exists, not implemented
```

---

## Recommended Implementation Order

### Phase 1: Agent Literacy (P0)

**Goal**: Agent can see terminal output and send proper keystrokes.

1. **Port `key-encoding.ts`** → `src/lib/harness/interactive-shell/key-encoding.ts`
   - Copy and adapt. It's pure string manipulation, no dependencies.
   - Add `inputKeys`, `inputHex`, `inputPaste` to `InteractiveShellToolArgs` schema.
   - Wire through WS protocol (`shell_write` already handles raw text; extend for key arrays).
   - Wire through tool executor (`executeInteractiveShell`).

2. **Add xterm-headless to PTY worker** → `pty-worker-runner.ts`
   - `bun add @xterm/headless @xterm/addon-serialize`
   - In worker: pipe PTY data through `Terminal.write()` alongside raw buffer.
   - Add `PtyDumpScreen` request: returns viewport lines (plain or ANSI).
   - Add `PtyReadOutput` request: returns tail/slice with pagination.

3. **Upgrade `readOutput`** in `InteractiveShellService`
   - Add `getViewportLines()`, `getTailLines()`, `getLogSlice()`.
   - Add position tracking for incremental/drain reads.
   - Expose through WS protocol as `shell_read_output` command.

4. **Upgrade tool executor** to support output reading parameters
   - `outputLines`, `outputMaxChars`, `outputOffset`, `drain`, `incremental`.

### Phase 2: Agent Autonomy (P0-P1)

**Goal**: Agent can fire-and-forget, check back periodically, get notified.

5. **Hands-free mode** in tool executor
   - Tool returns immediately with `sessionId`.
   - Add `HandsFreeMonitor` (port `HeadlessDispatchMonitor`) to service.
   - Monitor sends periodic update events via WS.

6. **Dispatch mode** in tool executor
   - Tool returns immediately.
   - Monitor watches for exit/quiet → sends completion event.
   - Agent receives notification as tool result on next turn.

7. **Timeout support**
   - Timer in worker or service layer.
   - Auto-kill + capture output on timeout.

### Phase 3: Composer Integration (P0)

**Goal**: Inline expandable terminal in composer.

8. **Composer terminal mode**
   - Composer expands upward to reveal `InteractiveTerminal` instance.
   - Connected to a persistent shell session (not per-message).
   - Shares `TerminalCore` with tool renderer terminals.

9. **Tap to inspect**
   - Inline terminal tap opens full-panel view.
   - Full panel has scroll, search, copy, etc.

### Phase 4: Polish (P1-P2)

10. **DSR response handling** in PTY worker
11. **Write queue ordering** in PTY worker
12. **Background/attach/detach** session lifecycle
13. **Rate limiting** for agent queries
14. **Config file support** (JSON merge from project + global)
15. **Session naming** (human-readable slug generation)

---

## File Impact Map

```
src/lib/harness/interactive-shell/
├── docs/
│   └── GAP_ANALYSIS.md              ← THIS FILE
├── key-encoding.ts                   ← NEW (port from pi extension)
├── schemas.ts                        ← MODIFY (add inputKeys/inputHex/inputPaste/output params)
├── pty-worker-schema.ts              ← MODIFY (add PtyDumpScreen, PtyReadOutput requests)
├── pty-worker-runner.ts              ← MODIFY (add xterm-headless, screen state)
├── InteractiveShellService.ts        ← MODIFY (add viewport/tail/slice/incremental reads)
├── tool.ts                           ← MODIFY (wire new params, hands-free/dispatch modes)
├── shell-client-atoms.ts             ← MODIFY (add output query commands)
├── monitors/
│   ├── HandsFreeMonitor.ts           ← NEW (periodic updates, quiet detection)
│   └── DispatchMonitor.ts            ← NEW (completion notification)
├── index.ts                          ← MODIFY (re-export new modules)

src/lib/harness/
├── HarnessBrowserRemoteSchemas.ts    ← MODIFY (add shell_read_output, shell_input_keys commands)
├── server/HarnessRemoteWsServer.ts   ← MODIFY (handle new shell commands)

src/lib/chat/composer/
├── composer-terminal.tsx             ← NEW (inline expandable terminal)

src/lib/chat/msg/tool-block/renderers/terminal/
├── interactive-terminal.tsx          ← MODIFY (panel inspection support)
```

---

## Reference: pi Extension File Inventory

| File | Lines | Purpose |
|---|---|---|
| `config.ts` | 130 | JSON config with global/project merge, clamped defaults |
| `session-manager.ts` | 280 | Session lifecycle, slug generation, background management |
| `pty-session.ts` | 530 | PTY + xterm-headless + serialize addon. Core terminal state. |
| `headless-monitor.ts` | 140 | Quiet detection, timeout, completion capture |
| `key-encoding.ts` | 300 | Named keys → escape sequences. Full modifier support. |
| `tool-schema.ts` | 250 | TypeBox tool parameters (comprehensive) |
| `overlay-component.ts` | ~400 | pi TUI overlay widget (not relevant to TMNL) |
| `reattach-overlay.ts` | ~200 | Reattach UI (not relevant to TMNL) |
| `index.ts` | ~800 | Tool executor (the big one) |
| `types.ts` | ~50 | Type exports |

**Total reference surface**: ~3,080 lines across 10 files.
**TMNL harness current surface**: ~1,200 lines across 8 files.
**Estimated delta to parity**: ~1,500 lines of new/modified code.
