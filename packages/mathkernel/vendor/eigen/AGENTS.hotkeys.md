# TMNL Command System — Hotkeys Architecture

> **Status**: EDIN Experiment/Design Phase
> **Working Directory**: `src/lib/hotkeys/`
> **Testbed**: `src/components/testbed/HotkeyTestbed.tsx`

---

## Vision

An **emacs-inspired command orchestration layer** built on Effect, featuring:

1. **which-key** — Prefix-aware hint popups after timeout
2. **M-x** — Fuzzy command palette with discoverability
3. **Macro DSL** — Recordable, composable command sequences
4. **User remapping** — Persistent, customizable bindings
5. **XState Agents** — Stateful command actors for AI-assisted discovery
6. **Layer-aware scoping** — Hotkeys respect LayerManager focus/lock state

---

## Repomix Library Arsenal

All reference implementations live in `assets/repomix/`. Use these for pattern extraction.

### Hotkey Libraries (`assets/repomix/hotkeys/`)

| Library | File | Size | Tokens | Key Patterns |
|---------|------|------|--------|--------------|
| **tinykeys** | `tinykeys-repomix-output.xml` | 9.1K | ~2K | `$mod` normalization, sequence detection, minimal footprint |
| **mousetrap** | `mousetrap-repomix-output.xml` | 51K | ~12K | Gmail sequences (`g i`), konami codes, record plugin |
| **react-hotkeys-hook** | `react-hotkeys-hook-repomix-output.xml` | 88K | ~23K | Hook API, scoped refs, `HotkeysProvider` context |
| **github/hotkey** | `github-hotkey-repomix-output.xml` | 18K | ~5K | Radix trie prefix matching, `data-hotkey` declarative |
| **hotkeys-js** | `hotkeys-js-repomix-output.xml` | 33K | ~9K | Scope management, comprehensive key mapping |

### Effect Ecosystem (`assets/repomix/effect/` & `assets/repomix/effect-atom/`)

| Library | File | Size | Tokens | Purpose |
|---------|------|------|--------|---------|
| **Effect core + AI** | `effect/effect-core-ai-repomix-output.xml` | 5.5M | ~1.6M | Service architecture, Effect.gen, Ref, Layer |
| **effect-atom** | `effect-atom/atom-repomix-output.xml` | 254K | ~70K | Core atom primitives, Registry |
| **effect-atom-react** | `effect-atom/atom-react-repomix-output.xml` | 101K | ~27K | React bindings, useAtom, Atom.runtime |

### Stately / XState (`assets/repomix/stately/`)

| Library | File | Size | Tokens | Purpose |
|---------|------|------|--------|---------|
| **xstate-agent** | `xstate-agent-repomix-output.xml` | 84K | ~22K | AI agent + state machine fusion, `agent.interact()` |
| **xstate-agent-examples** | `xstate-agent-examples-repomix-output.xml` | 99K | ~26K | Usage patterns, real-world examples |
| **xstate-store** | `xstate-store-repomix-output.xml` | 70K | ~18K | Lightweight state management |
| **xstate-store-test** | `xstate-store-test-repomix-output.xml` | 111K | ~29K | Testing patterns |
| **@stately/inspect** | `inspect-repomix-output.xml` | 53K | ~14K | DevTools integration |

### Vercel AI SDK (`assets/repomix/vercel/`)

| Library | File | Size | Tokens | Purpose |
|---------|------|------|--------|---------|
| **ai + react + mcp** | `vercel-ai-react-mcp-repomix-output.xml` | 2.9M | ~640K | AI SDK core, React hooks, MCP tools |

### Quick Reference Commands

```bash
# Read a repomix file
cat assets/repomix/hotkeys/tinykeys-repomix-output.xml | head -500

# Search across all repomix files
grep -r "parseKeybinding" assets/repomix/hotkeys/

# Get file sizes
ls -lh assets/repomix/hotkeys/
```

---

## Key Patterns to Extract

### From tinykeys (~400 bytes)

```typescript
// $mod normalization — Command on Mac, Control elsewhere
const $mod = /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'Meta' : 'Control'

// Sequence detection — space-separated keys
"g i" → ['g', 'i'] // Gmail-style "go to inbox"
"$mod+Shift+P" → ['Meta+Shift+P'] or ['Control+Shift+P']
```

### From mousetrap

```typescript
// Sequence state machine
bind('g i', () => goToInbox())  // Two-key sequence
bind('* a', () => selectAll())   // Modifier + key
bind('up up down down left right left right b a enter', () => konami())

// Record plugin pattern
Mousetrap.record((sequence) => {
  // User just pressed this sequence, save it
})
```

### From github/hotkey

```typescript
// Radix trie for prefix matching
// Enables which-key style "what comes next?" lookups
class RadixTrie<T> {
  insert(keys: string[], value: T): void
  lookup(keys: string[]): { exact?: T, children: Map<string, RadixTrie<T>> }
}

// Declarative binding via data attributes
<button data-hotkey="Control+s">Save</button>
```

### From react-hotkeys-hook

```typescript
// Hook pattern with scoped refs
const ref = useHotkeys('ctrl+s', (e) => save(), {
  enableOnFormTags: false,
  scopes: ['editor'],
})

// Provider for scope management
<HotkeysProvider initiallyActiveScopes={['global']}>
  <App />
</HotkeysProvider>
```

### From hotkeys-js

```typescript
// Scope management
hotkeys.setScope('editor')
hotkeys.getScope() // 'editor'
hotkeys.deleteScope('modal')

// Filter for input elements
hotkeys.filter = (event) => {
  const tag = event.target.tagName
  return !(tag === 'INPUT' || tag === 'TEXTAREA')
}
```

---

## Architecture

### File Structure

```
src/lib/hotkeys/
├── index.ts                    # Public exports
├── types.ts                    # Core types (Command, Binding, Scope)
├── services/
│   ├── KeyParser.ts            # Parse key strings → normalized form
│   ├── CommandRegistry.ts      # Effect service: register/lookup commands
│   ├── HotkeyManager.ts        # Effect service: bind/unbind/dispatch
│   ├── ScopeManager.ts         # Effect service: scope stack management
│   └── MacroRecorder.ts        # Effect service: record/playback sequences
├── machines/
│   ├── sequenceMachine.ts      # XState: multi-key sequence detection
│   ├── whichKeyMachine.ts      # XState: prefix timeout → popup
│   └── commandPaletteMachine.ts # XState: M-x fuzzy search state
├── atoms/
│   └── index.ts                # effect-atom bindings for React
├── components/
│   ├── WhichKeyPopup.tsx       # Prefix hint overlay
│   ├── CommandPalette.tsx      # M-x modal
│   └── HotkeyProvider.tsx      # Context provider
├── hooks/
│   ├── useHotkey.ts            # Single hotkey hook
│   ├── useHotkeys.ts           # Multiple hotkeys hook
│   ├── useCommandPalette.ts    # M-x hook
│   └── useWhichKey.ts          # which-key hook
└── dsl/
    ├── parser.ts               # Macro DSL parser
    ├── types.ts                # AST types
    └── interpreter.ts          # Execute macro programs
```

### Core Types

```typescript
// src/lib/hotkeys/types.ts

/** Normalized key representation */
interface KeyChord {
  readonly key: string           // 'a', 'Enter', 'ArrowUp'
  readonly ctrl: boolean
  readonly alt: boolean
  readonly shift: boolean
  readonly meta: boolean         // Command on Mac
}

/** A bindable key sequence */
type KeySequence = readonly KeyChord[]

/** Command definition */
interface Command {
  readonly id: string            // 'editor.save', 'file.open'
  readonly name: string          // 'Save File'
  readonly description?: string  // 'Save the current file to disk'
  readonly category?: string     // 'File', 'Edit', 'View'
  readonly handler: Effect.Effect<void, CommandError, CommandContext>
  readonly when?: (ctx: CommandContext) => boolean  // Conditional availability
}

/** Binding maps keys to commands */
interface Binding {
  readonly keys: KeySequence
  readonly commandId: string
  readonly scope: string         // 'global', 'editor', 'grid', 'tldraw'
  readonly priority: number      // Higher wins on conflict
  readonly source: 'default' | 'user' | 'extension'
}

/** Scope for contextual bindings */
interface Scope {
  readonly id: string
  readonly parent?: string       // Inheritance chain
  readonly layer?: string        // Integration with LayerManager
}

/** Command execution context */
interface CommandContext {
  readonly activeScope: string
  readonly activeLayer?: LayerInstance
  readonly event: KeyboardEvent
  readonly repeatCount: number   // For vim-style 5dd
}
```

### Service Architecture

```typescript
// src/lib/hotkeys/services/CommandRegistry.ts

class CommandRegistry extends Effect.Service<CommandRegistry>()('hotkeys/CommandRegistry', {
  effect: Effect.gen(function* () {
    const commands = yield* Ref.make<Map<string, Command>>(new Map())

    return {
      register: (command: Command) => Ref.update(commands, map => map.set(command.id, command)),

      get: (id: string) => Ref.get(commands).pipe(
        Effect.map(map => Option.fromNullable(map.get(id)))
      ),

      search: (query: string) => Ref.get(commands).pipe(
        Effect.map(map =>
          Array.from(map.values()).filter(cmd =>
            cmd.name.toLowerCase().includes(query.toLowerCase()) ||
            cmd.id.toLowerCase().includes(query.toLowerCase())
          )
        )
      ),

      all: () => Ref.get(commands).pipe(Effect.map(map => Array.from(map.values()))),
    }
  }),
}) {}
```

```typescript
// src/lib/hotkeys/services/HotkeyManager.ts

class HotkeyManager extends Effect.Service<HotkeyManager>()('hotkeys/HotkeyManager', {
  dependencies: [CommandRegistry.Default, ScopeManager.Default],
  effect: Effect.gen(function* () {
    const registry = yield* CommandRegistry
    const scopes = yield* ScopeManager
    const bindings = yield* Ref.make<Binding[]>([])
    const sequenceState = yield* Ref.make<KeyChord[]>([])  // Current sequence buffer

    return {
      bind: (binding: Binding) => Ref.update(bindings, bs => [...bs, binding]),

      unbind: (keys: KeySequence, scope: string) => Ref.update(bindings, bs =>
        bs.filter(b => !(keysEqual(b.keys, keys) && b.scope === scope))
      ),

      dispatch: (event: KeyboardEvent) => Effect.gen(function* () {
        const chord = parseKeyEvent(event)
        const currentSeq = yield* Ref.get(sequenceState)
        const newSeq = [...currentSeq, chord]

        // Find matching bindings
        const activeScope = yield* scopes.current()
        const matches = yield* findMatches(bindings, newSeq, activeScope)

        if (matches.exact) {
          // Execute command
          yield* Ref.set(sequenceState, [])
          const command = yield* registry.get(matches.exact.commandId)
          if (Option.isSome(command)) {
            yield* command.value.handler
          }
        } else if (matches.partial.length > 0) {
          // Sequence in progress
          yield* Ref.set(sequenceState, newSeq)
          // Trigger which-key after timeout
        } else {
          // No match, reset
          yield* Ref.set(sequenceState, [])
        }
      }),

      getBindingsForPrefix: (prefix: KeySequence) => /* which-key support */,
    }
  }),
}) {}
```

### XState Machines

```typescript
// src/lib/hotkeys/machines/whichKeyMachine.ts

const whichKeyMachine = setup({
  types: {
    context: {} as {
      prefix: KeyChord[]
      availableBindings: Binding[]
      timeout: number
    },
    events: {} as
      | { type: 'KEY_PRESSED'; chord: KeyChord }
      | { type: 'TIMEOUT' }
      | { type: 'CANCEL' }
      | { type: 'SELECT'; binding: Binding }
  },
}).createMachine({
  id: 'whichKey',
  initial: 'idle',
  context: {
    prefix: [],
    availableBindings: [],
    timeout: 500,  // ms before showing popup
  },
  states: {
    idle: {
      on: {
        KEY_PRESSED: {
          target: 'buffering',
          actions: assign({ prefix: ({ context, event }) => [...context.prefix, event.chord] }),
        },
      },
    },
    buffering: {
      after: {
        500: { target: 'showing', guard: 'hasPartialMatches' },
      },
      on: {
        KEY_PRESSED: [
          { target: 'idle', guard: 'isExactMatch', actions: 'executeCommand' },
          { target: 'buffering', actions: 'appendToPrefix' },
        ],
        CANCEL: { target: 'idle', actions: 'clearPrefix' },
      },
    },
    showing: {
      on: {
        KEY_PRESSED: [
          { target: 'idle', guard: 'isExactMatch', actions: 'executeCommand' },
          { target: 'showing', actions: 'appendToPrefix' },
        ],
        SELECT: { target: 'idle', actions: 'executeBinding' },
        CANCEL: { target: 'idle', actions: 'clearPrefix' },
      },
    },
  },
})
```

---

## Testbed Integration

```typescript
// src/components/testbed/HotkeyTestbed.tsx

import { useHotkeys, useWhichKey, useCommandPalette } from '@/lib/hotkeys'
import { WhichKeyPopup, CommandPalette } from '@/lib/hotkeys/components'

export function HotkeyTestbed() {
  // Register test commands
  useHotkeys([
    { keys: 'ctrl+s', command: 'test.save' },
    { keys: 'ctrl+shift+p', command: 'palette.open' },
    { keys: 'g i', command: 'test.goInbox' },      // Sequence
    { keys: 'g g', command: 'test.goTop' },        // Sequence
    { keys: 'leader f f', command: 'test.findFile' }, // Leader key
  ])

  const { isOpen, prefix, bindings } = useWhichKey()
  const palette = useCommandPalette()

  return (
    <div className="p-8 font-mono text-sm">
      <h1 className="text-xl mb-4 text-cyan-400">Hotkey Testbed</h1>

      {/* Status display */}
      <div className="mb-8 p-4 bg-gray-900 rounded">
        <div>Active Scope: <span className="text-green-400">{scope}</span></div>
        <div>Sequence Buffer: <span className="text-yellow-400">{prefix.join(' → ')}</span></div>
      </div>

      {/* Test areas */}
      <div className="grid grid-cols-2 gap-4">
        <TestPanel scope="editor" />
        <TestPanel scope="grid" />
      </div>

      {/* Overlays */}
      <WhichKeyPopup />
      <CommandPalette />
    </div>
  )
}
```

---

## Macro DSL (Future)

```
# TMNL Macro DSL — Lisp-inspired, Effect-native

# Simple command
(cmd "editor.save")

# Sequence
(seq
  (cmd "editor.selectAll")
  (cmd "editor.copy")
  (cmd "editor.newFile")
  (cmd "editor.paste"))

# Conditional
(when (scope? "editor")
  (cmd "editor.format"))

# Repeat (vim-style)
(repeat 5 (cmd "editor.deleteLine"))

# Parallel
(par
  (cmd "git.fetch")
  (cmd "npm.install"))

# Bind to key
(bind "ctrl+shift+s"
  (seq
    (cmd "editor.format")
    (cmd "editor.save")))
```

---

## Native Hotkey Suppression

### The Problem

Browsers and Tauri webviews capture certain hotkeys *before* JavaScript event handlers fire:

| Key | Browser/Tauri Default |
|-----|----------------------|
| `Ctrl+S` | Save page dialog |
| `Ctrl+P` | Print dialog |
| `Ctrl+W` | Close tab/window |
| `Ctrl+N` | New window |
| `Ctrl+T` | New tab |
| `Ctrl+F` | Find in page |
| `F5` | Refresh |

To reclaim these for TMNL, we need to call `event.preventDefault()` on matched bindings.

### Solution Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Environment Variable                          │
│              TMNL_SUPPRESS_NATIVE_HOTKEYS=true                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      HotkeyManager                               │
│                                                                   │
│  processEvent(e: KeyboardEvent) {                                │
│    if (isInPassthroughMode()) return                             │
│    if (isAllowlisted(e)) return                                  │
│    if (config.suppressNativeHotkeys && matchesBinding(e)) {     │
│      e.preventDefault()  // ← BLOCK BROWSER                      │
│      e.stopPropagation()                                         │
│      executeCommand(binding)                                     │
│    }                                                              │
│  }                                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Configuration Options

```typescript
interface HotkeyConfig {
  // Suppress native hotkeys when TMNL has a matching binding
  // Reads from TMNL_SUPPRESS_NATIVE_HOTKEYS env var
  suppressNativeHotkeys: boolean  // default: false

  // "Knock" sequence to temporarily allow native hotkeys
  // Press this, then native keys pass through for nativePassthroughDuration
  nativePassthroughKnock: string  // default: 'ctrl+alt+n'

  // How long (ms) after knock before suppression re-activates
  // Set to 0 for sticky passthrough (until next knock)
  nativePassthroughDuration: number  // default: 5000

  // Keys that ALWAYS pass through (DevTools, refresh)
  nativePassthroughAllowlist: string[]  // default: ['F5', 'F12', 'ctrl+shift+i', 'ctrl+shift+j']
}
```

### Environment Variable

```bash
# .env or shell
export TMNL_SUPPRESS_NATIVE_HOTKEYS=true

# Vite config (for bundling)
# vite.config.ts
define: {
  'import.meta.env.TMNL_SUPPRESS_NATIVE_HOTKEYS': JSON.stringify(process.env.TMNL_SUPPRESS_NATIVE_HOTKEYS)
}
```

### The "Knock" Escape Hatch

When you need native behavior temporarily (e.g., actually print something):

1. Press `Ctrl+Alt+N` (default knock sequence)
2. Status indicator shows "Native Passthrough Mode"
3. For next 5 seconds, all hotkeys pass to browser
4. After timeout, suppression re-activates

```typescript
// Visual feedback in testbed
const PassthroughIndicator = () => {
  const { isPassthroughActive, remainingTime } = useNativePassthrough()

  if (!isPassthroughActive) return null

  return (
    <div className="fixed top-4 right-4 bg-amber-500 text-black px-4 py-2 rounded">
      Native Mode: {remainingTime}s
    </div>
  )
}
```

### Allowlist

Some keys should *always* pass through:

```typescript
const DEFAULT_ALLOWLIST = [
  'F5',              // Refresh (debugging)
  'F12',             // DevTools
  'ctrl+shift+i',    // DevTools (Chrome)
  'ctrl+shift+j',    // DevTools console
]
```

### Tauri-Specific Notes

Tauri has its own hotkey handling. For full control:

1. **Disable Tauri's default hotkeys** in `tauri.conf.json`:
   ```json
   {
     "app": {
       "windows": [{
         "devtools": true
       }]
     }
   }
   ```

2. **Register as system-wide shortcuts** if needed:
   ```rust
   // src-tauri/src/main.rs
   GlobalShortcut::new("CmdOrCtrl+S", || {
     // Handle at OS level
   });
   ```

3. **Webview focus matters**: Suppression only works when the webview has focus.

---

## Integration with LayerManager

The hotkey system integrates with TMNL's existing layer architecture:

```typescript
// Scope inherits from layer focus
const getCurrentScope = Effect.gen(function* () {
  const layerManager = yield* LayerManager
  const activeLayer = yield* layerManager.getFocusedLayer()

  if (activeLayer) {
    return activeLayer.metadata.hotkeyScope ?? 'global'
  }
  return 'global'
})

// Layer-locked hotkeys
const isHotkeyAllowed = (binding: Binding, layer: LayerInstance) => {
  if (layer.locked && binding.scope !== 'global') {
    return false  // Locked layers only respond to global hotkeys
  }
  return true
}
```

---

## Development Phases

### Phase 1: Core Infrastructure
- [x] `KeyParser` service — normalize key strings (`services/KeyParser.ts`)
- [x] `CommandRegistry` service — register/lookup (`services/CommandRegistry.ts`)
- [x] `HotkeyManager` service — bind/dispatch (`services/HotkeyManager.ts`)
- [x] Testbed scaffold (`components/testbed/HotkeyTestbed.tsx`)
- [x] Native suppression architecture (types + documentation)
- [ ] Basic `useHotkey` hook
- [ ] Wire atoms for React integration

### Phase 2: Sequences & which-key
- [ ] `sequenceMachine` — multi-key detection
- [ ] `whichKeyMachine` — prefix timeout
- [ ] `WhichKeyPopup` component
- [ ] Radix trie for prefix lookup

### Phase 3: Command Palette (M-x)
- [ ] `commandPaletteMachine` — fuzzy search
- [ ] `CommandPalette` component
- [ ] Command categories & icons
- [ ] Recent commands

### Phase 4: Scopes & Layers
- [ ] `ScopeManager` service
- [ ] Layer integration
- [ ] Scope inheritance

### Phase 5: User Customization
- [ ] Binding persistence (localStorage)
- [ ] Conflict detection
- [ ] User remapping UI

### Phase 6: Macro DSL
- [ ] Parser
- [ ] Interpreter
- [ ] Recording

### Phase 7: AI Integration (Optional)
- [ ] XState Agent for command suggestion
- [ ] Natural language → command
- [ ] Context-aware recommendations

---

## References

- [Emacs which-key](https://elpa.gnu.org/packages/which-key.html)
- [Emacs M-x](https://www.gnu.org/software/emacs/manual/html_node/emacs/M_002dx.html)
- [tinykeys](https://github.com/jamiebuilds/tinykeys)
- [mousetrap](https://github.com/ccampbell/mousetrap)
- [react-hotkeys-hook](https://github.com/JohannesKlauss/react-hotkeys-hook)
- [@github/hotkey](https://github.com/github/hotkey)
- [XState Agent](https://github.com/statelyai/agent)
