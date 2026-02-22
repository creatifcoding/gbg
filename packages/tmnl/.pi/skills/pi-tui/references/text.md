# Text Utilities

```typescript
import { visibleWidth, truncateToWidth, wrapTextWithAnsi } from '@mariozechner/pi-tui'
```

## visibleWidth(str): number

Display width ignoring ANSI escape codes. Handles wide chars (CJK).

## truncateToWidth(str, width, ellipsis?): string

Truncate to fit within `width` visible characters.

```typescript
truncateToWidth(text, 80)          // adds "…" if truncated
truncateToWidth(text, 80, '')      // no ellipsis
truncateToWidth(text, 80, '...')   // custom ellipsis
```

## wrapTextWithAnsi(str, width): string

Word-wrap preserving ANSI codes across line breaks. Returns string with `\n`.

## Built-in Components

```typescript
import { Text, Box, Container, Spacer, Markdown, Image } from '@mariozechner/pi-tui'
```

| Component | Constructor | Notes |
|-----------|-------------|-------|
| `Text` | `new Text(content, paddingX, paddingY, bgFn?)` | Word-wrapping, `.setText()` |
| `Box` | `new Box(paddingX, paddingY, bgFn?)` | Container with background, `.addChild()` |
| `Container` | `new Container()` | Vertical stack, `.addChild()`, `.removeChild()` |
| `Spacer` | `new Spacer(lines)` | Empty vertical space |
| `Markdown` | `new Markdown(md, paddingX, paddingY, theme)` | Rendered markdown, `.setText()` |
| `Image` | `new Image(base64, mime, theme, opts?)` | Terminal images (Kitty/iTerm2) |

## Interactive Components

```typescript
import { SelectList, SettingsList } from '@mariozechner/pi-tui'
import { DynamicBorder, BorderedLoader } from '@mariozechner/pi-coding-agent'
```

| Component | Use |
|-----------|-----|
| `SelectList` | Pick from list, fuzzy search |
| `SettingsList` | Toggle settings |
| `DynamicBorder` | Themed horizontal rule |
| `BorderedLoader` | Spinner + cancel (Esc) |

## Dependency

Extensions need `@mariozechner/pi-tui`:

```bash
# Find path
find ~/.npm-packages -name "pi-tui" -type d | head -1

# package.json
{ "dependencies": { "@mariozechner/pi-tui": "file:<that-path>" } }

# Install
bun install
```
