# Keyboard Handling

## Imports

```typescript
import { matchesKey, Key } from '@mariozechner/pi-tui'
```

## matchesKey(data, key)

```typescript
// Single characters
matchesKey(data, 'q')
matchesKey(data, 'd')

// Named keys
matchesKey(data, Key.escape)
matchesKey(data, Key.enter)
matchesKey(data, Key.tab)
matchesKey(data, Key.space)
matchesKey(data, Key.backspace)
matchesKey(data, Key.delete)

// Arrow keys
matchesKey(data, Key.up)
matchesKey(data, Key.down)
matchesKey(data, Key.left)
matchesKey(data, Key.right)

// Navigation
matchesKey(data, Key.home)
matchesKey(data, Key.end)
matchesKey(data, Key.pageUp)
matchesKey(data, Key.pageDown)

// Modifiers
matchesKey(data, Key.ctrl('c'))
matchesKey(data, Key.shift('tab'))
matchesKey(data, Key.alt('left'))
matchesKey(data, Key.ctrlShift('p'))

// String format also works
matchesKey(data, 'ctrl+c')
matchesKey(data, 'shift+tab')
matchesKey(data, 'ctrl+shift+p')
```

## Keybinding Hints (for tool renderers)

```typescript
import { keyHint, editorKey } from '@mariozechner/pi-coding-agent'

// Display-friendly hint
keyHint('expandTools', 'to expand')  // "ctrl+o to expand"

// Raw key string
editorKey('expandTools')  // "ctrl+o"
```

## Kitty Protocol

For key release events, set `wantsKeyRelease = true` on your component.
