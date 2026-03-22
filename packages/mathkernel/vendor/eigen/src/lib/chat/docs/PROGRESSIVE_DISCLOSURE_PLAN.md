# Progressive Disclosure Plan

> There's a lot of information. Make it work, don't reduce it.

## Philosophy

Progressive disclosure is not hiding information — it's **sequencing attention**.
The user sees what matters NOW, discovers depth ON DEMAND, and never feels
overwhelmed or surprised by missing functionality.

Three attention tiers, mapped to interaction modes:

## Tier Model

### Tier 1 — Glance (Always Visible)

The user should understand the conversation state in < 1 second.

| Element | Rationale |
|---------|-----------|
| Message body text | Core content — the conversation |
| Role icon (assistant only) | Who is speaking |
| Author name (assistant only) | Identity of agent |
| Streaming cursor | "Still thinking…" |
| Streaming border-left | Visual heartbeat |
| Thinking indicator (collapsed) | "Agent reasoned" — trigger text, not content |
| Tool block header (name + state badge) | "Tool X ran" — collapsed by default |
| Code block header (language + filename) | "Here's code" — shows what, not all |
| File attachment pill (name + icon) | "File attached" — clickable to expand |
| Inline task summary row | Task name + status badge |

### Tier 2 — Inspect (Hover / Focus)

User moves cursor over a message or presses focus keys.

| Element | Trigger | Animation |
|---------|---------|-----------|
| Timestamp | Hover message | `opacity 0→1, 150ms ease-out` |
| Footer actions (copy, retry, branch) | Hover message | `opacity 0→1, 150ms ease-out` |
| Model ID chip | Hover message | `opacity 0→1, 150ms ease-out` |
| Token usage summary (compact) | Hover message | `opacity 0→1, 150ms ease-out` |
| Tool I/O preview (first 3 lines) | Hover tool block header | Slide-down, `200ms ease-out` |

### Tier 3 — Explore (Click / Expand)

User explicitly requests more detail.

| Element | Trigger | Animation |
|---------|---------|-----------|
| Thinking content (full) | Click thinking trigger | Accordion expand, `200ms ease-out` |
| Tool input/output (full) | Click tool header | Accordion expand, `200ms ease-out` |
| Code block (full, scrollable) | Already visible if < 20 lines; click "Show more" for long blocks | Expand to max-height |
| Token usage ring + breakdown | Click summary | Expand inline, `200ms ease-out` |
| File preview (image/PDF) | Click file pill | Modal or inline expand |
| Inline task detail fields | Click task row | Accordion expand |
| Artifact card detail | Click card | Card expand animation |

## Implementation Strategy

### A. Hover-Only Metadata Row

Add a metadata row to each message that only appears on hover:

```tsx
{/* Tier 2 — hover metadata */}
<div className={cn(
  'flex items-center gap-2 mt-1',
  'opacity-0 group-hover/message:opacity-100',
  'transition-opacity duration-150',
)}>
  <span className="font-mono text-neutral-600" style={{ fontSize: '12px' }}>
    {timestamp}
  </span>
  {model && (
    <span className="font-mono text-neutral-700" style={{ fontSize: '12px' }}>
      {model}
    </span>
  )}
  {tokenUsage && (
    <span className="font-mono text-neutral-700" style={{ fontSize: '12px' }}>
      {totalTokens.toLocaleString()} tokens
    </span>
  )}
</div>
```

The `group-hover/message` requires a named group on the message shell:
`className="group/message"`

### B. Collapsed-by-Default Content Blocks

**Thinking blocks**: Currently `defaultOpen={true}` during streaming, then
auto-close after 1200ms. This is correct but the trigger text needs to be
more informative when collapsed:

```
▸ Thought for 2.1s    (collapsed)
▾ Thought for 2.1s    (expanded, shows content)
```

**Tool blocks**: Currently always show full I/O. Change to:

```
▸ read_file ✓          (collapsed — just name + status)
▾ read_file ✓          (expanded — shows input + output)
  Input: { path: "src/..." }
  Output: { content: "..." }
```

**Code blocks**: Show full for short blocks (≤ 12 lines), truncate for long:

```
┌ pressure-monitor.ts (typescript) ──── [Copy]
│ import { Effect, Stream } from "effect"
│ ...12 lines...
│ Effect.runPromise(monitor.pipe(...))
└────────────────────────────────────────
```

If > 12 lines, show first 8 + "Show N more lines" button.

### C. Token Usage: Compact Summary → Expandable Detail

**Compact (Tier 2, hover)**: `6,065 tokens • claude-sonnet-4`
**Full (Tier 3, click)**: Ring visualization + prompt/completion breakdown + cost

### D. File Attachments: Pill → Preview

**Pill (Tier 1)**: `📎 report.pdf (240 KB)`
**Preview (Tier 3, click)**: Image thumbnail or PDF icon + download link

## Interaction Matrix

| Component | Tier 1 | Tier 2 (hover) | Tier 3 (click) |
|-----------|--------|-----------------|-----------------|
| **Text** | Full body | — | — |
| **Thinking** | Trigger text | — | Full content |
| **Tool** | Name + status | I/O preview (3 lines) | Full I/O |
| **Code** | Header + truncated (≤12 lines full) | — | Full code |
| **File** | Pill (name + size) | — | Preview/download |
| **TokenUsage** | Hidden | Compact summary | Ring + breakdown |
| **Timestamp** | Hidden | Visible | — |
| **Footer Actions** | Hidden | Visible | — |
| **Model ID** | Hidden | Visible | — |
| **Task Row** | Name + badge | — | Detail fields |

## Files Changed

| File | Change |
|------|--------|
| `message-shell-root.tsx` | Add `group/message` class for hover scoping |
| `thread-view.tsx` | Token usage + timestamp → hover tier |
| `thinking-block-root.tsx` | Trigger text improvement |
| `tool-block-root.tsx` | Collapsed-by-default + accordion expand |
| `code-block-root.tsx` | Line truncation + "Show more" button |
| `token-usage-root.tsx` | Compact summary mode |
| `file-attachment-root.tsx` | Already pill-like, verify click expand |
