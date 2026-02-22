---
name: pi-tui
description: Build custom TUI components for pi extensions. Use when creating widgets, interactive viewers, overlays, tool renderers, or any visual component. Covers layout slots, component patterns, keyboard handling, and theming.
---

# Pi TUI Components

Build custom visuals for pi extensions.

## Layout

```
┌──────────────────────────────────────────────┐
│  HEADER                   setHeader()        │
├──────────────────────────────────────────────┤
│  CONVERSATION SCROLL                          │
│    tool_call  → renderCall()     INLINE       │
│    tool_result → renderResult()  INLINE       │
│    custom msg → messageRenderer  INLINE       │
├──────────────────────────────────────────────┤
│  WIDGET above             setWidget()        │
├──────────────────────────────────────────────┤
│  EDITOR                   setEditorComponent │
├──────────────────────────────────────────────┤
│  WIDGET below             setWidget(below)   │
├──────────────────────────────────────────────┤
│  FOOTER / STATUS          setFooter/Status   │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│  OVERLAY (floats)         custom(overlay)    │
│  CUSTOM (replaces editor) custom()           │
└──────────────────────────────────────────────┘
```

**Widget** = passive lines, no focus, persistent alongside editor.
**Custom** = modal, owns focus, calls `done()` to exit.
**Overlay** = floats on top, content visible behind.
**Inline** = scrolls with conversation history.

## Component Contract

```typescript
{
  render(width: number): string[]     // ANSI lines, each ≤ width
  handleInput?(data: string): void    // raw key events
  invalidate(): void                  // bust render cache
}
```

Return this from `ctx.ui.custom()`. Pi doesn't care how you make the strings.

## The One Rule

**Call `tui.requestRender()` after every state change.** Without it, nothing redraws.

## Quick Patterns

### Interactive Viewer (fullscreen custom)

```typescript
await ctx.ui.custom<void>((tui, theme, _kb, done) => {
  let selected = 0
  let cache: string[] | undefined

  function refresh() { cache = undefined; tui.requestRender() }

  return {
    render(width) {
      if (cache) return cache
      cache = [/* build lines with theme.fg(), truncateToWidth() */]
      return cache
    },
    handleInput(data) {
      if (matchesKey(data, 'q') || matchesKey(data, Key.escape)) { done(); return }
      if (matchesKey(data, Key.up)) { selected--; refresh() }
      if (matchesKey(data, Key.down)) { selected++; refresh() }
    },
    invalidate() { cache = undefined },
  }
})
```

### Auto-Fading Widget

```typescript
let timer: ReturnType<typeof setTimeout> | null = null
function flash(lines: string[]) {
  ctx.ui.setWidget('toast', lines, { placement: 'belowEditor' })
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => ctx.ui.setWidget('toast', undefined), 5000)
}
```

### Tool Rendering

```typescript
renderCall(args, theme) {
  return new Text(theme.fg('toolTitle', theme.bold('name ')) + theme.fg('muted', args.x), 0, 0)
},
renderResult(result, { expanded, isPartial }, theme) {
  if (isPartial) return new Text(theme.fg('warning', 'Working...'), 0, 0)
  return new Text(theme.fg('success', '✓ Done'), 0, 0)
}
```

## References

Deeper docs — read when you need them, not before:

- [references/slots.md](references/slots.md) — All 8 slots with full API signatures
- [references/patterns.md](references/patterns.md) — Selection, async, overlay, editor, footer patterns
- [references/keyboard.md](references/keyboard.md) — Key matching, modifiers, Key constants
- [references/theme.md](references/theme.md) — Full color palette, bg colors, styles
- [references/text.md](references/text.md) — truncateToWidth, visibleWidth, wrapTextWithAnsi
- [references/gotchas.md](references/gotchas.md) — The 7 things that will bite you

## See Also

- [pi-extension-dev](../pi-extension-dev/SKILL.md) — Debug, tmux, instrumentation
- [mcp-bridge](../mcp-bridge/SKILL.md) — MCP tool registration patterns
