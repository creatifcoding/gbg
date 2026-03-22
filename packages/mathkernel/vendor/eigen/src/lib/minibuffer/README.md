# Minibuffer

Emacs-inspired command interface for TMNL. Provides M-x command execution, prompts, completions, which-key hints, and y-or-n dialogs.

## Quick Start

```tsx
import { useMinibuffer } from "@/lib/minibuffer"

function MyComponent() {
  const minibuffer = useMinibuffer()

  // M-x command palette
  const handleCommand = () => minibuffer.executeCommand()

  // Text prompt
  const handleRename = async () => {
    const name = await minibuffer.promptText("New name:", { default: "untitled" })
    console.log("User entered:", name)
  }

  // Yes/No prompt
  const handleDelete = async () => {
    const confirmed = await minibuffer.yOrN("Delete this item?")
    if (confirmed) {
      // proceed with deletion
    }
  }

  // Show message
  const handleSave = async () => {
    await save()
    minibuffer.showMessage("Saved successfully", 2000)
  }

  return (
    <div>
      <button onClick={handleCommand}>M-x</button>
      <button onClick={handleRename}>Rename</button>
      <button onClick={handleDelete}>Delete</button>
    </div>
  )
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+K` / `Cmd+K` | Open command palette |
| `Alt+X` | Open command palette (Emacs M-x) |
| `Escape` | Cancel current operation |
| `Enter` | Select/confirm |
| `Up/Down` | Navigate completions |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          useMinibuffer Hook                              │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ State (from atoms)                                                   ││
│  │   mode, input, prompt, completions, selectedIndex, message          ││
│  ├─────────────────────────────────────────────────────────────────────┤│
│  │ Operations                                                           ││
│  │   executeCommand(), promptText(), read(), yOrN(), showMessage()     ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        MinibufferService (Effect)                        │
│                                                                          │
│  Uses Effect.Deferred for blocking semantics:                           │
│  - prompt() suspends fiber until user submits                           │
│  - Deferred resolves when user confirms or cancels                      │
│  - Atoms provide reactive state for UI                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CompletionProvider Protocol                      │
│                                                                          │
│  interface CompletionProvider<T = string> {                             │
│    id: ProviderId                                                       │
│    complete: (query: string) => Effect<Completion[]>                    │
│    onSelect: (item: Completion) => Effect<void>                         │
│  }                                                                       │
│                                                                          │
│  Built-in: CommandProvider (M-x commands from hotkeys)                  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Minibuffer Modes

| Mode | Description | Triggered By |
|------|-------------|--------------|
| `idle` | Dormant, shows echo message | Default state |
| `prompt` | Text input (read-string) | `promptText()` |
| `command` | Completion selection (M-x) | `executeCommand()`, `read()` |
| `which-key` | Key chord hints | Prefix key timeout |
| `y-or-n` | Single keypress yes/no | `yOrN()` |
| `message` | Echo area message | `showMessage()` |

## Hook API Reference

### `useMinibuffer()`

Returns an object with reactive state and operations:

#### State

```typescript
interface UseMinibufferReturn {
  mode: MinibufferMode        // Current mode
  input: string               // Current input text
  prompt: string              // Current prompt
  completions: Completion[]   // Available completions
  selectedIndex: number       // Selected completion index
  selectedCompletion: Completion | null
  isActive: boolean           // Whether minibuffer is active
  message: string             // Echo message
}
```

#### Operations

```typescript
// Open M-x command palette
executeCommand(): Promise<void>

// Show text prompt and wait for input
promptText(message: string, options?: {
  default?: string
  historyKey?: HistoryKey
}): Promise<string>

// Read with completion provider
read(prompt: string, providerId: ProviderId, options?: {
  historyKey?: HistoryKey
}): Promise<string>

// Yes/no prompt (single keypress)
yOrN(prompt: string): Promise<boolean>

// Show message in echo area
showMessage(text: string, duration?: number): Promise<void>

// Cancel current operation
cancel(): Promise<void>

// Navigate completions
navigateUp(): void
navigateDown(): void

// Select current completion
selectCurrent(): Promise<void>
```

## Custom Completion Providers

Register custom providers to extend minibuffer completions:

```typescript
import { providerRegistry, createProviderId } from "@/lib/minibuffer"
import type { CompletionProvider } from "@/lib/minibuffer"
import { Effect } from "effect"

// Define provider
const MyProvider: CompletionProvider = {
  id: createProviderId("my-provider"),
  label: "My Items",
  placeholder: "Search items: ",

  complete: (query) =>
    Effect.sync(() => {
      const items = getItems()
      return items
        .filter(item => item.name.includes(query))
        .map(item => ({
          value: item.id,
          label: item.name,
          description: item.description,
          category: item.type,
        }))
    }),

  onSelect: (completion) =>
    Effect.gen(function* () {
      const id = completion.value as string
      yield* selectItem(id)
    }),
}

// Register at module load
providerRegistry.register(MyProvider)

// Use in component
const minibuffer = useMinibuffer()
const handleSelect = () => minibuffer.read("Select item:", "my-provider")
```

## Styling

The minibuffer uses cmdk-based UI with TMNL styling. Styling is defined in `components/MinibufferContent.tsx` using inline styles that reference CSS variables:

```css
--tmnl-text-xs: 12px
--tmnl-text-sm: 14px
--font-geometric: Orbitron
--font-data: 'JetBrains Mono', monospace
```

Key style tokens:
- Root background: `#000`
- Item selected: `rgb(38 38 38)`
- Text muted: `rgb(163 163 163)`
- Text disabled: `rgb(82 82 82)`
- Border: `rgb(38 38 38)`

## File Structure

```
src/lib/minibuffer/
├── index.ts                      # Public exports
├── README.md                     # This file
├── schemas/
│   └── minibuffer.ts             # Effect schemas (Mode, Completion, etc.)
├── services/
│   └── MinibufferService.ts      # Effect.Service with Deferred blocking
├── providers/
│   ├── index.ts                  # Provider registry exports
│   ├── types.ts                  # CompletionProvider interface
│   ├── registry.ts               # Provider registry singleton
│   └── CommandProvider.ts        # M-x command completion
├── atoms/
│   └── index.ts                  # Reactive state atoms
├── hooks/
│   └── useMinibuffer.ts          # Primary React hook
└── components/
    └── MinibufferContent.tsx     # cmdk-based UI
```

## Integration with Drawers

The minibuffer opens as a bottom drawer using the visual overlay system:

```typescript
// In useMinibuffer.ts
const openDrawer = useCallback(() => {
  drawer.open(
    {
      id: MINIBUFFER_DRAWER_ID,
      side: MINIBUFFER_DRAWER_DEFAULTS.side,  // "bottom"
      height: MINIBUFFER_DRAWER_DEFAULTS.height,
      showBackdrop: false,
      closeOnEscape: false,  // Handled by MinibufferContent
    },
    <MinibufferContent />
  )
}, [drawer])
```

## Emacs Inspiration

| Emacs Function | TMNL Equivalent |
|----------------|-----------------|
| `(read-string PROMPT)` | `minibuffer.promptText(prompt)` |
| `(completing-read PROMPT COLLECTION)` | `minibuffer.read(prompt, providerId)` |
| `(y-or-n-p PROMPT)` | `minibuffer.yOrN(prompt)` |
| `(message FORMAT)` | `minibuffer.showMessage(text)` |
| `M-x` | `minibuffer.executeCommand()` |
| `C-g` | `minibuffer.cancel()` or Escape key |

## History

Input history is tracked per key:

```typescript
// Prompt with history
const filename = await minibuffer.promptText("File:", {
  historyKey: "file-prompts" as HistoryKey
})

// History is automatically added on submit
// Access via atoms.minibufferHistoryAtom
```
