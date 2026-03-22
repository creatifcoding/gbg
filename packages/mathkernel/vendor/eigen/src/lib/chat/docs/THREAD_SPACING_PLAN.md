# Thread Spacing & Visual Rhythm Plan

> Apple meets military industrial complex.
> Dense, purposeful, breathable. Every pixel earns its place.

## Problem Statement

The current thread renders all messages left-aligned in a uniform column with
identical padding, border-bottom separators, and no alignment differentiation
between user and assistant. The result reads like a logfile, not a conversation.

Key issues:
1. **No alignment semantics** — user and assistant messages share identical layout
2. **Uniform padding** — `px-4 py-3` on every message regardless of role
3. **Border noise** — `border-b border-neutral-800/30` on every message adds visual clutter
4. **Flat vertical rhythm** — no breathing room between conversational turns
5. **SeverityRails icon rail** adds left bulk to every message including user's own

## Design Principles

### Apple: Restraint, Clarity, Breathing Room
- **8pt grid** — all spacing derived from 4/8/12/16/24/32/48 scale
- **Generous negative space** between conversation turns
- **Invisible structure** — alignment communicates role, not decoration
- **Progressive disclosure** — metadata fades in on hover, not always visible
- **Soft precision** — rounded corners, subtle shadows, no hard borders

### Military: Density, Hierarchy, Authority
- **Information density where it matters** — tool calls, code, tasks stay dense
- **Role authority via position** — user commands from the right, agent reports from the left
- **Status indicators** — streaming pulse, completion markers, severity rails
- **Monospace discipline** — timestamps, model IDs, token counts in mono
- **Color coding** — role colors as the primary navigational signal

### Progressive Disclosure (3-tier)
| Tier | Visibility | Elements |
|------|-----------|----------|
| **Always** | Default | Role icon, author name, message body, streaming cursor |
| **On hover** | Fade-in | Timestamp, footer actions (copy, retry), model ID |
| **On expand** | Click-to-reveal | Token usage details, thinking content, tool I/O |

## Alignment Model

```
┌─────────────────────────────────────────────────────┐
│                    Thread Container                   │
│                                                       │
│  ┌─ Agent message ──────────────────┐                │
│  │ [icon] Name                      │                │
│  │ Message body text flows here     │                │
│  │ and wraps at max-width.          │                │
│  └──────────────────────────────────┘                │
│                                                       │
│                ┌─── User message ──────────────────┐ │
│                │                    Message body ←  │ │
│                │                    right-aligned   │ │
│                └──────────────────────────────────┘  │
│                                                       │
│  ┌─ Agent message ──────────────────┐                │
│  │ [icon] Val                        │                │
│  │ Response with thinking, code,     │                │
│  │ tool calls, file attachments...   │                │
│  └──────────────────────────────────┘                │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Rules

| Role | Alignment | Max Width | Icon Rail | Header | Background |
|------|-----------|-----------|-----------|--------|------------|
| `user` | `flex-end` (right) | `max-w-[80%]` | None | Hidden (name redundant — it's you) | `bg-neutral-800/20` subtle tint |
| `assistant` | `flex-start` (left) | `max-w-[85%]` | Role icon | Visible | Transparent |
| `system` | `center` | `max-w-[90%]` | None | System badge | `bg-amber-500/[0.03]` |
| `tool` | `flex-start` (left) | `max-w-[85%]` | Tool icon | Tool name | `bg-violet-500/[0.03]` |

### User Messages — The "Sent" Bubble

User messages get Apple iMessage treatment:
- Right-aligned within the thread
- Subtle background tint (`bg-neutral-800/20`)
- Rounded corners (`rounded-2xl`)
- **No role icon** — it's the user, they know who they are
- **No header cluster** — author name suppressed
- Compact padding: `px-4 py-2.5`
- Timestamp appears on hover only

### Assistant Messages — The "Report"

Assistant messages remain left-aligned with full fidelity:
- Role icon rail (streaming pulse when active)
- Author name + streaming badge in header
- Full parts rendering (thinking, code, tool, file)
- Footer actions on hover
- Larger vertical padding: `py-3`

## Spacing Scale (8pt Grid)

| Token | Value | Usage |
|-------|-------|-------|
| `--thread-gap-turn` | `20px` | Gap between conversation turns (user→agent or agent→user) |
| `--thread-gap-same` | `4px` | Gap between consecutive same-role messages |
| `--thread-pad-x` | `16px` | Horizontal thread padding |
| `--thread-pad-y` | `12px` | Vertical thread padding (top/bottom) |
| `--msg-pad-x` | `16px` | Message horizontal padding |
| `--msg-pad-y-user` | `10px` | User message vertical padding |
| `--msg-pad-y-agent` | `12px` | Agent message vertical padding |
| `--block-gap` | `8px` | Gap between content blocks (thinking→text→code) |
| `--block-margin-y` | `6px` | Vertical margin on content blocks |

### Turn Gap vs Same-Role Gap

When the role changes (user→agent or agent→user), use `--thread-gap-turn` (20px).
When consecutive messages share the same role, use `--thread-gap-same` (4px).

This creates **visual paragraphing** — you can see conversational turns at a glance.

## Border Strategy

**Current**: `border-b border-neutral-800/30` on every message — creates a ruled-paper effect.

**Proposed**: Remove per-message borders entirely. Use **spacing** as the separator.

| Element | Border | Rationale |
|---------|--------|-----------|
| Message shell | None | Spacing separates turns |
| Streaming message | `border-l-2 border-l-cyan-500/40` | Keep — indicates live stream |
| Thinking block | `border border-violet-500/20` | Keep — collapsible container needs boundary |
| Tool block | `border border-neutral-800` | Keep — interactive container |
| Code block | `border border-neutral-800` | Keep — content boundary |
| System message | `border border-amber-500/10` | Add — distinguishes system from assistant |

## Content Block Spacing

Within a message, blocks stack with `gap-2` (8px):

```
[Header Cluster]       ← mb-1 (4px)
[ThinkingBlock]        ← my-1.5 (6px each)
[TextPart]             ← no extra margin (text flows naturally)
[CodeBlock]            ← my-2 (8px each)
[TextPart]
[FileAttachment]       ← my-1.5
[FileAttachment]       ← my-1.5
[TokenUsage]           ← mt-2 (8px top), always last
[FooterActions]        ← mt-2, opacity-0 → hover:opacity-100
```

## Implementation Touchpoints

### 1. `message-shell-root.tsx`
- Add `data-alignment` attribute (`left` | `right` | `center`)
- Remove `border-b` — spacing replaces borders
- Add role-aware max-width constraints
- Add role-aware flex alignment

### 2. Thread-view `FullMessage` / `UserMessage` (new)
- Split `FullMessage` into `AssistantMessage` and `UserMessage`
- UserMessage: right-aligned, no icon rail, no header, bubble styling
- AssistantMessage: current FullMessage with adjusted spacing

### 3. Thread-view gap logic
- Compute `prevRole` for each message
- Apply `--thread-gap-turn` or `--thread-gap-same` dynamically

### 4. `header-cluster-root.tsx`
- Timestamp moves into hover-only tier
- Add `data-disclosure="hover"` for progressive disclosure

### 5. `footer-actions-root.tsx`
- Already hover-only (`opacity-0 group-hover:opacity-100`) ✓
- Verify `group` class is on the correct ancestor

### 6. `severity-rails-root.tsx`
- User messages: suppress entirely
- Assistant/tool: keep as-is

### 7. `body-content-root.tsx`
- No changes needed — text rendering is clean

## Animation Considerations (Emil Kowalski principles)

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Hover metadata reveal | `opacity 0→1` | `150ms` | `ease-out` |
| Streaming border pulse | `opacity` cycle | `900ms` | `ease-in-out` |
| New message entrance | `opacity + translateY(8px)` | `200ms` | `ease-out` |
| Token usage expand | `height auto + opacity` | `200ms` | `ease-out` |
| `prefers-reduced-motion` | Opacity fallback only | — | — |

## Files Changed

| File | Change Type | Impact |
|------|------------|--------|
| `message-shell-root.tsx` | Major refactor | Alignment + border removal |
| `thread-view.tsx` | Major refactor | UserMessage split, gap logic |
| `header-cluster-root.tsx` | Minor | Hover disclosure |
| `severity-rails-root.tsx` | Minor | Conditional rendering |
| `footer-actions-root.tsx` | None | Already correct |
| `body-content-root.tsx` | None | Already correct |
| `tokens.ts` | Add spacing tokens | New CSS custom properties |
