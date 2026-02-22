# TUI Placement Slots

## Full Slot Table

| Slot | API | Focus? | Lifecycle | Use Case |
|------|-----|--------|-----------|----------|
| Header | `ctx.ui.setHeader(fn)` | No | Session start | Branding, session name |
| Inline (tool) | `renderCall()` / `renderResult()` on registerTool | No | Per tool call | Tool output display |
| Inline (msg) | `pi.registerMessageRenderer(type, fn)` | No | Per message | Custom message types |
| Widget above | `ctx.ui.setWidget(id, lines)` | No | Persistent | Plans, todos, context |
| Widget below | `ctx.ui.setWidget(id, lines, {placement:'belowEditor'})` | No | Persistent | Logs, metrics |
| Editor | `ctx.ui.setEditorComponent(factory)` | **Yes** (IME) | Persistent | Vim mode, custom input |
| Footer | `ctx.ui.setFooter(fn)` | No | Persistent | Cost, model, git branch |
| Status | `ctx.ui.setStatus(id, text)` | No | Persistent | Per-extension status line |
| Custom | `ctx.ui.custom(factory)` | **Yes** | Modal | Games, viewers, wizards |
| Overlay | `ctx.ui.custom(factory, {overlay:true})` | **Yes** | Modal, floats | Dialogs, side panels |

## Widget API

```typescript
// String array
ctx.ui.setWidget('my-id', ['Line 1', 'Line 2'])
ctx.ui.setWidget('my-id', ['Line 1'], { placement: 'belowEditor' })

// Component factory
ctx.ui.setWidget('my-id', (tui, theme) => ({
  render: () => [theme.fg('accent', '● Active')],
  invalidate: () => {},
}))

// Clear
ctx.ui.setWidget('my-id', undefined)
```

## Custom UI API

```typescript
// Fullscreen (replaces editor)
const result = await ctx.ui.custom<T>((tui, theme, keybindings, done) => {
  return { render, handleInput, invalidate }
})

// Overlay (floats)
const result = await ctx.ui.custom<T>(factory, {
  overlay: true,
  overlayOptions: {
    anchor: 'top-right',   // center, top-left, top-center, top-right, etc.
    width: '50%',          // number or percentage
    minWidth: 40,
    maxHeight: '80%',
    margin: 2,             // or { top, right, bottom, left }
    visible: (w, h) => w >= 80,
  },
  onHandle: (handle) => { /* handle.setHidden(bool), handle.hide() */ },
})
```

## Footer API

```typescript
// Status line (in existing footer)
ctx.ui.setStatus('my-ext', theme.fg('accent', '● active'))
ctx.ui.setStatus('my-ext', undefined)

// Replace entire footer
ctx.ui.setFooter((tui, theme, footerData) => ({
  render(width) { return [`custom footer`] },
  invalidate() {},
  dispose: footerData.onBranchChange(() => tui.requestRender()),
}))
ctx.ui.setFooter(undefined)  // restore default

// Working message (during streaming)
ctx.ui.setWorkingMessage('Thinking...')
ctx.ui.setWorkingMessage()  // restore default
```

## Editor API

```typescript
ctx.ui.setEditorText('prefill')
ctx.ui.getEditorText()
ctx.ui.setEditorComponent((tui, theme, kb) => new MyEditor(theme, kb))
ctx.ui.setEditorComponent(undefined)  // restore default
```

## Tool Expansion

```typescript
ctx.ui.getToolsExpanded()       // boolean
ctx.ui.setToolsExpanded(true)   // toggle Ctrl+O state
```
