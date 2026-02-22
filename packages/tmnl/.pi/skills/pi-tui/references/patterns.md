# TUI Patterns

Copy-paste patterns. Don't build from scratch.

## Selection Dialog (SelectList)

```typescript
import { DynamicBorder } from '@mariozechner/pi-coding-agent'
import { Container, type SelectItem, SelectList, Text } from '@mariozechner/pi-tui'

const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
  const container = new Container()
  container.addChild(new DynamicBorder((s: string) => theme.fg('accent', s)))
  container.addChild(new Text(theme.fg('accent', theme.bold('Title')), 1, 0))

  const items: SelectItem[] = [
    { value: 'a', label: 'Option A', description: 'First' },
    { value: 'b', label: 'Option B' },
  ]

  const selectList = new SelectList(items, Math.min(items.length, 10), {
    selectedPrefix: (t) => theme.fg('accent', t),
    selectedText: (t) => theme.fg('accent', t),
    description: (t) => theme.fg('muted', t),
    scrollInfo: (t) => theme.fg('dim', t),
    noMatch: (t) => theme.fg('warning', t),
  })
  selectList.onSelect = (item) => done(item.value)
  selectList.onCancel = () => done(null)
  container.addChild(selectList)
  container.addChild(new DynamicBorder((s: string) => theme.fg('accent', s)))

  return {
    render: (w) => container.render(w),
    invalidate: () => container.invalidate(),
    handleInput: (data) => { selectList.handleInput(data); tui.requestRender() },
  }
})
```

## Async with Cancel (BorderedLoader)

```typescript
import { BorderedLoader } from '@mariozechner/pi-coding-agent'

const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
  const loader = new BorderedLoader(tui, theme, 'Fetching...')
  loader.onAbort = () => done(null)

  fetchData(loader.signal)
    .then((data) => done(data))
    .catch(() => done(null))

  return loader
})
```

## Settings Toggles (SettingsList)

```typescript
import { getSettingsListTheme } from '@mariozechner/pi-coding-agent'
import { Container, type SettingItem, SettingsList, Text } from '@mariozechner/pi-tui'

const items: SettingItem[] = [
  { id: 'verbose', label: 'Verbose', currentValue: 'off', values: ['on', 'off'] },
]

await ctx.ui.custom((_tui, theme, _kb, done) => {
  const container = new Container()
  container.addChild(new Text(theme.bold('Settings'), 1, 1))

  const list = new SettingsList(items, 15, getSettingsListTheme(),
    (id, val) => ctx.ui.notify(`${id}=${val}`, 'info'),
    () => done(undefined),
    { enableSearch: true },
  )
  container.addChild(list)

  return {
    render: (w) => container.render(w),
    invalidate: () => container.invalidate(),
    handleInput: (data) => list.handleInput?.(data),
  }
})
```

## Overlay (Floating Panel)

```typescript
await ctx.ui.custom<void>(
  (tui, theme, _kb, done) => ({
    render(width) { return ['Floating panel content'] },
    handleInput(data) { if (matchesKey(data, Key.escape)) done() },
    invalidate() {},
  }),
  {
    overlay: true,
    overlayOptions: { anchor: 'top-right', width: '50%', margin: 2 },
  }
)
```

## Custom Editor (Vim Mode)

```typescript
import { CustomEditor } from '@mariozechner/pi-coding-agent'
import { matchesKey, truncateToWidth } from '@mariozechner/pi-tui'

class VimEditor extends CustomEditor {
  private mode: 'normal' | 'insert' = 'insert'

  handleInput(data: string): void {
    if (matchesKey(data, 'escape') && this.mode === 'insert') {
      this.mode = 'normal'; return
    }
    if (this.mode === 'normal' && data === 'i') {
      this.mode = 'insert'; return
    }
    super.handleInput(data)  // MUST call for app keybindings
  }

  render(width: number): string[] {
    const lines = super.render(width)
    if (lines.length > 0) {
      const label = this.mode === 'normal' ? ' NORMAL ' : ' INSERT '
      const last = lines[lines.length - 1]!
      lines[lines.length - 1] = truncateToWidth(last, width - label.length, '') + label
    }
    return lines
  }
}

// Install:
ctx.ui.setEditorComponent((tui, theme, kb) => new VimEditor(theme, kb))
```

## Custom Message Renderer

```typescript
pi.registerMessageRenderer('my-type', (message, { expanded }, theme) => {
  let text = theme.fg('accent', `[${message.customType}] `) + message.content
  if (expanded && message.details) {
    text += '\n' + theme.fg('dim', JSON.stringify(message.details, null, 2))
  }
  return new Text(text, 0, 0)
})

// Send:
pi.sendMessage({ customType: 'my-type', content: 'Hello', display: true, details: {} })
```

## Custom Footer

```typescript
ctx.ui.setFooter((tui, theme, footerData) => ({
  render(width) {
    const branch = footerData.getGitBranch() || 'no git'
    return [`${theme.fg('accent', branch)} | custom footer`]
  },
  invalidate() {},
  dispose: footerData.onBranchChange(() => tui.requestRender()),
}))
```
