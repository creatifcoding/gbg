# Harness Gap Analysis — ai-elements as Reference

> **Date**: 2026-02-19
> **Reference**: `src/components/ai-elements/` (Vercel AI Elements, scaffolded via CLI)
> **Subject**: `src/lib/harness/` (TMNL Harness Runtime + Transport)

---

## Executive Summary

The TMNL Harness is a **full custom engine** — session management, WebSocket transport, Effect-based services, provider marker pipeline, and rendering overlay. AI Elements is a **thin UI component library** that delegates all transport/session to the AI SDK `useChat` hook.

The gap analysis reveals **the harness has OVER-engineered the transport layer but UNDER-engineered the UI rendering contract.** AI Elements treats rendering as first-class; we treat it as an afterthought bridged through MorphChat adapters.

---

## 1. Streaming Architecture

### AI Elements Pattern
```
useChat() → text delta parts → <MessageResponse> (Streamdown) → markdown render
                              → <Reasoning> (collapsible thinking)
                              → <Tool> (state-driven tool card)
```

AI Elements receives **structured message parts** (`UIMessage.parts[]`), each typed:
- `text` — rendered via `Streamdown` (streaming markdown renderer)
- `tool-invocation` — rendered via `<Tool>` compound component with state machine (`input-streaming` → `input-available` → `approval-requested` → `output-available`)
- `reasoning` — rendered via `<Reasoning>` with auto-open/close and duration tracking
- `file` — rendered via `<MessageAttachment>`

### TMNL Harness Pattern
```
PiAiHarnessEngine → HarnessEvent stream → HarnessBrowserTransport (WS)
                   → useHarnessAdapter → adapter.messages$ (flat array)
                   → ThreadView → ChatMessage.content (string blob)
```

The harness emits **granular events** (`assistant_delta`, `assistant_thinking_delta`, `tool_event`, `provider_marker`) but they are **collapsed into a single `content: string`** by the time they reach the UI. The rendering layer has no concept of "message parts."

### Gap: Message Parts Model

| Capability | AI Elements | TMNL Harness | Status |
|---|---|---|---|
| Text delta streaming | ✅ `Streamdown` component | ✅ `assistant_delta` events | **PARITY** |
| Thinking/reasoning display | ✅ `<Reasoning>` compound | ❌ `thinking_delta` events exist but no UI | **MISSING** |
| Tool invocation cards | ✅ `<Tool>` with state machine | ❌ `tool_event` emitted but not rendered | **MISSING** |
| Tool approval flow | ✅ `<Confirmation>` compound | ❌ No approval UI | **MISSING** |
| File/image attachments | ✅ `<MessageAttachment>` | ⚠️ Schema exists (`ChatAttachment`) but no renderer | **SCHEMA ONLY** |
| Message branching | ✅ `<MessageBranch>` compound | ❌ Not implemented | **MISSING** |
| Inline citations | ✅ `<InlineCitation>` carousel | ❌ Not implemented | **MISSING** |

### Inference: Structured Message Parts

The harness already emits the raw material (thinking deltas, tool events, provider markers). What's missing is a **message parts model** that preserves structure through to the UI:

```typescript
// PROPOSED: ChatMessagePart union (Effect Schema)
const TextPart = Schema.TaggedStruct('text', {
  content: Schema.String,
})

const ThinkingPart = Schema.TaggedStruct('thinking', {
  content: Schema.String,
  durationMs: Schema.optional(Schema.Number),
  isStreaming: Schema.Boolean,
})

const ToolInvocationPart = Schema.TaggedStruct('tool-invocation', {
  toolCallId: Schema.String,
  toolName: Schema.String,
  state: Schema.Literal(
    'input-streaming', 'input-available',
    'approval-requested', 'approval-responded',
    'output-available', 'output-error', 'output-denied',
  ),
  input: Schema.optional(Schema.Unknown),
  output: Schema.optional(Schema.Unknown),
  errorText: Schema.optional(Schema.String),
})

const FilePart = Schema.TaggedStruct('file', {
  url: Schema.String,
  mediaType: Schema.String,
  filename: Schema.optional(Schema.String),
})

const ChatMessagePart = Schema.Union(TextPart, ThinkingPart, ToolInvocationPart, FilePart)
```

The `ChatMessage.content: string` field becomes `ChatMessage.parts: ReadonlyArray<ChatMessagePart>`, with `content` as a computed getter for backwards compat.

---

## 2. Prompt Input / Composer

### AI Elements Pattern
The `prompt-input.tsx` (1413 lines) is the **most sophisticated component** in ai-elements:
- `<PromptInputProvider>` lifts state globally (text + attachments)
- Dual-mode: self-managed or provider-controlled
- File attachments with drag/drop, paste, validation (accept, maxFiles, maxFileSize)
- `syncHiddenInput` for native form posting
- `<PromptInputSpeechButton>` with Web Speech API
- `<PromptInputActionMenu>` dropdown with extensible items
- `<PromptInputSelect>` for model switching inline
- `<PromptInputCommand>` for slash-command palette
- `<PromptInputSubmit>` with status-aware icons (send/loading/stop/error)

### TMNL Composer Pattern
`src/lib/chat/composer/` + `src/lib/morphchat/components/composer-view.tsx`:
- `<Composer>` compound with TextArea, Toolbar, SendButton, ThinkingLevel, ModeToggle, ContextChips, ActionButton
- MorphChat resolves spec axis → variant (full/single-line/command/structured/none)
- Transfer drop zone for task references
- Command suggestions popup

### Gap: Composer Feature Parity

| Capability | AI Elements | TMNL Composer | Status |
|---|---|---|---|
| Text input + auto-grow | ✅ `InputGroupTextarea` | ✅ `Composer.TextArea` | **PARITY** |
| Enter-to-send / Shift+Enter newline | ✅ + IME-safe (isComposing) | ⚠️ Enter sends, but no IME guard | **PARTIAL** |
| File attachments (drag/drop/paste) | ✅ Full pipeline + blob→dataURL | ❌ No attachment pipeline | **MISSING** |
| Speech-to-text | ✅ Web Speech API | ❌ Icon only, no implementation | **STUB** |
| Model selector in composer | ✅ `<PromptInputSelect>` | ✅ `<ModelSelectorView>` in header band | **PARITY** (different placement) |
| Status-aware submit button | ✅ send/spinner/stop/error states | ⚠️ Send button, pause separate | **PARTIAL** |
| Provider-controlled state | ✅ `<PromptInputProvider>` | ❌ Composer is self-contained | **MISSING** |
| Slash-command palette | ✅ `<PromptInputCommand>` (cmdk) | ⚠️ Custom `CommandSuggestions` popup | **PARTIAL** |
| Global drop zone | ✅ `globalDrop` prop | ❌ Only transfer system drops | **MISSING** |
| Backspace removes last attachment | ✅ | ❌ No attachments | **N/A** |

### Inference: Attachment Pipeline Priority

The single biggest missing feature. AI Elements handles:
1. File selection (input[type=file])
2. Drag & drop (form-level + document-level)
3. Paste (clipboard images)
4. Blob URL → data URL conversion for submission
5. Memory leak prevention (revokeObjectURL on unmount)
6. Validation (accept types, max file count, max file size)

This is a **meaty feature** that needs its own module, not a quick patch.

---

## 3. Event Model

### AI Elements
Uses `UIMessage` from the AI SDK — a flat message with typed parts. State management is entirely in `useChat()`:
- Streaming status via `ChatStatus` (`'idle' | 'submitted' | 'streaming' | 'error'`)
- Messages are the source of truth (no separate streaming buffer)
- Branching via client-side `MessageBranch` component

### TMNL Harness
Uses `HarnessEvent` discriminated union (12 event types) → consumed by `useHarnessAdapter` → mutates atoms:
- `messages$` — full message array
- `streaming$` — separate `StreamingState` with buffer
- `connection$` — connection lifecycle

### Gap: Event Semantics

| Event Type | AI Elements | TMNL Harness | Status |
|---|---|---|---|
| Session lifecycle | `ChatStatus` enum | `session_opened`, `heartbeat` events | **PARITY** |
| Text deltas | Part of `UIMessage.parts` | `assistant_delta` event → `messages$` atom | **PARITY** |
| Thinking deltas | `UIMessage.parts[].type === 'reasoning'` | `assistant_thinking_delta` event → **NOT surfaced to UI** | **GAP** |
| Tool lifecycle | `ToolUIPart.state` enum (6 states) | `tool_event` (start/update/end) → **NOT surfaced to UI** | **GAP** |
| Usage/cost | `LanguageModelUsage` → `<Context>` component | `chat:v2/usage` event → **NOT surfaced to UI** | **GAP** |
| Provider markers | N/A (abstracted away) | Full `HarnessProviderMarker` union + pipeline | **TMNL EXTRA** |
| Metrics | N/A | `chat:v2/metric` (ackLatency, firstDeltaLag, etc.) | **TMNL EXTRA** |

### Inference: The harness is richer than AI Elements at the event level — it captures **observability data** (metrics, provider markers) that AI Elements doesn't even attempt. The gap is purely in **UI surfacing**.

---

## 4. Rendering Pipeline

### AI Elements Pattern
Simple: compound components consume `UIMessage` directly.
- `<Message from={role}>` → `<MessageContent>` → `<MessageResponse>` (Streamdown)
- `<Reasoning>` auto-opens during streaming, auto-closes after
- `<Tool>` reads `ToolUIPart` state
- No overlay/transform pipeline — raw parts → UI

### TMNL Harness Pattern
Complex: `OverlayReducerPipeline` for server-side transforms, but then flattened to strings for client.
- `src/lib/harness/rendering/OverlayReducerPipeline.ts` — Pattern-matched marker dispatch, composable reducers
- **Already benchmarked**: 25μs/event at p50, 10M events/sec throughput
- But the pipeline output is consumed by... a string concatenation into `ChatMessage.content`

### Gap: Pipeline Output Structure

The `OverlayReducerPipeline` is **world-class** for what it does — but it produces output that gets **immediately lossy-compressed** into a string. The fix is to make the pipeline emit `ChatMessagePart[]` instead of `string`, preserving:
- Text segments (already works)
- Thinking segments (currently discarded or flattened)
- Tool invocation lifecycle (currently flattened to text like "Using tool: X")
- Citations/sources (currently not tracked)

---

## 5. UI Components Missing from Harness/Chat

Components present in ai-elements that have **no equivalent** in our system:

| Component | Purpose | Priority | Notes |
|---|---|---|---|
| `<Reasoning>` | Collapsible thinking with auto-close + duration | **P0** | We have thinking_delta events — just need the UI |
| `<Tool>` | Tool invocation with state badges | **P0** | We have tool_event — just need the UI |
| `<Confirmation>` | Human-in-the-loop tool approval | **P1** | We have `HarnessExtensionUIResponse` schema |
| `<Context>` | Token usage + cost display | **P1** | We have `chat:v2/usage` event |
| `<ChainOfThought>` | Multi-step reasoning visualization | **P1** | Could compose from thinking parts |
| `<Sources>` | Collapsible citation list | **P2** | No equivalent event yet |
| `<InlineCitation>` | Inline text citation + carousel | **P2** | Would need markdown parser integration |
| `<CodeBlock>` | Syntax-highlighted code with copy | **P1** | Currently raw markdown only |
| `<Plan>` | Streaming plan card | **P2** | Could map to inline tasks |
| `<Checkpoint>` | Conversation bookmark | **P3** | No equivalent concept |
| `<Queue>` | Message/todo queue | **P2** | Could map to inline tasks |
| `<Suggestion>` | Prompt suggestions (horizontal scroll) | **P2** | No equivalent |
| `<Shimmer>` | Streaming text shimmer effect | **P1** | We use stream cursor but no shimmer |
| `<Loader>` | Animated loading spinner | **P3** | We have other spinners |

---

## 6. Conversation/Scroll

### AI Elements
Uses `use-stick-to-bottom` — a 3rd-party library:
```tsx
<StickToBottom initial="smooth" resize="smooth" role="log">
  <StickToBottom.Content>{messages}</StickToBottom.Content>
</StickToBottom>
```
Plus a `ConversationScrollButton` that reads `useStickToBottomContext()`.

### TMNL
Uses custom `useTailFollow` with MutationObserver + ResizeObserver:
```tsx
<ChatThreadBand autoScroll="follow" itemCount={n}>
  {messages}
</ChatThreadBand>
```
Plus `<ThreadTailControls>` for manual scroll-to-bottom.

### Gap: Scroll Reliability

| Feature | AI Elements | TMNL | Status |
|---|---|---|---|
| Stick to bottom | ✅ `use-stick-to-bottom` (battle-tested) | ⚠️ Custom MutationObserver (known issues) | **FRAGILE** |
| Smooth scroll on new messages | ✅ `initial="smooth"` | ✅ `behavior: 'smooth'` | **PARITY** |
| Resize-aware | ✅ `resize="smooth"` | ⚠️ ResizeObserver present but partial | **PARTIAL** |
| Scroll button | ✅ `ConversationScrollButton` | ✅ `ThreadTailControls` | **PARITY** |
| Empty state | ✅ `ConversationEmptyState` | ✅ "No messages yet" | **PARITY** |
| `role="log"` ARIA | ✅ | ❌ | **MISSING** |

### Inference: Consider adopting `use-stick-to-bottom` instead of maintaining custom scroll logic. The current `useTailFollow` has been through multiple reverts and still has edge cases.

---

## 7. Transport Protocol

### AI Elements
Delegates entirely to AI SDK — SSE (Server-Sent Events) or fetch streaming. No WebSocket. No custom protocol.

### TMNL Harness
Custom WebSocket protocol with:
- Binary frames via `@effect/platform` Socket
- `HarnessBrowserRemoteSchemas` for typed RPC (open/send/replay/subscribe)
- Session multiplexing
- Heartbeat events
- Replay cursors for catch-up
- Event persistence store

### Gap: None (TMNL advantage)

The harness transport is **more capable** than AI Elements. The gap is that this capability isn't reflected in the UI. Features to leverage:

1. **Replay** — UI could show session history with seek-to-timestamp
2. **Heartbeat** — UI could show connection quality indicator (latency)
3. **Metrics** — UI could show real-time performance (ack latency, first delta lag)
4. **Provider markers** — UI could show raw provider events for debugging

---

## 8. Recommendations (Priority Order)

### P0 — Must Have
1. **ChatMessagePart union** — Add structured parts to `ChatMessage` schema (text, thinking, tool-invocation, file)
2. **Thinking/Reasoning UI** — Port `<Reasoning>` pattern as `<ChatReasoningBlock>` in `src/lib/chat/`
3. **Tool Invocation UI** — Port `<Tool>` pattern as `<ChatToolBlock>` with state machine
4. **IME guard** — Add `isComposing` check to composer Enter handler

### P1 — Should Have
5. **Token usage/cost display** — Wire `chat:v2/usage` event → `<ChatContextBadge>` component
6. **Tool approval flow** — Wire `HarnessExtensionUIResponse` → `<ChatConfirmation>` component
7. **Code block with syntax highlighting** — Integrate Shiki or similar into markdown renderer
8. **Shimmer effect** — Port `<Shimmer>` for streaming text (we have motion/react, same as them)
9. **Attachment pipeline** — File drag/drop/paste for composer (standalone module)

### P2 — Nice to Have
10. **Inline citations** — Would require markdown parser integration
11. **Prompt suggestions** — Horizontal scroll chips above composer
12. **Plan/Queue mapping** — Map to inline task views
13. **`use-stick-to-bottom` adoption** — Replace custom scroll logic
14. **ARIA `role="log"`** — Add to conversation container
15. **Message branching** — Edit + regenerate support

### P3 — Future
16. **Speech-to-text** — Web Speech API integration in composer
17. **Checkpoint/bookmark** — Conversation markers
18. **Global drop zone** — Document-level file drop

---

## 9. Architecture Principle

AI Elements works because it **constrains the problem**: UI components consume a well-defined `UIMessage` type. They don't care about transport, sessions, or rendering pipelines.

The TMNL Harness works because it **expands the problem**: full control over transport, observability, replay. But this power gets lost at the boundary where events become strings.

**The fix is a better boundary contract.** The harness should produce `ChatMessage` instances with typed `parts[]`, not flat `content: string`. Then the UI layer can render each part with the appropriate compound component — just like AI Elements, but with richer data.

```
HarnessEvent stream → OverlayReducerPipeline → ChatMessage { parts: ChatMessagePart[] }
                                                             ↑ THIS IS THE FIX
                                                             
ChatMessage.parts → <ThinkingBlock>     (for thinking parts)
                  → <ToolBlock>          (for tool-invocation parts)
                  → <Streamdown>         (for text parts)
                  → <AttachmentCard>     (for file parts)
```

The harness already does the hard work. The gap is purely in **structured output** and **UI rendering of that structure**.
