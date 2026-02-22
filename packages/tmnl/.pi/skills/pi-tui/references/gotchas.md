# TUI Gotchas

## 1. No requestRender → nothing redraws

**Symptom**: Keys work but screen doesn't update.

**Fix**: Call `tui.requestRender()` after every state mutation in `handleInput`.

```typescript
handleInput(data) {
  if (matchesKey(data, Key.up)) {
    selected--
    cache = undefined
    tui.requestRender()  // ← THIS
  }
}
```

## 2. Lines exceed width → garbled output

**Symptom**: Text wraps weirdly, lines overlap.

**Fix**: Every line from `render()` must be ≤ `width` visible chars.

```typescript
lines.push(truncateToWidth(text, width))
```

## 3. Theme cached in constructor → stale colors

**Symptom**: Theme change doesn't affect your component.

**Fix**: Rebuild themed content in `invalidate()`, not just clear cache.

```typescript
invalidate() {
  this.cachedLines = undefined
  this.themedTitle = theme.fg('accent', this.title)  // rebuild
}
```

## 4. Tools registered in session_start → not available

**Symptom**: Custom tools don't appear for LLM.

**Fix**: Register tools synchronously in the extension body, not in async event handlers.

```typescript
// WRONG
pi.on('session_start', async () => { pi.registerTool({...}) })

// RIGHT
export default function(pi) { pi.registerTool({...}) }
```

## 5. StringEnum not Type.Union → Google API breaks

**Symptom**: Tool works with Anthropic but fails with Google.

**Fix**: Use `StringEnum` from `@mariozechner/pi-ai`.

```typescript
import { StringEnum } from '@mariozechner/pi-ai'
action: StringEnum(['list', 'add'] as const)  // not Type.Literal
```

## 6. Overlay reference held after close → stale

**Symptom**: Overlay doesn't work second time.

**Fix**: Create fresh instances. Overlays dispose on close.

```typescript
// WRONG: reusing instance
// RIGHT: factory function
const show = () => ctx.ui.custom((_, __, ___, done) =>
  new MyPanel(done), { overlay: true })
```

## 7. Widget persists forever → stale data

**Symptom**: Widget shows boot-time data indefinitely.

**Fix**: Auto-fade with setTimeout, or clear on specific conditions.

```typescript
setTimeout(() => ctx.ui.setWidget('id', undefined), 5000)
```

## 8. console.log in extensions → pollutes pi stdout

**Symptom**: Extension output garbles pi TUI, especially on reload.

**Fix**: Write to file or use event bus. Never `console.log`.

```typescript
import * as fs from 'node:fs'
function log(msg: string) {
  fs.appendFileSync('.pi/my-ext.log', `${new Date().toISOString()} ${msg}\n`)
}
```
