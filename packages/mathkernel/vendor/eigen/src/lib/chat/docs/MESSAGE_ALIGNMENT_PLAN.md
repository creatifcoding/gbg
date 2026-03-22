# Message Alignment Plan

> User right, assistant left. Like every chat app since 2010.

## Current State

All messages render identically:
```
[icon] [header]
[body content]
[footer]
```

Left-aligned, full-width, `px-4 py-3`, `border-b` separator.

## Target State

### User Messages (Right-Aligned)

```
                          Message content here.
                          Maybe wraps to two lines.
                                            12:34 PM ← (hover only)
```

Styling:
- `ml-auto` — pushes to right
- `max-w-[80%]` — prevents full-width
- No background change — same pure-black canvas, position alone differentiates
- No border, no bubble — just right-aligned text
- `px-4 py-2.5` — slightly tighter than agent
- No role icon (it's you)
- No header cluster (your name is redundant)
- No severity rails
- Timestamp on hover below-right

### Assistant Messages (Left-Aligned)

```
┌─ ● Val ────────────────────────────────────────┐
│ [icon]  Response content with full fidelity.    │
│         Thinking blocks, code, tools, files.    │
│         Everything renders here.                │
│                                                  │
│         [ThinkingBlock]                          │
│         [CodeBlock]                              │
│         [ToolBlock]                              │
│                                                  │
│         12:34 PM • claude-sonnet-4 ← (hover)    │
│         [Copy] [Retry] [Branch]    ← (hover)    │
└──────────────────────────────────────────────────┘
```

Styling:
- `mr-auto` — stays left (default flex-start)
- `max-w-[85%]` — slightly wider than user (has more content)
- `bg-transparent` — no background needed
- Role icon rail on left
- Full header cluster
- Parts renderer + footer actions

### System Messages (Header Bar — NOT in thread)

System messages do NOT render in the thread scroll area.
They live in the top header bar / status band — already handled
by the frame chrome and connection-view components.

If a system message somehow enters the thread (edge case),
render as a muted centered notice, but this should be rare.

### Tool Messages (Left, Indented)

Tool result messages (standalone, not parts within an assistant message)
render like assistant messages but with tool-specific styling.

## Implementation

### Step 1: Message Shell — Role-Aware Layout

Transform `message-shell-root.tsx` from uniform layout to role-aware:

```tsx
const ROLE_ALIGNMENT: Record<ChatMessageRole, string> = {
  user:      'ml-auto',        // right
  assistant: 'mr-auto',        // left
  system:    'mx-auto',        // center
  tool:      'mr-auto',        // left
}

const ROLE_MAX_WIDTH: Record<ChatMessageRole, string> = {
  user:      'max-w-[80%]',
  assistant: 'max-w-[85%]',
  system:    'max-w-[90%]',
  tool:      'max-w-[85%]',
}

const ROLE_SHAPE: Record<ChatMessageRole, string> = {
  user:      'bg-transparent px-4 py-2.5',       // no bubble — position alone differentiates
  assistant: 'bg-transparent px-4 py-3',
  system:    'bg-transparent px-4 py-2',          // rare in-thread fallback only
  tool:      'bg-transparent px-4 py-3',
}
```

### Step 2: Thread View — Split User vs Assistant Renderers

In `thread-view.tsx`, create `UserMessage` component:

```tsx
function UserMessage({ message }: { message: ChatMessage }) {
  const parts = getMessageParts(message)
  return (
    <ChatMessageShellRoot role="user" className="group/message">
      <div className="flex-1 min-w-0">
        {parts.map((part, idx) => (
          <PartRenderer key={`${message.id}-part-${idx}`} part={part} isStreaming={false} isLatest={false} />
        ))}
        {/* Hover metadata */}
        <div className="flex justify-end gap-2 mt-1 opacity-0 group-hover/message:opacity-100 transition-opacity duration-150">
          <span className="font-mono text-neutral-600" style={{ fontSize: '12px' }}>
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>
    </ChatMessageShellRoot>
  )
}
```

### Step 3: Turn Gap Logic

In thread rendering, compute gap between messages:

```tsx
{resolvedMessages.map((msg, index) => {
  const prev = index > 0 ? resolvedMessages[index - 1] : null
  const isTurnChange = prev && prev.role !== msg.role
  const gapClass = isTurnChange ? 'mt-5' : 'mt-1'
  
  return (
    <div key={msg.id} className={gapClass}>
      {msg.role === 'operator'
        ? <UserMessage message={msg} />
        : <FullMessage message={msg} isLatest={index === messageCount - 1} tasks={...} />}
    </div>
  )
})}
```

### Step 4: Remove Per-Message Borders

In `message-shell-root.tsx`, remove:
```diff
- 'border-b border-neutral-800/30',
```

Spacing between messages (via `mt-5` / `mt-1`) replaces borders.
Keep streaming `border-l-2` — that's a status indicator, not a separator.

## Edge Cases

| Case | Handling |
|------|----------|
| User message with attachments | Right-aligned, attachments below text |
| User message with code paste | Right-aligned, code block renders inline |
| Multiple consecutive user messages | `mt-1` gap, forms visual paragraph |
| System message between turns | Centered, full `mt-5` gap both sides |
| Streaming assistant message | Left-aligned with pulse border |
| Empty message (error state) | Show error badge in alignment position |

## Visual Reference: Before/After

**Before:**
```
[icon] Val                    12:34 PM
Response text here
───────────────────────────────────────
[icon] Prime                  12:35 PM
User text here  
───────────────────────────────────────
[icon] Val                    12:36 PM
Response with code and tools
───────────────────────────────────────
```

**After:**
```
● Val
  Response text here



                         User text here



● Val
  Response with code, tools, thinking…
  ▸ Thought for 2.1s
  ┌ effect-monitor.ts ──── [Copy]
  │ const monitor = ...
  └─────────────────────
```
