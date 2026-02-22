# Pi Extension `interactive_shell` — Reference Snapshot

> **Source**: `~/.pi/agent/extensions/interactive-shell/`
> **Captured**: 2026-02-22
> **Purpose**: Canonical reference for TMNL harness parity implementation

This document captures the complete architecture, data structures, and behaviors
of the pi extension's `interactive_shell` tool. Use this as the authoritative
reference when implementing parity features in the harness.

---

## File Inventory

| File | Lines | Purpose |
|---|---|---|
| `index.ts` | ~800 | Main tool executor. 4 branches: interact, attach, list, start. |
| `tool-schema.ts` | ~250 | TypeBox parameter definitions (comprehensive). |
| `pty-session.ts` | ~530 | PTY + xterm-headless + serialize addon. Terminal state engine. |
| `session-manager.ts` | ~280 | Session lifecycle, slug generation, background management. |
| `key-encoding.ts` | ~300 | Named keys → escape sequences. Full modifier support. |
| `headless-monitor.ts` | ~140 | Quiet detection, timeout, completion capture. |
| `config.ts` | ~130 | JSON config with global/project merge, clamped defaults. |
| `types.ts` | ~50 | Shared interfaces and utility functions. |
| `overlay-component.ts` | ~400 | pi TUI overlay widget. Not relevant to TMNL. |
| `reattach-overlay.ts` | ~200 | Reattach UI. Not relevant to TMNL. |

**Total**: ~3,080 lines across 10 files.

---

## Tool Parameters (Complete)

```typescript
interface ToolParams {
  // === Session Creation ===
  command?: string;              // CLI command to run
  cwd?: string;                  // Working directory
  name?: string;                 // Human-readable session name (slug generation)
  reason?: string;               // Shown in overlay header (UI-only, not passed to subprocess)
  mode?: "interactive" | "hands-free" | "dispatch";
  timeout?: number;              // Auto-kill after N ms

  // === Session Interaction (requires sessionId) ===
  sessionId?: string;            // Target existing session
  kill?: boolean;                // Kill session
  background?: boolean;          // Dismiss overlay / run headless

  // === Input Methods ===
  input?: string;                // Raw text/keystrokes
  inputKeys?: string[];          // Named keys: ["ctrl+c", "up", "enter"]
  inputHex?: string[];           // Raw hex bytes: ["0x1b", "0x5b", "0x41"]
  inputPaste?: string;           // Bracketed paste mode text

  // === Output Reading ===
  outputLines?: number;          // Lines to return (default: 20, max: 200)
  outputMaxChars?: number;       // Max chars (default: 5KB, max: 50KB)
  outputOffset?: number;         // Line offset for pagination (0-indexed)
  drain?: boolean;               // Only NEW output since last query
  incremental?: boolean;         // Server-tracked position, next N unseen lines

  // === Session Settings (mutable) ===
  settings?: {
    updateInterval?: number;     // Change max update interval (ms)
    quietThreshold?: number;     // Change quiet detection threshold (ms)
  };

  // === Background Session Management ===
  attach?: string;               // Reattach to background session by ID
  listBackground?: boolean;      // List all background sessions
  dismissBackground?: boolean | string;  // Kill/remove sessions

  // === Hands-Free Mode Config ===
  handsFree?: {
    updateMode?: "on-quiet" | "interval";
    updateInterval?: number;     // Max interval between updates (default: 60000)
    quietThreshold?: number;     // Silence duration before update (default: 5000)
    updateMaxChars?: number;     // Max chars per update (default: 1500)
    maxTotalChars?: number;      // Total char budget (default: 100000)
    autoExitOnQuiet?: boolean;   // Auto-kill when quiet (dispatch default: true)
  };

  // === Handoff (pi TUI-specific) ===
  handoffPreview?: { enabled?: boolean; lines?: number; maxChars?: number };
  handoffSnapshot?: { enabled?: boolean; lines?: number; maxChars?: number };
}
```

---

## Executor Branch Logic

The tool executor routes on parameters in this priority order:

### Branch 1: `sessionId` provided — Interact with existing session
```
sessionId + kill       → Kill session, return final output
sessionId + background → Dismiss overlay, keep running
sessionId + input*     → Send keystrokes (translated via key-encoding)
sessionId + settings   → Mutate updateInterval / quietThreshold
sessionId (bare)       → Query status + output (with pagination/drain/incremental)
```

Key behaviors:
- **Rate limiting**: Bare queries wait up to 60s if called too frequently
- **Race completion**: While rate-limited, also watches for session exit
- **Output options**: `outputLines`, `outputMaxChars`, `outputOffset`, `drain`, `incremental`

### Branch 2: `attach` provided — Reattach to background session
```
attach + mode=dispatch    → Non-blocking reattach, notified on completion
attach + mode=hands-free  → Non-blocking reattach, periodic updates
attach (bare)             → Blocking reattach, user controls overlay
```

### Branch 3: `listBackground` / `dismissBackground`
```
listBackground     → List all background sessions (id, command, status, duration)
dismissBackground  → Kill running, remove exited (all or specific ID)
```

### Branch 4: `command` provided — Start new session
```
mode=dispatch + background  → Headless dispatch (no overlay at all)
mode=dispatch               → Overlay opens, tool returns immediately, notified on completion
mode=hands-free             → Overlay opens, tool returns immediately, periodic updates
mode=interactive (default)  → Overlay opens, tool blocks until exit/transfer/background
```

---

## PtyTerminalSession — Terminal State Engine

### Architecture

```
┌─────────────────────────┐
│   node-pty (spawn)      │
│   └─ onData(raw bytes)  │
│      └─ WriteQueue      │  ← Ordered writes
│         └─ DSR filter   │  ← Intercept cursor queries
│            └─ xterm     │  ← @xterm/headless (virtual terminal)
│               └─ SerializeAddon  ← Re-emit styled ANSI
│               └─ rawOutput += data  ← Raw buffer (1MB cap)
└─────────────────────────┘
```

### State Access Methods

```typescript
class PtyTerminalSession {
  // What the user sees right now (viewport)
  getViewportLines(options?: { ansi?: boolean }): string[]

  // Last N lines from buffer (for agent context)
  getTailLines(options: {
    lines: number;
    ansi?: boolean;
    maxChars?: number;
  }): { lines: string[]; totalLinesInBuffer: number; truncatedByChars: boolean }

  // Arbitrary range with pagination
  getLogSlice(options?: {
    offset?: number;
    limit?: number;
    stripAnsi?: boolean;
  }): { slice: string; totalLines: number; totalChars: number; sliceLineCount: number }

  // Raw stream with incremental tracking
  getRawStream(options?: {
    sinceLast?: boolean;
    stripAnsi?: boolean;
  }): string

  // Terminal dimensions
  get cols(): number
  get rows(): number

  // Lifecycle
  get exited(): boolean
  get exitCode(): number | null
  get signal(): number | undefined
  get pid(): number
}
```

### ANSI Re-emission

When `ansi: true` is passed to `getViewportLines()` or `getTailLines()`, the session uses:

1. `@xterm/addon-serialize` for tail lines (serializes buffer state)
2. Cell-by-cell `renderLineFromCells()` for viewport (reads `IBufferCell` attributes)
3. Builds SGR sequences from cell attributes: bold, dim, italic, underline, inverse, invisible, strikethrough, fg/bg color (default/palette/RGB)

Fallback: If cell renderer produces blank but buffer has text, falls back to `translateToString()`.

### DSR (Device Status Report) Handling

TUI applications send `ESC[6n` or `ESC[?6n` to query cursor position. Without handling:
- The app hangs waiting for `ESC[row;colR` response
- Raw PTY output contains the query but no response arrives

The session intercepts DSR via `splitAroundDsr()`:
1. Split incoming data around DSR sequences
2. Write text segments to xterm in order
3. After each DSR, read cursor position from xterm buffer
4. Write `ESC[row;colR` response to PTY process

### Raw Output Buffer

- Max 1MB (`MAX_RAW_OUTPUT_SIZE = 1024 * 1024`)
- Trimmed from front when exceeded (keeps last 512KB)
- `lastStreamPosition` tracked for incremental reads
- `stripVTControlCharacters` applied when `stripAnsi !== false`

---

## Key Encoding Module

### Named Keys

```
Arrow:     up, down, left, right
Common:    enter/return, escape/esc, tab, space, backspace/bspace
Editing:   delete/del/dc, insert/ic
Navigation: home, end, pageup/pgup/ppage, pagedown/pgdn/npage
Function:  f1-f12
Backtab:   btab (shift+tab)
Keypad:    kp0-kp9, kp/, kp*, kp-, kp+, kp., kpenter
```

### Modifier Syntax

Two equivalent syntaxes:
```
ctrl+c  or  c-c
alt+x   or  m-x
shift+tab  or  s-tab
ctrl+alt+delete
```

### Modifier Encoding

For CSI sequences (arrows, navigation, function keys), uses xterm modifier codes:
```
modifier = 1 + (shift?1:0) + (alt?2:0) + (ctrl?4:0)

ESC[A        → ESC[1;5A       (ctrl+up)
ESC[5~       → ESC[5;3~       (alt+pageup)
ESC[H        → ESC[1;2H       (shift+home)
```

### Bracketed Paste

Wraps text in `ESC[200~` ... `ESC[201~` envelope. Prevents shells from auto-executing each line of multiline input.

### Input Translation Function

```typescript
function translateInput(input: string | {
  text?: string;
  keys?: string[];
  paste?: string;
  hex?: string[];
}): string
```

Priority: hex → text → keys → paste. All concatenated into single string.

---

## HeadlessDispatchMonitor

Watches a session for completion without an overlay.

### Behaviors

1. **Quiet detection**: Resets timer on each data event. When output stops for `quietThreshold` ms, kills process.
2. **Timeout**: Absolute timer. Kills process when elapsed.
3. **Exit detection**: Listens for PTY exit event.
4. **Output capture**: On completion, calls `getTailLines()` to capture last N lines.

### Completion Callback

Fires `onComplete(info)` with:
```typescript
interface HeadlessCompletionInfo {
  exitCode: number | null;
  signal?: number;
  timedOut?: boolean;
  cancelled?: boolean;
  completionOutput?: {
    lines: string[];
    totalLines: number;
    truncated: boolean;
  };
}
```

The main executor then calls `pi.sendMessage({ triggerTurn: true })` to notify the agent.

---

## Session Management

### Session IDs

Human-readable slugs: `{adjective}-{noun}` (e.g., "calm-reef", "swift-cedar").

```
30 adjectives × 32 nouns = 960 unique base IDs
With suffixes (-2 through -9): 7,680 unique IDs
Fallback: "shell-{timestamp.toString(36)}"
```

Custom names supported: `name: "my-build"` → uses name directly with counter for collisions.

### Session Lifecycle

```
Spawn → Active → Background → Attach → Active → Exit
                    ↓                              ↓
                  Auto-cleanup (30s)          Schedule cleanup
```

- `registerActive(session)` — Tool executor can interact
- `unregisterActive(id, releaseId)` — Stop interaction
- `add(command, session)` — Background session pool
- `take(id)` — Remove from pool, return for reattach
- `get(id)` — Access without removing (suspends auto-cleanup)
- `remove(id)` — Kill + dispose + release ID
- `killAll()` — Shutdown handler

### Auto-Cleanup

- Background sessions check every 1s for exit
- After exit: 30s cleanup timer
- On reattach: cleanup timers suspended
- On background: cleanup timers restarted

---

## Config System

Two-level merge: global → project (project wins).

```
~/.pi/agent/interactive-shell.json    (global)
.pi/interactive-shell.json            (project)
```

### Defaults

```typescript
{
  exitAutoCloseDelay: 10,        // seconds
  overlayWidthPercent: 95,
  overlayHeightPercent: 45,
  scrollbackLines: 5000,
  ansiReemit: true,

  // Transfer (Ctrl+T)
  transferLines: 200,
  transferMaxChars: 20000,

  // Completion notification
  completionNotifyLines: 50,
  completionNotifyMaxChars: 5000,

  // Handoff preview (tool result)
  handoffPreviewEnabled: true,
  handoffPreviewLines: 30,
  handoffPreviewMaxChars: 2000,

  // Handoff snapshot (disk)
  handoffSnapshotEnabled: false,
  handoffSnapshotLines: 200,
  handoffSnapshotMaxChars: 12000,

  // Hands-free mode
  handsFreeUpdateMode: "on-quiet",
  handsFreeUpdateInterval: 60000,
  handsFreeQuietThreshold: 5000,
  handsFreeUpdateMaxChars: 1500,
  handsFreeMaxTotalChars: 100000,

  // Rate limiting
  minQueryIntervalSeconds: 60,
}
```

All values are clamped to safe ranges. Invalid types fall back to defaults.

---

## Result Types

### InteractiveShellResult

Returned from all tool invocations:

```typescript
interface InteractiveShellResult {
  exitCode: number | null;
  signal?: number;
  backgrounded: boolean;
  backgroundId?: string;
  cancelled: boolean;
  timedOut?: boolean;
  sessionId?: string;
  userTookOver?: boolean;
  transferred?: { lines: string[]; totalLines: number; truncated: boolean };
  completionOutput?: { lines: string[]; totalLines: number; truncated: boolean };
  handoffPreview?: { type: "tail"; when: string; lines: string[] };
  handoff?: { type: "snapshot"; when: string; transcriptPath: string; linesWritten: number };
}
```

### HandsFreeUpdate

Sent periodically during hands-free mode:

```typescript
interface HandsFreeUpdate {
  status: "running" | "user-takeover" | "exited" | "killed";
  sessionId: string;
  runtime: number;
  tail: string[];
  tailTruncated: boolean;
  userTookOver?: boolean;
  totalCharsSent?: number;
  budgetExhausted?: boolean;
}
```

---

## Agent Notification Patterns

### Dispatch completion

```typescript
pi.sendMessage({
  customType: "interactive-shell-transfer",
  content: "Session calm-reef completed successfully (2m 15s). 147 lines of output.\n\n<tail>",
  display: true,
  details: { sessionId, duration, exitCode, signal, completionOutput },
}, { triggerTurn: true });  // ← Agent gets a turn to process
```

### Transfer (Ctrl+T)

User presses Ctrl+T → overlay closes → agent receives full output:

```typescript
pi.sendMessage({
  customType: "interactive-shell-transfer",
  content: "Session output transferred (200 lines):\n\n<content>",
  display: true,
  details: { sessionId, transferred, exitCode },
}, { triggerTurn: true });
```

### Hands-free update

```typescript
onUpdate?.({
  content: [{ type: "text", text: "Session running (45s)\n\n<tail lines>" }],
  details: { status, sessionId, runtime, newChars, totalCharsSent, budgetExhausted },
});
```

---

## Idle Prompt Warning

The executor detects when an agent likely forgot to include a prompt in the command:

```
reason: "Fix all bugs"
command: "pi"  ← No prompt embedded!
```

Warning appended to result:
```
Note: `reason` is UI-only. This command likely started the agent idle.
If you intended an initial prompt, embed it in `command`, e.g. `pi "Fix all bugs"`.
```

Detection: checks if command is a known agent binary (`pi`, `claude`, `codex`, `gemini`, `cursor-agent`) without quoted prompt or known prompt flags.
