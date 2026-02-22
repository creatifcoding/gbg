# Theme Colors

Always use `theme` from callback. Never import directly.

## Foreground — `theme.fg(color, text)`

| Category | Colors |
|----------|--------|
| General | `text`, `accent`, `muted`, `dim` |
| Status | `success`, `error`, `warning` |
| Borders | `border`, `borderAccent`, `borderMuted` |
| Messages | `userMessageText`, `customMessageText`, `customMessageLabel` |
| Tools | `toolTitle`, `toolOutput` |
| Diffs | `toolDiffAdded`, `toolDiffRemoved`, `toolDiffContext` |
| Markdown | `mdHeading`, `mdLink`, `mdLinkUrl`, `mdCode`, `mdCodeBlock`, `mdCodeBlockBorder`, `mdQuote`, `mdQuoteBorder`, `mdHr`, `mdListBullet` |
| Syntax | `syntaxComment`, `syntaxKeyword`, `syntaxFunction`, `syntaxVariable`, `syntaxString`, `syntaxNumber`, `syntaxType`, `syntaxOperator`, `syntaxPunctuation` |
| Thinking | `thinkingOff`, `thinkingMinimal`, `thinkingLow`, `thinkingMedium`, `thinkingHigh`, `thinkingXhigh` |

## Background — `theme.bg(color, text)`

`selectedBg`, `userMessageBg`, `customMessageBg`, `toolPendingBg`, `toolSuccessBg`, `toolErrorBg`

## Styles

```typescript
theme.bold(text)
theme.italic(text)
theme.strikethrough(text)
```

## Markdown Rendering

```typescript
import { getMarkdownTheme } from '@mariozechner/pi-coding-agent'
import { Markdown } from '@mariozechner/pi-tui'

const md = new Markdown(content, 0, 0, getMarkdownTheme())
```

## Syntax Highlighting

```typescript
import { highlightCode, getLanguageFromPath } from '@mariozechner/pi-coding-agent'

const lang = getLanguageFromPath('file.ts')  // 'typescript'
const highlighted = highlightCode(code, lang, theme)
```
