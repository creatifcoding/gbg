# CLAUDE.commands.md

## Command System Architecture

When working with the TMNL command system, follow these patterns.

### Two Command Classes

1. **Global Commands** — No entity context required
   - File operations (save, open, new)
   - System actions (palette, settings)
   - Navigation (vim sequences like `g g`, `g i`)

2. **Entity Commands** — Require a target entity
   - Grid operations (deleteRow, duplicateRow)
   - Canvas operations (delete shape, transform)
   - Always receive `(entity, context)` parameters

### Defining New Commands

**Always use the functional API** (`defineCommand` / `defineEntityCommand`):

```ts
// Global command
import { defineCommand } from '@/lib/commands'

export const myCommand = defineCommand(
  {
    id: 'namespace.actionName',  // kebab namespace, camelCase action
    name: 'Human Readable Name',
    description: 'What it does',
    category: 'file' | 'edit' | 'view' | 'navigation' | 'selection' | 'grid' | 'canvas' | 'system',
    scope: 'global' | 'editor' | 'grid' | 'tldraw' | 'modal',
    keys: 'ctrl+s',  // Default binding (optional)
  },
  Effect.gen(function* () {
    // Implementation
    yield* Effect.log('Executing...')
  })
)

// Entity command
import { defineEntityCommand } from '@/lib/commands'

export const deleteRowCommand = defineEntityCommand<GridRow>(
  {
    id: 'grid.deleteRow',
    name: 'Delete Row',
    category: 'grid',
    scope: 'grid',
    entityType: 'grid.row',  // Required for entity commands
    keys: 'ctrl+backspace',
  },
  (row, ctx) => Effect.gen(function* () {
    yield* Effect.log(`Deleting row ${row.id}`)
  })
)
```

### Command ID Conventions

```
namespace.actionName

Namespaces:
- file.*      — File operations
- edit.*      — Editing operations
- view.*      — View/display operations
- nav.*       — Navigation
- system.*    — System/app-level
- editor.*    — Code editor specific
- grid.*      — AG-Grid specific
- tldraw.*    — Canvas specific
```

### Keybinding Syntax

```
Simple:           ctrl+s, alt+f, shift+enter
Sequences:        g g, g i, ctrl+k ctrl+s
Modifiers:        ctrl, alt, shift, meta (cmd on mac)
Special keys:     enter, space, escape, delete, backspace
Arrow keys:       up, down, left, right
```

### Scopes

Commands are scoped to contexts where they're valid:

| Scope    | When Active                          |
|----------|--------------------------------------|
| global   | Always available                     |
| editor   | Code/text editor focused             |
| grid     | AG-Grid focused                      |
| tldraw   | Canvas focused                       |
| modal    | Modal dialog open                    |

Scope inheritance: `editor` → `global`, `grid` → `global`, etc.

### Atoms (Reactive State)

```ts
import { commandsAtom, bindingOverridesAtom, effectiveBindingsAtom } from '@/lib/commands'

// Read commands
const commands = useAtomValue(commandsAtom)

// Read effective bindings (defaults + user overrides)
const bindings = useAtomValue(effectiveBindingsAtom)

// Modify bindings
CommandService.overrideBinding(registry, 'file.save', 'ctrl+shift+s')
CommandService.resetBinding(registry, 'file.save')
CommandService.resetAllBindings(registry)
```

### Executing Commands

```ts
import { CommandService } from '@/lib/commands'

// Global command
yield* CommandService.execute('file.save')

// Entity command
yield* CommandService.executeEntity('grid.deleteRow', selectedRow, { scope: 'grid' })
```

### Adding Commands to defaults.ts

1. Define the command with `defineCommand` or `defineEntityCommand`
2. Export it individually
3. Add it to the `allCommands` array at the bottom
4. Commands auto-register on module load

### File Structure

```
src/lib/commands/
├── types.ts       # Type definitions (DO NOT add logic here)
├── decorators.ts  # DSL: defineCommand, defineEntityCommand, registry
├── defaults.ts    # All built-in commands (ADD NEW COMMANDS HERE)
├── service.ts     # Effect service + atoms
└── index.ts       # Public exports
```

### Testing Commands

```ts
import { clearRegistry, getRegisteredCommands } from '@/lib/commands'

beforeEach(() => {
  clearRegistry()
})

it('registers command', () => {
  defineCommand({ id: 'test.cmd', ... }, Effect.succeed(undefined))
  expect(getRegisteredCommands().has('test.cmd')).toBe(true)
})
```

### Wiring to Hotkey System

Use the wire module to connect commands to the hotkey system:

```tsx
// Option 1: React hook (recommended)
import '@/lib/commands/defaults' // Import for side-effect registration
import { useCommandWire } from '@/lib/commands'

function App() {
  const { isWired, result } = useCommandWire({
    debug: true,
    onWired: (r) => console.log(`Wired ${r.commandsRegistered} commands`),
  })

  if (!isWired) return <Loading />
  return <YourApp />
}

// Option 2: Direct function (for non-React contexts)
import { wireCommands } from '@/lib/commands'

const result = wireCommands(registry)
// result.commandsRegistered, result.bindingsRegistered, result.errors
```

The wire function:
1. Reads commands from `getRegisteredCommands()`
2. Adapts them to hotkey system's `Command` type
3. Parses key strings to `KeySequence` via `KeyParser`
4. Registers via `hotkeyActions.registerCommand()` and `hotkeyActions.addBinding()`

### Persistence (localStorage)

Keybinding overrides persist to localStorage automatically:

```tsx
import { useKeybindingPersistence } from '@/lib/commands'

function App() {
  // Loads saved overrides on mount, saves changes automatically
  const { isLoaded, loadedCount } = useKeybindingPersistence({
    debug: true,  // Log load/save events
  })

  return <YourApp />
}
```

Manual persistence functions:
```ts
import { loadOverrides, saveOverrides, clearPersistedOverrides } from '@/lib/commands'

// Load from localStorage
const overrides = loadOverrides()

// Save to localStorage
saveOverrides(overrides)

// Clear all persisted data
clearPersistedOverrides()
```

Storage key: `tmnl:keybinding-overrides`

### Keybinding UI

The Keybinding Testbed provides a visual interface for managing shortcuts:

**Route:** `/testbed/keybindings`

**Features:**
- View all commands grouped by category
- Search/filter commands
- Click binding to rebind (key capture modal)
- Conflict detection
- Reset individual bindings or all at once
- Auto-persistence to localStorage

### File Structure (Updated)

```
src/lib/commands/
├── types.ts         # Type definitions
├── decorators.ts    # DSL: defineCommand, defineEntityCommand
├── defaults.ts      # All built-in commands (24 commands)
├── service.ts       # Effect service + atoms
├── wire.ts          # Bridge to hotkey system
├── useCommandWire.tsx  # React hook for wiring
├── persistence.ts   # localStorage persistence
└── index.ts         # Public exports

src/components/testbed/
└── KeybindingTestbed.tsx  # Keybinding reconfiguration UI
```
