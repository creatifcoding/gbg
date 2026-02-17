# @tmnl/commands

Effect-native command system with decorator DSL for TMNL.

## Overview

The command system provides:

- **Declarative command definitions** with type-safe DSL
- **Two command classes**: Global (no context) and Entity (requires target)
- **Vim/Emacs-style key sequences** (`g g`, `ctrl+k ctrl+s`)
- **Scoped bindings** with inheritance
- **User-overridable keybindings** via reactive atoms
- **Effect integration** for async execution and error handling

## Quick Start

```ts
import { defineCommand, CommandService, getDefaultBindings } from '@/lib/commands'
import { Effect } from 'effect'

// Define a command
const greetCommand = defineCommand(
  {
    id: 'demo.greet',
    name: 'Greet',
    description: 'Say hello',
    category: 'system',
    scope: 'global',
    keys: 'ctrl+g',
  },
  Effect.gen(function* () {
    yield* Effect.log('Hello, TMNL!')
  })
)

// Execute it
Effect.runPromise(CommandService.execute('demo.greet'))
```

## Command Types

### Global Commands

Commands that operate without entity context:

```ts
defineCommand(
  {
    id: 'file.save',
    name: 'Save',
    category: 'file',
    scope: 'global',
    keys: 'ctrl+s',
  },
  Effect.gen(function* () {
    const content = yield* getCurrentDocument()
    yield* saveToFile(content)
  })
)
```

### Entity Commands

Commands that require a target entity:

```ts
interface GridRow {
  id: string
  data: Record<string, unknown>
}

defineEntityCommand<GridRow>(
  {
    id: 'grid.deleteRow',
    name: 'Delete Row',
    category: 'grid',
    scope: 'grid',
    entityType: 'grid.row',
    keys: 'ctrl+backspace',
  },
  (row, ctx) => Effect.gen(function* () {
    yield* Effect.log(`Deleting row: ${row.id}`)
    yield* GridService.deleteRow(row.id)
  })
)
```

## Keybinding Syntax

| Pattern | Example | Description |
|---------|---------|-------------|
| Single key | `a`, `enter` | Single keypress |
| With modifier | `ctrl+s`, `alt+f4` | Modifier + key |
| Multiple modifiers | `ctrl+shift+p` | Multiple modifiers |
| Sequence | `g g` | Vim-style sequence |
| Chord sequence | `ctrl+k ctrl+s` | VSCode-style chords |

### Supported Modifiers

- `ctrl` — Control key
- `alt` — Alt/Option key
- `shift` — Shift key
- `meta` — Command (Mac) / Windows key

### Special Keys

`enter`, `space`, `escape`, `tab`, `delete`, `backspace`, `up`, `down`, `left`, `right`, `home`, `end`, `pageup`, `pagedown`

## Scopes

Commands are organized into scopes that determine when they're available:

| Scope | Description | Inherits From |
|-------|-------------|---------------|
| `global` | Always available | — |
| `editor` | Code/text editor focused | `global` |
| `grid` | AG-Grid focused | `global` |
| `tldraw` | Canvas focused | `global` |
| `modal` | Modal dialog open | `global` |

## Categories

Commands are categorized for organization in the command palette:

- `file` — File operations (save, open, new)
- `edit` — Editing (undo, redo, cut, copy, paste)
- `view` — View controls (zoom, panels)
- `navigation` — Navigation (go to, jump)
- `selection` — Selection operations
- `grid` — AG-Grid specific
- `canvas` — tldraw/drawing
- `system` — App-level (settings, palette)

## Reactive State (Atoms)

The command system uses `effect-atom` for reactive state:

```ts
import { useAtomValue } from '@effect-atom/atom-react'
import { commandsAtom, effectiveBindingsAtom, bindingOverridesAtom } from '@/lib/commands'

function KeybindingsPanel() {
  // All registered commands
  const commands = useAtomValue(commandsAtom)

  // Effective bindings (defaults + overrides)
  const bindings = useAtomValue(effectiveBindingsAtom)

  // User overrides only
  const overrides = useAtomValue(bindingOverridesAtom)

  return (/* ... */)
}
```

## Keybinding Overrides

Users can override default keybindings:

```ts
import { CommandService } from '@/lib/commands'
import { useContext } from 'react'
import { RegistryContext } from '@effect-atom/atom-react'

function useKeybindingEditor() {
  const registry = useContext(RegistryContext)

  // Change a keybinding
  const rebind = (commandId: string, newKeys: string) => {
    Effect.runSync(CommandService.overrideBinding(registry, commandId, newKeys))
  }

  // Unbind a command
  const unbind = (commandId: string) => {
    Effect.runSync(CommandService.overrideBinding(registry, commandId, null))
  }

  // Reset to default
  const reset = (commandId: string) => {
    Effect.runSync(CommandService.resetBinding(registry, commandId))
  }

  // Reset all
  const resetAll = () => {
    Effect.runSync(CommandService.resetAllBindings(registry))
  }

  return { rebind, unbind, reset, resetAll }
}
```

## Built-in Commands

### File Commands
| ID | Name | Default Key |
|----|------|-------------|
| `file.save` | Save | `ctrl+s` |
| `file.open` | Open File | `ctrl+o` |
| `file.new` | New File | `ctrl+n` |

### System Commands
| ID | Name | Default Key |
|----|------|-------------|
| `system.commandPalette` | Command Palette | `ctrl+shift+p` / `alt+x` |
| `system.nuCmdk` | NuCmdk Shell | `ctrl+shift+k` |
| `system.settings` | Settings | `ctrl+,` |
| `system.keyboardShortcuts` | Keyboard Shortcuts | `ctrl+k ctrl+s` |

### Navigation Commands
| ID | Name | Default Key |
|----|------|-------------|
| `nav.goToTop` | Go to Top | `g g` |
| `nav.goToBottom` | Go to Bottom | `shift+g` |
| `nav.goToInbox` | Go to Inbox | `g i` |
| `nav.goToStarred` | Go to Starred | `g s` |

### Editor Commands
| ID | Name | Default Key |
|----|------|-------------|
| `editor.formatDocument` | Format Document | `shift+alt+f` |
| `editor.toggleComment` | Toggle Comment | `ctrl+/` |
| `editor.undo` | Undo | `ctrl+z` |
| `editor.redo` | Redo | `ctrl+shift+z` |
| `editor.find` | Find | `ctrl+f` |
| `editor.replace` | Find and Replace | `ctrl+h` |

### Grid Commands
| ID | Name | Default Key |
|----|------|-------------|
| `grid.addRow` | Add Row | `ctrl+enter` |
| `grid.deleteRow` | Delete Row | `ctrl+backspace` |
| `grid.duplicateRow` | Duplicate Row | `ctrl+d` |

### Canvas Commands
| ID | Name | Default Key |
|----|------|-------------|
| `tldraw.selectAll` | Select All | `ctrl+a` |
| `tldraw.delete` | Delete Selected | `delete` |
| `tldraw.zoomIn` | Zoom In | `ctrl+=` |
| `tldraw.zoomOut` | Zoom Out | `ctrl+-` |
| `tldraw.zoomFit` | Zoom to Fit | `ctrl+1` |

## API Reference

### `defineCommand(options, execute)`

Define a global command.

```ts
defineCommand(
  options: CommandOptions,
  execute: Effect.Effect<void, CommandError>
): GlobalCommand
```

### `defineEntityCommand<T>(options, execute)`

Define an entity command.

```ts
defineEntityCommand<T>(
  options: EntityCommandOptions<T>,
  execute: (entity: T, ctx: CommandContext<T>) => Effect.Effect<void, CommandError>
): EntityCommand<T>
```

### `CommandService`

Effect service for command operations.

```ts
CommandService.execute(id: string): Effect<void, CommandError>
CommandService.executeEntity(id, entity, ctx?): Effect<void, CommandError>
CommandService.get(id): Effect<Option<Command>>
CommandService.list(): Effect<Command[]>
CommandService.listByScope(scope): Effect<Command[]>
CommandService.getBindings(): Effect<KeyBinding[]>
CommandService.overrideBinding(registry, id, keys, scope?): Effect<void>
CommandService.resetBinding(registry, id): Effect<void>
CommandService.resetAllBindings(registry): Effect<void>
```

### `getRegisteredCommands()`

Get all registered commands (sync).

```ts
getRegisteredCommands(): ReadonlyMap<string, Command>
```

### `getDefaultBindings()`

Get default keybindings (sync).

```ts
getDefaultBindings(): readonly KeyBinding[]
```

## Wiring to Hotkey System

The command system integrates with `@/lib/hotkeys` via the wire module:

### React Hook (Recommended)

```tsx
import '@/lib/commands' // Import to register default commands
import { useCommandWire } from '@/lib/commands'

function App() {
  const { isWired, result, rewire, clear } = useCommandWire({
    debug: true,
    onWired: (r) => console.log(`Wired ${r.commandsRegistered} commands`),
    onError: (errors) => console.error('Wire errors:', errors),
  })

  if (!isWired) return <div>Loading commands...</div>

  return <YourApp />
}
```

### Direct Function

```ts
import { wireCommands, unwireCommands } from '@/lib/commands'

// Wire all commands and bindings
const result = wireCommands(registry)
console.log(`Registered ${result.commandsRegistered} commands`)
console.log(`Registered ${result.bindingsRegistered} bindings`)

if (result.errors.length > 0) {
  console.warn('Some commands failed to wire:', result.errors)
}

// Clear all (for testing/reloading)
unwireCommands(registry)
```

### HOC Pattern

```tsx
import { withCommandWire } from '@/lib/commands'

const App = withCommandWire(MyApp, { debug: true })
```

## File Structure

```
src/lib/commands/
├── types.ts            # Type definitions
├── decorators.ts       # DSL functions and registry
├── defaults.ts         # Built-in commands (24 total)
├── service.ts          # Effect service and atoms
├── wire.ts             # Hotkey system wiring
├── useCommandWire.ts   # React hook for wiring
├── index.ts            # Public exports
├── README.md           # This file
├── CLAUDE.commands.md  # Claude instructions
└── RESEARCH.editors.md # Editor solution research
```
