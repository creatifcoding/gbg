# MorphChat / Chat Library Gap Analysis — ai-elements as Reference

> **Date**: 2026-02-19
> **Reference**: `src/components/ai-elements/` (Vercel AI Elements, scaffolded via CLI)
> **Subject**: `src/lib/chat/` (TMNL Chat Components) + `src/lib/morphchat/` (Orchestration Layer)

---

## Executive Summary

The `src/lib/chat/` library is a **deep compound component system** — message shells, severity rails, header clusters, footer actions, inline task shells, and a full composer. It's more granular than AI Elements. But it's **structurally flat** — every message is a string blob rendered through the same pipeline.

`src/lib/morphchat/` adds **adaptive orchestration** (spec-driven presets, XState machine, adapter pattern) — something AI Elements has **no equivalent for**. MorphChat is architecturally superior at the orchestration level.

The gap is in **specialized content blocks** — AI Elements ships 20 purpose-built components for reasoning, tools, code, citations, artifacts, plans, queues, and confirmations. We have **zero** of these. We render everything as text.

---

## 1. Component Inventory Comparison

### AI Elements Components (20 files)
```
conversation.tsx     — StickToBottom wrapper + empty state + scroll button
message.tsx          — Message shell, content, actions, branching, attachments, toolbar
prompt-input.tsx     — Full composer with provider, attachments, speech, commands
reasoning.tsx        — Collapsible thinking block with auto-close + duration
tool.tsx             — Tool invocation card with state badges
confirmation.tsx     — Human-in-the-loop approval UI
chain-of-thought.tsx — Multi-step reasoning with search results
code-block.tsx       — Shiki syntax highlighting with copy button
artifact.tsx         — Artifact panel (header, content, actions)
plan.tsx             — Streaming plan card
queue.tsx            — Message/todo queue (sections, items, indicators)
context.tsx          — Token usage/cost display with progress ring
sources.tsx          — Collapsible citation list
inline-citation.tsx  — Inline text citation with hover card carousel
suggestion.tsx       — Prompt suggestion chips (horizontal scroll)
checkpoint.tsx       — Conversation bookmark
shimmer.tsx          — Streaming text shimmer effect
loader.tsx           — Animated spinner
task.tsx             — Search task with file badges
```

### TMNL Chat Components (100+ files across chat/ + morphchat/)

**Message Layer** (`src/lib/chat/msg/`):
```
message-shell/       — Root + context (role, streaming, status)
header-cluster/      — Role badge, timestamp, streaming indicator
body-content/        — Text content + stream cursor
footer-actions/      — Action buttons group
severity-rails/      — Role icon rail (color-coded gutter)
attachment-lane/     — Attachment slots (artifact, task thread, badges, telemetry)
iconography/         — Role icon map + precision settings
inline-task-detail/  — Task badge, fields, deps, status, schema fields
inline-task-shell/   — Shell root, expand band, metrics band, row, search band, thread band
inline-task-row.tsx  — Task list row
inline-task-types.ts — AgentTask type + status enum
```

**Composer Layer** (`src/lib/chat/composer/`):
```
composer-root.tsx         — Compound root with context
composer-textarea.tsx     — Auto-grow textarea
composer-toolbar.tsx      — Toolbar with groups/dividers
composer-send-button.tsx  — Send button
composer-action-button.tsx — Generic action button
composer-thinking-level.tsx — 4-level thinking toggle
composer-mode-toggle.tsx   — Mode switch
composer-context-chips.tsx — Hashtag/context/pending chips
```

**Shell Layer** (`src/lib/chat/shell/`):
```
shell-root.tsx        — Main layout container
header-band/          — 12 files: title, subtitle, badges, controls, agent selector, model selector, connection badge, session cluster, center/left/right slots
thread-band/          — Scroll container with useTailFollow
composer-band/        — Composer slot
command-band/         — Command palette slot
ornament-layer/       — Decorative overlay slot
overlay-layer/        — Modal overlay slot
slot-guards.tsx       — Conditional slot rendering
geometry-contract.ts  — Layout constants
scroll-contract.ts    — Scroll config
```

**Other** (`src/lib/chat/`):
```
card/           — Artifact card (root, header, body, actions, metrics)
banner/         — Interruption banner
btn/            — Button primitives (command, pause, reconnect, send, transport)
empty/          — Empty state
frame/          — Frame corners
selector/       — Agent selector compound (root, trigger, menu, option, context)
status/         — Connection badge, telemetry pill
tokens.ts       — Design tokens
```

**MorphChat** (`src/lib/morphchat/`):
```
schemas/        — Surface spec, message types, adapter types, skin types
specs/          — 8 presets (conductor, dock, dialog, widget, spotlight, embed, monitor, card)
adapters/       — 6 adapters (mock, harness, conductor, replay, static, types)
atoms/          — Registry, data atoms, surface atoms
machines/       — XState surface machine + STX
hooks/          — useMorphChat, useAdapterState, useHarnessAdapter, useKeyboardShortcuts, useMorphTransition, useSurfaceMachine
components/     — 15 view components (thread, composer, connection, frame, model selector, agent selector, inline tasks, command band, artifact cards, morph overlay, surface root/content/context, status banner, tail controls)
skins/          — TMNL skin
```

### Summary Count

| Category | AI Elements | TMNL Chat + MorphChat |
|---|---|---|
| Total files | 20 | 100+ |
| Total LOC | ~4,600 | ~12,000+ |
| Message rendering | 1 component + branching | Full compound hierarchy |
| Composer | 1 mega-component (1413 LOC) | 9 modular compounds |
| Specialized blocks | 13 (reasoning, tool, code, etc.) | **0** |
| Orchestration | **0** | Full spec-driven adaptive system |
| Adapters | **0** (delegates to useChat) | 6 adapter implementations |
| State machines | **0** | XState surface machine |
| Design tokens | Tailwind vars | Custom token system |

---

## 2. Pattern Analysis

### AI Elements: Flat Compound Components
Every component follows the same pattern:
```tsx
// Context for internal state
const ReasoningContext = createContext<Value | null>(null)

// Root provides context
export const Reasoning = memo(({ children, ...props }) => (
  <ReasoningContext.Provider value={...}>
    <Collapsible>{children}</Collapsible>
  </ReasoningContext.Provider>
))

// Subcomponents consume context
export const ReasoningTrigger = memo(({ children }) => {
  const { isStreaming, duration } = useReasoning()
  return <CollapsibleTrigger>{...}</CollapsibleTrigger>
})

export const ReasoningContent = memo(({ children }) => (
  <CollapsibleContent>
    <Streamdown>{children}</Streamdown>
  </CollapsibleContent>
))
```

**Key characteristics:**
- All `memo`-wrapped
- All use `displayName`
- All export typed props
- All extend HTML/Radix component props
- No Effect, no atoms, no XState — pure React

### TMNL: Deep Compound + Effect + Atoms
Our message components follow a richer pattern:
```tsx
// Context for message state
const MessageShellContext = createContext<ShellState>(...)

// Root provides state derived from props
export function ChatMessageShellRoot({ role, streaming, children }) {
  return (
    <MessageShellContext.Provider value={{ role, streaming }}>
      <div data-slot="message-shell" className={cn(...)}>
        {children}
      </div>
    </MessageShellContext.Provider>
  )
}
```

MorphChat adds orchestration:
```tsx
// Spec selects renderer
switch (spec.thread) {
  case 'full': return <FullMessage ... />
  case 'compact': return <CompactMessage ... />
  // etc.
}
```

**Key characteristics:**
- Compound pattern with React Context
- `data-slot` attributes on every root element
- MorphChat selects compound composition per spec axis
- Adapter atoms are the state source (not props/hooks)

### Gap: Our compounds are **layout-focused** (shell, rails, bands). AI Elements compounds are **content-focused** (reasoning, tool, code). We need both.

---

## 3. Missing Content Block Components

These are the **highest-value gaps** — components that render specific AI response content types.

### 3a. Reasoning / Thinking Block

**AI Elements**: `<Reasoning>` — 180 LOC
- Collapsible with auto-open during streaming
- Auto-close after streaming ends (1s delay)
- Duration tracking (started → ended → "Thought for N seconds")
- Shimmer effect while streaming
- Controllable open state

**TMNL**: Nothing. The `assistant_thinking_delta` events from the harness are either:
1. Ignored entirely, or
2. Concatenated into `content` string (losing the thinking/text boundary)

**Proposed**: `src/lib/chat/msg/thinking-block/`
```
thinking-block-root.tsx     — Collapsible container with auto-open/close
thinking-block-trigger.tsx  — "Thinking..." shimmer → "Thought for Ns" label
thinking-block-content.tsx  — Streaming markdown content
index.ts                    — Barrel
```

### 3b. Tool Invocation Block

**AI Elements**: `<Tool>` — 165 LOC
- State-driven badges (Pending → Running → Awaiting Approval → Completed/Error/Denied)
- Collapsible input (JSON params) and output (JSON/text/React element)
- Separate `<Confirmation>` component for approval flow

**TMNL**: Nothing. The `tool_event` harness events are emitted but never reach the UI. The `PiAiToolRuntime` exists server-side but has no client rendering.

**Proposed**: `src/lib/chat/msg/tool-block/`
```
tool-block-root.tsx       — Collapsible card with state context
tool-block-header.tsx     — Tool name + state badge
tool-block-input.tsx      — JSON parameter display
tool-block-output.tsx     — Result display (JSON/text/error)
tool-block-approval.tsx   — Accept/Reject buttons for approval-requested state
index.ts                  — Barrel
```

### 3c. Code Block

**AI Elements**: `<CodeBlock>` — 178 LOC
- Shiki syntax highlighting (dual theme: light + dark)
- Line numbers (optional)
- Copy button with "copied" feedback
- Context for code value (copy button reads from context)

**TMNL**: Raw markdown blocks. No syntax highlighting. No copy button.

**Proposed**: `src/lib/chat/msg/code-block/`
```
code-block-root.tsx     — Container with Shiki rendering
code-block-copy.tsx     — Copy button with feedback
code-block-header.tsx   — Language label + filename
index.ts                — Barrel
```

### 3d. Context / Token Usage

**AI Elements**: `<Context>` — 408 LOC
- SVG ring progress indicator (used/total tokens)
- HoverCard with detailed breakdown (input/output/reasoning/cache tokens)
- Per-category cost calculation via `tokenlens`
- Total cost footer

**TMNL**: The harness emits `chat:v2/usage` events with full token + cost data. No UI.

**Proposed**: `src/lib/chat/status/token-usage/`
```
token-usage-ring.tsx     — SVG progress ring
token-usage-detail.tsx   — HoverCard with breakdown
token-usage-cost.tsx     — Cost calculation display
index.ts                 — Barrel
```

### 3e. Sources / Citations

**AI Elements**: `<Sources>` (77 LOC) + `<InlineCitation>` (287 LOC)
- Collapsible source list
- Inline text citations with hover cards
- Carousel for multiple sources per citation
- Quote blocks

**TMNL**: Not implemented. Would require markdown parser augmentation.

**Lower priority** — depends on harness emitting source/citation events.

---

## 4. Composer Gaps

### 4a. File Attachment Pipeline

**AI Elements**: Complete in `prompt-input.tsx`:
```
input[type=file] → FileList → blob URL → state
Drag/Drop → FileList → state
Paste → clipboardData → state
Submit → blob URL → data URL conversion → onSubmit({text, files})
Unmount → revokeObjectURL (memory cleanup)
```

**TMNL**: Schema exists (`ChatAttachment` in `message-types.ts`), `SendParams` accepts `attachments`, but **no UI pipeline** to create/manage them.

**Proposed**: `src/lib/chat/composer/attachments/`
```
attachment-provider.tsx    — State management for files (add/remove/clear)
attachment-drop-zone.tsx   — Drag/drop handler (form-level + global option)
attachment-paste.tsx       — Clipboard paste handler
attachment-preview.tsx     — Thumbnail/label with remove button
attachment-submit.tsx      — blob→dataURL conversion on submit
index.ts                   — Barrel
```

### 4b. IME Composition Guard

**AI Elements**: Handles CJK input correctly:
```tsx
const [isComposing, setIsComposing] = useState(false)
// ...
onCompositionStart={() => setIsComposing(true)}
onCompositionEnd={() => setIsComposing(false)}
onKeyDown={(e) => {
  if (e.key === 'Enter') {
    if (isComposing || e.nativeEvent.isComposing) return
    // ...
  }
}}
```

**TMNL**: No IME guard. Enter during CJK composition will incorrectly submit.

**Fix**: Add `isComposing` state to `composer-textarea.tsx`.

### 4c. Speech-to-Text

**AI Elements**: Full Web Speech API integration:
```tsx
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
speechRecognition.continuous = true
speechRecognition.interimResults = true
```

**TMNL**: Mic icon button exists but does nothing.

**Priority**: P3 — nice to have but not blocking.

---

## 5. MorphChat Advantages (Not in AI Elements)

These are capabilities we have that AI Elements does **not** provide:

| Capability | Description |
|---|---|
| **Spec-driven presets** | 8 embedding contexts (conductor, dock, dialog, widget, spotlight, embed, monitor, card) with 9 feature axes each |
| **XState surface machine** | Lifecycle state management for morph transitions |
| **Adapter pattern** | 6 backend adapters (mock, harness, conductor, replay, static, types) — AI Elements has zero |
| **Transfer system** | Drag task references between surfaces — unique to TMNL |
| **Inline task system** | Full task shells with expand/collapse, metrics, search, virtualization |
| **Agent selector** | Multi-agent routing with compound dropdown/tabs modes |
| **Model selector** | Full server-to-client pipeline with auth gating |
| **Connection lifecycle** | Full connection state machine (disconnected/connecting/connected/reconnecting/error) |
| **Keyboard shortcuts** | Scoped by spec axis (full/minimal/disabled) |
| **Frame chrome** | Decorative corners, backdrop blur, ornament layer |
| **Effect-based operations** | `adapter.send()` returns `Effect<void>` — composable, cancellable, traceable |
| **Severity rails** | Color-coded role gutters with role icons |
| **Thread modes** | 5 renderers (full/compact/stream-only/log/card) per message |

---

## 6. Shared Pattern Observations

### Both Use
- `motion/react` for animations (AI Elements: `<Shimmer>`, TMNL: widespread)
- `lucide-react` for icons
- `cn()` utility for class merging
- `createContext` + compound components
- Tailwind CSS for styling
- `ComponentProps<>` for typed prop extension

### Key Differences
| Aspect | AI Elements | TMNL |
|---|---|---|
| State management | `useState` + `useContext` | `effect-atom` + `Atom.make()` |
| Side effects | `useEffect` + `useCallback` | `Effect.gen` + `Effect.runSync` |
| Type system | TypeScript interfaces | Effect Schema (runtime validated) |
| Styling | shadcn/ui components | Custom compounds + Tailwind |
| Streaming markdown | `streamdown` library | Raw content string |
| Syntax highlighting | `shiki` | None |
| Scroll | `use-stick-to-bottom` | Custom `useTailFollow` |

### Inference: `streamdown` for Markdown Rendering

AI Elements uses the `streamdown` library for streaming markdown rendering. It's built for AI chat specifically — handles partial markdown, streaming tokens, and incremental DOM updates. Our `ChatMessageBodyContent.Root` just renders raw text. Integrating `streamdown` or similar would immediately improve message rendering fidelity.

---

## 7. Recommended Roadmap

### Phase A — Structured Message Parts (Foundation)
1. Add `ChatMessagePart` union to `src/lib/morphchat/schemas/message-types.ts`
2. Update `ChatMessage` schema to include `parts` field (backwards compat: `content` derived from text parts)
3. Update harness adapter to populate `parts` from `HarnessEvent` stream
4. Update `ThreadView.FullMessage` to render parts instead of flat content

### Phase B — Content Block Components
5. `src/lib/chat/msg/thinking-block/` — Reasoning/thinking display
6. `src/lib/chat/msg/tool-block/` — Tool invocation with state machine
7. `src/lib/chat/msg/code-block/` — Syntax highlighting with copy
8. `src/lib/chat/status/token-usage/` — Usage/cost display

### Phase C — Composer Enrichment
9. Attachment pipeline module
10. IME composition guard
11. Streaming markdown rendering (streamdown or equivalent)

### Phase D — Polish
12. Shimmer effect for streaming
13. Prompt suggestions
14. `use-stick-to-bottom` evaluation
15. ARIA improvements (`role="log"`, live regions)

---

## 8. File Placement Decision

New content block components go in `src/lib/chat/msg/` (the implementation library), NOT in `src/lib/morphchat/components/`. MorphChat orchestrates; chat/ implements. This preserves the existing architecture:

```
src/lib/chat/msg/           ← Content block components (thinking, tool, code)
src/lib/chat/status/        ← Token usage/cost components
src/lib/chat/composer/      ← Attachment pipeline
src/lib/morphchat/          ← Orchestration (spec → component selection)
```

MorphChat's `ThreadView` will compose from `chat/msg/` blocks based on `ChatMessage.parts[]` type discriminant:

```tsx
// In ThreadView.FullMessage
{message.parts.map((part) => {
  switch (part._tag) {
    case 'text':
      return <ChatMessageBodyContent.Root key={...}>{part.content}</ChatMessageBodyContent.Root>
    case 'thinking':
      return <ChatThinkingBlock key={...} isStreaming={part.isStreaming}>{part.content}</ChatThinkingBlock>
    case 'tool-invocation':
      return <ChatToolBlock key={...} state={part.state} toolName={part.toolName} input={part.input} output={part.output} />
    case 'file':
      return <ChatFileAttachment key={...} url={part.url} mediaType={part.mediaType} />
  }
})}
```

This mirrors exactly how AI Elements renders `UIMessage.parts[]` — but with our compound component hierarchy instead of their flat components.
