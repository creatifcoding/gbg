# EPOCH-0003: Minibuffer/Commands Architectural Separation

## Status: OPEN

## Phase: IMPLEMENT

---

## Brief

Separate the command system from the minibuffer. The minibuffer is a generic prompt engine (bottom drawer) that can render any content with configurable animation. Commands are a standalone system that *uses* the minibuffer for interactive selection via M-x. This follows the Emacs model where `execute-extended-command` uses the minibuffer, but the minibuffer itself knows nothing about commands.

---

## Experiment Phase

### Hypotheses
- [x] H1: Emacs model — commands are functions + interactive spec, minibuffer is just I/O
- [x] H2: Minibuffer should be a configurable bottom drawer (slide vs snap animation)
- [x] H3: CommandProvider belongs in commands/, not minibuffer/

### Probes
- P1: Research Emacs function/command/minibuffer relationship (DONE - DeepWiki)
- P2: User clarification on architectural intent (DONE - enmesh protocol)

### Findings
- **Emacs Model**: Function = callable, Command = function + `interactive` spec
- **Minibuffer** = generic input mechanism, doesn't know about commands
- **`M-x`** = `execute-extended-command` which uses `completing-read` (minibuffer) then executes
- **TMNL Divergence**: Minibuffer is a "bottom-up drawer" that can render various content with configurable animation (slide for commands, snap for transient status)

---

## Design Phase

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  src/lib/commands/                           │
│                  (Standalone Command System)                 │
│                                                              │
│  CommandService.ts      Effect.Service<CommandService>       │
│  ├── register(cmd)      Add command to registry             │
│  ├── execute(id)        Run command by ID                   │
│  └── executeInteractive()  M-x: uses minibuffer.read()      │
│                                                              │
│  CommandProvider.ts     Completion provider for minibuffer   │
│  CommandRegistry.ts     Atom-based command storage           │
│  types.ts               Command = Function + interactive     │
└─────────────────────────────────────────────────────────────┘
                │
                │ registers CommandProvider
                │ calls minibuffer.read(CommandProvider, { animate: "slide" })
                ▼
┌─────────────────────────────────────────────────────────────┐
│                  src/lib/minibuffer/                         │
│                  (Generic Prompt Engine)                     │
│                                                              │
│  MinibufferService.ts                                        │
│  ├── read(provider, opts)   Completing-read with animation  │
│  ├── prompt(msg, opts)      Simple text input                │
│  ├── yOrN(prompt)           Single keypress y/n              │
│  └── message(text, dur)     Echo area message                │
│                                                              │
│  providers/registry.ts      Generic provider registry        │
│  components/                 UI: input, completions, drawer  │
│                                                              │
│  Animation Config:                                           │
│  { animate: "slide" | "none" | boolean }                     │
└─────────────────────────────────────────────────────────────┘
                ▲
                │ M-x intercepted, calls CommandService
                │
┌─────────────────────────────────────────────────────────────┐
│                  src/lib/hotkeys/                            │
│                  (Orchestration Layer)                       │
│                                                              │
│  Intercepts M-x keybinding                                   │
│  Calls CommandService.executeInteractive()                   │
│  Does NOT call minibuffer directly                           │
└─────────────────────────────────────────────────────────────┘
```

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Commands are standalone** | Follows Emacs: commands = functions + interactive spec |
| **Minibuffer is generic** | Just a drawer + prompt engine, knows nothing about commands |
| **Animation is configurable** | Commands slide, other use cases may snap |
| **Hotkeys orchestrates M-x** | Intercepts key, delegates to CommandService |
| **Provider pattern** | CommandProvider registers with minibuffer, minibuffer doesn't import commands |

### Operations (Beads)

| ID | Task | Depends On | Status |
|----|------|------------|--------|
| `tmnl-v1jl` | Move CommandProvider to commands/ | - | **CLOSED** |
| `tmnl-xsr6` | Create standalone CommandService | - | **CLOSED** (already exists) |
| `tmnl-74on` | Add animation config to minibuffer drawer | - | Open |
| `tmnl-4ppp` | Wire hotkeys M-x to CommandService | tmnl-v1jl | **CLOSED** |
| `tmnl-6b6d` | Clean minibuffer of command assumptions | - | **CLOSED** |

**Discovery**: `CommandService` already exists at `src/lib/commands/service.ts` with full Effect.Service implementation including `execute()`, `executeEntity()`, `getBindings()`, etc.

**Implementation Summary**:
- Created `src/lib/commands/CommandProvider.ts` - new provider using `CommandService.list()` instead of hotkeys atoms
- Added `executeInteractive()` to `CommandService` - M-x flow now owned by commands/
- Updated `useMinibuffer.executeCommand()` to use `CommandService.executeInteractive()`
- CommandProvider registration happens in `useCommandWire.tsx` at app initialization
- Old `minibuffer/providers/CommandProvider.ts` deprecated (re-exports for backwards compat)

### Related Documentation

- `assets/documents/ARCHITECTURE.md` — System overview with service graph
- `assets/documents/SERVICES_INVENTORY.md` — All Effect services with dependencies
- `assets/documents/TESTBED_CATALOG.md` — All testbeds and what they exercise

---

## Implement Phase

### Tasks
- [x] `tmnl-v1jl`: Move CommandProvider to commands/
- [x] `tmnl-xsr6`: ~~Create standalone CommandService~~ (already exists)
- [ ] `tmnl-74on`: Add animation config to minibuffer drawer
- [x] `tmnl-4ppp`: Wire hotkeys M-x to CommandService
- [x] `tmnl-6b6d`: Clean minibuffer of command assumptions

### Completed Implementation

**CommandService** (`src/lib/commands/service.ts`) now includes:
```typescript
export class CommandService extends Context.Tag('tmnl/commands/CommandService')<
  CommandService,
  CommandServiceImpl
>() {
  static Default = Layer.succeed(this, CommandService.of({
    get: (id) => Effect.sync(() => Option.fromNullable(commands.get(id))),
    execute: (id) => Effect.gen(function* () { ... }),
    executeEntity: <T>(id, entity, ctx?) => Effect.gen(function* () { ... }),
    executeInteractive: (options) => Effect.gen(function* () {
      // Uses MinibufferService.read() with CommandProvider
      const minibuffer = yield* MinibufferService
      const selectedId = yield* minibuffer.read('M-x ', COMMAND_PROVIDER_ID, { requireSelection: true })
      if (selectedId) yield* execute(selectedId)
    }),
    list: () => Effect.sync(() => Array.from(commands.values())),
    getBindings: () => Effect.sync(() => getDefaultBindings()),
    overrideBinding: (registry, commandId, keys, scope?) => Effect.sync(() => { ... }),
  }))
}
```

**CommandProvider** (`src/lib/commands/CommandProvider.ts`):
- Uses `CommandService.list()` for completions
- Uses `CommandService.execute()` for selection
- Registered via `registerCommandProvider()` in `useCommandWire.tsx`

### Artifacts
- `src/lib/commands/index.ts` ✓ (updated with exports + error types)
- `src/lib/commands/service.ts` ✓ (added executeInteractive())
- `src/lib/commands/CommandProvider.ts` ✓ (NEW - moved from minibuffer)
- `src/lib/commands/useCommandWire.tsx` ✓ (Effect-ified, no try/catch)
- `src/lib/commands/wire.ts` ✓ (Effect-ified with tagged errors)
- `src/lib/minibuffer/hooks/useMinibuffer.tsx` ✓ (uses CommandService)
- `src/lib/minibuffer/providers/index.ts` ✓ (deprecated re-exports)

### Effect Error Handling (Pattern Enforcement)

**Violation identified and fixed**: try/catch blocks replaced with Effect patterns.

**Tagged Error Types** (for `Effect.catchTag`):
- `CommandRegistrationError` - Command failed to register with hotkeys
- `BindingRegistrationError` - Keybinding failed to parse/register
- `ProviderRegistrationError` - CommandProvider failed to register with minibuffer
- `WireError` - Aggregate of all wiring errors (non-fatal, accumulated)

**Pattern**: Error accumulation without fail-fast
```typescript
const errorsRef = yield* Ref.make<Error[]>([])
yield* someEffect.pipe(
  Effect.catchAll((err) => Ref.update(errorsRef, (errs) => [...errs, err]))
)
```

**Pattern**: Tagged error handling
```typescript
wireEffect.pipe(
  Effect.catchTag('ProviderRegistrationError', (err) =>
    Effect.gen(function* () {
      yield* Effect.logError('Failed to register', err.cause)
      return fallbackValue
    })
  ),
  Effect.catchAll((err) => Effect.logError('Unexpected error', err))
)
```

---

## Negotiate Phase

### Debrief
[To be filled on completion]

### Learnings
[To be filled on completion]

### Next Epoch Seeds
- Variables system (Emacs defvar equivalent)
- Hooks system (Emacs hooks for extensibility)
- Function documentation/introspection

---

## Timestamps
- Opened: 2025-12-15 06:37
- Closed: [pending]
